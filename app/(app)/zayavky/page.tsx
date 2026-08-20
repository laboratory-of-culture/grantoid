import Link from "next/link";
import { ArrowRight, CalendarClock, PenLine } from "lucide-react";

import { CONCEPT_SECTIONS } from "../../../packages/schemas/concept";
import { NOUN_UK, countUk, formatDateUk } from "../../../packages/schemas/locale-uk";
import { AiNotice } from "../../components/beta";
import { requireDb } from "../../lib/session";
import { UploadCall } from "./upload";

export const dynamic = "force-dynamic";

/**
 * Everything this organization is working on.
 *
 * The editor was reachable only from the feed, which quietly assumed every call
 * comes from a source we crawl. Two things break that assumption: a draft you
 * started last week and want to get back to, and a call a donor mailed you that
 * was never published anywhere.
 */
export default async function ApplicationsPage() {
  const { db } = await requireDb();

  const drafts = await db.conceptDraft.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      sections: true,
      grant: {
        select: {
          id: true,
          titleUk: true,
          title: true,
          donorName: true,
          deadline: true,
          deadlineIsKnown: true,
          ownerOrganizationId: true,
        },
      },
    },
  });

  return (
    <div className="stack">
      <div className="section-head">
        <div>
          <span className="kicker">Заявки</span>
          <h1 className="h1">Над чим ви працюєте</h1>
        </div>
      </div>

      {drafts.length === 0 ? (
        <div className="empty stack">
          <h2 className="h3">Чернеток ще немає</h2>
          <p className="prose">
            Оберіть конкурс у стрічці й відкрийте редактор — або завантажте нижче умови
            конкурсу, які надіслав донор.
          </p>
          <Link href="/mozhlyvosti" className="btn btn-secondary">
            До стрічки
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          <div className="row">
            <AiNotice detail="чернетки треба прочитати перед подачею" />
          </div>

          <div className="stack">
            {drafts.map((draft) => {
              // Unread AI sections, counted here rather than read off the status
              // column: the status can lag a regeneration, and this is the
              // number that decides whether the draft is safe to send.
              const unread = draft.sections.filter(
                (s) => s.source === "AI_DRAFT" && s.approvedAt === null,
              ).length;

              return (
                <article key={draft.id} className="card stack">
                  <div className="row">
                    <span
                      className={`tag ${
                        unread === 0 ? "tag-state-matched" : "tag-state-unknown"
                      }`}
                    >
                      {unread === 0 ? "усе прочитано" : `${unread} не прочитано`}
                    </span>
                    {draft.grant.ownerOrganizationId ? (
                      <span className="tag tag-outline">отримано напряму</span>
                    ) : null}
                    {draft.grant.deadlineIsKnown && draft.grant.deadline ? (
                      <span className="tag tag-neutral">
                        <CalendarClock size={12} aria-hidden="true" />
                        до {formatDateUk(draft.grant.deadline)}
                      </span>
                    ) : (
                      <span className="tag tag-outline">термін не вказано</span>
                    )}
                  </div>

                  <h2 className="card-title">
                    <Link href={`/hranty/${draft.grant.id}/redaktor`}>{draft.title}</Link>
                  </h2>

                  <p className="card-body muted">
                    {draft.grant.titleUk ?? draft.grant.title} — {draft.grant.donorName}
                  </p>

                  <div className="card-meta">
                    <span className="kicker">
                      {draft.sections.length} з {CONCEPT_SECTIONS.length} секцій · оновлено{" "}
                      {formatDateUk(draft.updatedAt)}
                    </span>
                    <Link
                      href={`/hranty/${draft.grant.id}/redaktor`}
                      className="btn btn-ghost push-end"
                    >
                      <PenLine size={14} aria-hidden="true" />
                      Відкрити редактор
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="field-hint">{countUk(drafts.length, NOUN_UK.draft)} у роботі.</p>
        </>
      )}

      <UploadCall />
    </div>
  );
}
