---
name: verify-change
description: |
  The verification loop this project actually uses, after every change. Run
  before claiming anything works: typecheck, tests, token audit, smoke the
  routes, then open the real page in a browser and measure it. Use whenever
  code, copy, schema, prompts or styles change, and before writing any commit
  message or summary that says something works.
---

# Verify a change

Every rule here was written after the project got it wrong once. The failures
are named so the rule is arguable rather than ceremonial.

## The loop

Run these in order. Each is cheap enough that skipping one is never the reason
a change ships faster.

```bash
npm run typecheck        # always
npm test                 # always
npm run audit:tokens     # any CSS or design token change
npm run smoke            # any page, layout or route change
npm run check:lang       # (in video/) any on-screen copy
```

Then open the thing in a browser and look at it. `npm run dev`, navigate to the
page you changed, and run the measured audit:

```js
const r = JSON.parse((await import('/_audit.js')).audit());
```

It reports contrast, hit areas, unlabelled controls, focus visibility and
horizontal overflow. `npm run audit:ui` copies it into `public/` first. It is
gitignored and must never ship.

## What runs on its own

`.claude/hooks/verify-change.mjs` is wired to the Stop event in
`.claude/settings.json`. Before the session ends, if a `.ts`, `.tsx`, `.mjs`,
`.js`, `.css` or `.prisma` file changed since the last green run — in the
working tree or in a commit made during the session — it runs typecheck, the
tests and the token audit. A failure blocks the stop and hands the output back.

It exists because a skill is advice, and advice gets skipped on exactly the turn
where it matters. `.claude/hooks/.last-verified` records the last green state
and is gitignored.

The hook cannot cover the rest. `npm run smoke` needs a dev server; the browser
audit needs a page and someone looking at it; a repair script for existing rows
needs a person to decide it is needed. Those stay here, below.

## Rules with a scar

**Never claim from the diff.** A commit once said the file transport wrote the
laid-out letter beside the text. The edit that was supposed to add it matched
nothing and failed silently, the code was never run, and the claim reached a
commit message and a summary. If a sentence says something works, a command in
the transcript has to show it working.

**A green audit is not a working page.** The UI audit reported `clean: true` on
«Application error: a server-side exception has occurred», because an error page
has nothing to measure. It now checks for a page first. Apply the same suspicion
to any tool that reports success: ask what it would have said if the thing were
broken.

**A fix on the write path does not reach existing rows.** This has bitten five
times: enum text leaking into user copy, stale extraction notes, grant statuses,
rubric prefixes in titles, transliterated oblasts. When you fix how something is
written, add a script that repairs what is already stored, run it, and say how
many rows changed.

**`\b` does not work with Cyrillic.** JavaScript defines it through `\w`, which
is `[A-Za-z0-9_]`. Use `(?<!\p{L})` and `(?!\p{L})` with the `u` flag. Five
occurrences so far.

**Prompt instructions are not mechanisms.** D5. A 4B model does not reliably
obey. State the rule in the prompt, then enforce it in code: verify the quote
occurs in the source, verify the page number exists, refuse a section that
echoes its own brief, reject a figure that appears nowhere.

**Check before reporting a bug.** Several apparent defects were not: a checkbox
that measured 13px sits inside a label and the label is the target; a page that
would not scroll was an automation artifact; a hydration warning named
Grammarly's extension. Confirm the cause before writing it down.

## Browser work

The extension is unreliable in specific ways, and knowing them saves an hour:

- **Clicks on `ref_` handles often do not fire a form submit.** Click by
  coordinate, or call `form.requestSubmit()`. If neither works, check whether
  React has hydrated before concluding the button is broken.
- **`requestAnimationFrame` never fires in a background tab.** Any script that
  awaits it hangs until the tool times out.
- **Screenshots and CDP calls time out** on a tab that has been open a long
  time. Open a fresh tab rather than retrying.
- **`resize_window` reports success and changes nothing.** A real phone viewport
  cannot be tested this way. Say so instead of implying it was checked.
- **Editing files mid-action reloads the page** and discards the pending server
  action's result.

## Before a commit message

Read what you are about to claim, and for each sentence ask which command in
this session proves it. Anything left over gets cut or gets marked as not
verified. «Still not exercised end to end» in a commit message is worth more
than a claim that turns out to be false.

## Before deploying

```bash
npm run preflight          # reads only, safe against production
npm run purge:test         # dry run; add -- --delete to remove test data
```

`preflight` prints what it cannot check under «перевірте вручну». Those are not
optional; they are the ones a machine cannot settle.
