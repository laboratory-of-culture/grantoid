import React from "react";

import { Body, Headline, Reveal, Rule, Scene } from "../components/ui";
import { theme } from "../theme";

/**
 * Where the documents go, which is nowhere.
 *
 * An architectural claim, not a policy one, and worth saying in those terms:
 * there are no cloud API keys in the system, so sending a statute to a hosted
 * model would mean rewriting the layer every agent calls through. That is a
 * different kind of promise from a paragraph in a privacy policy.
 */
export const Local: React.FC = () => (
  <Scene kicker="Де опиняються ваші документи">
    <Headline size={76}>Ніде. Модель працює на вашому залізі.</Headline>

    <Rule delay={18} width={1200} />

    <div style={{ display: "flex", gap: 90, marginTop: 10 }}>
      {[
        { k: "Статути, звіти, заявки", v: "не залишають інфраструктури" },
        { k: "Ключів до хмарних API", v: "у системі немає" },
        { k: "Щотижневий лист", v: "лише публічні дані про конкурси" },
      ].map((item, i) => (
        <Reveal key={item.k} delay={26 + i * 14}>
          <div style={{ maxWidth: 420 }}>
            <div
              style={{
                fontFamily: theme.font,
                fontSize: 30,
                fontWeight: 700,
                color: theme.ink,
                lineHeight: 1.3,
              }}
            >
              {item.k}
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: theme.font,
                fontSize: 26,
                color: theme.n600,
                lineHeight: 1.4,
              }}
            >
              {item.v}
            </div>
          </div>
        </Reveal>
      ))}
    </div>

    <Body delay={74} size={28} color={theme.n800}>
      Це архітектурне рішення, а не налаштування: щоб надіслати ваш статут назовні,
      довелося б переписати шар, через який усі агенти звертаються до моделі.
    </Body>
  </Scene>
);
