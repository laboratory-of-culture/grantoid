/**
 * Every line on screen must be Ukrainian.
 *
 *   node tools/check-language.mjs
 *
 * Exists because it already went wrong once: a sentence in the Evidence scene
 * read «це не рough edge, це помилка» — an English phrase that had wandered
 * into a Ukrainian clause, with a Cyrillic р at the front of it so it did not
 * even look like a word in either language. Nobody would have caught that
 * reading the file; it takes a machine comparing alphabets.
 *
 * Comments and identifiers are English by convention in this codebase, so they
 * are stripped before the check. Only copy is examined.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/** Latin words that belong in Ukrainian copy: names, and terms used as-is. */
const ALLOWED = new Set([
  "Creative",
  "Democracy",
  "Boost",
  "EED",
  "Stanley",
  "Word",
  "RTF",
  "AI",
  "API",
]);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const findings = [];

for (const file of walk("src")) {
  const src = stripComments(readFileSync(file, "utf8"));

  // A string literal or a run of JSX text containing any Cyrillic is copy.
  const pattern =
    /"([^"\n]*[Ѐ-ӿ][^"\n]*)"|>\s*([^<>{}\n]*[Ѐ-ӿ][^<>{}\n]*)\s*</g;

  for (const match of src.matchAll(pattern)) {
    const text = (match[1] ?? match[2]).trim();
    const stray = [...text.matchAll(/[A-Za-z]{2,}/g)]
      .map((m) => m[0])
      .filter((word) => !ALLOWED.has(word));
    if (stray.length > 0) findings.push({ file, text, stray });
  }
}

if (findings.length === 0) {
  console.log("усі екранні рядки українською (крім дозволених власних назв)");
  process.exit(0);
}

for (const f of findings) {
  console.log(`${f.file}\n  «${f.text.slice(0, 90)}»\n  латиниця: ${f.stray.join(", ")}\n`);
}
console.log(`${findings.length} рядк(ів) із чужою латиницею`);
process.exit(1);
