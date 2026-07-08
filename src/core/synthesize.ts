import Anthropic from "@anthropic-ai/sdk";
import type {
  ExplorationGraph,
  GherkinFeature,
  ProgressCallback,
} from "./types.js";
import type { Lens } from "./lenses.js";
import { buildLensPromptSection } from "./lenses.js";
import { withRetry } from "./retry.js";
import { parseLLMJson, assertNotTruncated, gherkinResultSchema } from "./llm-json.js";

const MAX_RETRIES = 3;

const SYNTHESIS_SYSTEM_PROMPT = `You are an expert BDD test engineer. You are given:
1. Machine-generated Gherkin features derived mechanically from a web-app exploration graph (literal "I navigate to X" / "I click Y" chains)
2. A summary of the screens that were discovered (titles, URLs)

Your job is to REWRITE these features into high-quality, human-readable Gherkin while staying strictly faithful to what was actually observed:

- Rewrite scenario NAMES to describe user intent ("View newest submissions" not "Hacker News then new")
- Rewrite STEPS in business language from the user's perspective, keeping the same underlying action sequence ("When I open the newest submissions page" not "When I navigate to 'new'")
- MERGE near-duplicate scenarios that differ only in unimportant details
- DROP degenerate scenarios (self-loops, empty actions, pure page-reload chains) — quality over quantity
- GROUP scenarios into features by user goal, renaming features accordingly
- PRESERVE all existing tags on the scenarios you keep (especially @auto-discovered and lens tags); you may add clarifying tags
- NEVER invent flows that are not present in the input — you are rewriting observations, not imagining features

Return ONLY a JSON object with this structure — no markdown, no code blocks:

{
  "features": [
    {
      "name": "Feature name",
      "description": "What user goal this feature covers",
      "tags": ["@auto-discovered"],
      "scenarios": [
        {
          "name": "Scenario name",
          "tags": ["@auto-discovered"],
          "type": "Scenario",
          "steps": [
            { "keyword": "Given", "text": "..." },
            { "keyword": "When", "text": "..." },
            { "keyword": "Then", "text": "..." }
          ]
        }
      ]
    }
  ]
}`;

export interface SynthesizeFlowsOptions {
  features: GherkinFeature[];
  graph: ExplorationGraph;
  apiKey: string;
  model: string;
  lenses?: Lens[];
  context?: string;
  onProgress?: ProgressCallback;
}

/**
 * Phase 3.5 of explore mode: rewrite mechanical graph-path scenarios into
 * semantic, business-language Gherkin using Claude. The graph remains the
 * source of truth — the model only rewrites and prunes, never invents.
 */
export async function synthesizeFlows(
  options: SynthesizeFlowsOptions,
): Promise<GherkinFeature[]> {
  const { features, graph, apiKey, model, lenses = [], context, onProgress } = options;

  if (features.length === 0) return features;

  const client = new Anthropic({ apiKey });

  onProgress?.("synthesize", "Rewriting scenarios with Claude...");

  const screenSummary = Array.from(graph.nodes.values()).map((n) => ({
    title: n.title,
    url: n.url,
  }));

  const lensSection = buildLensPromptSection(lenses, "gherkin");
  const systemPrompt = lensSection
    ? `${SYNTHESIS_SYSTEM_PROMPT}\n\n${lensSection}`
    : SYNTHESIS_SYSTEM_PROMPT;

  const contextPrefix = context ? `Application context: ${context}\n\n` : "";
  const userMessage = `${contextPrefix}Discovered screens:\n${JSON.stringify(screenSummary)}\n\nMachine-generated features to rewrite:\n${JSON.stringify({ features })}`;

  const response = await withRetry(
    () =>
      client.messages.create({
        model,
        max_tokens: 16384,
        messages: [{ role: "user", content: userMessage }],
        system: systemPrompt,
      }),
    {
      maxRetries: MAX_RETRIES,
      onRetry: (_error, attempt) => {
        onProgress?.(
          "synthesize",
          `Retrying synthesis (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`,
        );
      },
    },
  );

  assertNotTruncated(response.stop_reason, "Flow synthesis");

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude during synthesis");
  }

  const result = parseLLMJson(textBlock.text, gherkinResultSchema, "Flow synthesis");
  return result.features as GherkinFeature[];
}
