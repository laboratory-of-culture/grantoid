/**
 * Getting a message out.
 *
 * Two transports. SMTP when the environment configures one, and a file
 * transport otherwise, which writes the message to `.mail/` instead of sending
 * it. The file transport is the default on purpose: a half-configured install
 * that silently mails real NGOs is worse than one that visibly does not mail
 * anyone, and during trial operation the message is usually being read by whoever
 * wrote it rather than by a recipient.
 *
 * No hosted mail API and no tracking pixels. The only thing that leaves is the
 * message itself, to the relay the operator configured — see `digest.ts` for
 * what the message is allowed to contain.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import nodemailer from "nodemailer";

export type Message = {
  to: string;
  subject: string;
  text: string;
  /**
   * The laid-out version, sent alongside the text and never instead of it.
   *
   * `multipart/alternative`: the client picks, and anybody reading in a
   * terminal or with styles off still gets the whole letter. Optional because
   * the text version is the one this product guarantees — a transport that
   * cannot send HTML loses formatting, not content.
   */
  html?: string;
  /**
   * The one-click unsubscribe address, sent as a header as well as in the body.
   *
   * RFC 8058: mail clients surface a header unsubscribe as a native button, and
   * the person who would otherwise press "spam" presses that instead. Required
   * rather than optional — a bulk message without it is one nobody can leave
   * without hunting through the text.
   */
  unsubscribeUrl: string;
};

export interface MailTransport {
  send(message: Message): Promise<void>;
  /** Named in the operator's log so a missing email is diagnosable. */
  readonly name: string;
}

export const MAIL_DIR = path.join(process.cwd(), ".mail");

/** Writes messages to disk. What you get until SMTP is configured. */
export class FileTransport implements MailTransport {
  readonly name = "file";

  constructor(private readonly dir: string = MAIL_DIR) {}

  async send(message: Message): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safe = message.to.replace(/[^\w.@-]/g, "_");
    await writeFile(
      path.join(this.dir, `${stamp}-${safe}.txt`),
      [
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        `List-Unsubscribe: <${message.unsubscribeUrl}>`,
        "",
        message.text,
      ].join("\n"),
      "utf8",
    );

    // The laid-out version beside it, as a file a browser opens.
    //
    // Not optional politeness: this is the default transport, so without it the
    // only version anybody can actually look at during trial operation is the
    // plain text — and reading HTML markup in a terminal tells you nothing
    // about whether the letter looks right.
    if (message.html) {
      await writeFile(path.join(this.dir, `${stamp}-${safe}.html`), message.html, "utf8");
    }
  }
}

export class SmtpTransport implements MailTransport {
  readonly name = "smtp";

  constructor(
    private readonly transporter: nodemailer.Transporter,
    private readonly from: string,
  ) {}

  async send(message: Message): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      headers: {
        "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
        // Without this a client must assume the link needs a confirmation page.
        // With it, one press ends the subscription, which is the whole point.
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  }
}

/**
 * The transport this installation has.
 *
 * Requires every SMTP setting before using SMTP. A partial configuration falls
 * back to the file transport rather than guessing a port or a security mode —
 * guessing wrong means either failing to send or sending unencrypted, and the
 * second one is silent.
 */
export function mailTransport(): MailTransport {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.MAIL_FROM;

  if (!host || !user || !pass || !from) return new FileTransport();

  const port = Number(process.env.SMTP_PORT ?? 587);
  return new SmtpTransport(
    nodemailer.createTransport({
      host,
      port,
      // 465 is implicit TLS; everything else upgrades with STARTTLS and is
      // required to, so a relay that does not offer it fails loudly.
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user, pass },
    }),
    from,
  );
}
