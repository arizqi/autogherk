# Roadmap

This document outlines the planned development milestones for autogherk.

## v0.1.0 — MVP (Released)

- CLI with `generate` and `init` commands
- Single video input (local file or URL)
- Gemini video analysis (visual-first, works with silent recordings)
- Claude Gherkin generation with structured output
- .feature file output with proper Gherkin syntax
- Step definition stubs for Cucumber JS/Java, Behave, SpecFlow
- Verbose mode and dry-run support
- Config file support (.autogherkrc.json)

## v0.2.0 — Quality of Life

- Retry logic with exponential backoff for transient API failures
- Better error messages for common failure modes (missing keys, file not found, rate limits)
- Video duration warnings for long recordings
- Error classification for Gemini and Anthropic API responses

## v0.3.0 — Expanded Input

- Multiple video input (`--video a.mp4 --video b.mp4`)
- Directory input (`--video ./recordings/`)
- YouTube/Loom URL detection with helpful guidance
- Combined analysis across multiple videos

## v0.4.0 — Output Refinement

- Custom prompt injection (`--context` and `--context-file`)
- Append mode (`--append`) to add scenarios to existing .feature files
- JSON output format (`--format json`)

## v1.0.0 — Stable Release

- Programmatic API (`import { processVideo } from 'autogherk'`)
- Comprehensive test suite
- Stable config format
- Published to npm

## Future Ideas (Not Yet Planned)

These are ideas we're considering but haven't committed to. Contributions welcome.

- Interactive review mode (approve/edit scenarios before writing)
- Non-English Gherkin keyword support (`--language`)
- Upload progress bar for large videos
- Video chunking for recordings longer than 30 minutes
- Web UI for non-CLI users
- VS Code extension
- Diff mode (compare new scenarios against existing ones)
- Custom step definition templates
- Integration with CI/CD pipelines (generate tests on PR)
