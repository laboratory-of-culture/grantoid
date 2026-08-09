/**
 * Written before `ladder.ts`, per the kickoff instruction.
 *
 * These three groups are the product's core claim expressed as assertions. If
 * any of them go red, the platform is telling Ukrainian NGOs something it cannot
 * support — which is worse than telling them nothing.
 */

import { describe, expect, it } from "vitest";

import {
  assertVerdictPermitted,
  bucketOf,
  permittedVerdicts,
  rollUp,
  type Assessed,
} from "./ladder";

function criterion(over: Partial<Assessed> = {}): Assessed {
  return {
    ruleKey: "some-rule",
    kind: "MANDATORY",
    verdict: "MATCH",
    uncertaintyReason: null,
    resolvingFactState: "CONFIRMED",
    ...over,
  };
}

describe("rollUp — the overall verdict is a floor, never an average", () => {
  it("returns the worst mandatory verdict", () => {
    expect(
      rollUp([
        criterion({ verdict: "MATCH" }),
        criterion({ verdict: "LIKELY_NOT_ELIGIBLE" }),
        criterion({ verdict: "MATCH" }),
      ]),
    ).toBe("LIKELY_NOT_ELIGIBLE");
  });

  it("lets a single NOT_ELIGIBLE sink an otherwise perfect match", () => {
    expect(
      rollUp([
        criterion({ verdict: "MATCH" }),
        criterion({ verdict: "MATCH" }),
        criterion({ verdict: "MATCH" }),
        criterion({ verdict: "NOT_ELIGIBLE" }),
      ]),
    ).toBe("NOT_ELIGIBLE");
  });

  it("does not average — four MATCH and one UNCERTAIN is UNCERTAIN", () => {
    const result = rollUp([
      criterion({ verdict: "MATCH" }),
      criterion({ verdict: "MATCH" }),
      criterion({ verdict: "MATCH" }),
      criterion({ verdict: "MATCH" }),
      criterion({
        verdict: "UNCERTAIN",
        uncertaintyReason: "NO_PROFILE_DATA",
        resolvingFactState: "UNKNOWN",
      }),
    ]);
    expect(result).toBe("UNCERTAIN");
  });

  it("ignores PREFERRED rules — they move the score, never the verdict", () => {
    expect(
      rollUp([
        criterion({ verdict: "MATCH" }),
        criterion({ kind: "PREFERRED", verdict: "NOT_ELIGIBLE" }),
      ]),
    ).toBe("MATCH");
  });

  it("treats EXCLUDED rules as gating, like mandatory ones", () => {
    expect(
      rollUp([
        criterion({ verdict: "MATCH" }),
        criterion({ kind: "EXCLUDED", verdict: "NOT_ELIGIBLE" }),
      ]),
    ).toBe("NOT_ELIGIBLE");
  });

  it("is UNCERTAIN when there is nothing gating to judge", () => {
    expect(rollUp([criterion({ kind: "PREFERRED", verdict: "MATCH" })])).toBe(
      "UNCERTAIN",
    );
    expect(rollUp([])).toBe("UNCERTAIN");
  });
});

describe("unknown is not no", () => {
  it("permits only UNCERTAIN when the resolving fact was never answered", () => {
    expect(permittedVerdicts("UNKNOWN")).toEqual(["UNCERTAIN"]);
  });

  it("rejects a rejection built on an unanswered profile field", () => {
    expect(() =>
      assertVerdictPermitted(
        criterion({ verdict: "NOT_ELIGIBLE", resolvingFactState: "UNKNOWN" }),
      ),
    ).toThrow(/UNKNOWN/);
  });

  it("rejects LIKELY_NOT_ELIGIBLE on an unanswered field too", () => {
    expect(() =>
      assertVerdictPermitted(
        criterion({
          verdict: "LIKELY_NOT_ELIGIBLE",
          resolvingFactState: "UNKNOWN",
        }),
      ),
    ).toThrow(/UNKNOWN/);
  });

  it("rejects a positive verdict built on an unanswered field", () => {
    expect(() =>
      assertVerdictPermitted(
        criterion({ verdict: "MATCH", resolvingFactState: "UNKNOWN" }),
      ),
    ).toThrow(/UNKNOWN/);
  });

  it("permits NOT_ELIGIBLE only when the organization confirmed the negative", () => {
    expect(permittedVerdicts("EXPLICIT_NEGATIVE")).toContain("NOT_ELIGIBLE");
    expect(() =>
      assertVerdictPermitted(
        criterion({
          verdict: "NOT_ELIGIBLE",
          resolvingFactState: "EXPLICIT_NEGATIVE",
        }),
      ),
    ).not.toThrow();
  });

  it("allows inference when no single fact resolves the rule", () => {
    // A rule with no resolvingFactKey is judged from the profile as a whole —
    // this is the LIKELY_NOT_ELIGIBLE case for a culture NGO against a
    // publisher-only call.
    expect(() =>
      assertVerdictPermitted(
        criterion({
          verdict: "LIKELY_NOT_ELIGIBLE",
          resolvingFactState: null,
        }),
      ),
    ).not.toThrow();
  });

  it("requires a reason on every UNCERTAIN", () => {
    expect(() =>
      assertVerdictPermitted(
        criterion({
          verdict: "UNCERTAIN",
          uncertaintyReason: null,
          resolvingFactState: "UNKNOWN",
        }),
      ),
    ).toThrow(/reason/i);
  });
});

describe("bucketOf — the four buckets the breakdown renders", () => {
  it("puts an unanswered field in Невідомо, not in Не відповідає", () => {
    expect(
      bucketOf(
        criterion({
          verdict: "UNCERTAIN",
          uncertaintyReason: "NO_PROFILE_DATA",
          resolvingFactState: "UNKNOWN",
        }),
      ),
    ).toBe("UNKNOWN");
  });

  it("puts an ambiguous call in Потенційна проблема — the fix is reading, not profile data", () => {
    expect(
      bucketOf(
        criterion({
          verdict: "UNCERTAIN",
          uncertaintyReason: "AMBIGUOUS_CALL",
          resolvingFactState: null,
        }),
      ),
    ).toBe("POTENTIAL_PROBLEM");
  });

  it("keeps established blockers separate from soft negatives", () => {
    expect(bucketOf(criterion({ verdict: "NOT_ELIGIBLE" }))).toBe("NOT_MATCHED");
    expect(bucketOf(criterion({ verdict: "LIKELY_NOT_ELIGIBLE" }))).toBe(
      "POTENTIAL_PROBLEM",
    );
  });

  it("groups both positive rungs together", () => {
    expect(bucketOf(criterion({ verdict: "MATCH" }))).toBe("MATCHED");
    expect(bucketOf(criterion({ verdict: "LIKELY_MATCH" }))).toBe("MATCHED");
  });
});
