import { describe, it, expect } from "vitest";
import {
  parseLensFlag,
  loadLens,
  loadLenses,
  buildLensPromptSection,
  getLensTags,
  BUILT_IN_LENSES,
} from "../lenses.js";

describe("parseLensFlag", () => {
  it("returns empty array for undefined", () => {
    expect(parseLensFlag(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseLensFlag("")).toEqual([]);
  });

  it("parses single lens name", () => {
    expect(parseLensFlag("designer")).toEqual(["designer"]);
  });

  it("parses comma-separated lens names", () => {
    expect(parseLensFlag("designer,growth")).toEqual(["designer", "growth"]);
  });

  it("trims whitespace and lowercases", () => {
    expect(parseLensFlag(" Designer , GROWTH ")).toEqual(["designer", "growth"]);
  });

  it("filters out empty entries", () => {
    expect(parseLensFlag("designer,,growth")).toEqual(["designer", "growth"]);
  });
});

describe("loadLens", () => {
  it("loads each built-in lens", async () => {
    for (const name of BUILT_IN_LENSES) {
      const lens = await loadLens(name);
      expect(lens.name).toBe(name);
      expect(lens.tag).toBe(`@${name}`);
      expect(lens.isCustom).toBe(false);
      expect(lens.priorities.length).toBeGreaterThan(0);
      expect(lens.persona).toBeTruthy();
      expect(lens.gherkinGuidance).toBeTruthy();
    }
  });

  it("is case-insensitive", async () => {
    const lens = await loadLens("DESIGNER");
    expect(lens.name).toBe("designer");
  });

  it("throws on unknown lens", async () => {
    await expect(loadLens("unknown-lens-name-xyz")).rejects.toThrow(/Unknown lens/);
  });
});

describe("loadLenses", () => {
  it("loads multiple lenses in order", async () => {
    const lenses = await loadLenses(["designer", "growth"]);
    expect(lenses).toHaveLength(2);
    expect(lenses[0].name).toBe("designer");
    expect(lenses[1].name).toBe("growth");
  });

  it("returns empty array for empty input", async () => {
    const lenses = await loadLenses([]);
    expect(lenses).toEqual([]);
  });
});

describe("getLensTags", () => {
  it("returns tags for each lens", async () => {
    const lenses = await loadLenses(["designer", "growth"]);
    expect(getLensTags(lenses)).toEqual(["@designer", "@growth"]);
  });

  it("returns empty array for no lenses", () => {
    expect(getLensTags([])).toEqual([]);
  });
});

describe("buildLensPromptSection", () => {
  it("returns empty string for no lenses", () => {
    expect(buildLensPromptSection([], "gherkin")).toBe("");
  });

  it("includes single lens name in header", async () => {
    const lenses = await loadLenses(["designer"]);
    const section = buildLensPromptSection(lenses, "gherkin");
    expect(section).toContain("## LENS: DESIGNER");
    expect(section).toContain("@designer");
  });

  it("includes all lens names in multi-lens header", async () => {
    const lenses = await loadLenses(["designer", "growth"]);
    const section = buildLensPromptSection(lenses, "gherkin");
    expect(section).toContain("## LENSES: DESIGNER + GROWTH");
  });

  it("uses gherkin guidance for gherkin context", async () => {
    const lenses = await loadLenses(["designer"]);
    const section = buildLensPromptSection(lenses, "gherkin");
    expect(section).toContain(lenses[0].gherkinGuidance);
  });

  it("uses analysis focus for analysis context", async () => {
    const lenses = await loadLenses(["security"]);
    const section = buildLensPromptSection(lenses, "analysis");
    expect(section).toContain(lenses[0].analysisFocus);
  });

  it("uses spec focus for spec context", async () => {
    const lenses = await loadLenses(["growth"]);
    const section = buildLensPromptSection(lenses, "spec");
    expect(section).toContain(lenses[0].specFocus);
  });

  it("instructs to tag scenarios per lens for multi-lens", async () => {
    const lenses = await loadLenses(["designer", "growth"]);
    const section = buildLensPromptSection(lenses, "gherkin");
    expect(section).toContain("@designer");
    expect(section).toContain("@growth");
    expect(section).toMatch(/tag each scenario/i);
  });
});

describe("all 7 canonical lenses", () => {
  it("ships qa, designer, growth, security, support, pm, a11y", () => {
    expect(BUILT_IN_LENSES).toEqual([
      "qa",
      "designer",
      "growth",
      "security",
      "support",
      "pm",
      "a11y",
    ]);
  });

  it("each lens has distinct persona and vocabulary", async () => {
    const lenses = await loadLenses([...BUILT_IN_LENSES]);
    const personas = new Set(lenses.map((l) => l.persona));
    const vocabs = new Set(lenses.map((l) => l.scenarioVocabulary));
    expect(personas.size).toBe(BUILT_IN_LENSES.length);
    expect(vocabs.size).toBe(BUILT_IN_LENSES.length);
  });
});
