/**
 * What the file transport actually writes.
 *
 * This exists because a commit claimed the transport wrote the laid-out letter
 * beside the text and it did not: the edit that was supposed to add it silently
 * matched nothing, the diff was never run, and the claim went into a commit
 * message and a summary. The default transport dropped the HTML entirely.
 *
 * The file transport is the one every installation gets until SMTP is
 * configured, so it is the one that decides whether anybody can look at the
 * letter at all during trial operation.
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileTransport } from "./mail";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "mail-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const base = {
  to: "demo@example.org",
  subject: "1 нова можливість",
  text: "текстова версія листа",
  unsubscribeUrl: "http://localhost:3000/vidpyska?t=demo",
};

describe("FileTransport", () => {
  it("writes both parts when the message has a laid-out version", async () => {
    await new FileTransport(dir).send({ ...base, html: "<html>зверстано</html>" });

    const files = readdirSync(dir);
    expect(files.filter((f) => f.endsWith(".txt"))).toHaveLength(1);
    expect(files.filter((f) => f.endsWith(".html"))).toHaveLength(1);
  });

  it("puts the message in the text file, headers and all", async () => {
    await new FileTransport(dir).send({ ...base, html: "<html>зверстано</html>" });

    const txt = readdirSync(dir).find((f) => f.endsWith(".txt"))!;
    const body = readFileSync(path.join(dir, txt), "utf8");
    expect(body).toContain("To: demo@example.org");
    // The header a client turns into its own unsubscribe button. Its absence is
    // the difference between someone leaving the list and someone pressing spam.
    expect(body).toContain("List-Unsubscribe: <http://localhost:3000/vidpyska?t=demo>");
    expect(body).toContain("текстова версія листа");
  });

  it("writes the HTML verbatim, so it can be opened in a browser", async () => {
    const html = "<html lang='uk'><body>зверстана версія</body></html>";
    await new FileTransport(dir).send({ ...base, html });

    const file = readdirSync(dir).find((f) => f.endsWith(".html"))!;
    expect(readFileSync(path.join(dir, file), "utf8")).toBe(html);
  });

  it("leaves no stray file for a message that has no laid-out version", async () => {
    await new FileTransport(dir).send(base);

    expect(readdirSync(dir).filter((f) => f.endsWith(".html"))).toHaveLength(0);
    expect(readdirSync(dir).filter((f) => f.endsWith(".txt"))).toHaveLength(1);
  });

  it("keeps one mailbox's letters from overwriting another's", async () => {
    const transport = new FileTransport(dir);
    await transport.send(base);
    await transport.send({ ...base, to: "other@example.org" });

    expect(readdirSync(dir)).toHaveLength(2);
  });
});
