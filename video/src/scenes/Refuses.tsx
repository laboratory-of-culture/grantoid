import React from "react";

import { Body, Headline, Reveal, Scene } from "../components/ui";
import { theme } from "../theme";

/**
 * What the system refuses to do.
 *
 * The most persuasive scene in the video, and the only one most products would
 * cut. All three refusals are things that actually happened during development
 * and are now enforced in code:
 *
 *   - a deadline and a sum the model invented for a real donor PDF, both
 *     discarded because neither occurred in the text;
 *   - «мешкають мільйони людей» about an oblast of 890 000, caught once the
 *     check learned to read magnitudes written as words;
 *   - a whole fabricated organization — agriculture, prior experience, a
 *     twenty per cent target — written from an empty profile, which is now
 *     refused outright.
 */
const REFUSALS = [
  {
    what: "«Дедлайн 22 жовтня»",
    why: "цієї дати немає в тексті — відкинуто",
  },
  {
    what: "«Мешкають мільйони людей»",
    why: "в області 890 тисяч — позначено як непідтверджене",
  },
  {
    what: "«Організація має досвід…»",
    why: "профіль порожній — писати відмовлено",
  },
];

export const Refuses: React.FC = () => (
  <Scene kicker="Чого воно не робить">
    <Headline size={72}>Радше промовчить, ніж вигадає.</Headline>

    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 12 }}>
      {REFUSALS.map((r, i) => (
        <Reveal key={r.what} delay={22 + i * 16}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 30,
              borderTop: `${theme.rule}px solid ${theme.n300}`,
              paddingTop: 20,
              maxWidth: 1500,
            }}
          >
            <div
              style={{
                fontFamily: theme.font,
                fontSize: 38,
                fontWeight: 700,
                color: theme.n500,
                textDecoration: "line-through",
                textDecorationThickness: 2,
                minWidth: 620,
              }}
            >
              {r.what}
            </div>
            <div style={{ fontFamily: theme.font, fontSize: 29, color: theme.accentText }}>
              {r.why}
            </div>
          </div>
        </Reveal>
      ))}
    </div>

    <Body delay={82} size={29} color={theme.n800}>
      Вигадане число, яке виглядає як справжнє, коштує дорожче за порожнє поле.
      Тому правило записане не в підказці моделі, а в коді.
    </Body>
  </Scene>
);
