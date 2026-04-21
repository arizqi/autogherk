import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export type BuiltInLens = "qa" | "designer" | "growth" | "security" | "support" | "pm" | "a11y";

export const BUILT_IN_LENSES: BuiltInLens[] = [
  "qa",
  "designer",
  "growth",
  "security",
  "support",
  "pm",
  "a11y",
];

export interface Lens {
  name: string;
  tag: string; // e.g. "@designer"
  persona: string;
  priorities: string[];
  scenarioVocabulary: string;
  gherkinGuidance: string;
  analysisFocus: string;
  specFocus: string;
  exploreEdgePriority: string;
  isCustom: boolean;
}

const LENS_DEFINITIONS: Record<BuiltInLens, Omit<Lens, "isCustom">> = {
  qa: {
    name: "qa",
    tag: "@qa",
    persona: "A QA engineer writing comprehensive test coverage.",
    priorities: [
      "Edge cases and boundary conditions",
      "Form validation rules and error messages",
      "Happy path and alternative flows",
      "Regression coverage for critical paths",
      "Error handling and recovery",
    ],
    scenarioVocabulary:
      "Use neutral third-person framing: \"the user\", \"the system\". Favor precise assertions.",
    gherkinGuidance:
      "Write scenarios that would catch regressions. Include negative cases alongside happy paths. Use Scenario Outlines for parameterized validation checks.",
    analysisFocus:
      "Capture every form field, button, validation message, loading state, and error message. Note boundary conditions.",
    specFocus:
      "Thoroughly document validation rules, error states, and edge cases in component specs.",
    exploreEdgePriority:
      "Prioritize forms, inputs, and interactions that trigger validation or state changes.",
  },
  designer: {
    name: "designer",
    tag: "@designer",
    persona:
      "A product designer auditing UX quality, visual hierarchy, and interaction design.",
    priorities: [
      "Empty states, loading states, error states, success states",
      "Micro-interactions, transitions, and animations",
      "Information hierarchy and visual clarity",
      "Consistency across screens (components, spacing, type)",
      "Accessibility of visual elements (contrast, focus indicators)",
    ],
    scenarioVocabulary:
      "Frame from the user's perceptual experience: \"the user sees\", \"the interface communicates\", \"the design clearly shows\".",
    gherkinGuidance:
      "Write scenarios about what the user perceives, not just functional outcomes. Include scenarios for empty/loading/error states. Then steps should describe visual feedback (e.g., \"Then a clear success message appears within 300ms\").",
    analysisFocus:
      "Note every loading state, empty state, error state, skeleton screen, transition, hover effect, and micro-animation. Call out visual hierarchy choices.",
    specFocus:
      "Emphasize component state variants (default, hover, active, disabled, loading, empty, error). Document design tokens thoroughly. Infer missing design states.",
    exploreEdgePriority:
      "Prioritize interactions that reveal new visual states — hovers, expansions, modals, loading triggers.",
  },
  growth: {
    name: "growth",
    tag: "@growth",
    persona:
      "A growth PM auditing activation, conversion, and retention mechanics.",
    priorities: [
      "Signup, onboarding, and activation flows",
      "Funnel steps and conversion points",
      "Paywalls, upgrade prompts, and pricing surfaces",
      "CTAs, empty-state nudges, and re-engagement hooks",
      "Referral, sharing, and viral loops",
    ],
    scenarioVocabulary:
      "Use funnel-stage language: \"the prospect\", \"the trialing user\", \"the activated user\", \"the paying customer\". Frame outcomes as conversion events.",
    gherkinGuidance:
      "Write scenarios around conversion moments. Then steps should reference funnel milestones (e.g., \"Then the user reaches the 'aha' moment\", \"Then the prospect is prompted to upgrade\"). Highlight drop-off risks.",
    analysisFocus:
      "Flag every CTA, paywall, upgrade prompt, onboarding step, tooltip/coachmark, empty-state nudge, and referral surface. Note what drives users forward in the funnel.",
    specFocus:
      "Emphasize funnel-stage data models (trial state, subscription tier, activation flags). Document conversion events as interactions. Include upgrade and paywall screens.",
    exploreEdgePriority:
      "Prioritize signup, onboarding, checkout, and upgrade paths. Explore paywalls and pricing surfaces.",
  },
  security: {
    name: "security",
    tag: "@security",
    persona:
      "A security auditor mapping attack surface and authorization boundaries.",
    priorities: [
      "Authentication and session management",
      "Authorization boundaries (who can see/do what)",
      "Input validation and injection surfaces",
      "Sensitive data exposure (URLs, logs, UI)",
      "Destructive actions and their reversibility",
    ],
    scenarioVocabulary:
      "Frame from adversarial perspective: \"an unauthorized user\", \"an attacker\", \"a lower-privilege role\". Assertions should focus on access denial and data protection.",
    gherkinGuidance:
      "Write scenarios that probe auth boundaries, input validation, and privilege escalation. Include negative scenarios where access should be denied. Then steps should assert that unauthorized actions fail safely.",
    analysisFocus:
      "Flag every auth boundary, input field, admin toggle, role-based UI element, URL parameter, and destructive action. Note places where sensitive data is displayed.",
    specFocus:
      "Emphasize auth/permission entities, role-based access, input validation contracts, and data exposure surfaces in components.",
    exploreEdgePriority:
      "Prioritize auth boundaries, admin-only toggles, input fields (especially in URLs/forms), and role-switching interactions.",
  },
  support: {
    name: "support",
    tag: "@support",
    persona:
      "A customer success engineer mapping where users get stuck and how they recover.",
    priorities: [
      "Common user paths that lead to confusion",
      "Error messages and recovery paths",
      "Help links, tooltips, and inline guidance",
      "Stuck states (empty state with no clear next action)",
      "Triage paths for support staff",
    ],
    scenarioVocabulary:
      "Frame from the user's confusion point: \"the confused user\", \"the struggling customer\", \"the first-time visitor\". Emphasize recovery and next-step clarity.",
    gherkinGuidance:
      "Write scenarios about users getting unstuck. Then steps should assert that clear next-step guidance is available (e.g., \"Then the user sees an actionable error message with a recovery path\").",
    analysisFocus:
      "Note error messages, help icons, tooltips, empty-state CTAs, inline validation, and places where users might get confused.",
    specFocus:
      "Document error message formats, recovery paths, help content, and empty-state guidance. Include support-facing admin views.",
    exploreEdgePriority:
      "Prioritize error states, empty states, help/tooltip interactions, and paths that lead to support-related actions.",
  },
  pm: {
    name: "pm",
    tag: "@pm",
    persona:
      "A product manager auditing user value delivery and competitive positioning.",
    priorities: [
      "Core value moments (what the user is paid to do)",
      "KPI-relevant user paths",
      "Competitive differentiators vs alternatives",
      "Feature adoption surfaces",
      "User-value-to-complexity ratio per screen",
    ],
    scenarioVocabulary:
      "Frame around outcomes: \"the customer gets value\", \"the outcome is achieved\", \"the job is done\". Emphasize what the user came here to accomplish.",
    gherkinGuidance:
      "Write scenarios around key user outcomes, not UI actions. Then steps should reference value delivered (e.g., \"Then the customer has successfully completed their quarterly report\").",
    analysisFocus:
      "Identify the core user job being performed. Flag each value-delivery moment. Note friction points and competitive table-stakes features.",
    specFocus:
      "Emphasize value-delivery flows and KPI-relevant entities. Document the core job-to-be-done per screen.",
    exploreEdgePriority:
      "Prioritize paths leading to the core value moment. Explore primary workflow, not settings/admin.",
  },
  a11y: {
    name: "a11y",
    tag: "@a11y",
    persona:
      "An accessibility auditor verifying WCAG compliance and assistive-tech compatibility.",
    priorities: [
      "Keyboard navigation and focus management",
      "Screen reader announcements and semantic structure",
      "Color contrast and non-color-based signaling",
      "Form labels, errors, and field descriptions",
      "Motion, animation, and reduced-motion handling",
    ],
    scenarioVocabulary:
      "Frame from assistive-tech users: \"the keyboard user\", \"the screen reader user\", \"the low-vision user\", \"the user with reduced motion preference\".",
    gherkinGuidance:
      "Write scenarios that exercise non-mouse, non-sighted, non-default-motion usage. Then steps should assert accessibility guarantees (e.g., \"Then focus is placed on the error summary\", \"Then the screen reader announces the status update\").",
    analysisFocus:
      "Note focus indicators, keyboard shortcuts, ARIA roles, alt text, form labels, color-only signaling, and motion/animation use.",
    specFocus:
      "Document ARIA roles, keyboard shortcuts, focus order, and accessibility contracts per component.",
    exploreEdgePriority:
      "Prioritize focusable elements, form fields, and interactive widgets. Verify keyboard-reachability.",
  },
};

/**
 * Parse a lens flag value ("designer", "designer,growth") into a list of lens names.
 */
export function parseLensFlag(value: string | undefined): string[] {
  if (!value || value.trim() === "") return [];
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Load a lens by name. Checks built-ins first, then .autogherk/lenses/<name>.md
 * for custom lenses.
 */
export async function loadLens(name: string): Promise<Lens> {
  const normalizedName = name.toLowerCase();

  if (BUILT_IN_LENSES.includes(normalizedName as BuiltInLens)) {
    return { ...LENS_DEFINITIONS[normalizedName as BuiltInLens], isCustom: false };
  }

  // Try to load a custom lens
  const customPath = join(process.cwd(), ".autogherk", "lenses", `${normalizedName}.md`);
  try {
    const content = await readFile(customPath, "utf-8");
    return parseCustomLens(normalizedName, content);
  } catch {
    throw new Error(
      `Unknown lens: "${name}". Built-in lenses: ${BUILT_IN_LENSES.join(", ")}. Custom lenses must live at .autogherk/lenses/${normalizedName}.md`,
    );
  }
}

/**
 * Load multiple lenses by name.
 */
export async function loadLenses(names: string[]): Promise<Lens[]> {
  return Promise.all(names.map((n) => loadLens(n)));
}

/**
 * List all available lenses (built-in + custom).
 */
export async function listAvailableLenses(): Promise<{ builtIn: string[]; custom: string[] }> {
  const builtIn = [...BUILT_IN_LENSES];
  const custom: string[] = [];

  try {
    const customDir = join(process.cwd(), ".autogherk", "lenses");
    const files = await readdir(customDir);
    for (const file of files) {
      if (file.endsWith(".md")) {
        custom.push(file.replace(/\.md$/, ""));
      }
    }
  } catch {
    // No custom lenses directory — that's fine
  }

  return { builtIn, custom };
}

/**
 * Parse a custom lens markdown file into a Lens object.
 * Very forgiving — just extracts text content and uses the name as identifier.
 */
function parseCustomLens(name: string, content: string): Lens {
  // Extract priorities (bullet points after "Priorities" heading)
  const prioritiesMatch = content.match(/priorities:?\s*\n((?:[-*]\s*.+\n?)+)/i);
  const priorities = prioritiesMatch
    ? prioritiesMatch[1].split("\n").map((l) => l.replace(/^[-*]\s*/, "").trim()).filter(Boolean)
    : [];

  // Extract persona (first line after "Persona:")
  const personaMatch = content.match(/persona:?\s*(.+)/i);
  const persona = personaMatch ? personaMatch[1].trim() : `Custom lens: ${name}`;

  // Use the entire file as gherkin guidance — lets users be arbitrarily descriptive
  const guidance = content.trim();

  return {
    name,
    tag: `@${name}`,
    persona,
    priorities,
    scenarioVocabulary: "Follow the lens description below.",
    gherkinGuidance: guidance,
    analysisFocus: guidance,
    specFocus: guidance,
    exploreEdgePriority: guidance,
    isCustom: true,
  };
}

/**
 * Build a prompt-injectable section describing one or more lenses for Claude/Gemini.
 */
export function buildLensPromptSection(lenses: Lens[], context: "gherkin" | "analysis" | "spec" | "explore"): string {
  if (lenses.length === 0) return "";

  const header =
    lenses.length === 1
      ? `## LENS: ${lenses[0].name.toUpperCase()}`
      : `## LENSES: ${lenses.map((l) => l.name.toUpperCase()).join(" + ")}`;

  const perLensSection = lenses
    .map((lens) => {
      let focusSection = "";
      switch (context) {
        case "gherkin":
          focusSection = lens.gherkinGuidance;
          break;
        case "analysis":
          focusSection = lens.analysisFocus;
          break;
        case "spec":
          focusSection = lens.specFocus;
          break;
        case "explore":
          focusSection = lens.exploreEdgePriority;
          break;
      }

      return `### ${lens.name} lens

**Persona:** ${lens.persona}

**Priorities:**
${lens.priorities.map((p) => `- ${p}`).join("\n")}

**Scenario vocabulary:** ${lens.scenarioVocabulary}

**Guidance for ${context}:**
${focusSection}
`;
    })
    .join("\n---\n\n");

  const multiLensNote =
    lenses.length > 1
      ? `\nWhen generating output, create scenarios for EACH lens. Tag each scenario with the corresponding lens tag (${lenses.map((l) => l.tag).join(", ")}). A single scenario may carry multiple lens tags if it genuinely serves multiple personas, but prefer distinct scenarios per lens.\n`
      : `\nTag all scenarios with ${lenses[0].tag}.\n`;

  return `${header}

You are generating output through the lens(es) below. This means:
- The SELECTION of scenarios/screens/interactions to include reflects these priorities
- The FRAMING (Given/When/Then vocabulary) matches the persona
- The ASSERTIONS focus on what matters to this persona

${perLensSection}${multiLensNote}`;
}

/**
 * Get the set of lens tags for a list of lenses — useful for tagging scenarios.
 */
export function getLensTags(lenses: Lens[]): string[] {
  return lenses.map((l) => l.tag);
}
