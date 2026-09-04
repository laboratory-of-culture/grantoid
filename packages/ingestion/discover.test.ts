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

/**
 * grant.market wraps the whole card in the anchor, so the link text arrives as
 * the headline with the card's own furniture around it. Taken verbatim from the
 * live listing.
 */
describe("parseHtmlList — card furniture", () => {
  const HTML_CARDS = `
    <a href="/opp/culture-helps-solidarity">Нове # 1565 Грант до €30 000 на проєкти міжнародної співпраці у сфері культури 10.11.2026</a>
    <a href="/opp/trajectory-3">Оновлено # 1513 Грант до 1 млн грн на розвиток власної справи для ветеранського бізнесу 07.09.2026</a>
    <a href="/opp/compensation-program">Нове # 1564 Грант до 100% компенсації ЄСВ на створення нових робочих місць Безстроково</a>
    <a href="/opp/no-badge"># 1550 Безкоштовна участь у навчальній програмі розвитку бізнесу</a>
    <a href="/opp/x">Нове # 1500 2026</a>
    <a href="/contacts">Контакти сайту грант маркет</a>`;

  const NOISE = [
    /^(?:нове|оновлено)?\s*#\s*\d+\s*/iu,
    /\s*(?:\d{2}\.\d{2}\.\d{4}|безстроково)$/iu,
  ];
  const items = parseHtmlList(HTML_CARDS, "https://grant.market/", /\/opp\/[a-z0-9-]+/i, NOISE);

  it("drops the badge and the site's own record number", () => {
    expect(items[0]?.title).toBe(
      "Грант до €30 000 на проєкти міжнародної співпраці у сфері культури",
    );
    expect(items[1]?.title).toBe(
      "Грант до 1 млн грн на розвиток власної справи для ветеранського бізнесу",
    );
  });

  it("drops the trailing deadline, dated or open-ended", () => {
    expect(items.map((i) => i.title).join(" ")).not.toMatch(/\d{2}\.\d{2}\.\d{4}|езстроково/);
    expect(items[2]?.title).toBe(
      "Грант до 100% компенсації ЄСВ на створення нових робочих місць",
    );
  });

  it("drops a card that was nothing but furniture", () => {
    // Stripping runs before the length test, so «Нове # 1500 2026» leaves
    // nothing worth storing rather than a title reading «2026».
    expect(items.map((i) => i.externalId)).not.toContain("/opp/x");
  });

  // Only the newest and recently edited cards carry a badge word; nine of the
  // twenty-four on the live listing had none, and requiring it left the record
  // number standing at the front of the title.
  it("strips the record number on a card with no badge", () => {
    const noBadge = items.find((i) => i.externalId === "/opp/no-badge");
    expect(noBadge?.title).toBe("Безкоштовна участь у навчальній програмі розвитку бізнесу");
  });

  it("still ignores links outside the pattern", () => {
    expect(items.every((i) => i.externalId.startsWith("/opp/"))).toBe(true);
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
