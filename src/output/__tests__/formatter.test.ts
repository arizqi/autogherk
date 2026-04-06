import { describe, it, expect } from "vitest";
import { formatFeatureFile, formatAllFeatures } from "../formatter.js";
import type {
  GherkinFeature,
  GherkinResult,
} from "../../core/types.js";

function makeFeature(overrides: Partial<GherkinFeature> = {}): GherkinFeature {
  return {
    name: "User Login",
    tags: ["@login"],
    scenarios: [
      {
        name: "Successful login",
        tags: ["@smoke"],
        type: "Scenario",
        steps: [
          { keyword: "Given", text: "the user is on the login page" },
          { keyword: "When", text: "the user enters valid credentials" },
          { keyword: "Then", text: "the user sees the dashboard" },
        ],
      },
    ],
    ...overrides,
  };
}

describe("formatFeatureFile", () => {
  it("formats a simple feature with one scenario", () => {
    const output = formatFeatureFile(makeFeature());
    expect(output).toContain("@login");
    expect(output).toContain("Feature: User Login");
    expect(output).toContain("  @smoke");
    expect(output).toContain("  Scenario: Successful login");
    expect(output).toContain("    Given the user is on the login page");
    expect(output).toContain("    When the user enters valid credentials");
    expect(output).toContain("    Then the user sees the dashboard");
    expect(output.endsWith("\n")).toBe(true);
  });

  it("formats a feature with Background", () => {
    const feature = makeFeature({
      background: {
        steps: [
          { keyword: "Given", text: "the browser is open" },
          { keyword: "And", text: "the user is logged out" },
        ],
      },
    });
    const output = formatFeatureFile(feature);
    expect(output).toContain("  Background:");
    expect(output).toContain("    Given the browser is open");
    expect(output).toContain("    And the user is logged out");
  });

  it("formats a Scenario Outline with Examples table", () => {
    const feature = makeFeature({
      scenarios: [
        {
          name: "Login with various credentials",
          tags: ["@negative"],
          type: "Scenario Outline",
          steps: [
            { keyword: "When", text: "the user enters <email> and <password>" },
            { keyword: "Then", text: "the user should see <message>" },
          ],
          examples: {
            headers: ["email", "password", "message"],
            rows: [
              ["bad@test.com", "wrong", "Invalid credentials"],
              ["", "pass", "Email required"],
            ],
          },
        },
      ],
    });
    const output = formatFeatureFile(feature);
    expect(output).toContain("  Scenario Outline: Login with various credentials");
    expect(output).toContain("    Examples:");
    expect(output).toContain("      | email | password | message |");
    expect(output).toContain("      | bad@test.com | wrong | Invalid credentials |");
    expect(output).toContain("      |  | pass | Email required |");
  });

  it("formats multiple tags on feature and scenario", () => {
    const feature = makeFeature({
      tags: ["@login", "@regression", "@ui"],
      scenarios: [
        {
          name: "Test",
          tags: ["@smoke", "@critical"],
          type: "Scenario",
          steps: [{ keyword: "Given", text: "something" }],
        },
      ],
    });
    const output = formatFeatureFile(feature);
    expect(output).toContain("@login @regression @ui");
    expect(output).toContain("  @smoke @critical");
  });

  it("formats feature with description", () => {
    const feature = makeFeature({
      description: "As a user I want to log in so that I can access my account",
    });
    const output = formatFeatureFile(feature);
    expect(output).toContain(
      "  As a user I want to log in so that I can access my account",
    );
  });

  it("handles empty tags array", () => {
    const feature = makeFeature({ tags: [] });
    const output = formatFeatureFile(feature);
    // Feature line should be the first non-empty content
    const lines = output.split("\n");
    expect(lines[0]).toBe("Feature: User Login");
  });
});

describe("formatAllFeatures / toKebabCase", () => {
  it("returns correct Map of filename -> content", () => {
    const result: GherkinResult = {
      features: [
        makeFeature({ name: "User Login" }),
        makeFeature({ name: "Shopping Cart Checkout" }),
      ],
    };
    const map = formatAllFeatures(result);
    expect(map.size).toBe(2);
    expect(map.has("user-login.feature")).toBe(true);
    expect(map.has("shopping-cart-checkout.feature")).toBe(true);
    expect(map.get("user-login.feature")).toContain("Feature: User Login");
  });

  it("converts feature names to kebab-case file names", () => {
    const result: GherkinResult = {
      features: [
        makeFeature({ name: "  Multiple   Spaces & Special! Chars  " }),
      ],
    };
    const map = formatAllFeatures(result);
    expect(map.has("multiple-spaces-special-chars.feature")).toBe(true);
  });
});
