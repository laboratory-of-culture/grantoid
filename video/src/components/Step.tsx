import React from "react";

import { Reveal, Rule, Scene } from "./ui";
import { theme } from "../theme";

/**
 * One step of the walkthrough.
 *
 * The number is large because a viewer who joins halfway needs to know where
 * they are. Everything else is ordinary: what you do, what you see, and the one
 * thing worth knowing before you do it.
 */
export const Step: React.FC<{
  n: number;
  of: number;
  title: string;
  what: string;
  seen?: React.ReactNode;
  caution?: string;
}> = ({ n, of, title, what, seen, caution }) => (
  <Scene>
    <Reveal>
      <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
        <span
          style={{
            fontFamily: theme.font,
            fontWeight: 900,
            fontSize: 84,
            lineHeight: 1,
            color: theme.accentText,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {n}
        </span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 22,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: theme.n600,
          }}
        >
          крок {n} з {of}
        </span>
      </div>
    </Reveal>

    <Reveal delay={8}>
      <div
        style={{
          fontFamily: theme.font,
          fontWeight: 900,
          fontSize: 68,
          lineHeight: 1.06,
          letterSpacing: -1.2,
          color: theme.ink,
          maxWidth: 1420,
        }}
      >
        {title}
      </div>
    </Reveal>

    <Rule delay={18} width={1200} />

    <Reveal delay={26}>
      <div
        style={{
          fontFamily: theme.font,
          fontSize: 34,
          lineHeight: 1.42,
          color: theme.n800,
          maxWidth: 1240,
        }}
      >
        {what}
      </div>
    </Reveal>

    {seen}

    {caution ? (
      <Reveal delay={70}>
        <div
          style={{
            display: "flex",
            gap: 18,
            alignItems: "flex-start",
            maxWidth: 1240,
            borderLeft: `${theme.rule}px solid ${theme.accent}`,
            paddingLeft: 22,
          }}
        >
          <span
            style={{
              fontFamily: theme.font,
              fontSize: 27,
              lineHeight: 1.42,
              color: theme.n800,
            }}
          >
            {caution}
          </span>
        </div>
      </Reveal>
    ) : null}
  </Scene>
);
