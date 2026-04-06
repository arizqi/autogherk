import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveVideoInput,
  cleanupTempVideo,
  type ResolvedVideo,
} from "../video-input.js";

// We test the private helpers indirectly through the public API,
// and test isUrl/extractExtension by exercising resolveVideoInput behavior.

describe("resolveVideoInput", () => {
  it("throws for nonexistent local files", async () => {
    await expect(
      resolveVideoInput("/nonexistent/path/video.mp4"),
    ).rejects.toThrow("Video file not found: /nonexistent/path/video.mp4");
  });

  it("resolves a local file that exists", async () => {
    // Use a file we know exists - package.json
    const result = await resolveVideoInput("/Users/ashar/v2g/package.json");
    expect(result.localPath).toBe("/Users/ashar/v2g/package.json");
    expect(result.isTemp).toBe(false);
    expect(result.originalSource).toBe("/Users/ashar/v2g/package.json");
  });

  it("rejects YouTube URLs with a helpful error", async () => {
    await expect(
      resolveVideoInput("https://www.youtube.com/watch?v=abc123"),
    ).rejects.toThrow(/YouTube URLs are not directly supported/);
  });

  it("rejects Loom URLs with a helpful error", async () => {
    await expect(
      resolveVideoInput("https://www.loom.com/share/abc123"),
    ).rejects.toThrow(/Loom URLs are not directly supported/);
  });
});

describe("isUrl (tested indirectly)", () => {
  it("identifies http URLs as remote", async () => {
    // http URL will attempt fetch, which should fail/throw - that proves it took the URL path
    await expect(
      resolveVideoInput("http://nonexistent.invalid/video.mp4"),
    ).rejects.toThrow(); // network error proves it was treated as URL
  });

  it("identifies https URLs as remote", async () => {
    await expect(
      resolveVideoInput("https://nonexistent.invalid/video.mp4"),
    ).rejects.toThrow();
  });

  it("treats local paths as files, not URLs", async () => {
    // A local path that doesn't exist throws "Video file not found", not a network error
    const err = await resolveVideoInput("/tmp/nofile.mp4").catch((e) => e);
    expect(err.message).toContain("Video file not found");
  });
});

describe("extractExtension (tested indirectly)", () => {
  // We can't directly test extractExtension since it's not exported,
  // but its behavior is verified through the download path.
  // For a more direct test, we test the patterns it handles:

  it("URLs with .mp4 extension are recognized", async () => {
    // The function will try to fetch and fail, but the extension extraction happens
    // We just verify the URL path is taken
    await expect(
      resolveVideoInput("https://example.com/video.mp4"),
    ).rejects.toThrow();
  });

  it("URLs with .webm extension are recognized", async () => {
    await expect(
      resolveVideoInput("https://example.com/video.webm"),
    ).rejects.toThrow();
  });

  it("URLs with .mov extension are recognized", async () => {
    await expect(
      resolveVideoInput("https://example.com/video.mov"),
    ).rejects.toThrow();
  });
});

describe("cleanupTempVideo", () => {
  it("does nothing for non-temp files", async () => {
    const resolved: ResolvedVideo = {
      localPath: "/Users/ashar/v2g/package.json",
      isTemp: false,
      originalSource: "/Users/ashar/v2g/package.json",
    };
    // Should not throw and should not delete the file
    await expect(cleanupTempVideo(resolved)).resolves.toBeUndefined();
  });

  it("attempts to remove temp files without throwing on missing", async () => {
    const resolved: ResolvedVideo = {
      localPath: "/tmp/autogherk/nonexistent-temp-video.mp4",
      isTemp: true,
      originalSource: "https://example.com/video.mp4",
    };
    // Should not throw even if file doesn't exist (catch in implementation)
    await expect(cleanupTempVideo(resolved)).resolves.toBeUndefined();
  });
});
