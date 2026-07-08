// Public API for programmatic use
// import { generate, analyzeVideo, generateGherkin } from 'autogherk';

export { analyzeVideo, generateBuildSpecFromVideo } from './gemini/client.js';
export type {
  AnalyzeVideoOptions,
  GenerateBuildSpecFromVideoOptions,
} from './gemini/client.js';
export { generateGherkin, generateBuildSpec } from './claude/client.js';
export type {
  GenerateGherkinOptions,
  GenerateBuildSpecOptions,
} from './claude/client.js';
export { formatFeatureFile, formatAllFeatures } from './output/formatter.js';
export { generateStubs } from './output/stubs.js';
export { writeOutput, writeSpecOutput } from './output/writer.js';
export { formatBuildSpec, formatSpecAsScreenFiles } from './output/spec-formatter.js';
export { resolveVideoInput, cleanupTempVideo } from './core/video-input.js';
export { loadConfig, generateDefaultConfig } from './core/config.js';
export { generate } from './core/generate.js';
export type {
  GenerateResult,
  GenerateEvent,
  GenerateEventHandler,
} from './core/generate.js';
export { runExploration } from './core/explorer.js';
export { synthesizeFlows } from './core/synthesize.js';
export type { SynthesizeFlowsOptions } from './core/synthesize.js';
export { extractFlows, identifyCoverageGaps } from './core/flow-extractor.js';
export { loadGraph, saveGraph, createEmptyGraph } from './core/graph-store.js';
export {
  loadLens,
  loadLenses,
  parseLensFlag,
  listAvailableLenses,
  buildLensPromptSection,
  getLensTags,
  BUILT_IN_LENSES,
} from './core/lenses.js';
export type { Lens, BuiltInLens } from './core/lenses.js';
export {
  parseLLMJson,
  videoAnalysisSchema,
  gherkinResultSchema,
  buildSpecSchema,
  LLMOutputError,
} from './core/llm-json.js';

// Re-export all types
export type {
  VideoAnalysis,
  ScreenCapture,
  UIInteraction,
  TranscriptSegment,
  GherkinResult,
  GherkinFeature,
  GherkinScenario,
  GherkinStep,
  BuildSpec,
  DesignTokens,
  ScreenSpec,
  ComponentSpec,
  EntitySpec,
  FieldSpec,
  InteractionSpec,
  NavigationFlow,
  Framework,
  AppConfig,
  GenerateOptions,
  ProgressCallback,
  ExploreOptions,
  ExplorationGraph,
  ScreenNode,
  Edge,
  DiscoveredInteraction,
  ExplorationMetadata,
  AuthStrategy,
  SerializedGraph,
} from './core/types.js';

import type {
  VideoAnalysis,
  GherkinResult,
  Framework,
  ProgressCallback,
} from './core/types.js';
import { resolveVideoInput, cleanupTempVideo } from './core/video-input.js';
import { analyzeVideo } from './gemini/client.js';
import { generateGherkin } from './claude/client.js';
import { formatAllFeatures } from './output/formatter.js';
import { loadLenses, parseLensFlag } from './core/lenses.js';

/**
 * High-level convenience function that runs the full in-memory pipeline:
 * resolve video -> analyze with Gemini -> generate Gherkin with Claude -> format.
 *
 * Unlike generate(), this does not write files — it returns the raw analysis,
 * structured Gherkin result, and formatted feature file contents.
 */
export async function processVideo(options: {
  video: string;
  geminiApiKey: string;
  anthropicApiKey: string;
  geminiModel?: string;
  claudeModel?: string;
  framework?: Framework;
  context?: string;
  lens?: string;
  onProgress?: ProgressCallback;
}): Promise<{
  analysis: VideoAnalysis;
  gherkin: GherkinResult;
  features: Map<string, string>;
}> {
  const {
    video,
    geminiApiKey,
    anthropicApiKey,
    geminiModel = 'gemini-2.5-pro',
    claudeModel = 'claude-opus-4-6',
    framework = 'cucumber-js',
    context,
    lens,
    onProgress,
  } = options;

  const lenses = lens ? await loadLenses(parseLensFlag(lens)) : [];

  // Step 1: Resolve video input (local file or URL download)
  onProgress?.('resolve', 'Resolving video input...');
  const resolved = await resolveVideoInput(video);

  try {
    // Step 2: Analyze video with Gemini
    onProgress?.('gemini', 'Analyzing video with Gemini...');
    const analysis = await analyzeVideo({
      videoPath: resolved.localPath,
      apiKey: geminiApiKey,
      model: geminiModel,
      lenses,
      onProgress,
    });

    // Step 3: Generate Gherkin scenarios with Claude
    onProgress?.('claude', 'Generating Gherkin scenarios with Claude...');
    const gherkin = await generateGherkin({
      analysis,
      apiKey: anthropicApiKey,
      model: claudeModel,
      framework,
      context,
      lenses,
      onProgress,
    });

    // Step 4: Format feature files
    onProgress?.('format', 'Formatting feature files...');
    const features = formatAllFeatures(gherkin);

    return { analysis, gherkin, features };
  } finally {
    // Step 5: Clean up temp files (downloaded URLs)
    await cleanupTempVideo(resolved);
  }
}
