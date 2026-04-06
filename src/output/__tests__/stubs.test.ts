import { describe, it, expect } from "vitest";
import { generateStubs } from "../stubs.js";
import type { GherkinResult } from "../../core/types.js";

function makeResult(
  steps: { keyword: "Given" | "When" | "Then" | "And" | "But"; text: string }[],
): GherkinResult {
  return {
    features: [
      {
        name: "Test Feature",
        tags: [],
        scenarios: [
          {
            name: "Test Scenario",
            tags: [],
            type: "Scenario",
            steps,
          },
        ],
      },
    ],
  };
}

describe("generateStubs", () => {
  const basicSteps: GherkinResult = makeResult([
    { keyword: "Given", text: "the user is on the home page" },
    { keyword: "When", text: "the user clicks the login button" },
    { keyword: "Then", text: "the user sees the dashboard" },
  ]);

  describe("cucumber-js", () => {
    it("generates TypeScript stubs with @cucumber/cucumber imports", () => {
      const files = generateStubs(basicSteps, "cucumber-js");
      expect(files.has("step_definitions/steps.ts")).toBe(true);
      const content = files.get("step_definitions/steps.ts")!;
      expect(content).toContain(
        'import { Given, When, Then } from "@cucumber/cucumber";',
      );
      expect(content).toContain('Given("the user is on the home page"');
      expect(content).toContain('When("the user clicks the login button"');
      expect(content).toContain('Then("the user sees the dashboard"');
      expect(content).toContain("async function");
    });
  });

  describe("cucumber-java", () => {
    it("generates Java class with annotations", () => {
      const files = generateStubs(basicSteps, "cucumber-java");
      expect(files.has("step_definitions/Steps.java")).toBe(true);
      const content = files.get("step_definitions/Steps.java")!;
      expect(content).toContain("import io.cucumber.java.en.*;");
      expect(content).toContain("public class Steps {");
      expect(content).toContain('@Given("the user is on the home page")');
      expect(content).toContain('@When("the user clicks the login button")');
      expect(content).toContain("public void ");
      expect(content).toContain("PendingException");
    });
  });

  describe("behave", () => {
    it("generates Python stubs with decorators", () => {
      const files = generateStubs(basicSteps, "behave");
      expect(files.has("steps/steps.py")).toBe(true);
      const content = files.get("steps/steps.py")!;
      expect(content).toContain("from behave import given, when, then");
      expect(content).toContain('@given("the user is on the home page")');
      expect(content).toContain('@when("the user clicks the login button")');
      expect(content).toContain("def ");
      expect(content).toContain("(context)");
      expect(content).toContain("raise NotImplementedError");
    });
  });

  describe("specflow", () => {
    it("generates C# stubs with attributes", () => {
      const files = generateStubs(basicSteps, "specflow");
      expect(files.has("StepDefinitions/Steps.cs")).toBe(true);
      const content = files.get("StepDefinitions/Steps.cs")!;
      expect(content).toContain("using TechTalk.SpecFlow;");
      expect(content).toContain("[Binding]");
      expect(content).toContain('[Given("the user is on the home page")]');
      expect(content).toContain("public void ");
      expect(content).toContain("PendingStepException");
    });
  });

  it("deduplicates identical steps", () => {
    const result = makeResult([
      { keyword: "Given", text: "the user is logged in" },
      { keyword: "Given", text: "the user is logged in" },
      { keyword: "When", text: "something happens" },
    ]);
    const files = generateStubs(result, "cucumber-js");
    const content = files.get("step_definitions/steps.ts")!;
    const matches = content.match(/the user is logged in/g);
    // Should appear exactly once in the definitions (once in the string)
    expect(matches?.length).toBe(1);
  });

  it("handles Scenario Outline parameters by converting angle brackets to regex groups", () => {
    const result: GherkinResult = {
      features: [
        {
          name: "Parameterized",
          tags: [],
          scenarios: [
            {
              name: "Outline test",
              tags: [],
              type: "Scenario Outline",
              steps: [
                {
                  keyword: "When",
                  text: "the user enters <email> and <password>",
                },
              ],
              examples: {
                headers: ["email", "password"],
                rows: [["a@b.com", "pass"]],
              },
            },
          ],
        },
      ],
    };
    const files = generateStubs(result, "cucumber-js");
    const content = files.get("step_definitions/steps.ts")!;
    expect(content).toContain("the user enters (.*) and (.*)");
    expect(content).not.toContain("<email>");
  });

  it("normalizes And/But keywords to Given/When/Then", () => {
    const result = makeResult([
      { keyword: "And", text: "extra precondition" },
      { keyword: "But", text: "an exception" },
    ]);
    const files = generateStubs(result, "cucumber-js");
    const content = files.get("step_definitions/steps.ts")!;
    // And and But should both become Then
    expect(content).toContain('Then("extra precondition"');
    expect(content).toContain('Then("an exception"');
    expect(content).not.toContain("And(");
    expect(content).not.toContain("But(");
  });
});
