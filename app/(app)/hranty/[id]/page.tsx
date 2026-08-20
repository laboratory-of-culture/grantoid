import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CircleHelp,
  ExternalLink,
  FileQuestion,
  PenLine,
  TriangleAlert,
} from "lucide-react";

import { factDefinition } from "../../../../packages/schemas/fact-registry";
import { loadMatch, type FeedCriterion, type FeedEntry } from "../../../../packages/matching/feed";
import {
  BUCKET_LABEL_UK,
  VERDICT_LABEL_UK,
  type Bucket,
} from "../../../../packages/schemas/verdict";
import { AiNotice, Provenance } from "../../../components/beta";
import { requireDb } from "../../../lib/session";

export const dynamic = "force-dynamic";

/**
 * The match breakdown — the screen the whole product argues from.
 *
 * The rule it exists to keep: the system never says "you are eligible". It says
 * why, with evidence, and it distinguishes NO from WE DON'T KNOW. So every
 * criterion here is rendered as a pair of quotes facing each other — the donor's
 * clause on one side, the profile line that settles it on the other — and a
 * criterion with no profile quote is shown as unresolved rather than as passed.
 *
 * The four buckets are separate sections rather than a sorted list, because
 * each one calls for a different action: a blocker ends the conversation, a
 * problem needs the guidelines read, an unknown needs a profile field answered,
 * and a match needs nothing.
 */
export default async function GrantPage({ params }: { params: Promise<{ id: string }> }) {
  const { organizationId } = await requireDb();
  const { id } = await params;

  const entry = await loadMatch(organizationId, id);
  if (!entry) notFound();

  const groups: { bucket: Bucket; items: FeedCriterion[] }[] = (
    ["NOT_MATCHED", "POTENTIAL_PROBLEM", "UNKNOWN", "MATCHED"] as const
  ).map((bucket) => ({
    bucket,
    items: entry.criteria.filter((c) => c.bucket === bucket),
  }));

  return (
    <div className="stack">
      <Link href="/mozhlyvosti" className="btn btn-ghost">
        <ArrowLeft size={14} aria-hidden="true" />
        До стрічки
      </Link>

      <div>
        <span className="kicker">{entry.donorName}</span>
        <h1 className="h1">{entry.titleUk}</h1>
      </div>

      {entry.synthetic ? <SyntheticWarning /> : null}

      <div className="row">
        <span className="tag tag-neutral">{VERDICT_LABEL_UK[entry.overall]}</span>
        <span className="stat">
          <span className="stat-value">{entry.matchScore}</span>
          <span className="kicker">відповідність</span>
        </span>
        <AiNotice detail="кожен критерій із цитатою" />
      </div>

      <p className="prose">{entry.summary}</p>

      {/* The basis for the verdict above it. The per-criterion quotes below are
          the full argument; this is the one-line answer to "on what". */}
      <Provenance
        items={[
          `${entry.criteria.length} умов конкурсу`,
          `прочитано з оголошення ${Math.round(entry.extractionConfidence * 100)}%`,
          entry.criteria.filter((c) => c.profileQuote !== null).length > 0
            ? `${entry.criteria.filter((c) => c.profileQuote !== null).length} підтверджено цитатою з профілю`
            : null,
          `оцінено ${entry.computedAt.toLocaleDateString("uk-UA")}`,
        ]}
      />

      <ExtractionGaps entry={entry} />

      {groups.map(({ bucket, items }) =>
        items.length === 0 ? null : (
          <section key={bucket} className="section">
            <div className="section-head">
              <h2 className="h3">{BUCKET_LABEL_UK[bucket]}</h2>
              <span className="kicker">{items.length}</span>
            </div>
            {bucket === "UNKNOWN" ? (
              <p className="prose muted">
                Ці умови система не могла оцінити, бо у профілі немає відповіді. Це не відмова —
                це питання, на яке варто відповісти.
              </p>
            ) : null}
            <div className="stack">
              {items.map((c) => (
                <Criterion key={c.ruleKey} criterion={c} />
              ))}
            </div>
          </section>
        ),
      )}

      {/* The way out of analysis and into work. Placed after the criteria, not
          before: deciding to write is a decision made once the blockers are
          read, and a button above them invites skipping the part that matters. */}
      <div className="empty stack">
        <h2 className="h3">Працювати із цим конкурсом</h2>
        <p className="prose">
          Редактор напише чернетку концепції з вашого профілю та умов цього конкурсу, дасть її
          доповнити й прийме документи донора, якщо ви їх завантажите.
        </p>
        <Link href={`/hranty/${entry.grantId}/redaktor`} className="btn btn-primary">
          <PenLine size={16} aria-hidden="true" />
          Відкрити редактор
        </Link>
      </div>

      <div className="row">
        {entry.applicationUrl ? (
          <a href={entry.applicationUrl} className="btn btn-primary" rel="noreferrer noopener">
            Сторінка донора
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
        {entry.sourceUrl ? (
          <a href={entry.sourceUrl} className="btn btn-secondary" rel="noreferrer noopener">
            Оригінал оголошення
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A seeded fixture, said plainly.
 *
 * During trial operation the test grants sit in the same feed as live ones, and
 * an organization that spends a week writing a concept for a call that does not
 * exist has been actively harmed by this product. Loud, and above the analysis.
 */
function SyntheticWarning() {
  return (
    <div className="empty stack">
      <div className="row">
        <TriangleAlert size={16} aria-hidden="true" />
        <h2 className="h3">Це тестовий запис</h2>
      </div>
      <p className="prose">
        Такого конкурсу не існує. Запис створено для перевірки системи — не подавайте на нього
        заявку і не витрачайте на нього час.
      </p>
    </div>
  );
}

/**
 * What was not read from the announcement.
 *
 * Shown above the criteria rather than in a footnote, because it changes how
 * every verdict below should be read. An organization looking at four matched
 * criteria deserves to know that the co-financing rule was never found.
 */
function ExtractionGaps({ entry }: { entry: FeedEntry }) {
  // Split on newlines, not semicolons: a note is prose, and the first render
  // broke "Every field is stated; nothing is unread." into two fragments.
  const notes = (entry.extractionNotes ?? "")
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);

  // A fixture states everything by construction; there is no gap to report, and
  // the box would claim one.
  if (notes.length === 0 || entry.synthetic) return null;

  return (
    <div className="empty stack">
      <div className="row">
        <FileQuestion size={16} aria-hidden="true" />
        <h2 className="h3">Чого немає в оголошенні</h2>
        <span className="tag tag-outline">
          прочитано {Math.round(entry.extractionConfidence * 100)}%
        </span>
      </div>
      <p className="prose muted">
        Оцінка нижче спирається лише на текст оголошення. Це не повні умови конкурсу.
      </p>
      <ul className="prose">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function Criterion({ criterion }: { criterion: FeedCriterion }) {
  const fact = criterion.resolvingFactKey ? factDefinition(criterion.resolvingFactKey) : undefined;

  return (
    <article className="card stack">
      <div className="row">
        <span className={`tag ${bucketClass(criterion.bucket)}`}>
          {VERDICT_LABEL_UK[criterion.verdict]}
        </span>
        {criterion.ruleKind === "PREFERRED" ? (
          <span className="tag tag-outline">перевага, не вимога</span>
        ) : null}
      </div>

      <h3 className="card-title">{criterion.ruleTextUk}</h3>
      <p className="card-body">{criterion.rationale}</p>

      {/* The evidence row. Two quotes facing each other is the one component the
          whole product argues from — see the explainable-output skill. */}
      <div className="candidate">
        <blockquote className="quote">
          {criterion.grantQuote}
          <span className="quote-source">з умов конкурсу</span>
        </blockquote>

        {criterion.profileQuote ? (
          <blockquote className="quote">
            {criterion.profileQuote}
            <span className="quote-source">з профілю організації</span>
          </blockquote>
        ) : (
          <div className="stack">
            <p className="card-body">
              <CircleHelp size={13} aria-hidden="true" />{" "}
              {criterion.missingInformation ?? "У профілі немає даних, які це вирішують."}
            </p>
            {fact ? (
              <Link href="/profil" className="btn btn-secondary">
                Відповісти: {fact.labelUk}
              </Link>
            ) : null}
          </div>
        )}
      </div>

      {criterion.bucket === "NOT_MATCHED" ? (
        <p className="card-body">
          <TriangleAlert size={13} aria-hidden="true" /> Ця умова не виконується. Її не можна
          обійти заповненням профілю.
        </p>
      ) : null}
    </article>
  );
}

function bucketClass(bucket: Bucket): string {
  switch (bucket) {
    case "MATCHED":
      return "tag-state-matched";
    case "POTENTIAL_PROBLEM":
      return "tag-state-problem";
    case "NOT_MATCHED":
      return "tag-state-blocked";
    case "UNKNOWN":
      return "tag-state-unknown";
  }
}
