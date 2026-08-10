/**
 * The parts of extraction that must hold regardless of which model runs, and
 * regardless of whether a model runs at all.
 */

import { describe, expect, it } from "vitest";

import {
  ANNOUNCEMENT_CEILING,
  amountOccursIn,
  dateOccursIn,
  extractionConfidence,
  missingFields,
  normalizeDate,
  quoteOccursIn,
} from "./index";
import type { ExtractedGrant } from "./output";

const EMPTY: ExtractedGrant = {
  isGrant: true,
  titleUk: "Конкурс",
  donorName: null,
  applicationUrl: null,
  deadline: null,
  fundingMin: null,
  fundingMax: null,
  currency: null,
  cofinancingRequired: null,
  sectors: [],
  targetGroups: [],
  applicantTypes: [],
  applicantGeography: [],
  eligibility: [],
  summaryUk: "",
  notReadFromSource: [],
};

const FULL: ExtractedGrant = {
  ...EMPTY,
  donorName: "Фонд",
  deadline: "2026-09-15",
  fundingMax: 500000,
  currency: "UAH",
  cofinancingRequired: false,
  sectors: ["культура"],
  applicantTypes: ["громадські організації"],
  applicantGeography: ["Україна"],
  eligibility: [
    {
      text: "Заявник має бути зареєстрований в Україні",
      kind: "MANDATORY",
      quote: "Заявник має бути зареєстрований в Україні.",
      resolvingFactKey: "registration_oblast",
    },
  ],
};

describe("quoteOccursIn", () => {
  const page = "Заявник має бути зареєстрований в Україні. Кінцевий термін — 15 вересня.";

  it("accepts a quote that is on the page", () => {
    expect(quoteOccursIn("Заявник має бути зареєстрований в Україні.", page)).toBe(true);
  });

  it("tolerates differences in quote marks, dashes and spacing", () => {
    expect(quoteOccursIn("Кінцевий  термін —   15 вересня", page)).toBe(true);
  });

  it("rejects a quote that is not there, however plausible", () => {
    expect(quoteOccursIn("Заявник має мати міжнародного партнера.", page)).toBe(false);
  });

  it("rejects a fragment too short to be evidence", () => {
    // "в Україні" occurs, but a rule resting on it cites nothing.
    expect(quoteOccursIn("в Україні", page)).toBe(false);
  });
});

describe("extractionConfidence", () => {
  it("is zero when the announcement stated nothing decisive", () => {
    expect(extractionConfidence(EMPTY, false)).toBe(0);
  });

  it("never reaches certainty even when every field came back", () => {
    // The donor's own guidelines were not read, and that is where the
    // disqualifying clause usually is.
    expect(extractionConfidence(FULL, false)).toBe(ANNOUNCEMENT_CEILING);
    expect(extractionConfidence(FULL, false)).toBeLessThan(1);
  });

  it("falls further when the page was cut short", () => {
    expect(extractionConfidence(FULL, true)).toBeLessThan(extractionConfidence(FULL, false));
  });

  it("weights a deadline above a sector list", () => {
    const withDeadline = { ...EMPTY, deadline: "2026-09-15" };
    const withSectors = { ...EMPTY, sectors: ["культура"] };
    expect(extractionConfidence(withDeadline, false)).toBeGreaterThan(
      extractionConfidence(withSectors, false),
    );
  });

  it("rises as more of the announcement is filled in", () => {
    const partial = { ...EMPTY, deadline: "2026-09-15", donorName: "Фонд" };
    expect(extractionConfidence(partial, false)).toBeGreaterThan(
      extractionConfidence(EMPTY, false),
    );
    expect(extractionConfidence(partial, false)).toBeLessThan(
      extractionConfidence(FULL, false),
    );
  });
});

describe("normalizeDate", () => {
  // Two complete live grants were lost to a schema rejection over this before
  // the format was coerced instead of enforced.
  it("passes an ISO date through", () => {
    expect(normalizeDate("2026-09-15")).toBe("2026-09-15");
  });

  it("reads the forms Ukrainian announcements actually use", () => {
    expect(normalizeDate("15.09.2026")).toBe("2026-09-15");
    expect(normalizeDate("5.9.2026")).toBe("2026-09-05");
    expect(normalizeDate("15 вересня 2026")).toBe("2026-09-15");
  });

  it("returns null for a date with no year rather than assuming one", () => {
    // Assuming the current year turns a call that closed last March into one
    // closing next March.
    expect(normalizeDate("15 вересня")).toBeNull();
    expect(normalizeDate("вересень 2026")).toBeNull();
  });

  it("returns null for nothing", () => {
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate("  ")).toBeNull();
  });
});

describe("dateOccursIn", () => {
  // The live run that motivated this returned a deadline equal to the day the
  // extraction ran, on a page whose own notes said no term was stated.
  const page = "Заявки приймаються до 15 вересня 2026 року включно.";

  it("accepts a date written the way announcements write it", () => {
    expect(dateOccursIn("2026-09-15", page)).toBe(true);
  });

  it("accepts numeric and ISO forms", () => {
    expect(dateOccursIn("2026-09-15", "Дедлайн: 15.09.2026")).toBe(true);
    expect(dateOccursIn("2026-09-15", "Дедлайн: 15/09")).toBe(true);
    expect(dateOccursIn("2026-09-15", "Deadline: 2026-09-15")).toBe(true);
  });

  it("rejects a date the page never mentions", () => {
    expect(dateOccursIn("2026-08-10", page)).toBe(false);
  });

  it("rejects a malformed date rather than passing it through", () => {
    expect(dateOccursIn("вересень 2026", page)).toBe(false);
  });
});

describe("amountOccursIn", () => {
  it("finds a sum however it is grouped", () => {
    expect(amountOccursIn(340000, "Розмір гранту — до 340 000 грн")).toBe(true);
    expect(amountOccursIn(500000, "до 500000 грн")).toBe(true);
  });

  it("rejects a sum that is not on the page", () => {
    expect(amountOccursIn(340000, "Розмір гранту — до 500 000 грн")).toBe(false);
  });

  it("will not corroborate a number too short to be distinctive", () => {
    expect(amountOccursIn(50, "проєкт триває 50 днів")).toBe(false);
  });
});

describe("missingFields", () => {
  it("names what was not read, in words an organization can act on", () => {
    const notes = missingFields(EMPTY);
    expect(notes).toContain("кінцевий термін не вказано");
    expect(notes).toContain("умови прийнятності не описані");
  });

  it("says nothing when everything decisive is present", () => {
    expect(missingFields(FULL)).toEqual([]);
  });
});
