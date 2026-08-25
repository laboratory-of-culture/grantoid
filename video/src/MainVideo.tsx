import React from "react";
import { AbsoluteFill, Series } from "remotion";

import { FontFaceStyle } from "./font";
import { Editor } from "./scenes/Editor";
import { Evidence } from "./scenes/Evidence";
import { Feed } from "./scenes/Feed";
import { Funding } from "./scenes/Funding";
import { Intro } from "./scenes/Intro";
import { Ladder } from "./scenes/Ladder";
import { Local } from "./scenes/Local";
import { Problem } from "./scenes/Problem";
import { Refuses } from "./scenes/Refuses";
import { theme } from "./theme";

/**
 * The whole video: eight scenes, about eighty seconds.
 *
 * Ordered as an argument rather than a feature tour. The problem is reading,
 * not searching; the feed answers the reading; the ladder and the evidence are
 * why the answer can be trusted; the editor is what you do with it; the
 * refusals are the proof that the trust is earned; and the last two say where
 * your documents live and who paid for the thing.
 *
 * Durations are generous. Every scene has to be readable at a glance by
 * somebody who is not a native reader of software marketing — and the copy is
 * Ukrainian prose, which needs longer on screen than an English tagline.
 */
export const SCENES = [
  { c: Intro, d: 180 }, //     6.0s — the name lands
  { c: Problem, d: 270 }, //   9.0s — three lines to read
  { c: Feed, d: 285 }, //      9.5s — four columns of numbers
  { c: Ladder, d: 300 }, //   10.0s — five rungs, the middle one is the point
  { c: Evidence, d: 315 }, // 10.5s — two quotations, the densest scene
  { c: Editor, d: 300 }, //   10.0s — a sentence, then the note over it
  { c: Refuses, d: 285 }, //   9.5s — three struck-through claims
  { c: Local, d: 255 }, //     8.5s
  { c: Funding, d: 240 }, //   8.0s — the card a viewer pauses on
] as const;

export const TOTAL_FRAMES = SCENES.reduce((sum, s) => sum + s.d, 0);

export const MainVideo: React.FC = () => (
  <AbsoluteFill style={{ background: theme.ground }}>
    {/* Inside the composition, not beside it: only what the composition renders
        reaches a frame, and a font declared in the Root would be absent from
        every one of them. */}
    <FontFaceStyle />
    <Series>
      {SCENES.map((s, i) => {
        const Comp = s.c;
        return (
          <Series.Sequence key={i} durationInFrames={s.d}>
            <Comp />
          </Series.Sequence>
        );
      })}
    </Series>
  </AbsoluteFill>
);
