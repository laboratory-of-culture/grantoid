import React from "react";

import { Body, Headline, Reveal, Scene } from "../components/ui";
import { theme } from "../theme";

/**
 * The nightly chain, in the numbers it actually produced.
 *
 * Every figure here is from one real run against ГУРТ and Громадський Простір,
 * printed by `npm run nightly`. Rounder numbers would have read better and
 * would have been a claim about software that does not exist.
 */
const STAGES = [
  { n: "20", label: "позицій зі стрічок", note: "ГУРТ і Громадський Простір, раз на добу" },
  { n: "8", label: "з них — гранти", note: "решта: тендери, вакансії, закупівлі" },
  { n: "11", label: "відсіяно без моделі", note: "детерміновані правила, нуль секунд" },
  { n: "1", label: "рекомендовано", note: "з поясненням, чому саме цей" },
];

export const Feed: React.FC = () => (
  <Scene kicker="Один нічний прогін">
    <Headline size={72}>
      Двадцять оголошень.
      <br />
      Один конкурс, який вам підходить.
    </Headline>

    <div style={{ display: "flex", marginTop: 20 }}>
      {STAGES.map((s, i) => {
        const last = i === STAGES.length - 1;
        return (
          <Reveal key={s.label} delay={20 + i * 12}>
            <div
              style={{
                width: 386,
                paddingRight: 34,
                borderTop: `${theme.rule}px solid ${last ? theme.accent : theme.ink}`,
                paddingTop: 22,
              }}
            >
              <div
                style={{
                  fontFamily: theme.font,
                  fontWeight: 900,
                  fontSize: 88,
                  lineHeight: 1,
                  color: last ? theme.accentText : theme.ink,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.n}
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontFamily: theme.font,
                  fontSize: 26,
                  fontWeight: 600,
                  color: theme.ink,
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: theme.font,
                  fontSize: 21,
                  lineHeight: 1.35,
                  color: theme.n600,
                }}
              >
                {s.note}
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>

    <Body delay={76} size={27} color={theme.n600}>
      Більшість відсіюють правила, а не модель. Одна відеокарта обслуговує близько
      п'ятдесяти організацій.
    </Body>
  </Scene>
);
