import React from "react";

import { Shot } from "../components/Shot";
import { Step } from "../components/Step";
import { Reveal } from "../components/ui";
import { theme } from "../theme";

/**
 * Step six: generate, then read what came back.
 *
 * The capture is a real draft, warnings and all. Two of them are visible in the
 * screenshot: «мільйони людей» about an oblast of 890 000, and «1000 осіб» that
 * appears nowhere in the profile. Showing a clean draft here would have been
 * easy and would have taught people not to look.
 */
export const StepDraft: React.FC = () => (
  <Step
    n={6}
    of={8}
    title="Натисніть «Створити чернетку концепції»"
    what="Вісім секцій, приблизно хвилина. Модель працює на вашому залізі, тож швидкість залежить від вашої відеокарти."
    caution="Червоні рядки згори секцій показують числа, яких немає ні в профілі, ні в умовах. Замініть їх на справжні або приберіть."
    seen={
      <div style={{ display: "flex", gap: 44, alignItems: "flex-start" }}>
        <Shot
          src="document.png"
          natural={700}
          width={700}
          delay={40}
          highlight={{ x: 74, y: 58, w: 500, h: 24 }}
        />
        <Reveal delay={54}>
          <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              ["мільйони людей", "у Чернівецькій області їх 890 тисяч"],
              ["1000 осіб", "у профілі такої цифри немає"],
            ].map(([bad, why]) => (
              <div key={bad}>
                <div
                  style={{
                    fontFamily: theme.font,
                    fontSize: 30,
                    fontWeight: 700,
                    color: theme.n500,
                    textDecoration: "line-through",
                    textDecorationThickness: 2,
                  }}
                >
                  {bad}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: theme.font,
                    fontSize: 24,
                    color: theme.accentText,
                  }}
                >
                  {why}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    }
  />
);
