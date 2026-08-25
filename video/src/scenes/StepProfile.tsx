import React from "react";

import { Shot } from "../components/Shot";
import { Step } from "../components/Step";

/**
 * Step one: fill three fields.
 *
 * The counter is boxed because it is what a person checks on the way back in.
 * Three of the eighteen questions are named in the copy, because those three
 * are the ones the concept writer refuses to work without, and somebody who
 * knows which three gets through this step in two minutes.
 */
export const StepProfile: React.FC = () => (
  <Step
    n={1}
    of={8}
    title="Почніть із профілю організації"
    what="Питань вісімнадцять. Насамперед дайте відповідь на три: напрями діяльності, цільові аудиторії, географія. Без них система відмовиться писати концепцію і скаже про це прямо."
    caution="Порожнє поле ніколи не стає відмовою. Воно робить умову невідомою, і грант усе одно потрапляє до стрічки з питанням, на яке варто відповісти."
    seen={
      <Shot
        src="profile.png"
        natural={1372}
        width={1190}
        delay={40}
        highlight={{ x: 60, y: 150, w: 268, h: 46 }}
      />
    }
  />
);
