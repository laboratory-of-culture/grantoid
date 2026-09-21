/**
 * What the digest selects, and what it is allowed to say.
 *
 * The second half matters more: this is the one place organization data would
 * leave the infrastructure, and the guarantee is enforced by what the builder
 * reads rather than by anyone remembering.
 */

import { describe, expect, it } from "vitest";

import type { FeedEntry } from "../matching/feed";
import { coreFactStatus } from "../schemas/fact-registry";
import { buildDigest, buildProfileNudge, opportunitiesUk, selectForDigest } from "./digest";

const NOW = new Date("2026-08-20T10:00:00Z");

function entry(over: Partial<FeedEntry> = {}): FeedEntry {
  return {
    matchId: "m1",
    grantId: "g1",
    titleUk: "Гранти на культурну спадщину",
    donorName: "Фонд",
    sourceUrl: "https://example.org/call",
    applicationUrl: null,
    deadline: new Date("2026-11-30"),
    deadlineIsKnown: true,
    fundingMax: 12000,
    currency: "EUR",
    overall: "MATCH",
    matchScore: 90,
    recommend: true,
    summary: "Організація відповідає всім умовам.",
    blockers: [],
    openQuestions: [],
    extractionConfidence: 0.75,
    extractionNotes: null,
    synthetic: false,
    criteria: [],
    computedAt: new Date("2026-08-19T10:00:00Z"),
    firstSeenAt: new Date("2026-08-19T10:00:00Z"),
    ...over,
  };
}

describe("selectForDigest", () => {
  it("takes only recommended entries", () => {
    const picked = selectForDigest([entry(), entry({ grantId: "g2", recommend: false })], null, NOW);
    expect(picked.map((e) => e.grantId)).toEqual(["g1"]);
  });

  it("never mails a fixture", () => {
    // A test record in someone's inbox is indistinguishable from a real call.
    expect(selectForDigest([entry({ synthetic: true })], null, NOW)).toEqual([]);
  });

  it("skips what was already sent", () => {
    const since = new Date("2026-08-19T12:00:00Z");
    expect(selectForDigest([entry()], since, NOW)).toEqual([]);
  });

  it("does not re-send a call because the verdict was recomputed", () => {
    // Editing one profile field re-assesses every grant and stamps them all
    // with a fresh computedAt. Newness is the call's own firstSeenAt, or a
    // profile edit mails the whole feed again as "нові можливості".
    const since = new Date("2026-08-19T12:00:00Z");
    const recomputed = entry({
      firstSeenAt: new Date("2026-08-10T10:00:00Z"),
      computedAt: new Date("2026-08-20T09:00:00Z"),
    });
    expect(selectForDigest([recomputed], since, NOW)).toEqual([]);
  });

  it("drops a call whose deadline has passed", () => {
    expect(selectForDigest([entry({ deadline: new Date("2026-08-01") })], null, NOW)).toEqual([]);
  });

  it("keeps a call whose deadline nobody could read", () => {
    const picked = selectForDigest(
      [entry({ deadline: null, deadlineIsKnown: false })],
      null,
      NOW,
    );
    expect(picked).toHaveLength(1);
  });

  it("puts the nearest deadline first", () => {
    const picked = selectForDigest(
      [
        entry({ grantId: "later", deadline: new Date("2026-12-01") }),
        entry({ grantId: "sooner", deadline: new Date("2026-09-01") }),
      ],
      null,
      NOW,
    );
    expect(picked.map((e) => e.grantId)).toEqual(["sooner", "later"]);
  });
});

describe("buildDigest", () => {
  const digest = buildDigest(
    "ГО «Лабораторія»",
    [entry()],
    "https://app.example.org",
    "tok123",
    NOW,
  );

  it("dates the deadline and counts the days left, the way the feed does", () => {
    // entry() closes 2026-11-30; NOW is 2026-08-20 → 102 days.
    expect(digest.text).toContain("подання до 30 листопада 2026 р. · 102 дн.");
  });

  it("carries the public facts about the call", () => {
    expect(digest.text).toContain("Гранти на культурну спадщину");
    expect(digest.text).toContain("Фонд");
    expect(digest.text).toContain("https://app.example.org/hranty/g1");
  });

  it("carries no eligibility verdict, score or reasoning", () => {
    // These are the organization's own material and the product's own
    // reasoning. Neither belongs in a message crossing an SMTP relay.
    expect(digest.text).not.toContain("MATCH");
    expect(digest.text).not.toContain("90");
    expect(digest.text).not.toContain("Організація відповідає всім умовам.");
  });

  it("always carries a working unsubscribe link", () => {
    expect(digest.text).toContain("/vidpyska?t=tok123");
  });

  it("says the system is in trial operation", () => {
    expect(digest.text).toContain("дослідної експлуатації");
  });
});

describe("opportunitiesUk", () => {
  it("uses all three Ukrainian plural forms", () => {
    expect(opportunitiesUk(1)).toBe("1 нова можливість");
    expect(opportunitiesUk(3)).toBe("3 нові можливості");
    expect(opportunitiesUk(5)).toBe("5 нових можливостей");
    expect(opportunitiesUk(11)).toBe("11 нових можливостей");
    expect(opportunitiesUk(22)).toBe("22 нові можливості");
  });
});

describe("coreFactStatus + buildProfileNudge", () => {
  it("is not ready below four core facts, and lists what is missing", () => {
    const s = coreFactStatus(["legal_form", "non_profit_status"]);
    expect(s.ready).toBe(false);
    expect(s.answered).toBe(2);
    expect(s.missing.map((f) => f.key)).toEqual([
      "registration_oblast",
      "activity_areas",
      "sectors",
    ]);
  });

  it("is ready at four of five core facts", () => {
    const s = coreFactStatus(["legal_form", "non_profit_status", "registration_oblast", "sectors"]);
    expect(s.ready).toBe(true);
    expect(s.missing.map((f) => f.key)).toEqual(["activity_areas"]);
  });

  it("builds a nudge with the missing questions and a profile link", () => {
    const s = coreFactStatus(["legal_form"]);
    const nudge = buildProfileNudge("ГО «Тест»", s.missing, "https://grantoid.in.ua", "tok123");
    expect(nudge.subject).toContain("ГО «Тест»");
    expect(nudge.unsubscribeUrl).toBe("https://grantoid.in.ua/vidpyska?t=tok123");
    expect(nudge.text).toContain("https://grantoid.in.ua/profil");
    // Every missing core fact's question appears in the body.
    for (const m of s.missing) expect(nudge.text).toContain(m.questionUk);
    // No eligibility verdict or profile value leaks in.
    expect(nudge.text).not.toMatch(/eligib|прийнятн|MATCH|UNCERTAIN/i);
  });
});
