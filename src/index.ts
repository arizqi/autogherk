import { Command } from "commander";
import { generateCommand } from "./cli/commands/generate.js";
import { initCommand } from "./cli/commands/init.js";
import { installSkillsCommand } from "./cli/commands/install-skills.js";
import { exploreCommand } from "./cli/commands/explore.js";
import { lensesCommand } from "./cli/commands/lenses.js";

const program = new Command()
  .name("autogherk")
  .description(
    "AI-powered tool that generates BDD Gherkin scenarios and build specs from product usage videos, or autonomously explores live web apps",
  )
  .version("0.1.0");

program.addCommand(generateCommand);
program.addCommand(exploreCommand);
program.addCommand(lensesCommand);
program.addCommand(initCommand);
program.addCommand(installSkillsCommand);

program.parse();
