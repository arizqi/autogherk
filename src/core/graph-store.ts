import { readFile, writeFile, appendFile, rename } from "node:fs/promises";
import type {
  ExplorationGraph,
  SerializedGraph,
  ScreenNode,
  ExplorationMetadata,
} from "./types.js";

export function createEmptyGraph(startUrl: string): ExplorationGraph {
  return {
    nodes: new Map(),
    edges: [],
    metadata: {
      startUrl,
      startTime: new Date().toISOString(),
      totalScreens: 0,
      totalEdges: 0,
      totalInteractions: 0,
      exploredInteractions: 0,
      status: "running",
    },
  };
}

function serialize(graph: ExplorationGraph): SerializedGraph {
  const nodes: Record<string, ScreenNode> = {};
  for (const [id, node] of graph.nodes) {
    nodes[id] = node;
  }
  return { nodes, edges: graph.edges, metadata: graph.metadata };
}

function deserialize(data: SerializedGraph): ExplorationGraph {
  const nodes = new Map<string, ScreenNode>();
  for (const [id, node] of Object.entries(data.nodes)) {
    nodes.set(id, node);
  }
  return { nodes, edges: data.edges, metadata: data.metadata };
}

export async function loadGraph(filePath: string): Promise<ExplorationGraph | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return deserialize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveGraph(graph: ExplorationGraph, filePath: string): Promise<void> {
  // Update metadata counts
  graph.metadata.totalScreens = graph.nodes.size;
  graph.metadata.totalEdges = graph.edges.length;
  graph.metadata.totalInteractions = Array.from(graph.nodes.values())
    .reduce((sum, n) => sum + n.interactions.length, 0);
  graph.metadata.exploredInteractions = graph.edges
    .filter((e) => e.status === "traversed" || e.status === "dead-end").length;

  const json = JSON.stringify(serialize(graph), null, 2);
  const tmpPath = filePath + ".tmp";
  await writeFile(tmpPath, json);
  await rename(tmpPath, filePath);
}

export async function appendLog(
  message: string,
  filePath: string,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await appendFile(filePath, `[${timestamp}] ${message}\n`);
}
