import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, basename, resolve } from "node:path";
import ora from "ora";
import chalk from "chalk";
import type { GenerateOptions, VideoAnalysis, BuildSpec } from "./types.js";

const execFileAsync = promisify(execFile);
import { loadConfig } from "./config.js";
import { resolveVideoInputs, cleanupAllTempVideos } from "./video-input.js";
import { analyzeVideo, generateBuildSpecFromVideo } from "../gemini/client.js";
import { generateGherkin } from "../claude/client.js";
import { writeOutput, writeSpecOutput } from "../output/writer.js";

/**
 * Merge multiple VideoAnalysis results into a single combined analysis.
 */
function mergeAnalyses(analyses: VideoAnalysis[]): VideoAnalysis {
  if (analyses.length === 1) {
    return analyses[0];
  }

  return {
    screens: analyses.flatMap((a) => a.screens),
    interactions: analyses.flatMap((a) => a.interactions),
    transcript: analyses.some((a) => a.transcript)
      ? analyses.flatMap((a) => a.transcript ?? [])
      : undefined,
    summary: analyses.map((a, i) => `[Video ${i + 1}] ${a.summary}`).join("\n"),
  };
}

export async function runPipeline(options: GenerateOptions): Promise<void> {
  const spinner = ora();

  try {
    // Load config
    spinner.start("Loading configuration...");
    const config = await loadConfig(options);
    spinner.succeed("Configuration loaded");

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

    // Resolve video inputs (local paths, URLs, or directories)
    spinner.start("Resolving video input(s)...");
    const resolvedVideos = await resolveVideoInputs(options.video);
    spinner.succeed(
      resolvedVideos.length === 1
        ? resolvedVideos[0].isTemp
          ? `Downloaded video from ${resolvedVideos[0].originalSource}`
          : `Using local video: ${resolvedVideos[0].localPath}`
        : `Resolved ${resolvedVideos.length} video(s)`,
    );

    // Resolve context from --context or --context-file
    let context: string | undefined = options.context;
    if (!context && options.contextFile) {
      context = await readFile(options.contextFile, "utf-8");
    }

    try {
      if (options.format === "spec") {
        // Spec mode: single-stage — Gemini sees the video directly and generates the build spec
        // This is more accurate than two-stage since Gemini has the full visual context
        const rv = resolvedVideos[0];
        spinner.start("Uploading video to Gemini for build spec generation...");
        const specResult = await generateBuildSpecFromVideo(
          rv.localPath,
          config.geminiApiKey,
          config.geminiModel,
          (_stage, msg) => {
            spinner.text = msg;
          },
          context,
          options.depth ?? "deep",
        );
        spinner.succeed(
          `Generated build spec: ${specResult.screens.length} screen(s), ${specResult.dataModel.length} entit${specResult.dataModel.length === 1 ? "y" : "ies"}`,
        );

        // Extract reference screenshots from video
        if (!options.dryRun) {
          spinner.start("Extracting reference screenshots...");
          const screenshots = await extractScreenshots(
            rv.localPath,
            specResult,
            config.outputDir,
            (msg) => { spinner.text = msg; },
          );
          if (screenshots.length > 0) {
            spinner.succeed(`Extracted ${screenshots.length} reference screenshot(s)`);
          } else {
            spinner.warn("No screenshots extracted (ffmpeg may not be installed)");
          }
        }

        // Write spec output
        spinner.start("Writing spec files...");
        const result = await writeSpecOutput(
          specResult,
          config.outputDir,
          options.dryRun ?? false,
          (_stage, msg) => {
            spinner.text = msg;
          },
        );
        spinner.succeed("Output written");

        console.log(
          chalk.green(
            `\n✓ Generated ${result.featureFiles.length} spec file(s)`,
          ),
        );
        for (const f of result.featureFiles) {
          console.log(chalk.dim(`  ${f}`));
        }
      } else {
        // Gherkin/JSON mode: two-stage — Gemini analyzes, Claude generates
        const analyses: VideoAnalysis[] = [];

        for (let i = 0; i < resolvedVideos.length; i++) {
          const rv = resolvedVideos[i];
          const label =
            resolvedVideos.length > 1
              ? ` [${i + 1}/${resolvedVideos.length}] ${basename(rv.localPath)}`
              : "";

          spinner.start(`Uploading video to Gemini...${label}`);
          const analysis = await analyzeVideo(
            rv.localPath,
            config.geminiApiKey,
            config.geminiModel,
            (_stage, msg) => {
              spinner.text = `${msg}${label}`;
            },
          );
          spinner.succeed(
            `Video analyzed${label}: ${analysis.interactions.length} interactions found across ${analysis.screens.length} screens`,
          );

          if (options.verbose) {
            console.log(
              chalk.dim(`\n--- Gemini Analysis${label} ---\n`),
              JSON.stringify(analysis, null, 2),
              chalk.dim("\n--- End Analysis ---\n"),
            );
          }

          analyses.push(analysis);
        }

        const analysis = mergeAnalyses(analyses);

        if (options.saveAnalysis) {
          await mkdir(config.outputDir, { recursive: true });
          const analysisPath = join(config.outputDir, "analysis.json");
          await writeFile(analysisPath, JSON.stringify(analysis, null, 2));
          console.log(chalk.dim(`Saved analysis to ${analysisPath}`));
        }

        spinner.start("Generating Gherkin scenarios with Claude...");
        const gherkinResult = await generateGherkin(
          analysis,
          config.anthropicApiKey,
          config.claudeModel,
          config.framework,
          (_stage, msg) => {
            spinner.text = msg;
          },
          context,
        );
        spinner.succeed(
          `Generated ${gherkinResult.features.length} feature(s) with ${countScenarios(gherkinResult)} scenario(s)`,
        );

        spinner.start("Writing output files...");
        const result = await writeOutput(
          gherkinResult,
          config.outputDir,
          config.framework,
          config.generateStubs,
          options.dryRun ?? false,
          (_stage, msg) => {
            spinner.text = msg;
          },
          options.append,
          options.format,
        );
        spinner.succeed("Output written");

        console.log(
          chalk.green(
            `\n✓ Generated ${result.featureFiles.length} feature file(s)`,
          ),
        );
        for (const f of result.featureFiles) {
          console.log(chalk.dim(`  ${f}`));
        }
        if (result.stubFiles.length > 0) {
          console.log(
            chalk.green(`✓ Generated ${result.stubFiles.length} stub file(s)`),
          );
          for (const f of result.stubFiles) {
            console.log(chalk.dim(`  ${f}`));
          }
        }
      }
    } finally {
      await cleanupAllTempVideos(resolvedVideos);
    }
  } catch (error) {
    spinner.fail(
      error instanceof Error ? error.message : "An unknown error occurred",
    );
    process.exit(1);
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

    // Convert MM:SS to seconds for ffmpeg
    const timestamp = screen.screenshotTimestamp;

    try {
      await execFileAsync("ffmpeg", [
        "-ss", timestamp,
        "-i", videoPath,
        "-frames:v", "1",
        "-q:v", "2",
        "-y",
        outPath,
      ]);
      extracted.push(outPath);
      onProgress?.(`Extracted screenshot: ${fileName}`);
    } catch {
      onProgress?.(`Warning: Could not extract screenshot at ${timestamp} for ${screen.name}`);
    }
  }

  return extracted;
}

function countScenarios(result: {
  features: { scenarios: unknown[] }[];
}): number {
  return result.features.reduce((sum, f) => sum + f.scenarios.length, 0);
}
