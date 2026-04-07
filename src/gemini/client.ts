import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { VideoAnalysis, BuildSpec, ProgressCallback } from "../core/types.js";
import { VIDEO_ANALYSIS_PROMPT } from "./prompts.js";
import { getBuildSpecPrompt } from "../claude/prompts.js";

export type SpecDepth = "deep" | "shallow";
import { withRetry } from "../core/retry.js";

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 120; // 10 minutes max
const MAX_RETRIES = 3;
const VIDEO_DURATION_WARNING_SECONDS = 300; // 5 minutes

function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split(".").pop();
  const mimeTypes: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
  };
  return mimeTypes[ext ?? ""] ?? "video/mp4";
}

function classifyGeminiError(error: unknown): Error {
  const status = (error as any)?.status ?? (error as any)?.statusCode;
  if (status === 401 || status === 403) {
    return new Error(
      "Invalid Gemini API key. Check your GEMINI_API_KEY.",
    );
  }
  if (status === 429) {
    return new Error(
      "Rate limited by Gemini. The tool will retry automatically.",
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

async function uploadAndWaitForVideo(
  ai: InstanceType<typeof GoogleGenAI>,
  videoPath: string,
  onProgress?: ProgressCallback,
): Promise<{ uri: string; mimeType: string; fileName: string }> {
  onProgress?.("gemini", `Uploading ${basename(videoPath)}...`);

  const uploadResult = await withRetry(
    () =>
      ai.files.upload({
        file: new Blob([readFileSync(videoPath)], {
          type: getMimeType(videoPath),
        }),
        config: {
          displayName: basename(videoPath),
          mimeType: getMimeType(videoPath),
        },
      }),
    {
      maxRetries: MAX_RETRIES,
      onRetry: (error, attempt) => {
        onProgress?.(
          "gemini",
          `Retrying Gemini upload (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`,
        );
      },
    },
  ).catch((error) => {
    throw classifyGeminiError(error);
  });

  const fileName = uploadResult.name!;
  onProgress?.("gemini", "Waiting for video processing...");

  let file = uploadResult;
  let attempts = 0;
  while (file.state === "PROCESSING" && attempts < MAX_POLL_ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    file = await ai.files.get({ name: fileName });
    attempts++;
  }

  if (file.state === "FAILED") {
    throw new Error("Gemini video processing failed");
  }
  if (file.state !== "ACTIVE") {
    throw new Error(
      `Video processing timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s (state: ${file.state})`,
    );
  }

  // Video duration warning
  const videoDuration = (file as any).videoMetadata?.videoDuration;
  if (videoDuration) {
    const durationStr = String(videoDuration);
    const seconds = parseFloat(durationStr.replace("s", ""));
    if (!isNaN(seconds) && seconds > VIDEO_DURATION_WARNING_SECONDS) {
      console.warn(
        `Warning: Long video detected (${formatDuration(seconds)}). Processing may take longer and cost more.`,
      );
    }
  }

  return { uri: file.uri!, mimeType: file.mimeType!, fileName };
}

export async function analyzeVideo(
  videoPath: string,
  apiKey: string,
  model: string,
  onProgress?: ProgressCallback,
): Promise<VideoAnalysis> {
  const ai = new GoogleGenAI({ apiKey });
  const uploaded = await uploadAndWaitForVideo(ai, videoPath, onProgress);

  onProgress?.("gemini", "Analyzing video content...");

  const response = await withRetry(
    () =>
      ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType } },
              { text: VIDEO_ANALYSIS_PROMPT },
            ],
          },
        ],
        config: {
          maxOutputTokens: 65536,
          responseMimeType: "application/json",
        },
      }),
    {
      maxRetries: MAX_RETRIES,
      onRetry: (error, attempt) => {
        onProgress?.(
          "gemini",
          `Retrying Gemini analysis (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`,
        );
      },
    },
  ).catch((error) => {
    throw classifyGeminiError(error);
  });

  const text = response.text ?? "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let analysis: VideoAnalysis;
  try {
    analysis = JSON.parse(cleaned);
  } catch {
    throw new Error(
      "Failed to parse Gemini response as JSON. Use --verbose to see the raw output.",
    );
  }

  await ai.files.delete({ name: uploaded.fileName }).catch(() => {});

  return analysis;
}

export async function generateBuildSpecFromVideo(
  videoPath: string,
  apiKey: string,
  model: string,
  onProgress?: ProgressCallback,
  context?: string,
  depth: SpecDepth = "deep",
): Promise<BuildSpec> {
  const ai = new GoogleGenAI({ apiKey });
  const uploaded = await uploadAndWaitForVideo(ai, videoPath, onProgress);

  onProgress?.("gemini", `Generating ${depth} build spec from video...`);

  const contextPrefix = context ? `Application context: ${context}\n\n` : "";
  const prompt = getBuildSpecPrompt(depth);
  const userPrompt = `${contextPrefix}${prompt}\n\nAnalyze the video above and generate the build specification.`;

  const response = await withRetry(
    () =>
      ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType } },
              { text: userPrompt },
            ],
          },
        ],
        config: {
          maxOutputTokens: 65536,
          responseMimeType: "application/json",
        },
      }),
    {
      maxRetries: MAX_RETRIES,
      onRetry: (error, attempt) => {
        onProgress?.(
          "gemini",
          `Retrying Gemini spec generation (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`,
        );
      },
    },
  ).catch((error) => {
    throw classifyGeminiError(error);
  });

  const text = response.text ?? "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let result: BuildSpec;
  try {
    result = JSON.parse(cleaned);
  } catch {
    const preview = cleaned.slice(0, 300);
    throw new Error(
      `Failed to parse Gemini build spec JSON. Preview: ${preview}...`,
    );
  }

  if (!result.screens || !Array.isArray(result.screens)) {
    throw new Error("Gemini response missing 'screens' array");
  }

  await ai.files.delete({ name: uploaded.fileName }).catch(() => {});

  return result;
}
