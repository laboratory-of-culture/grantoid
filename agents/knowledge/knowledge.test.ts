/**
 * The extraction agent's guard rails, tested without a model.
 *
 * The model call itself is covered by fixtures; what has to be right regardless
 * of which model runs is that a fact cannot enter the knowledge base without a
 * quotation that is genuinely in the document.
 */

import { describe, expect, it } from "vitest";

import { Extraction } from "./output";
import { filterToVerbatim } from "./index";
import { extractText } from "../../packages/documents/text";

const STATUT = [
  "СТАТУТ ГРОМАДСЬКОЇ ОРГАНІЗАЦІЇ «ПОРОГИ»",
  "",
  "1.1. Громадська організація «Пороги» (далі — Організація) є неприбутковою",
  "громадською організацією, створеною відповідно до законодавства України.",
  "",
  "1.4. Організація зареєстрована в місті Житомир, Житомирська область.",
  "",
  "2.1. Метою Організації є розвиток сучасної культурної сцени регіону.",
].join("\n");

function fact(over: Partial<Extraction["facts"][number]> = {}) {
  return {
    key: "legal_form",
    state: "SELF_REPORTED" as const,
    valueText: "Громадська організація",
    quote: "є неприбутковою громадською організацією",
    page: null,
    confidence: 0.9,
    ...over,
  };
}

describe("filterToVerbatim", () => {
  it("keeps a fact whose quotation is in the document", () => {
    const { kept, discarded } = filterToVerbatim([fact()], STATUT);
    expect(kept).toHaveLength(1);
    expect(discarded).toHaveLength(0);
  });

  it("keeps a quotation that crosses a line break", () => {
    // Extraction collapses whitespace; the model quotes the sentence as it
    // reads, not as it is wrapped. Matching has to survive that.
    const { kept } = filterToVerbatim(
      [fact({ quote: "неприбутковою громадською організацією, створеною відповідно" })],
      STATUT,
    );
    expect(kept).toHaveLength(1);
  });

  it("discards a fluent quotation the document never contained", () => {
    const invented = fact({
      key: "international_partners",
      valueText: "Партнер у Польщі",
      quote: "Організація співпрацює з польськими партнерами з 2021 року.",
    });
    const { kept, discarded } = filterToVerbatim([invented], STATUT);
    expect(kept).toHaveLength(0);
    expect(discarded[0]?.key).toBe("international_partners");
    expect(discarded[0]?.reason).toMatch(/does not appear/);
  });

  it("discards a paraphrase of a real sentence", () => {
    // The value would be right. The sentence is not in the document, so it is
    // not evidence, and a reviewer would have no way to check it.
    const paraphrase = fact({
      quote: "Організація є неприбутковою за своєю правовою формою.",
    });
    expect(filterToVerbatim([paraphrase], STATUT).kept).toHaveLength(0);
  });

  it("keeps and discards independently within one document", () => {
    const { kept, discarded } = filterToVerbatim(
      [fact(), fact({ key: "team_size", valueText: "6", quote: "У штаті шість осіб." })],
      STATUT,
    );
    expect(kept).toHaveLength(1);
    expect(discarded).toHaveLength(1);
  });
});

describe("Extraction schema", () => {
  const base = { documentSummary: "Статут організації", unreadable: false };

  it("rejects a fact with no quotation", () => {
    const r = Extraction.safeParse({ ...base, facts: [fact({ quote: "  " })] });
    expect(r.success).toBe(false);
  });

  it("rejects the same key extracted twice", () => {
    const r = Extraction.safeParse({ ...base, facts: [fact(), fact({ valueText: "інше" })] });
    expect(r.success).toBe(false);
  });

  it("rejects a key that is not in the registry", () => {
    const r = Extraction.safeParse({ ...base, facts: [fact({ key: "favourite_colour" })] });
    expect(r.success).toBe(false);
  });

  it("cannot express CONFIRMED — only a person confirms", () => {
    const r = Extraction.safeParse({
      ...base,
      facts: [{ ...fact(), state: "CONFIRMED" }],
    });
    expect(r.success).toBe(false);
  });
});

describe("extractText", () => {
  const bytes = (s: string) => new TextEncoder().encode(s);

  it("reads plain text and normalises whitespace", async () => {
    const r = await extractText("text/plain", bytes(STATUT));
    expect(r.text).toContain("Громадська організація «Пороги»");
    expect(r.emptyReason).toBeNull();
  });

  it("flags a file with no usable text rather than returning an empty string", async () => {
    const r = await extractText("text/plain", bytes("   \n\n  "));
    expect(r.emptyReason).toMatch(/скан/);
  });

  it("refuses a format it cannot read", async () => {
    const r = await extractText("image/png", bytes("binary"));
    expect(r.emptyReason).toMatch(/не підтримується/);
  });
});
