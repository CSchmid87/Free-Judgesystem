import crypto from 'crypto';
import { loadEvent } from './store';
import type { JudgeRole } from './types';
import { JUDGE_ROLES } from './types';

/**
 * Generate a cryptographically strong random key (URL-safe base64, 32 bytes).
 */
export function generateKey(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Validate the admin key from a request's query parameter or header.
 * Returns true if the key matches the stored event's admin key.
 */
export function validateAdminKey(key: string | null): boolean {
  if (!key) return false;
  const event = loadEvent();
  if (!event) return false;
  return timingSafeEqual(key, event.adminKey);
}

/**
 * Validate a judge key. Returns the matching role or null.
 */
export function validateJudgeKey(key: string | null): JudgeRole | null {
  if (!key) return null;
  const event = loadEvent();
  if (!event) return null;
  for (const role of JUDGE_ROLES) {
    if (timingSafeEqual(key, event.judgeKeys[role])) {
      return role;
    }
  }
  return null;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}
