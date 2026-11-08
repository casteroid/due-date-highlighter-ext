import type { SiteRule } from "./types";

const escapeRegex = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
const glob = (pattern: string) => new RegExp(`^${escapeRegex(pattern).replaceAll("*", ".*")}`);

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

const isUrlPrefix = (pattern: string) => pattern.includes("://");

/**
 * Domain patterns: `example.com` matches that host only, `*.example.com` matches the apex and every subdomain,
 * a port (`localhost:8080`) narrows to that port. URL patterns are prefixes of origin + path; query and hash are ignored.
 */
export function matchesPattern(rawPattern: string, url: string): boolean {
  const parsed = parseUrl(url);
  const pattern = rawPattern.trim();
  if (!parsed || !pattern) return false;

  if (isUrlPrefix(pattern)) return glob(pattern).test(parsed.origin + parsed.pathname);

  const domain = pattern.toLowerCase();
  const host = domain.includes(":") ? parsed.host : parsed.hostname;
  if (domain.startsWith("*.") && !domain.slice(2).includes("*")) {
    const apex = domain.slice(2);
    return host === apex || host.endsWith(`.${apex}`);
  }
  return domain.includes("*") ? new RegExp(`${glob(domain).source}$`).test(host) : host === domain;
}

export function specificity(pattern: string): number {
  return pattern.trim().replaceAll("*", "").length;
}

/** The enabled rule with the most specific matching pattern; ties go to the earliest rule. */
export function findMatchingRule(rules: SiteRule[], url: string): SiteRule | undefined {
  let best: SiteRule | undefined;
  for (const rule of rules) {
    if (!rule.enabled || !matchesPattern(rule.pattern, url)) continue;
    if (!best || specificity(rule.pattern) > specificity(best.pattern)) best = rule;
  }
  return best;
}

type ChromePattern = { scheme: string; host: string; path: string };

const HOST = /^(\*|(?:\*\.)?[^*/:]+)(:\d+)?$/;

function toChromeParts(rawPattern: string): ChromePattern | null {
  const pattern = rawPattern.trim();
  if (!pattern) return null;
  if (!isUrlPrefix(pattern)) {
    const host = pattern.toLowerCase();
    return HOST.test(host) && host !== "*" ? { scheme: "*", host, path: "/*" } : null;
  }
  const m = /^(https?|\*):\/\/([^/]+)(\/.*)?$/i.exec(pattern);
  if (!m || !HOST.test(m[2]!.toLowerCase())) return null;
  const path = m[3] ?? "/";
  return { scheme: m[1]!.toLowerCase(), host: m[2]!.toLowerCase(), path: path.endsWith("*") ? path : `${path}*` };
}

/** Chrome match pattern for `scripting.registerContentScripts`, or null if the rule cannot be expressed as one. */
export function toMatchPattern(pattern: string): string | null {
  const parts = toChromeParts(pattern);
  return parts && `${parts.scheme}://${parts.host}${parts.path}`;
}

/** Host-permission origin a rule needs. */
export function toOrigin(pattern: string): string | null {
  const parts = toChromeParts(pattern);
  return parts && `${parts.scheme}://${parts.host}/*`;
}

function parseOrigin(origin: string): { scheme: string; host: string; port: string | null } | null {
  const m = /^([^:/]+):\/\/([^/:]+)(?::(\d+|\*))?\//.exec(origin);
  return m ? { scheme: m[1]!, host: m[2]!, port: m[3] ?? null } : null;
}

/**
 * Whether a granted host-permission origin (`scheme://host/*` or `<all_urls>`) covers the origin a rule needs.
 * Chrome treats a host without a port as matching every port.
 */
export function originCovers(granted: string, needed: string): boolean {
  if (granted === "<all_urls>") return true;
  const g = parseOrigin(granted);
  const n = parseOrigin(needed);
  if (!g || !n) return false;
  if (g.scheme === "*" ? !["*", "http", "https"].includes(n.scheme) : g.scheme !== n.scheme) return false;
  if (g.port !== null && g.port !== "*" && g.port !== n.port) return false;
  if (g.host === "*") return true;
  if (g.host.startsWith("*.")) {
    const apex = g.host.slice(2);
    const host = n.host.startsWith("*.") ? n.host.slice(2) : n.host;
    return host === apex || host.endsWith(`.${apex}`);
  }
  return g.host === n.host;
}

export function sitePatternForTab(url: string): string {
  return new URL(url).hostname;
}

export function pagePatternForTab(url: string): string {
  const u = new URL(url);
  return u.origin + u.pathname;
}

export function isSupportedUrl(url: string): boolean {
  const u = parseUrl(url);
  return u !== null && (u.protocol === "http:" || u.protocol === "https:");
}
