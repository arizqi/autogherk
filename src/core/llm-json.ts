import { z } from "zod";

/**
 * Shared LLM JSON parsing + validation.
 *
 * Every LLM response in AutoGherk flows through parseLLMJson: strip code
 * fences, JSON.parse, then Zod-validate against the expected shape. On
 * failure the error names the offending fields instead of crashing later
 * with a TypeError deep in a formatter — after the API call was already paid for.
 */

// ---------- Schemas (lenient: passthrough unknown keys, default missing arrays) ----------

const screenCaptureSchema = z
  .object({
    timestamp: z.string().default(""),
    description: z.string().default(""),
  })
  .passthrough();

const uiInteractionSchema = z
  .object({
    timestamp: z.string().default(""),
    type: z.string().default("click"),
    target: z.string().default(""),
    value: z.string().nullish(),
    context: z.string().default(""),
  })
  .passthrough();

export const videoAnalysisSchema = z
  .object({
    screens: z.array(screenCaptureSchema).nullish().transform((v) => v ?? []),
    interactions: z.array(uiInteractionSchema).nullish().transform((v) => v ?? []),
    transcript: z
      .array(z.object({ timestamp: z.string().default(""), text: z.string().default("") }).passthrough())
      .nullish()
      .transform((v) => v ?? undefined),
    summary: z.string().default(""),
  })
  .passthrough();

const gherkinStepSchema = z
  .object({
    keyword: z.enum(["Given", "When", "Then", "And", "But"]),
    text: z.string(),
  })
  .passthrough();

const gherkinScenarioSchema = z
  .object({
    name: z.string(),
    tags: z.array(z.string()).nullish().transform((v) => v ?? []),
    type: z.enum(["Scenario", "Scenario Outline"]).default("Scenario"),
    steps: z.array(gherkinStepSchema).nullish().transform((v) => v ?? []),
    examples: z
      .object({
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string())),
      })
      .nullish()
      .transform((v) => v ?? undefined),
  })
  .passthrough();

export const gherkinResultSchema = z
  .object({
    features: z.array(
      z
        .object({
          name: z.string(),
          description: z.string().nullish().transform((v) => v ?? undefined),
          tags: z.array(z.string()).nullish().transform((v) => v ?? []),
          background: z
            .object({ steps: z.array(gherkinStepSchema) })
            .nullish()
            .transform((v) => v ?? undefined),
          scenarios: z.array(gherkinScenarioSchema).nullish().transform((v) => v ?? []),
        })
        .passthrough(),
    ),
  })
  .passthrough();

// BuildSpec: deep-mode output is intentionally loose (components can be
// arbitrary data examples) — validate the top-level structure and key arrays,
// let leaf shapes pass through.
export const buildSpecSchema = z
  .object({
    appName: z.string().default("Unknown App"),
    summary: z.string().default(""),
    styles: z.record(z.any()).nullish().transform((v) => v ?? {}),
    screens: z.array(
      z
        .object({
          name: z.string(),
          route: z.string().default(""),
          description: z.string().default(""),
          layout: z.string().default(""),
          screenshotTimestamp: z.string().default(""),
          components: z.array(z.any()).nullish().transform((v) => v ?? []),
          interactions: z.array(z.any()).nullish().transform((v) => v ?? []),
          dataRequirements: z.array(z.any()).nullish().transform((v) => v ?? []),
        })
        .passthrough(),
    ),
    dataModel: z.array(z.any()).nullish().transform((v) => v ?? []),
    navigation: z.array(z.any()).nullish().transform((v) => v ?? []),
    globalComponents: z.array(z.any()).nullish().transform((v) => v ?? []),
  })
  .passthrough();

// ---------- Parser ----------

export class LLMOutputError extends Error {
  constructor(
    message: string,
    public readonly rawPreview: string,
  ) {
    super(message);
    this.name = "LLMOutputError";
  }
}

/**
 * Strip markdown fences, parse JSON, validate against schema.
 * Throws LLMOutputError with field-level detail on validation failure.
 */
export function parseLLMJson<S extends z.ZodTypeAny>(
  text: string,
  schema: S,
  label: string,
): z.infer<S> {
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new LLMOutputError(
      `${label}: model returned invalid JSON. This usually means the output was truncated or the model added prose around the JSON. Preview: ${cleaned.slice(0, 200)}...`,
      cleaned.slice(0, 500),
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new LLMOutputError(
      `${label}: model output failed validation:\n${issues}${result.error.issues.length > 5 ? `\n  ...and ${result.error.issues.length - 5} more` : ""}`,
      cleaned.slice(0, 500),
    );
  }

  return result.data;
}

/** Throw a targeted error when the model hit its output-token ceiling. */
export function assertNotTruncated(
  stopReason: string | null | undefined,
  label: string,
): void {
  if (stopReason === "max_tokens" || stopReason === "MAX_TOKENS") {
    throw new LLMOutputError(
      `${label}: output was truncated at the max-token limit. Try fewer/shorter videos, --depth shallow, or splitting the run.`,
      "",
    );
  }
}
