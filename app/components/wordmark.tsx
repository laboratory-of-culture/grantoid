/**
 * The product's name, set once.
 *
 * «грантоЇД» is a reclaimed insult. «Грантоїд» and «грантожер» are what critics
 * call the NGOs this product serves — people living off foreign money, in the
 * telling. Wearing it is the joke, and the joke only lands if the second half
 * is visible, so «ЇД» is raised and carries the accent: the word says «eater»
 * out loud instead of hoping you notice.
 *
 * The capital **Ї** is doing the other half of the work. It is one of the four
 * letters Ukrainian has and Russian does not, and putting it at the centre of
 * the mark turns a reproach about foreign influence into a statement about
 * whose alphabet this is. That is also why the typeface was checked for it: see
 * packages/ui/README.md, where Archivo was rejected for having no Cyrillic at
 * all. The wordmark now depends on that check.
 *
 * A component rather than a string in three layouts, because the emphasis has
 * to be identical everywhere and a repeated string drifts. Plain text, without
 * the markup, lives in `PRODUCT_NAME` for titles, files and email — places that
 * cannot carry a span.
 */

/** For `<title>`, exported documents, and anywhere markup cannot go. */
export const PRODUCT_NAME = "грантоЇД";

/**
 * The full name, where the product is being introduced rather than referred to.
 *
 * Cyrillic `АІ`, not Latin `AI`. The two are visually identical, so the mark
 * reads the same either way, and Cyrillic keeps every letter of the name in one
 * alphabet — which is the point the capital Ї is already making.
 *
 * It has a cost and it is worth stating: a name spelled in Cyrillic will not be
 * found by someone searching for it in Latin, and the two spellings split a
 * search index between them. A domain has to be Latin regardless.
 */
export const PRODUCT_NAME_FULL = "грантоЇД.АІ";

export function Wordmark({ full = false }: { full?: boolean }) {
  return (
    <span className="wordmark-text">
      гранто<span className="wordmark-bite">ЇД</span>
      {full ? <span className="wordmark-suffix">.АІ</span> : null}
    </span>
  );
}
