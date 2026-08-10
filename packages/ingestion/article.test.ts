/**
 * The case these guard is the sidebar: an announcement page carries other
 * announcements, each with its own deadline and sums, and a model handed the
 * whole page will merge them into one confident answer.
 */

import { describe, expect, it } from "vitest";

import { MAX_ARTICLE_CHARS, articleText, decodeEntities } from "./article";

const WITH_SIDEBAR = `
<html><body>
  <nav><a href="/">Головна</a><a href="/grants">Гранти</a></nav>
  <div class="layout">
    <article>
      <h1>Гранти на розвиток громад</h1>
      <p>Фонд оголошує конкурс для громадських організацій, зареєстрованих в Україні.</p>
      <p>Кінцевий термін подання — 15 вересня 2026 року. Максимальна сума становить 500 000 грн.</p>
    </article>
    <aside class="related">
      <h3>Схожі оголошення</h3>
      <p>Інший конкурс: дедлайн 1 березня 2026, сума до 2 000 000 євро.</p>
    </aside>
  </div>
  <footer><p>© ГУРТ</p></footer>
</body></html>`;

describe("articleText", () => {
  it("keeps the announcement and drops the sidebar that would corrupt it", () => {
    const { text } = articleText(WITH_SIDEBAR);

    expect(text).toContain("Кінцевий термін подання — 15 вересня 2026 року");
    expect(text).toContain("500 000 грн");

    // The numbers that belong to a different call must not be present at all.
    expect(text).not.toContain("2 000 000 євро");
    expect(text).not.toContain("1 березня");
  });

  it("drops chrome that is not the announcement", () => {
    const { text } = articleText(WITH_SIDEBAR);
    expect(text).not.toContain("Головна");
    expect(text).not.toContain("© ГУРТ");
  });

  it("reports how the body was found", () => {
    expect(articleText(WITH_SIDEBAR).strategy).toBe("declared");
  });

  it("falls back to the densest block when nothing is declared", () => {
    const html = `<html><body>
      <div class="menu"><a>Гранти</a><a>Тендери</a><a>Вакансії</a></div>
      <div class="body">
        <p>${"Організація може подати заявку на реалізацію проєкту у сфері культури. ".repeat(6)}</p>
      </div>
    </body></html>`;

    const article = articleText(html);
    expect(article.strategy).toBe("density");
    expect(article.text).toContain("у сфері культури");
    expect(article.text).not.toContain("Вакансії");
  });

  it("returns the whole page rather than nothing when every heuristic fails", () => {
    const article = articleText("<html><body>Коротке оголошення без розмітки.</body></html>");
    expect(article.strategy).toBe("whole-page");
    expect(article.text).toContain("Коротке оголошення");
  });

  it("marks truncation instead of hiding it", () => {
    const long = `<article><p>${"Умови участі у конкурсі. ".repeat(2000)}</p></article>`;
    const article = articleText(long);

    expect(article.truncated).toBe(true);
    expect(article.text.length).toBe(MAX_ARTICLE_CHARS);
  });

  it("does not mark truncation for a page that fits", () => {
    expect(articleText(WITH_SIDEBAR).truncated).toBe(false);
  });
});

describe("decodeEntities", () => {
  it("decodes the syntax rather than a list of names", () => {
    // Live data arrived as "комп&#8217;ютерної" — a numeric reference, which no
    // hand-written list of four named entities would ever have covered.
    expect(decodeEntities("комп&#8217;ютерної")).toBe("комп’ютерної");
    expect(decodeEntities("&#x43F;&#x440;&#x438;")).toBe("при");
    expect(decodeEntities("&laquo;Лабораторія&raquo;")).toBe("«Лабораторія»");
  });

  it("decodes the ampersand last, so an escaped entity stays escaped", () => {
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
  });
});
