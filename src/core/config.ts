import { cosmiconfig } from "cosmiconfig";
import { z } from "zod";
import type { AppConfig, Framework, GenerateOptions } from "./types.js";

const configSchema = z.object({
  geminiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  geminiModel: z.string().default("gemini-2.5-pro"),
  claudeModel: z.string().default("claude-opus-4-6"),
  framework: z
    .enum(["cucumber-js", "cucumber-java", "behave", "specflow"])
    .default("cucumber-js"),
  outputDir: z.string().default("./features/"),
  language: z.string().default("en"),
  generateStubs: z.boolean().default(true),
});

function resolveEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("env:")) {
    return process.env[value.slice(4)];
  }
  return value;
}

export async function loadConfig(
  options: GenerateOptions,
): Promise<AppConfig> {
  const explorer = cosmiconfig("autogherk");
  if (options.config && !options.config.endsWith(".json")) {
    throw new Error(
      "Only .json config files are supported for security. Use .autogherkrc.json.",
    );
  }
  const result = options.config
    ? await explorer.load(options.config)
    : await explorer.search();

  const fileConfig = result?.config ?? {};
  const parsed = configSchema.parse(fileConfig);

  const geminiApiKey =
    resolveEnvValue(parsed.geminiApiKey) ?? process.env.GEMINI_API_KEY;
  const anthropicApiKey =
    resolveEnvValue(parsed.anthropicApiKey) ?? process.env.ANTHROPIC_API_KEY;

  if (!geminiApiKey) {
    throw new Error(
      "Gemini API key required. Set GEMINI_API_KEY env var or add geminiApiKey to .autogherkrc.json",
    );
  }
  if (!anthropicApiKey && options.format !== "spec") {
    throw new Error(
      "Anthropic API key required. Set ANTHROPIC_API_KEY env var or add anthropicApiKey to .autogherkrc.json",
    );
  }

  return {
    geminiApiKey,
    anthropicApiKey,
    geminiModel: process.env.GEMINI_MODEL ?? parsed.geminiModel,
    claudeModel: process.env.CLAUDE_MODEL ?? parsed.claudeModel,
    framework: (options.framework ?? parsed.framework) as Framework,
    outputDir: options.output ?? parsed.outputDir,
    language: parsed.language,
    generateStubs: parsed.generateStubs,
  };
}

export function generateDefaultConfig(): string {
  return JSON.stringify(
    {
      geminiApiKey: "env:GEMINI_API_KEY",
      anthropicApiKey: "env:ANTHROPIC_API_KEY",
      geminiModel: "gemini-2.5-pro",
      claudeModel: "claude-opus-4-6",
      framework: "cucumber-js",
      outputDir: "./features/",
      language: "en",
      generateStubs: true,
    },
    null,
    2,
  );
}
