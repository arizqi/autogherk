import { Command } from "commander";
import type { ExploreOptions, AuthStrategy } from "../../core/types.js";
import { runExploration } from "../../core/explorer.js";

function parseTime(value: string): number {
  const match = value.match(/^(\d+)(s|m|h)$/);
  if (!match) throw new Error(`Invalid time format: "${value}". Use e.g. 30s, 10m, 1h`);
  const num = parseInt(match[1], 10);
  switch (match[2]) {
    case "s": return num * 1000;
    case "m": return num * 60 * 1000;
    case "h": return num * 60 * 60 * 1000;
    default: return num * 60 * 1000;
  }
}

export const exploreCommand = new Command("explore")
  .description("Autonomously discover user flows in a live web app and generate feature files")
  .requiredOption("--url <url>", "Target web app URL to explore")
  .option("-o, --output <dir>", "Output directory", "./explored-features/")
  .option("--login", "Log in interactively — opens a browser, you sign in, session is saved for future runs")
  .option("--auth-cookie <value>", 'Auth cookie string (e.g. "session=abc123")')
  .option("--auth-token <value>", "Bearer token for token-based auth")
  .option("--max-depth <n>", "Maximum navigation depth", "5")
  .option("--max-time <duration>", "Time budget (e.g. 30s, 10m, 1h)", "10m")
  .option("--max-screens <n>", "Maximum number of screens to discover", "50")
  .option("--dry-run", "Observe only — navigate but don't click interactions", false)
  .option("--skip-patterns <patterns...>", "Additional text patterns to skip (treated as destructive)")
  .option("--verbose", "Show detailed exploration progress", false)
  .option("--context <text>", "Additional context about the app")
  .option(
    "--lens <names>",
    "Lens(es) to shape exploration priority and scenario output — one of qa, designer, growth, security, support, pm, a11y, or a custom lens. Multiple comma-separated.",
  )
  .option("-c, --config <path>", "Path to config file")
  .action(async (opts) => {
    // Build auth strategy from flags
    let auth: AuthStrategy | undefined;
    if (opts.login) {
      auth = { type: "interactive" };
    } else if (opts.authCookie) {
      auth = { type: "cookie", cookie: opts.authCookie };
    } else if (opts.authToken) {
      auth = { type: "token", token: opts.authToken };
    }

    const options: ExploreOptions = {
      url: opts.url,
      output: opts.output,
      auth,
      maxDepth: parseInt(opts.maxDepth, 10),
      maxTime: parseTime(opts.maxTime),
      maxScreens: parseInt(opts.maxScreens, 10),
      dryRun: opts.dryRun,
      verbose: opts.verbose,
      skipPatterns: opts.skipPatterns ?? [],
      config: opts.config,
      context: opts.context,
      lens: opts.lens,
    };

    await runExploration(options);
  });
