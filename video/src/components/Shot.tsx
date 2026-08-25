import React from "react";
import { Img, staticFile } from "remotion";

import { Reveal } from "./ui";
import { theme } from "../theme";

/**
 * A real screenshot of the running product.
 *
 * The scenes used to recreate the interface in Remotion, which looked cleaner
 * and taught the wrong thing: a guide has to show what the person will actually
 * see, down to the button labels they are going to look for. These are captured
 * from the app with a live database behind it.
 *
 * Framed with the system's own 2px rule so a screenshot of a light interface on
 * a light background still reads as a picture of a screen.
 */
export const Shot: React.FC<{
  src: string;
  width?: number;
  delay?: number;
  /** Draws attention to one region, in the screenshot's own pixel coordinates. */
  highlight?: { x: number; y: number; w: number; h: number };
  /** The screenshot's intrinsic width, needed to scale the highlight with it. */
  natural?: number;
}> = ({ src, width = 1240, delay = 34, highlight, natural = 1568 }) => {
  const scale = width / natural;

  return (
    <Reveal delay={delay}>
      <div
        style={{
          position: "relative",
          width,
          border: `${theme.rule}px solid ${theme.ink}`,
          background: theme.surface,
        }}
      >
        <Img src={staticFile(`shots/${src}`)} style={{ display: "block", width: "100%" }} />

        {highlight ? (
          <div
            style={{
              position: "absolute",
              left: highlight.x * scale,
              top: highlight.y * scale,
              width: highlight.w * scale,
              height: highlight.h * scale,
              border: `${theme.rule}px solid ${theme.accent}`,
              // No fill: a tinted box over an interface hides the thing it is
              // pointing at, which is the one thing it must not do.
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
    </Reveal>
  );
};
