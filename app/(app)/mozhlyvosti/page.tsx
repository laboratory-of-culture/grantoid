import Link from "next/link";
import { ArrowRight, CalendarClock, CircleHelp, TriangleAlert } from "lucide-react";

import { loadFeed, type FeedEntry } from "../../../packages/matching/feed";
import { BUCKET_LABEL_UK, VERDICT_LABEL_UK } from "../../../packages/schemas/verdict";
import { AiNotice } from "../../components/beta";
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
          <p className="prose muted">
            Кожен грант оцінено за умовами, які вдалося прочитати в оголошенні. Жоден висновок
            не є остаточним: система не читає PDF донора, тому перед подачею відкривайте
            оригінал.
          </p>

          <div className="row">
            <span className="tag tag-state-matched">
              {BUCKET_LABEL_UK.MATCHED}: {feed.byBucket.MATCHED}
            </span>
            <span className="tag tag-state-problem">
              {BUCKET_LABEL_UK.POTENTIAL_PROBLEM}: {feed.byBucket.POTENTIAL_PROBLEM}
            </span>
            <span className="tag tag-state-unknown">
              {BUCKET_LABEL_UK.UNKNOWN}: {feed.byBucket.UNKNOWN}
            </span>
            <span className="tag tag-state-blocked">
              {BUCKET_LABEL_UK.NOT_MATCHED}: {feed.byBucket.NOT_MATCHED}
            </span>
            <AiNotice />
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

function FeedRow({ entry }: { entry: FeedEntry }) {
  const blocked = entry.criteria.filter((c) => c.bucket === "NOT_MATCHED").length;
  const problems = entry.criteria.filter((c) => c.bucket === "POTENTIAL_PROBLEM").length;
  const unknown = entry.criteria.filter((c) => c.bucket === "UNKNOWN").length;
  const matched = entry.criteria.filter((c) => c.bucket === "MATCHED").length;

  return (
    <article className="card stack">
      <div className="row">
        <span className={`tag ${verdictClass(entry.overall)}`}>
          {VERDICT_LABEL_UK[entry.overall]}
        </span>
        <span className="kicker">{entry.donorName}</span>
        <Deadline entry={entry} />
      </div>

      <h2 className="card-title">
        <Link href={`/hranty/${entry.grantId}`}>{entry.titleUk}</Link>
      </h2>

      <p className="card-body">{entry.summary}</p>

      {/* The score, never alone. The counts are what it is made of, and a reader
          who ignores the number still gets the shape of the answer. */}
      <div className="row">
        <span className="stat">
          <span className="stat-value">{entry.matchScore}</span>
          <span className="kicker">відповідність</span>
        </span>
        {matched > 0 ? <span className="tag tag-state-matched">{matched} відповідає</span> : null}
        {problems > 0 ? (
          <span className="tag tag-state-problem">{problems} під питанням</span>
        ) : null}
        {unknown > 0 ? <span className="tag tag-state-unknown">{unknown} невідомо</span> : null}
        {blocked > 0 ? <span className="tag tag-state-blocked">{blocked} не відповідає</span> : null}
      </div>

      {entry.blockers.length > 0 ? (
        <p className="card-body">
          <TriangleAlert size={13} aria-hidden="true" /> {entry.blockers[0]}
        </p>
      ) : null}

      {entry.blockers.length === 0 && entry.openQuestions.length > 0 ? (
        <p className="card-body">
          <CircleHelp size={13} aria-hidden="true" /> {entry.openQuestions[0]}
        </p>
      ) : null}

      <div className="card-meta">
        <Link href={`/hranty/${entry.grantId}`} className="btn btn-secondary">
          Розбір за критеріями
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <span className="kicker">
          прочитано з оголошення: {Math.round(entry.extractionConfidence * 100)}%
        </span>
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
