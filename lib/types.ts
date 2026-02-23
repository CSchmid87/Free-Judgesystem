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
    typeof obj.name !== 'string' || !obj.name
  ) return false;
  // Athletes: default to empty array if missing (backward compat)
  if ('athletes' in obj) {
    if (!Array.isArray(obj.athletes)) return false;
    if (!obj.athletes.every(isAthlete)) return false;
  }
  return true;
}

/**
 * A score submitted by a judge for a specific athlete/category/run.
 */
export interface Score {
  judgeRole: JudgeRole;
  categoryId: string;
  athleteBib: number;
  run: 1 | 2;
  attempt: number; // attempt number within a run (starts at 1, incremented by re-run)
  value: number; // 1-100
}

/**
 * Live event state — tracks the active category, run, and athlete.
 */
export interface LiveState {
  activeCategoryId: string | null;
  activeRun: 1 | 2;
  activeAthleteIndex: number; // index into sorted athletes array, 0 when empty
  activeAttemptNumber: number; // attempt within a run, starts at 1, incremented by re-run
}

/**
 * Default LiveState used when creating a new event or resetting state.
 * Single source of truth — import this instead of hardcoding the shape.
 */
export const DEFAULT_LIVE_STATE: LiveState = {
  activeCategoryId: null,
  activeRun: 1,
  activeAthleteIndex: 0,
  activeAttemptNumber: 1,
};

/**
 * Payload accepted by PUT /api/admin/live.
 * Extends Partial<LiveState> with control fields for lock/unlock and re-run.
 */
export interface LiveUpdatePayload extends Partial<LiveState> {
  lock?: boolean;
  rerun?: boolean;
}

/**
 * Shared route context type for dynamic route segments (Next.js App Router).
 */
export type RouteContext<T extends Record<string, string> = Record<string, string>> = {
  params: Promise<T>;
};

/**
 * EventData represents a persistent event record.
 *
 * @property id         - Unique identifier (non-empty string)
 * @property name       - Event name (non-empty string)
 * @property createdAt  - ISO 8601 timestamp of creation
 * @property adminKey   - Cryptographic secret for admin access
 * @property judgeKeys  - Map of judge role → secret key
 * @property categories - Scoring categories for the event
 * @property liveState  - Current live competition state
 * @property scores     - All submitted judge scores
 * @property lockedRuns - Lock keys ("categoryId:run") preventing further scoring
 */
export interface EventData {
  id: string;
  name: string;
  createdAt: string;
  adminKey: string;
  judgeKeys: Record<JudgeRole, string>;
  categories: Category[];
  liveState: LiveState;
  scores: Score[];
  lockedRuns: string[];
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

  // Scores: optional for backward compat
  if ('scores' in obj) {
    if (!Array.isArray(obj.scores)) return false;
  }

  // LockedRuns: optional for backward compat
  if ('lockedRuns' in obj) {
    if (!Array.isArray(obj.lockedRuns)) return false;
  }

  // LiveState: optional for backward compat
  if ('liveState' in obj) {
    if (!obj.liveState || typeof obj.liveState !== 'object') return false;
    const ls = obj.liveState as Record<string, unknown>;
    if (ls.activeCategoryId !== null && typeof ls.activeCategoryId !== 'string') return false;
    if (ls.activeRun !== 1 && ls.activeRun !== 2) return false;
    if (typeof ls.activeAthleteIndex !== 'number') return false;
    // activeAttemptNumber: optional for backward compat (defaults to 1)
    if ('activeAttemptNumber' in ls && typeof ls.activeAttemptNumber !== 'number') return false;
  }

  return true;
}
