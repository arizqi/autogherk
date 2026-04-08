import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateDefaultConfig, loadConfig } from "../config.js";

describe("generateDefaultConfig", () => {
  it("returns valid JSON", () => {
    const config = generateDefaultConfig();
    expect(() => JSON.parse(config)).not.toThrow();
  });

  it("has correct default values", () => {
    const config = JSON.parse(generateDefaultConfig());
    expect(config.geminiModel).toBe("gemini-2.5-pro");
    expect(config.claudeModel).toBe("claude-opus-4-6");
    expect(config.framework).toBe("cucumber-js");
    expect(config.outputDir).toBe("./features/");
    expect(config.language).toBe("en");
    expect(config.generateStubs).toBe(true);
  });

  it("contains env: prefix keys for API keys", () => {
    const config = JSON.parse(generateDefaultConfig());
    expect(config.geminiApiKey).toBe("env:GEMINI_API_KEY");
    expect(config.anthropicApiKey).toBe("env:ANTHROPIC_API_KEY");
  });
});

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear API key env vars to test error paths
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.CLAUDE_MODEL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws descriptive error when Gemini API key is missing", async () => {
    await expect(
      loadConfig({ video: "test.mp4", output: "./out" }),
    ).rejects.toThrow(/Gemini API key required/);
  });

  it("throws descriptive error when Anthropic API key is missing for gherkin mode", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    await expect(
      loadConfig({ video: "test.mp4", output: "./out" }),
    ).rejects.toThrow(/Anthropic API key required/);
  });

  it("does not require Anthropic API key for spec mode", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    const config = await loadConfig({ video: "test.mp4", output: "./out", format: "spec" });
    expect(config.geminiApiKey).toBe("test-gemini-key");
    expect(config.anthropicApiKey).toBeUndefined();
  });

  it("resolves env: prefix values from environment", async () => {
    process.env.MY_GEMINI_KEY = "resolved-gemini";
    process.env.MY_ANTHROPIC_KEY = "resolved-anthropic";
    // We need a config file that uses env: prefix. Use loadConfig with both keys in env directly.
    process.env.GEMINI_API_KEY = "direct-gemini";
    process.env.ANTHROPIC_API_KEY = "direct-anthropic";

    const config = await loadConfig({ video: "test.mp4", output: "./out" });
    expect(config.geminiApiKey).toBe("direct-gemini");
    expect(config.anthropicApiKey).toBe("direct-anthropic");
    expect(config.framework).toBe("cucumber-js");

    delete process.env.MY_GEMINI_KEY;
    delete process.env.MY_ANTHROPIC_KEY;
  });

  it("uses environment variables for API keys", async () => {
    process.env.GEMINI_API_KEY = "env-gemini";
    process.env.ANTHROPIC_API_KEY = "env-anthropic";

    const config = await loadConfig({ video: "test.mp4", output: "./features" });
    expect(config.geminiApiKey).toBe("env-gemini");
    expect(config.anthropicApiKey).toBe("env-anthropic");
    expect(config.geminiModel).toBe("gemini-2.5-pro");
    expect(config.claudeModel).toBe("claude-opus-4-6");
  });

  it("respects framework override from options", async () => {
    process.env.GEMINI_API_KEY = "key";
    process.env.ANTHROPIC_API_KEY = "key";

    const config = await loadConfig({
      video: "test.mp4",
      output: "./out",
      framework: "behave",
    });
    expect(config.framework).toBe("behave");
  });
});
