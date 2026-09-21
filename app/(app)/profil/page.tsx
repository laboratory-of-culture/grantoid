import { CircleHelp, CircleCheckBig, CircleMinus, FileCheck2 } from "lucide-react";

import {
  FACT_REGISTRY,
  type FactGroup,
  type FactDefinition,
} from "../../../packages/schemas/fact-registry";
import { LEGAL_FORM_LABEL_UK, type LegalForm } from "../../../packages/schemas/organization";
import { formatOblast } from "../../../packages/schemas/place";
import { formatIsoDateUk } from "../../../packages/schemas/locale-uk";
import { pendingCandidates } from "../../../packages/db/confirmation";
import { factImpact } from "../../../packages/db/impact";
import { prisma } from "../../../packages/db/tenancy";
import { currentDb } from "../../lib/session";
import { Documents } from "./documents";
import { FactEditor } from "./fact-editor";
import { ConfirmationQueue } from "./queue";
import { DigestPreference } from "./digest";

export const dynamic = "force-dynamic";

const GROUP_LABEL: Record<FactGroup, string> = {
  IDENTITY: "Ідентифікація",
  LEGAL: "Правовий статус",
  ACTIVITY: "Діяльність",
  REACH: "Географія та аудиторії",
  CAPACITY: "Спроможність",
  EXPERIENCE: "Досвід",
};

const GROUP_ORDER: FactGroup[] = [
  "IDENTITY",
  "LEGAL",
  "ACTIVITY",
  "REACH",
  "CAPACITY",
  "EXPERIENCE",
];

type FactRow = {
  key: string;
  state: string;
  valueText: string | null;
};

/**
 * How each fact state reads.
 *
 * `UNKNOWN` is deliberately the quietest of the four — not an error, not a
 * warning. It is a question the organization can answer, and the row carries the
 * question rather than a complaint about its absence.
 */
function stateTag(state: string) {
  switch (state) {
    case "CONFIRMED":
      return { cls: "tag tag-state-matched", label: "Підтверджено", Icon: FileCheck2 };
    case "SELF_REPORTED":
      return { cls: "tag tag-neutral", label: "Зі слів організації", Icon: CircleCheckBig };
    case "EXPLICIT_NEGATIVE":
      return { cls: "tag tag-outline", label: "Підтверджено: немає", Icon: CircleMinus };
    default:
      return { cls: "tag tag-state-unknown", label: "Не запитували", Icon: CircleHelp };
  }
}

export default async function ProfilePage() {
  const ctx = await currentDb();

  if (!ctx) {
    return (
      <div className="empty stack">
        <h1 className="h2">Ще немає жодної організації</h1>
        <p className="prose muted">
          Заповніть базу демонстраційними даними, щоб побачити екран профілю:
        </p>
        <p className="mono">npx tsx packages/db/seed.ts</p>
      </div>
    );
  }

  const [org, facts, documents, queue, account, impact] = await Promise.all([
    ctx.db.organization.findUnique({ where: { id: ctx.organizationId } }),
    ctx.db.organizationFact.findMany(),
    // Donor guidelines belong to a call, not to the organization, and would
    // otherwise appear in the profile's document list as if they described it.
    ctx.db.document.findMany({ where: { grantId: null }, orderBy: { uploadedAt: "desc" } }),
    pendingCandidates(ctx.db),
    prisma.user.findUnique({
      where: { id: ctx.user.userId },
      select: { digestOptIn: true },
    }),
    factImpact(),
  ]);
  const digestOptIn = account?.digestOptIn ?? false;

  if (!org) return null;

  const byKey = new Map<string, FactRow>(
    facts.map((f) => [f.key, { key: f.key, state: f.state, valueText: f.valueText }]),
  );

  const answered = FACT_REGISTRY.filter(
    (d) => (byKey.get(d.key)?.state ?? "UNKNOWN") !== "UNKNOWN",
  ).length;
  const total = FACT_REGISTRY.length;
  const unanswered = total - answered;

  // The headline the banner turns the chore into a reason for: the most calls
  // any one unanswered fact would unlock. A single fact, answerable in one step,
  // so the number never overstates — unlike summing across facts, where one
  // grant gated by two blanks would be counted twice.
  const isUnanswered = (key: string) => (byKey.get(key)?.state ?? "UNKNOWN") === "UNKNOWN";
  const impactOf = (key: string) => (isUnanswered(key) ? (impact[key] ?? 0) : 0);
  const topUnlock = FACT_REGISTRY.reduce((max, d) => Math.max(max, impactOf(d.key)), 0);

  return (
    <div className="stack">
      <section className="section">
        <div className="section-head">
          <div>
            <span className="kicker">Профіль організації</span>
            <h1 className="h1">{org.name}</h1>
          </div>
        </div>

        <div className="row">
          {org.legalForm ? (
            <span className="tag tag-neutral">
              {LEGAL_FORM_LABEL_UK[org.legalForm as LegalForm]}
            </span>
          ) : null}
          {formatOblast(org.oblast) ? (
            <span className="tag tag-outline">{formatOblast(org.oblast)}</span>
          ) : null}
          {org.edrpou ? <span className="mono">ЄДРПОУ {org.edrpou}</span> : null}
        </div>

        {/* The count never appears without what it is made of — the same rule
            that governs the match score. */}
        <div className="stack">
          <div className="stat">
            <span className="stat-value">
              {answered}/{total}
            </span>
            <span className="stat-label">
              {unanswered === 0
                ? "профіль заповнено"
                : `${unanswered} ${pluralQuestions(unanswered)} без відповіді`}
            </span>
          </div>
          <div
            className="meter"
            role="progressbar"
            aria-valuenow={answered}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="Заповненість профілю"
          >
            <span style={{ inlineSize: `${(answered / total) * 100}%` }} />
          </div>
          <p className="prose muted">
            Незаповнені поля не блокують пошук. Вони роблять частину умов
            «невідомими» — такий грант усе одно потрапляє до стрічки, але з
            питанням, на яке варто відповісти.
          </p>
          {topUnlock > 0 ? (
            <p className="callout">
              Заповніть позначені поля — і найближче з них відкриє оцінку ще для{" "}
              <strong>{topUnlock}</strong> {pluralGrants(topUnlock)} у доборі.
            </p>
          ) : null}
        </div>
      </section>

      {/* Above the documents: a proposal waiting on a decision is the most
          actionable thing on this screen, and it decays if it sits. */}
      <ConfirmationQueue items={queue} />

      <Documents
        documents={documents.map((d) => ({
          id: d.id,
          kind: d.kind,
          filename: d.filename,
          sizeBytes: d.sizeBytes,
          uploadedAt: d.uploadedAt.toISOString(),
          extractedAt: d.extractedAt?.toISOString() ?? null,
        }))}
      />

      {GROUP_ORDER.map((group) => {
        const definitions = FACT_REGISTRY.filter((d) => d.group === group);
        if (definitions.length === 0) return null;

        return (
          <section className="section" key={group}>
            <div className="section-head">
              <h2 className="h3">{GROUP_LABEL[group]}</h2>
              <span className="kicker">
                {definitions.filter((d) => (byKey.get(d.key)?.state ?? "UNKNOWN") !== "UNKNOWN").length}
                /{definitions.length}
              </span>
            </div>

            <div>
              {definitions.map((definition) => (
                <FactLine
                  key={definition.key}
                  definition={definition}
                  fact={byKey.get(definition.key)}
                  unlocks={impactOf(definition.key)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <DigestPreference enabled={digestOptIn} />
    </div>
  );
}

/** Stored values are ISO / raw; the row shows them the way the rest of the UI does. */
function formatFactValue(kind: FactDefinition["kind"], valueText: string | null | undefined): string {
  if (!valueText) return "—";
  return kind === "DATE" ? formatIsoDateUk(valueText) : valueText;
}

function FactLine({
  definition,
  fact,
  unlocks,
}: {
  definition: FactDefinition;
  fact: FactRow | undefined;
  /** Open grants this fact would let us judge, if it is still unanswered. */
  unlocks: number;
}) {
  const state = fact?.state ?? "UNKNOWN";
  const tag = stateTag(state);
  const unknown = state === "UNKNOWN";

  return (
    <div className="fact">
      <div className="fact-label">
        {definition.labelUk}
        {unknown && unlocks > 0 ? (
          <span className="fact-unlock" title={`Відповідь відкриє оцінку для ${unlocks} ${pluralGrants(unlocks)}`}>
            +{unlocks} {pluralGrants(unlocks)}
          </span>
        ) : null}
      </div>

      <div className={unknown ? "fact-question" : "fact-value"}>
        {unknown ? definition.questionUk : formatFactValue(definition.kind, fact?.valueText)}
      </div>

      {/* One line, not a column. Stacked, the tag and the action made each fact
          row nearly three times the height of its content, and across eighteen
          rows that is most of a screen spent on whitespace. A profile you have
          to scroll three screens to read is one nobody finishes filling in. */}
      <div className="fact-actions">
        <span className={tag.cls}>
          <tag.Icon size={12} aria-hidden="true" />
          {tag.label}
        </span>
        <FactEditor
          factKey={definition.key}
          kind={definition.kind}
          questionUk={definition.questionUk}
          currentValue={fact?.valueText ?? null}
          state={state}
        />
      </div>
    </div>
  );
}

/** Ukrainian has three plural forms — never build this by concatenation. */
function pluralQuestions(n: number): string {
  const rules = new Intl.PluralRules("uk");
  switch (rules.select(n)) {
    case "one":
      return "питання";
    case "few":
      return "питання";
    default:
      return "питань";
  }
}

function pluralGrants(n: number): string {
  const rules = new Intl.PluralRules("uk");
  switch (rules.select(n)) {
    case "one":
      return "конкурс";
    case "few":
      return "конкурси";
    default:
      return "конкурсів";
  }
}
