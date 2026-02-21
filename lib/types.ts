/**
 * Judge roles supported by the system.
 */
export const JUDGE_ROLES = ['J1', 'J2', 'J3'] as const;
export type JudgeRole = (typeof JUDGE_ROLES)[number];

/**
 * EventData represents a persistent event record.
 *
 * @property id        - Unique identifier (non-empty string)
 * @property name      - Event name (non-empty string)
 * @property createdAt - ISO 8601 timestamp of creation
 * @property adminKey  - Cryptographic secret for admin access
 * @property judgeKeys - Map of judge role → secret key
 */
export interface EventData {
  id: string;
  name: string;
  createdAt: string;
  adminKey: string;
  judgeKeys: Record<JudgeRole, string>;
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
  return JUDGE_ROLES.every(
    (role) => typeof jk[role] === 'string' && !!jk[role]
  );
}
