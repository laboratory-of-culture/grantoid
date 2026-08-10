/**
 * Write static snapshots of signed-in pages into public/_preview/ so they can be
 * looked at in a browser without a session.
 *
 *   npx tsx scripts/snapshot-pages.ts
 *   npx tsx scripts/snapshot-pages.ts --clean
 *
 * Scripts are stripped, so the result is markup and stylesheets only: no
 * hydration, no server actions, nothing that could act on the database from a
 * page served outside the auth boundary. It is a photograph, not the product.
 *
 * The files are deleted by --clean and are gitignored. Do not run this against
 * an installation holding a real organization's data — the whole point is that
 * the output is readable without signing in.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { createSession, SESSION_COOKIE } from "../packages/auth/session";
import { prisma } from "../packages/db/tenancy";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "public", "_preview");

const PAGES = [
  { file: "profil.html", path: "/profil", email: "laboratoryofculture@gmail.com" },
  { file: "dzherela.html", path: "/dzherela", email: "admin@grant-assistant.local" },
  { file: "vhid.html", path: "/vhid", email: null },
];

/** Everything executable goes. What remains is markup and stylesheet links. */
function freeze(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<script[^>]*\/>/gi, "")
    .replace(/ on[a-z]+="[^"]*"/gi, "");
}

async function main(): Promise<void> {
  if (process.argv.includes("--clean")) {
    await rm(OUT, { recursive: true, force: true });
    console.log("removed public/_preview");
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("snapshot-pages writes signed-in pages to a public path — not in production");
  }

  await mkdir(OUT, { recursive: true });

  for (const page of PAGES) {
    const headers: Record<string, string> = {};

    if (page.email) {
      const user = await prisma.user.findUnique({ where: { email: page.email } });
      if (!user) throw new Error(`no such user: ${page.email}`);
      const { token } = await createSession(user.id);
      headers.cookie = `${SESSION_COOKIE}=${token}`;
    }

    const res = await fetch(`${BASE}${page.path}`, { headers, redirect: "manual" });
    if (res.status !== 200) {
      console.log(`skip ${page.path} → ${res.status} ${res.headers.get("location") ?? ""}`);
      continue;
    }

    await writeFile(path.join(OUT, page.file), freeze(await res.text()), "utf8");
    console.log(`${BASE}/_preview/${page.file}   ← ${page.path}`);
  }

  console.log("\nremove with: npx tsx scripts/snapshot-pages.ts --clean\n");
}

main()
  .catch((err) => {
    console.error(String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
