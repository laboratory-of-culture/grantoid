/**
 * The echo guard.
 *
 * Every case here is text a model actually returned. The first live run against
 * a donor PDF produced all eight sections as copies of their own brief, and the
 * draft saved and rendered — so this file exists to keep the *shape* of that
 * failure rejected, not one particular sentence.
 */

import { describe, expect, it } from "vitest";

import { echoesInstructions } from "./index";
import { CONCEPT_SECTIONS } from "../../packages/schemas/concept";

function section(key: string) {
  const found = CONCEPT_SECTIONS.find((s) => s.key === key);
  if (!found) throw new Error(`no such section: ${key}`);
  return found;
}

describe("echoesInstructions", () => {
  it("rejects the specification copied back verbatim", () => {
    const problem = section("problem");
    const echo = [
      `Питання: ${problem.promptUk}`,
      `Настанова: ${problem.guidance}`,
      `Орієнтовний обсяг: ${problem.targetWords} слів.`,
    ].join("\n");

    expect(echoesInstructions(problem, echo)).toBe(true);
  });

  it("rejects one label on its own", () => {
    // The model does not always copy the whole block; a body that opens with
    // «Настанова:» is our text either way.
    expect(echoesInstructions(section("goal"), "Настанова: одне речення про зміну.")).toBe(true);
  });

  it("rejects the guidance without its label", () => {
    const capacity = section("capacity");
    expect(echoesInstructions(capacity, capacity.guidance)).toBe(true);
  });

  it("rejects an empty body", () => {
    expect(echoesInstructions(section("results"), "   \n  ")).toBe(true);
  });

  it("accepts prose that answers the question", () => {
    const written =
      "У Чернівцях немає жодного постійного майданчика, де незалежні театральні " +
      "колективи могли б показувати роботи. Через це вистави, підготовлені " +
      "місцевими митцями, грають один-два рази й зникають.";
    expect(echoesInstructions(section("problem"), written)).toBe(false);
  });

  it("accepts prose that happens to name the section's subject", () => {
    // A concept note is allowed to use the word «проблема». Rejecting on
    // vocabulary rather than on structure would throw away real writing.
    const written =
      "Проблема, яку розв'язує проєкт, стосується ветеранів з ампутаціями у " +
      "Львівській області: спортивні зали громад до них не пристосовані.";
    expect(echoesInstructions(section("problem"), written)).toBe(false);
  });
});
