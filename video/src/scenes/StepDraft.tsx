import React from "react";

import { Reveal } from "../components/ui";
import { Step } from "../components/Step";
import { theme } from "../theme";

/**
 * Step six: generate the draft.
 *
 * The section list is the real one from the concept registry. The timing is
 * measured, not promised: seventy seconds on the card this was built against.
 */
const SECTIONS = [
  "Проблема",
  "Мета проєкту",
  "Цільова група",
  "Основні активності",
  "Очікувані результати",
  "Спроможність організації",
  "Сталість",
  "Орієнтовний бюджет",
];

export const StepDraft: React.FC = () => (
  <Step
    n={6}
    of={8}
    title="Натисніть «Створити чернетку концепції»"
    what="Вісім секцій, приблизно хвилина. Модель працює на вашому залізі, тож швидкість залежить від відеокарти, а не від чужого сервера."
    caution="Там, де в профілі немає даних, у тексті стоятиме видима позначка. Заповнити її швидше, ніж шукати вигадане число, яке виглядає як справжнє."
    seen={
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, maxWidth: 1400, marginTop: 4 }}>
        {SECTIONS.map((s, i) => (
          <Reveal key={s} delay={38 + i * 5}>
            <div
              style={{
                padding: "14px 20px",
                border: `${theme.rule}px solid ${theme.n300}`,
                fontFamily: theme.font,
                fontSize: 25,
                color: theme.n800,
              }}
            >
              {s}
            </div>
          </Reveal>
        ))}
      </div>
    }
  />
);
