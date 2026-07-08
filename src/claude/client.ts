import Anthropic from "@anthropic-ai/sdk";
import type {
  VideoAnalysis,
  GherkinResult,
  BuildSpec,
  Framework,
  ProgressCallback,
} from "../core/types.js";
import { getGherkinPrompt, getBuildSpecPrompt } from "./prompts.js";
import type { Lens } from "../core/lenses.js";
import { withRetry } from "../core/retry.js";
import {
  parseLLMJson,
  assertNotTruncated,
  gherkinResultSchema,
  buildSpecSchema,
} from "../core/llm-json.js";

const MAX_RETRIES = 3;

function classifyClaudeError(error: unknown): Error {
  const status = (error as any)?.status ?? (error as any)?.statusCode;
  if (status === 401 || status === 403) {
    return new Error(
      "Invalid Anthropic API key. Check your ANTHROPIC_API_KEY.",
    );
  }
  if (status === 429) {
    return new Error(
      "Rate limited by Anthropic. The tool will retry automatically.",
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

export interface GenerateGherkinOptions {
  analysis: VideoAnalysis;
  apiKey: string;
  model: string;
  framework: Framework;
  context?: string;
  lenses?: Lens[];
  onProgress?: ProgressCallback;
}

export async function generateGherkin(
  options: GenerateGherkinOptions,
): Promise<GherkinResult> {
  const { analysis, apiKey, model, framework, context, lenses = [], onProgress } = options;
  const client = new Anthropic({ apiKey });

  onProgress?.("claude", "Generating Gherkin scenarios...");

  const systemPrompt = getGherkinPrompt(framework, lenses);
  const contextPrefix = context ? `Application context: ${context}\n\n` : "";
  const userMessage = `${contextPrefix}Here is the structured video analysis:\n\n${JSON.stringify(analysis)}`;

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
          "claude",
          `Retrying Claude generation (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`,
        );
      },
    },
  ).catch((error) => {
    throw classifyClaudeError(error);
  });

  assertNotTruncated(response.stop_reason, "Gherkin generation");

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return parseLLMJson(textBlock.text, gherkinResultSchema, "Gherkin generation") as GherkinResult;
}

export interface GenerateBuildSpecOptions {
  analysis: VideoAnalysis;
  apiKey: string;
  model: string;
  depth?: "deep" | "shallow";
  context?: string;
  lenses?: Lens[];
  onProgress?: ProgressCallback;
}

export async function generateBuildSpec(
  options: GenerateBuildSpecOptions,
): Promise<BuildSpec> {
  const { analysis, apiKey, model, depth = "deep", context, lenses = [], onProgress } = options;
  const client = new Anthropic({ apiKey });

  onProgress?.("claude", "Generating build spec...");

  const systemPrompt = getBuildSpecPrompt(depth, lenses);
  const contextPrefix = context ? `Application context: ${context}\n\n` : "";
  const userMessage = `${contextPrefix}Here is the structured video analysis:\n\n${JSON.stringify(analysis)}`;

  // Use streaming to avoid 10-minute timeout on large spec generation
  const stream = await withRetry(
    () =>
      client.messages.create({
        model,
        max_tokens: 16384,
        messages: [{ role: "user", content: userMessage }],
        system: systemPrompt,
        stream: true,
      }),
    {
      maxRetries: MAX_RETRIES,
      onRetry: (_error, attempt) => {
        onProgress?.(
          "claude",
          `Retrying Claude generation (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`,
        );
      },
    },
  ).catch((error) => {
    throw classifyClaudeError(error);
  });

  let text = "";
  let stopReason: string | null = null;
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      text += event.delta.text;
    }
    if (event.type === "message_delta" && event.delta.stop_reason) {
      stopReason = event.delta.stop_reason;
    }
  }

  if (!text) {
    throw new Error("No text response from Claude");
  }

  assertNotTruncated(stopReason, "Build spec generation");

  return parseLLMJson(text, buildSpecSchema, "Build spec generation") as BuildSpec;
}
