import React from "react";

import { Body, Headline, Quote, Reveal, Scene, Tag } from "../components/ui";
import { theme } from "../theme";

/**
 * The evidence row — the one screen the whole product argues from.
 *
 * Both quotations are real: the donor clause is verbatim from the Stanley 1913
 * Creators Fund call as ingestion read it, and the profile line is verbatim
 * from the demo organization. Inventing a prettier pair would have been the
 * exact failure the software refuses.
 *
 * The verdict on top is UNCERTAIN, not a match, because that is what those two
 * lines actually support. A presentation that showed a green tick here would be
 * selling a different product.
 */
export const Evidence: React.FC = () => (
  <Scene kicker="Кожен висновок — із цитатами">
    <Headline size={70}>Не оцінка. Доказ.</Headline>

    <Reveal delay={16}>
      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <Tag tone="unknown" delay={16}>
          Невідомо
        </Tag>
        <span style={{ fontFamily: theme.font, fontSize: 27, color: theme.n600 }}>
          профіль не відповідає на це питання
        </span>
      </div>
    </Reveal>

    <div style={{ display: "flex", gap: 72, marginTop: 20 }}>
      <Quote
        delay={30}
        width={760}
        text="Не можуть брати участь: фізичні особи, державні установи, політичні адвокаційні організації, школи та коледжі, релігійні установи."
        source="з умов конкурсу"
      />
      <Quote
        delay={44}
        width={640}
        text="Організаційно-правова форма: громадська організація (ГО). Зі слів організації, без документа."
        source="з профілю організації"
      />
    </div>

    <Body delay={62} size={29} color={theme.n800}>
      Висновок без цитати на поле профілю чи на пункт умов — це не дрібна
      недоробка, а помилка. Так записано в правилах проєкту.
    </Body>
  </Scene>
);
