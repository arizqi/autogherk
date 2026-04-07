import { Command } from "commander";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SKILLS = ["autogherk", "build-from-spec"];

export const installSkillsCommand = new Command("install-skills")
  .description(
    "Install AutoGherk Claude Code skills into your project or home directory",
  )
  .option(
    "--global",
    "Install to ~/.claude/skills/ (available in all projects)",
    false,
  )
  .action(async (opts) => {
    const targetBase = opts.global
      ? join(process.env.HOME ?? "~", ".claude", "skills")
      : join(process.cwd(), ".claude", "skills");

    // Resolve the skills directory relative to the package root
    // When bundled by tsup, dist/index.js is one level down from package root
    // When running from source, src/cli/commands/ is three levels down
    const distDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(distDir, "..", "skills"),      // from dist/index.js → skills/
      join(distDir, "..", "..", "skills"), // from src/cli/commands/ → skills/
      join(distDir, "..", "..", "..", "skills"),
    ];

    let installed = 0;

    for (const skillName of SKILLS) {
      const targetDir = join(targetBase, skillName);
      const targetFile = join(targetDir, "SKILL.md");

      let sourceContent: string | undefined;
      for (const base of candidates) {
        const sourceFile = join(base, skillName, "SKILL.md");
        try {
          sourceContent = await readFile(sourceFile, "utf-8");
          break;
        } catch {
          continue;
        }
      }

      if (!sourceContent) {
        console.warn(`Warning: Could not find skill template for ${skillName}`);
        continue;
      }

      await mkdir(targetDir, { recursive: true });

      // Check if skill already exists
      try {
        await access(targetFile);
        console.log(`  Updating ${skillName} skill`);
      } catch {
        console.log(`  Installing ${skillName} skill`);
      }

      await writeFile(targetFile, sourceContent);
      installed++;
    }

    if (installed > 0) {
      const location = opts.global ? "~/.claude/skills/" : ".claude/skills/";
      console.log(
        `\n✓ Installed ${installed} skill(s) to ${location}`,
      );
      console.log(
        "\nAvailable commands in Claude Code:",
      );
      console.log("  /autogherk <video>           — Generate scenarios or specs from a video");
      console.log("  /build-from-spec <spec-dir>  — Build an app from a spec folder");

      if (!opts.global) {
        console.log(
          "\nTip: Commit .claude/skills/ to your repo so your team gets the skills too.",
        );
      }
    }
  });
