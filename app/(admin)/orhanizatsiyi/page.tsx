import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { listOrganizations, systemSummary } from "../../../packages/db/admin";
import { formatDateUk } from "../../../packages/schemas/locale-uk";
import { requireAdmin } from "../../lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Організації — адміністрування" };

/**
 * Who is using the product, and whether it is working for them.
 *
 * Deliberately not a directory of NGOs. Every column answers an operational
 * question: is anybody stuck on an empty profile, did an upload fail, has the
 * feed produced anything worth acting on, and has this organization done
 * anything at all lately. An organization that filled its profile and got
 * nothing recommended is a matching problem; one that uploaded four documents
 * and read none of the facts is a different problem, and the two look identical
 * from a total.
 *
 * No content anywhere on this screen. See packages/db/admin.ts for where that
 * line is drawn and why.
 */
export default async function OrganizationsPage() {
  await requireAdmin();

  const [orgs, totals] = await Promise.all([listOrganizations(), systemSummary()]);

  return (
    <div className="stack">
      <div>
        <span className="kicker">Адміністрування</span>
        <h1 className="h1">Організації</h1>
      </div>

      <div className="row">
        <Stat n={totals.organizations} label="організацій" />
        <Stat n={totals.users} label="користувачів" />
        <Stat n={totals.liveGrants} label="живих конкурсів" />
        <Stat n={totals.drafts} label="чернеток" />
        {/* Two counts that mean something is wrong rather than something is
            happening, so they sit apart from the rest. */}
        {totals.quiet > 0 ? <Stat n={totals.quiet} label="без активності 2 тижні" warn /> : null}
        {totals.syntheticGrants > 0 ? (
          <Stat n={totals.syntheticGrants} label="синтетичних конкурсів" warn />
        ) : null}
      </div>

      {totals.syntheticGrants > 0 ? (
        <p className="field-error" role="alert">
          У базі є синтетичні конкурси. Перед запуском приберіть їх:{" "}
          <span className="mono">npm run purge:test -- --delete</span>
        </p>
      ) : null}

      {orgs.length === 0 ? (
        <p className="prose muted">
          Ще жодна організація не зареєструвалася. Щойно це станеться, тут з&apos;явиться
          рядок із її профілем і активністю.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Організація</th>
                <th>Профіль</th>
                <th>Документи</th>
                <th>Стрічка</th>
                <th>Чернетки</th>
                <th>Остання дія</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id}>
                  <td>
                    <Link href={`/orhanizatsiyi/${org.id}`}>{org.name}</Link>
                    <span className="kicker">
                      {[org.legalForm, org.oblast].filter(Boolean).join(" · ") || "профіль порожній"}
                    </span>
                  </td>

                  <td className="mono">
                    {org.answered}/{org.totalFields}
                    {/* Three fields decide whether a concept can be written at
                        all. Below that the writer refuses, which is the single
                        most common reason somebody says nothing works. */}
                    {org.answered < 3 ? (
                      <span className="tag tag-state-problem">замало</span>
                    ) : null}
                  </td>

                  <td className="mono">
                    {org.documents}
                    {org.documentsUnread > 0 ? (
                      <span className="tag tag-state-unknown">
                        {org.documentsUnread} не опрацьовано
                      </span>
                    ) : null}
                  </td>

                  <td className="mono">
                    {org.matches}
                    {org.matches > 0 ? (
                      <span className="kicker">рекомендовано {org.recommended}</span>
                    ) : null}
                  </td>

                  <td className="mono">
                    {org.drafts}
                    {org.drafts > 0 ? (
                      <span className="kicker">підтверджено {org.draftsConfirmed}</span>
                    ) : null}
                  </td>

                  <td className="mono">
                    {org.lastActivity ? formatDateUk(org.lastActivity) : "—"}
                  </td>

                  <td>
                    <Link href={`/orhanizatsiyi/${org.id}`} className="btn btn-ghost">
                      Детальніше
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="field-hint">
        Тут видно лише активність: скільки, коли і в якому стані. Текст заявок, вміст
        документів і значення полів профілю на цей екран не потрапляють.
      </p>
    </div>
  );
}

function Stat({ n, label, warn = false }: { n: number; label: string; warn?: boolean }) {
  return (
    <div className="stat">
      <span className={`stat-value${warn ? " stat-warn" : ""}`}>{n}</span>
      <span className="kicker">
        {warn ? <AlertTriangle size={12} aria-hidden="true" /> : null}
        {label}
      </span>
    </div>
  );
}
