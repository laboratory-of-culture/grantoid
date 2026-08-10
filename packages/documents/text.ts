/**
 * Document bytes to text.
 *
 * Deliberately small: three formats, no OCR, no layout reconstruction. The
 * agent reading this text needs sentences it can quote verbatim, and every
 * clever transformation between the file and the quote is another way for a
 * quotation to stop matching its source.
 */

export type ExtractedText = {
  text: string;
  pageCount: number | null;
  /** Set when the file parsed but produced nothing usable — usually a scan. */
  emptyReason: string | null;
};

/** Below this, there is nothing an extraction agent could read. */
const MIN_USEFUL_CHARS = 40;

export async function extractText(
  mimeType: string,
  bytes: Uint8Array,
): Promise<ExtractedText> {
  switch (mimeType) {
    case "text/plain":
      return finish(new TextDecoder("utf-8").decode(bytes), null);

    case "application/pdf":
      return extractPdf(bytes);

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/msword":
      return extractDocx(bytes);

    default:
      return {
        text: "",
        pageCount: null,
        emptyReason: `формат ${mimeType} не підтримується`,
      };
  }
}

async function extractPdf(bytes: Uint8Array): Promise<ExtractedText> {
  const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await pdfText(pdf, { mergePages: true });
  return finish(text, totalPages);
}

async function extractDocx(bytes: Uint8Array): Promise<ExtractedText> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return finish(value, null);
}

function finish(raw: string, pageCount: number | null): ExtractedText {
  // Collapse runs of whitespace but keep paragraph breaks: a quote checked
  // against this text is normalised the same way, and sentence boundaries are
  // what the agent quotes by.
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < MIN_USEFUL_CHARS) {
    return {
      text,
      pageCount,
      emptyReason:
        "у файлі немає текстового шару — імовірно, це скан. Завантажте версію з текстом.",
    };
  }

  return { text, pageCount, emptyReason: null };
}
