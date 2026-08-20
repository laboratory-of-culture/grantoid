/**
 * The three forms, and the 11–14 trap that catches every hand-rolled version.
 */

import { describe, expect, it } from "vitest";

import { NOUN_UK, countUk, pluralUk } from "./locale-uk";

describe("pluralUk", () => {
  it("uses the one form for 1, 21, 31", () => {
    for (const n of [1, 21, 31, 101]) {
      expect(pluralUk(n, NOUN_UK.criterion)).toBe("умова");
    }
  });

  it("uses the few form for 2-4 and 22-24", () => {
    for (const n of [2, 3, 4, 22, 34]) {
      expect(pluralUk(n, NOUN_UK.criterion)).toBe("умови");
    }
  });

  it("uses the many form for 0 and 5-20", () => {
    for (const n of [0, 5, 9, 20, 25]) {
      expect(pluralUk(n, NOUN_UK.criterion)).toBe("умов");
    }
  });

  it("does not fall for 11-14, which look like 1-4", () => {
    for (const n of [11, 12, 13, 14, 111, 112]) {
      expect(pluralUk(n, NOUN_UK.criterion)).toBe("умов");
    }
  });

  it("puts the count in front", () => {
    expect(countUk(1, NOUN_UK.field)).toBe("1 поле");
    expect(countUk(3, NOUN_UK.document)).toBe("3 документи");
    expect(countUk(12, NOUN_UK.opportunity)).toBe("12 можливостей");
  });
});
