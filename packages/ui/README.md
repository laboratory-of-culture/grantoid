# Modernist

The design system contract, in code. Flat, architectural, Swiss-modernist.

`tokens.css` is the only file in the codebase allowed to contain a literal
colour, font name or raw pixel value. `components.css` composes from it.
`npm run audit:tokens` enforces that split and runs in CI.

## Setup

```css
@import "../packages/ui/tokens.css";
@import "../packages/ui/components.css";
```

### Archivo

The typeface is self-hosted, never a Google Fonts link — a CDN request fails
silently under a strict CSP and falls back to a system face rather than
erroring, so the page ships looking wrong with nothing in the console.

Download the variable font and place it at `packages/ui/fonts/archivo-variable.woff2`:

```
https://fonts.google.com/specimen/Archivo  →  Get font → download → extract the variable .ttf
```

Convert the `.ttf` to `.woff2` (`fonttools`, `woff2_compress`, or any web
converter). Until the file is present the stack degrades to Segoe UI / Noto Sans
— a grotesque with Cyrillic coverage, not a serif — so the layout holds while
the personality is missing. Archivo is SIL Open Font License 1.1; ship the
licence alongside the font file.

## The rules that are easy to undo by accident

**Zero radius, everywhere.** All four radius tokens are `0px` on purpose. They
exist so a component can reference a radius without anyone being tempted to
invent one.

**2px dividers between major sections.** Never a hairline, and never replaced by
whitespace. The rule *is* the structure. `--rule-weight-quiet` (1px) is for
within-component separation only — table rows, segmented control cells.

**Everything flush left.** Including labels inside a full-width `.btn-block`,
which is where centring creeps back in by habit. The audit fails on
`text-align: center`.

**Accent at paragraph size uses `--color-accent-700`.** The base accent
(`#ec3013`) clears 3:1 on the ground — enough for a rule, an icon or a large
heading, not for running text. 700 clears 4.5:1. That contrast difference is the
entire reason the ramp exists.

**`--color-neutral-600` is the lightest neutral that carries text.** Anything
lighter is a border or a muted mark, not a label.

## Match state has no traffic light

There is no green/amber/red ramp, deliberately. A traffic light would render
*unknown* as a warning, and the product's whole argument is that unknown is a
question the organization can answer, not a rejection.

| State | Fill | Reads as |
|---|---|---|
| `.tag-state-matched` | neutral 200 | settled, unremarkable |
| `.tag-state-problem` | accent 100 | needs attention |
| `.tag-state-blocked` | accent 700 | the one hard stop |
| `.tag-state-unknown` | ground + outline | quietest of the four |

Meaning is carried by the tag label and the Lucide icon. The fill only separates
"problem" from "everything else".

## Icons

Lucide, imported as React components (`import { CircleAlert } from "lucide-react"`).
Never a CDN `<script>` — same silent-failure problem as the font.

## Component vocabulary

Compose these; do not reinvent them per screen.

`.btn` (`-primary` `-secondary` `-ghost` `-icon` `-block`) · `.tag` (`-accent`
`-neutral` `-outline` `-state-*`) · `.field` `.field-label` `.field-hint`
`.field-error` `.input` `.radio` `.seg` · `.card` (`-kicker` `-title` `-body`
`-meta`) `.elev-sm/md/lg` · `.nav` · `.table` `.table-wrap` · `.dialog` · `.hr`
`.hr-quiet` · `.grid` · `.grayscale`

Plus two the evidence sheet needs: `.quote` and `.quote-source`. A donor clause
and a profile line facing each other is the one component the whole product
argues from, so it is a first-class element rather than a styled blockquote.

## Single theme, on purpose

There is no dark palette. The brief pins the ground to `#f3f2f2` and the ink to
`#201e1d`, so this is a choice rather than an omission, and every colour is
painted explicitly so a page never borrows a host background.

If dark mode is wanted it needs a decision first: inverting a mono system whose
only accent carries semantic weight is not a token swap. `--color-state-blocked-bg`
at accent-700 on a dark ground, for instance, stops reading as the hard stop.
