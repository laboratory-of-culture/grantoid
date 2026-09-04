/**
 * Keeping an outbound crawl from becoming a request against ourselves.
 *
 * `politeFetch` follows links discovered on a source's listing page, and the
 * aggregator portals we read (ГУРТ, Простір, grant.market) accept opportunity
 * announcements submitted by anyone. A submitted link that points at
 * `http://169.254.169.254/…` (cloud metadata), `http://127.0.0.1:11434/`
 * (the local model), or any host on the machine's LAN would otherwise be
 * fetched server-side, its response fed to the extraction model and stored —
 * classic SSRF. The link-pattern filter does not help: it is tested against the
 * raw href, so an absolute foreign URL whose *path* matches still passes.
 *
 * The defence is to resolve the hostname and judge the address, not the string.
 * Resolving is what makes it robust: getaddrinfo normalises `0x7f000001`,
 * `2130706433` and `017700000001` all back to 127.0.0.1, so the octal/decimal/
 * hex tricks that defeat a textual blocklist never survive a lookup. Every IP a
 * name resolves to is checked, and — because a redirect can send a public host
 * at a private one — this runs again on each hop, with `politeFetch` following
 * redirects by hand.
 *
 * Residual: a name that resolves to a public IP at check time and a private one
 * at fetch time (DNS rebinding) is not closed here — that needs pinning the
 * connection to the checked IP, which fights TLS SNI and is not worth its
 * complexity on a single-tenant Mac mini. The practical exploit — a literal
 * internal address in a submitted link — is closed.
 */

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/** Only these two schemes are ever fetched. `file:`, `gopher:`, `ftp:` etc. out. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Is this a literal address we must never connect to?
 *
 * Pure and total so it can be exhaustively tested: every branch is a documented
 * reserved range, IPv4 as a uint32 comparison and IPv6 by expanded bytes.
 */
export function isBlockedAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedV4(ip);
  if (kind === 6) return isBlockedV6(ip);
  // Not a numeric address at all — a caller error; treat as unsafe.
  return true;
}

function isBlockedV4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const n = ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
  const inRange = (base: string, bits: number) => {
    const b = base.split(".").map(Number);
    const baseN = ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (baseN & mask);
  };
  return (
    inRange("0.0.0.0", 8) || // "this" network
    inRange("10.0.0.0", 8) || // RFC1918 private
    inRange("100.64.0.0", 10) || // CGNAT
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local, incl. 169.254.169.254 metadata
    inRange("172.16.0.0", 12) || // RFC1918 private
    inRange("192.0.0.0", 24) || // IETF protocol assignments
    inRange("192.168.0.0", 16) || // RFC1918 private
    inRange("198.18.0.0", 15) || // benchmarking
    inRange("224.0.0.0", 4) || // multicast
    inRange("240.0.0.0", 4) // reserved / broadcast
  );
}

function isBlockedV6(ip: string): boolean {
  const bytes = expandV6(ip);
  if (bytes === null) return true;

  // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::/96) carry a v4 address in
  // the low four bytes — judge that, or an attacker reaches 127.0.0.1 as
  // ::ffff:127.0.0.1.
  const isMappedV4 =
    bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  const isNat64 =
    bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b;
  if (isMappedV4 || isNat64) {
    return isBlockedV4(bytes.slice(12).join("."));
  }

  const b0 = bytes[0]!;
  const b1 = bytes[1]!;
  if (bytes.every((b) => b === 0)) return true; // :: unspecified
  if (bytes.slice(0, 15).every((b) => b === 0) && bytes[15] === 1) return true; // ::1 loopback
  if ((b0 & 0xfe) === 0xfc) return true; // fc00::/7 unique-local
  if (b0 === 0xfe && (b1 & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if (b0 === 0xff) return true; // ff00::/8 multicast
  return false;
}

/** Expand an IPv6 literal to its 16 bytes, or null if it will not parse. */
function expandV6(ip: string): number[] | null {
  let text = ip;

  // A dotted-quad tail (::ffff:1.2.3.4) is rewritten to two hextets first, so
  // the rest of the parse deals only with hex groups — this is where an earlier
  // version left a dangling colon and mis-parsed mapped addresses.
  const lastColon = text.lastIndexOf(":");
  const maybeV4 = text.slice(lastColon + 1);
  if (maybeV4.includes(".")) {
    if (isIP(maybeV4) !== 4) return null;
    const [a, b, c, d] = maybeV4.split(".").map(Number) as [number, number, number, number];
    const hex = (hi: number, lo: number) => ((hi << 8) | lo).toString(16).padStart(4, "0");
    text = `${text.slice(0, lastColon + 1)}${hex(a, b)}:${hex(c, d)}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const parseSide = (s: string): number[] | null => {
    if (s === "") return [];
    const groups = s.split(":");
    const out: number[] = [];
    for (const g of groups) {
      if (g === "" || g.length > 4 || !/^[0-9a-f]+$/i.test(g)) return null;
      const v = parseInt(g, 16);
      out.push((v >> 8) & 0xff, v & 0xff);
    }
    return out;
  };

  const left = parseSide(halves[0]!);
  if (left === null) return null;

  if (halves.length === 1) {
    return left.length === 16 ? left : null;
  }

  const right = parseSide(halves[1]!);
  if (right === null) return null;
  const fill = 16 - left.length - right.length;
  if (fill < 0) return null;
  return [...left, ...Array(fill).fill(0), ...right];
}

export class UnsafeTarget extends Error {}

/**
 * Throw unless `url` is an http(s) URL whose host resolves only to public
 * addresses. Called by `politeFetch` before the initial request and again
 * before following each redirect.
 */
export async function assertFetchableUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeTarget(`${url}: не є коректним URL`);
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new UnsafeTarget(`${url}: дозволені лише http(s), а не ${parsed.protocol}`);
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  // A literal address is judged directly; a name is resolved and every address
  // it maps to is judged, so a name pointing at an internal host is caught.
  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new UnsafeTarget(`${url}: адреса ${host} у приватному чи зарезервованому діапазоні`);
    }
    return;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new UnsafeTarget(`${url}: не вдалося розв'язати хост ${host}`);
  }
  if (addresses.length === 0) {
    throw new UnsafeTarget(`${url}: хост ${host} не має адрес`);
  }
  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw new UnsafeTarget(
        `${url}: хост ${host} вказує на ${address} — приватний чи зарезервований діапазон`,
      );
    }
  }
}
