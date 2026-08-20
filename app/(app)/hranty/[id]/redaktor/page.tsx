import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock } from "lucide-react";

import { loadConcept } from "../../../../../packages/db/concepts";
import { listDonorDocuments } from "../../../../../packages/db/donor-docs";
import { DonorDocuments } from "./donor-docs";
import { loadMatch } from "../../../../../packages/matching/feed";
import { CONCEPT_SECTIONS } from "../../../../../packages/schemas/concept";
import { FACT_KEYS } from "../../../../../packages/schemas/fact-registry";
import { AiNotice } from "../../../../components/beta";
import { requireDb } from "../../../../lib/session";
import { ConceptEditor } from "./editor";

export const dynamic = "force-dynamic";

/**
 * The grant editor.
 *
 * Reached from one opportunity and scoped to it. This is where the three
 * sections that used to sit in the navigation — concepts, applications, donor
 * requirements — actually belong: none of that work exists in general, it
 * exists against one call with one deadline.
 *
 * The call's terms stay on screen while writing, because the alternative is a
 * grant manager holding them in their head, and a concept that quietly drifts
 * from the conditions is the expensive kind of rework.
 */
export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, organizationId } = await requireDb();
  const { id } = await params;

  const entry = await loadMatch(organizationId, id);
  if (!entry) notFound();

  const [concept, donorDocs, answeredFacts] = await Promise.all([
    loadConcept(organizationId, id),
    listDonorDocuments(organizationId, id),
    db.organizationFact.count({ where: { state: { not: "UNKNOWN" } } }),
  ]);

  return (
    <div className="stack">
      <Link href={`/hranty/${id}`} className="btn btn-ghost">
        <ArrowLeft size={14} aria-hidden="true" />
        До розбору за критеріями
      </Link>

      <div>
        <span className="kicker">{entry.donorName}</span>
        <h1 className="h1">{concept?.title ?? entry.titleUk}</h1>
      </div>

      <div className="row">
        {entry.synthetic ? <span className="tag tag-outline">тестовий запис</span> : null}
        {entry.deadlineIsKnown && entry.deadline ? (
          <span className="tag tag-neutral">
            <CalendarClock size={12} aria-hidden="true" />
            подання до {entry.deadline.toLocaleDateString("uk-UA")}
          </span>
        ) : (
          <span className="tag tag-outline">термін не вказано в оголошенні</span>
        )}
        <AiNotice detail="чернетку треба прочитати перед подачею" />
      </div>

      {/* The conditions, permanently visible. Writing a concept with the rules
          on another screen is how a draft drifts from what the donor asked. */}
      <details className="section">
        <summary className="h3">Умови конкурсу ({entry.criteria.length})</summary>
        <ul className="prose">
          {entry.criteria.map((c) => (
            <li key={c.ruleKey}>
              {c.ruleTextUk}
              {c.ruleKind === "PREFERRED" ? " — перевага, не вимога" : null}
            </li>
          ))}
        </ul>
        {/* A fixture states everything by construction, so the warning would be
            false. Live announcements never reach 1.0 — the ceiling is 0.75. */}
        {entry.extractionConfidence < 1 ? (
          <p className="prose muted">
            Це не повні умови: прочитано {Math.round(entry.extractionConfidence * 100)}% з
            оголошення. Решта — в документах донора.
          </p>
        ) : null}
      </details>

      <DonorDocuments
        grantId={id}
        documents={donorDocs}
        extractionConfidence={entry.extractionConfidence}
      />

      <ConceptEditor
        grantId={id}
        concept={concept}
        allSections={CONCEPT_SECTIONS.map((s) => ({
          key: s.key,
          labelUk: s.labelUk,
          promptUk: s.promptUk,
        }))}
        // What the generator was allowed to write from. Named on every section
        // it produced, because a paragraph that will end up in an application
        // has to be traceable to something the organization can check.
        sources={{
          answeredFacts,
          totalFacts: FACT_KEYS.length,
          criteria: entry.criteria.length,
          donorDocs: donorDocs.length,
        }}
      />
    </div>
  );
}
