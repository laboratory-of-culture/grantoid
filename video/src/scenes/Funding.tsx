import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

import { Reveal, Rule, Wordmark } from "../components/ui";
import { MARGIN, theme } from "../theme";

/**
 * The closing card: the mark, then who paid for it.
 *
 * The same three logos and the same sentence as the site footer, because a
 * funding statement that is worded differently in two places invites the
 * question of which one is the real one.
 *
 * The marks are given room rather than shrunk into a strip. This is the frame
 * a viewer pauses on, and the EU's visibility rules are about being seen.
 */
const LOGOS = [
  { src: "eu.png", w: 632, h: 136 },
  { src: "eed.png", w: 890, h: 136 },
  { src: "labkult.png", w: 207, h: 136 },
];

const HEIGHT = 96;

export const Funding: React.FC = () => (
  <AbsoluteFill style={{ background: theme.ground }}>
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: `${MARGIN * 0.62}px ${MARGIN}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 44,
      }}
    >
      <Reveal>
        <Wordmark size={104} />
      </Reveal>

      <Reveal delay={10}>
        <div style={{ fontFamily: theme.font, fontSize: 36, color: theme.n800 }}>
          Грантовий асистент зі штучним інтелектом
        </div>
      </Reveal>

      <Rule delay={22} width={1400} />

      <Reveal delay={30}>
        <div style={{ display: "flex", alignItems: "center", gap: 72 }}>
          {LOGOS.map((l) => (
            <Img
              key={l.src}
              src={staticFile(l.src)}
              style={{ height: HEIGHT, width: (l.w / l.h) * HEIGHT }}
            />
          ))}
        </div>
      </Reveal>

      <Reveal delay={44}>
        <div
          style={{
            fontFamily: theme.font,
            fontSize: 25,
            lineHeight: 1.5,
            color: theme.n600,
            maxWidth: 1240,
          }}
        >
          Цей вебресурс створено в межах програми підтримки ідей проєкту Creative
          Democracy Boost, який реалізовує ГО «Лабораторія культурних досліджень». Проєкт
          фінансується Європейським Союзом за підтримки Європейського фонду за
          демократію (EED).
        </div>
      </Reveal>
    </div>
  </AbsoluteFill>
);
