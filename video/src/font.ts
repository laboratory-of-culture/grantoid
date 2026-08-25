import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Load Inter before the first frame is drawn.
 *
 * `delayRender` is the point. Without it the renderer captures frames while the
 * font is still arriving, so the opening seconds come out in whatever grotesque
 * the render machine happens to have — and the two are different widths, so the
 * wordmark jumps when the real face lands.
 *
 * The same file the product self-hosts, copied into `public/`. That also makes
 * the mark possible at all: Inter was chosen over the brief's Archivo because
 * Archivo has no Cyrillic, and «грантоЇД» is mostly Cyrillic with a capital Ї
 * at its centre.
 */
const handle = delayRender("Loading Inter");

const inter = new FontFace(
  "Inter",
  `url(${staticFile("inter-variable.woff2")}) format("woff2-variations")`,
  { weight: "100 900", style: "normal" },
);

inter
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    // Continue rather than hang: a video in the fallback face is worth more
    // than a render that never finishes, and the failure is visible.
    // eslint-disable-next-line no-console
    console.error("Inter failed to load, falling back:", err);
    continueRender(handle);
  });
