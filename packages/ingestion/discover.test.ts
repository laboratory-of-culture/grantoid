/**
 * Discovery parsers, tested against the shapes the two real sources actually
 * produce rather than against invented ones.
 */

import { describe, expect, it } from "vitest";

import { DiscoveryFailed, parseHtmlList, parseRss, stripRubric } from "./discover";

/** Shaped after the Громадський Простір post-type feed. */
const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Громадський Простір</title>
  <item>
    <title>Закупівля комп&#8217;ютерної техніки</title>
    <link>https://www.prostir.ua/?grants=zakupivlya</link>
    <guid isPermaLink="false">https://www.prostir.ua/?post_type=grants&#038;p=123</guid>
    <pubDate>Mon, 10 Aug 2026 13:58:21 +0000</pubDate>
    <description>&lt;p&gt;Оголошено &#8220;відкритий&#8221; конкурс&lt;/p&gt;</description>
  </item>
  <item>
    <title>Гранти на розвиток громад</title>
    <link>https://www.prostir.ua/?grants=hranty</link>
    <guid isPermaLink="false">https://www.prostir.ua/?post_type=grants&#038;p=124</guid>
    <pubDate>Sun, 09 Aug 2026 10:00:00 +0000</pubDate>
  </item>
</channel></rss>`;

/** Shaped after the ГУРТ listing: a thumbnail anchor and a headline anchor. */
const HTML = `
<div class="news">
  <a href="/news/grants/112221/"><img src="/img/x.jpg"></a>
  <a href="/news/grants/112221/">ГРАНТ Гранти на створення можливостей активної гри дітей</a>
  <a href="/news/grants/112211/">ТЕНДЕР Запит цінових пропозицій на закупівлю комп&#8217;ютерної техніки</a>
  <a href="/news/vacancies/99001/">ВАКАНСІЯ Менеджер проєктів</a>
  <a href="/about/">Про нас</a>
</div>`;

describe("parseRss", () => {
  const items = parseRss(RSS);

  it("reads every item", () => {
    expect(items).toHaveLength(2);
  });

  it("decodes numeric entities in titles", () => {
    // The first version listed four named entities by hand and stored
    // `комп&#8217;ютерної` verbatim.
    expect(items[0]?.title).toBe("Закупівля комп’ютерної техніки");
  });

  it("decodes entities inside the description and strips its markup", () => {
    expect(items[0]?.summary).toBe("Оголошено “відкритий” конкурс");
  });

  it("prefers the guid over the link as the identity", () => {
    // A retitled or re-slugged item must not be re-announced as new.
    expect(items[0]?.externalId).toContain("p=123");
  });

  it("parses the publication date", () => {
    expect(items[0]?.publishedAt?.getUTCFullYear()).toBe(2026);
  });

  it("survives an item with no description", () => {
    expect(items[1]?.summary).toBeNull();
  });

  it("gives two items different content hashes", () => {
    expect(items[0]?.contentHash).not.toBe(items[1]?.contentHash);
  });

  it("refuses something that is not a feed", () => {
    expect(() => parseRss("<html><body>not a feed</body></html>")).toThrow(DiscoveryFailed);
  });
});

describe("parseHtmlList", () => {
  const items = parseHtmlList(HTML, "https://gurt.org.ua/news/grants/", /\/news\/grants\/\d+\//);

  it("takes only links matching the article pattern", () => {
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.title.slice(0, 6))).toEqual(["ГРАНТ ", "ТЕНДЕР"]);
  });

  it("keeps the headline anchor and drops the thumbnail one", () => {
    // Both link the same article; only one carries text worth storing.
    expect(items.filter((i) => i.externalId === "/news/grants/112221/")).toHaveLength(1);
    expect(items[0]?.title).toContain("активної гри");
  });

  it("resolves relative links against the listing page", () => {
    expect(items[0]?.url).toBe("https://gurt.org.ua/news/grants/112221/");
  });

  it("uses the path as the identity, so a retitled article is not re-announced", () => {
    expect(items[0]?.externalId).toBe("/news/grants/112221/");
  });

  it("decodes entities here too", () => {
    expect(items[1]?.title).toContain("комп’ютерної");
  });
});

describe("stripRubric", () => {
  it("drops the portal's section label", () => {
    // Both taken from the live ГУРТ listing.
    expect(stripRubric("ГРАНТ Гранти на розвиток адаптивного спорту для ветеранів")).toBe(
      "Гранти на розвиток адаптивного спорту для ветеранів",
    );
    expect(stripRubric("КОНКУРС Відкрийте мобільний дитячий садок у своїй громаді!")).toBe(
      "Відкрийте мобільний дитячий садок у своїй громаді!",
    );
  });

  it("keeps a first word that is part of the sentence", () => {
    // Lower case after the first letter — a word, not a label.
    expect(stripRubric("Грант на посилення ролі громадських організацій")).toBe(
      "Грант на посилення ролі громадських організацій",
    );
  });

  it("leaves a title with no label alone", () => {
    expect(stripRubric("Набір громадських організацій для участі у програмі")).toBe(
      "Набір громадських організацій для участі у програмі",
    );
  });
});
