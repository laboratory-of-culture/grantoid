import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { Body, Reveal, Rule, Wordmark } from "../components/ui";
import { MARGIN, theme } from "../theme";

/**
 * The name, and what it is.
 *
 * «ЇД» arrives after the rest of the word rather than with it, so the joke has
 * a beat: the viewer reads «гранто…», and then the accusation lands and is
 * worn on purpose. Nothing else moves while that happens.
 */
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();

  // The accent half fades in a third of a second after the stem.
  const bite = interpolate(frame, [24, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: theme.ground }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: `${MARGIN * 0.62}px ${MARGIN}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 40,
        }}
      >
        <Reveal>
          <span
            style={{
              fontFamily: theme.font,
              fontWeight: 900,
              fontSize: 168,
              letterSpacing: -4,
              color: theme.ink,
              whiteSpace: "nowrap",
            }}
          >
            гранто
            <span style={{ color: theme.accentText, opacity: bite }}>ЇД</span>
            <span style={{ fontWeight: 500, color: theme.n600, opacity: bite }}>.АІ</span>
          </span>
        </Reveal>

        <Reveal delay={40}>
          <Rule delay={40} width={1100} />
        </Reveal>

        <Body delay={48} size={44} color={theme.n800}>
          Грантовий асистент зі штучним інтелектом
        </Body>

        <Body delay={62} size={30} color={theme.n600}>
          Для українських громадських організацій. Працює локально — документи не
          залишають вашої інфраструктури.
        </Body>
      </div>
    </AbsoluteFill>
  );
};
