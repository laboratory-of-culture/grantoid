/**
 * These exist because the bug they cover shipped: the profile header rendered
 * "Чернівецька область область" for a value stored in full, and would have
 * rendered "м. Київ область" for an NGO in Kyiv.
 */

import { describe, expect, it } from "vitest";

import { formatOblast } from "./place";

describe("formatOblast", () => {
  it("appends the word to a bare adjective", () => {
    expect(formatOblast("Чернівецька")).toBe("Чернівецька область");
    expect(formatOblast("Львівська")).toBe("Львівська область");
  });

  it("does not append it twice when the value already carries it", () => {
    expect(formatOblast("Чернівецька область")).toBe("Чернівецька область");
    expect(formatOblast("Чернівецька ОБЛАСТЬ")).toBe("Чернівецька ОБЛАСТЬ");
    expect(formatOblast("  Львівська область  ")).toBe("Львівська область");
  });

  it("recognises the word in its other forms", () => {
    // A fact extracted from a document may keep the case the sentence used.
    expect(formatOblast("Чернівецької області")).toBe("Чернівецької області");
  });

  it("leaves cities with special status alone", () => {
    expect(formatOblast("м. Київ")).toBe("м. Київ");
    expect(formatOblast("Київ")).toBe("Київ");
    expect(formatOblast("м. Севастополь")).toBe("м. Севастополь");
  });

  it("leaves the Autonomous Republic of Crimea alone", () => {
    expect(formatOblast("Автономна Республіка Крим")).toBe("Автономна Республіка Крим");
    expect(formatOblast("АР Крим")).toBe("АР Крим");
  });

  it("does not fire on a word that merely contains the letters", () => {
    // "Кіровоградська" contains no "област", but a value like this one guards
    // against a pattern loose enough to match inside another word.
    expect(formatOblast("Приобластна")).toBe("Приобластна область");
  });

  it("returns null for nothing, rather than a dangling word", () => {
    expect(formatOblast(null)).toBeNull();
    expect(formatOblast(undefined)).toBeNull();
    expect(formatOblast("   ")).toBeNull();
  });
});
