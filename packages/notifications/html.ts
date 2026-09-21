/**
 * The weekly letter, laid out.
 *
 * Sent alongside the plain text, never instead of it. A `multipart/alternative`
 * message carries both and the client picks; anybody reading mail in a terminal,
 * or with images and styles off, still gets the whole letter. The text version
 * remains the one this product guarantees.
 *
 * **Email HTML is not web HTML** and the differences are not stylistic:
 *
 *   - Tables for layout. Outlook renders through Word, which has no flexbox and
 *     no grid, and a `<div>` column layout collapses into a single stack there.
 *   - Every style inline. There is no external stylesheet, and Gmail strips
 *     `<style>` blocks in some contexts — including, reliably, the mobile apps.
 *   - No remote assets at all. No images, no font files, no tracking pixel.
 *     Most clients block remote content by default, so a design that needs it
 *     arrives broken; and a pixel is exactly the thing `digest.ts` promises this
 *     product does not send.
 *   - Web-safe fonts only. Inter is self-hosted for the app and cannot be
 *     loaded here, so the stack falls to the grotesques these systems ship.
 *
 * The Modernist rules that survive the medium are kept: zero radius, rules
 * rather than boxes, flush left, mono for identifiers. The colour tokens are
 * repeated as literals because a stylesheet variable cannot cross into a
 * message body.
 */

import type { Digest, ProfileNudge } from "./digest";

/** From packages/ui/tokens.css. Literal here because email has no variables. */
const INK = "#201e1d";
const GROUND = "#f3f2f2";
const SURFACE = "#ffffff";
const MUTED = "#6a6563";
const RULE = "#d2cfce";
const ACCENT = "#ec3013";

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "ui-monospace,'Cascadia Mono',Consolas,'DejaVu Sans Mono',monospace";

/** `&` first, or it double-escapes everything that follows. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function entryRow(entry: Digest["entries"][number], index: number): string {
  const ordinal = String(index + 1).padStart(2, "0");
  const deadlineColor = entry.deadlineSoon ? ACCENT : MUTED;
  const deadlineWeight = entry.deadlineSoon ? "700" : "400";

  return `
    <tr>
      <td style="padding:18px 0;border-top:2px solid ${RULE};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="top" width="34"
                style="font-family:${MONO};font-size:12px;line-height:1.4;color:${MUTED};
                       padding-top:2px;">
              ${ordinal}
            </td>
            <td valign="top">
              <a href="${esc(entry.url)}"
                 style="display:block;margin:0 0 6px;font-family:${SANS};font-size:16px;
                        font-weight:700;line-height:1.35;color:${INK};text-decoration:none;">
                ${esc(entry.titleUk)}
              </a>
              <div style="font-family:${MONO};font-size:11px;letter-spacing:0.08em;
                          text-transform:uppercase;color:${MUTED};margin:0 0 3px;">
                ${esc(entry.donorName)}
              </div>
              <div style="font-family:${SANS};font-size:13px;line-height:1.4;
                          color:${deadlineColor};font-weight:${deadlineWeight};">
                ${esc(entry.deadlineLine)}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * Build the HTML body for one digest.
 *
 * Takes the digest rather than the entries so the subject line, the entries and
 * the unsubscribe URL cannot drift apart — the text and the HTML have to be the
 * same letter, and the one thing a reader will notice if they are not is an
 * unsubscribe link that goes somewhere else.
 */
export function renderDigestHtml(digest: Digest, organizationName: string): string {
  const rows = digest.entries.map((entry, i) => entryRow(entry, i)).join("");
  // The unsubscribe URL is the only absolute origin the digest carries, so the
  // feed link is derived from it rather than passed separately — one source
  // means the two cannot point at different installations.
  const origin = digest.unsubscribeUrl.split("/vidpyska")[0] ?? "";

  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(digest.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${GROUND};">
  <!-- Shown in the inbox list beside the subject, then hidden. Without it the
       client previews whatever text comes first, which is the salutation. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${esc(digest.entries.map((e) => e.titleUk).join(" · "))}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${GROUND};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background:${SURFACE};border:2px solid ${INK};">
          <tr>
            <td style="padding:24px 24px 0;">
              <!-- The mark, in the one form email can carry it. No span with a
                   different colour: Outlook drops nested inline styles often
                   enough that the joke would land half the time. -->
              <div style="font-family:${MONO};font-size:12px;letter-spacing:0.1em;
                          text-transform:uppercase;color:${MUTED};">
                грантоЇД.АІ
              </div>
              <h1 style="margin:8px 0 4px;font-family:${SANS};font-size:22px;
                         font-weight:800;line-height:1.2;color:${INK};">
                ${esc(digest.subject)}
              </h1>
              <div style="font-family:${SANS};font-size:14px;color:${MUTED};">
                ${esc(organizationName)}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rows}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 24px 0;border-top:2px solid ${INK};">
              <p style="margin:0 0 12px;font-family:${SANS};font-size:14px;
                        line-height:1.5;color:${INK};">
                Чому саме ці — з розбором за критеріями та цитатами — у застосунку.
              </p>
              <!-- A bordered link, not a button image: an image is blocked by
                   default and a CSS-drawn button survives every client. -->
              <a href="${esc(origin)}/mozhlyvosti"
                 style="display:inline-block;padding:12px 18px;border:2px solid ${INK};
                        font-family:${SANS};font-size:14px;font-weight:700;
                        color:${INK};text-decoration:none;">
                Відкрити стрічку
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 24px 24px;">
              <p style="margin:0 0 10px;font-family:${SANS};font-size:12px;
                        line-height:1.5;color:${MUTED};">
                Цей лист не містить оцінки прийнятності, даних вашого профілю чи тексту
                заявок — вони не залишають нашої інфраструктури. У листі лише публічні
                дані про конкурси.
              </p>
              <p style="margin:0 0 10px;font-family:${SANS};font-size:12px;
                        line-height:1.5;color:${ACCENT};">
                Система в режимі дослідної експлуатації: добір ще не перевірено на живих
                даних.
              </p>
              <p style="margin:0;font-family:${SANS};font-size:12px;color:${MUTED};">
                <a href="${esc(digest.unsubscribeUrl)}" style="color:${MUTED};">Відписатися</a>
                — без входу в систему.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * The nudge, in the same envelope as the digest.
 *
 * Deliberately the same shell — mark, black-bordered card, one CSS-drawn button
 * — so an organisation that gets a nudge one week and a digest the next reads
 * them as the same sender, not two products. The body is the list of questions
 * that unblock matching, and the button goes to the profile rather than the
 * feed.
 */
export function renderNudgeHtml(nudge: ProfileNudge): string {
  const origin = nudge.unsubscribeUrl.split("/vidpyska")[0] ?? "";
  const questions = nudge.missing
    .map(
      (m) => `
      <tr>
        <td style="padding:8px 0;border-top:1px solid ${RULE};font-family:${SANS};
                   font-size:15px;line-height:1.4;color:${INK};">
          ${esc(m.questionUk)}
        </td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(nudge.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${GROUND};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${esc(nudge.missing.map((m) => m.labelUk).join(" · "))}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${GROUND};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background:${SURFACE};border:2px solid ${INK};">
          <tr>
            <td style="padding:24px 24px 0;">
              <div style="font-family:${MONO};font-size:12px;letter-spacing:0.1em;
                          text-transform:uppercase;color:${MUTED};">
                грантоЇД.АІ
              </div>
              <h1 style="margin:8px 0 4px;font-family:${SANS};font-size:22px;
                         font-weight:800;line-height:1.2;color:${INK};">
                Заповніть профіль, щоб отримувати гранти
              </h1>
              <div style="font-family:${SANS};font-size:14px;color:${MUTED};">
                ${esc(nudge.organizationName)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 0;">
              <p style="margin:0 0 12px;font-family:${SANS};font-size:14px;
                        line-height:1.5;color:${INK};">
                Добір спирається на профіль вашої організації. Поки не заповнено кілька
                ключових фактів, більшість конкурсів лишаються «невизначеними» — ми не
                можемо сказати, підходять вони чи ні. Дайте відповідь на ці питання, і
                добір почне працювати саме для вас:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${questions}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 0;">
              <a href="${esc(origin)}/profil"
                 style="display:inline-block;padding:12px 18px;border:2px solid ${INK};
                        font-family:${SANS};font-size:14px;font-weight:700;
                        color:${INK};text-decoration:none;">
                Заповнити профіль
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 24px;">
              <p style="margin:0 0 10px;font-family:${SANS};font-size:12px;
                        line-height:1.5;color:${MUTED};">
                Це не оцінка й не витік даних — профіль не залишає нашої інфраструктури.
              </p>
              <p style="margin:0;font-family:${SANS};font-size:12px;color:${MUTED};">
                <a href="${esc(nudge.unsubscribeUrl)}" style="color:${MUTED};">Відписатися</a>
                — без входу в систему.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
