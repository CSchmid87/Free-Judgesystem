/**
 * EventData represents a persistent event record.
 *
 * @property id - Unique identifier (non-empty string)
 * @property name - Event name (non-empty string)
 * @property createdAt - ISO 8601 timestamp of creation
 */
export interface EventData {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * Type guard for EventData.
 * Use to safely narrow unknown types at runtime.
 */
export function isEventData(value: unknown): value is EventData {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    !!obj.id &&
    typeof obj.name === 'string' &&
    !!obj.name &&
    typeof obj.createdAt === 'string' &&
    !!obj.createdAt
  );
}
