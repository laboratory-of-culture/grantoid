"use client";

import { useActionState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";

import { deleteDocumentAction, uploadDocumentAction, type ActionResult } from "./actions";

export type DocumentRow = {
  id: string;
  kind: string;
  filename: string;
  sizeBytes: number;
  uploadedAt: string;
  extractedAt: string | null;
};

const KIND_LABEL: Record<string, string> = {
  STATUT: "Статут",
  REGISTRATION: "Реєстраційні документи",
  ANNUAL_REPORT: "Річний звіт",
  PREVIOUS_APPLICATION: "Попередня заявка",
  PROJECT_DESCRIPTION: "Опис проєкту",
  STRATEGY: "Стратегія",
  OTHER: "Інше",
};

export function Documents({ documents }: { documents: DocumentRow[] }) {
  const [uploadState, upload, uploading] = useActionState<ActionResult | null, FormData>(
    uploadDocumentAction,
    null,
  );
  const [deleteState, remove] = useActionState<ActionResult | null, FormData>(
    deleteDocumentAction,
    null,
  );

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="h3">Документи</h2>
        <span className="kicker">{documents.length}</span>
      </div>

      <p className="prose muted">
        Завантажте статут, реєстраційні документи чи попередні заявки — з них
        можна витягти факти профілю. Кожен витягнутий факт зберігає цитату й
        сторінку, і потрапляє до профілю лише після вашого підтвердження.
      </p>

      <form action={upload} className="stack">
        <div className="row">
          <label className="field">
            <span className="field-label">Тип документа</span>
            <select name="kind" className="input" defaultValue="STATUT">
              {Object.entries(KIND_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Файл</span>
            <input
              type="file"
              name="file"
              className="input"
              accept=".pdf,.docx,.doc,.txt"
              required
            />
            <span className="field-hint">PDF, DOCX, DOC або TXT, до 20 МБ</span>
          </label>
        </div>

        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={uploading}>
            <Upload size={16} aria-hidden="true" />
            {uploading ? "Завантажуємо…" : "Завантажити"}
          </button>
        </div>

        {uploadState && !uploadState.ok ? (
          <p className="field-error" role="alert">
            {uploadState.message}
          </p>
        ) : null}
        {deleteState && !deleteState.ok ? (
          <p className="field-error" role="alert">
            {deleteState.message}
          </p>
        ) : null}
      </form>

      {documents.length === 0 ? (
        <div className="empty">
          <p className="prose muted">
            Ще немає завантажених документів. Почніть зі статуту — він
            підтверджує організаційно-правову форму й неприбутковий статус.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Документ</th>
                <th scope="col">Тип</th>
                <th scope="col">Розмір</th>
                <th scope="col">Опрацьовано</th>
                <th scope="col">
                  <span className="visually-hidden">Дії</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <span className="row">
                      <FileText size={14} aria-hidden="true" />
                      {doc.filename}
                    </span>
                  </td>
                  <td>{KIND_LABEL[doc.kind] ?? doc.kind}</td>
                  <td className="num">{formatSize(doc.sizeBytes)}</td>
                  <td>
                    {doc.extractedAt ? (
                      <span className="tag tag-neutral">Опрацьовано</span>
                    ) : (
                      <span className="tag tag-state-unknown">Ще ні</span>
                    )}
                  </td>
                  <td>
                    <form action={remove}>
                      <input type="hidden" name="id" value={doc.id} />
                      <button
                        type="submit"
                        className="btn btn-ghost"
                        aria-label={`Видалити ${doc.filename}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Видалити
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Ukrainian uses a comma as the decimal separator and a space for thousands. */
function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 }).format(mb)} МБ`;
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${new Intl.NumberFormat("uk-UA").format(kb)} КБ`;
}
