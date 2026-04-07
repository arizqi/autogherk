import { Command } from "commander";
import type { GenerateOptions, Framework } from "../../core/types.js";
import { runPipeline } from "../../core/pipeline.js";

export const generateCommand = new Command("generate")
  .description("Generate Gherkin scenarios from product usage video(s)")
  .requiredOption(
    "-v, --video <paths...>",
    "Input video path(s), URL(s), or directory (repeatable, comma-separated supported)",
  )
  .option("-o, --output <dir>", "Output directory", "./features/")
  .option(
    "-f, --framework <name>",
    "Target framework (cucumber-js, cucumber-java, behave, specflow)",
  )
  .option("--verbose", "Show intermediate Gemini analysis", false)
  .option("--dry-run", "Preview output without writing files", false)
  .option("--save-analysis", "Save raw Gemini analysis to JSON", false)
  .option("-c, --config <path>", "Path to config file")
  .option("--context <text>", "Additional context about your application for better scenario generation")
  .option("--context-file <path>", "Path to a file containing application context")
  .option("--append", "Append scenarios to existing .feature files instead of overwriting", false)
  .option("--format <type>", "Output format (gherkin, json, or spec)", "gherkin")
  .option("--depth <level>", "Spec detail level: deep (exhaustive, default) or shallow (surface-level)", "deep")
  .action(async (opts) => {
    const options: GenerateOptions = {
      video: opts.video,
      output: opts.output,
      framework: opts.framework as Framework | undefined,
      verbose: opts.verbose,
      dryRun: opts.dryRun,
      saveAnalysis: opts.saveAnalysis,
      config: opts.config,
      context: opts.context,
      contextFile: opts.contextFile,
      append: opts.append,
      format: opts.format as "gherkin" | "json" | "spec",
      depth: opts.depth as "deep" | "shallow",
    };

    await runPipeline(options);
  });
