const DESTRUCTIVE_TEXT_PATTERNS = [
  "delete",
  "remove",
  "destroy",
  "deactivate",
  "disable",
  "cancel subscription",
  "close account",
  "logout",
  "log out",
  "sign out",
  "payment",
  "purchase",
  "checkout",
  "buy now",
  "place order",
  "confirm order",
  "export all",
  "drop",
  "reset",
  "unsubscribe",
];

const DESTRUCTIVE_URL_PATTERNS = [
  "accounts.google.com",
  "auth0.com",
  "login.microsoftonline.com",
  "cognito",
  "oauth",
  "mailto:",
  "tel:",
  "javascript:",
];

export function isDestructiveAction(
  elementText: string,
  elementRole: string,
  href: string | undefined,
  customSkipPatterns: string[] = [],
): boolean {
  const text = elementText.toLowerCase().trim();
  const allPatterns = [...DESTRUCTIVE_TEXT_PATTERNS, ...customSkipPatterns];

  for (const pattern of allPatterns) {
    if (text.includes(pattern.toLowerCase())) return true;
  }

  if (href) {
    for (const pattern of DESTRUCTIVE_URL_PATTERNS) {
      if (href.toLowerCase().includes(pattern)) return true;
    }
  }

  return false;
}

export function isExternalLink(href: string, baseUrl: string): boolean {
  try {
    const linkOrigin = new URL(href, baseUrl).origin;
    const baseOrigin = new URL(baseUrl).origin;
    return linkOrigin !== baseOrigin;
  } catch {
    return true; // malformed URL = skip
  }
}
