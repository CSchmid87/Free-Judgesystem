/**
 * Judge roles supported by the system.
 */
export const JUDGE_ROLES = ['J1', 'J2', 'J3'] as const;
export type JudgeRole = (typeof JUDGE_ROLES)[number];

/**
 * An athlete registered in a category.
 */
export interface Athlete {
  bib: number;  // unique within category
  name: string;
}

/**
 * Type guard for Athlete.
 */
export function isAthlete(value: unknown): value is Athlete {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.bib === 'number' && Number.isInteger(obj.bib) && obj.bib > 0 &&
    typeof obj.name === 'string' && !!obj.name
  );
}

/**
 * A scoring category within an event (e.g. "Technik", "Choreografie").
 */
export interface Category {
  id: string;
  name: string;
  weight: number; // 0-100, weights across categories should sum to 100
  athletes: Athlete[];
}

/**
 * Type guard for Category.
 */
export function isCategory(value: unknown): value is Category {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' || !obj.id ||
    typeof obj.name !== 'string' || !obj.name ||
    typeof obj.weight !== 'number' || obj.weight < 0 || obj.weight > 100
  ) return false;
  // Athletes: default to empty array if missing (backward compat)
  if ('athletes' in obj) {
    if (!Array.isArray(obj.athletes)) return false;
    if (!obj.athletes.every(isAthlete)) return false;
  }
  return true;
}

/**
 * EventData represents a persistent event record.
 *
 * @property id         - Unique identifier (non-empty string)
 * @property name       - Event name (non-empty string)
 * @property createdAt  - ISO 8601 timestamp of creation
 * @property adminKey   - Cryptographic secret for admin access
 * @property judgeKeys  - Map of judge role → secret key
 * @property categories - Scoring categories for the event
 */
export interface EventData {
  id: string;
  name: string;
  createdAt: string;
  adminKey: string;
  judgeKeys: Record<JudgeRole, string>;
  categories: Category[];
}

/**
 * Type guard for EventData.
 * Use to safely narrow unknown types at runtime.
 */
export function isEventData(value: unknown): value is EventData {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;

  if (
    typeof obj.id !== 'string' || !obj.id ||
    typeof obj.name !== 'string' || !obj.name ||
    typeof obj.createdAt !== 'string' || !obj.createdAt ||
    typeof obj.adminKey !== 'string' || !obj.adminKey
  ) return false;

  // Validate judgeKeys
  if (!obj.judgeKeys || typeof obj.judgeKeys !== 'object') return false;
  const jk = obj.judgeKeys as Record<string, unknown>;
  if (!JUDGE_ROLES.every((role) => typeof jk[role] === 'string' && !!jk[role])) {
    return false;
  }

  // Categories: default to empty array if missing (backward compat)
  if ('categories' in obj) {
    if (!Array.isArray(obj.categories)) return false;
    if (!obj.categories.every(isCategory)) return false;
  }

  return true;
}
