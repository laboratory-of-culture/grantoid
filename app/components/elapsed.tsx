"use client";

import { useEffect, useState } from "react";

/**
 * How long this has been running, and how long it usually takes.
 *
 * Three operations in this product call a local model and block: writing a
 * concept (about seventy seconds), reviewing the whole document (about a
 * hundred), reading a donor PDF (about fifty). Each one showed a label that
 * changed to «Перевіряємо…» and then nothing at all. At that length an
 * indeterminate spinner is indistinguishable from a hang, and the honest
 * response — reload the page — throws the work away.
 *
 * Deliberately not a progress bar that fills on a timer. A bar that reaches the
 * end while the work continues is a fabricated figure in visual form, and this
 * product refuses those everywhere else. Elapsed time is a fact; the typical
 * duration is labelled as typical; and when it overruns, the copy says so
 * rather than pretending.
 */
export function Elapsed({ expectedSeconds }: { expectedSeconds: number }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const overrun = seconds > expectedSeconds * 1.5;

  return (
    <span className="elapsed" role="status">
      <span className="mono">{format(seconds)}</span>
      {overrun ? (
        <> · довше, ніж зазвичай — модель ще працює</>
      ) : (
        <> · зазвичай близько {format(expectedSeconds)}</>
      )}
    </span>
  );
}

function format(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
