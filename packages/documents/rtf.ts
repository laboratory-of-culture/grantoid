/**
 * Writing RTF, because a concept note leaves this product to be edited.
 *
 * Markdown was the first choice and the wrong one. It reads as source to
 * everyone outside software: a grant manager opens the file, sees `## Мета
 * проєкту` and hashes in front of every heading, and either sends that to a
 * donor or spends ten minutes cleaning it. RTF opens in Word, Google Docs,
 * LibreOffice and Pages with real headings, and stays editable — which is the
 * point, since every line of it is a draft.
 *
 * Not DOCX: a zip container with a dozen XML parts, for a document that is
 * headings and paragraphs. Not PDF: a concept note that cannot be edited is a
 * concept note nobody will correct.
 *
 * The whole file is 7-bit ASCII. RTF has no encoding declaration worth
 * trusting — readers guess a code page — so every character above 127 is
 * written as a \uN? escape with an ASCII fallback. For Ukrainian that means
 * nearly every letter, and it is still the only form that opens identically
 * everywhere.
 */

const BACKSLASH = String.fromCharCode(92);

/** Escape one string into RTF's 7-bit form. */
export function rtfEscape(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0)!;

    if (char === BACKSLASH || char === "{" || char === "}") {
      out += BACKSLASH + char;
    } else if (char === "\n") {
      out += BACKSLASH + "line ";
    } else if (code < 128) {
      out += char;
    } else if (code <= 0xffff) {
      // Signed 16-bit: readers that predate Unicode expect the negative form.
      const signed = code > 32767 ? code - 65536 : code;
      out += BACKSLASH + "u" + signed + "?";
    } else {
      // Outside the BMP — a surrogate pair, each half escaped. Emoji in a
      // concept note is unlikely; a mangled file because of one is not worth
      // risking.
      const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
      const low = ((code - 0x10000) % 0x400) + 0xdc00;
      out += BACKSLASH + "u" + (high - 65536) + "?" + BACKSLASH + "u" + (low - 65536) + "?";
    }
  }
  return out;
}

export type RtfBlock =
  | { kind: "title"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "note"; text: string }
  | { kind: "warning"; text: string };

/**
 * Assemble a document from blocks.
 *
 * Half-points throughout (fs28 is 14pt) because that is RTF's unit, and twips
 * for spacing (sa240 is 12pt after). Deliberately plain: one serif family,
 * three sizes, bold for headings. The design system does not follow the file
 * out of the product, and a document pretending to be designed is a document
 * that looks finished.
 */
export function renderRtf(blocks: readonly RtfBlock[]): string {
  const head =
    String.raw`{\rtf1\ansi\ansicpg1251\deff0` +
    String.raw`{\fonttbl{\f0\froman\fcharset204 Times New Roman;}}` +
    String.raw`{\colortbl;\red32\green30\blue29;\red150\green40\blue20;}` +
    String.raw`\viewkind4\uc1\lang1058\f0\fs24`;

  const body = blocks
    .map((block) => {
      const text = rtfEscape(block.text);
      switch (block.kind) {
        case "title":
          return String.raw`\pard\sa360\qc\b\fs36 ` + text + String.raw`\b0\fs24\par`;
        case "heading":
          return String.raw`\pard\sb240\sa120\b\fs28 ` + text + String.raw`\b0\fs24\par`;
        case "paragraph":
          return String.raw`\pard\sa240\qj ` + text + String.raw`\par`;
        case "warning":
          // Boxed and coloured, because this one has to survive being skimmed.
          return (
            String.raw`\pard\sb240\sa240\box\brdrs\brdrw20\cf2\b ` +
            text +
            String.raw`\b0\cf0\par\pard`
          );
        case "note":
          return String.raw`\pard\sb360\sa120\i\fs20 ` + text + String.raw`\i0\fs24\par`;
      }
    })
    .join("\n");

  return head + "\n" + body + "\n}";
}
