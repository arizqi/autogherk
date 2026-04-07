---
name: autogherk
description: Generate BDD test scenarios or full build specs from a product usage video using AutoGherk
disable-model-invocation: false
argument-hint: "<video-path-or-url> [--format spec|gherkin] [--depth deep|shallow]"
allowed-tools: Read Bash Glob Grep
---

Generate test scenarios or build specifications from a product usage video.

## What you do

When invoked, parse the arguments to determine:
1. **Video source**: A file path or URL (required)
2. **Format**: `spec` (build blueprints) or `gherkin` (test scenarios, default)
3. **Depth**: `deep` (exhaustive, default) or `shallow` (surface-level) — only applies to spec format
4. **Output directory**: defaults to `./features/` for gherkin, `./spec-output/` for spec

## Steps

1. Verify the video file exists (if local path) or is a valid URL
2. Run the AutoGherk CLI:
   ```bash
   npx autogherk generate --video <source> --format <format> --depth <depth> --output <output-dir>
   ```
3. Wait for it to complete (this may take 2-5 minutes for longer videos)
4. Read and summarize the output:
   - **For gherkin**: Read the generated `.feature` files and summarize the scenarios
   - **For spec**: Read `spec-overview.md` and summarize the screens, data model, and design tokens found
5. Present the results to the user and ask if they want to refine anything

## Examples

User says: `/autogherk ./recordings/demo.mp4`
Action: Run `npx autogherk generate --video ./recordings/demo.mp4`

User says: `/autogherk https://storage.example.com/video.webm --format spec`
Action: Run `npx autogherk generate --video https://storage.example.com/video.webm --format spec --output ./spec-output/`

User says: "generate test scenarios from this video" (auto-triggered)
Action: Ask which video, then run autogherk in gherkin mode

## Notes

- Requires `GEMINI_API_KEY` environment variable (always needed)
- Requires `ANTHROPIC_API_KEY` environment variable (only for gherkin mode)
- Spec mode also extracts reference screenshots via ffmpeg
- Long videos (>5 min) will take longer and cost more API tokens
