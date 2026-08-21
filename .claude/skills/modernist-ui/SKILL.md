---
name: modernist-ui
description: The Modernist design system contract — tokens only, zero radius, 2px rules, flush left, inlined Lucide icons, themed focus ring, and the component inventory to compose from. Use when building or editing any screen, component or stylesheet.
---

# Modernist UI

Flat, architectural, Swiss-modernist. The contract lives in code:
`packages/ui/tokens.css`, `packages/ui/components.css`, and
`packages/ui/README.md` for the full component inventory and setup.

`npm run audit:tokens` enforces the parts a reviewer would otherwise have to
catch by eye. It runs in CI.

## Compose, do not reinvent

Before writing a new class, check the inventory in `packages/ui/README.md`.
Screens that each grow their own button variant are how a design system becomes a
folder of unused CSS.

`.btn` (`-primary` `-secondary` `-ghost` `-icon` `-block`) · `.tag` (`-accent`
`-neutral` `-outline` `-state-*`) · `.field` `.input` `.radio` `.seg` · `.card`
(`-kicker` `-title` `-body` `-meta`) `.elev-sm/md/lg` · `.nav` · `.table` ·
`.dialog` · `.hr` · `.grid` · `.grayscale` · `.quote` `.quote-source`

## Tokens only

`tokens.css` is the one file allowed a literal colour, font name or raw pixel
value. Everywhere else: `var(--color-*)`, `var(--space-*)`, `var(--text-*)`,
`var(--rule-*)`.

The audit fails on a hex, an `rgb()`, a non-zero `px`, a bare `font-family`, a
non-zero `border-radius`, and `text-align: center`. Media-query breakpoints are
exempt — a breakpoint is a layout fact, not a design token.

## The four rules that get undone by accident

**Zero radius, everywhere.** All four radius tokens are `0px` on purpose.

**2px dividers between major sections.** Never a hairline, never replaced by
whitespace. `--rule-weight-quiet` (1px) is for within-component separation only —
table rows, segmented cells.

**Everything flush left.** Including the label inside a full-width `.btn-block`,
which is where centring returns by habit.

**Focus is `2px solid var(--color-accent)` at `2px` offset.** Never the browser
default, never removed.

## Accent discipline

One accent, used sparingly. At paragraph size it is `--color-accent-700`, not the
base — the base clears 3:1 on the ground, which is enough for a rule, an icon or
a large heading and not for running text. 700 clears 4.5:1.

`--color-neutral-600` is the lightest neutral that carries text. Anything lighter
is a border or a muted mark.

## Match state has no traffic light

There is no green/amber/red ramp, deliberately. A traffic light renders *unknown*
as a warning, and the product's argument is that unknown is a question the
organization can answer.

Problems take the accent ramp; unknowns take the neutral ramp and are the
quietest of the four states. Meaning is carried by the tag label and the icon —
the fill only separates "problem" from "everything else". See
`explainable-output` for which verdicts map to which bucket.

## Icons

Lucide, imported as React components: `import { CircleAlert } from "lucide-react"`.
Never a CDN `<script>` — it fails silently under a strict CSP and the page ships
with missing icons and a clean console. Same reason the typeface is self-hosted
rather than linked from Google Fonts.

## Type

Inter, self-hosted and subset, in every role. The personality comes from weight
and tracking, and from the sans/mono contrast — mono is for identifiers and
data: rule keys, source URLs, deadlines, token counts, table headers. A display
serif against a grotesque is the move this system deliberately does not make.

The brief said Archivo; Archivo has no Cyrillic, and in a Ukrainian-first
interface that puts two typefaces on every line. **Any replacement has to be
checked for і ї є ґ before it ships** — plenty of faces labelled "cyrillic"
cover Russian and drop those four. The check is in `packages/ui/README.md`.

Weight only, no width axis. Inter has none, and declaring a `font-stretch`
range the file cannot render invites the browser to synthesise one.

## Single theme

No dark palette. The brief pins the ground and the ink, so this is a choice, and
every colour is painted explicitly rather than inherited. Adding dark mode needs a
decision first — inverting a mono system whose only accent carries semantic
weight is not a token swap.

## Floor

Responsive to mobile, visible keyboard focus on every interactive element,
`prefers-reduced-motion` respected (the duration tokens already zero out),
wide content in an `overflow-x: auto` container so the body never scrolls
sideways, `font-variant-numeric: tabular-nums` wherever digits line up.
Photographs grayscale, never tinted.
