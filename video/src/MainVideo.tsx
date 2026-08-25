import React from "react";
import { AbsoluteFill, Series } from "remotion";

import { FontFaceStyle } from "./font";
import { Funding } from "./scenes/Funding";
import { Intro } from "./scenes/Intro";
import { StepBreakdown } from "./scenes/StepBreakdown";
import { StepDocuments } from "./scenes/StepDocuments";
import { StepDonorPdf } from "./scenes/StepDonorPdf";
import { StepDraft } from "./scenes/StepDraft";
import { StepFeed } from "./scenes/StepFeed";
import { StepProfile } from "./scenes/StepProfile";
import { StepReview } from "./scenes/StepReview";
import { StepSave } from "./scenes/StepSave";
import { theme } from "./theme";

/**
 * A walkthrough, in the order somebody actually does the work.
 *
 * Fill the profile, feed it documents, read the feed, open one call, give it
 * the donor's own terms, generate, review, save. Ten scenes, about ninety
 * seconds.
 *
 * Four of the eight steps show captures of the running product rather than
 * recreations. A guide has to show the buttons a person is going to look for,
 * with the labels they actually carry.
 *
 * Durations are long for a promotional video and right for an instructional
 * one. Each step has a headline, a paragraph and a caution to read, in
 * Ukrainian, which needs more time on screen than an English tagline.
 */
export const SCENES = [
  { c: Intro, d: 165 }, //           5.5s
  { c: StepProfile, d: 330 }, //    11.0s
  { c: StepDocuments, d: 315 }, //  10.5s
  { c: StepFeed, d: 330 }, //       11.0s
  { c: StepBreakdown, d: 315 }, //  10.5s
  { c: StepDonorPdf, d: 315 }, //   10.5s
  { c: StepDraft, d: 285 }, //       9.5s
  { c: StepReview, d: 330 }, //     11.0s
  { c: StepSave, d: 315 }, //       10.5s
  { c: Funding, d: 210 }, //         7.0s
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
