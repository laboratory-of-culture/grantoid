/**
 * Turning an announcement page into the text of one announcement.
 *
 * The hard part is not stripping tags. It is that a ГУРТ or Простір page carries
 * a sidebar of *other* grant announcements, each with its own deadline and its
 * own sums. Feed the whole page to a model and it will merge two calls into one
 * confidently — a deadline from the sidebar attached to the grant in the body is
 * worse than no deadline at all, because it looks like an answer.
 *
 * So the body is chosen by text density before anything is read: the element
 * carrying the most paragraph text wins, and everything else is discarded.
 */

/**
 * Characters of article text handed to the model.
 *
 * NUM_CTX is 16384 tokens and Ukrainian runs roughly two to three characters per
 * token, so this leaves room for the system prompt and the answer with margin.
 * Overflow throws in the Ollama seam rather than truncating silently, and this
 * cap is what keeps that from happening on a long page.
 */
export const MAX_ARTICLE_CHARS = 12_000;

/** Removed entirely: none of it is the announcement. */
const NOISE =
  /<(script|style|nav|header|footer|aside|form|noscript|iframe|svg|button)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Block-level tags that should become a line break rather than a space. */
const BLOCKS = /<\/(p|div|section|article|li|tr|h[1-6]|blockquote|dd|dt|td|br)\s*>/gi;

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    // Ampersand last: decoding it first would turn "&amp;lt;" into "<".
    .replace(/&amp;/gi, "&");
}

function toText(html: string): string {
  return decodeEntities(
    html
      .replace(BLOCKS, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Candidate content blocks, largest text first.
 *
 * `<article>` and the schema.org body marker are tried first because when a page
 * declares where its content is, guessing is strictly worse. Only if neither
 * exists does density decide.
 */
function candidates(html: string): string[] {
  const found: string[] = [];

  for (const pattern of [
    /<article\b[^>]*>([\s\S]*?)<\/article>/gi,
    /<div\b[^>]*itemprop=["']articleBody["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<div\b[^>]*class=["'][^"']*(?:entry-content|post-content|article-body|news-detail|content-text)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
  ]) {
    for (const match of html.matchAll(pattern)) {
      if (match[1]) found.push(match[1]);
    }
    if (found.length > 0) return found;
  }

  return [];
}

export type Article = {
  text: string;
  /** True when the text was cut at MAX_ARTICLE_CHARS. Recorded, never hidden. */
  truncated: boolean;
  /** How the body was located, for when an extraction turns out to be wrong. */
  strategy: "declared" | "density" | "whole-page";
};

/**
 * Extract the announcement text from a page.
 *
 * Never throws on odd markup: a page that defeats every heuristic yields the
 * whole stripped document with `strategy: "whole-page"`, which is honest about
 * being the weakest case rather than silently returning nothing.
 */
export function articleText(html: string): Article {
  const cleaned = html.replace(NOISE, " ").replace(/<!--[\s\S]*?-->/g, " ");

  const declared = candidates(cleaned)
    .map(toText)
    .filter((t) => t.length > 0)
    .sort((a, b) => b.length - a.length);

  let text: string;
  let strategy: Article["strategy"];

  if (declared.length > 0 && declared[0]) {
    text = declared[0];
    strategy = "declared";
  } else {
    // Density: the div holding the most paragraph text. Paragraphs rather than
    // all text, because a sidebar of links has plenty of characters and almost
    // no prose.
    const blocks = [...cleaned.matchAll(/<div\b[^>]*>([\s\S]*?)<\/div>/gi)]
      .map((m) => m[1] ?? "")
      .map((inner) => ({
        inner,
        prose: [...inner.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
          .map((p) => toText(p[1] ?? ""))
          .join("\n"),
      }))
      .filter((b) => b.prose.length > 0)
      .sort((a, b) => b.prose.length - a.prose.length);

    if (blocks.length > 0 && blocks[0] && blocks[0].prose.length >= 200) {
      text = blocks[0].prose;
      strategy = "density";
    } else {
      text = toText(cleaned);
      strategy = "whole-page";
    }
  }

  const truncated = text.length > MAX_ARTICLE_CHARS;
  return {
    text: truncated ? text.slice(0, MAX_ARTICLE_CHARS) : text,
    truncated,
    strategy,
  };
}
