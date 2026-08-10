"use client";

import { useEffect, useState } from "react";
import { FlaskConical, X } from "lucide-react";

/**
 * Saying that the product is provisional, wherever it states a conclusion.
 *
 * The one claim this product may not break is that it never overstates what it
 * knows: a verdict without a citation is a bug, not a rough edge. Trial
 * operation puts the *system* in the position the grant records are already
 * held to — matching has never been measured against live data, and the donor's
 * own guidelines are not read at all. Telling an organization it is likely
 * eligible without saying that is the same failure one level up.
 *
 * So the banner names what is not evaluated rather than apologising in general
 * terms. "Ще працюємо над цим" tells a grant manager nothing they can act on;
 * "умови донора з PDF не читаються" tells them to open the original.
 */

const DISMISS_KEY = "ga_beta_notice_dismissed_v1";

export function BetaBanner() {
  // Starts hidden and appears after mount. Rendering it server-side and hiding
  // it on the client makes it flash for everyone who has already dismissed it.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISS_KEY) !== "1");
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). Showing the
      // notice is the safe failure: the cost is a repeated banner, and the cost
      // of the other choice is an undisclosed beta.
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* dismissal simply does not persist */
    }
  }

  return (
    <aside className="banner" role="note" aria-label="Дослідна експлуатація">
      <FlaskConical size={16} aria-hidden="true" className="banner-icon" />

      <div className="banner-text">
        <p className="banner-title">Бета — дослідна експлуатація</p>
        <p className="banner-body">
          Гранти збираються автоматично з двох джерел. Добір і оцінку прийнятності ще{" "}
          <strong>не перевірено на живих даних</strong>, а умови донора з PDF система не читає —
          у неї є лише текст оголошення. Кожен висновок звіряйте з оригіналом за посиланням.
        </p>
      </div>

      <button type="button" className="btn btn-ghost banner-dismiss" onClick={dismiss}>
        <X size={14} aria-hidden="true" />
        Зрозуміло
      </button>
    </aside>
  );
}

/**
 * The marker that rides along with a single AI conclusion.
 *
 * Separate from the banner on purpose: a banner is dismissed once and then
 * never seen again, and a conclusion produced by a model has to say so every
 * time it is read. `detail` names what specifically is uncertain about *this*
 * conclusion, which is the difference between a disclaimer and information.
 */
export function AiNotice({ detail }: { detail?: string }) {
  return (
    <span className="ai-note">
      <FlaskConical size={12} aria-hidden="true" />
      <span>Висновок AI{detail ? ` · ${detail}` : " · перевірте за оригіналом"}</span>
    </span>
  );
}
