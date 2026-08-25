import React from "react";
import { Composition } from "remotion";

import { MainVideo, TOTAL_FRAMES } from "./MainVideo";
import { VIDEO } from "./theme";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Hrantoid"
    component={MainVideo}
    durationInFrames={TOTAL_FRAMES}
    fps={VIDEO.fps}
    width={VIDEO.width}
    height={VIDEO.height}
  />
);
