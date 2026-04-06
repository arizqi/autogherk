# Contributing to autogherk

Thank you for your interest in contributing to autogherk! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v22 or later
- [pnpm](https://pnpm.io/) v10 or later

### Getting Started

1. Fork the repository and clone your fork:

   ```bash
   git clone https://github.com/<your-username>/autogherk.git
   cd autogherk
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Build the project:

   ```bash
   pnpm build
   ```

4. Run in watch mode during development:

   ```bash
   pnpm dev
   ```

5. Run tests:

   ```bash
   pnpm test
   ```

6. Run the linter (TypeScript type-checking):

   ```bash
   pnpm lint
   ```

## Code Style

- **TypeScript strict mode** is enabled. All code must pass strict type-checking.
- The project uses **ESM modules** (`"type": "module"` in package.json). Use `import`/`export` syntax, not `require`.
- Follow [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `test:` for adding or updating tests
  - `refactor:` for code refactoring
  - `chore:` for maintenance tasks

## Pull Request Process

1. Fork the repository and create a feature branch from `main`:

   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes, ensuring all tests and linting pass:

   ```bash
   pnpm lint
   pnpm test
   ```

3. Commit your changes using conventional commit messages.

4. Push your branch and open a Pull Request against `main`.

5. Fill out the PR template and wait for review.

## Testing Guidelines

- **Unit tests are strongly preferred** for pull requests. They run quickly and do not require any external services.
- E2E tests that call Gemini or Claude APIs **require valid API keys and cost real money** to run. Please do not add E2E tests unless absolutely necessary, and never include API keys in your commits.
- If your change involves AI provider integration, add unit tests with mocked API responses.
- Run the full test suite before submitting:

  ```bash
  pnpm test
  ```

## Reporting Issues

Please use the GitHub issue templates for bug reports and feature requests. Include as much detail as possible to help us reproduce and understand the issue.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
