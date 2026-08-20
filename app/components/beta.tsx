import { FlaskConical } from "lucide-react";

/**
 * Saying that the product is provisional, wherever it states a conclusion.
 *
 * Permanent, and not dismissible. It was dismissible for one version, which was
 * wrong for the same reason a stale verdict is wrong: the condition it reports
 * does not go away when someone clicks. Matching has still never been measured
 * against live data on the fiftieth screen as much as on the first, and the
 * person who dismissed it a week ago is exactly the person about to trust a
 * verdict they no longer see qualified.
 *
 * So it is compact instead — one line that names what is not evaluated rather
 * than apologising in general terms. "Ще працюємо над цим" tells a grant
 * manager nothing they can act on; "умови донора з PDF не читаються" tells them
 * to open the original.
 *
 * A server component now: with nothing to dismiss there is no state, and no
 * reason to ship it to the browser.
 */
export function BetaBanner() {
  return (
    <aside className="banner" role="note" aria-label="Дослідна експлуатація">
      <FlaskConical size={14} aria-hidden="true" className="banner-icon" />
      <p className="banner-body">
        <strong>Бета.</strong> Добір і оцінку прийнятності не перевірено на живих даних. Умови
        донора з PDF система не читає — лише текст оголошення. Кожен висновок звіряйте з
        оригіналом.
      </p>
    </aside>
  );
}

/**
 * The marker that rides along with a single AI conclusion.
 *
 * `detail` names what specifically is uncertain about *this* conclusion, which
 * is the difference between a disclaimer and information.
 */
export function AiNotice({ detail }: { detail?: string }) {
  return (
    <span className="ai-note">
      <FlaskConical size={12} aria-hidden="true" />
      <span>Висновок AI{detail ? ` · ${detail}` : " · перевірте за оригіналом"}</span>
    </span>
  );
}

/**
 * Where a statement came from, in one line.
 *
 * Every conclusion this product shows rests on something, and the something is
 * short enough to print. Removing these from the feed made the rows readable
 * and made the claims unaccountable — a verdict with no visible basis is the
 * thing this product exists not to produce, and "the detail is one click away"
 * is exactly the argument that ends with nobody clicking.
 *
 * Compact by construction: sources are named, not explained. The explanation is
 * the screen the link goes to.
 */
export function Provenance({ items }: { items: (string | null)[] }) {
  const kept = items.filter((i): i is string => i !== null && i.trim().length > 0);
  if (kept.length === 0) return null;

  return (
    <p className="provenance">
      <span className="provenance-label">на основі</span>
      {kept.map((item, i) => (
        <span key={item}>
          {i > 0 ? " · " : " "}
          {item}
        </span>
      ))}
    </p>
  );
}
