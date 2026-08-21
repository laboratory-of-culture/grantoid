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

### Inter

The typeface is self-hosted and committed, never a Google Fonts link — a CDN
request fails silently under a strict CSP and falls back to a system face
rather than erroring, so the page ships looking wrong with nothing in the
console.

**The brief said Archivo. Archivo has no Cyrillic.** Its Google Fonts subsets
are `latin`, `latin-ext`, `vietnamese` and nothing else. In a Ukrainian-first
interface that means the wordmark and «PDF» render in Archivo while every
sentence around them falls back — two typefaces on every line, which is worse
than the single fallback the product had while the file was simply missing.
Inter is the same Swiss-grotesque register, is variable across 100–900, and
carries the four letters that make Cyrillic Ukrainian rather than Russian:
і ї є ґ.

The file at `public/fonts/inter-variable.woff2` is subset to what this product
writes — Latin, Latin Extended (a Romanian partner name lives in the demo
profile), Cyrillic, punctuation, and the hryvnia sign. 187 KB, variable axes
intact. Its licence sits beside it as `OFL-Inter.txt`; SIL OFL 1.1 requires the
licence to travel with the font.

To refresh it, or to swap in another face:

```bash
curl -sLo /tmp/inter.ttf   "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf"

python -m fontTools.subset /tmp/inter.ttf --flavor=woff2   --output-file=public/fonts/inter-variable.woff2 --layout-features='*' --name-IDs='*'   --unicodes="U+0000-00FF,U+0100-024F,U+0259,U+0400-04FF,U+0500-052F,U+2000-206F,U+2070-209F,U+20A0-20BF,U+2116,U+2212"
```

Needs `fonttools` and `brotli`. **Check the Ukrainian glyphs before shipping any
replacement** — plenty of faces labelled "cyrillic" cover Russian and drop ґ or
ї:

```bash
python -c "
from fontTools.ttLib import TTFont
c = TTFont('public/fonts/inter-variable.woff2', lazy=True).getBestCmap()
print([n for cp, n in {0x0456:'i',0x0457:'yi',0x0454:'ie',0x0491:'ghe',0x0490:'GHE',
                       0x2019:'apos',0x00AB:'laquo',0x20B4:'hryvnia'}.items() if cp not in c]
      or 'all present')"
```

**It goes in `public/`, not next to the stylesheet.** The `@font-face` rule uses
an absolute `/fonts/…` URL that the browser resolves at runtime. A relative path
would be resolved by webpack at build time instead, and an absent font would
fail the build rather than degrade — which is exactly what happened the first
time this was written, under a comment promising graceful degradation.

No `font-stretch` descriptor. Archivo had a width axis and Inter does not, and
declaring a range the file cannot render invites the browser to synthesise one.

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
