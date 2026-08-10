/**
 * Password hashing with Node's built-in scrypt.
 *
 * No dependency, and scrypt is on OWASP's list of acceptable password KDFs. The
 * cost parameters are stored in the hash string, so raising them later does not
 * invalidate existing passwords — an old hash still verifies against its own
 * parameters, and can be re-hashed on the next successful sign-in.
 *
 * Format: `scrypt$N$r$p$saltBase64$hashBase64`
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./constants";

export { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH };

/**
 * `promisify` resolves to the three-argument overload and drops the one that
 * takes options, so the cost parameters would be silently ignored at the type
 * level while working fine at runtime — exactly the sort of thing tests pass
 * through and `tsc` catches.
 */
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * OWASP's minimum for scrypt is N=2^17, r=8, p=1. That is roughly 128 MB of
 * memory per hash, which is the point — it is what makes a stolen table
 * expensive to attack, and it is affordable at sign-in rates.
 */
const N = 1 << 17;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

/** scrypt's memory use is roughly 128 * N * r bytes; Node caps it below that. */
const MAX_MEMORY = 256 * 1024 * 1024;

export class WeakPassword extends Error {}

export function assertPasswordAcceptable(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new WeakPassword(
      `Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів. ` +
        "Довга фраза надійніша за короткий набір символів.",
    );
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new WeakPassword(`Пароль задовгий — до ${MAX_PASSWORD_LENGTH} символів.`);
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordAcceptable(password);
  const salt = randomBytes(SALT_LEN);
  const derived = await scryptAsync(password, salt, KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEMORY,
  });

  return ["scrypt", N, R, P, salt.toString("base64"), derived.toString("base64")].join("$");
}

/**
 * Verify a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed hash: a corrupted row
 * should fail the sign-in, not crash the request and leak which account it was.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4] ?? "", "base64");
  const expected = Buffer.from(parts[5] ?? "", "base64");

  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = await scryptAsync(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: MAX_MEMORY,
    });
  } catch {
    return false;
  }

  // Constant time: a length-varying or early-exit comparison here is a timing
  // oracle for the hash.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** True when a hash was made with weaker parameters than we now use. */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return Number(parts[1]) < N || Number(parts[2]) < R || Number(parts[3]) < P;
}
