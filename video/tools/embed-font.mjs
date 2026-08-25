/**
 * Regenerate src/inter-font.ts from public/inter-variable.woff2.
 *
 *   node tools/embed-font.mjs
 *
 * Run this after replacing the font file. See the header of the generated file
 * for why the font is embedded rather than fetched.
 */

import { readFileSync, writeFileSync } from "node:fs";

const b64 = readFileSync("public/inter-variable.woff2").toString("base64");
const chunks = b64.match(/.{1,100}/g) ?? [];

const header = `/**
 * Inter, embedded.
 *
 * Generated — do not edit by hand. Regenerate with:
 *   node tools/embed-font.mjs
 *
 * A data URI rather than a fetch, because every async route to this font
 * failed the render. A hand-rolled \`FontFace\` + \`delayRender\` at module scope
 * throws (module evaluation is not inside a render); \`@remotion/fonts\`
 * \`loadFont\` hangs, and its delayRender times out at frame 1150 with «called
 * but not cleared after 28000ms» — \`staticFile()\` does not resolve to anything
 * fetchable at module-evaluation time.
 *
 * Embedded, there is nothing to wait for and nothing to time out. The cost is
 * about 250 KB in the bundle, which nobody downloads: this is a render input,
 * not a page asset.
 *
 * The font matters more here than usual — «грантоЇД» is mostly Cyrillic with a
 * capital Ї at its centre, and the brief's Archivo has no Cyrillic at all.
 */

export const INTER_WOFF2_DATA_URI =
`;

const body =
  '  "data:font/woff2;base64," +\n' +
  chunks.map((c) => `    "${c}"`).join(" +\n") +
  ";\n";

writeFileSync("src/inter-font.ts", header + body, "utf8");
console.log(`embedded ${b64.length} base64 chars`);
