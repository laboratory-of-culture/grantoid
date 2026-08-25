import React from "react";

import { Shot } from "../components/Shot";
import { Step } from "../components/Step";

/**
 * Step three: read the feed.
 *
 * The verdict chip is boxed because that is the first thing to look at, and
 * «Невідомо» is the state people misread. An organization that reads it as a
 * refusal will skip calls it could win.
 */
export const StepFeed: React.FC = () => (
  <Step
    n={3}
    of={8}
    title="Відкрийте «Можливості»"
    what="Раз на добу система обходить ГУРТ і Громадський Простір, відкидає тендери та вакансії й лишає конкурси. Кожен приходить із вердиктом і рядком «на основі», де видно, скільки умов прочитано."
    caution="«Невідомо» означає, що система не знає, а не що ви не підходите. Поруч написано, яке питання профілю це вирішить."
    seen={
      <Shot
        src="feed.png"
        natural={1344}
        width={1200}
        delay={40}
        highlight={{ x: 62, y: 68, w: 122, h: 30 }}
      />
    }
  />
);
