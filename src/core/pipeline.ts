import ora from "ora";
import chalk from "chalk";
import type { GenerateOptions } from "./types.js";
import { generate, type GenerateEvent } from "./generate.js";

/**
 * CLI adapter around the pure core generate() pipeline: renders progress
 * events as a terminal spinner, prints the result summary, exits non-zero
 * on failure. All actual logic lives in core/generate.ts.
 */
export async function runPipeline(options: GenerateOptions): Promise<void> {
  const spinner = ora();

  const onEvent = (event: GenerateEvent) => {
    switch (event.type) {
      case "start":
        spinner.start(event.message);
        break;
      case "update":
        spinner.text = event.message;
        break;
      case "done":
        spinner.succeed(event.message);
        break;
      case "warn":
        spinner.warn(event.message);
        break;
      case "info":
        spinner.stop();
        console.log(chalk.cyan(event.message));
        break;
      case "verbose":
        spinner.stop();
        console.log(
          chalk.dim("\n--- Gemini Analysis ---\n"),
          event.message,
          chalk.dim("\n--- End Analysis ---\n"),
        );
        break;
    }
  };

  try {
    const result = await generate(options, onEvent);

    if (result.mode === "spec") {
      console.log(
        chalk.green(`\n✓ Generated ${result.featureFiles.length} spec file(s)`),
      );
      for (const f of result.featureFiles) {
        console.log(chalk.dim(`  ${f}`));
      }
    } else {
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
  } catch (error) {
    spinner.fail(
      error instanceof Error ? error.message : "An unknown error occurred",
    );
    process.exit(1);
  }
}
