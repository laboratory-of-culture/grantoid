/**
 * Document rows and their bytes, kept in step.
 *
 * The pairing is the whole point of this module: a row without its file is a
 * broken download, and a file without its row is an orphan nobody will ever
 * find. Both writes happen here so no call site has to remember both.
 */

import type { DocumentKind, Prisma } from "@prisma/client";

import { LocalDocumentStore, contentHash, type DocumentStore } from "../storage";
import { prisma, type ScopedClient } from "./tenancy";

export const MAX_BYTES = 20 * 1024 * 1024;

/**
 * What an NGO actually uploads. Deliberately narrow — every additional type is
 * another parser to keep working, and these four cover the profile.
 */
export const ACCEPTED = new Map<string, string>([
  ["application/pdf", "pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/msword", "doc"],
  ["text/plain", "txt"],
]);

export class UploadRejected extends Error {}

let defaultStore: DocumentStore | null = null;
export function documentStore(): DocumentStore {
  defaultStore ??= new LocalDocumentStore(process.env.GRANT_AI_STORAGE_ROOT);
  return defaultStore;
}

export type UploadInput = {
  organizationId: string;
  filename: string;
  mimeType: string;
  kind: DocumentKind;
  bytes: Uint8Array;
};

/**
 * Store the bytes, then write the row.
 *
 * Bytes first: a failed row write leaves a file the organization sweep will
 * still collect, whereas a row pointing at bytes that were never written is a
 * download that 404s with no way to tell why.
 */
export async function uploadDocument(
  db: ScopedClient,
  input: UploadInput,
  store: DocumentStore = documentStore(),
) {
  if (input.bytes.byteLength === 0) {
    throw new UploadRejected("Файл порожній. Виберіть інший файл.");
  }
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new UploadRejected("Файл більший за 20 МБ. Стисніть його або завантажте частинами.");
  }
  if (!ACCEPTED.has(input.mimeType)) {
    throw new UploadRejected("Підтримуються PDF, DOCX, DOC і TXT. Виберіть файл цих форматів.");
  }

  const hash = contentHash(input.bytes);
  const duplicate = await db.document.findFirst({
    where: { contentHash: hash },
    select: { id: true, filename: true },
  });
  if (duplicate) {
    throw new UploadRejected(
      `Цей файл уже завантажено як «${duplicate.filename}». Завантажте інший документ.`,
    );
  }

  const stored = await store.put(input.organizationId, input.filename, input.bytes);

  // The scoped client injects organizationId; the generated type cannot know
  // that. Same reconciliation as `createFact` in repositories.ts.
  const data = {
    kind: input.kind,
    filename: input.filename,
    storageKey: stored.key,
    mimeType: input.mimeType,
    sizeBytes: stored.sizeBytes,
    contentHash: hash,
  } as Prisma.DocumentUncheckedCreateInput;

  return db.document.create({ data });
}

/**
 * Delete a document the caller owns, row and bytes.
 *
 * Ownership is checked with a scoped read first — a unique-key delete carries no
 * tenant, so a leaked id would otherwise be enough to remove another
 * organization's statute.
 */
export async function deleteDocument(
  db: ScopedClient,
  id: string,
  store: DocumentStore = documentStore(),
): Promise<void> {
  const owned = await db.document.findFirst({
    where: { id },
    select: { id: true, storageKey: true },
  });
  if (!owned) {
    throw new Error(`document ${id} does not belong to this organization`);
  }

  await prisma.document.delete({ where: { id: owned.id } });
  await store.delete(owned.storageKey);
}

/**
 * Remove an organization entirely: rows by cascade, bytes by prefix.
 *
 * The prefix sweep is not redundant with the cascade. A row that was already
 * deleted leaves bytes a row-by-row loop can no longer see, and that orphan is
 * exactly what `pii-and-donor-data` says a deletion must not leave behind.
 */
export async function deleteOrganizationCompletely(
  organizationId: string,
  store: DocumentStore = documentStore(),
): Promise<{ files: number }> {
  const files = await store.deleteOrganization(organizationId);
  await prisma.organization.delete({ where: { id: organizationId } });
  return { files };
}
