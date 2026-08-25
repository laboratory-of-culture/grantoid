import React from "react";

import { Shot } from "../components/Shot";
import { Step } from "../components/Step";

/**
 * Step seven: run the review and work through what it underlines.
 *
 * A real capture, popover open. The box is on the reason rather than on the
 * flagged sentence: reading the reason is the habit worth teaching, because the
 * model is wrong often enough that accepting every suggestion defeats the
 * purpose of having a reviewer.
 */
export const StepReview: React.FC = () => (
  <Step
    n={7}
    of={8}
    title="Натисніть «Перевірити весь текст»"
    what="Система підкреслить рекламну мову, задовгі речення й твердження, яких немає у вашому профілі. Клікніть підкреслене, і відкриється причина разом із заміною."
    caution="Читайте причину, а не лише заміну. Модель помиляється, і причина потрібна саме для того, щоб ви це побачили."
    seen={
      <Shot
        src="review.png"
        natural={1568}
        width={1220}
        delay={40}
        highlight={{ x: 88, y: 178, w: 250, h: 44 }}
      />
    }
  />
);
