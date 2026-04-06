import { Command } from "commander";
import { writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { generateDefaultConfig } from "../../core/config.js";

export const initCommand = new Command("init")
  .description("Create a .autogherkrc.json config file")
  .action(async () => {
    const configPath = join(process.cwd(), ".autogherkrc.json");

    try {
      await access(configPath);
      console.log("Config file already exists at .autogherkrc.json");
      return;
    } catch {
      // File doesn't exist, create it
    }

    await writeFile(configPath, generateDefaultConfig() + "\n");
    console.log("Created .autogherkrc.json — update it with your API keys.");
    console.log(
      'Tip: use "env:GEMINI_API_KEY" format to reference environment variables.',
    );
  });
