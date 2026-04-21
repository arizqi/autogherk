import { buildLensPromptSection, type Lens } from "../core/lenses.js";

const BASE_ANALYSIS_PROMPT = `You are an expert QA analyst examining a screen recording of a product being used. Your job is to extract every meaningful user interaction and UI state change from the video.

IMPORTANT: This video likely has NO audio or voiceover. You must extract all information purely from what you SEE on screen — cursor movements, clicks, typing, page transitions, form inputs, button states, error messages, loading indicators, and UI changes.`;

const ANALYSIS_SCHEMA = `Analyze the video frame by frame and return a JSON object with this exact structure:

{
  "screens": [
    {
      "timestamp": "MM:SS",
      "description": "Detailed description of what is visible on screen at this moment"
    }
  ],
  "interactions": [
    {
      "timestamp": "MM:SS",
      "type": "click | type | navigate | scroll | select | hover | drag",
      "target": "Description of the UI element being interacted with (e.g., 'Login button', 'Email input field', 'Dropdown menu')",
      "value": "Any value being entered or selected (for type/select actions)",
      "context": "What page/section/modal this is happening in and what the user appears to be trying to accomplish"
    }
  ],
  "transcript": [
    {
      "timestamp": "MM:SS",
      "text": "Any spoken words or on-screen text narration"
    }
  ],
  "summary": "A 2-3 sentence summary of what the user accomplished in this video, describing the complete workflow from start to finish"
}

Guidelines:
- Capture EVERY click, form fill, navigation, and meaningful scroll
- For "type" interactions, capture the actual text being typed if readable
- For "click" interactions, describe the button/link/element precisely
- For "navigate" interactions, note the URL or page title change if visible
- Group related interactions by the screen/page they occur on
- Note any error messages, validation feedback, success confirmations, or loading states
- The "transcript" array should be empty [] if there is no audio/narration
- Be thorough — it's better to capture too many interactions than too few
- Use timestamps relative to video start (MM:SS format)

Return ONLY the JSON object, no markdown formatting or code blocks.`;

/**
 * Legacy export — no-lens prompt. Kept for backwards compatibility.
 */
export const VIDEO_ANALYSIS_PROMPT = `${BASE_ANALYSIS_PROMPT}\n\n${ANALYSIS_SCHEMA}`;

/**
 * Build a lens-aware video analysis prompt. When lenses are provided, the
 * analysis will prioritize capturing details relevant to those personas.
 */
export function getVideoAnalysisPrompt(lenses: Lens[] = []): string {
  const lensSection = buildLensPromptSection(lenses, "analysis");
  if (!lensSection) return VIDEO_ANALYSIS_PROMPT;

  return `${BASE_ANALYSIS_PROMPT}

${lensSection}

${ANALYSIS_SCHEMA}`;
}
