/**
 * The alphabet check on extracted label lists.
 *
 * Values here are verbatim from the first live crawl of ГУРТ and Громадський
 * Простір.
 */

import { describe, expect, it } from "vitest";

import { extractionConfidence, missingFields, normalizeDate, quoteOccursIn } from "./index";
import { ExtractedGrant } from "./output";

describe("normalizeDate — the forms Ukrainian announcements use", () => {
  it("reads ISO, numeric and named months", () => {
    expect(normalizeDate("2026-09-13")).toBe("2026-09-13");
    expect(normalizeDate("13.09.2026")).toBe("2026-09-13");
    expect(normalizeDate("13 вересня 2026")).toBe("2026-09-13");
  });

  it("refuses a date with no year rather than assuming this one", () => {
    // Assuming the current year is how a call that closed last March becomes
    // one that closes next March.
    expect(normalizeDate("13 вересня")).toBeNull();
  });
});

describe("quoteOccursIn", () => {
  it("matches across differing quote marks and whitespace", () => {
    const page = "Учасниками   можуть   бути «громадські організації» України.";
    expect(quoteOccursIn("Учасниками можуть бути \"громадські організації\"", page)).toBe(true);
  });

  it("refuses a fragment too short to be evidence", () => {
    expect(quoteOccursIn("так", "так, учасники можуть подаватися")).toBe(false);
  });
});

describe("extractionConfidence", () => {
  const full = {
    deadline: "2026-09-13",
    eligibility: [{ text: "x", quote: "y", kind: "MANDATORY", resolvingFactKey: null }],
    fundingMax: 5000,
    applicantTypes: ["громадські організації"],
    sectors: ["культура"],
    applicantGeography: ["Україна"],
    cofinancingRequired: false,
    donorName: "Фонд",
  } as never;

  it("never reaches certainty on an announcement", () => {
    // 0.75 is the ceiling: an announcement is a notice about a call, and the
    // disqualifying clause is usually in the guidelines nobody read.
    expect(extractionConfidence(full, false)).toBeCloseTo(0.75, 2);
  });

  it("falls further when the page was cut short", () => {
    expect(extractionConfidence(full, true)).toBeLessThan(extractionConfidence(full, false));
  });

  it("names what is missing in words an organization reads", () => {
    const thin = { ...(full as object), deadline: null, fundingMax: null } as never;
    expect(missingFields(thin)).toContain("кінцевий термін не вказано");
    expect(missingFields(thin)).toContain("розмір гранту не вказано");
  });
});

describe("ExtractedGrant currency normalization", () => {
  const base = {
    isGrant: true,
    titleUk: "Тест",
    summaryUk: "Опис конкурсу достатньої довжини для схеми.",
    donorName: "Донор",
    applicationUrl: null,
    deadline: null,
    fundingMin: null,
    fundingMax: null,
    cofinancingRequired: null,
    sectors: [],
    targetGroups: [],
    applicantTypes: [],
    applicantGeography: [],
    eligibility: [],
    notReadFromSource: [],
  };
  const parseCurrency = (c: unknown) =>
    ExtractedGrant.parse({ ...base, currency: c }).currency;

  it("keeps a valid three-letter code, upper-cased", () => {
    expect(parseCurrency("UAH")).toBe("UAH");
    expect(parseCurrency("eur")).toBe("EUR");
    expect(parseCurrency(" usd ")).toBe("USD");
  });

  it("nulls the word «null» and other junk the model emits", () => {
    // The exact value that crashed the nightly matching pass.
    expect(parseCurrency("null")).toBeNull();
    expect(parseCurrency("грн")).toBeNull();
    expect(parseCurrency("$")).toBeNull();
    expect(parseCurrency("euro")).toBeNull();
    expect(parseCurrency("")).toBeNull();
    expect(parseCurrency(null)).toBeNull();
  });
})
