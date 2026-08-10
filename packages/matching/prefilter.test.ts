/**
 * The pre-filter's whole job is to be cheap without being wrong in the
 * expensive direction. These tests are weighted accordingly: most of them check
 * that it *declines* to exclude.
 */

import { describe, expect, it } from "vitest";

import {
  type FilterableGrant,
  type FilterableOrganization,
  overlaps,
  prefilter,
  prefilterAll,
  stems,
} from "./prefilter";

const NOW = new Date("2026-08-10T12:00:00Z");

const LAB: FilterableOrganization = {
  sectors: ["культура", "культурна спадщина", "освіта", "креативні індустрії"],
  geography: ["Чернівці", "Чернівецька область", "Буковина"],
  legalForm: "Громадська організація (ГО)",
  oblast: "Чернівецька область",
};

/** A profile where nothing has been answered. The common case at signup. */
const BLANK: FilterableOrganization = {
  sectors: null,
  geography: null,
  legalForm: null,
  oblast: null,
};

function grant(over: Partial<FilterableGrant> = {}): FilterableGrant {
  return {
    id: "g1",
    sectors: [],
    applicantGeography: [],
    applicantTypes: [],
    deadline: new Date("2026-12-01T00:00:00Z"),
    deadlineIsKnown: true,
    status: "OPEN",
    ...over,
  };
}

describe("stems and overlaps", () => {
  it("matches across Ukrainian case endings", () => {
    // The reason string equality is useless here: these are the same word.
    expect(overlaps(["культура"], ["культури"])).toBe(true);
    expect(overlaps(["освіта"], ["освітні проєкти"])).toBe(true);
  });

  it("does not match unrelated terms", () => {
    expect(overlaps(["культура"], ["сільське господарство"])).toBe(false);
  });

  it("drops words too short to be distinctive", () => {
    expect(stems(["ЗМІ", "мир", "та"])).toEqual(new Set());
  });

  it("does not let a shared administrative noun create a match", () => {
    // Every oblast name contains "область". Before this was excluded, the
    // geography rule matched Chernivtsi against Donetsk and never fired at all.
    expect(prefilter(LAB, grant({ applicantGeography: ["Донецька область"] }), NOW).pass).toBe(
      false,
    );
  });
});

describe("prefilter — excludes only on positive evidence", () => {
  it("excludes a call whose deadline has passed", () => {
    const verdict = prefilter(LAB, grant({ deadline: new Date("2026-07-01") }), NOW);
    expect(verdict.pass).toBe(false);
    if (!verdict.pass) expect(verdict.rule).toBe("deadline-passed");
  });

  it("excludes a call limited to regions the organization does not work in", () => {
    const verdict = prefilter(
      LAB,
      grant({ applicantGeography: ["Донецька область", "Луганська область"] }),
      NOW,
    );
    expect(verdict.pass).toBe(false);
    if (!verdict.pass) {
      expect(verdict.rule).toBe("geography");
      // The reason names the regions, so the exclusion can be argued with.
      expect(verdict.reasonUk).toContain("Донецька область");
    }
  });

  it("excludes a call whose sectors share nothing with the profile", () => {
    const verdict = prefilter(LAB, grant({ sectors: ["сільське господарство"] }), NOW);
    expect(verdict.pass).toBe(false);
    if (!verdict.pass) expect(verdict.rule).toBe("sector");
  });
});

describe("prefilter — refuses to exclude on silence", () => {
  it("passes everything for a profile with nothing filled in", () => {
    // D4: absence cannot produce a rejection. A new organization must not be
    // shown an empty feed because it has not answered anything yet.
    expect(prefilter(BLANK, grant({ sectors: ["сільське господарство"] }), NOW).pass).toBe(true);
    expect(prefilter(BLANK, grant({ applicantGeography: ["Донецька область"] }), NOW).pass).toBe(
      true,
    );
  });

  it("passes a nationwide call regardless of where the organization sits", () => {
    expect(prefilter(LAB, grant({ applicantGeography: ["Україна"] }), NOW).pass).toBe(true);
    expect(prefilter(LAB, grant({ applicantGeography: ["вся країна"] }), NOW).pass).toBe(true);
    expect(prefilter(LAB, grant({ applicantGeography: ["Ukraine"] }), NOW).pass).toBe(true);
  });

  it("treats a worldwide call as open, not as a foreign restriction", () => {
    // Both of these were excluded on the first live run. "Global" is the
    // absence of a geographic limit, not one.
    expect(prefilter(LAB, grant({ applicantGeography: ["Global"] }), NOW).pass).toBe(true);
    expect(prefilter(LAB, grant({ applicantGeography: ["Worldwide"] }), NOW).pass).toBe(true);
  });

  it("does not treat a sentence about eligibility as a list of regions", () => {
    // Live value: a description of which countries qualify, which matches no
    // place name and therefore rejected everyone.
    const described = grant({
      applicantGeography: [
        "Країни, що мають офіційний мирний процес (Track 1 або 2) чи впровадження мирної угоди",
      ],
    });
    expect(prefilter(LAB, described, NOW).pass).toBe(true);
  });

  it("passes a call that names no sectors — it is open to all of them", () => {
    expect(prefilter(LAB, grant({ sectors: [] }), NOW).pass).toBe(true);
  });

  it("does not compare sectors across alphabets", () => {
    // Live case: the call's sector was "Active Play" and the profile's are
    // Ukrainian. They share no stem regardless of how related they are, so the
    // exclusion would be an artefact of language. The model reads both.
    expect(prefilter(LAB, grant({ sectors: ["Active Play"] }), NOW).pass).toBe(true);
    expect(prefilter(LAB, grant({ sectors: ["agriculture", "mining"] }), NOW).pass).toBe(true);
  });

  it("does not treat an applicant description as a sector label", () => {
    // Extraction filed this under sectors on the live corpus.
    const misfiled = grant({
      sectors: ["Місцеві жіночі правозахисні організації, що працюють у громадах"],
    });
    expect(prefilter(LAB, misfiled, NOW).pass).toBe(true);
  });

  it("passes a call whose deadline could not be read", () => {
    // Extraction routinely fails to find a date. "We could not read it" must
    // never present as "you are too late".
    const verdict = prefilter(LAB, grant({ deadline: null, deadlineIsKnown: false }), NOW);
    expect(verdict.pass).toBe(true);
    if (verdict.pass) expect(verdict.skipped).toContain("кінцевий термін конкурсу невідомий");
  });

  it("passes on a partial sector overlap rather than requiring all of them", () => {
    expect(
      prefilter(LAB, grant({ sectors: ["освіта", "сільське господарство"] }), NOW).pass,
    ).toBe(true);
  });

  it("never filters on applicant type, however it is worded", () => {
    // "ОГС", "неприбуткові організації" and "civil society actors" all describe
    // this organization, and a string test over that vocabulary drops real
    // matches silently.
    expect(prefilter(LAB, grant({ applicantTypes: ["фізичні особи"] }), NOW).pass).toBe(true);
    expect(prefilter(LAB, grant({ applicantTypes: ["органи місцевого самоврядування"] }), NOW).pass).toBe(
      true,
    );
  });
});

describe("prefilter — what it could not judge", () => {
  it("says when the profile is why a pair went to the model", () => {
    const verdict = prefilter(BLANK, grant({ sectors: ["культура"] }), NOW);
    expect(verdict.pass).toBe(true);
    if (verdict.pass) {
      expect(verdict.skipped).toContain("сфери організації не вказані");
      expect(verdict.skipped).toContain("географія організації не вказана");
    }
  });

  it("says nothing was skipped when everything was decidable", () => {
    const verdict = prefilter(LAB, grant({ sectors: ["культура"] }), NOW);
    expect(verdict.pass).toBe(true);
    if (verdict.pass) expect(verdict.skipped).toEqual([]);
  });
});

describe("prefilterAll", () => {
  it("splits a candidate set and keeps every exclusion's reason", () => {
    const summary = prefilterAll(
      LAB,
      [
        grant({ id: "keep", sectors: ["культура"] }),
        grant({ id: "old", deadline: new Date("2025-01-01") }),
        grant({ id: "elsewhere", applicantGeography: ["Донецька область"] }),
      ],
      NOW,
    );

    expect(summary.passed.map((g) => g.id)).toEqual(["keep"]);
    expect(summary.excluded.map((e) => e.rule).sort()).toEqual(["deadline-passed", "geography"]);
    expect(summary.excluded.every((e) => e.reasonUk.length > 0)).toBe(true);
  });

  it("is the difference between a feed that builds and one that does not", () => {
    // 100 grants at 82 seconds each is 2.3 hours. This is the whole point.
    const many = Array.from({ length: 100 }, (_, i) =>
      grant({ id: `g${i}`, sectors: i % 4 === 0 ? ["культура"] : ["сільське господарство"] }),
    );

    const summary = prefilterAll(LAB, many, NOW);
    expect(summary.passed).toHaveLength(25);
    expect(summary.excluded).toHaveLength(75);
  });
});
