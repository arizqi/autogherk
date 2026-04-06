@cli @smoke
Feature: AutoGherk CLI
  As a QA engineer, I want to generate Gherkin scenarios from product usage
  videos so that I can quickly create BDD test coverage without manual effort.

  Background:
    Given the user has valid Gemini and Anthropic API keys configured

  @happy-path
  Scenario: Generate Gherkin from a local video file
    Given a product usage video exists at "demo.mp4"
    When the user runs "autogherk generate --video demo.mp4 --output ./features/"
    Then .feature files should be written to the "./features/" directory
    And each feature file should contain valid Gherkin syntax
    And the output should include a summary of features and scenarios generated

  @happy-path
  Scenario: Generate Gherkin from a URL
    Given a product usage video is hosted at a public URL
    When the user runs "autogherk generate --video https://example.com/demo.mp4"
    Then the video should be downloaded to a temporary file
    And the video should be processed through the Gemini and Claude pipeline
    And .feature files should be written to the default output directory

  @silent-video
  Scenario: Generate Gherkin from a silent screen recording
    Given a product usage video with no audio or voiceover exists at "silent-demo.mp4"
    When the user runs "autogherk generate --video silent-demo.mp4"
    Then the Gemini analysis should extract interactions purely from visual frame analysis
    And the generated scenarios should accurately reflect the observed user workflow

  @verbose
  Scenario: Verbose mode shows intermediate Gemini analysis
    Given a product usage video exists at "demo.mp4"
    When the user runs "autogherk generate --video demo.mp4 --verbose"
    Then the intermediate Gemini video analysis JSON should be printed to stdout
    And .feature files should still be written to the output directory

  @dry-run
  Scenario: Dry run previews output without writing files
    Given a product usage video exists at "demo.mp4"
    When the user runs "autogherk generate --video demo.mp4 --dry-run"
    Then no files should be written to disk
    And the output should show what files would have been created

  @stubs
  Scenario Outline: Generate step definition stubs for target framework
    Given a product usage video exists at "demo.mp4"
    When the user runs "autogherk generate --video demo.mp4 --framework <framework>"
    Then step definition stubs should be generated for <framework>
    And the stubs should use <language> conventions

    Examples:
      | framework     | language   |
      | cucumber-js   | TypeScript |
      | cucumber-java | Java       |
      | behave        | Python     |
      | specflow      | C#         |

  @save-analysis
  Scenario: Save raw Gemini analysis to file
    Given a product usage video exists at "demo.mp4"
    When the user runs "autogherk generate --video demo.mp4 --save-analysis"
    Then an "analysis.json" file should be written to the output directory
    And it should contain the structured video analysis from Gemini

@config
Feature: Configuration Management
  As a user, I want to configure AutoGherk with my API keys and preferences
  so that I don't need to pass them as flags every time.

  Scenario: Initialize config file
    Given no .autogherkrc.json exists in the current directory
    When the user runs "autogherk init"
    Then a .autogherkrc.json file should be created
    And it should contain placeholder values for API keys using "env:" prefix

  Scenario: Do not overwrite existing config
    Given a .autogherkrc.json already exists in the current directory
    When the user runs "autogherk init"
    Then the existing config file should not be modified
    And the user should be informed that the config already exists

  @negative
  Scenario: Missing API keys shows helpful error
    Given no API keys are configured
    When the user runs "autogherk generate --video demo.mp4"
    Then the tool should exit with a clear error message
    And the error should explain how to set API keys via env vars or config file

@input-validation
Feature: Input Validation
  As a user, I want clear error messages when I provide invalid input.

  @negative
  Scenario: Video file does not exist
    When the user runs "autogherk generate --video nonexistent.mp4"
    Then the tool should exit with an error indicating the file was not found

  @negative
  Scenario: Invalid video URL
    When the user runs "autogherk generate --video https://example.com/404"
    Then the tool should exit with an error about the failed download

  @negative
  Scenario: No video flag provided
    When the user runs "autogherk generate"
    Then the tool should exit with an error indicating --video is required
