/**
 * Cryptographically random temporary passwords.
 *
 * `crypto.randomInt` is used rather than `Math.random` or a modulo over
 * `randomBytes`: it is CSPRNG-backed and rejection-samples, so the alphabet
 * stays uniform. The alphabet omits characters that are easy to confuse when a
 * password is read off a screen or an email (0/O, 1/l/I) — these get typed by
 * hand exactly once, and a misread costs a support round trip.
 *
 * Server only. `node:crypto` has no place in a browser bundle.
 */

import 'server-only';

import { randomInt } from 'node:crypto';

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGIT = '23456789';
const SYMBOL = '!@#$%*?';
const ALL = LOWER + UPPER + DIGIT + SYMBOL;

function pick(alphabet: string): string {
  return alphabet[randomInt(0, alphabet.length)];
}

/**
 * @param length total characters; 16 gives ~95 bits over this alphabet.
 */
export function generateTempPassword(length = 16): string {
  // One of each class up front guarantees the result satisfies any reasonable
  // password policy, including Supabase's configurable complexity setting.
  const required = [pick(LOWER), pick(UPPER), pick(DIGIT), pick(SYMBOL)];
  const rest = Array.from({ length: Math.max(0, length - required.length) }, () => pick(ALL));
  const chars = [...required, ...rest];

  // Fisher–Yates with a CSPRNG, so the guaranteed characters are not pinned to
  // the first four positions.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** A short, human-readable invitation code, matching the demo adapter's shape. */
export function generateInviteCode(length = 8): string {
  const alphabet = UPPER + DIGIT;
  return Array.from({ length }, () => pick(alphabet)).join('');
}
