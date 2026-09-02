import { describe, expect, it } from "vitest";

import { resolveMimeType } from "./documents";

const bytes = (...b: number[]) => new Uint8Array(b);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34); // %PDF-1.4
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0); // PK.. (docx)
const OLE = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1); // legacy .doc
const TEXT = new TextEncoder().encode("СТАТУТ громадської організації");

describe("resolveMimeType", () => {
  it("trusts a reported type we already accept", () => {
    expect(resolveMimeType("statut.pdf", "application/pdf", PDF)).toBe("application/pdf");
    expect(resolveMimeType("s.txt", "text/plain", TEXT)).toBe("text/plain");
  });

  it("falls back to the extension when the browser reports nothing", () => {
    // The bug: Chrome/Safari send "" or octet-stream for .doc and often .docx.
    expect(resolveMimeType("Статут.pdf", "", PDF)).toBe("application/pdf");
    expect(resolveMimeType("Статут.docx", "application/octet-stream", ZIP)).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(resolveMimeType("статут.doc", "", OLE)).toBe("application/msword");
    expect(resolveMimeType("нотатки.txt", "application/octet-stream", TEXT)).toBe("text/plain");
  });

  it("is case-insensitive about the extension", () => {
    expect(resolveMimeType("STATUT.PDF", "", PDF)).toBe("application/pdf");
  });

  it("sniffs the leading bytes only when the filename has no extension", () => {
    expect(resolveMimeType("scan", "", PDF)).toBe("application/pdf");
    expect(resolveMimeType("document", "application/octet-stream", OLE)).toBe("application/msword");
    expect(resolveMimeType("noname", "", bytes(1, 2, 3, 4))).toBeNull();
  });

  it("rejects an extension we do not take, even if the bytes look like one we do", () => {
    // A .zip whose contents sniff as a docx is still a .zip.
    expect(resolveMimeType("archive.zip", "application/zip", ZIP)).toBeNull();
    expect(resolveMimeType("photo.png", "image/png", bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    expect(resolveMimeType("keynote.pages", "", ZIP)).toBeNull();
  });

  it("does not let a wrong extension override a type we accept", () => {
    // Reported type wins when it is one of ours — a .pdf named .txt still works.
    expect(resolveMimeType("statut.txt", "application/pdf", PDF)).toBe("application/pdf");
  });
});
