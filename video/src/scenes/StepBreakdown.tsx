import React from "react";

import { Shot } from "../components/Shot";
import { Step } from "../components/Step";

/**
 * Step four: open one call and read why.
 *
 * The box covers both quotations at once, because the point is that they face
 * each other: the donor's clause on the left, what the profile says on the
 * right, and the verdict above them.
 */
export const StepBreakdown: React.FC = () => (
  <Step
    n={4}
    of={8}
    title="Натисніть «Розбір за критеріями»"
    what="Кожна умова конкурсу стоїть навпроти того, що про неї каже ваш профіль. Дві цитати поруч, а не оцінка в балах."
    caution="Якщо висновок не показує, на чому стоїть, це помилка системи. Так записано в правилах проєкту."
    seen={
      <Shot
        src="breakdown.png"
        natural={1568}
        width={1290}
        delay={40}
        highlight={{ x: 70, y: 188, w: 1400, h: 62 }}
      />
    }
  />
);
