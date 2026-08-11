/**
 * The donor's own material for one call.
 *
 * This is what closes the gap ingestion cannot. An aggregator announcement gives
 * roughly 0.6 confidence and the missing part — co-financing, duration, budget
 * rules, the disqualifying clause — sits in a PDF on the donor's site. Fetching
 * that speculatively for every call would be a lot of crawling for material
 * nobody reads. The moment an organization decides to apply is exactly when it
 * becomes worth having, and it is also the moment they can supply it themselves.
 *
 * Scoped to the organization even though it describes a shared Grant. One NGO's
 * upload must not rewrite what another sees: a `Grant` row is public data, and a
 * document somebody attached to it is not.
 */

import { extractText } from "../documents/text";
import { documentStore } from "./documents";
import { forOrganization } from "./tenancy";

/** Characters of donor material handed to an agent, per call. */
export const MAX_DONOR_CHARS = 20_000;

export type DonorDocument = {
  id: string;
  filename: string;
  sizeBytes: number;
  uploadedAt: Date;
  pageCount: number | null;
};

export async function listDonorDocuments(
  organizationId: string,
  grantId: string,
): Promise<DonorDocument[]> {
  const db = forOrganization(organizationId);
  const rows = await db.document.findMany({
    where: { grantId },
    orderBy: { uploadedAt: "asc" },
  });

  return rows.map((d) => ({
    id: d.id,
    filename: d.filename,
    sizeBytes: d.sizeBytes,
    uploadedAt: d.uploadedAt,
    pageCount: d.pageCount,
  }));
}

export type DonorMaterial = {
  /** Concatenated text, truncated to the budget. Empty when nothing readable. */
  text: string;
  /** Files that produced nothing — usually scans with no text layer. */
  unreadable: string[];
  truncated: boolean;
};

/**
 * The text of every donor document for this call.
 *
 * Read on demand rather than cached: these are a handful of files per grant,
 * read at most a few times, and a cache would be one more place for the copy to
 * diverge from the file the organization actually uploaded.
 */
export async function donorMaterial(
  organizationId: string,
  grantId: string,
): Promise<DonorMaterial> {
  const db = forOrganization(organizationId);
  const rows = await db.document.findMany({
    where: { grantId },
    orderBy: { uploadedAt: "asc" },
  });

  const store = documentStore();
  const parts: string[] = [];
  const unreadable: string[] = [];

  for (const row of rows) {
    try {
      const bytes = await store.get(row.storageKey);
      const { text, emptyReason } = await extractText(row.mimeType, bytes);
      if (emptyReason || text.trim().length === 0) {
        unreadable.push(row.filename);
        continue;
      }
      parts.push(`## ${row.filename}\n${text.trim()}`);
    } catch {
      // A missing file is a storage problem, not the caller's. Name it and move
      // on rather than failing the whole draft.
      unreadable.push(row.filename);
    }
  }

  const joined = parts.join("\n\n");
  const truncated = joined.length > MAX_DONOR_CHARS;

  return {
    text: truncated ? joined.slice(0, MAX_DONOR_CHARS) : joined,
    unreadable,
    truncated,
  };
}
