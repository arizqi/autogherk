import { createHash } from "node:crypto";
import type { Page } from "playwright";
import type { ScreenNode } from "./types.js";

/**
 * Max screen-node variants allowed per URL pattern. Beyond this, new
 * captures merge into the closest existing node instead of minting another —
 * prevents dynamic-list pages (feeds, item pages) from exploding the graph
 * with one node per data variation.
 */
const MAX_VARIANTS_PER_URL_PATTERN = 3;

/**
 * Compute a structural hash of the DOM — strips text content and dynamic
 * attributes, keeping only tag hierarchy and semantic attributes (role, type).
 *
 * Repetition-invariant: runs of identical siblings collapse to a single
 * representative with a `+` marker, so a list with 30 rows and the same list
 * with 31 rows produce the same hash. Without this, every data variation of
 * a screen mints a new "screen" and coverage collapses.
 */
export async function computeDomHash(page: Page): Promise<string> {
  const structure = await page.evaluate(() => {
    function walk(el: Element, depth: number): string {
      if (depth > 15) return ""; // prevent infinite recursion
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute("role") ?? "";
      const type = el.getAttribute("type") ?? "";
      const parts = [tag, role, type].filter(Boolean).join(":");

      // Collapse runs of structurally-identical siblings: [a,a,a,b,a] → [a+,b,a]
      const childSigs: string[] = [];
      for (const child of Array.from(el.children)) {
        const sig = walk(child, depth + 1);
        if (!sig) continue;
        const prev = childSigs[childSigs.length - 1];
        if (prev === sig || prev === `${sig}+`) {
          childSigs[childSigs.length - 1] = `${sig}+`;
        } else {
          childSigs.push(sig);
        }
      }

      return childSigs.length ? `${parts}(${childSigs.join(",")})` : parts;
    }
    return walk(document.body, 0);
  });

  return createHash("sha256").update(structure).digest("hex").slice(0, 16);
}

/**
 * Normalize a URL by replacing dynamic segments (UUIDs, numeric IDs) with placeholders.
 * /users/abc-123-def/posts/42?page=3 → /users/:id/posts/:id
 */
export function normalizeUrlPattern(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname
      .split("/")
      .map((seg) => {
        if (!seg) return seg;
        // UUID pattern
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ":id";
        // Numeric ID
        if (/^\d+$/.test(seg)) return ":id";
        // Short hex ID (like MongoDB ObjectId)
        if (/^[0-9a-f]{12,}$/i.test(seg)) return ":id";
        return seg;
      });
    return parsed.origin + segments.join("/");
  } catch {
    return url;
  }
}

/**
 * Check if a candidate screen matches an existing node by hash + URL pattern.
 */
export function isSameScreen(
  existing: ScreenNode,
  candidate: { domHash: string; urlPattern: string },
): boolean {
  return existing.domHash === candidate.domHash && existing.urlPattern === candidate.urlPattern;
}

/**
 * Find an existing screen node that matches the candidate.
 *
 * Match order:
 * 1. Exact: same domHash + same urlPattern.
 * 2. Variant cap: if MAX_VARIANTS_PER_URL_PATTERN nodes already share the
 *    candidate's urlPattern, return the one with the closest hash instead of
 *    allowing a new node — bounds graph growth on dynamic pages.
 */
export function findMatchingScreen(
  nodes: Map<string, ScreenNode>,
  candidate: { domHash: string; urlPattern: string },
): ScreenNode | undefined {
  const samePattern: ScreenNode[] = [];

  for (const node of nodes.values()) {
    if (isSameScreen(node, candidate)) return node;
    if (node.urlPattern === candidate.urlPattern) samePattern.push(node);
  }

  if (samePattern.length >= MAX_VARIANTS_PER_URL_PATTERN) {
    // Cap reached — merge into the most-visited existing variant
    return samePattern.reduce((best, n) =>
      n.visitCount > best.visitCount ? n : best,
    );
  }

  return undefined;
}
