/**
 * The normalisation applied to whatever the model returns.
 *
 * Verdict accuracy is measured by the eval harness against the golden set; this
 * covers the tidying that has to hold regardless of how good the verdicts are,
 * and every case here came from a live run.
 */

import { describe, expect, it } from "vitest";

import { meaningfulEntries } from "./index";

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
