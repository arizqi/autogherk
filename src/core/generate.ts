import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, basename, resolve } from "node:path";
import type {
  GenerateOptions,
  VideoAnalysis,
  BuildSpec,
  GherkinResult,
} from "./types.js";
import { loadConfig } from "./config.js";
import { resolveVideoInputs, cleanupAllTempVideos } from "./video-input.js";
import { analyzeVideo, generateBuildSpecFromVideo } from "../gemini/client.js";
import { generateGherkin } from "../claude/client.js";
import { writeOutput, writeSpecOutput } from "../output/writer.js";
import { loadLenses, parseLensFlag, getLensTags, type Lens } from "./lenses.js";

const execFileAsync = promisify(execFile);

/** Progress event emitted by the core generate() pipeline. */
export interface GenerateEvent {
  type: "start" | "update" | "done" | "warn" | "info" | "verbose";
  message: string;
}

export type GenerateEventHandler = (event: GenerateEvent) => void;

export interface GenerateResult {
  mode: "gherkin" | "json" | "spec";
  featureFiles: string[];
  stubFiles: string[];
  screenshots: string[];
  analysis?: VideoAnalysis;
  spec?: BuildSpec;
  gherkin?: GherkinResult;
}

/**
 * Ensure every scenario and feature in a GherkinResult carries the given lens tags.
 */
function applyLensTags(result: GherkinResult, lenses: Lens[]): GherkinResult {
  if (lenses.length === 0) return result;
  const lensTags = getLensTags(lenses);

  const addTags = (existing: string[] = []) => {
    const set = new Set(existing);
    for (const tag of lensTags) set.add(tag);
    return Array.from(set);
  };

  return {
    features: result.features.map((feature) => ({
      ...feature,
      tags: addTags(feature.tags),
      scenarios: feature.scenarios.map((scenario) => ({
        ...scenario,
        tags: addTags(scenario.tags),
      })),
    })),
  };
}

/** Merge multiple VideoAnalysis results into a single combined analysis. */
function mergeAnalyses(analyses: VideoAnalysis[]): VideoAnalysis {
  if (analyses.length === 1) {
    return analyses[0];
  }

  return {
    screens: analyses.flatMap((a, i) =>
      a.screens.map((s) => ({ ...s, timestamp: `V${i + 1} ${s.timestamp}` })),
    ),
    interactions: analyses.flatMap((a, i) =>
      a.interactions.map((x) => ({ ...x, timestamp: `V${i + 1} ${x.timestamp}` })),
    ),
    transcript: analyses.some((a) => a.transcript)
      ? analyses.flatMap((a, i) =>
          (a.transcript ?? []).map((t) => ({ ...t, timestamp: `V${i + 1} ${t.timestamp}` })),
        )
      : undefined,
    summary: analyses.map((a, i) => `[Video ${i + 1}] ${a.summary}`).join("\n"),
  };
}

/**
 * Pure core generation pipeline. No terminal UI, no process.exit — throws on
 * failure and reports progress via the event handler. Both the CLI and the
 * public API delegate here.
 */
export async function generate(
  options: GenerateOptions,
  onEvent: GenerateEventHandler = () => {},
): Promise<GenerateResult> {
  const emit = (type: GenerateEvent["type"], message: string) =>
    onEvent({ type, message });

  // Load config
  emit("start", "Loading configuration...");
  const config = await loadConfig(options);
  emit("done", "Configuration loaded");

  // Load lenses if specified
  const lensNames = parseLensFlag(options.lens);
  const lenses: Lens[] = lensNames.length > 0 ? await loadLenses(lensNames) : [];
  if (lenses.length > 0) {
    const names = lenses.map((l) => `${l.name}${l.isCustom ? " (custom)" : ""}`).join(", ");
    emit("info", `Lens: ${names}`);
  }

  // Validate output directory is not an absolute escape
  const resolvedOutput = resolve(config.outputDir);
  const cwd = resolve(process.cwd());
  if (!resolvedOutput.startsWith(cwd)) {
    throw new Error(
      `Output directory must be within the current working directory. Got: ${config.outputDir}`,
    );
  }

  // Validate context-file is within project directory
  if (options.contextFile) {
    const resolvedCtx = resolve(options.contextFile);
    if (!resolvedCtx.startsWith(cwd)) {
      throw new Error(
        `Context file must be within the current working directory. Got: ${options.contextFile}`,
      );
    }
  }

  // --from-analysis: reuse a saved Gemini analysis, skip video + Gemini entirely
  if (options.fromAnalysis) {
    if (options.format === "spec") {
      throw new Error(
        "--from-analysis is not compatible with --format spec (spec mode generates directly from video). Use gherkin or json format.",
      );
    }
    const resolvedAnalysisPath = resolve(options.fromAnalysis);
    if (!resolvedAnalysisPath.startsWith(cwd)) {
      throw new Error(
        `Analysis file must be within the current working directory. Got: ${options.fromAnalysis}`,
      );
    }
  }

  // Resolve video inputs (skipped entirely when running from a saved analysis)
  let resolvedVideos: Awaited<ReturnType<typeof resolveVideoInputs>> = [];
  if (!options.fromAnalysis) {
    if (!options.video) {
      throw new Error("Either --video or --from-analysis is required.");
    }
    emit("start", "Resolving video input(s)...");
    resolvedVideos = await resolveVideoInputs(options.video);
    emit(
      "done",
      resolvedVideos.length === 1
        ? resolvedVideos[0].isTemp
          ? `Downloaded video from ${resolvedVideos[0].originalSource}`
          : `Using local video: ${resolvedVideos[0].localPath}`
        : `Resolved ${resolvedVideos.length} video(s)`,
    );

    // Spec mode is single-video only — fail loudly instead of silently dropping the rest
    if (options.format === "spec" && resolvedVideos.length > 1) {
      throw new Error(
        `Spec mode processes a single video, but ${resolvedVideos.length} were resolved. Pass one video, or run spec mode once per video.`,
      );
    }
  }

  // Resolve context from --context or --context-file
  let context: string | undefined = options.context;
  if (!context && options.contextFile) {
    context = await readFile(options.contextFile, "utf-8");
  }

  try {
    if (options.format === "spec") {
      // Spec mode: single-stage — Gemini sees the video directly
      const rv = resolvedVideos[0];
      if (!config.geminiApiKey) {
        throw new Error("Gemini API key required for spec mode");
      }
      emit("start", "Uploading video to Gemini for build spec generation...");
      const specResult = await generateBuildSpecFromVideo({
        videoPath: rv.localPath,
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        depth: options.depth ?? "deep",
        context,
        lenses,
        onProgress: (_stage, msg) => emit("update", msg),
      });
      emit(
        "done",
        `Generated build spec: ${specResult.screens.length} screen(s), ${specResult.dataModel.length} entit${specResult.dataModel.length === 1 ? "y" : "ies"}`,
      );

      // Extract reference screenshots from video
      let screenshots: string[] = [];
      if (!options.dryRun) {
        emit("start", "Extracting reference screenshots...");
        screenshots = await extractScreenshots(
          rv.localPath,
          specResult,
          config.outputDir,
          (msg) => emit("update", msg),
        );
        if (screenshots.length > 0) {
          emit("done", `Extracted ${screenshots.length} reference screenshot(s)`);
        } else {
          emit("warn", "No screenshots extracted (ffmpeg may not be installed)");
        }
      }

      // Write spec output
      emit("start", "Writing spec files...");
      const result = await writeSpecOutput(
        specResult,
        config.outputDir,
        options.dryRun ?? false,
        (_stage, msg) => emit("update", msg),
      );
      emit("done", "Output written");

      return {
        mode: "spec",
        featureFiles: result.featureFiles,
        stubFiles: [],
        screenshots,
        spec: specResult,
      };
    }

    // Gherkin/JSON mode: two-stage — Gemini analyzes, Claude generates
    if (!config.anthropicApiKey) {
      throw new Error("Anthropic API key required for gherkin/json mode");
    }
    const anthropicApiKey = config.anthropicApiKey;

    let analysis: VideoAnalysis;
    if (options.fromAnalysis) {
      emit("start", `Loading saved analysis from ${options.fromAnalysis}...`);
      const raw = await readFile(options.fromAnalysis, "utf-8");
      analysis = JSON.parse(raw);
      emit(
        "done",
        `Loaded analysis: ${analysis.interactions.length} interactions across ${analysis.screens.length} screens (Gemini stage skipped)`,
      );
    } else {
      if (!config.geminiApiKey) {
        throw new Error("Gemini API key required for video analysis");
      }
      const geminiApiKey = config.geminiApiKey;
      const analyses: VideoAnalysis[] = [];

      for (let i = 0; i < resolvedVideos.length; i++) {
        const rv = resolvedVideos[i];
        const label =
          resolvedVideos.length > 1
            ? ` [${i + 1}/${resolvedVideos.length}] ${basename(rv.localPath)}`
            : "";

        emit("start", `Uploading video to Gemini...${label}`);
        const videoAnalysis = await analyzeVideo({
          videoPath: rv.localPath,
          apiKey: geminiApiKey,
          model: config.geminiModel,
          lenses,
          onProgress: (_stage, msg) => emit("update", `${msg}${label}`),
        });
        emit(
          "done",
          `Video analyzed${label}: ${videoAnalysis.interactions.length} interactions found across ${videoAnalysis.screens.length} screens`,
        );

        if (options.verbose) {
          emit("verbose", JSON.stringify(videoAnalysis, null, 2));
        }

        analyses.push(videoAnalysis);
      }

      analysis = mergeAnalyses(analyses);
    }

    if (options.saveAnalysis) {
      await mkdir(config.outputDir, { recursive: true });
      const analysisPath = join(config.outputDir, "analysis.json");
      await writeFile(analysisPath, JSON.stringify(analysis, null, 2));
      emit("info", `Saved analysis to ${analysisPath}`);
    }

    emit("start", "Generating Gherkin scenarios with Claude...");
    const rawGherkin = await generateGherkin({
      analysis,
      apiKey: anthropicApiKey,
      model: config.claudeModel,
      framework: config.framework,
      context,
      lenses,
      onProgress: (_stage, msg) => emit("update", msg),
    });
    const gherkinResult = applyLensTags(rawGherkin, lenses);
    const scenarioCount = gherkinResult.features.reduce(
      (sum, f) => sum + f.scenarios.length,
      0,
    );
    emit(
      "done",
      `Generated ${gherkinResult.features.length} feature(s) with ${scenarioCount} scenario(s)`,
    );

    emit("start", "Writing output files...");
    const result = await writeOutput(
      gherkinResult,
      config.outputDir,
      config.framework,
      config.generateStubs,
      options.dryRun ?? false,
      (_stage, msg) => emit("update", msg),
      options.append,
      options.format,
    );
    emit("done", "Output written");

    return {
      mode: (options.format ?? "gherkin") as "gherkin" | "json",
      featureFiles: result.featureFiles,
      stubFiles: result.stubFiles,
      screenshots: [],
      analysis,
      gherkin: gherkinResult,
    };
  } finally {
    await cleanupAllTempVideos(resolvedVideos);
  }
}

async function extractScreenshots(
  videoPath: string,
  spec: BuildSpec,
  outputDir: string,
  onProgress?: (msg: string) => void,
): Promise<string[]> {
  const screenshotsDir = join(outputDir, "screenshots");
  await mkdir(screenshotsDir, { recursive: true });

  const extracted: string[] = [];

  for (const screen of spec.screens) {
    if (!screen.screenshotTimestamp) continue;

    const fileName =
      screen.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") + ".png";
    const outPath = join(screenshotsDir, fileName);

    try {
      await execFileAsync("ffmpeg", [
        "-ss", screen.screenshotTimestamp,
        "-i", videoPath,
        "-frames:v", "1",
        "-q:v", "2",
        "-y",
        outPath,
      ]);
      extracted.push(outPath);
      onProgress?.(`Extracted screenshot: ${fileName}`);
    } catch {
      onProgress?.(
        `Warning: Could not extract screenshot at ${screen.screenshotTimestamp} for ${screen.name}`,
      );
    }
  }

  return extracted;
}
