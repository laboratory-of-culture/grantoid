import { loadConcept } from "../../../../../../packages/db/concepts";
import { renderRtf, type RtfBlock } from "../../../../../../packages/documents/rtf";
import { CONCEPT_SECTIONS } from "../../../../../../packages/schemas/concept";
import { NOUN_UK, countUk, formatDateUk } from "../../../../../../packages/schemas/locale-uk";
import { currentDb } from "../../../../../lib/session";

/**
 * The concept note as a file.
 *
 * RTF, not Markdown. Markdown reads as source to everyone outside software: a
 * grant manager opens it, finds `## Мета проєкту` and hashes down the page, and
 * either sends that to a donor or spends ten minutes cleaning it. RTF opens in
 * Word, Docs, LibreOffice and Pages with real headings and stays editable,
 * which is the point — every line of it is a draft.
 *
 * **Always available.** This used to refuse with a 409 while any section was an
 * unread AI draft, on the reasoning that a file is the moment we stop being
 * able to enforce anything. The reasoning was right and the conclusion was
 * wrong: refusing does not keep an unread draft out of a donor's inbox, it just
 * makes people retype the text into Word, where nothing carries the warning at
 * all. So the file goes out whenever it is asked for, and an unread draft is
 * stamped — a boxed, coloured line at the top naming the sections nobody has
 * read, which travels with the document and outlives this session.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await currentDb();
  if (!ctx) return new Response("Немає активної організації.", { status: 403 });

  const { id } = await params;
  const concept = await loadConcept(ctx.organizationId, id);
  if (!concept) return new Response("Чернетки ще немає.", { status: 404 });

  const order = new Map(CONCEPT_SECTIONS.map((s, i) => [s.key, i]));
  const sections = [...concept.sections].sort(
    (a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0),
  );

  const unread = concept.unreviewed.map(
    (k) => CONCEPT_SECTIONS.find((s) => s.key === k)?.labelUk ?? k,
  );

  const blocks: RtfBlock[] = [
    { kind: "title", text: concept.title },

    ...(unread.length > 0
      ? [
          {
            kind: "warning" as const,
            text:
              `ЧЕРНЕТКА. ${countUk(unread.length, NOUN_UK.section)} у цьому документі ` +
              `написала модель, і їх ще ніхто не прочитав: ${unread.join(", ")}. ` +
              "Не надсилайте донорові, доки не перевірите ці частини.",
          },
        ]
      : []),

    ...sections.flatMap((s): RtfBlock[] => [
      { kind: "heading", text: s.labelUk },
      // Paragraph per blank line, so a section the person broke into paragraphs
      // arrives as paragraphs rather than one block with line breaks in it.
      ...s.content
        .trim()
        .split(/\n{2,}/)
        .map((para): RtfBlock => ({ kind: "paragraph", text: para.trim() })),
    ]),

    {
      kind: "note",
      // Said in the file, not only on the screen. The document outlives the
      // session it was written in, and whoever opens it next did not see the
      // banner. No sentence-ending period after the date: formatDateUk already
      // closes with «р.».
      text:
        "Підготовлено за допомогою Grant Assistant, " +
        (unread.length === 0
          ? `прочитано людиною ${formatDateUk(concept.updatedAt)} `
          : `останні зміни ${formatDateUk(concept.updatedAt)} `) +
        "Перед подачею звірте цифри та умови з оригінальними документами донора.",
    },
  ];

  const filename = `kontseptsiia-${slug(concept.title)}.rtf`;

  return new Response(renderRtf(blocks), {
    headers: {
      "Content-Type": "application/rtf; charset=utf-8",
      // RFC 5987, because the title is Ukrainian and a bare filename= would
      // arrive as mojibake or be dropped.
      "Content-Disposition":
        `attachment; filename="concept.rtf"; ` +
        `filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
