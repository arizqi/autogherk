import type { Framework } from "../core/types.js";

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
