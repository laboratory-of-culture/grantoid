/**
 * The three forms, and the 11–14 trap that catches every hand-rolled version.
 */

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { NOUN_UK, countUk, formatIsoDateUk, normalizeDateUk, pluralUk } from "./locale-uk";

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

describe("normalizeDateUk", () => {
  it("passes ISO through", () => {
    expect(normalizeDateUk("2019-03-15")).toBe("2019-03-15");
    expect(normalizeDateUk("зареєстровано 2019-03-15")).toBe("2019-03-15");
  });

  it("reads the form a statute uses", () => {
    expect(normalizeDateUk("15 березня 2019 року")).toBe("2019-03-15");
    expect(normalizeDateUk("«15» березня 2019 р.")).toBe("2019-03-15");
    expect(normalizeDateUk("1 січня 2020")).toBe("2020-01-01");
  });

  it("reads the numeric short forms", () => {
    expect(normalizeDateUk("15.03.2019")).toBe("2019-03-15");
    expect(normalizeDateUk("5/3/2019")).toBe("2019-03-05");
  });

  it("returns null rather than guess a missing year", () => {
    expect(normalizeDateUk("15 березня")).toBeNull();
    expect(normalizeDateUk("")).toBeNull();
    expect(normalizeDateUk(null)).toBeNull();
    expect(normalizeDateUk("нещодавно")).toBeNull();
  });

  it("rejects a date that is not on the calendar", () => {
    expect(normalizeDateUk("30.02.2019")).toBeNull();
    expect(normalizeDateUk("2019-13-01")).toBeNull();
  });
});

describe("formatIsoDateUk", () => {
  it("shows a stored ISO value the Ukrainian way", () => {
    expect(formatIsoDateUk("2019-03-15")).toBe("15 березня 2019 р.");
  });

  it("leaves a non-ISO value alone rather than blanking it", () => {
    expect(formatIsoDateUk("15 березня 2019")).toBe("15 березня 2019");
  });

  // A calendar date must not shift with the reader's clock. Parsed as UTC
  // midnight it does — and that is not theoretical here: the app container runs
  // in UTC while the confirm queue is a client component, so a browser west of
  // Greenwich would hydrate the previous day over the server's own markup.
  //
  // Run in a child process because a zone has to be chosen before Intl caches
  // one, which a test inside this process is already too late to do.
  it("names the same day in a timezone west of Greenwich", () => {
    const here = resolve(__dirname, "locale-uk.ts");
    const out = execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--no-warnings",
        "-e",
        `import("${here}").then((m) => console.log(m.formatIsoDateUk("2019-03-15")));`,
      ],
      { env: { ...process.env, TZ: "America/New_York" }, encoding: "utf8" },
    );
    expect(out.trim()).toBe("15 березня 2019 р.");
  });
});
