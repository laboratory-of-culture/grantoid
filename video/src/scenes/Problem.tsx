import React from "react";

import { Body, Headline, Reveal, Rule, Scene } from "../components/ui";
import { theme } from "../theme";

/**
 * What the work costs today.
 *
 * Specific rather than sympathetic. «Втомливо» tells a grant manager nothing
 * they do not already know; the three lines below are the actual shape of the
 * afternoon they lose.
 */
const STEPS = [
  "Обійти десяток сайтів, де конкурси лежать упереміш із тендерами",
  "Прочитати сорок сторінок умов, щоб дізнатися, що ви не підходите",
  "Написати восьму концепцію, схожу на попередні сім",
];

export const Problem: React.FC = () => (
  <Scene kicker="Як це відбувається зараз">
    <Headline size={78}>
      Пошук гранту — це не пошук.
      <br />
      Це читання.
    </Headline>

    <div style={{ display: "flex", flexDirection: "column", gap: 26, marginTop: 16 }}>
      {STEPS.map((step, i) => (
        <Reveal key={step} delay={22 + i * 14}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 26 }}>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 26,
                color: theme.accentText,
                minWidth: 44,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              style={{
                fontFamily: theme.font,
                fontSize: 36,
                lineHeight: 1.35,
                color: theme.n800,
                maxWidth: 1250,
              }}
            >
              {step}
            </span>
          </div>
        </Reveal>
      ))}
    </div>

    <Rule delay={72} width={900} />

    <Body delay={80} size={30} color={theme.n600}>
      І в кінці — рішення на око: «здається, підходить».
    </Body>
  </Scene>
);
