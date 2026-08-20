/**
 * The part of the review that does not depend on the model behaving.
 *
 * Every case here came from a live run: the reviewer was told plainly not to
 * flag problem statements as unsupported, and flagged every sentence of one.
 */

import { describe, expect, it } from "vitest";

import { keepsUnsupported } from "./index";

describe("keepsUnsupported", () => {
  it("keeps a claim about capacity, which the profile can contradict", () => {
    expect(
      keepsUnsupported("capacity", "Організація має досвід міжнародних проєктів."),
    ).toBe(true);
  });

  it("drops a problem statement with no figure in it", () => {
    // Live output: «Профіль не містить даних про те, що мешканці сільських
    // громад не мають доступу до інформації». A profile holds facts about an
    // NGO, not a description of the world — this is a category error.
    expect(
      keepsUnsupported(
        "problem",
        "Мешканці сільських громад не мають доступу до інформації про традиції.",
      ),
    ).toBe(false);
  });

  it("keeps a figure anywhere, because a figure commits the applicant", () => {
    expect(keepsUnsupported("problem", "Понад 1200 мешканців втратили доступ.")).toBe(true);
    expect(keepsUnsupported("results", "Проєкт охопить 400 учасників.")).toBe(true);
  });

  it("drops a plan for the future, which no profile can contain", () => {
    expect(
      keepsUnsupported("activities", "Організація проведе експедиції до сіл Буковини."),
    ).toBe(false);
  });
});
