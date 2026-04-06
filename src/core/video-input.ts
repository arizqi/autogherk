import { createWriteStream } from "node:fs";
import { access, mkdir, readdir, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";

export interface ResolvedVideo {
  localPath: string;
  isTemp: boolean;
  originalSource: string;
}

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);
const VIDEO_MIME_PREFIXES = ["video/", "application/octet-stream"];
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const DOWNLOAD_TIMEOUT_MS = 120_000; // 2 minutes

function isUrl(input: string): boolean {
  return input.startsWith("http://") || input.startsWith("https://");
}

function isYouTubeUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return (
      url.hostname === "youtube.com" ||
      url.hostname === "www.youtube.com" ||
      url.hostname === "m.youtube.com" ||
      url.hostname === "youtu.be"
    );
  } catch {
    return false;
  }
}

function isLoomUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return (
      url.hostname === "loom.com" ||
      url.hostname === "www.loom.com"
    );
  } catch {
    return false;
  }
}

function isPrivateIp(ip: string): boolean {
  // IPv4 private/reserved ranges
  if (
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") || ip.startsWith("172.17.") || ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") || ip.startsWith("172.20.") || ip.startsWith("172.21.") ||
    ip.startsWith("172.22.") || ip.startsWith("172.23.") || ip.startsWith("172.24.") ||
    ip.startsWith("172.25.") || ip.startsWith("172.26.") || ip.startsWith("172.27.") ||
    ip.startsWith("172.28.") || ip.startsWith("172.29.") || ip.startsWith("172.30.") ||
    ip.startsWith("172.31.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("127.") ||
    ip === "0.0.0.0" ||
    ip.startsWith("169.254.") || // Link-local / cloud metadata
    ip.startsWith("::1") ||
    ip.startsWith("fc") || ip.startsWith("fd") || // IPv6 ULA
    ip.startsWith("fe80") // IPv6 link-local
  ) {
    return true;
  }
  return false;
}

function extractExtension(url: string): string {
  const pathname = new URL(url).pathname;
  const ext = extname(pathname);
  return ext || ".mp4";
}

export async function resolveVideoInput(input: string): Promise<ResolvedVideo> {
  if (!isUrl(input)) {
    // Verify local file exists before proceeding
    try {
      await access(input);
    } catch {
      throw new Error(
        `Video file not found: ${input}. Check the file path and try again.`,
      );
    }
    return { localPath: input, isTemp: false, originalSource: input };
  }

  // Require HTTPS for remote URLs
  const parsedUrl = new URL(input);
  if (parsedUrl.protocol !== "https:") {
    throw new Error(
      "Only HTTPS URLs are supported for security. Please provide an https:// URL.",
    );
  }

  // Check for unsupported streaming platform URLs
  if (isYouTubeUrl(input)) {
    throw new Error(
      "YouTube URLs are not directly supported yet. Please download the video first and provide the local file path. Tip: Use yt-dlp to download YouTube videos.",
    );
  }

  if (isLoomUrl(input)) {
    throw new Error(
      "Loom URLs are not directly supported yet. Please download the video first and provide the local file path. Tip: Use the Loom download button or a browser extension to save the video.",
    );
  }

  // SSRF protection: resolve hostname and check for private IPs
  try {
    const { address } = await lookup(parsedUrl.hostname);
    if (isPrivateIp(address)) {
      throw new Error(
        "URL resolves to a private/internal IP address. Only public URLs are allowed.",
      );
    }
  } catch (err: any) {
    if (err.message?.includes("private") || err.message?.includes("internal")) {
      throw err;
    }
    // DNS lookup failure
    throw new Error(
      `Failed to resolve hostname ${parsedUrl.hostname}. Check the URL and try again.`,
    );
  }

  const tempDir = join(tmpdir(), "autogherk");
  await mkdir(tempDir, { recursive: true });

  const ext = extractExtension(input);
  const tempPath = join(tempDir, `video-${randomUUID()}${ext}`);

  let response: Response;
  try {
    response = await fetch(input, {
      redirect: "follow",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to download video from ${input}: ${msg}. Check the URL and your network connection.`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Failed to download video from ${input}: ${response.status} ${response.statusText}. Check the URL and your network connection.`,
    );
  }
  if (!response.body) {
    throw new Error(`No response body from ${input}`);
  }

  // Validate content type
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !VIDEO_MIME_PREFIXES.some((p) => contentType.startsWith(p))) {
    throw new Error(
      `Expected video content, got ${contentType}. Check that the URL points to a video file.`,
    );
  }

  // Check content length if available
  const contentLength = parseInt(response.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_VIDEO_SIZE) {
    throw new Error(
      `Video file too large (${Math.round(contentLength / 1024 / 1024)}MB). Maximum supported size is ${MAX_VIDEO_SIZE / 1024 / 1024}MB.`,
    );
  }

  const fileStream = createWriteStream(tempPath);
  try {
    await pipeline(Readable.fromWeb(response.body as any), fileStream);
  } catch (err) {
    await unlink(tempPath).catch(() => {});
    throw err;
  }

  return { localPath: tempPath, isTemp: true, originalSource: input };
}

/**
 * Resolve one or more video inputs. Handles:
 * - Single file path or URL
 * - Array of file paths / URLs
 * - Directory path (globs for *.mp4, *.webm, *.mov)
 * - Comma-separated list of paths/URLs
 */
export async function resolveVideoInputs(
  input: string | string[],
): Promise<ResolvedVideo[]> {
  // Normalise to a flat array of individual inputs
  const rawInputs: string[] = [];

  if (Array.isArray(input)) {
    for (const item of input) {
      rawInputs.push(...item.split(",").map((s) => s.trim()).filter(Boolean));
    }
  } else {
    rawInputs.push(...input.split(",").map((s) => s.trim()).filter(Boolean));
  }

  const resolved: ResolvedVideo[] = [];

  for (const raw of rawInputs) {
    // Check if it's a directory
    if (!isUrl(raw)) {
      try {
        const info = await stat(raw);
        if (info.isDirectory()) {
          const entries = await readdir(raw);
          const videoFiles = entries
            .filter((f) => VIDEO_EXTENSIONS.has(extname(f).toLowerCase()))
            .sort();

          if (videoFiles.length === 0) {
            throw new Error(
              `No video files (*.mp4, *.webm, *.mov) found in directory: ${raw}`,
            );
          }

          for (const file of videoFiles) {
            resolved.push({
              localPath: join(raw, file),
              isTemp: false,
              originalSource: join(raw, file),
            });
          }
          continue;
        }
      } catch (err: any) {
        // Re-throw our own errors; let others fall through to resolveVideoInput
        if (err.message?.startsWith("No video files")) {
          throw err;
        }
      }
    }

    // Single file or URL
    resolved.push(await resolveVideoInput(raw));
  }

  if (resolved.length === 0) {
    throw new Error(
      "No video inputs resolved. Please provide at least one video file, URL, or directory.",
    );
  }

  return resolved;
}

export async function cleanupTempVideo(
  resolved: ResolvedVideo,
): Promise<void> {
  if (resolved.isTemp) {
    await unlink(resolved.localPath).catch(() => {});
  }
}

export async function cleanupAllTempVideos(
  resolved: ResolvedVideo[],
): Promise<void> {
  await Promise.all(resolved.map((r) => cleanupTempVideo(r)));
}
