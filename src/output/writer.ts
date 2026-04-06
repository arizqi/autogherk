import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { GherkinResult, Framework, ProgressCallback } from "../core/types.js";
import { formatAllFeatures, formatScenarioBlocks } from "./formatter.js";
import { generateStubs } from "./stubs.js";

export interface WriteResult {
  featureFiles: string[];
  stubFiles: string[];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await import("node:fs/promises").then((fs) => fs.access(path));
    return true;
  } catch {
    return false;
  }
}

function extractAppendContent(existingContent: string, newContent: string): string {
  // Find the new scenario blocks (everything after the Feature header / Background)
  // We use the formatScenarioBlocks helper to get just the scenario text
  // But here we work with the raw formatted content: strip the Feature header and Background
  // and append just the new scenarios to the existing file.

  // Simply append new scenario blocks to the end of the existing file
  const trimmed = existingContent.trimEnd();
  return trimmed + "\n\n" + newContent.trimEnd() + "\n";
}

export async function writeOutput(
  result: GherkinResult,
  outputDir: string,
  framework: Framework,
  generateStubFiles: boolean,
  dryRun: boolean,
  onProgress?: ProgressCallback,
  append?: boolean,
  format?: "gherkin" | "json",
): Promise<WriteResult> {
  const written: WriteResult = { featureFiles: [], stubFiles: [] };

  // JSON output mode
  if (format === "json") {
    const filePath = join(outputDir, "scenarios.json");
    if (dryRun) {
      onProgress?.("output", `[dry-run] Would write ${filePath}`);
    } else {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(result, null, 2) + "\n");
      onProgress?.("output", `Wrote ${filePath}`);
    }
    written.featureFiles.push(filePath);
    return written;
  }

  // Gherkin output mode (default)
  const featureFiles = formatAllFeatures(result);
  const stubFiles = generateStubFiles ? generateStubs(result, framework) : new Map();

  for (const [fileName, content] of featureFiles) {
    const filePath = join(outputDir, fileName);
    if (dryRun) {
      onProgress?.("output", `[dry-run] Would write ${filePath}`);
    } else {
      await mkdir(dirname(filePath), { recursive: true });

      if (append && await fileExists(filePath)) {
        // Append mode: add new scenario blocks to existing file
        const existing = await readFile(filePath, "utf-8");
        const scenarioBlocks = formatScenarioBlocks(result.features.find(
          (f) => fileName === toKebabCase(f.name) + ".feature",
        )!);
        const merged = extractAppendContent(existing, scenarioBlocks);
        await writeFile(filePath, merged);
        onProgress?.("output", `Appended to ${filePath}`);
      } else {
        await writeFile(filePath, content);
        onProgress?.("output", `Wrote ${filePath}`);
      }
    }
    written.featureFiles.push(filePath);
  }

  for (const [fileName, content] of stubFiles) {
    const filePath = join(outputDir, fileName);
    if (dryRun) {
      onProgress?.("output", `[dry-run] Would write ${filePath}`);
    } else {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content);
      onProgress?.("output", `Wrote ${filePath}`);
    }
    written.stubFiles.push(filePath);
  }

  return written;
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
