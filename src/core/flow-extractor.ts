import type {
  ExplorationGraph,
  Edge,
  ScreenNode,
  GherkinFeature,
  GherkinScenario,
  GherkinStep,
} from "./types.js";

/**
 * Extract Gherkin features from the exploration graph.
 * Each top-level screen becomes a Feature; each path through connected edges becomes a Scenario.
 */
export function extractFlows(graph: ExplorationGraph, maxPathDepth = 6): GherkinFeature[] {
  const clusters = clusterByFeature(graph);
  const features: GherkinFeature[] = [];

  for (const [screenId, edges] of clusters) {
    const screen = graph.nodes.get(screenId);
    if (!screen) continue;

    const scenarios = buildScenarios(screen, edges, graph, maxPathDepth);
    if (scenarios.length === 0) continue;

    features.push({
      name: screen.title || screenNameFromUrl(screen.url),
      description: `Auto-discovered flows from ${screen.url}`,
      tags: ["@auto-discovered", `@screen-${screenId.slice(0, 8)}`],
      scenarios,
    });
  }

  return features;
}

/**
 * Group traversed edges by their source screen to form feature clusters.
 * Each cluster represents one "area" of the app.
 */
function clusterByFeature(graph: ExplorationGraph): Map<string, Edge[]> {
  const clusters = new Map<string, Edge[]>();

  // Find root screens — screens that are entry points or major nav targets
  const rootScreens = findRootScreens(graph);

  for (const rootId of rootScreens) {
    const reachableEdges = collectReachableEdges(rootId, graph);
    if (reachableEdges.length > 0) {
      clusters.set(rootId, reachableEdges);
    }
  }

  // Catch any traversed edges not yet assigned to a cluster
  const assigned = new Set(Array.from(clusters.values()).flatMap((e) => e.map((edge) => edge.id)));
  const unassigned = graph.edges.filter(
    (e) => e.status === "traversed" && !assigned.has(e.id),
  );

  if (unassigned.length > 0) {
    // Group unassigned edges by their source screen
    for (const edge of unassigned) {
      const existing = clusters.get(edge.from);
      if (existing) {
        existing.push(edge);
      } else {
        clusters.set(edge.from, [edge]);
      }
    }
  }

  return clusters;
}

/**
 * Find root screens — screens with no incoming edges, or the start URL screen.
 */
function findRootScreens(graph: ExplorationGraph): string[] {
  const hasIncoming = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.to && edge.status === "traversed") {
      hasIncoming.add(edge.to);
    }
  }

  const roots: string[] = [];
  for (const [id] of graph.nodes) {
    if (!hasIncoming.has(id)) roots.push(id);
  }

  // If all screens have incoming edges (cycles), use the first node
  if (roots.length === 0 && graph.nodes.size > 0) {
    roots.push(graph.nodes.keys().next().value!);
  }

  return roots;
}

/**
 * BFS to collect all edges reachable from a root screen.
 */
function collectReachableEdges(rootId: string, graph: ExplorationGraph): Edge[] {
  const visited = new Set<string>();
  const queue = [rootId];
  const result: Edge[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const edge of graph.edges) {
      if (edge.from === current && edge.status === "traversed") {
        result.push(edge);
        if (edge.to && !visited.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    }
  }

  return result;
}

/**
 * Build scenarios from edges originating at a screen.
 * Each distinct path (edge or chain of edges) becomes one scenario.
 */
function buildScenarios(
  rootScreen: ScreenNode,
  edges: Edge[],
  graph: ExplorationGraph,
  maxPathDepth = 6,
): GherkinScenario[] {
  const scenarios: GherkinScenario[] = [];

  // Build adjacency list from available edges
  const edgesBySource = new Map<string, Edge[]>();
  for (const edge of edges) {
    const list = edgesBySource.get(edge.from) ?? [];
    list.push(edge);
    edgesBySource.set(edge.from, list);
  }

  // Find all paths from root (DFS, capped depth to prevent explosion)
  const paths = findPaths(rootScreen.id, edgesBySource, graph, maxPathDepth);

  for (const path of paths) {
    const scenario = pathToScenario(path, graph);
    if (scenario) scenarios.push(scenario);
  }

  return scenarios;
}

/**
 * DFS to find all paths from a start node, up to maxDepth edges.
 */
const MAX_PATHS_PER_ROOT = 50;

function findPaths(
  startId: string,
  edgesBySource: Map<string, Edge[]>,
  graph: ExplorationGraph,
  maxDepth: number,
): Edge[][] {
  const results: Edge[][] = [];

  function dfs(
    current: string,
    path: Edge[],
    visitedEdges: Set<string>,
    visitedNodes: Set<string>,
  ) {
    if (results.length >= MAX_PATHS_PER_ROOT) return;

    const outgoing = edgesBySource.get(current) ?? [];

    if (outgoing.length === 0 || path.length >= maxDepth) {
      if (path.length > 0) results.push([...path]);
      return;
    }

    for (const edge of outgoing) {
      if (results.length >= MAX_PATHS_PER_ROOT) return;
      if (visitedEdges.has(edge.id)) continue;

      // Self-loops (click that stays on the same screen) become single-step
      // scenarios rather than path segments — avoids infinite churn.
      if (edge.to === edge.from) {
        if (path.length === 0) results.push([edge]);
        continue;
      }

      visitedEdges.add(edge.id);
      path.push(edge);

      // Node-level cycle cut: never revisit a screen within one path
      if (edge.to && !visitedNodes.has(edge.to)) {
        visitedNodes.add(edge.to);
        dfs(edge.to, path, visitedEdges, visitedNodes);
        visitedNodes.delete(edge.to);
      } else {
        results.push([...path]);
      }

      path.pop();
      visitedEdges.delete(edge.id);
    }
  }

  dfs(startId, [], new Set(), new Set([startId]));
  return results;
}

/**
 * Convert a path of edges into a Gherkin scenario.
 */
function pathToScenario(
  path: Edge[],
  graph: ExplorationGraph,
): GherkinScenario | null {
  if (path.length === 0) return null;

  const steps: GherkinStep[] = [];
  const firstScreen = graph.nodes.get(path[0].from);
  if (!firstScreen) return null;

  // Given: starting screen
  steps.push({
    keyword: "Given",
    text: `I am on the "${firstScreen.title || screenNameFromUrl(firstScreen.url)}" screen`,
  });

  // When/And: each interaction in the path
  for (let i = 0; i < path.length; i++) {
    const edge = path[i];
    const keyword: GherkinStep["keyword"] = i === 0 ? "When" : "And";
    const stepText = edge.gherkinStep ?? interactionToStep(edge.interaction);
    steps.push({ keyword, text: stepText });
  }

  // Then: where we ended up
  const lastEdge = path[path.length - 1];
  const destScreen = lastEdge.to ? graph.nodes.get(lastEdge.to) : null;
  if (destScreen) {
    steps.push({
      keyword: "Then",
      text: `I should see the "${destScreen.title || screenNameFromUrl(destScreen.url)}" screen`,
    });
  } else {
    steps.push({
      keyword: "Then",
      text: "the page should update",
    });
  }

  // Build a readable scenario name from the interaction chain
  const actionSummary = path
    .map((e) => e.interaction.elementText || e.interaction.type)
    .filter(Boolean)
    .join(" then ");
  const name = actionSummary.slice(0, 80) || "Navigate through app";

  return {
    name,
    tags: ["@auto-discovered"],
    type: "Scenario",
    steps,
  };
}

function interactionToStep(interaction: { type: string; elementText: string }): string {
  switch (interaction.type) {
    case "click":
      return `I click "${interaction.elementText}"`;
    case "navigate":
      return `I navigate to "${interaction.elementText}"`;
    case "fill":
      return `I fill in the "${interaction.elementText}" field`;
    case "submit":
      return `I submit the form`;
    case "select":
      return `I select from "${interaction.elementText}"`;
    default:
      return `I interact with "${interaction.elementText}"`;
  }
}

function screenNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    if (path === "/" || path === "") return "Home";
    return path
      .split("/")
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" > ");
  } catch {
    return "Unknown Screen";
  }
}

/**
 * Identify which screens/interactions in the graph haven't been covered
 * by the current set of features. Returns screen IDs with unexplored edges.
 */
export function identifyCoverageGaps(graph: ExplorationGraph): {
  unexploredEdges: Edge[];
  screensMissingCoverage: string[];
} {
  const unexploredEdges = graph.edges.filter((e) => e.status === "unexplored");
  const screensWithUnexplored = new Set(unexploredEdges.map((e) => e.from));

  return {
    unexploredEdges,
    screensMissingCoverage: Array.from(screensWithUnexplored),
  };
}
