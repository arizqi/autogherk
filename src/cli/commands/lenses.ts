import { Command } from "commander";
import chalk from "chalk";
import { listAvailableLenses, loadLens } from "../../core/lenses.js";

export const lensesCommand = new Command("lenses")
  .description("List available lenses (built-in + custom)")
  .argument("[name]", "Optional lens name to describe in detail")
  .action(async (name: string | undefined) => {
    if (name) {
      try {
        const lens = await loadLens(name);
        console.log(chalk.bold(`\n${lens.tag} — ${lens.isCustom ? "Custom" : "Built-in"} lens\n`));
        console.log(chalk.dim("Persona:"));
        console.log(`  ${lens.persona}\n`);
        console.log(chalk.dim("Priorities:"));
        for (const p of lens.priorities) {
          console.log(`  - ${p}`);
        }
        console.log();
        console.log(chalk.dim("Scenario vocabulary:"));
        console.log(`  ${lens.scenarioVocabulary}\n`);
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }
      return;
    }

    const { builtIn, custom } = await listAvailableLenses();
    console.log(chalk.bold("\nBuilt-in lenses:"));
    for (const lens of builtIn) {
      console.log(`  ${chalk.cyan(`@${lens}`.padEnd(12))} ${lensSummary(lens)}`);
    }

    if (custom.length > 0) {
      console.log(chalk.bold("\nCustom lenses (.autogherk/lenses/):"));
      for (const lens of custom) {
        console.log(`  ${chalk.magenta(`@${lens}`.padEnd(12))} (custom)`);
      }
    } else {
      console.log(
        chalk.dim(
          "\nNo custom lenses found. Create .autogherk/lenses/<name>.md to define your own.",
        ),
      );
    }

    console.log(chalk.dim("\nUse with: autogherk generate -v demo.mp4 --lens <name>"));
    console.log(chalk.dim("Show details: autogherk lenses <name>\n"));
  });

function lensSummary(name: string): string {
  const summaries: Record<string, string> = {
    qa: "QA engineer — edge cases, validation, regression coverage",
    designer: "Product designer — states, micro-interactions, visual hierarchy",
    growth: "Growth PM — activation, funnels, paywalls, upgrade paths",
    security: "Security auditor — auth boundaries, input validation, privilege",
    support: "Support engineer — stuck states, error recovery, help paths",
    pm: "Product manager — value delivery, KPI paths, competitive edges",
    a11y: "Accessibility auditor — keyboard, screen reader, focus management",
  };
  return summaries[name] ?? "";
}
