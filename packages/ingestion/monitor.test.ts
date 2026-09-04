/**
 * The due-window arithmetic, which decides how often we touch someone's server.
 */

import { describe, expect, it } from "vitest";

import { dueAfterMs } from "./monitor";

const HOUR = 3_600_000;

describe("dueAfterMs", () => {
  // The whole point of the grace window: a job that fires at a fixed 04:00 has
  // to clear a 24h cadence every night, even when the previous run was a few
  // minutes late or an off-schedule crawl re-anchored the source to the evening.
  it("lets a fixed-time daily job clear a 24h cadence", () => {
    expect(dueAfterMs(24)).toBe(21 * HOUR);
    expect(dueAfterMs(24)).toBeLessThan(24 * HOUR);
  });

  // The failure the cap exists for. A flat three hours against a 3h cadence is a
  // threshold of zero and against 2h it is negative, so the source comes up due
  // on every pass — the politeness budget switched off rather than widened.
  it("never lets the grace reach or pass the cadence itself", () => {
    for (const hours of [1, 2, 3, 4, 6, 8, 12, 24, 48, 168]) {
      const due = dueAfterMs(hours);
      expect(due).toBeGreaterThan(0);
      expect(due).toBeLessThanOrEqual(hours * HOUR);
      // Still at least seven eighths of what the operator asked for.
      expect(due).toBeGreaterThanOrEqual(hours * HOUR * 0.875);
    }
  });

  it("keeps the grace proportional on a short cadence", () => {
    expect(dueAfterMs(2)).toBe(2 * HOUR - 0.25 * HOUR);
    expect(dueAfterMs(8)).toBe(8 * HOUR - 1 * HOUR);
  });

  // Above 24h the cap stops biting and the slack stays a flat three hours,
  // rather than growing to a day and a half on a weekly source.
  it("does not widen the grace indefinitely on a long cadence", () => {
    expect(dueAfterMs(168)).toBe(168 * HOUR - 3 * HOUR);
  });
});
