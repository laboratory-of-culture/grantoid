/**
 * Document storage.
 *
 * An interface with one implementation today (local filesystem, per the
 * decision to keep infrastructure minimal). It exists as an interface because
 * the swap to S3-compatible storage is a change of implementation, not of call
 * sites — and because a delete path written against `fs.unlink` directly is a
 * delete path that will be rewritten under pressure when the swap comes, which
 * is exactly when it should not be.
 *
 * The rule from `pii-and-donor-data`: deleting an organization deletes its
 * documents, not only the rows referencing them. A cascade that leaves orphaned
 * files is a deletion that did not happen.
 */

export type StoredObject = {
  /** Opaque address. Stored on `Document.storageKey`; never a user-supplied path. */
  key: string;
  sizeBytes: number;
};

export interface DocumentStore {
  /**
   * Store bytes for one organization and return the address.
   *
   * `organizationId` is part of the key so that deleting an organization is a
   * prefix operation rather than a query-then-loop that can miss rows.
   */
  put(organizationId: string, filename: string, bytes: Uint8Array): Promise<StoredObject>;

  get(key: string): Promise<Uint8Array>;

  /** Idempotent — deleting an absent object is not an error. */
  delete(key: string): Promise<void>;

  /** Remove every object belonging to one organization. */
  deleteOrganization(organizationId: string): Promise<number>;

  exists(key: string): Promise<boolean>;
}

export { LocalDocumentStore, contentHash, safeFilename } from "./local";
