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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BREVO_API_URL, BrevoApiTransport, FileTransport, parseFrom } from "./mail";

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

describe("parseFrom", () => {
  it("splits a display-name address", () => {
    expect(parseFrom("грантоЇД.АІ <digest@grantoid.in.ua>")).toEqual({
      name: "грантоЇД.АІ",
      email: "digest@grantoid.in.ua",
    });
  });

  it("returns a bare address with no name", () => {
    expect(parseFrom("digest@grantoid.in.ua")).toEqual({ email: "digest@grantoid.in.ua" });
    expect(parseFrom("  <digest@grantoid.in.ua>  ")).toEqual({ email: "digest@grantoid.in.ua" });
  });
});

describe("BrevoApiTransport", () => {
  const message = {
    to: "ngo@example.org",
    subject: "Дайджест",
    text: "плаский текст",
    html: "<p>верстка</p>",
    unsubscribeUrl: "https://grantoid.in.ua/vidpyska/abc",
  };

  it("posts the message to Brevo with the key and one-click unsubscribe", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchMock = async (url: string | URL, init?: RequestInit) => {
      captured = { url: String(url), init: init! };
      return new Response(JSON.stringify({ messageId: "<1@brevo>" }), { status: 201 });
    };
    vi.stubGlobal("fetch", fetchMock);

    const t = new BrevoApiTransport("xkeysib-secret", "грантоЇД.АІ <digest@grantoid.in.ua>");
    await t.send(message);

    expect(captured!.url).toBe(BREVO_API_URL);
    expect((captured!.init.headers as Record<string, string>)["api-key"]).toBe("xkeysib-secret");
    const body = JSON.parse(captured!.init.body as string);
    expect(body.sender).toEqual({ name: "грантоЇД.АІ", email: "digest@grantoid.in.ua" });
    expect(body.to).toEqual([{ email: "ngo@example.org" }]);
    expect(body.textContent).toBe("плаский текст");
    expect(body.htmlContent).toBe("<p>верстка</p>");
    expect(body.headers["List-Unsubscribe"]).toBe("<https://grantoid.in.ua/vidpyska/abc>");
    expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    vi.unstubAllGlobals();
  });

  it("throws Brevo's own error text on a rejected send", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ code: "unauthorized", message: "IP not allowed" }), {
        status: 401,
      }),
    );
    const t = new BrevoApiTransport("xkeysib-secret", "digest@grantoid.in.ua");
    await expect(t.send(message)).rejects.toThrow(/brevo api 401/);
    vi.unstubAllGlobals();
  });
});
