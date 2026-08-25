import React from "react";

import { Shot } from "../components/Shot";
import { Step } from "../components/Step";

/**
 * Step five: give it the donor's own guidelines.
 *
 * The 75 percent ceiling is what the extraction agent computes for an
 * announcement, and it exists because an announcement is a notice about a call
 * rather than the call. The clause that disqualifies an applicant is usually in
 * the PDF nobody opened.
 */
export const StepDonorPdf: React.FC = () => (
  <Step
    n={5}
    of={8}
    title="Дайте системі умови донора"
    what="З оголошення вона читає близько 75% умов. Співфінансування й обмеження бюджету зазвичай лежать у PDF на сайті донора. Покладіть його в редактор, і концепція писатиметься за справжніми умовами."
    caution="Конкурс, що надійшов вам поштою, завантажте у «Заявки». Система прочитає файл і відкриє редактор. Такий конкурс бачите тільки ви: до чужих стрічок він не потрапляє."
    seen={
      <Shot
        src="upload.png"
        natural={1568}
        width={1290}
        delay={40}
        highlight={{ x: 48, y: 200, w: 1240, h: 46 }}
      />
    }
  />
);
