/**
 * Fails the build on a literal colour, font name or raw pixel value anywhere
 * outside tokens.css.
 *
 * The design system is binding, and the way a token system erodes is never a
 * decision — it is one `#fff` under deadline, then another. This makes that
 * erosion loud instead of invisible in review.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN = ["app", "packages/ui", "agents"];
/** The one file allowed to hold literals — it is where they are defined. */
const ALLOW = new Set([path.join("packages", "ui", "tokens.css")]);
const EXT = new Set([".css", ".tsx", ".ts", ".jsx", ".js"]);

/** Pull the value of a declaration, so rules test the value rather than rely on
 *  a lookahead — `\s*(?!var\()` backtracks to zero whitespace and matches
 *  everything, which is how the first version of this script reported sixteen
 *  false positives against its own stylesheet. */
function valueOf(line, property) {
  const m = new RegExp(`${property}\\s*:\\s*([^;]+)`).exec(line);
  return m?.[1]?.trim() ?? null;
}

const tokenised = (v) => v.startsWith("var(") || v === "inherit" || v === "none";

const RULES = [
  {
    name: "hard-coded colour",
    hint: "use a --color-* token",
    // Hex colours, and rgb()/hsl() with numeric channels.
    test: (line) => /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(\s*\d/.test(line),
  },
  {
    name: "raw pixel value",
    hint: "use a --space-*, --text-* or --rule-* token",
    // Zero is allowed: the radius tokens are 0px on purpose and a component may
    // legitimately zero a border. Media queries are allowed too — a breakpoint
    // is a layout fact, not a design token, and tokenising it would only move
    // the number somewhere less obvious.
    test: (line) =>
      !line.startsWith("@media") && /(?<![\w-])(?!0px)\d+(?:\.\d+)?px/.test(line),
  },
  {
    name: "hard-coded font family",
    hint: "use --font-sans or --font-mono",
    test: (line) => {
      const v = valueOf(line, "font-family");
      return v !== null && !tokenised(v);
    },
  },
  {
    name: "non-zero border radius",
    hint: "the system is zero-radius; use --radius-sm",
    test: (line) => {
      const v = valueOf(line, "border-radius");
      return v !== null && !tokenised(v) && !/^0(?:px)?$/.test(v);
    },
  },
  {
    name: "centred text",
    hint: "the system is flush left",
    // Everything is flush left, including labels inside wide buttons.
    test: (line) => /text-align\s*:\s*center/.test(line),
  },
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // directory not created yet
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "fonts") continue;
      walk(full, out);
    } else if (EXT.has(path.extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

const findings = [];

for (const base of SCAN) {
  for (const file of walk(path.join(ROOT, base))) {
    const rel = path.relative(ROOT, file);
    if (ALLOW.has(rel)) continue;

    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      // Skip comment-only lines — the rules are explained in prose all over
      // these files, and a hex inside a comment is documentation, not drift.
      const trimmed = line.trim();
      if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
        return;
      }
      for (const rule of RULES) {
        if (rule.test(trimmed)) {
          findings.push({ rel, line: i + 1, rule: rule.name, hint: rule.hint, text: trimmed });
        }
      }
    });
  }
}

if (findings.length > 0) {
  console.error(`Modernist token audit: ${findings.length} finding(s)\n`);
  for (const f of findings) {
    console.error(`  ${f.rel}:${f.line}  ${f.rule}`);
    console.error(`    ${f.text}`);
    console.error(`    → ${f.hint}\n`);
  }
  process.exit(1);
}

console.log("Modernist token audit: clean");
