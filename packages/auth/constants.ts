/**
 * Values shared between the server and the browser.
 *
 * Separate from `password.ts` because that module imports `node:crypto`, and a
 * client component importing a single constant from it drags the whole Node
 * crypto surface into the browser bundle — which fails the build rather than
 * failing quietly, but only at build time. `tsc` is happy with it.
 */

/**
 * Length is the only password rule. Composition requirements (a digit, a
 * symbol, a capital) push people toward `Password1!` and are worse than a
 * longer passphrase.
 */
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 512;
