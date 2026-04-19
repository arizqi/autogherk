import { createHash } from "node:crypto";
import type { Page } from "playwright";
import type { ScreenNode } from "./types.js";

/**
 * Compute a structural hash of the DOM — strips text content and dynamic attributes,
 * keeping only tag hierarchy and semantic attributes (role, type, name).
 * Two pages with the same layout but different data produce the same hash.
 */
export async function computeDomHash(page: Page): Promise<string> {
  const structure = await page.evaluate(() => {
    function walk(el: Element, depth: number): string {
      if (depth > 15) return ""; // prevent infinite recursion
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute("role") ?? "";
      const type = el.getAttribute("type") ?? "";
      const parts = [tag, role, type].filter(Boolean).join(":");
      const children = Array.from(el.children)
        .map((child) => walk(child, depth + 1))
        .filter(Boolean)
        .join(",");
      return children ? `${parts}(${children})` : parts;
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
 * Find an existing screen node that matches the candidate, if any.
 */
export function findMatchingScreen(
  nodes: Map<string, ScreenNode>,
  candidate: { domHash: string; urlPattern: string },
): ScreenNode | undefined {
  for (const node of nodes.values()) {
    if (isSameScreen(node, candidate)) return node;
  }
  return undefined;
}
