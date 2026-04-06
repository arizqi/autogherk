import { Command } from "commander";
import { generateCommand } from "./cli/commands/generate.js";
import { initCommand } from "./cli/commands/init.js";

const program = new Command()
  .name("autogherk")
  .description(
    "AI-powered tool that generates BDD Gherkin scenarios from product usage videos",
  )
  .version("0.1.0");

program.addCommand(generateCommand);
program.addCommand(initCommand);

program.parse();
