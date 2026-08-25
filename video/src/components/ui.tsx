import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { MARGIN, theme } from "../theme";

/**
 * Shared motion and type, so eleven scenes cannot drift apart.
 *
 * The motion vocabulary is deliberately thin: things fade and rise, rules draw
 * themselves left to right, and nothing bounces. The product's own duration
 * tokens are 120–200 ms with a single easing curve; a presentation that swings
 * and overshoots would be advertising a different piece of software.
 */

/** Fade and rise, delayed by `delay` frames. The one entrance in the system. */
export const Reveal: React.FC<{
  delay?: number;
  y?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay = 0, y = 24, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Heavily damped: this system does not overshoot. `mass` low so it settles
  // inside a third of a second rather than drifting into the next line.
  const s = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.5 } });

  return (
    <div style={{ opacity: s, transform: `translateY(${(1 - s) * y}px)`, ...style }}>
      {children}
    </div>
  );
};

/** A 2px rule that draws itself. The system separates with lines, not boxes. */
export const Rule: React.FC<{ delay?: number; width?: number | string; color?: string }> = ({
  delay = 0,
  width = "100%",
  color = theme.ink,
}) => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame - delay, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ width, height: theme.rule, background: theme.n300 }}>
      <div style={{ width: `${grow * 100}%`, height: "100%", background: color }} />
    </div>
  );
};

/** Uppercase mono label. The product's kicker, unchanged. */
export const Kicker: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = theme.n600,
}) => (
  <div
    style={{
      fontFamily: theme.mono,
      fontSize: 24,
      fontWeight: 500,
      letterSpacing: 4,
      textTransform: "uppercase",
      color,
    }}
  >
    {children}
  </div>
);

export const Headline: React.FC<{
  children: React.ReactNode;
  size?: number;
  delay?: number;
}> = ({ children, size = 96, delay = 0 }) => (
  <Reveal delay={delay}>
    <div
      style={{
        fontFamily: theme.font,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.05,
        letterSpacing: -1.5,
        color: theme.ink,
        maxWidth: 1500,
      }}
    >
      {children}
    </div>
  </Reveal>
);

export const Body: React.FC<{
  children: React.ReactNode;
  size?: number;
  delay?: number;
  color?: string;
}> = ({ children, size = 34, delay = 0, color = theme.n800 }) => (
  <Reveal delay={delay}>
    <div
      style={{
        fontFamily: theme.font,
        fontSize: size,
        lineHeight: 1.45,
        color,
        maxWidth: 1180,
      }}
    >
      {children}
    </div>
  </Reveal>
);

/**
 * A quotation with its source underneath.
 *
 * The one component the whole product argues from, so it is a first-class
 * element here too: a left rule, the words verbatim, and where they came from.
 * A claim on screen without its source would misrepresent the software.
 */
export const Quote: React.FC<{
  text: string;
  source: string;
  delay?: number;
  width?: number;
}> = ({ text, source, delay = 0, width = 720 }) => (
  <Reveal delay={delay}>
    <div style={{ width, borderLeft: `${theme.rule}px solid ${theme.n500}`, paddingLeft: 22 }}>
      <div
        style={{
          fontFamily: theme.font,
          fontSize: 27,
          lineHeight: 1.4,
          color: theme.n800,
        }}
      >
        {text}
      </div>
      <div
        style={{
          marginTop: 12,
          fontFamily: theme.mono,
          fontSize: 19,
          letterSpacing: 1,
          color: theme.n600,
        }}
      >
        {source}
      </div>
    </div>
  </Reveal>
);

/** A verdict chip, in the feed's own colours. */
export const Tag: React.FC<{
  children: React.ReactNode;
  tone?: "matched" | "problem" | "unknown" | "accent";
  delay?: number;
}> = ({ children, tone = "unknown", delay = 0 }) => {
  const tones = {
    matched: { bg: "#dcefe4", fg: theme.matched, border: "transparent" },
    problem: { bg: "#f7ddd8", fg: theme.problem, border: "transparent" },
    unknown: { bg: theme.ground, fg: theme.n800, border: theme.n300 },
    accent: { bg: theme.ink, fg: theme.ground, border: theme.ink },
  }[tone];

  return (
    <Reveal delay={delay}>
      <span
        style={{
          display: "inline-block",
          padding: "10px 18px",
          background: tones.bg,
          color: tones.fg,
          border: `${theme.rule}px solid ${tones.border}`,
          fontFamily: theme.mono,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: 2.5,
          textTransform: "uppercase",
        }}
      >
        {children}
      </span>
    </Reveal>
  );
};

/**
 * Every scene's frame: the ground, the left margin, and a fade at both ends.
 *
 * The fade is on the scene rather than between scenes, so a cut never shows a
 * half-drawn rule from the outgoing one.
 */
export const Scene: React.FC<{ children: React.ReactNode; kicker?: string }> = ({
  children,
  kicker,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, 8, durationInFrames - 8, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ background: theme.ground, opacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: `${MARGIN * 0.62}px ${MARGIN}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 34,
        }}
      >
        {kicker ? (
          <Reveal>
            <Kicker>{kicker}</Kicker>
          </Reveal>
        ) : null}
        {children}
      </div>
    </AbsoluteFill>
  );
};

/** The mark, with «ЇД» carrying the accent — as everywhere else. */
export const Wordmark: React.FC<{ size?: number; suffix?: boolean }> = ({
  size = 120,
  suffix = true,
}) => (
  <span
    style={{
      fontFamily: theme.font,
      fontWeight: 900,
      fontSize: size,
      letterSpacing: -2,
      color: theme.ink,
      whiteSpace: "nowrap",
    }}
  >
    гранто<span style={{ color: theme.accentText }}>ЇД</span>
    {suffix ? (
      <span style={{ fontWeight: 500, color: theme.n600 }}>.АІ</span>
    ) : null}
  </span>
);
