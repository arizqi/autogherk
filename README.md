# AutoGherk

Generate BDD Gherkin test scenarios from product usage videos using AI.

[![npm version](https://img.shields.io/npm/v/autogherk)](https://www.npmjs.com/package/autogherk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![CI](https://github.com/arizqi/autogherk/actions/workflows/ci.yml/badge.svg)](https://github.com/arizqi/autogherk/actions)

---

Turn any screen recording into structured test scenarios that AI agents can execute. **AutoGherk** watches how your product is used and generates `.feature` files that power agents to mimic real users, find issues before your customers do, and enable self-healing test systems. Product managers ship faster when AI agents can instantly learn new workflows from a video -- no manual test writing, no brittle scripts. Under the hood, Google Gemini performs frame-by-frame visual analysis of the recording, then Anthropic Claude transforms that into structured, well-organized Gherkin scenarios ready for agent execution.

## Demo

```
$ autogherk generate --video recording.webm --output ./features/

✔ Configuration loaded
✔ Downloaded video from URL
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

## Quick Start

```bash
# Set your API keys
export GEMINI_API_KEY=your-key
export ANTHROPIC_API_KEY=your-key

# Run it
npx autogherk generate --video demo.mp4
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

Generate Gherkin scenarios from a product usage video.

```
autogherk generate [options]
```

| Flag | Description | Default |
| --- | --- | --- |
| `-v, --video <path>` | Input video file path or URL (required) | -- |
| `-o, --output <dir>` | Output directory for generated files | `./features/` |
| `-f, --framework <name>` | Target framework (`cucumber-js`, `cucumber-java`, `behave`, `specflow`) | `cucumber-js` |
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

**Basic usage with a local file:**

```bash
autogherk generate --video ./recordings/checkout-flow.mp4
```

**Using a URL:**

```bash
autogherk generate --video https://storage.example.com/demo.webm
```

**Targeting a specific framework:**

```bash
autogherk generate --video demo.mp4 --framework behave --output ./features/
```

**Verbose mode (inspect the Gemini analysis):**

```bash
autogherk generate --video demo.mp4 --verbose
```

**Dry run (preview without writing files):**

```bash
autogherk generate --video demo.mp4 --dry-run
```

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
2. **CLI flags** -- `--framework`, `--output`
3. **Config file** -- `.autogherkrc.json` (searched up from the current directory via [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig))

## Supported Frameworks

| Framework | Language | Stub File |
| --- | --- | --- |
| `cucumber-js` | TypeScript | `step_definitions/steps.ts` |
| `cucumber-java` | Java | `step_definitions/Steps.java` |
| `behave` | Python | `steps/steps.py` |
| `specflow` | C# | `StepDefinitions/Steps.cs` |

## How It Works

```
                 +------------------+
  Video file     |   Stage 1        |
  or URL    ---->|   Gemini         |----> Structured JSON analysis
                 |   (visual AI)    |      (screens, interactions, transcript)
                 +------------------+
                          |
                          v
                 +------------------+
                 |   Stage 2        |
                 |   Claude         |----> GherkinResult (features, scenarios, steps)
                 |   (BDD expert)   |
                 +------------------+
                          |
                          v
                 +------------------+
                 |   Stage 3        |
                 |   Output         |----> .feature files + step definition stubs
                 |   (formatter)    |
                 +------------------+
```

**Stage 1 -- Gemini video analysis.** The video is uploaded to Google Gemini, which performs frame-by-frame visual analysis. It extracts every click, form input, navigation, scroll, and UI state change it can observe. This works with silent videos -- no audio or voiceover is required.

**Stage 2 -- Claude scenario generation.** The structured analysis from Stage 1 is sent to Anthropic Claude, which acts as an expert BDD test engineer. It groups interactions into logical features, writes declarative Given/When/Then scenarios, applies tags, uses Scenario Outlines where appropriate, and covers edge cases.

**Stage 3 -- File output.** The generated Gherkin is formatted into standard `.feature` files and written to disk. Step definition stubs are also generated for the target framework, giving you a ready-to-implement starting point.

## Example Output

```gherkin
@login @smoke
Feature: User Login
  Users should be able to log in with valid credentials
  and see appropriate errors for invalid attempts.

  Background:
    Given the user is on the login page

  @happy-path
  Scenario: Successfully log in with valid credentials
    Given the user has a registered account
    When the user enters their email and password
    And the user clicks the login button
    Then the user should be redirected to the dashboard
    And the user should see a welcome message

  @negative
  Scenario Outline: Login with invalid credentials
    When the user enters <email> and <password>
    And the user clicks the login button
    Then the user should see "<error_message>"

    Examples:
      | email            | password | error_message       |
      | invalid@test.com | wrong    | Invalid credentials |
      |                  | password | Email is required   |
```

## API Keys

autogherk requires API keys from both Google and Anthropic:

- **Gemini API key** -- Get one at [ai.google.dev](https://ai.google.dev/)
- **Anthropic API key** -- Get one at [console.anthropic.com](https://console.anthropic.com/)

## Environment Variables

| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Google Gemini API key | Yes | -- |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | Yes | -- |
| `GEMINI_MODEL` | Gemini model to use for video analysis | No | `gemini-2.5-pro` |
| `CLAUDE_MODEL` | Claude model to use for Gherkin generation | No | `claude-opus-4-6` |

## Contributing

Contributions are welcome. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

## License

[MIT](LICENSE)

## Acknowledgments

Built with [Google Gemini](https://ai.google.dev/) and [Anthropic Claude](https://www.anthropic.com/).
