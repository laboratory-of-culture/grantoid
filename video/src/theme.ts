/**
 * The video's palette is the product's palette.
 *
 * Copied from packages/ui/tokens.css rather than invented: a presentation that
 * looks like a different product than the one it presents teaches the viewer
 * the wrong thing to recognise. Light ground, near-black ink, one red accent —
 * and the Modernist rules that survive motion: zero radius, 2px rules, flush
 * left, nothing centred.
 *
 * Literals here because a CSS variable cannot cross into a Remotion render.
 * If tokens.css moves, this moves with it.
 */
export const theme = {
  ground: "#f3f2f2",
  surface: "#ffffff",
  ink: "#201e1d",

  accent: "#ec3013",
  /** The step that clears 4.5:1 on the ground — for anything text-sized. */
  accentText: "#b1240e",

  n200: "#e6e4e3",
  n300: "#d2cfce",
  n500: "#8a8583",
  n600: "#6a6563",
  n800: "#333030",

  /** Verdict colours, from the same tokens the feed uses. */
  matched: "#1f6b3f",
  problem: "#8e1d0b",

  font: "'Inter', 'Segoe UI', 'Noto Sans', system-ui, sans-serif",
  mono: "'Cascadia Mono', Consolas, 'DejaVu Sans Mono', monospace",

  /** 2px, everywhere. The system's one structural weight. */
  rule: 2,
} as const;

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

/** The left edge every scene aligns to. Flush left is the whole system. */
export const MARGIN = 140;
