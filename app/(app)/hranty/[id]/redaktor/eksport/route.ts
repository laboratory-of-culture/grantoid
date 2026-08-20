import { loadConcept } from "../../../../../../packages/db/concepts";
import { CONCEPT_SECTIONS } from "../../../../../../packages/schemas/concept";
import { formatDateUk } from "../../../../../../packages/schemas/locale-uk";
import { currentDb } from "../../../../../lib/session";

/**
 * The concept note as a file.
 *
 * Markdown, not DOCX. A grant manager pastes this into a donor's web form or
 * into Word, and Markdown survives both; a generated .docx would look finished
 * in a way this document has not earned, and half of them get pasted as plain
 * text anyway.
 *
 * **Gated on review.** `human-in-the-loop` says nothing a model wrote reaches a
 * donor without a person having read it, and a file is exactly the moment that
 * stops being enforceable by us — once it is downloaded we have no say in where
 * it goes. So an unread AI section refuses the download rather than warning
 * about it: a warning on a file you already have is a warning you read after
 * sending it.
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

  if (concept.unreviewed.length > 0) {
    const labels = concept.unreviewed
      .map((k) => CONCEPT_SECTIONS.find((s) => s.key === k)?.labelUk ?? k)
      .join(", ");
    return new Response(
      `Ці секції ще ніхто не прочитав: ${labels}.\n` +
        "Прочитайте або відредагуйте їх — і файл можна буде завантажити.",
      { status: 409, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const order = new Map(CONCEPT_SECTIONS.map((s, i) => [s.key, i]));
  const sections = [...concept.sections].sort(
    (a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0),
  );

  const body = [
    `# ${concept.title}`,
    "",
    ...sections.flatMap((s) => [`## ${s.labelUk}`, "", s.content.trim(), ""]),
    "---",
    "",
    // Said in the file, not only on the screen. The document outlives the
    // session it was written in, and whoever opens it next did not see the
    // banner.
    // No sentence-ending period after the date: formatDateUk already closes
    // with «р.», and adding one printed «20 серпня 2026 р..» in a file people
    // send to donors.
    `Чернетку підготовлено за допомогою Grant Assistant і прочитано людиною ` +
      `${formatDateUk(concept.updatedAt)} Перед подачею звірте цифри та умови ` +
      `з оригінальними документами донора.`,
    "",
  ].join("\n");

  const filename = `kontseptsiia-${slug(concept.title)}.md`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      // RFC 5987, because the title is Ukrainian and a bare filename= would
      // arrive as mojibake or be dropped.
      "Content-Disposition": `attachment; filename="concept.md"; filename*=UTF-8''${encodeURIComponent(filename)}`,
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
