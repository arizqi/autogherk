# AutoGherk

Turn screen recordings into executable test scenarios and full application blueprints using AI.

[![npm version](https://img.shields.io/npm/v/autogherk)](https://www.npmjs.com/package/autogherk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![CI](https://github.com/arizqi/autogherk/actions/workflows/ci.yml/badge.svg)](https://github.com/arizqi/autogherk/actions)

---

**AutoGherk** watches how your product is used and generates two kinds of output:

- **Gherkin mode** -- `.feature` files that power AI agents to mimic real users, find issues before your customers do, and enable self-healing test systems.
- **Spec mode** -- Full application blueprints with design tokens, component trees, data models, navigation maps, and reference screenshots. Hand the output to Claude Code and get a working replica built.

Product managers ship faster when AI agents can instantly learn new workflows from a video -- no manual test writing, no brittle scripts, no Figma handoff required.

https://storage.googleapis.com/vocaltour-uploads/public_uploads/autogherk_demo.mp4

## Demo

### Gherkin mode (test scenarios)

```
$ autogherk generate --video recording.webm

✔ Configuration loaded
✔ Video analyzed: 12 interactions found across 6 screens
✔ Generated 4 feature(s) with 19 scenario(s)
✔ Output written

✓ Generated 4 feature file(s)
  features/user-login.feature
  features/property-listings.feature
  features/ai-studio-enhancement.feature
  features/navigation.feature
✓ Generated 1 stub file(s)
  features/step_definitions/steps.ts
```

### Spec mode (build blueprints)

```
$ autogherk generate --video recording.webm --format spec

✔ Configuration loaded
✔ Generated build spec: 12 screen(s), 4 entities
✔ Extracted 12 reference screenshot(s)
✔ Output written

✓ Generated 15 spec file(s)
  spec-output/spec-overview.md
  spec-output/tokens.json
  spec-output/screenshots/login.png
  spec-output/screenshots/dashboard.png
  spec-output/login.spec.md
  spec-output/dashboard.spec.md
  spec-output/spec.json
```

## Quick Start

```bash
# Set your API keys
export GEMINI_API_KEY=your-key
export ANTHROPIC_API_KEY=your-key

# Generate test scenarios
npx autogherk generate --video demo.mp4

# Generate build blueprints
npx autogherk generate --video demo.mp4 --format spec --output ./spec-output
```

## Installation

**With npx (no install required):**

```bash
npx autogherk generate --video demo.mp4
```

**Global install via npm:**

```bash
npm install -g autogherk
```

**Global install via pnpm:**

```bash
pnpm add -g autogherk
```

## Usage

### `generate` command

```
autogherk generate [options]
```

| Flag | Description | Default |
| --- | --- | --- |
| `-v, --video <path>` | Input video file path or URL (required, repeatable) | -- |
| `-o, --output <dir>` | Output directory for generated files | `./features/` |
| `-f, --framework <name>` | Target framework (`cucumber-js`, `cucumber-java`, `behave`, `specflow`) | `cucumber-js` |
| `--format <type>` | Output format: `gherkin`, `json`, or `spec` | `gherkin` |
| `--depth <level>` | Spec detail level: `deep` (exhaustive) or `shallow` (surface-level) | `deep` |
| `--context <text>` | Additional context about your application for better generation | -- |
| `--context-file <path>` | Path to a file containing application context | -- |
| `--append` | Append scenarios to existing `.feature` files instead of overwriting | `false` |
| `--verbose` | Print the intermediate Gemini video analysis to stdout | `false` |
| `--dry-run` | Preview generated output without writing any files to disk | `false` |
| `--save-analysis` | Save the raw Gemini analysis as `analysis.json` in the output directory | `false` |
| `-c, --config <path>` | Path to a config file (overrides automatic config search) | -- |

### `init` command

Create a `.autogherkrc.json` configuration file in the current directory with sensible defaults.

```bash
autogherk init
```

### Examples

**Generate test scenarios from a local video:**

```bash
autogherk generate --video ./recordings/checkout-flow.mp4
```

**Generate test scenarios from a URL:**

```bash
autogherk generate --video https://storage.example.com/demo.webm
```

**Generate a full build spec with design tokens and screenshots:**

```bash
autogherk generate --video demo.mp4 --format spec --output ./spec-output
```

**Quick surface-level spec (faster, lower cost):**

```bash
autogherk generate --video demo.mp4 --format spec --depth shallow
```

**Add application context for better results:**

```bash
autogherk generate --video demo.mp4 --context "This is a real estate brokerage management platform"
```

**Target a specific test framework:**

```bash
autogherk generate --video demo.mp4 --framework behave --output ./features/
```

## Output Formats

### Gherkin (default)

Generates `.feature` files with BDD scenarios and step definition stubs. Two-stage pipeline: Gemini analyzes the video, then Claude generates structured Gherkin.

```gherkin
@login @smoke
Feature: User Login
  Background:
    Given the user is on the login page

  Scenario: Successfully log in with valid credentials
    When the user enters their email and password
    And the user clicks the login button
    Then the user should be redirected to the dashboard

  Scenario Outline: Login with invalid credentials
    When the user enters <email> and <password>
    Then the user should see "<error_message>"

    Examples:
      | email            | password | error_message       |
      | invalid@test.com | wrong    | Invalid credentials |
      |                  | password | Email is required   |
```

### Spec (build blueprints)

Generates a complete application specification from the video. Single-stage pipeline: Gemini watches the video directly and produces architecture blueprints. Reference screenshots are extracted via ffmpeg.

**Output structure:**

```
spec-output/
  spec-overview.md        # Full architecture doc
  tokens.json             # Design tokens (plug into Tailwind/CSS vars)
  spec.json               # Raw structured JSON for programmatic use
  screenshots/            # One reference screenshot per screen
    login.png
    dashboard.png
    ...
  login.spec.md           # Per-screen spec with components + data model
  dashboard.spec.md
  ...
```

**What the spec captures:**

| Section | Details |
| --- | --- |
| **Design tokens** | Colors (including status/tag/chart colors), typography, spacing, border radius, shadows, layout dimensions |
| **Screens** | Route, layout, component tree, interactions, data requirements, reference screenshot |
| **Data model** | Entities, typed fields, enums with all values, foreign keys, relationships |
| **Navigation** | Screen-to-screen flows, triggers, role-based conditions |
| **Global components** | Sidebar, header, shared patterns (tables, cards, modals) |

**Deep mode** (default) produces exhaustive specs: every table column, form field validation, inferred modals/dialogs, empty/loading/error states, and screens that are logically implied but not shown in the video.

**Shallow mode** produces a lighter overview suitable for quick exploration.

### JSON

Outputs the raw Gherkin result as `scenarios.json` for programmatic consumption.

## How It Works

### Gherkin mode

```
  Video ──> Gemini (visual analysis) ──> Claude (BDD generation) ──> .feature files + stubs
```

1. **Gemini** uploads and analyzes the video frame-by-frame, extracting screens, interactions, and UI states. Works with silent videos.
2. **Claude** transforms the analysis into structured Gherkin scenarios with proper Given/When/Then, tags, Scenario Outlines, and edge cases.
3. **Formatter** writes `.feature` files and framework-specific step definition stubs.

### Spec mode

```
  Video ──> Gemini (architecture extraction) ──> spec files + screenshots
```

1. **Gemini** watches the video directly and generates the full build specification in a single pass -- design tokens, component trees, data models, navigation, and interactions.
2. **ffmpeg** extracts a reference screenshot for each screen at the timestamp Gemini identified.
3. **Formatter** writes markdown specs, `tokens.json`, per-screen files, and the raw `spec.json`.

Spec mode uses a single-stage pipeline (Gemini only) because it produces more accurate results when Gemini has direct visual context rather than working from a text summary.

## Configuration

Run `autogherk init` to generate a `.autogherkrc.json` file:

```json
{
  "geminiApiKey": "env:GEMINI_API_KEY",
  "anthropicApiKey": "env:ANTHROPIC_API_KEY",
  "geminiModel": "gemini-2.5-pro",
  "claudeModel": "claude-opus-4-6",
  "framework": "cucumber-js",
  "outputDir": "./features/",
  "language": "en",
  "generateStubs": true
}
```

### The `env:` prefix

Use the `env:` prefix to reference environment variables instead of hardcoding secrets into your config file. For example, `"env:GEMINI_API_KEY"` tells autogherk to read the value from the `GEMINI_API_KEY` environment variable at runtime.

### Resolution order

Configuration values are resolved in this order (highest priority first):

1. **Environment variables** -- `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_MODEL`, `CLAUDE_MODEL`
2. **CLI flags** -- `--framework`, `--output`, `--format`, `--depth`
3. **Config file** -- `.autogherkrc.json` (searched up from the current directory via [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig))

## Supported Frameworks

| Framework | Language | Stub File |
| --- | --- | --- |
| `cucumber-js` | TypeScript | `step_definitions/steps.ts` |
| `cucumber-java` | Java | `step_definitions/Steps.java` |
| `behave` | Python | `steps/steps.py` |
| `specflow` | C# | `StepDefinitions/Steps.cs` |

## Prerequisites

- **Node.js >= 22**
- **Gemini API key** -- Get one at [ai.google.dev](https://ai.google.dev/)
- **Anthropic API key** -- Get one at [console.anthropic.com](https://console.anthropic.com/) (required for Gherkin mode, not needed for spec mode)
- **ffmpeg** -- Required for screenshot extraction in spec mode. Install via `brew install ffmpeg` or your system package manager.

## Environment Variables

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Google Gemini API key | Yes | -- |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | Gherkin mode only | -- |
| `GEMINI_MODEL` | Gemini model to use for video analysis | No | `gemini-2.5-pro` |
| `CLAUDE_MODEL` | Claude model to use for Gherkin generation | No | `claude-opus-4-6` |

## Roadmap

- **Explore mode** — `autogherk explore --url <target> --auth-cookie <session>`. Point at a live authenticated app and it autonomously discovers screens, maps navigation, and generates `.feature` files. No video required.
- **Monitoring agent** — Replay `.feature` files against a live app on a schedule using Claude Code headless + Playwright MCP. Auto-file GitHub issues on regressions with screenshots and failure details.
- **Playwright test generation** — Generate executable `.spec.ts` files from `.feature` files, not just Gherkin stubs.
- **Feature diffing** — `autogherk diff --baseline ./old/ --current ./new/` for automatic UI changelogs.
- **Documentation generation** — Transform features into user guides and onboarding checklists.

See the [issues](https://github.com/arizqi/autogherk/issues) for what's actively being worked on.

## Contributing

Contributions are welcome. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

## License

[MIT](LICENSE)

## Acknowledgments

Built with [Google Gemini](https://ai.google.dev/) and [Anthropic Claude](https://www.anthropic.com/).
