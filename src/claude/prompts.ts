import type { Framework } from "../core/types.js";

export function getBuildSpecPrompt(depth: "deep" | "shallow" = "deep"): string {
  const depthInstructions = depth === "deep" ? DEEP_SPEC_INSTRUCTIONS : SHALLOW_SPEC_INSTRUCTIONS;

  return `You are an expert software architect, UI designer, and product reverse-engineer. Given a product usage video, generate a comprehensive build specification that another AI agent (like Claude Opus) could use to rebuild this application from scratch — both functionally AND visually.

There may be no audio narration, so focus entirely on the observed user actions, screen states, and visual design.

Your goal is to produce BLUEPRINTS, not test cases. Think like an architect reverse-engineering a product for pixel-accurate, feature-complete replication.

${depthInstructions}

Return ONLY a JSON object matching this structure — no markdown, no code blocks:

${BUILD_SPEC_JSON_SCHEMA}`;
}

const SHALLOW_SPEC_INSTRUCTIONS = `Generate a build spec covering:

1. **Design tokens / styles**: Extract the visual design system — colors (hex), typography, spacing, border radius, shadows, layout dimensions.

2. **Screen inventory**: Every distinct screen observed with name, route, layout, screenshotTimestamp (MM:SS), components, interactions, and data requirements.

3. **Component tree**: Hierarchical UI components per screen with name, type, props, states, children.

4. **Data model**: Entities with fields, types, required flags, and relationships.

5. **Navigation map**: Screen-to-screen transitions with triggers and conditions.

6. **Global components**: Shared elements (sidebar, header, common patterns).`;

const DEEP_SPEC_INSTRUCTIONS = `IMPORTANT: You are generating an EXHAUSTIVE specification. A developer with ZERO context about this application should be able to rebuild it completely from your output alone. Do not be surface-level. Every detail matters.

Generate a build spec covering ALL of the following — be thorough on every point:

1. **Design tokens / styles**: Carefully observe the visual design across ALL screens and extract:
   - Color palette: primary, secondary, accent, background, surface, text, textSecondary, border, error, success, warning — as hex values. Also extract any additional colors you observe (sidebar background, active states, hover states, badge colors, status colors for each status type, chart colors).
   - Typography: font family (be specific — Inter, Roboto, etc.), heading sizes (h1/h2/h3 as CSS shorthand like "600 24px/32px"), body text, caption, and any other text styles you see (stat numbers, table headers, nav items).
   - Spacing: base unit, xs through xl values in px.
   - Border radius: for cards, buttons, inputs, modals, badges, avatars.
   - Shadows: for cards, dropdowns, modals, sidebar.
   - Layout dimensions: max content width, sidebar width, header height.

2. **Screen inventory**: Every distinct screen/page/view observed, including sub-views and tab states. For EACH screen:
   - Name and likely route path (including dynamic segments like /agent/:id)
   - Layout description (grid structure, column layout, responsive behavior)
   - screenshotTimestamp: the MM:SS timestamp in the video where this screen is most clearly visible
   - EXHAUSTIVE component breakdown (see below)
   - ALL data requirements — every piece of data this screen needs

3. **Component tree — EXHAUSTIVE**: For EACH screen, describe EVERY visible UI element:
   - **Tables**: List EVERY column header, cell render type (text, badge, link, avatar+name, date, action buttons), sort capability, filter capability, pagination style, row click behavior, bulk selection, empty state text
   - **Forms**: List EVERY field — name, input type (text, email, password, select, multiselect, date picker, checkbox, radio, toggle, textarea, file upload), placeholder text, validation rules (required, format, min/max), default values, error message format
   - **Cards**: EVERY data point displayed, click behavior, hover state, action buttons/menus on the card
   - **Stat/metric displays**: Label, value format (number, currency, percentage), trend indicator, comparison period, sparkline/mini-chart type
   - **Buttons**: Label, variant (primary, secondary, ghost, danger), icon, disabled conditions, loading state, what it triggers
   - **Badges/status indicators**: ALL possible values and their colors (e.g., Active=green, Expired=red, Onboarding=blue)
   - **Dropdowns/menus**: All menu items, icons, keyboard shortcuts
   - **Modals/drawers/dialogs**: Trigger, title, content, action buttons, dismiss behavior — INFER these even if not shown. If there's an "Edit" button, spec what the edit form contains. If there's a "Delete" button, spec the confirmation dialog.
   - **Charts/graphs**: Type (line, bar, donut, area), data series, axis labels, legend, tooltip content, time range selectors
   - **Tabs**: All tab labels, which is default active
   - **Search/filter bars**: What fields are filterable, filter types (text search, dropdown, date range, toggle), clear behavior
   - **Pagination**: Style (numbered, load more, infinite scroll), items per page
   - **Empty states**: What message shows when no data exists
   - **Loading states**: Skeleton screens, spinners, progress bars
   - **Error states**: Error message format, retry behavior

4. **Data model — COMPLETE**: Every entity visible or implied in the UI:
   - Entity name and description
   - EVERY field observed in tables, cards, forms, detail views — with type (string, number, boolean, date, datetime, enum, uuid), required flag, and purpose
   - Enum fields: list ALL possible values observed (e.g., status: 'Active' | 'Onboarding' | 'Offboarding' | 'Expired')
   - ALL relationships with cardinality (one-to-one, one-to-many, many-to-many)
   - Computed/derived fields (e.g., "daysOverdue" computed from expirationDate)

5. **Navigation map — COMPLETE**: Every possible navigation path:
   - Sidebar menu items — full list with icons, grouping, nesting
   - Screen-to-screen transitions with exact triggers
   - Breadcrumbs if visible
   - Back navigation behavior
   - Role-based visibility (which menu items/screens are admin-only vs agent-only)
   - Deep links (e.g., clicking an agent name in a table goes to /agent/:id)

6. **Interactions — EXHAUSTIVE**: For EVERY screen, document EVERY possible user action:
   - Click, hover, type, select, drag, scroll, keyboard shortcut
   - What triggers it, what happens (API call, navigation, modal open, data update, animation)
   - Optimistic UI updates vs loading states
   - Form submission flows (validate -> submit -> success/error -> redirect)
   - Bulk actions (select multiple -> action dropdown)
   - Inline editing if present
   - Drag and drop (e.g., Kanban card moves between columns)
   - Sort and filter interactions on tables

7. **Global components — DETAILED**: Every shared element:
   - Sidebar: all menu items, grouping, active state styling, collapse behavior, role-based items
   - Header: logo, search bar behavior, notification bell, user avatar menu items, office selector
   - Toast/notification system: position, auto-dismiss timing, action buttons
   - Confirmation dialogs: standard pattern
   - Common card patterns, table patterns, form patterns

8. **Inferred screens and states**: Based on what you observe, INFER screens and UI states that are logically necessary but not directly shown in the video:
   - If there's a "Create" button, spec the creation form
   - If there's a list view, spec what the detail view likely contains
   - If there's an admin view, infer what the agent-facing equivalent looks like
   - If there's a table with data, spec the empty state
   - If there's a form, spec the validation error states
   Mark inferred items clearly with an "(inferred)" note in descriptions.`;

const BUILD_SPEC_JSON_SCHEMA = `{
  "appName": "Name of the application",
  "summary": "2-3 sentence overview of what this app does and who it's for",
  "styles": {
    "colors": {
      "primary": "#1a73e8",
      "secondary": "#5f6368",
      "accent": "#fbbc04",
      "background": "#f8f9fa",
      "surface": "#ffffff",
      "text": "#202124",
      "textSecondary": "#5f6368",
      "border": "#dadce0",
      "error": "#d93025",
      "success": "#1e8e3e",
      "warning": "#f9ab00"
    },
    "typography": {
      "fontFamily": "Inter, system-ui, sans-serif",
      "headings": {
        "h1": "700 28px/36px",
        "h2": "600 20px/28px",
        "h3": "600 16px/24px"
      },
      "body": "400 14px/20px",
      "caption": "400 12px/16px"
    },
    "spacing": {
      "unit": "4px",
      "xs": "4px",
      "sm": "8px",
      "md": "16px",
      "lg": "24px",
      "xl": "32px"
    },
    "borderRadius": {
      "button": "6px",
      "card": "8px",
      "input": "4px",
      "modal": "12px",
      "badge": "9999px"
    },
    "shadows": {
      "card": "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
      "dropdown": "0 4px 12px rgba(0,0,0,0.15)",
      "modal": "0 8px 24px rgba(0,0,0,0.2)"
    },
    "layout": {
      "maxWidth": "1440px",
      "sidebarWidth": "260px",
      "headerHeight": "64px"
    }
  },
  "screens": [
    {
      "name": "Screen Name",
      "route": "/likely/route/path",
      "description": "What this screen is for",
      "layout": "Description of the layout structure",
      "screenshotTimestamp": "02:35",
      "components": [
        {
          "name": "ComponentName",
          "type": "display",
          "description": "DETAILED description — for tables include every column, for forms include every field with validation, for cards include every data point",
          "props": ["title", "value", "trend"],
          "children": [],
          "states": ["loading", "populated", "empty", "error"]
        }
      ],
      "interactions": [
        {
          "trigger": "Click Download button",
          "action": "Export data as CSV",
          "outcome": "File download initiates with filename pattern: {entity}-{date}.csv",
          "validations": []
        }
      ],
      "dataRequirements": ["Detailed list of every data field this screen needs"]
    }
  ],
  "dataModel": [
    {
      "name": "EntityName",
      "description": "What this entity represents",
      "fields": [
        {
          "name": "fieldName",
          "type": "string | number | boolean | date | enum('val1','val2') | uuid",
          "required": true,
          "description": "What this field is and where it appears in the UI"
        }
      ],
      "relationships": ["EntityName has many OtherEntity via foreignKey"]
    }
  ],
  "navigation": [
    {
      "from": "Screen A",
      "to": "Screen B",
      "trigger": "Click sidebar item 'Screen B'",
      "condition": "Only visible to admin role"
    }
  ],
  "globalComponents": [
    {
      "name": "Sidebar",
      "type": "navigation",
      "description": "Main navigation sidebar — list ALL menu items, their icons, grouping, and role visibility",
      "props": ["currentRoute", "userRole", "menuItems"],
      "states": ["collapsed", "expanded"]
    }
  ]
}`;

export function getGherkinPrompt(framework: Framework): string {
  const frameworkNotes: Record<Framework, string> = {
    "cucumber-js": "Use step definitions compatible with Cucumber.js (@cucumber/cucumber). Use async/await patterns.",
    "cucumber-java": "Use step definitions compatible with Cucumber for Java (io.cucumber). Use Java naming conventions.",
    "behave": "Use step definitions compatible with Python Behave. Use snake_case and Python conventions.",
    "specflow": "Use step definitions compatible with SpecFlow for .NET. Use C# naming conventions and attributes.",
  };

  return `You are an expert BDD test engineer. Given a structured analysis of a product usage video, generate comprehensive Gherkin test scenarios.

The video analysis describes UI interactions observed in a screen recording — there may be no audio narration, so focus entirely on the observed user actions and screen states.

Framework target: ${framework}
${frameworkNotes[framework]}

Generate well-structured Gherkin scenarios following these rules:

1. **Feature organization**: Group related scenarios under logical features. Each feature should have a clear, descriptive name.
2. **Scenario naming**: Use descriptive names that explain the user intent, not the UI actions (e.g., "Successfully log in with valid credentials" not "Click login button").
3. **Given/When/Then structure**:
   - Given: Preconditions and initial state
   - When: User actions (one primary action per When, use And for supporting actions)
   - Then: Expected outcomes and assertions
4. **Use Scenario Outlines** when you detect patterns that could be parameterized (e.g., form validation with different inputs).
5. **Tags**: Add relevant tags (@smoke, @regression, @login, @form, etc.)
6. **Background**: Use Background for common preconditions shared across scenarios in a feature.
7. **Be declarative**: Write steps from the user's perspective, not implementation details (e.g., "When the user logs in" not "When the user types in the #email-input field").
8. **Cover edge cases**: If the video shows error states, validation messages, or alternative flows, create scenarios for those too.

Return ONLY a JSON object matching this structure — no markdown, no code blocks:

{
  "features": [
    {
      "name": "Feature name",
      "description": "Optional feature description",
      "tags": ["@tag1"],
      "background": {
        "steps": [
          { "keyword": "Given", "text": "the user is on the login page" }
        ]
      },
      "scenarios": [
        {
          "name": "Scenario name",
          "tags": ["@smoke"],
          "type": "Scenario",
          "steps": [
            { "keyword": "Given", "text": "the user has valid credentials" },
            { "keyword": "When", "text": "the user enters their email and password" },
            { "keyword": "And", "text": "the user clicks the login button" },
            { "keyword": "Then", "text": "the user should be redirected to the dashboard" }
          ]
        },
        {
          "name": "Login with various invalid credentials",
          "tags": ["@negative"],
          "type": "Scenario Outline",
          "steps": [
            { "keyword": "When", "text": "the user enters <email> and <password>" },
            { "keyword": "Then", "text": "the user should see <error_message>" }
          ],
          "examples": {
            "headers": ["email", "password", "error_message"],
            "rows": [
              ["invalid@test.com", "wrong", "Invalid credentials"],
              ["", "password", "Email is required"]
            ]
          }
        }
      ]
    }
  ]
}`;
}
