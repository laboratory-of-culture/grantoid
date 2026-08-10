/**
 * Rule-based classification, tested against titles taken verbatim from the two
 * live sources rather than invented ones.
 */

import { describe, expect, it } from "vitest";

import { classifyByRule } from "./classify-rules";

describe("classifyByRule — settled by a leading marker", () => {
  it("accepts ГУРТ's own grant markers", () => {
    expect(
      classifyByRule("ГРАНТ Гранти на створення можливостей активної гри дітей і молоді")?.status,
    ).toBe("GRANT");
    expect(
      classifyByRule("КОНКУРС Відкрийте мобільний дитячий садок у своїй громаді!")?.status,
    ).toBe("GRANT");
  });

  it("rejects tenders and vacancies", () => {
    expect(
      classifyByRule("ТЕНДЕР Запит цінових пропозицій на закупівлю комп’ютерної техніки")?.status,
    ).toBe("NOT_GRANT");
    expect(classifyByRule("ВАКАНСІЯ Менеджер проєктів")?.status).toBe("NOT_GRANT");
  });

  it("rejects procurement from Громадський Простір", () => {
    expect(classifyByRule("Закупівля: Високоточні терези (Лабораторні ваги)")?.status).toBe(
      "NOT_GRANT",
    );
    expect(
      classifyByRule("Послуги з технічного обслуговування рентгенівської системи")?.status,
    ).toBe("NOT_GRANT");
    expect(
      classifyByRule("Consultancy for Mid-Term Evaluation of BMZ-funded Project")?.status,
    ).toBe("NOT_GRANT");
  });

  it("rejects a digest, which lists opportunities rather than being one", () => {
    expect(classifyByRule("ГУРТ ГРАНТИ – дайджест актуальних можливостей")?.status).toBe(
      "NOT_GRANT",
    );
    expect(
      classifyByRule("ГУРТ ВАКАНСІЇ, ТЕНДЕРИ, РОЗВИТОК – дайджест актуальних можливостей")
        ?.status,
    ).toBe("NOT_GRANT");
  });

  it("puts the digest rule ahead of the marker", () => {
    // "ГУРТ ГРАНТИ – дайджест" contains a grant word and is still not a grant.
    const verdict = classifyByRule("ГУРТ ГРАНТИ – дайджест актуальних можливостей");
    expect(verdict?.note).toMatch(/дайджест/);
  });

  it("always explains itself, because a rejection needs a note", () => {
    expect(classifyByRule("Закупівля послуг страхування")?.note.length).toBeGreaterThan(0);
  });
});

describe("classifyByRule — deferred to the agent", () => {
  it("defers a title with no leading marker", () => {
    // The real Громадський Простір case: nothing in the title settles it.
    expect(classifyByRule("Шкільні набори з канцелярським та супутнім наповненням")).toBeNull();
    expect(
      classifyByRule("Від ідеї до реальних змін: набір до Школи адвокації «DOCU ДІЄ 6.0»"),
    ).toBeNull();
  });

  it("does not fire on a keyword buried mid-title", () => {
    // A grant call may well mention procurement in passing. Only an item that
    // *is* a procurement notice says so first.
    expect(
      classifyByRule("Гранти на закупівлю обладнання для громадських організацій"),
    ).toBeNull();
  });

  it("defers rather than guessing at an ambiguous framing", () => {
    expect(classifyByRule("Підтримка ініціатив ОГС у прифронтових громадах")).toBeNull();
  });
});
