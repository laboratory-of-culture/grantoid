#!/usr/bin/env node
/**
 * The mechanical half of .claude/skills/verify-change, wired to the Stop event.
 *
 * The skill says what to check and why; a skill is advice and advice gets
 * skipped on the turn where it matters. This runs whether or not anybody
 * remembered it: before the session ends, if source changed since the last
 * green run, typecheck and the tests have to pass. A failure blocks the stop
 * and hands the output back, so a change cannot be reported as working while
 * `tsc` disagrees.
 *
 * What it deliberately does not do: `npm run smoke` needs a dev server, and
 * the browser audit needs a page and a pair of eyes. Those stay in the skill,
 * where a person or the model decides they apply.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const marker = path.join(here, ".last-verified");

/** Files whose change can break a build or a test. Docs and logos cannot. */
const WATCHED = /[.](ts|tsx|mjs|js|css|prisma)$/;

/** Trailing lines of a failure worth reading; the rest is npm ceremony. */
const TAIL = 40;

/**
 * vitest colours its summary, so `Tests` and the count it reports are separated
 * by escape codes and no plain regex reaches across them. Stripping also keeps
 * a blocked reason readable when it is handed back as text.
 */
const ANSI = new RegExp(String.fromCharCode(27) + "[[]" + "[0-9;]*m", "g");
const strip = (text) => String(text ?? "").replace(ANSI, "");

function git(args) {
  return execSync(`git ${args}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function run(label, command, cwd) {
  try {
    const out = execSync(`${command} 2>&1`, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { label, ok: true, out: strip(out) };
  } catch (err) {
    const out = strip(`${err.stdout ?? ""}${err.stderr ?? ""}`).trim();
    return { label, ok: false, out: out.split("\n").slice(-TAIL).join("\n") };
  }
}

function finish(payload) {
  process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  // No stdin, or not JSON. Neither is a reason to skip the checks.
}

// Blocked once already and the model came back. Say nothing the second time,
// or the session cannot end on a failure it cannot fix.
if (input.stop_hook_active) process.exit(0);

let head = "";
let changed = [];
try {
  head = git("rev-parse HEAD");
  const dirty = git("status --porcelain --untracked-files=all")
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  // Committing mid-session leaves a clean tree, so the diff since the last
  // green run counts too. Otherwise the one stop that most needs checking —
  // right after a commit whose message claims something works — is the one
  // that gets skipped.
  let sinceLast = [];
  if (existsSync(marker)) {
    const previous = readFileSync(marker, "utf8").split("\n")[0].trim();
    if (previous && previous !== head) {
      try {
        sinceLast = git(`diff --name-only ${previous} ${head}`).split("\n").filter(Boolean);
      } catch {
        // The recorded commit is gone (rebase, reset). Fall back to the tree.
      }
    }
  }
  changed = [...new Set([...dirty, ...sinceLast])];
} catch {
  process.exit(0); // Not a git repository. Nothing to compare against.
}

const watched = changed.filter((p) => WATCHED.test(p)).sort();

// A list of paths is not enough: editing a file that was already dirty leaves
// the list identical, and the second edit of the session would go unchecked.
// Size and mtime are what actually moved.
const state = [
  head,
  ...watched.map((p) => {
    try {
      const st = statSync(path.join(root, p));
      return `${p} ${st.size} ${Math.round(st.mtimeMs)}`;
    } catch {
      return `${p} gone`;
    }
  }),
].join("\n");

if (existsSync(marker) && readFileSync(marker, "utf8") === state) process.exit(0);
if (watched.length === 0 && existsSync(marker)) {
  writeFileSync(marker, state);
  process.exit(0);
}

const results = [
  run("typecheck", "npm run typecheck", root),
  run("тести", "npm test", root),
  run("токени", "npm run audit:tokens", root),
];

if (watched.some((p) => p.startsWith("video/"))) {
  results.push(run("мова у відео", "npm run check:lang", path.join(root, "video")));
}

const failed = results.filter((r) => !r.ok);

if (failed.length > 0) {
  const detail = failed.map((r) => `### ${r.label}\n\n${r.out}`).join("\n\n");
  finish({
    decision: "block",
    reason: [
      `Перевірка не пройшла: ${failed.map((r) => r.label).join(", ")}.`,
      "",
      "Полагодьте це перед тим, як казати, що зміна працює. Якщо помилка не стосується",
      "цієї зміни — скажіть це прямо, а не мовчки.",
      "",
      detail,
    ].join("\n"),
    systemMessage: `verify-change: ${failed.map((r) => r.label).join(", ")} — не пройшло`,
  });
}

mkdirSync(here, { recursive: true });
writeFileSync(marker, state);

const tests = /Tests\s+(\d+) passed/.exec(results[1].out ?? "");
finish({
  suppressOutput: true,
  systemMessage: `verify-change: typecheck, ${tests ? `${tests[1]} тестів` : "тести"}, токени — чисто`,
});
