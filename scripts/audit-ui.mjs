/**
 * The measurable half of a UI review, run in the page.
 *
 * Development only, and gitignored: it is served from `public/`, so shipping it
 * would put an audit tool on a production origin for no reason. Nothing reads
 * it but a browser session driven by hand.
 *
 * Covers what a machine can settle from the UI/UX priority table — contrast as
 * rendered, hit areas as laid out, names, focus visibility, horizontal
 * overflow. Whether a screen says the right thing is not in here.
 *
 *   const m = await import('/_audit.js'); m.audit();
 */

const parse = (c) => {
  const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
};

const lum = ({ r, g, b }) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** The nearest painted background, since a transparent element inherits one. */
const bgOf = (el) => {
  for (let n = el; n; n = n.parentElement) {
    const c = parse(getComputedStyle(n).backgroundColor);
    if (c && c.a > 0) return c;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
};

const name = (el) =>
  (el.textContent || "").trim().slice(0, 44) ||
  el.getAttribute("aria-label") ||
  el.getAttribute("title") ||
  el.tagName;

export function audit() {
  const out = { contrast: [], targets: [], names: [], focus: [], overflow: {}, meta: {} };

  // Contrast, on text nodes rather than containers: a div whose colour fails but
  // which paints no text of its own is not a finding.
  for (const el of document.querySelectorAll("body *")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || +s.opacity === 0) continue;
    const fg = parse(s.color);
    if (!fg) continue;
    const size = parseFloat(s.fontSize);
    const large = size >= 24 || (size >= 18.66 && +s.fontWeight >= 700);
    const r = ratio(fg, bgOf(el));
    if (r < (large ? 3 : 4.5)) {
      out.contrast.push({ text: name(el), size, ratio: +r.toFixed(2), need: large ? 3 : 4.5 });
    }
  }

  // Hit areas, with the two exceptions the standard actually grants.
  //
  // An audit that cries wolf is one people learn to skip, and the first version
  // of this cried three times: a checkbox inside a label (13px of drawn box,
  // a whole row of target), every link inside a sentence, and every card title
  // whose card already carries a full-size button to the same place. WCAG 2.5.8
  // exempts the last two by name — inline targets constrained by line-height,
  // and functions reachable through an equivalent control on the same page.
  const controls = [
    ...document.querySelectorAll('a, button, input, select, textarea, [role="button"]'),
  ];

  /** Somewhere else on the page that goes to the same place and is big enough. */
  const hasEquivalent = (el) => {
    const href = el.getAttribute("href");
    if (!href) return false;
    return controls.some((other) => {
      if (other === el || other.getAttribute("href") !== href) return false;
      const r = other.getBoundingClientRect();
      return r.width >= 44 && r.height >= 44;
    });
  };

  /** A link sitting in running text, whose height is the line it lives on. */
  const isInline = (el) => {
    if (getComputedStyle(el).display !== "inline") return false;
    const parent = el.parentElement;
    if (!parent) return false;
    return [...parent.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  };

  for (const el of controls) {
    if (el.type === "hidden") continue;
    const target = el.closest("label") ?? el;
    const r = target.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.width >= 44 && r.height >= 44) continue;
    if (isInline(el) || hasEquivalent(el)) continue;
    out.targets.push({ el: name(el), w: Math.round(r.width), h: Math.round(r.height) });
  }

  for (const el of document.querySelectorAll("input, select, textarea")) {
    if (el.type === "hidden") continue;
    const named =
      el.labels?.length ||
      el.getAttribute("aria-label") ||
      el.getAttribute("aria-labelledby") ||
      el.closest("label");
    if (!named) out.names.push(`${el.tagName}[name=${el.name || "?"}] has no label`);
  }

  for (const el of document.querySelectorAll("a, button")) {
    if (
      !(el.textContent || "").trim() &&
      !el.getAttribute("aria-label") &&
      !el.getAttribute("title")
    ) {
      out.names.push(`${el.tagName} icon-only, unnamed`);
    }
  }

  for (const el of document.querySelectorAll("a, button, input, select, textarea")) {
    const s = getComputedStyle(el, ":focus-visible");
    if (s.outlineStyle === "none" && s.boxShadow === "none") out.focus.push(name(el));
  }

  const wide = [...document.querySelectorAll("body *")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > window.innerWidth + 1 && getComputedStyle(el).overflowX !== "auto";
  });

  out.overflow = {
    docWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    scrolls: document.documentElement.scrollWidth > window.innerWidth + 1,
    wide: wide.slice(0, 5).map(name),
  };

  out.meta = {
    url: location.pathname,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    clean:
      out.contrast.length === 0 &&
      out.targets.length === 0 &&
      out.names.length === 0 &&
      out.focus.length === 0 &&
      !out.overflow.scrolls &&
      wide.length === 0,
  };

  return JSON.stringify(out);
}
