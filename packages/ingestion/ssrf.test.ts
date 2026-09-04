/**
 * The address classifier that stands between a crawled link and an internal
 * request. Every reserved range gets a case, because a gap here is an open SSRF.
 */

import { describe, expect, it } from "vitest";

import { assertFetchableUrl, isBlockedAddress, UnsafeTarget } from "./ssrf";

describe("isBlockedAddress — IPv4", () => {
  it("blocks loopback, private and link-local ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "127.1.2.3",
      "10.0.0.1",
      "10.255.255.255",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.1",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "169.254.0.1",
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "198.18.0.1", // benchmarking
      "224.0.0.1", // multicast
      "240.0.0.1", // reserved
      "255.255.255.255",
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows ordinary public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "194.44.97.121", "172.15.0.1", "172.32.0.1", "9.255.255.255"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("does not misjudge the edges of the private blocks", () => {
    // One below 10/8 and one above, one below and above 172.16/12.
    expect(isBlockedAddress("9.255.255.255")).toBe(false);
    expect(isBlockedAddress("11.0.0.0")).toBe(false);
    expect(isBlockedAddress("172.15.255.255")).toBe(false);
    expect(isBlockedAddress("172.32.0.0")).toBe(false);
  });
});

describe("isBlockedAddress — IPv6", () => {
  it("blocks loopback, unspecified, ULA, link-local and multicast", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("sees through IPv4-mapped and NAT64 wrappers", () => {
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedAddress("64:ff9b::127.0.0.1")).toBe(true);
    // A mapped *public* v4 stays allowed.
    expect(isBlockedAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it("allows a public IPv6 address", () => {
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false); // Cloudflare DNS
  });
});

describe("assertFetchableUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    await expect(assertFetchableUrl("file:///etc/passwd")).rejects.toBeInstanceOf(UnsafeTarget);
    await expect(assertFetchableUrl("gopher://x/")).rejects.toBeInstanceOf(UnsafeTarget);
    await expect(assertFetchableUrl("ftp://x/")).rejects.toBeInstanceOf(UnsafeTarget);
  });

  it("rejects a literal internal address, however it is written", async () => {
    await expect(assertFetchableUrl("http://127.0.0.1/")).rejects.toBeInstanceOf(UnsafeTarget);
    await expect(assertFetchableUrl("http://169.254.169.254/latest/meta-data/")).rejects.toBeInstanceOf(UnsafeTarget);
    await expect(assertFetchableUrl("http://[::1]:11434/")).rejects.toBeInstanceOf(UnsafeTarget);
    // getaddrinfo normalises the decimal and hex forms of 127.0.0.1 on lookup.
    await expect(assertFetchableUrl("http://2130706433/")).rejects.toBeInstanceOf(UnsafeTarget);
    await expect(assertFetchableUrl("http://0x7f000001/")).rejects.toBeInstanceOf(UnsafeTarget);
  });

  it("rejects a name with no resolvable address", async () => {
    await expect(
      assertFetchableUrl("http://no-such-host.invalid/"),
    ).rejects.toBeInstanceOf(UnsafeTarget);
  });

  it("allows a public host", async () => {
    // A literal public IP takes the no-DNS path, so this stays offline.
    await expect(assertFetchableUrl("https://8.8.8.8/")).resolves.toBeUndefined();
  });
});
