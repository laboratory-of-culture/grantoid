/**
 * The rules half of the writing review.
 *
 * Half these tests assert that nothing is flagged. That ratio is the design: a
 * reviewer which fires on every second sentence gets switched off within a week,
 * and then the findings that mattered go unread with the rest.
 */

import { describe, expect, it } from "vitest";

import {
  MAX_SENTENCE_WORDS,
  countWords,
  ruleFindings,
  sentences,
  spansFor,
  verifiedFindings,
} from "./writing-checks";

describe("ruleFindings — marketing language", () => {
  it("flags a word that sells instead of describing", () => {
    const found = ruleFindings("Ми пропонуємо інноваційний підхід до збереження спадщини.");
    expect(found).toHaveLength(1);
    expect(found[0]?.category).toBe("MARKETING");
    expect(found[0]?.quote).toBe("інноваційний");
  });

  it("matches across Ukrainian endings", () => {
    // `\b` is defined through `\w`, which holds no Cyrillic — the fourth time
    // this has mattered in this codebase.
    expect(ruleFindings("унікальна методика")).toHaveLength(1);
    expect(ruleFindings("унікальні можливості")).toHaveLength(1);
    expect(ruleFindings("інноваційних рішень")).toHaveLength(1);
  });

  it("counts the same empty word twice as one problem", () => {
    const found = ruleFindings("Унікальний проєкт. Унікальний результат.");
    expect(found).toHaveLength(1);
  });

  it("always says what to do instead", () => {
    const found = ruleFindings("найкращий інструмент");
    expect(found[0]?.suggestionUk).toBeTruthy();
  });
});

describe("ruleFindings — vague phrasing", () => {
  it("flags a phrase that commits to nothing", () => {
    const found = ruleFindings("Проєкт забезпечить значне покращення ситуації в громаді.");
    expect(found.map((f) => f.category)).toContain("VAGUE");
  });

  it("leaves an ordinary word alone", () => {
    // «покращення» on its own is normal Ukrainian. Only the empty compound is
    // worth interrupting someone over.
    expect(ruleFindings("Покращення доступу до архівів для мешканців сіл.")).toEqual([]);
  });

  it("flags a list that refuses to be a list", () => {
    const found = ruleFindings("Буде проведено низку заходів для молоді.");
    expect(found.map((f) => f.category)).toContain("VAGUE");
  });
});

describe("ruleFindings — sentence length", () => {
  it("flags a sentence past the limit", () => {
    const long = `Проєкт ${"слово ".repeat(MAX_SENTENCE_WORDS + 5)}кінець.`;
    const found = ruleFindings(long);
    expect(found.map((f) => f.category)).toContain("LONG_SENTENCE");
  });

  it("leaves a normal sentence alone", () => {
    expect(
      ruleFindings("Організація проведе чотири експедиції до сіл Буковини."),
    ).toEqual([]);
  });

  it("offers no replacement for a long sentence", () => {
    // Splitting one well requires knowing which half matters, which is a
    // judgement about the project rather than about the prose.
    const long = `Проєкт ${"слово ".repeat(MAX_SENTENCE_WORDS + 5)}кінець.`;
    const finding = ruleFindings(long).find((f) => f.category === "LONG_SENTENCE");
    expect(finding?.suggestionUk).toBeNull();
  });
});

describe("ruleFindings — padding", () => {
  it("flags a significance claim bolted onto a fact", () => {
    const found = ruleFindings("Культурна спадщина відіграє ключову роль у відновленні громад.");
    expect(found.map((f) => f.category)).toContain("PADDING");
  });

  it("flags «має вирішальне значення»", () => {
    const found = ruleFindings("Участь громади має вирішальне значення для проєкту.");
    expect(found.map((f) => f.category)).toContain("PADDING");
  });

  it("flags an evaluative дієприслівниковий зворот at a sentence's end", () => {
    const found = ruleFindings(
      "Проєкт оцифрує архів, забезпечуючи доступ до нього для дослідників.",
    );
    const padding = found.find((f) => f.category === "PADDING");
    expect(padding?.quote).toBe("забезпечуючи");
  });

  it("leaves an ordinary дієприслівник alone", () => {
    // «записуючи» here is a plain action, not evaluative padding.
    expect(
      ruleFindings("Волонтери обійдуть село, записуючи спогади старожилів."),
    ).toEqual([]);
  });

  it("does not flag a plain factual role", () => {
    expect(
      ruleFindings("Музей виконує роль архіву для трьох сільських громад."),
    ).toEqual([]);
  });
});

describe("ruleFindings — silence on clean text", () => {
  it("says nothing about a concrete paragraph", () => {
    const clean = [
      "Організація проведе чотири експедиції до сіл Сторожинецької громади.",
      "Учасники оцифрують предмети побуту та запишуть спогади старожилів.",
      "Матеріали передадуть до районного музею.",
    ].join(" ");
    expect(ruleFindings(clean)).toEqual([]);
  });
});

describe("sentences and countWords", () => {
  it("splits on sentence enders and keeps the sentence whole", () => {
    expect(sentences("Перше речення. Друге речення!")).toEqual([
      "Перше речення.",
      "Друге речення!",
    ]);
  });

  it("counts words, not punctuation", () => {
    expect(countWords("Один, два — три.")).toBe(3);
  });
});

describe("verifiedFindings", () => {
  const text = "Організація працює у сфері культури.";

  it("keeps a finding whose span is in the text", () => {
    const kept = verifiedFindings(
      [{ quote: "у сфері культури", category: "VAGUE", whyUk: "", suggestionUk: null, source: "AI" }],
      text,
    );
    expect(kept).toHaveLength(1);
  });

  it("drops a span the model invented", () => {
    // The same gate a citation passes. A highlight the screen cannot draw is a
    // finding it must not claim.
    const kept = verifiedFindings(
      [{ quote: "у сфері спорту", category: "VAGUE", whyUk: "", suggestionUk: null, source: "AI" }],
      text,
    );
    expect(kept).toEqual([]);
  });

  it("drops a span too short to highlight", () => {
    const kept = verifiedFindings(
      [{ quote: "у", category: "VAGUE", whyUk: "", suggestionUk: null, source: "AI" }],
      text,
    );
    expect(kept).toEqual([]);
  });
});

describe("spansFor", () => {
  const text = "Ми пропонуємо інноваційний та унікальний підхід.";

  it("returns positions in reading order", () => {
    const spans = spansFor(ruleFindings(text), text);
    expect(spans.map((s) => s.finding.quote)).toEqual(["інноваційний", "унікальний"]);
    expect(spans[0]!.start).toBeLessThan(spans[1]!.start);
  });

  it("keeps the longer span when two overlap", () => {
    // Two highlights over the same words cannot both be clicked, and the longer
    // one carries more context.
    const spans = spansFor(
      [
        { quote: "інноваційний та унікальний підхід", category: "VAGUE", whyUk: "", suggestionUk: null, source: "AI" },
        { quote: "унікальний", category: "MARKETING", whyUk: "", suggestionUk: null, source: "RULE" },
      ],
      text,
    );
    expect(spans).toHaveLength(1);
    expect(spans[0]?.finding.quote).toBe("інноваційний та унікальний підхід");
  });

  it("skips a finding whose span is absent rather than throwing", () => {
    const spans = spansFor(
      [{ quote: "якого тут немає", category: "VAGUE", whyUk: "", suggestionUk: null, source: "AI" }],
      text,
    );
    expect(spans).toEqual([]);
  });
});
