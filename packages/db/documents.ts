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

const BY_EXTENSION = new Map<string, string>([
  ["pdf", "application/pdf"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["doc", "application/msword"],
  ["txt", "text/plain"],
]);

/**
 * The real format of an upload, because the browser's guess is not enough.
 *
 * `File.type` is empty or `application/octet-stream` whenever the OS has no
 * handler registered for the extension — routine for `.doc`, common for `.docx`
 * on a machine without Office, and it happens to `.pdf` too. Trusting it alone
 * rejects a valid statute with "формат не підтримується". So: the reported type
 * wins only if we already accept it; otherwise the filename extension decides.
 * The leading bytes are a last resort, used only when the filename has no
 * extension at all — an extension we don't recognise (`.zip`, `.pages`) is a
 * "no" even if its bytes happen to look like one of ours.
 *
 * Returns null when nothing identifies it as one of the four formats.
 */
export function resolveMimeType(
  filename: string,
  reported: string,
  bytes: Uint8Array,
): string | null {
  if (ACCEPTED.has(reported)) return reported;

  const ext = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase();
  if (ext) return BY_EXTENSION.get(ext) ?? null;

  return sniff(bytes);
}

/** Format from the leading bytes — only for a file with no extension at all. */
function sniff(bytes: Uint8Array): string | null {
  const at = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (at(0x25, 0x50, 0x44, 0x46)) return "application/pdf"; // %PDF
  if (at(0x50, 0x4b, 0x03, 0x04) || at(0x50, 0x4b, 0x05, 0x06)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; // PK.. (zip → docx)
  }
  if (at(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return "application/msword"; // OLE2 (legacy .doc)
  return null;
}

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
  /**
   * Set when this is the donor's material for one call rather than the
   * organization's own.
   *
   * Donor guidelines describe a call, not an organization, and must never reach
   * the profile knowledge base — a co-financing rule from someone else's grant
   * becoming a fact about your NGO would be a quiet, durable corruption. The
   * fact extractor filters on this.
   */
  grantId?: string | null;
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

  // Not input.mimeType directly: the browser reports "" for a .doc as often as
  // not, and the extension is the more reliable signal. The resolved type is
  // what gets stored, so text extraction downstream switches on something true.
  const mimeType = resolveMimeType(input.filename, input.mimeType, input.bytes);
  if (!mimeType) {
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
    mimeType,
    sizeBytes: stored.sizeBytes,
    contentHash: hash,
    grantId: input.grantId ?? null,
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
  await downgradeFactsLosingProvenance(db);
}

/**
 * Demote any CONFIRMED fact that just lost its last citation.
 *
 * Deleting a document cascades its citations away, and a CONFIRMED fact with no
 * citation is exactly the state `org-knowledge-base` forbids — a claim usable in
 * a funding application that nobody can trace to a source. The database enforces
 * that on write and cannot enforce it through a cascade, so it is enforced here.
 *
 * Demotion rather than refusing the delete: the organization asked for its
 * document to go, and `pii-and-donor-data` says a deletion must actually delete.
 * The fact survives as SELF_REPORTED — still good enough to inform a match,
 * no longer good enough to state to a donor — and the user is asked again if it
 * matters.
 */
async function downgradeFactsLosingProvenance(db: ScopedClient): Promise<number> {
  const stranded = await db.organizationFact.findMany({
    where: { state: "CONFIRMED", citations: { none: {} } },
    select: { id: true, key: true, organizationId: true },
  });
  if (stranded.length === 0) return 0;

  await prisma.$transaction([
    prisma.organizationFact.updateMany({
      where: { id: { in: stranded.map((f) => f.id) } },
      data: { state: "SELF_REPORTED", confirmedAt: null, confirmedByUserId: null },
    }),
    prisma.auditEntry.createMany({
      data: stranded.map((f) => ({
        organizationId: f.organizationId,
        actorType: "SYSTEM" as const,
        action: "fact.provenance_lost",
        subjectType: "OrganizationFact",
        subjectId: f.id,
        fromState: "CONFIRMED",
        toState: "SELF_REPORTED",
      })),
    }),
  ]);

  return stranded.length;
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
