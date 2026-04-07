import type {
  BuildSpec,
  ScreenSpec,
  ComponentSpec,
  EntitySpec,
  NavigationFlow,
  DesignTokens,
} from "../core/types.js";

export function formatBuildSpec(spec: BuildSpec): string {
  const lines: string[] = [];

  lines.push(`# ${spec.appName} — Build Specification`);
  lines.push("");
  lines.push(spec.summary);
  lines.push("");

  // Table of contents
  lines.push("## Table of Contents");
  lines.push("");
  lines.push("1. [Design Tokens](#design-tokens)");
  lines.push("2. [Screens](#screens)");
  lines.push("3. [Data Model](#data-model)");
  lines.push("4. [Navigation Map](#navigation-map)");
  lines.push("5. [Global Components](#global-components)");
  lines.push("");

  // Design Tokens
  if (spec.styles) {
    lines.push("---");
    lines.push("");
    lines.push(...formatDesignTokens(spec.styles));
    lines.push("");
  }

  // Screens
  lines.push("---");
  lines.push("");
  lines.push("## Screens");
  lines.push("");
  for (const screen of spec.screens) {
    lines.push(...formatScreen(screen));
    lines.push("");
  }

  // Data Model
  lines.push("---");
  lines.push("");
  lines.push("## Data Model");
  lines.push("");
  for (const entity of spec.dataModel) {
    lines.push(...formatEntity(entity));
    lines.push("");
  }

  // Navigation
  lines.push("---");
  lines.push("");
  lines.push("## Navigation Map");
  lines.push("");
  lines.push(...formatNavigation(spec.navigation));
  lines.push("");

  // Global Components
  if (spec.globalComponents.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Global Components");
    lines.push("");
    for (const comp of spec.globalComponents) {
      lines.push(...formatComponent(comp, 0));
      lines.push("");
    }
  }

  return lines.join("\n");
}

function formatDesignTokens(styles: DesignTokens): string[] {
  const lines: string[] = [];

  lines.push("## Design Tokens");
  lines.push("");

  // Colors
  lines.push("### Colors");
  lines.push("");
  lines.push("| Token | Value | Usage |");
  lines.push("|-------|-------|-------|");
  const colorDescriptions: Record<string, string> = {
    primary: "Primary brand, buttons, links",
    secondary: "Secondary actions, less emphasis",
    accent: "Highlights, badges, attention",
    background: "Page background",
    surface: "Card/panel backgrounds",
    text: "Primary text",
    textSecondary: "Secondary/muted text",
    border: "Borders, dividers",
    error: "Error states, destructive actions",
    success: "Success states, positive indicators",
    warning: "Warning states, caution indicators",
  };
  for (const [key, value] of Object.entries(styles.colors)) {
    const desc = colorDescriptions[key] ?? key;
    lines.push(`| \`${key}\` | \`${value}\` | ${desc} |`);
  }
  lines.push("");

  // Typography
  lines.push("### Typography");
  lines.push("");
  lines.push(`**Font family:** \`${styles.typography.fontFamily}\``);
  lines.push("");
  lines.push("| Level | Value |");
  lines.push("|-------|-------|");
  lines.push(`| h1 | \`${styles.typography.headings.h1}\` |`);
  lines.push(`| h2 | \`${styles.typography.headings.h2}\` |`);
  lines.push(`| h3 | \`${styles.typography.headings.h3}\` |`);
  lines.push(`| body | \`${styles.typography.body}\` |`);
  lines.push(`| caption | \`${styles.typography.caption}\` |`);
  lines.push("");

  // Spacing
  lines.push("### Spacing");
  lines.push("");
  lines.push(`Base unit: \`${styles.spacing.unit}\``);
  lines.push("");
  lines.push("| Token | Value |");
  lines.push("|-------|-------|");
  for (const [key, value] of Object.entries(styles.spacing)) {
    if (key !== "unit") {
      lines.push(`| \`${key}\` | \`${value}\` |`);
    }
  }
  lines.push("");

  // Border radius
  lines.push("### Border Radius");
  lines.push("");
  lines.push("| Element | Value |");
  lines.push("|---------|-------|");
  for (const [key, value] of Object.entries(styles.borderRadius)) {
    lines.push(`| \`${key}\` | \`${value}\` |`);
  }
  lines.push("");

  // Shadows
  lines.push("### Shadows");
  lines.push("");
  lines.push("| Level | Value |");
  lines.push("|-------|-------|");
  for (const [key, value] of Object.entries(styles.shadows)) {
    lines.push(`| \`${key}\` | \`${value}\` |`);
  }
  lines.push("");

  // Layout
  lines.push("### Layout");
  lines.push("");
  lines.push("| Dimension | Value |");
  lines.push("|-----------|-------|");
  for (const [key, value] of Object.entries(styles.layout)) {
    lines.push(`| \`${key}\` | \`${value}\` |`);
  }

  return lines;
}

function formatScreen(screen: ScreenSpec): string[] {
  const lines: string[] = [];

  lines.push(`### ${screen.name}`);
  lines.push("");
  lines.push(`**Route:** \`${screen.route}\``);
  lines.push("");
  lines.push(screen.description);
  lines.push("");
  lines.push(`**Layout:** ${screen.layout}`);
  lines.push("");

  // Screenshot reference
  if (screen.screenshotTimestamp) {
    const screenshotFile = toKebabCase(screen.name) + ".png";
    lines.push(`**Reference screenshot:** ![${screen.name}](screenshots/${screenshotFile}) *(at ${screen.screenshotTimestamp})*`);
    lines.push("");
  }

  // Components
  if (screen.components.length > 0) {
    lines.push("**Components:**");
    lines.push("");
    for (const comp of screen.components) {
      lines.push(...formatComponent(comp, 0));
    }
    lines.push("");
  }

  // Interactions
  if (screen.interactions.length > 0) {
    lines.push("**Interactions:**");
    lines.push("");
    lines.push("| Trigger | Action | Outcome |");
    lines.push("|---------|--------|---------|");
    for (const interaction of screen.interactions) {
      const validations =
        interaction.validations && interaction.validations.length > 0
          ? ` (validates: ${interaction.validations.join(", ")})`
          : "";
      lines.push(
        `| ${interaction.trigger} | ${interaction.action} | ${interaction.outcome}${validations} |`,
      );
    }
    lines.push("");
  }

  // Data Requirements
  if (screen.dataRequirements.length > 0) {
    lines.push("**Data Requirements:**");
    lines.push("");
    for (const req of screen.dataRequirements) {
      lines.push(`- ${req}`);
    }
    lines.push("");
  }

  return lines;
}

function formatComponent(comp: Record<string, any>, depth: number): string[] {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);

  // Handle proper ComponentSpec objects
  if (comp.name && comp.type) {
    const desc = comp.description ? ` — ${comp.description}` : "";
    lines.push(`${indent}- **${comp.name}** \`${comp.type}\`${desc}`);

    if (comp.props && Array.isArray(comp.props) && comp.props.length > 0) {
      const propStrings = comp.props.map((p: any) =>
        typeof p === "object" ? `\`${JSON.stringify(p)}\`` : `\`${p}\``
      );
      lines.push(`${indent}  - Props: ${propStrings.join(", ")}`);
    }

    if (comp.states && Array.isArray(comp.states) && comp.states.length > 0) {
      lines.push(`${indent}  - States: ${comp.states.join(", ")}`);
    }
  } else {
    // Handle data example objects (e.g., {label: "Total Agents", value: "443"})
    // Render all key-value pairs as a readable line
    const pairs = Object.entries(comp)
      .filter(([k]) => k !== "children")
      .map(([k, v]) => {
        if (typeof v === "object" && v !== null) {
          return `${k}: ${JSON.stringify(v)}`;
        }
        return `${k}: ${v}`;
      })
      .join(", ");
    if (pairs) {
      lines.push(`${indent}- ${pairs}`);
    }
  }

  if (comp.children && Array.isArray(comp.children) && comp.children.length > 0) {
    for (const child of comp.children) {
      lines.push(...formatComponent(child, depth + 1));
    }
  }

  return lines;
}

function formatEntity(entity: EntitySpec): string[] {
  const lines: string[] = [];

  lines.push(`### ${entity.name}`);
  lines.push("");
  lines.push(entity.description);
  lines.push("");
  lines.push("| Field | Type | Required | Description |");
  lines.push("|-------|------|----------|-------------|");
  for (const field of entity.fields) {
    lines.push(
      `| ${field.name} | \`${field.type}\` | ${field.required ? "Yes" : "No"} | ${field.description ?? ""} |`,
    );
  }

  if (entity.relationships && entity.relationships.length > 0) {
    lines.push("");
    lines.push("**Relationships:**");
    for (const rel of entity.relationships) {
      lines.push(`- ${rel}`);
    }
  }

  return lines;
}

function formatNavigation(flows: NavigationFlow[]): string[] {
  const lines: string[] = [];

  lines.push("| From | To | Trigger | Condition |");
  lines.push("|------|-----|---------|-----------|");
  for (const flow of flows) {
    lines.push(
      `| ${flow.from} | ${flow.to} | ${flow.trigger} | ${flow.condition ?? "—"} |`,
    );
  }

  return lines;
}

export function formatSpecAsScreenFiles(
  spec: BuildSpec,
): Map<string, string> {
  const files = new Map<string, string>();

  // Main spec overview
  files.set("spec-overview.md", formatBuildSpec(spec));

  // Design tokens as JSON for direct consumption by build tools
  if (spec.styles) {
    files.set("tokens.json", JSON.stringify(spec.styles, null, 2) + "\n");
  }

  // Individual screen files for detailed reference
  for (const screen of spec.screens) {
    const fileName = toKebabCase(screen.name) + ".spec.md";
    const lines: string[] = [];

    lines.push(`# ${screen.name}`);
    lines.push("");
    lines.push(...formatScreen(screen));

    // Add relevant data model entities
    const relevantEntities = spec.dataModel.filter((entity) =>
      screen.dataRequirements.some(
        (req) => req.toLowerCase().includes(entity.name.toLowerCase()),
      ),
    );
    if (relevantEntities.length > 0) {
      lines.push("## Related Data Models");
      lines.push("");
      for (const entity of relevantEntities) {
        lines.push(...formatEntity(entity));
        lines.push("");
      }
    }

    // Add relevant navigation
    const relevantNavs = spec.navigation.filter(
      (n) => n.from === screen.name || n.to === screen.name,
    );
    if (relevantNavs.length > 0) {
      lines.push("## Navigation");
      lines.push("");
      lines.push(...formatNavigation(relevantNavs));
    }

    files.set(fileName, lines.join("\n") + "\n");
  }

  // Raw JSON for programmatic use
  files.set("spec.json", JSON.stringify(spec, null, 2) + "\n");

  return files;
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
