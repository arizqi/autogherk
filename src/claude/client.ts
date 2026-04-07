import Anthropic from "@anthropic-ai/sdk";
import type {
  VideoAnalysis,
  GherkinResult,
  BuildSpec,
  Framework,
  ProgressCallback,
} from "../core/types.js";
import { getGherkinPrompt, getBuildSpecPrompt } from "./prompts.js";
import { withRetry } from "../core/retry.js";

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

export async function generateGherkin(
  analysis: VideoAnalysis,
  apiKey: string,
  model: string,
  framework: Framework,
  onProgress?: ProgressCallback,
  context?: string,
): Promise<GherkinResult> {
  const client = new Anthropic({ apiKey });

  onProgress?.("claude", "Generating Gherkin scenarios...");

  const systemPrompt = getGherkinPrompt(framework);
  const contextPrefix = context ? `Application context: ${context}\n\n` : "";
  const userMessage = `${contextPrefix}Here is the structured video analysis:\n\n${JSON.stringify(analysis, null, 2)}`;

  const response = await withRetry(
    () =>
      client.messages.create({
        model,
        max_tokens: 8192,
        messages: [{ role: "user", content: userMessage }],
        system: systemPrompt,
      }),
    {
      maxRetries: MAX_RETRIES,
      onRetry: (error, attempt) => {
        onProgress?.(
          "claude",
          `Retrying Claude generation (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`,
        );
      },
    },
  ).catch((error) => {
    throw classifyClaudeError(error);
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const text = textBlock.text;
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let result: GherkinResult;
  try {
    result = JSON.parse(cleaned);
  } catch {
    throw new Error(
      "Failed to parse Claude response as JSON. Use --verbose to see the raw output.",
    );
  }

  if (!result.features || !Array.isArray(result.features)) {
    throw new Error("Claude response missing 'features' array");
  }

  return result;
}

export async function generateBuildSpec(
  analysis: VideoAnalysis,
  apiKey: string,
  model: string,
  onProgress?: ProgressCallback,
  context?: string,
): Promise<BuildSpec> {
  const client = new Anthropic({ apiKey });

  onProgress?.("claude", "Generating build spec...");

  const systemPrompt = getBuildSpecPrompt();
  const contextPrefix = context ? `Application context: ${context}\n\n` : "";
  const userMessage = `${contextPrefix}Here is the structured video analysis:\n\n${JSON.stringify(analysis, null, 2)}`;

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
      onRetry: (error, attempt) => {
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
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      text += event.delta.text;
    }
  }

  if (!text) {
    throw new Error("No text response from Claude");
  }

  return parseBuildSpecResponse(text);
}

function parseBuildSpecResponse(text: string): BuildSpec {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let result: BuildSpec;
  try {
    result = JSON.parse(cleaned);
  } catch {
    // Log first 200 chars to help debug
    const preview = cleaned.slice(0, 200);
    throw new Error(
      `Failed to parse build spec JSON. Preview: ${preview}...`,
    );
  }

  if (!result.screens || !Array.isArray(result.screens)) {
    throw new Error("Claude response missing 'screens' array");
  }

  return result;
}
