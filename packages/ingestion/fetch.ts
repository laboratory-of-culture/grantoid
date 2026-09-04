/**
 * The only place this product makes an outbound request to a donor site.
 *
 * Both current sources are small Ukrainian NGO portals running on modest
 * infrastructure, several of them wartime-strained. Being a considerate client
 * is not politeness here — it is the difference between being tolerated and
 * being blocked, and a blocked source is a feed that quietly stops filling.
 */

export const DEFAULT_USER_AGENT =
  "GrantAssistantBot/0.1 (+https://grant-assistant.org.ua/bot; bot@grant-assistant.org.ua)";

import { assertFetchableUrl, UnsafeTarget } from "./ssrf";

export class FetchRefused extends Error {}

/** Per-host timestamps of the last request, for the rate limiter. */
const lastRequestAt = new Map<string, number>();

/** Redirect hops to follow before giving up — enough for the usual www/HTTPS
 *  bounce, few enough that a redirect loop cannot spin. */
const MAX_REDIRECTS = 5;

export type FetchOptions = {
  userAgent?: string;
  /** Requests per minute for this host. */
  rateLimitPerMin?: number;
  timeoutMs?: number;
};

/**
 * Fetch a URL, spacing requests per host.
 *
 * The spacing is per host rather than per source because two sources can share
 * a host, and the host is what feels the load.
 */
export async function politeFetch(
  url: string,
  opts: FetchOptions = {},
): Promise<{ status: number; body: string; contentType: string | null }> {
  const rate = Math.max(1, opts.rateLimitPerMin ?? 10);
  const minGapMs = 60_000 / rate;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);

  // Redirects are followed by hand — `redirect: "follow"` would let a public
  // host bounce us to an internal one without the SSRF guard ever seeing the
  // second URL. Each hop is rate-limited by its own host and re-validated.
  let current = url;
  try {
    for (let hop = 0; ; hop++) {
      await assertFetchableUrl(current);

      const host = new URL(current).host;
      const previous = lastRequestAt.get(host);
      if (previous !== undefined) {
        const wait = previous + minGapMs - Date.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      }
      lastRequestAt.set(host, Date.now());

      const response = await fetch(current, {
        headers: {
          // Identifying the crawler and giving a contact address is what lets a
          // site owner complain instead of silently blocking. prostir.ua returns
          // 403 to an unidentified client, which is how this was discovered.
          "User-Agent": opts.userAgent ?? DEFAULT_USER_AGENT,
          Accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.9",
          "Accept-Language": "uk,en;q=0.8",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        if (hop >= MAX_REDIRECTS) {
          throw new FetchRefused(`${url}: забагато перенаправлень`);
        }
        // Resolve a relative Location against the URL that issued it, then loop
        // back to the top where the new target is validated before we touch it.
        current = new URL(location, current).toString();
        continue;
      }

      const body = await response.text();
      return {
        status: response.status,
        body,
        contentType: response.headers.get("content-type"),
      };
    }
  } catch (err) {
    if (err instanceof UnsafeTarget) throw new FetchRefused(err.message);
    if (err instanceof Error && err.name === "AbortError") {
      throw new FetchRefused(`${url} did not respond within the timeout`);
    }
    throw new FetchRefused(`${url}: ${String(err)}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read a host's robots.txt and report whether a path may be fetched.
 *
 * Deliberately small: it understands `User-agent`, `Disallow` and `Allow` for
 * the wildcard group, which is what both current sources use. It is not a
 * complete implementation, and it errs toward refusing — an unparseable
 * robots.txt is treated as a refusal rather than as permission.
 */
export async function robotsAllows(
  homepageUrl: string,
  path: string,
  userAgent: string = DEFAULT_USER_AGENT,
): Promise<{ allowed: boolean; note: string }> {
  const base = new URL(homepageUrl);
  let body: string;

  try {
    const res = await politeFetch(new URL("/robots.txt", base).toString(), { userAgent });
    if (res.status === 404) {
      return { allowed: true, note: "robots.txt відсутній — обхід не обмежено" };
    }
    if (res.status >= 400) {
      return { allowed: false, note: `robots.txt повернув ${res.status}` };
    }
    body = res.body;
  } catch (err) {
    return { allowed: false, note: `robots.txt недоступний: ${String(err)}` };
  }

  const rules: { allow: boolean; path: string }[] = [];
  let inWildcardGroup = false;

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.split("#")[0]?.trim() ?? "";
    if (line.length === 0) continue;

    const [field = "", ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const name = field.trim().toLowerCase();

    if (name === "user-agent") {
      inWildcardGroup = value === "*";
      continue;
    }
    if (!inWildcardGroup) continue;
    if (name === "disallow") {
      // An empty Disallow is an explicit "everything is allowed".
      if (value.length > 0) rules.push({ allow: false, path: value });
    } else if (name === "allow" && value.length > 0) {
      rules.push({ allow: true, path: value });
    }
  }

  // Longest match wins, which is what the de-facto standard specifies.
  let decision: { allow: boolean; path: string } | null = null;
  for (const rule of rules) {
    if (!path.startsWith(rule.path)) continue;
    if (decision === null || rule.path.length > decision.path.length) decision = rule;
  }

  if (decision === null) {
    return { allowed: true, note: `robots.txt не обмежує ${path}` };
  }
  return {
    allowed: decision.allow,
    note: decision.allow
      ? `robots.txt явно дозволяє ${decision.path}`
      : `robots.txt забороняє ${decision.path}`,
  };
}
