"use client";

import { useActionState } from "react";
import { FileUp, Trash2 } from "lucide-react";

import type { DonorDocument } from "../../../../../packages/db/donor-docs";
import {
  deleteDonorDocAction,
  uploadDonorDocAction,
  type EditorResult,
} from "./actions";

/**
 * The donor's own documents for this call.
 *
 * The point of the whole editor sitting inside one grant. An aggregator
 * announcement is a notice *about* a call; the guidelines PDF is the call. Once
 * these are here the concept is written against the real terms rather than
 * against a summary of them.
 */
export function DonorDocuments({
  grantId,
  documents,
  extractionConfidence,
}: {
  grantId: string;
  documents: DonorDocument[];
  extractionConfidence: number;
}) {
  const [uploadState, upload, uploading] = useActionState<EditorResult, FormData>(
    uploadDonorDocAction,
    null,
  );
  const [deleteState, remove] = useActionState<EditorResult, FormData>(
    deleteDonorDocAction,
    null,
  );

  return (
    <section className="section">
      <div className="section-head">
        <h2 className="h3">Документи донора</h2>
        <span className="kicker">{documents.length}</span>
      </div>

      <p className="prose muted">
        {documents.length === 0 && extractionConfidence < 1
          ? `З оголошення прочитано ${Math.round(extractionConfidence * 100)}% умов. Решта —
             співфінансування, тривалість, обмеження бюджету — зазвичай у PDF на сайті донора.
             Завантажте його, і концепція писатиметься за справжніми умовами, а не за анонсом.`
          : `Ці файли читаються під час генерації концепції. Вони не потрапляють до профілю
             організації — це умови конкурсу, а не факти про вас.`}
      </p>

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

      {documents.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Файл</th>
                <th>Розмір</th>
                <th>Завантажено</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.filename}</td>
                  <td className="mono">{formatSize(doc.sizeBytes)}</td>
                  <td>{doc.uploadedAt.toLocaleDateString("uk-UA")}</td>
                  <td>
                    <form action={remove}>
                      <input type="hidden" name="grantId" value={grantId} />
                      <input type="hidden" name="documentId" value={doc.id} />
                      <button type="submit" className="btn btn-ghost">
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
      ) : null}

      <form action={upload} className="row">
        <input type="hidden" name="grantId" value={grantId} />
        <label className="field">
          <span className="field-label">Файл</span>
          <input
            className="input"
            type="file"
            name="file"
            accept=".pdf,.docx,.doc,.txt"
            required
          />
          <span className="field-hint">PDF, DOCX, DOC або TXT, до 20 МБ</span>
        </label>
        <button type="submit" className="btn btn-secondary" disabled={uploading}>
          <FileUp size={14} aria-hidden="true" />
          {uploading ? "Завантажуємо…" : "Завантажити"}
        </button>
      </form>
    </section>
  );
}

function formatSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 }).format(kb / 1024)} МБ`;
  }
  return `${new Intl.NumberFormat("uk-UA").format(Math.max(1, Math.round(kb)))} КБ`;
}
