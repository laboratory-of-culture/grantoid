/**
 * The deadline-to-status rule.
 *
 * Both dates here are real: the first live crawl of Громадський Простір and
 * ГУРТ stored a call that closed on 2023-09-04 and one that closed on
 * 2024-08-31, both with status OPEN.
 */

import { describe, expect, it } from "vitest";

import { statusForDeadline } from "./grant";

const NOW = new Date("2026-08-21T12:00:00Z");

describe("statusForDeadline", () => {
  it("closes a call whose deadline has passed", () => {
    expect(statusForDeadline(new Date("2023-09-04T00:00:00Z"), NOW)).toBe("CLOSED");
    expect(statusForDeadline(new Date("2024-08-31T00:00:00Z"), NOW)).toBe("CLOSED");
  });

  it("opens a call whose deadline is ahead", () => {
    expect(statusForDeadline(new Date("2026-09-30T00:00:00Z"), NOW)).toBe("OPEN");
  });

  it("says UNKNOWN when no deadline was read", () => {
    // Not CLOSED. «We could not find the date» must never present as «you are
    // too late» — the same distinction the ladder draws between NO and DON'T
    // KNOW, one stage earlier.
    expect(statusForDeadline(null, NOW)).toBe("UNKNOWN");
  });
});
