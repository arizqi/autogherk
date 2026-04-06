import Anthropic from "@anthropic-ai/sdk";
import type {
  VideoAnalysis,
  GherkinResult,
  Framework,
  ProgressCallback,
} from "../core/types.js";
import { getGherkinPrompt } from "./prompts.js";
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
