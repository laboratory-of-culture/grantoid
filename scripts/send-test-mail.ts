/**
 * Prove the SMTP relay works — and show what the weekly letter looks like.
 *
 *   npx tsx scripts/send-test-mail.ts you@example.org
 *
 * `send-digests.ts` only sends to opted-in people with a non-empty feed, so
 * during setup — no organizations yet — it never exercises the transport or the
 * layout. This builds a sample digest with the real `buildDigest` and
 * `renderDigestHtml`, so the message that lands is the same structured letter an
 * NGO would get, text and HTML both.
 *
 * Refuses on the file transport: the point is to confirm mail actually leaves.
 */

import { buildDigest } from "../packages/notifications/digest";
import type { FeedEntry } from "../packages/matching/feed";
import { renderDigestHtml } from "../packages/notifications/html";
import { mailTransport } from "../packages/notifications/mail";

const SAMPLE: Pick<
  FeedEntry,
  "titleUk" | "donorName" | "deadline" | "deadlineIsKnown" | "grantId"
>[] = [
  {
    titleUk: "Підтримка ініціатив із культурної спадщини малих міст",
    donorName: "Український культурний фонд",
    deadline: new Date(Date.now() + 18 * 86_400_000),
    deadlineIsKnown: true,
    grantId: "sample-1",
  },
  {
    titleUk: "Грантова програма для організацій громадянського суспільства",
    donorName: "House of Europe",
    deadline: new Date(Date.now() + 33 * 86_400_000),
    deadlineIsKnown: true,
    grantId: "sample-2",
  },
  {
    titleUk: "Конкурс проєктів із медіаграмотності та протидії дезінформації",
    donorName: "Європейський фонд за демократію",
    deadline: null,
    deadlineIsKnown: false,
    grantId: "sample-3",
  },
];

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

  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const digest = buildDigest(
    "ГО «Лабораторія культурних досліджень»",
    SAMPLE as FeedEntry[],
    base,
    "TESTONLY-not-a-real-unsubscribe-token",
  );

  await transport.send({
    to,
    subject: `[тест] ${digest.subject}`,
    text: `Це тестова розсилка — записи вигадані.\n\n${digest.text}`,
    html: renderDigestHtml(digest, "ГО «Лабораторія культурних досліджень»"),
    unsubscribeUrl: digest.unsubscribeUrl,
  });

  console.log(`sent via ${transport.name} to ${to} — sample digest, ${SAMPLE.length} entries`);
}

main().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
