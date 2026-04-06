# Seed Issues for Launch

Create these as GitHub issues after repo creation. Label all with `good first issue` and `help wanted`.

## 1. Add `--language` flag for non-English Gherkin keywords
**Labels**: `good first issue`, `help wanted`, `enhancement`, `area:cli`
**Description**: Gherkin supports [localized keywords](https://cucumber.io/docs/gherkin/reference/#spoken-languages) (e.g., French, Spanish, German). Add a `--language` flag that tells Claude to generate scenarios using the specified language's Gherkin keywords (Soit/Quand/Alors instead of Given/When/Then). The formatter should also output the localized keywords.

## 2. Add upload progress bar for large videos
**Labels**: `good first issue`, `help wanted`, `enhancement`, `area:gemini`
**Description**: When uploading large video files to the Gemini File API, there's no progress feedback beyond the spinner. Add a progress bar (using a library like `cli-progress`) that shows upload percentage based on bytes transferred.

## 3. Improve error message when video format is unsupported
**Labels**: `good first issue`, `help wanted`, `bug`, `area:cli`
**Description**: If a user passes a non-video file (e.g., `--video screenshot.png`), the error comes from Gemini and is cryptic. Add a pre-check that validates the file extension against supported formats (mp4, webm, mov, avi, mkv) before uploading.

## 4. Add `--tag` flag to filter generated scenarios by tag
**Labels**: `good first issue`, `help wanted`, `enhancement`, `area:output`
**Description**: Allow users to filter output by tag: `autogherk generate --video demo.mp4 --tag @smoke` would only output scenarios tagged with `@smoke`. Useful when you only want smoke tests from a recording.

## 5. Support `.gherkin.config.ts` TypeScript config format
**Labels**: `good first issue`, `help wanted`, `enhancement`, `area:cli`
**Description**: The tool currently supports `.autogherkrc.json` via cosmiconfig. Add support for a TypeScript config file (`.autogherk.config.ts`) that exports the config object. This gives users type safety and IDE autocomplete for config options.
