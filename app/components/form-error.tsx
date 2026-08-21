"use client";

import { useEffect, useId, useRef } from "react";

/**
 * A form error a screen reader can find, and a keyboard can reach.
 *
 * There were twenty-two of these written by hand, each a `<p role="alert">`.
 * That announces the message once, and then leaves it: nothing connects it to
 * the field it is about, nothing moves focus to it, and a person who tabs back
 * into the form hears the inputs with no hint that anything failed.
 *
 * Three things this does that the bare paragraph did not:
 *
 *   - **It has an id**, so the inputs it explains can point at it with
 *     `aria-describedby`. The error is then read out as part of the field.
 *   - **It takes focus when it appears.** Not on every render — only when the
 *     message changes — because stealing focus while somebody is still typing
 *     is its own accessibility failure.
 *   - **It is focusable at all** (`tabIndex={-1}`), which is what lets focus
 *     move there without putting it in the tab order afterwards.
 *
 * Pair it with `useFormErrorId` so the id is stable across renders and shared
 * with the fields.
 */
export function FormError({ id, children }: { id: string; children: React.ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const announced = useRef<string | null>(null);

  useEffect(() => {
    const text = ref.current?.textContent ?? null;
    if (text === null || text === announced.current) return;
    announced.current = text;
    ref.current?.focus();
  });

  return (
    <p className="field-error" role="alert" id={id} tabIndex={-1} ref={ref}>
      {children}
    </p>
  );
}

/**
 * A stable id for one form's error, and the attributes a field needs to use it.
 *
 * Returned as a helper rather than spread by the caller because the attributes
 * have to disappear when there is no error: `aria-describedby` pointing at an
 * element that is not rendered is a dangling reference, and some screen readers
 * announce nothing at all rather than skipping it.
 */
export function useFormErrorId(hasError: boolean) {
  const id = useId();
  return {
    id,
    /** Spread onto every input the error could be about. */
    field: hasError ? { "aria-describedby": id, "aria-invalid": true as const } : {},
  };
}
