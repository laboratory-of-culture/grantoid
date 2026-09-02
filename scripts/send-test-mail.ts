/**
 * Prove the SMTP relay works, before a real digest depends on it.
 *
 *   npx tsx scripts/send-test-mail.ts you@example.org
 *
 * `send-digests.ts` only sends to opted-in people with a non-empty feed, so
 * during setup — no organizations yet — it never exercises the transport. This
 * builds one message with the same `mailTransport()` the digest uses and sends
 * it to the address you name.
 *
 * Refuses to run on the file transport: the whole point is to confirm mail
 * actually leaves. If SMTP_* is unset it would "succeed" by writing to .mail/
 * and tell you nothing.
 */

import { mailTransport } from "../packages/notifications/mail";

async function main(): Promise<void> {
  const to = process.argv[2];
  if (!to || !to.includes("@")) {
    throw new Error("give a recipient: npx tsx scripts/send-test-mail.ts you@example.org");
  }

  const transport = mailTransport();
  if (transport.name === "file") {
    throw new Error(
      "SMTP is not configured — transport is the file writer. Set SMTP_HOST, " +
        "SMTP_USER, SMTP_PASSWORD and MAIL_FROM, then retry.",
    );
  }

  const stamp = new Date().toISOString();
  await transport.send({
    to,
    subject: `грантоЇД.АІ — перевірка пошти ${stamp}`,
    text:
      "Це тестовий лист від грантоЇД.АІ.\n\n" +
      `Транспорт: ${transport.name}\n` +
      `Час: ${stamp}\n` +
      `APP_BASE_URL: ${process.env.APP_BASE_URL ?? "(не задано)"}\n\n` +
      "Якщо ви його бачите — SMTP-релей працює. Відписатися нема від чого, " +
      "це разова перевірка.\n",
    // A real List-Unsubscribe target, so the header is well-formed and the test
    // also exercises the unsubscribe route.
    unsubscribeUrl: `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/vidpyska`,
  });

  console.log(`sent via ${transport.name} to ${to}`);
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
