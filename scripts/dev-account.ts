/**
 * Which account the development scripts act as by default.
 *
 * Read from the environment, not written here, for two reasons.
 *
 * This repository is public. A working address repeated across a dozen source
 * files is harvested within hours of the first push, and the address in
 * question belongs to a real NGO rather than to us.
 *
 * And `purge-test-data.ts` deletes the accounts it recognises as seeded. While
 * the demo account shared an address with an organization that is also a beta
 * user, `npm run purge:test -- --delete` on a live server would have removed
 * that organization's real profile, documents and drafts, and the script had
 * no way to tell the two apart. The default below is on a reserved domain
 * (RFC 2606), so the reserved-domain rule catches it on its own.
 *
 * Point DEV_ORG_EMAIL at whatever `seed:demo` created on your machine.
 */
import path from "node:path";

/**
 * Nothing else in this repository loads `.env`.
 *
 * It arrives as a side effect of importing Prisma's client, which happens
 * later than this module in most of the scripts — so reading `process.env`
 * here without this call returned the default while the variable was sitting
 * in `.env` unread. The first version of this file had exactly that bug, and
 * it was invisible: the scripts still ran, just as the wrong account.
 *
 * `loadEnvFile` leaves variables that are already set alone, so an address
 * given on the command line still wins.
 */
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // No .env, or Node older than 20.12. The default below is then the answer.
}

export const DEV_ORG_EMAIL = process.env.DEV_ORG_EMAIL ?? "demo@example.org";
