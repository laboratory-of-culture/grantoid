import React from "react";

import { INTER_WOFF2_DATA_URI } from "./inter-font";

/**
 * The font, as a stylesheet the renderer never has to wait for.
 *
 * Mounted as a `<style>` inside the composition rather than loaded through
 * `FontFace`. Three async routes were tried and all three broke the render —
 * see the header of `inter-font.ts`. A data URI in a stylesheet has no promise
 * to resolve, so there is no delayRender to leak and no timeout to hit.
 */
export const FontFaceStyle: React.FC = () => (
  <style>
    {`@font-face {
        font-family: "Inter";
        src: url("${INTER_WOFF2_DATA_URI}") format("woff2-variations");
        font-weight: 100 900;
        font-style: normal;
      }`}
  </style>
);
