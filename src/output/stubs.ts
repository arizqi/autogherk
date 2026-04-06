import type { GherkinResult, GherkinStep, Framework } from "../core/types.js";

export function generateStubs(
  result: GherkinResult,
  framework: Framework,
): Map<string, string> {
  const allSteps = collectUniqueSteps(result);
  const files = new Map<string, string>();

  switch (framework) {
    case "cucumber-js":
      files.set("step_definitions/steps.ts", generateCucumberJsStubs(allSteps));
      break;
    case "cucumber-java":
      files.set("step_definitions/Steps.java", generateCucumberJavaStubs(allSteps));
      break;
    case "behave":
      files.set("steps/steps.py", generateBehaveStubs(allSteps));
      break;
    case "specflow":
      files.set("StepDefinitions/Steps.cs", generateSpecFlowStubs(allSteps));
      break;
  }

  return files;
}

function collectUniqueSteps(result: GherkinResult): GherkinStep[] {
  const seen = new Set<string>();
  const steps: GherkinStep[] = [];

  for (const feature of result.features) {
    if (feature.background) {
      for (const step of feature.background.steps) {
        addStep(step);
      }
    }
    for (const scenario of feature.scenarios) {
      for (const step of scenario.steps) {
        addStep(step);
      }
    }
  }

  function addStep(step: GherkinStep) {
    const key = `${step.keyword}:${step.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      steps.push(step);
    }
  }

  return steps;
}

function stepToRegex(text: string): string {
  return text
    .replace(/<[^>]+>/g, "(.*)")
    .replace(/"/g, '\\"');
}

function stepToMethodName(step: GherkinStep): string {
  return (step.keyword.toLowerCase() + "_" + step.text)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+$/g, "")
    .slice(0, 60);
}

function generateCucumberJsStubs(steps: GherkinStep[]): string {
  const imports = `import { Given, When, Then } from "@cucumber/cucumber";\n\n`;
  const defs = steps.map((step) => {
    const keyword = normalizeKeyword(step.keyword);
    const regex = stepToRegex(step.text);
    return `${keyword}("${regex}", async function () {\n  // TODO: implement\n  throw new Error("Not implemented");\n});`;
  });
  return imports + defs.join("\n\n") + "\n";
}

function generateCucumberJavaStubs(steps: GherkinStep[]): string {
  const imports = `import io.cucumber.java.en.*;\n\npublic class Steps {\n`;
  const defs = steps.map((step) => {
    const keyword = normalizeKeyword(step.keyword);
    const regex = stepToRegex(step.text);
    const method = stepToMethodName(step);
    return `    @${keyword}("${regex}")\n    public void ${method}() {\n        // TODO: implement\n        throw new io.cucumber.java.PendingException();\n    }`;
  });
  return imports + defs.join("\n\n") + "\n}\n";
}

function generateBehaveStubs(steps: GherkinStep[]): string {
  const imports = `from behave import given, when, then\n\n`;
  const defs = steps.map((step) => {
    const keyword = normalizeKeyword(step.keyword).toLowerCase();
    const decorator = keyword === "and" || keyword === "but" ? "then" : keyword;
    const regex = stepToRegex(step.text);
    const method = stepToMethodName(step);
    return `@${decorator}("${regex}")\ndef ${method}(context):\n    # TODO: implement\n    raise NotImplementedError`;
  });
  return imports + defs.join("\n\n") + "\n";
}

function generateSpecFlowStubs(steps: GherkinStep[]): string {
  const header = `using TechTalk.SpecFlow;\n\n[Binding]\npublic class Steps\n{\n`;
  const defs = steps.map((step) => {
    const keyword = normalizeKeyword(step.keyword);
    const regex = stepToRegex(step.text);
    const method = stepToMethodName(step)
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
    return `    [${keyword}("${regex}")]\n    public void ${method}()\n    {\n        // TODO: implement\n        throw new PendingStepException();\n    }`;
  });
  return header + defs.join("\n\n") + "\n}\n";
}

function normalizeKeyword(keyword: string): string {
  if (keyword === "And" || keyword === "But") return "Then";
  return keyword;
}
