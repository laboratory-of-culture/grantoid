import Link from "next/link";
import { ArrowRight, CalendarClock, CircleHelp, TriangleAlert } from "lucide-react";

import { loadFeed, type FeedEntry } from "../../../packages/matching/feed";
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
 * time, when does it close, and what is the one thing standing in the way. The
 * full breakdown, the per-bucket counts and how much of the call was read all
 * live one click away, on the screen built to hold them.
 */
function FeedRow({ entry }: { entry: FeedEntry }) {
  const unknown = entry.criteria.filter((c) => c.bucket === "UNKNOWN").length;
  const matched = entry.criteria.filter((c) => c.bucket === "MATCHED").length;
  const blocked = entry.criteria.filter((c) => c.bucket === "NOT_MATCHED").length;
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
      ) : unknown > 0 ? (
        <p className="card-body muted">
          <CircleHelp size={13} aria-hidden="true" /> {unknown} умов не оцінено — у профілі
          немає відповіді
        </p>
      ) : null}

      {/* Where the verdict came from. Compact, but never absent: a conclusion
          whose basis lives only on the next screen is one nobody checks, and
          "the detail is one click away" is the argument that ends with the
          click never happening. */}
      <Provenance
        items={[
          `${entry.criteria.length} умов конкурсу`,
          matched > 0 ? `${matched} підтверджено профілем` : null,
          unknown > 0 ? `${unknown} без відповіді в профілі` : null,
          blocked > 0 ? `${blocked} не виконано` : null,
          `прочитано з оголошення ${Math.round(entry.extractionConfidence * 100)}%`,
        ]}
      />

      <div className="card-meta">
        <span className="kicker">{entry.donorName}</span>
        <Link href={`/hranty/${entry.grantId}`} className="btn btn-ghost">
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
      до {entry.deadline.toLocaleDateString("uk-UA")}
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
