import Link from "next/link";
import { ArrowRight, CalendarClock, CircleHelp, TriangleAlert } from "lucide-react";

import { loadFeed, type FeedEntry } from "../../../packages/matching/feed";
import { NOUN_UK, countUk, formatDateUk } from "../../../packages/schemas/locale-uk";
import { VERDICT_LABEL_UK } from "../../../packages/schemas/verdict";
import { AiNotice, Provenance } from "../../components/beta";
import { requireDb } from "../../lib/session";

export const dynamic = "force-dynamic";

/**
 * The feed.
 *
 * `explainable-output` forbids a bare score, and the rule bites hardest here:
 * a list is exactly where a number gets skimmed and a reason gets skipped. So
 * the score never appears without the counts it is made of, and each row leads
 * with what the organization would have to do rather than with how well it did.
 *
 * Rows are ordered by the deadline that is actually known. A call closing in
 * three days outranks a better fit closing in three months, and a call whose
 * date could not be read sorts last rather than first — being unable to read a
 * date must never look like urgency.
 */
export default async function FeedPage() {
  const { organizationId } = await requireDb();
  const feed = await loadFeed(organizationId);

  return (
    <div className="stack">
      <div className="section-head">
        <div>
          <span className="kicker">Можливості</span>
          <h1 className="h1">Гранти для вашої організації</h1>
        </div>
      </div>

      {feed.entries.length === 0 ? <EmptyFeed /> : null}

      {feed.entries.length > 0 ? (
        <>
          <div className="row">
            <AiNotice detail="розбір за критеріями — усередині" />
          </div>

          <div className="stack">
            {feed.entries.map((entry) => (
              <FeedRow key={entry.matchId} entry={entry} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * The empty state carries the diagnosis, not an apology.
 *
 * Three different things produce an empty feed — no grants ingested yet, a
 * profile too sparse to judge anything, or nothing currently open — and they
 * need three different actions. Saying "нічого не знайдено" would collapse them.
 */
function EmptyFeed() {
  return (
    <div className="empty stack">
      <h2 className="h3">Стрічка ще не побудована</h2>
      <p className="prose">
        Гранти збираються з двох джерел і оцінюються порівняно з вашим профілем. Поки що
        зіставлення для вашої організації не виконувалося.
      </p>
      <p className="prose muted">
        Що більше полів профілю заповнено, то менше умов лишиться «невідомими» — але порожні
        поля не блокують пошук: такий грант усе одно потрапить до стрічки, з питанням, на яке
        варто відповісти.
      </p>
      <Link href="/profil" className="btn btn-secondary">
        Заповнити профіль
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}

/**
 * One row.
 *
 * An earlier version carried seven blocks: verdict, donor, deadline, title,
 * summary, a score with four bucket counts, a blocker line, an action and an
 * extraction percentage. Every one of them was defensible on its own and
 * together they were unreadable — in a list, a reader scans for the one thing
 * that decides whether to open it, and eight competing signals mean scanning
 * fails and the summary gets skipped along with everything else.
 *
 * What survives is what a decision to open actually rests on: is it worth my
 * time, when does it close, and what is the one thing standing in the way — and
 * one quiet line naming what the verdict was computed from. That line came back
 * after being cut: without it the row is readable and the claim is
 * unaccountable, and "the full breakdown is one click away" is exactly the
 * argument that ends with nobody clicking. It is a list of sources, not a second
 * summary, which is what keeps it from becoming the eighth competing signal.
 */
function FeedRow({ entry }: { entry: FeedEntry }) {
  // One pass. Every bucket, because a provenance line whose parts do not add up
  // to the total it prints beside them invites the reader to work out what is
  // missing, and the bucket dropped here was the one meaning "read the
  // guidelines" — see the explainable-output skill.
  const byBucket = { MATCHED: 0, POTENTIAL_PROBLEM: 0, NOT_MATCHED: 0, UNKNOWN: 0 };
  for (const c of entry.criteria) byBucket[c.bucket] += 1;
  const blocker = entry.blockers[0] ?? null;

  return (
    <article className="card stack">
      <div className="row">
        <span className={`tag ${verdictClass(entry.overall)}`}>
          {VERDICT_LABEL_UK[entry.overall]}
        </span>
        {entry.synthetic ? <span className="tag tag-outline">тестовий запис</span> : null}
        <Deadline entry={entry} />
      </div>

      <h2 className="card-title">
        <Link href={`/hranty/${entry.grantId}`}>{entry.titleUk}</Link>
      </h2>

      <p className="card-body">{entry.summary}</p>

      {/* One line, and only when there is something to say. A blocker outranks
          an unanswered question: one ends the conversation, the other is work. */}
      {blocker ? (
        <p className="card-body">
          <TriangleAlert size={13} aria-hidden="true" /> {blocker}
        </p>
      ) : byBucket.UNKNOWN > 0 ? (
        <p className="card-body muted">
          <CircleHelp size={13} aria-hidden="true" />{" "}
          {countUk(byBucket.UNKNOWN, NOUN_UK.criterion)} не оцінено — у профілі немає
          відповіді
        </p>
      ) : null}

      {/* Where the verdict came from. Compact, but never absent: a conclusion
          whose basis lives only on the next screen is one nobody checks, and
          "the detail is one click away" is the argument that ends with the
          click never happening. */}
      <Provenance
        items={[
          `${countUk(entry.criteria.length, NOUN_UK.criterion)} конкурсу`,
          byBucket.MATCHED > 0 ? `${byBucket.MATCHED} підтверджено профілем` : null,
          byBucket.NOT_MATCHED > 0 ? `${byBucket.NOT_MATCHED} не виконано` : null,
          byBucket.POTENTIAL_PROBLEM > 0
            ? `${byBucket.POTENTIAL_PROBLEM} під питанням`
            : null,
          // Not repeated in the line above it: the unknown count already has a
          // sentence of its own when there is no blocker, and saying it twice in
          // adjacent lines is how a row stops being scannable.
          byBucket.UNKNOWN > 0 && blocker !== null
            ? `${byBucket.UNKNOWN} без відповіді в профілі`
            : null,
          `прочитано з оголошення ${Math.round(entry.extractionConfidence * 100)}%`,
        ]}
      />

      <div className="card-meta">
        <span className="kicker">{entry.donorName}</span>
        <Link href={`/hranty/${entry.grantId}`} className="btn btn-ghost push-end">
          Розбір і робота із заявкою
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function Deadline({ entry }: { entry: FeedEntry }) {
  if (!entry.deadlineIsKnown || !entry.deadline) {
    // Not "no deadline" — nobody read one. The distinction decides whether an
    // organization can plan around it.
    return <span className="tag tag-outline">термін не вказано в оголошенні</span>;
  }

  const days = Math.ceil((entry.deadline.getTime() - Date.now()) / 86_400_000);
  return (
    <span className={`tag ${days <= 7 ? "tag-state-problem" : "tag-neutral"}`}>
      <CalendarClock size={12} aria-hidden="true" />
      до {formatDateUk(entry.deadline)}
      {days >= 0 ? ` · ${days} дн.` : ""}
    </span>
  );
}

function verdictClass(verdict: FeedEntry["overall"]): string {
  switch (verdict) {
    case "MATCH":
    case "LIKELY_MATCH":
      return "tag-state-matched";
    case "UNCERTAIN":
      return "tag-state-unknown";
    case "LIKELY_NOT_ELIGIBLE":
      return "tag-state-problem";
    case "NOT_ELIGIBLE":
      return "tag-state-blocked";
  }
}
