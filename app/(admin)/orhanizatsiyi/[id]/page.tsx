import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { loadOrganization } from "../../../../packages/db/admin";
import { formatDateUk } from "../../../../packages/schemas/locale-uk";
import { requireAdmin } from "../../../lib/session";

export const dynamic = "force-dynamic";

/** Verdict enum to the words the product uses everywhere else. */
const VERDICT_UK: Record<string, string> = {
  MATCH: "Підходить",
  LIKELY_MATCH: "Ймовірно підходить",
  UNCERTAIN: "Невідомо",
  LIKELY_NOT_ELIGIBLE: "Ймовірно не підходить",
  NOT_ELIGIBLE: "Не підходить",
};

/**
 * Audit actions in Ukrainian.
 *
 * The log stores dotted machine names, and an operator screen that prints
 * `concept.section_approved` is asking a person to read a slug. Anything not
 * listed falls through as itself, which is the honest default: a new action
 * shows up unlabelled rather than silently mislabelled.
 */
const ACTION_UK: Record<string, string> = {
  "organization.registered": "Організацію зареєстровано",
  "fact.answered": "Відповідь у профілі",
  "fact.confirmed": "Факт підтверджено",
  "fact.withdrawn": "Відповідь прибрано",
  "fact.rejected": "Факт відхилено",
  "document.uploaded": "Завантажено документ",
  "document.extracted": "З документа витягнуто факти",
  "document.deleted": "Документ видалено",
  "grant.created_from_document": "Конкурс створено з документа",
  "concept.generated": "Створено чернетку концепції",
  "concept.section_edited": "Секцію відредаговано",
  "concept.section_approved": "Секцію прочитано",
  "concept.approved": "Концепцію підтверджено",
  "digest.sent": "Надіслано щотижневий лист",
};

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const org = await loadOrganization(id);
  if (!org) notFound();

  return (
    <div className="stack">
      <Link href="/orhanizatsiyi" className="btn btn-ghost">
        <ArrowLeft size={14} aria-hidden="true" />
        До списку організацій
      </Link>

      <div>
        <span className="kicker">
          {[org.legalForm, org.oblast].filter(Boolean).join(" · ") || "профіль порожній"}
        </span>
        <h1 className="h1">{org.name}</h1>
      </div>

      <div className="row">
        <span className="tag tag-neutral">
          профіль {org.answered}/{org.totalFields}
        </span>
        <span className="tag tag-neutral">документів {org.documents}</span>
        <span className="tag tag-neutral">оцінок {org.matches}</span>
        <span className="tag tag-neutral">чернеток {org.drafts}</span>
        <span className="kicker">
          зареєстровано {formatDateUk(org.createdAt)}
          {org.lastActivity ? ` · остання дія ${formatDateUk(org.lastActivity)}` : ""}
        </span>
      </div>

      {/* The first thing to check when somebody reports that nothing works.
          Below three answered fields the concept writer refuses outright, and
          the message it shows names the fields — but an operator looking at a
          support request sees this instead. */}
      {org.answered < 3 ? (
        <p className="field-error" role="alert">
          У профілі менше трьох відповідей. Система відмовиться писати концепцію, доки
          організація не заповнить напрями діяльності, цільові аудиторії та географію.
        </p>
      ) : null}

      <section className="section">
        <h2 className="h3">Люди</h2>
        <ul className="prose">
          {org.emails.map((email) => (
            <li key={email} className="mono">
              {email}
            </li>
          ))}
          {org.emails.length === 0 ? (
            <li className="muted">
              Жодного користувача. Організація лишилася без доступу — таке буває після
              видалення облікового запису.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h3">Стрічка</h2>
          <span className="kicker">рекомендовано {org.recommended}</span>
        </div>
        {org.verdicts.length === 0 ? (
          <p className="prose muted">
            Оцінок ще немає. Нічний прогін будує стрічки всім організаціям, тож порожньо
            тут означає, що він не відпрацював жодного разу після реєстрації.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Вердикт</th>
                  <th>Конкурсів</th>
                </tr>
              </thead>
              <tbody>
                {org.verdicts.map((v) => (
                  <tr key={v.verdict}>
                    <td>{VERDICT_UK[v.verdict] ?? v.verdict}</td>
                    <td className="mono">{v.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="h3">Документи</h2>
        {org.documentRows.length === 0 ? (
          <p className="prose muted">Нічого не завантажено.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Файл</th>
                  <th>Тип</th>
                  <th>Розмір</th>
                  <th>Завантажено</th>
                  <th>Опрацьовано</th>
                </tr>
              </thead>
              <tbody>
                {org.documentRows.map((d) => (
                  <tr key={d.id}>
                    <td className="mono">{d.filename}</td>
                    <td className="mono">{d.kind}</td>
                    <td className="mono">{Math.round(d.sizeBytes / 1024)} КБ</td>
                    <td className="mono">{formatDateUk(d.uploadedAt)}</td>
                    <td>
                      {d.extractionError ? (
                        <span className="field-error">{d.extractionError}</span>
                      ) : d.extractedAt ? (
                        <span className="mono">{formatDateUk(d.extractedAt)}</span>
                      ) : (
                        <span className="tag tag-state-unknown">ще ні</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h3">Журнал дій</h2>
          <span className="kicker">останні {org.trail.length}</span>
        </div>
        {org.trail.length === 0 ? (
          <p className="prose muted">Порожньо.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Коли</th>
                  <th>Дія</th>
                  <th>Хто</th>
                </tr>
              </thead>
              <tbody>
                {org.trail.map((e, i) => (
                  <tr key={`${e.at.toISOString()}-${i}`}>
                    <td className="mono">{formatDateUk(e.at)}</td>
                    <td>{ACTION_UK[e.action] ?? <span className="mono">{e.action}</span>}</td>
                    <td className="mono">
                      {e.actorType === "USER" ? "людина" : e.actorType === "AGENT" ? "модель" : "система"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="field-hint">
        На цьому екрані немає ані тексту заявок, ані вмісту документів, ані значень полів
        профілю. Тільки те, що потрібно, щоб побачити, чи працює система для цієї
        організації.
      </p>
    </div>
  );
}
