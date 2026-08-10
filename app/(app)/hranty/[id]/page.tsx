import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CircleHelp,
  ExternalLink,
  FileQuestion,
  TriangleAlert,
} from "lucide-react";

import { factDefinition } from "../../../../packages/schemas/fact-registry";
import { loadMatch, type FeedCriterion, type FeedEntry } from "../../../../packages/matching/feed";
import {
  BUCKET_LABEL_UK,
  VERDICT_LABEL_UK,
  type Bucket,
} from "../../../../packages/schemas/verdict";
import { AiNotice } from "../../../components/beta";
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

      <div className="row">
        <span className="tag tag-neutral">{VERDICT_LABEL_UK[entry.overall]}</span>
        <span className="stat">
          <span className="stat-value">{entry.matchScore}</span>
          <span className="kicker">відповідність</span>
        </span>
        <AiNotice detail="кожен критерій із цитатою" />
      </div>

      <p className="prose">{entry.summary}</p>

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
 * What was not read from the announcement.
 *
 * Shown above the criteria rather than in a footnote, because it changes how
 * every verdict below should be read. An organization looking at four matched
 * criteria deserves to know that the co-financing rule was never found.
 */
function ExtractionGaps({ entry }: { entry: FeedEntry }) {
  const notes = (entry.extractionNotes ?? "").split(";").map((n) => n.trim()).filter(Boolean);
  if (notes.length === 0) return null;

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
