export interface VideoAnalysis {
  screens: ScreenCapture[];
  interactions: UIInteraction[];
  transcript?: TranscriptSegment[];
  summary: string;
}

export interface ScreenCapture {
  timestamp: string;
  description: string;
}

export interface UIInteraction {
  timestamp: string;
  type: "click" | "type" | "navigate" | "scroll" | "select" | "hover" | "drag";
  target: string;
  value?: string;
  context: string;
}

export interface TranscriptSegment {
  timestamp: string;
  text: string;
}

export interface GherkinResult {
  features: GherkinFeature[];
}

export interface GherkinFeature {
  name: string;
  description?: string;
  tags: string[];
  background?: { steps: GherkinStep[] };
  scenarios: GherkinScenario[];
}

export interface GherkinScenario {
  name: string;
  tags: string[];
  type: "Scenario" | "Scenario Outline";
  steps: GherkinStep[];
  examples?: {
    headers: string[];
    rows: string[][];
  };
}

export interface GherkinStep {
  keyword: "Given" | "When" | "Then" | "And" | "But";
  text: string;
}

export type Framework =
  | "cucumber-js"
  | "cucumber-java"
  | "behave"
  | "specflow";

export interface AppConfig {
  geminiApiKey: string;
  anthropicApiKey: string;
  geminiModel: string;
  claudeModel: string;
  framework: Framework;
  outputDir: string;
  language: string;
  generateStubs: boolean;
}

export interface GenerateOptions {
  video: string | string[];
  output: string;
  framework?: Framework;
  verbose?: boolean;
  dryRun?: boolean;
  saveAnalysis?: boolean;
  config?: string;
  context?: string;
  contextFile?: string;
  append?: boolean;
  format?: "gherkin" | "json";
}

export type ProgressCallback = (stage: string, message: string) => void;
