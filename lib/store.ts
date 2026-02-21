import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventData, isEventData } from './types';

// Use process.cwd() for runtime; works cross-platform
const DATA_DIR = path.join(process.cwd(), 'data');
const EVENT_FILE = path.join(DATA_DIR, 'event.json');

/**
 * Ensure data directory exists, creating it if necessary.
 * Throws if directory creation is not permitted.
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    } catch (error) {
      throw new Error(
        `Failed to create data directory at ${DATA_DIR}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Validate EventData against expected schema.
 * Returns error message if invalid, null if valid.
 */
function validateEventData(data: unknown): string | null {
  if (!isEventData(data)) {
    return 'EventData must have non-empty id, name, and createdAt (ISO 8601 timestamp)';
  }
  return null;
}

/**
 * Load event from persistent storage.
 * Returns null if file doesn't exist or parse fails.
 */
export function loadEvent(): EventData | null {
  ensureDataDir();

  if (!fs.existsSync(EVENT_FILE)) {
    return null;
  }

  try {
    const content = fs.readFileSync(EVENT_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    const validationError = validateEventData(parsed);
    if (validationError) {
      console.warn(`Invalid EventData in ${EVENT_FILE}: ${validationError}`);
      return null;
    }
    return parsed as EventData;
  } catch (error) {
    console.error(
      `Failed to load event from ${EVENT_FILE}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Partially update the event (merge with existing data).
 * Useful for adding/removing categories without regenerating keys.
 */
export function updateEvent(patch: Partial<EventData>): EventData {
  const existing = loadEvent();
  if (!existing) {
    throw new Error('No event exists to update');
  }
  const updated: EventData = { ...existing, ...patch };
  saveEvent(updated);
  return updated;
}

/**
 * Save event with atomic write (temp file → rename).
 * Ensures data is never corrupted if process crashes mid-write.
 * Throws if validation fails or I/O fails.
 */
export function saveEvent(data: EventData): void {
  // Validate input before writing
  const validationError = validateEventData(data);
  if (validationError) {
    throw new Error(`Cannot save invalid EventData: ${validationError}`);
  }

  ensureDataDir();

  // Use os.tmpdir() for temp file (cross-platform safe)
  const tempFile = path.join(os.tmpdir(), `event-${Date.now()}.json.tmp`);

  try {
    // Write to temp file first
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');

    // Atomic rename: temp → destination
    // On POSIX (macOS, Linux): atomic if on same filesystem
    // On Windows: will fail if destination exists; handle below
    try {
      fs.renameSync(tempFile, EVENT_FILE);
    } catch (renameError) {
      // Windows: remove existing file if it exists, then rename
      if (fs.existsSync(EVENT_FILE)) {
        fs.unlinkSync(EVENT_FILE);
        fs.renameSync(tempFile, EVENT_FILE);
      } else {
        throw renameError;
      }
    }
  } catch (error) {
    // Clean up temp file on failure
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(
      `Failed to save event to ${EVENT_FILE}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
