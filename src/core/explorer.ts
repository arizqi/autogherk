import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import ora from "ora";
import chalk from "chalk";
import type {
  ExploreOptions,
  ExplorationGraph,
  ScreenNode,
  Edge,
  DiscoveredInteraction,
} from "./types.js";
import {
  launchBrowser,
  injectAuth,
  interactiveLogin,
  hasSavedAuth,
  extractInteractions,
  takeScreenshot,
  fillFormFields,
  closeBrowser,
  type BrowserSession,
} from "./browser.js";
import { computeDomHash, normalizeUrlPattern, findMatchingScreen } from "./screen-identity.js";
import { createEmptyGraph, saveGraph, appendLog, loadGraph } from "./graph-store.js";
import { extractFlows, identifyCoverageGaps } from "./flow-extractor.js";
import { writeExploreOutput } from "../output/explore-writer.js";

interface BudgetCheck {
  exceeded: boolean;
  reason: string;
}

function checkBudget(
  graph: ExplorationGraph,
  options: ExploreOptions,
  startTime: number,
): BudgetCheck {
  const elapsed = Date.now() - startTime;
  if (elapsed >= options.maxTime) {
    return { exceeded: true, reason: `Time budget exceeded (${Math.round(elapsed / 1000)}s)` };
  }
  if (graph.nodes.size >= options.maxScreens) {
    return { exceeded: true, reason: `Screen budget exceeded (${graph.nodes.size} screens)` };
  }
  return { exceeded: false, reason: "" };
}

function generateEdgeId(from: string, interaction: DiscoveredInteraction): string {
  const key = `${from}|${interaction.selector}|${interaction.elementText}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}

function generateScreenId(domHash: string, urlPattern: string): string {
  const key = `${domHash}|${urlPattern}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}

/**
 * Capture the current page as a ScreenNode, deduplicating against existing graph nodes.
 * Returns the screen (existing or new) and whether it was newly created.
 */
async function captureScreen(
  page: import("playwright").Page,
  graph: ExplorationGraph,
  outputDir: string,
  baseUrl: string,
  skipPatterns: string[],
): Promise<{ screen: ScreenNode; isNew: boolean }> {
  const url = page.url();
  const title = await page.title();
  const domHash = await computeDomHash(page);
  const urlPattern = normalizeUrlPattern(url);

  const existing = findMatchingScreen(graph.nodes, { domHash, urlPattern });
  if (existing) {
    existing.visitCount++;
    existing.lastSeen = new Date().toISOString();
    return { screen: existing, isNew: false };
  }

  const id = generateScreenId(domHash, urlPattern);
  const interactions = await extractInteractions(page, baseUrl, skipPatterns);
  const screenshotPath = await takeScreenshot(page, outputDir, id);

  const screen: ScreenNode = {
    id,
    url,
    urlPattern,
    title,
    domHash,
    screenshotPath,
    interactions,
    visitCount: 1,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };

  graph.nodes.set(id, screen);
  return { screen, isNew: true };
}

/**
 * Phase 1: BFS screen discovery.
 * Follow navigation links (anchors with href) to map all reachable screens.
 */
async function discoverScreensBFS(
  session: BrowserSession,
  graph: ExplorationGraph,
  options: ExploreOptions,
  startTime: number,
  graphPath: string,
  logPath: string,
  spinner: ReturnType<typeof ora>,
): Promise<void> {
  const { page } = session;
  const queue: string[] = [options.url]; // URLs to visit
  const visitedUrls = new Set<string>();

  while (queue.length > 0) {
    const budget = checkBudget(graph, options, startTime);
    if (budget.exceeded) {
      await appendLog(`BFS stopped: ${budget.reason}`, logPath);
      break;
    }

    const url = queue.shift()!;
    const normalizedUrl = normalizeUrlPattern(url);
    if (visitedUrls.has(normalizedUrl)) continue;
    visitedUrls.add(normalizedUrl);

    spinner.text = `Discovering screens (${graph.nodes.size} found)... ${url}`;

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    } catch (err) {
      await appendLog(
        `Failed to navigate to ${url}: ${err instanceof Error ? err.message : "unknown"}`,
        logPath,
      );
      continue;
    }

    // Wait for SPA rendering — heavy apps like Jira need extra time
    await page.waitForTimeout(2000);

    // Log where we actually ended up (may have redirected)
    const actualUrl = page.url();
    if (actualUrl !== url) {
      await appendLog(`Redirected: ${url} → ${actualUrl}`, logPath);
      // If redirected to a login page, add that as the first screen
    }

    const { screen, isNew } = await captureScreen(
      page, graph, options.output, options.url, options.skipPatterns,
    );

    if (isNew) {
      await appendLog(
        `BFS: Discovered screen "${screen.title}" at ${screen.url} (${screen.id})`,
        logPath,
      );

      // Extract nav links to queue for BFS
      const navLinks = screen.interactions.filter(
        (i) => i.type === "navigate" && i.href && !i.isDestructive,
      );

      for (const link of navLinks) {
        if (link.href && !visitedUrls.has(normalizeUrlPattern(link.href))) {
          queue.push(link.href);
        }
      }

      // Add edges for all interactions found on this screen
      for (const interaction of screen.interactions) {
        const edgeId = generateEdgeId(screen.id, interaction);
        const exists = graph.edges.some((e) => e.id === edgeId);
        if (!exists) {
          graph.edges.push({
            id: edgeId,
            from: screen.id,
            to: null,
            interaction,
            status: interaction.isDestructive ? "destructive-skipped" : "unexplored",
            discovered: new Date().toISOString(),
          });
        }
      }

      // Persist graph after each new screen
      await saveGraph(graph, graphPath);
    }
  }
}

/**
 * Phase 2: DFS flow mapping.
 * For each screen, explore unexplored non-destructive interactions
 * to discover transitions and map complete flows.
 */
async function mapFlowsDFS(
  session: BrowserSession,
  graph: ExplorationGraph,
  options: ExploreOptions,
  startTime: number,
  graphPath: string,
  logPath: string,
  spinner: ReturnType<typeof ora>,
): Promise<void> {
  if (options.dryRun) {
    await appendLog("DFS skipped: dry-run mode", logPath);
    return;
  }

  const { page } = session;

  // Sort screens by number of unexplored edges (most first)
  const screenIds = Array.from(graph.nodes.keys()).sort((a, b) => {
    const aUnexplored = graph.edges.filter((e) => e.from === a && e.status === "unexplored").length;
    const bUnexplored = graph.edges.filter((e) => e.from === b && e.status === "unexplored").length;
    return bUnexplored - aUnexplored;
  });

  for (const screenId of screenIds) {
    const budget = checkBudget(graph, options, startTime);
    if (budget.exceeded) {
      await appendLog(`DFS stopped: ${budget.reason}`, logPath);
      break;
    }

    const screen = graph.nodes.get(screenId)!;
    const unexploredEdges = graph.edges.filter(
      (e) => e.from === screenId && e.status === "unexplored",
    );

    if (unexploredEdges.length === 0) continue;

    spinner.text = `Mapping flows on "${screen.title}" (${unexploredEdges.length} interactions)...`;

    // Navigate to the screen first
    try {
      await page.goto(screen.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(500);
    } catch {
      await appendLog(`DFS: Failed to navigate to ${screen.url}`, logPath);
      continue;
    }

    for (const edge of unexploredEdges) {
      const innerBudget = checkBudget(graph, options, startTime);
      if (innerBudget.exceeded) break;

      const interaction = edge.interaction;
      spinner.text = `Exploring "${interaction.elementText}" on "${screen.title}"...`;

      try {
        const beforeUrl = page.url();

        if (interaction.type === "fill" || interaction.type === "submit") {
          // Fill all form fields then submit
          await fillFormFields(page);
          // Try clicking submit or pressing enter
          const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
          if (await submitBtn.isVisible()) {
            await submitBtn.click({ timeout: 3000 });
          }
        } else if (interaction.type === "navigate" && interaction.href) {
          await page.goto(interaction.href, { waitUntil: "domcontentloaded", timeout: 30000 });
        } else {
          // Click the element
          try {
            await page.locator(interaction.selector).first().click({ timeout: 3000 });
          } catch {
            // Selector might be stale, try by text
            await page.getByText(interaction.elementText, { exact: false }).first().click({ timeout: 3000 });
          }
        }

        // Wait for any navigation or rendering
        await page.waitForTimeout(1000);

        // Capture where we ended up
        const afterUrl = page.url();
        const { screen: destScreen, isNew } = await captureScreen(
          page, graph, options.output, options.url, options.skipPatterns,
        );

        edge.to = destScreen.id;
        edge.status = "traversed";
        edge.gherkinStep = interactionToGherkinStep(interaction);

        await appendLog(
          `DFS: "${interaction.elementText}" on "${screen.title}" → "${destScreen.title}" (${isNew ? "new" : "existing"})`,
          logPath,
        );

        // If we landed on a new screen, add its edges too
        if (isNew) {
          for (const newInteraction of destScreen.interactions) {
            const newEdgeId = generateEdgeId(destScreen.id, newInteraction);
            if (!graph.edges.some((e) => e.id === newEdgeId)) {
              graph.edges.push({
                id: newEdgeId,
                from: destScreen.id,
                to: null,
                interaction: newInteraction,
                status: newInteraction.isDestructive ? "destructive-skipped" : "unexplored",
                discovered: new Date().toISOString(),
              });
            }
          }
        }

        // Navigate back to continue exploring this screen
        if (afterUrl !== beforeUrl) {
          await page.goto(screen.url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(500);
        }
      } catch (err) {
        edge.status = "dead-end";
        await appendLog(
          `DFS: Dead end — "${interaction.elementText}" on "${screen.title}": ${err instanceof Error ? err.message : "unknown error"}`,
          logPath,
        );

        // Try to recover by navigating back to the screen
        try {
          await page.goto(screen.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        } catch {
          // If we can't get back, move to the next screen
          break;
        }
      }

      // Persist after each interaction
      await saveGraph(graph, graphPath);
    }
  }
}

function interactionToGherkinStep(interaction: DiscoveredInteraction): string {
  switch (interaction.type) {
    case "click":
      return `I click "${interaction.elementText}"`;
    case "navigate":
      return `I navigate to "${interaction.elementText}"`;
    case "fill":
      return `I fill in the "${interaction.elementText}" field`;
    case "submit":
      return `I submit the form`;
    case "select":
      return `I select from "${interaction.elementText}"`;
    default:
      return `I interact with "${interaction.elementText}"`;
  }
}

/**
 * Main exploration pipeline.
 * BFS to discover all screens, then DFS to map interactions and flows.
 * Generates Gherkin feature files from the resulting graph.
 */
export async function runExploration(options: ExploreOptions): Promise<void> {
  const spinner = ora();
  const startTime = Date.now();

  // Validate output directory
  const resolvedOutput = resolve(options.output);
  const cwd = resolve(process.cwd());
  if (!resolvedOutput.startsWith(cwd)) {
    throw new Error(`Output directory must be within the current working directory. Got: ${options.output}`);
  }

  await mkdir(options.output, { recursive: true });

  const graphPath = join(options.output, "exploration-graph.json");
  const logPath = join(options.output, "exploration.log");

  // Try to resume from existing graph
  let graph = await loadGraph(graphPath);
  const resuming = graph !== null;
  if (!graph) {
    graph = createEmptyGraph(options.url);
  }

  let session: BrowserSession | undefined;

  try {
    // Handle interactive login if requested
    if (options.auth?.type === "interactive") {
      await interactiveLogin(options.url);
    }

    // Launch browser (loads saved auth state if available)
    spinner.start("Launching browser...");
    const savedAuth = await hasSavedAuth(options.url);
    session = await launchBrowser(options.url);
    if (savedAuth) {
      spinner.succeed("Browser launched (using saved auth)");
    } else {
      spinner.succeed("Browser launched");
    }

    // Inject explicit auth (cookie/token/login) if provided
    if (options.auth && options.auth.type !== "interactive") {
      spinner.start("Authenticating...");
      await injectAuth(session, options.auth, options.url);
      spinner.succeed("Authentication injected");
    }

    if (resuming) {
      const gaps = identifyCoverageGaps(graph);
      spinner.info(
        `Resuming exploration: ${graph.nodes.size} screens, ${gaps.unexploredEdges.length} unexplored edges`,
      );
      await appendLog("Resumed exploration from saved graph", logPath);
    } else {
      await appendLog(`Starting exploration of ${options.url}`, logPath);
    }

    // Phase 1: BFS screen discovery
    spinner.start("Phase 1: Discovering screens (BFS)...");
    await discoverScreensBFS(session, graph, options, startTime, graphPath, logPath, spinner);
    spinner.succeed(`Phase 1 complete: ${graph.nodes.size} screen(s) discovered`);

    // Phase 2: DFS flow mapping
    const unexploredCount = graph.edges.filter((e) => e.status === "unexplored").length;
    if (unexploredCount > 0) {
      spinner.start(`Phase 2: Mapping flows (DFS)... ${unexploredCount} interactions to explore`);
      await mapFlowsDFS(session, graph, options, startTime, graphPath, logPath, spinner);
      const traversed = graph.edges.filter((e) => e.status === "traversed").length;
      spinner.succeed(`Phase 2 complete: ${traversed} flow(s) mapped`);
    } else {
      spinner.info("Phase 2 skipped: no unexplored interactions");
    }

    // Phase 3: Generate features from graph
    spinner.start("Phase 3: Generating feature files from graph...");

    // This is the recursive part — extractFlows reads the graph (which was built
    // using its own prior feature structure as coverage guidance)
    const features = extractFlows(graph);

    // Update graph metadata
    graph.metadata.endTime = new Date().toISOString();
    const budget = checkBudget(graph, options, startTime);
    graph.metadata.status = budget.exceeded ? "budget-exceeded" : "completed";

    // Write all output
    const result = await writeExploreOutput(
      graph,
      features,
      options.output,
      options.dryRun,
      (_stage, msg) => { spinner.text = msg; },
    );

    spinner.succeed("Exploration complete");

    // Summary
    const traversed = graph.edges.filter((e) => e.status === "traversed").length;
    const totalEdges = graph.edges.length;
    const coverage = totalEdges > 0 ? Math.round((traversed / totalEdges) * 100) : 0;

    console.log("");
    console.log(chalk.green(`✓ Explored ${graph.nodes.size} screen(s), ${traversed}/${totalEdges} interactions (${coverage}% coverage)`));
    console.log(chalk.green(`✓ Generated ${result.featureFiles.length} feature file(s)`));
    for (const f of result.featureFiles) {
      console.log(chalk.dim(`  ${f}`));
    }
    console.log(chalk.dim(`  Graph: ${result.graphFile}`));
    for (const f of result.reportFiles) {
      console.log(chalk.dim(`  ${f}`));
    }

    const gaps = identifyCoverageGaps(graph);
    if (gaps.unexploredEdges.length > 0) {
      console.log(
        chalk.yellow(`\n⚠ ${gaps.unexploredEdges.length} interaction(s) unexplored. Run again to continue.`),
      );
    }

    await appendLog(
      `Exploration finished: ${graph.nodes.size} screens, ${traversed} traversed, ${coverage}% coverage`,
      logPath,
    );
  } catch (error) {
    graph.metadata.status = "error";
    graph.metadata.endTime = new Date().toISOString();
    await saveGraph(graph, graphPath);
    await appendLog(`Error: ${error instanceof Error ? error.message : "unknown"}`, logPath);

    spinner.fail(error instanceof Error ? error.message : "An unknown error occurred");
    process.exit(1);
  } finally {
    if (session) {
      await closeBrowser(session);
    }
  }
}
