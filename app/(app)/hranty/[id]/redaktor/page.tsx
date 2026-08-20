import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock } from "lucide-react";

import { loadConcept } from "../../../../../packages/db/concepts";
import { listDonorDocuments } from "../../../../../packages/db/donor-docs";
import { DonorDocuments } from "./donor-docs";
import { loadGrantForWriting } from "../../../../../packages/db/grant-header";
import { CONCEPT_SECTIONS } from "../../../../../packages/schemas/concept";
import { FACT_KEYS } from "../../../../../packages/schemas/fact-registry";
import { formatDateUk } from "../../../../../packages/schemas/locale-uk";
import { AiNotice } from "../../../../components/beta";
import { requireDb } from "../../../../lib/session";
import { ConceptDocument, EmptyConcept } from "./document";

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

  const grant = await loadGrantForWriting(organizationId, id);
  if (!grant) notFound();

  const [concept, donorDocs, answeredFacts] = await Promise.all([
    loadConcept(organizationId, id),
    listDonorDocuments(organizationId, id),
    db.organizationFact.count({
      // Registry keys only. Rows survive a key being retired from the registry,
      // and counting them would print a share larger than its own denominator.
      where: { key: { in: FACT_KEYS }, state: { not: "UNKNOWN" } },
    }),
  ]);

  return (
    <div className="stack">
      {/* A privately supplied call has no breakdown to go back to until the
          nightly run reaches it, and a link to an empty screen is worse than
          no link. */}
      <Link href={grant.privateToOrganization ? "/zayavky" : `/hranty/${id}`} className="btn btn-ghost">
        <ArrowLeft size={14} aria-hidden="true" />
        {grant.privateToOrganization ? "До ваших конкурсів" : "До розбору за критеріями"}
      </Link>

      <div>
        <span className="kicker">{grant.donorName}</span>
        <h1 className="h1">{concept?.title ?? grant.titleUk}</h1>
      </div>

      <div className="row">
        {grant.synthetic ? <span className="tag tag-outline">тестовий запис</span> : null}
        {grant.deadlineIsKnown && grant.deadline ? (
          <span className="tag tag-neutral">
            <CalendarClock size={12} aria-hidden="true" />
            подання до {formatDateUk(grant.deadline)}
          </span>
        ) : (
          <span className="tag tag-outline">термін не вказано в оголошенні</span>
        )}
        <AiNotice detail="чернетку треба прочитати перед подачею" />
      </div>

      {/* The conditions, permanently visible. Writing a concept with the rules
          on another screen is how a draft drifts from what the donor asked. */}
      <details className="section">
        <summary className="h3">Умови конкурсу ({grant.rules.length})</summary>
        {grant.rules.length > 0 ? (
          <ul className="prose">
            {grant.rules.map((r) => (
              <li key={r.key}>
                {r.textUk}
                {r.kind === "PREFERRED" ? " — перевага, не вимога" : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="prose muted">
            З документа не вдалося виокремити жодної умови. Читайте оригінал — умови в ньому
            є, ми їх не розібрали.
          </p>
        )}
        {/* Two things were being said with one number, and both wrongly. The
            score measures how many decisive fields came back, not what share of
            the text was read — and «решта в документах донора» is advice that
            makes no sense on a screen whose source *is* the donor's document.
            A fixture states everything by construction and needs no warning at
            all; live announcements never reach 1.0, the ceiling is 0.75. */}
        {grant.extractionConfidence < 1 ? (
          <p className="prose muted">
            Заповнено {Math.round(grant.extractionConfidence * 100)}% ключових полів конкурсу.
            {grant.privateToOrganization
              ? " Решта в документі є — ми її не розібрали. Звіряйте з оригіналом."
              : " Решта — в документах донора, яких ми не читали."}
          </p>
        ) : null}
      </details>

      <DonorDocuments
        grantId={id}
        documents={donorDocs}
        extractionConfidence={grant.extractionConfidence}
      />

      {/* One document, not eight cards. The per-section state it is built from
          is unchanged — an unread AI draft is still a distinct thing from a
          section a person has been through — but a concept note is read as one
          argument, and boxing each paragraph hid whether the argument held. */}
      {concept ? (
        <ConceptDocument grantId={id} concept={concept} />
      ) : (
        <EmptyConcept grantId={id} />
      )}
    </div>
  );
}
