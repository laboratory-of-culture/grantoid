/**
 * The normalisation applied to whatever the model returns.
 *
 * Verdict accuracy is measured by the eval harness against the golden set; this
 * covers the tidying that has to hold regardless of how good the verdicts are,
 * and every case here came from a live run.
 */

import { describe, expect, it } from "vitest";

import { looksLikeMachineNotation, meaningfulEntries, quoteIsInProfile } from "./index";

describe("quoteIsInProfile", () => {
  const profile = [
    "Назва: ГО «Лабораторія культурних досліджень».",
    "Неприбутковий статус: так. Підтверджено документом.",
    "Сфери: культура; культурна спадщина; освіта. Зі слів організації.",
  ].join("\n");

  it("accepts a sentence copied from the profile", () => {
    expect(quoteIsInProfile("Неприбутковий статус: так. Підтверджено документом.", profile)).toBe(
      true,
    );
  });

  it("tolerates differences in quote marks and spacing", () => {
    expect(quoteIsInProfile("Сфери:  культура; культурна спадщина; освіта.", profile)).toBe(true);
  });

  it("rejects a fluent sentence the profile never said", () => {
    // The dangerous case: nothing about it looks wrong.
    expect(
      quoteIsInProfile("Організація має підтверджений досвід міжнародних проєктів.", profile),
    ).toBe(false);
  });

  it("rejects a fragment too short to be evidence", () => {
    expect(quoteIsInProfile("культура", profile)).toBe(false);
  });
});

describe("looksLikeMachineNotation", () => {
  // The profile used to be handed to the model as JSON, so its "verbatim quote
  // from the profile" was JSON — and the breakdown printed the system's own
  // notation under «з профілю організації».
  it("catches a fact-state dump", () => {
    expect(
      looksLikeMachineNotation(
        "non_profit_status: CONFIRMED (true), legal_form: CONFIRMED (Громадська організація (ГО))",
      ),
    ).toBe(true);
  });

  it("catches a bare key prefix and a JSON array", () => {
    expect(looksLikeMachineNotation("sectors: SELF_REPORTED (['культура', ...])")).toBe(true);
    expect(looksLikeMachineNotation("activity_areas: дослідження спадщини")).toBe(true);
  });

  it("leaves a real profile sentence alone", () => {
    expect(
      looksLikeMachineNotation(
        "Неприбутковий статус: так. Підтверджено документом.",
      ),
    ).toBe(false);
    expect(
      looksLikeMachineNotation("Сфери: культура; культурна спадщина. Зі слів організації."),
    ).toBe(false);
  });
});

describe("meaningfulEntries", () => {
  it("drops prose that describes the empty set", () => {
    // Live output. Rendered on the feed, this reads as a blocker that says
    // there are no blockers.
    expect(meaningfulEntries(["Немає обов'язкових блокерів"])).toEqual([]);
    expect(meaningfulEntries(["Нема"])).toEqual([]);
    expect(meaningfulEntries(["Відсутні"])).toEqual([]);
    expect(meaningfulEntries(["None"])).toEqual([]);
    expect(meaningfulEntries(["—"])).toEqual([]);
  });

  it("keeps real blockers", () => {
    expect(
      meaningfulEntries(["Організація зареєстрована поза межами прийнятних регіонів"]),
    ).toHaveLength(1);
  });

  it("keeps a blocker that merely contains a negation", () => {
    // "не відповідає" is a finding, not an empty set. Only a leading negation
    // of the list itself is dropped.
    expect(
      meaningfulEntries(["Профіль не відповідає вимозі щодо співфінансування"]),
    ).toHaveLength(1);
  });

  it("drops blank entries", () => {
    expect(meaningfulEntries(["", "   "])).toEqual([]);
  });

  it("leaves an already empty list alone", () => {
    expect(meaningfulEntries([])).toEqual([]);
  });

  it("strips a rule slug the model prefixed onto its own sentence", () => {
    // Live output. The slug is addressed to the system, and the criterion
    // breakdown already names the rule beside its quote.
    expect(
      meaningfulEntries(["geography: Діяльність має відбуватися в громадах Харківської області."]),
    ).toEqual(["Діяльність має відбуватися в громадах Харківської області."]);
  });

  it("drops an entry that is only an enum name", () => {
    // "geographic-coverage: NOT_ELIGIBLE" told a grant manager nothing.
    expect(meaningfulEntries(["geographic-coverage: NOT_ELIGIBLE"])).toEqual([]);
    expect(meaningfulEntries(["NOT_ELIGIBLE"])).toEqual([]);
  });

  it("does not mistake a Ukrainian sentence for a slug prefix", () => {
    expect(meaningfulEntries(["Увага: організація не має партнера."])).toEqual([
      "Увага: організація не має партнера.",
    ]);
  });
});
