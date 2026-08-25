import React from "react";

import { Shot } from "../components/Shot";
import { Body, Headline, Scene } from "../components/ui";
import { theme } from "../theme";

/**
 * Where the work you started lives.
 *
 * The screen answers a question the walkthrough otherwise leaves open: you
 * closed the tab, so where is the draft now. The badges on each row say how
 * many sections are read and how the call arrived.
 */
export const Drafts: React.FC = () => (
  <Scene kicker="Повернутися до роботи">
    <Headline size={62}>Усі чернетки лежать у «Заявках»</Headline>

    <Shot
      src="drafts.png"
      natural={1567}
      width={1330}
      delay={26}
      highlight={{ x: 62, y: 150, w: 420, h: 32 }}
    />

    <Body delay={54} size={28} color={theme.n800}>
      На кожному рядку видно, скільки секцій прочитано і звідки взявся конкурс. «Отримано
      напряму» означає, що ви завантажили умови самі.
    </Body>
  </Scene>
);
