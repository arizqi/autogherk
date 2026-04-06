import { describe, it, expect } from "vitest";
import { getGherkinPrompt } from "../prompts.js";
import type { Framework } from "../../core/types.js";

describe("getGherkinPrompt", () => {
  it("returns different content per framework", () => {
    const cucumberJs = getGherkinPrompt("cucumber-js");
    const behave = getGherkinPrompt("behave");
    const java = getGherkinPrompt("cucumber-java");
    const specflow = getGherkinPrompt("specflow");

    expect(cucumberJs).not.toBe(behave);
    expect(cucumberJs).not.toBe(java);
    expect(cucumberJs).not.toBe(specflow);
  });

  it("includes framework-specific notes", () => {
    expect(getGherkinPrompt("cucumber-js")).toContain("Cucumber.js");
    expect(getGherkinPrompt("cucumber-js")).toContain("@cucumber/cucumber");
    expect(getGherkinPrompt("cucumber-java")).toContain("io.cucumber");
    expect(getGherkinPrompt("behave")).toContain("Python Behave");
    expect(getGherkinPrompt("specflow")).toContain("SpecFlow");
  });

  it("contains Given/When/Then instructions", () => {
    const prompt = getGherkinPrompt("cucumber-js");
    expect(prompt).toContain("Given");
    expect(prompt).toContain("When");
    expect(prompt).toContain("Then");
    expect(prompt).toContain("Given: Preconditions");
    expect(prompt).toContain("When: User actions");
    expect(prompt).toContain("Then: Expected outcomes");
  });

  it("mentions Scenario Outline and Examples", () => {
    const prompt = getGherkinPrompt("cucumber-js");
    expect(prompt).toContain("Scenario Outline");
    expect(prompt).toContain("examples");
  });

  it("instructs to return JSON structure", () => {
    const prompt = getGherkinPrompt("cucumber-js");
    expect(prompt).toContain('"features"');
    expect(prompt).toContain('"scenarios"');
    expect(prompt).toContain('"steps"');
  });

  it("mentions the target framework in the prompt body", () => {
    const frameworks: Framework[] = [
      "cucumber-js",
      "cucumber-java",
      "behave",
      "specflow",
    ];
    for (const fw of frameworks) {
      expect(getGherkinPrompt(fw)).toContain(`Framework target: ${fw}`);
    }
  });
});
