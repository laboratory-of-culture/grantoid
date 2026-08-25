import React from "react";

import { Shot } from "../components/Shot";
import { Body, Headline, Reveal, Scene } from "../components/ui";
import { theme } from "../theme";

/**
 * What lands on the disk.
 *
 * The capture is a real export, opened as a document. Its warning box is the
 * whole reason this scene exists: an unread draft leaves the product, and the
 * file says so in the place a reader cannot skip. Refusing the download would
 * not have kept the draft out of a donor's inbox; it would have moved the
 * retyping to Word, where nothing carries the warning at all.
 */
export const Result: React.FC = () => (
  <Scene kicker="Що ви отримаєте">
    <Headline size={62}>Файл, який відкриється у Word</Headline>

    <div style={{ display: "flex", gap: 56, alignItems: "flex-start" }}>
      <Shot
        src="result.png"
        natural={1060}
        width={880}
        delay={26}
        highlight={{ x: 356, y: 182, w: 634, h: 86 }}
      />

      <Reveal delay={44}>
        <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 26 }}>
          <div>
            <div
              style={{
                fontFamily: theme.font,
                fontSize: 28,
                fontWeight: 700,
                color: theme.ink,
              }}
            >
              Заголовки, а не решітки
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: theme.font,
                fontSize: 24,
                lineHeight: 1.4,
                color: theme.n600,
              }}
            >
              RTF відкривається у Word, Google Docs і LibreOffice, і текст лишається
              редагованим.
            </div>
          </div>

          <div>
            <div
              style={{
                fontFamily: theme.font,
                fontSize: 28,
                fontWeight: 700,
                color: theme.accentText,
              }}
            >
              Рамка згори
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: theme.font,
                fontSize: 24,
                lineHeight: 1.4,
                color: theme.n600,
              }}
            >
              Якщо секції ще не прочитані, файл перелічує їх і просить не надсилати
              донорові.
            </div>
          </div>
        </div>
      </Reveal>
    </div>

    <Body delay={62} size={27} color={theme.n800}>
      Підтверджена концепція виходить без рамки, з рядком про те, коли її прочитала людина.
    </Body>
  </Scene>
);
