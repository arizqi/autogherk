import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExplorationGraph, ScreenNode, GherkinFeature, ProgressCallback } from "../core/types.js";
import { formatFeatureFile } from "./formatter.js";
import { saveGraph } from "../core/graph-store.js";

export interface ExploreWriteResult {
  featureFiles: string[];
  graphFile: string;
  reportFiles: string[];
}

export async function writeExploreOutput(
  graph: ExplorationGraph,
  features: GherkinFeature[],
  outputDir: string,
  dryRun: boolean,
  onProgress?: ProgressCallback,
): Promise<ExploreWriteResult> {
  const result: ExploreWriteResult = {
    featureFiles: [],
    graphFile: "",
    reportFiles: [],
  };

  if (dryRun) {
    for (const feature of features) {
      const content = formatFeatureFile(feature);
      console.log(content);
    }
    return result;
  }

  // Create output directories
  const featuresDir = join(outputDir, "features");
  const reportDir = join(outputDir, "exploration-report");
  await mkdir(featuresDir, { recursive: true });
  await mkdir(reportDir, { recursive: true });

  // Write feature files
  for (const feature of features) {
    const fileName = toKebabCase(feature.name) + ".feature";
    const filePath = join(featuresDir, fileName);
    await writeFile(filePath, formatFeatureFile(feature));
    result.featureFiles.push(filePath);
    onProgress?.("write", `Wrote ${fileName}`);
  }

  // Write graph
  const graphPath = join(outputDir, "exploration-graph.json");
  await saveGraph(graph, graphPath);
  result.graphFile = graphPath;

  // Write navigation map (simplified for visualization)
  const navMapPath = join(reportDir, "navigation-map.json");
  await writeFile(navMapPath, JSON.stringify(generateNavigationMap(graph), null, 2));
  result.reportFiles.push(navMapPath);

  // Write coverage report
  const coveragePath = join(reportDir, "coverage-report.md");
  await writeFile(coveragePath, generateCoverageReport(graph));
  result.reportFiles.push(coveragePath);

  return result;
}

function generateNavigationMap(graph: ExplorationGraph): object {
  const nodes = Array.from(graph.nodes.values()).map((n) => ({
    id: n.id,
    label: n.title || n.url,
    url: n.url,
    urlPattern: n.urlPattern,
    interactionCount: n.interactions.length,
  }));

  const edges = graph.edges
    .filter((e) => e.to && e.status === "traversed")
    .map((e) => ({
      from: e.from,
      to: e.to,
      label: e.interaction.elementText || e.interaction.type,
      type: e.interaction.type,
    }));

  return { nodes, edges };
}

function generateCoverageReport(graph: ExplorationGraph): string {
  const meta = graph.metadata;
  const traversed = graph.edges.filter((e) => e.status === "traversed").length;
  const unexplored = graph.edges.filter((e) => e.status === "unexplored").length;
  const deadEnds = graph.edges.filter((e) => e.status === "dead-end").length;
  const skipped = graph.edges.filter((e) => e.status === "destructive-skipped").length;
  const totalEdges = graph.edges.length;
  const coveragePct = totalEdges > 0 ? Math.round((traversed / totalEdges) * 100) : 0;

  const lines: string[] = [
    "# Exploration Coverage Report",
    "",
    `**Start URL:** ${meta.startUrl}`,
    `**Started:** ${meta.startTime}`,
    `**Ended:** ${meta.endTime ?? "N/A"}`,
    `**Status:** ${meta.status}`,
    "",
    "## Summary",
    "",
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Screens discovered | ${meta.totalScreens} |`,
    `| Total interactions found | ${meta.totalInteractions} |`,
    `| Edges traversed | ${traversed} |`,
    `| Edges unexplored | ${unexplored} |`,
    `| Dead ends | ${deadEnds} |`,
    `| Destructive (skipped) | ${skipped} |`,
    `| **Coverage** | **${coveragePct}%** |`,
    "",
    "## Screens",
    "",
  ];

  for (const screen of graph.nodes.values()) {
    const exploredCount = graph.edges.filter(
      (e) => e.from === screen.id && e.status === "traversed",
    ).length;
    const totalCount = graph.edges.filter((e) => e.from === screen.id).length;
    lines.push(`### ${screen.title || screen.url}`);
    lines.push(`- **URL:** ${screen.url}`);
    lines.push(`- **Interactions:** ${screen.interactions.length} found, ${exploredCount}/${totalCount} edges explored`);
    lines.push(`- **Visits:** ${screen.visitCount}`);
    lines.push("");
  }

  if (skipped > 0) {
    lines.push("## Skipped (Destructive)");
    lines.push("");
    for (const edge of graph.edges.filter((e) => e.status === "destructive-skipped")) {
      const screen = graph.nodes.get(edge.from);
      lines.push(`- **${screen?.title ?? edge.from}:** "${edge.interaction.elementText}" (${edge.interaction.type})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
