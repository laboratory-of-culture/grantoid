/**
 * Local filesystem document store.
 *
 * Layout: `<root>/<organizationId>/<random>-<safeName>`. The organization is a
 * directory rather than a filename prefix so that deleting one is a single
 * recursive remove — a loop over rows can miss a document whose row was already
 * gone, and that is precisely the orphan the delete test exists to catch.
 */

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DocumentStore, StoredObject } from "./index";

const DEFAULT_ROOT = path.join(process.cwd(), ".storage", "documents");

/**
 * Reduce a user-supplied filename to something safe to place on disk.
 *
 * The filename comes from an upload, so it is untrusted: it can contain path
 * separators, `..`, control characters, or be long enough to break a filesystem.
 * Only the basename survives, and only characters that cannot traverse.
 */
export function safeFilename(filename: string): string {
  // `path.basename` splits on backslashes only on Windows; on posix a backslash
  // is an ordinary character, so normalise separators before taking the base.
  const base = path.basename(filename.replace(/\\/g, "/"));
  // Anything outside letters, digits, dot, underscore and hyphen becomes an
  // underscore. One pass covers control characters, quotes, spaces and
  // separators — and keeps Cyrillic, because a Ukrainian NGO's files are named
  // in Ukrainian.
  const cleaned = base.replace(/[^\p{L}\p{N}._-]/gu, "_").replace(/^\.+/, "");
  const trimmed = cleaned.slice(0, 120);
  return trimmed.length > 0 ? trimmed : "document";
}

function assertSafeId(organizationId: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(organizationId)) {
    throw new Error(`unsafe organization id for a storage path: ${organizationId}`);
  }
}

export class LocalDocumentStore implements DocumentStore {
  constructor(private readonly root: string = DEFAULT_ROOT) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    // Belt and braces: even though keys are generated rather than supplied, a
    // resolved path that escapes the root is refused rather than written.
    const rootResolved = path.resolve(this.root);
    if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) {
      throw new Error(`storage key escapes the root: ${key}`);
    }
    return full;
  }

  async put(
    organizationId: string,
    filename: string,
    bytes: Uint8Array,
  ): Promise<StoredObject> {
    assertSafeId(organizationId);
    const key = path.posix.join(organizationId, `${randomUUID()}-${safeFilename(filename)}`);
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
    return { key, sizeBytes: bytes.byteLength };
  }

  async get(key: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.resolve(key)));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async deleteOrganization(organizationId: string): Promise<number> {
    assertSafeId(organizationId);
    const dir = this.resolve(organizationId);
    let count = 0;
    try {
      count = (await readdir(dir)).length;
    } catch {
      return 0; // nothing stored for this organization
    }
    await rm(dir, { recursive: true, force: true });
    return count;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

/** Content hash, used to detect a re-upload of the same document. */
export function contentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
