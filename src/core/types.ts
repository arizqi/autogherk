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

// Build Spec types — for replicating functionality, not testing it

export interface BuildSpec {
  appName: string;
  summary: string;
  styles: DesignTokens;
  screens: ScreenSpec[];
  dataModel: EntitySpec[];
  navigation: NavigationFlow[];
  globalComponents: ComponentSpec[];
}

export interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
    [key: string]: string;
  };
  typography: {
    fontFamily: string;
    headings: { h1: string; h2: string; h3: string };
    body: string;
    caption: string;
  };
  spacing: {
    unit: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: { [key: string]: string };
  shadows: { [key: string]: string };
  layout: {
    maxWidth: string;
    sidebarWidth: string;
    headerHeight: string;
  };
}

export interface ScreenSpec {
  name: string;
  route: string;
  description: string;
  layout: string;
  screenshotTimestamp: string;
  components: ComponentSpec[];
  interactions: InteractionSpec[];
  dataRequirements: string[];
}

export interface ComponentSpec {
  name: string;
  type: "layout" | "display" | "input" | "navigation" | "feedback" | "composite";
  description: string;
  props?: string[];
  children?: ComponentSpec[];
  states?: string[];
}

export interface EntitySpec {
  name: string;
  description: string;
  fields: FieldSpec[];
  relationships?: string[];
}

export interface FieldSpec {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface InteractionSpec {
  trigger: string;
  action: string;
  outcome: string;
  validations?: string[];
}

export interface NavigationFlow {
  from: string;
  to: string;
  trigger: string;
  condition?: string;
}

export type Framework =
  | "cucumber-js"
  | "cucumber-java"
  | "behave"
  | "specflow";

export interface AppConfig {
  geminiApiKey: string;
  anthropicApiKey: string | undefined;
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
  format?: "gherkin" | "json" | "spec";
  depth?: "deep" | "shallow";
}

export type ProgressCallback = (stage: string, message: string) => void;
