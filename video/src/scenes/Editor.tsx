import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

import { Body, Headline, Reveal, Scene } from "../components/ui";
import { theme } from "../theme";

/**
 * The writing assistant, shown the way it behaves.
 *
 * A flagged span and the note that opens over it — the sentence, the reason,
 * and the replacement, in that order. The reason is not decoration: a
 * suggestion with no reason trains a person to accept every one of them, which
 * is the opposite of what a reviewer is for.
 *
 * Both the flagged phrase and the note are verbatim from a live review of a
 * draft written against a ГУРТ call.
 */
export const Editor: React.FC = () => {
  const frame = useCurrentFrame();

  // The popover arrives after the underline, so the eye finds the word first.
  const pop = interpolate(frame, [46, 56], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const underline = interpolate(frame, [30, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Scene kicker="Редактор концепції">
      <Headline size={70}>Пише чернетку. Потім сперечається з нею.</Headline>

      <Reveal delay={16}>
        <div
          style={{
            background: theme.surface,
            border: `${theme.rule}px solid ${theme.ink}`,
            padding: "34px 40px",
            maxWidth: 1420,
          }}
        >
          <div style={{ fontFamily: theme.font, fontSize: 33, lineHeight: 1.5, color: theme.n800 }}>
            Проєкт створить{" "}
            <span style={{ position: "relative", display: "inline-block" }}>
              інноваційну
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: -4,
                  height: theme.rule,
                  width: `${underline * 100}%`,
                  background: theme.accent,
                }}
              />
            </span>{" "}
            платформу для неформальної освіти в громадах Буковини.
          </div>
        </div>
      </Reveal>

      <div style={{ opacity: pop, transform: `translateY(${(1 - pop) * 14}px)` }}>
        <div
          style={{
            background: theme.surface,
            border: `${theme.rule}px solid ${theme.ink}`,
            boxShadow: `0 ${theme.rule}px 0 0 ${theme.ink}`,
            padding: "26px 32px",
            maxWidth: 900,
            marginLeft: 120,
          }}
        >
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 20,
              letterSpacing: 2.5,
              textTransform: "uppercase",
              color: theme.problem,
            }}
          >
            Рекламна мова · правило
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: theme.font,
              fontSize: 27,
              lineHeight: 1.4,
              color: theme.n800,
            }}
          >
            «Інноваційний» не описує нічого конкретного — донор читає це слово в кожній
            третій заявці.
          </div>
          <div
            style={{
              marginTop: 16,
              padding: "16px 20px",
              borderLeft: `${theme.rule}px solid ${theme.ink}`,
              background: theme.ground,
              fontFamily: theme.font,
              fontSize: 25,
              color: theme.ink,
            }}
          >
            Напишіть, що саме робиться вперше або інакше, ніж роблять зазвичай.
          </div>
        </div>
      </div>

      <Body delay={72} size={28} color={theme.n600}>
        Одне підтвердження на всю ноту — і файл у RTF, який відкриється у Word.
      </Body>
    </Scene>
  );
};
