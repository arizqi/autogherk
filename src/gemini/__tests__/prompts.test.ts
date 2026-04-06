import { describe, it, expect } from "vitest";
import { VIDEO_ANALYSIS_PROMPT } from "../prompts.js";

describe("VIDEO_ANALYSIS_PROMPT", () => {
  it("contains JSON structure instructions", () => {
    expect(VIDEO_ANALYSIS_PROMPT).toContain('"screens"');
    expect(VIDEO_ANALYSIS_PROMPT).toContain('"interactions"');
    expect(VIDEO_ANALYSIS_PROMPT).toContain('"transcript"');
    expect(VIDEO_ANALYSIS_PROMPT).toContain('"summary"');
  });

  it("mentions no voiceover / visual-only analysis", () => {
    expect(VIDEO_ANALYSIS_PROMPT).toContain("NO audio or voiceover");
    expect(VIDEO_ANALYSIS_PROMPT).toContain("purely from what you SEE");
  });

  it("lists interaction types", () => {
    expect(VIDEO_ANALYSIS_PROMPT).toContain("click");
    expect(VIDEO_ANALYSIS_PROMPT).toContain("type");
    expect(VIDEO_ANALYSIS_PROMPT).toContain("navigate");
    expect(VIDEO_ANALYSIS_PROMPT).toContain("scroll");
    expect(VIDEO_ANALYSIS_PROMPT).toContain("select");
    expect(VIDEO_ANALYSIS_PROMPT).toContain("hover");
    expect(VIDEO_ANALYSIS_PROMPT).toContain("drag");
  });

  it("asks for screens, interactions, transcript, and summary fields", () => {
    expect(VIDEO_ANALYSIS_PROMPT).toContain('"timestamp"');
    expect(VIDEO_ANALYSIS_PROMPT).toContain('"description"');
    expect(VIDEO_ANALYSIS_PROMPT).toContain('"type"');
    expect(VIDEO_ANALYSIS_PROMPT).toContain('"target"');
    expect(VIDEO_ANALYSIS_PROMPT).toContain('"value"');
    expect(VIDEO_ANALYSIS_PROMPT).toContain('"context"');
    expect(VIDEO_ANALYSIS_PROMPT).toContain('"text"');
  });

  it("instructs to return only JSON", () => {
    expect(VIDEO_ANALYSIS_PROMPT).toContain("Return ONLY the JSON object");
  });
});
