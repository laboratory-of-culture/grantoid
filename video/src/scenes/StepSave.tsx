import React from "react";

import { Shot } from "../components/Shot";
import { Step } from "../components/Step";

/**
 * Step eight: confirm the whole note, then take the file.
 *
 * The save link is boxed rather than the confirmation button, because saving is
 * the step people look for and cannot find. It is never disabled: a draft
 * leaves whenever it is asked for, and an unread section is stamped inside the
 * file instead of being held back.
 */
export const StepSave: React.FC = () => (
  <Step
    n={8}
    of={8}
    title="Підтвердіть і збережіть файл"
    what="Одне натискання на «Я прочитав усю концепцію» позначає весь текст як перевірений людиною. Далі «Зберегти як файл» віддає RTF, який відкривається у Word і лишається редагованим."
    caution="Зберегти можна будь-коли. Якщо секції ще не прочитані, у файлі згори буде рамка з їхнім переліком і проханням не надсилати донорові."
    seen={
      <Shot
        src="bar.png"
        natural={1568}
        width={1290}
        delay={40}
        highlight={{ x: 420, y: 108, w: 178, h: 42 }}
      />
    }
  />
);
