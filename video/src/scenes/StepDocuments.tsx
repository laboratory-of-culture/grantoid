import React from "react";

import { Shot } from "../components/Shot";
import { Step } from "../components/Step";

/**
 * Step two: upload documents, then confirm what came back.
 *
 * The confirmation gate is the part a demo skips and the part that matters: an
 * extracted fact stays outside the profile until a person accepts it. The box
 * marks the quote and the page, because that is what the person decides
 * against.
 */
export const StepDocuments: React.FC = () => (
  <Step
    n={2}
    of={8}
    title="Завантажте статут і звіт"
    what="Система прочитає їх і запропонує факти для профілю. Кожен приходить із реченням, з якого його взято, і номером сторінки."
    caution="Жоден факт не потрапляє до профілю сам. Ви натискаєте «Підтвердити», «Виправити» або «Це не так»."
    seen={
      <Shot
        src="facts.png"
        natural={1344}
        width={1180}
        delay={40}
        highlight={{ x: 860, y: 262, w: 470, h: 60 }}
      />
    }
  />
);
