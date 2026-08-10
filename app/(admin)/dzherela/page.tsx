import { CircleAlert, CircleCheck, ExternalLink, Rss, List } from "lucide-react";

import { prisma } from "../../../packages/db/tenancy";
import { requireAdmin } from "../../lib/session";
import { SourceControls } from "./controls";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  NEW: "Не розібрано",
  GRANT: "Грант",
  NOT_GRANT: "Не грант",
  EXTRACTED: "Оброблено",
  FAILED: "Помилка",
};

export default async function SourcesPage() {
  await requireAdmin();

  const sources = await prisma.source.findMany({ orderBy: { name: "asc" } });
  const counts = await prisma.sourceItem.groupBy({
    by: ["sourceId", "status"],
    _count: { _all: true },
  });
  const recent = await prisma.sourceItem.findMany({
    orderBy: [{ discoveredAt: "desc" }],
    take: 24,
    include: { source: { select: { name: true } } },
  });

  const countFor = (sourceId: string, status: string) =>
    counts.find((c) => c.sourceId === sourceId && c.status === status)?._count._all ?? 0;

  return (
    <div className="stack">
      <section className="section">
        <span className="kicker">Реєстр джерел</span>
        <h1 className="h1">Джерела грантів</h1>
        <p className="prose muted">
          Гранти надходять лише звідси. Джерело не можна увімкнути, доки не
          перевірено robots.txt і не зафіксовано перегляд умов використання — це
          вимога бази даних, а не домовленість.
        </p>
      </section>

      {sources.map((source) => {
        const reviewed = source.robotsCheckedAt !== null && source.tosReviewedAt !== null;
        return (
          <section className="section" key={source.id}>
            <div className="section-head">
              <div>
                <span className="kicker">
                  {source.discovery === "RSS" ? "RSS-стрічка" : "Список на сторінці"}
                </span>
                <h2 className="h3">{source.name}</h2>
              </div>
              <span className={source.enabled ? "tag tag-neutral" : "tag tag-state-unknown"}>
                {source.enabled ? "Увімкнено" : "Вимкнено"}
              </span>
            </div>

            <div className="row">
              {source.discovery === "RSS" ? (
                <Rss size={14} aria-hidden="true" />
              ) : (
                <List size={14} aria-hidden="true" />
              )}
              <a href={source.discoveryUrl ?? source.homepageUrl} className="mono">
                {source.discoveryUrl ?? source.homepageUrl}
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>

            {/* The two checks that decide whether we may fetch at all. */}
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  <tr>
                    <th scope="row">robots.txt</th>
                    <td>
                      {source.robotsCheckedAt === null ? (
                        <span className="tag tag-state-unknown">Не перевірено</span>
                      ) : source.robotsAllows ? (
                        <span className="row">
                          <CircleCheck size={14} aria-hidden="true" /> Дозволено
                        </span>
                      ) : (
                        <span className="row">
                          <CircleAlert size={14} aria-hidden="true" /> Заборонено
                        </span>
                      )}
                    </td>
                    <td className="mono">
                      {source.robotsCheckedAt?.toLocaleDateString("uk-UA") ?? "—"}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Умови використання</th>
                    <td>{source.tosNote ?? "Не переглянуто"}</td>
                    <td className="mono">
                      {source.tosReviewedAt?.toLocaleDateString("uk-UA") ?? "—"}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Частота й ліміт</th>
                    <td>
                      кожні {source.crawlCadenceHours} год, не більше{" "}
                      {source.rateLimitPerMin} запитів на хвилину
                    </td>
                    <td className="mono">
                      {source.lastCrawledAt
                        ? source.lastCrawledAt.toLocaleString("uk-UA")
                        : "ще не перевірялося"}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Знайдено</th>
                    <td>
                      <span className="row">
                        <span className="tag tag-state-unknown">
                          {countFor(source.id, "NEW")} не розібрано
                        </span>
                        <span className="tag tag-neutral">
                          {countFor(source.id, "GRANT")} грантів
                        </span>
                        <span className="tag tag-outline">
                          {countFor(source.id, "NOT_GRANT")} не гранти
                        </span>
                      </span>
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>

            {source.lastError ? (
              <p className="field-error" role="alert">
                Остання перевірка: {source.lastError}
              </p>
            ) : null}

            <SourceControls id={source.id} enabled={source.enabled} reviewed={reviewed} />
          </section>
        );
      })}

      <section className="section">
        <div className="section-head">
          <h2 className="h3">Останні знахідки</h2>
          <span className="kicker">{recent.length}</span>
        </div>
        <p className="prose muted">
          Джерела публікують можливості загалом — гранти, тендери, закупівлі й
          навчання в одному потоці. Кожну позицію ще треба класифікувати, і саме
          на цьому кроці виграється або втрачається точність стрічки.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Заголовок</th>
                <th scope="col">Джерело</th>
                <th scope="col">Стан</th>
                <th scope="col">Опубліковано</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((item) => (
                <tr key={item.id}>
                  <td>
                    <a href={item.url}>{item.title}</a>
                  </td>
                  <td>{item.source.name}</td>
                  <td>
                    <span
                      className={
                        item.status === "GRANT"
                          ? "tag tag-neutral"
                          : item.status === "NOT_GRANT"
                            ? "tag tag-outline"
                            : "tag tag-state-unknown"
                      }
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </td>
                  <td className="mono">
                    {item.publishedAt?.toLocaleDateString("uk-UA") ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
