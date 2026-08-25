import React from "react";

import { Reveal } from "../components/ui";
import { Step } from "../components/Step";
import { theme } from "../theme";

/**
 * Step five: give it the donor's own guidelines.
 *
 * The 75 percent figure is what the extraction agent computes for an
 * announcement, and the ceiling exists because an announcement is a notice
 * about a call rather than the call. Worth saying out loud: the clause that
 * disqualifies you is usually in the PDF nobody read.
 */
export const StepDonorPdf: React.FC = () => (
  <Step
    n={5}
    of={8}
    title="Завантажте PDF з умовами донора"
    what="З оголошення система читає близько 75% умов. Співфінансування, тривалість і обмеження бюджету зазвичай лежать у PDF на сайті донора. Покладіть його в редактор, і концепція писатиметься за справжніми умовами."
    caution="Якщо конкурс надійшов вам поштою і його немає в стрічці, завантажте файл у «Заявки». Система прочитає його й відкриє редактор. Такий конкурс бачите тільки ви."
    seen={
      <Reveal delay={40}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 26,
            padding: "22px 28px",
            background: theme.surface,
            border: `${theme.rule}px solid ${theme.ink}`,
            maxWidth: 900,
          }}
        >
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 21,
              letterSpacing: 2,
              color: theme.n600,
              textTransform: "uppercase",
            }}
          >
            PDF
          </div>
          <div style={{ fontFamily: theme.font, fontSize: 28, color: theme.ink }}>
            Perform-Europe-Open-Call-and-Guidelines.pdf
          </div>
          <div style={{ marginLeft: "auto", fontFamily: theme.mono, fontSize: 21, color: theme.n600 }}>
            1,8 МБ
          </div>
        </div>
      </Reveal>
    }
  />
);
