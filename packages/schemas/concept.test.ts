/**
 * The two guards around a generated concept, both of which exist because the
 * model broke the rule the prompt states.
 */

import { describe, expect, it } from "vitest";

import { unreviewedSections, unsupportedNumbers } from "./concept";

const SOURCES = [
  "Розмір команди: 12. Зі слів організації.",
  "Максимальна сума: 12000 EUR. Цільові групи: молодь віком 14–25 років.",
];

describe("unsupportedNumbers", () => {
  it("catches a beneficiary count nobody supplied", () => {
    // Live output: «1000 мешканців сільських громад отримають…» — invented.
    expect(unsupportedNumbers("1000 мешканців отримають доступ", SOURCES)).toEqual(["1000"]);
  });

  it("catches an invented budget split", () => {
    // The first live draft: 40/30/20/10, produced because the section guidance
    // asked for "rough shares" while the global rule banned percentages.
    expect(unsupportedNumbers("400 грн на фестивалі, 300 на освіту", SOURCES)).toEqual([
      "400",
      "300",
    ]);
  });

  it("accepts a figure the call states", () => {
    expect(unsupportedNumbers("Бюджет не перевищить 12000 EUR.", SOURCES)).toEqual([]);
  });

  it("accepts a figure written with group separators", () => {
    expect(unsupportedNumbers("до 12 000 EUR", SOURCES)).toEqual([]);
  });

  it("ignores one- and two-digit numbers", () => {
    // "14–25 років", "3 етапи", a team of 12 — too noisy to flag, and a guard
    // that fires constantly is a guard people learn to click past.
    expect(unsupportedNumbers("Проєкт триває 9 місяців у 3 громадах", SOURCES)).toEqual([]);
  });

  it("says nothing about text with no figures at all", () => {
    expect(unsupportedNumbers("Організація працює у сфері культури.", SOURCES)).toEqual([]);
  });
});

describe("unreviewedSections", () => {
  it("counts an untouched AI draft as unread", () => {
    expect(
      unreviewedSections([{ key: "problem", source: "AI_DRAFT", approvedAt: null }]),
    ).toEqual(["problem"]);
  });

  it("clears once a person approved it", () => {
    expect(
      unreviewedSections([{ key: "problem", source: "AI_DRAFT", approvedAt: new Date() }]),
    ).toEqual([]);
  });

  it("clears once a person edited it", () => {
    expect(
      unreviewedSections([{ key: "problem", source: "HUMAN_EDITED", approvedAt: null }]),
    ).toEqual([]);
  });
});
