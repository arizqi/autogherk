import type { GherkinResult, GherkinFeature, GherkinScenario } from "../core/types.js";

export function formatFeatureFile(feature: GherkinFeature): string {
  const lines: string[] = [];

  if (feature.tags.length > 0) {
    lines.push(feature.tags.join(" "));
  }
  lines.push(`Feature: ${feature.name}`);
  if (feature.description) {
    lines.push(`  ${feature.description}`);
  }
  lines.push("");

  if (feature.background) {
    lines.push("  Background:");
    for (const step of feature.background.steps) {
      lines.push(`    ${step.keyword} ${step.text}`);
    }
    lines.push("");
  }

  for (const scenario of feature.scenarios) {
    lines.push(formatScenario(scenario));
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function formatScenario(scenario: GherkinScenario): string {
  const lines: string[] = [];

  if (scenario.tags.length > 0) {
    lines.push(`  ${scenario.tags.join(" ")}`);
  }
  lines.push(`  ${scenario.type}: ${scenario.name}`);

  for (const step of scenario.steps) {
    lines.push(`    ${step.keyword} ${step.text}`);
  }

  if (scenario.examples && scenario.type === "Scenario Outline") {
    lines.push("");
    lines.push("    Examples:");
    const { headers, rows } = scenario.examples;
    lines.push(`      | ${headers.join(" | ")} |`);
    for (const row of rows) {
      lines.push(`      | ${row.join(" | ")} |`);
    }
  }

  return lines.join("\n");
}

export function formatAllFeatures(result: GherkinResult): Map<string, string> {
  const files = new Map<string, string>();
  for (const feature of result.features) {
    const fileName = toKebabCase(feature.name) + ".feature";
    files.set(fileName, formatFeatureFile(feature));
  }
  return files;
}

export function formatScenarioBlocks(feature: GherkinFeature): string {
  const lines: string[] = [];
  for (const scenario of feature.scenarios) {
    lines.push(formatScenario(scenario));
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
