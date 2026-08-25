import React from "react";

import { Body, Headline, Reveal, Scene } from "../components/ui";
import { theme } from "../theme";

/**
 * The five states, and the one distinction the product is built on.
 *
 * «Ні» and «Не знаємо» are different answers. Collapsing them is what every
 * other tool does — an empty profile field becomes a rejection, and an
 * organization is quietly told it does not qualify for something nobody
 * checked. Here the middle state is the accent, because it is the honest one
 * and the one that costs the most to keep.
 */
const RUNGS = [
  { label: "Підходить", tone: theme.matched, note: "умови виконано, з цитатами" },
  { label: "Ймовірно підходить", tone: theme.matched, note: "" },
  { label: "Не знаємо", tone: theme.accentText, note: "профіль мовчить — це не «ні»" },
  { label: "Ймовірно не підходить", tone: theme.problem, note: "" },
  { label: "Не підходить", tone: theme.problem, note: "є пряме свідчення проти" },
];

export const Ladder: React.FC = () => (
  <Scene kicker="П'ять станів, а не «так / ні»">
    <Headline size={74}>«Не знаємо» — це теж відповідь.</Headline>

    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
      {RUNGS.map((r, i) => {
        const middle = i === 2;
        return (
          <Reveal key={r.label} delay={20 + i * 10}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 26,
                padding: middle ? "18px 26px" : "12px 26px",
                background: middle ? theme.surface : "transparent",
                border: `${theme.rule}px solid ${middle ? theme.accent : "transparent"}`,
                maxWidth: 1320,
              }}
            >
              {/* A weight bar rather than a dot: the ladder is ordered, and the
                  order is the meaning. */}
              <div style={{ width: 8, height: middle ? 46 : 34, background: r.tone }} />
              <div
                style={{
                  fontFamily: theme.font,
                  fontSize: middle ? 44 : 36,
                  fontWeight: middle ? 800 : 600,
                  color: theme.ink,
                  minWidth: 520,
                }}
              >
                {r.label}
              </div>
              <div style={{ fontFamily: theme.font, fontSize: 25, color: theme.n600 }}>
                {r.note}
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>

    <Body delay={80} size={29} color={theme.n800}>
      Порожнє поле профілю ніколи не стає відмовою. Система скаже «не знаємо» і
      покаже, яке саме питання це вирішить.
    </Body>
  </Scene>
);
