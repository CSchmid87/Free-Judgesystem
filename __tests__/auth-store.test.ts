import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateKey, validateAdminKey, validateJudgeKey } from '../lib/auth';
import { loadEvent, saveEvent, updateEvent } from '../lib/store';
import type { EventData } from '../lib/types';
import { DEFAULT_LIVE_STATE } from '../lib/types';

// ─── Fixture ─────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const EVENT_FILE = path.join(DATA_DIR, 'event.json');

function makeEvent(overrides: Partial<EventData> = {}): EventData {
  return {
    id: 'test-id',
    name: 'Test Event',
    createdAt: new Date().toISOString(),
    adminKey: 'admin-key-abc',
    judgeKeys: { J1: 'j1-key', J2: 'j2-key', J3: 'j3-key' },
    categories: [],
    liveState: { ...DEFAULT_LIVE_STATE },
    scores: [],
    lockedRuns: [],
    ...overrides,
  };
}

/** Back up and restore event.json around tests to avoid side effects. */
let backup: string | null = null;

beforeEach(() => {
  if (fs.existsSync(EVENT_FILE)) {
    backup = fs.readFileSync(EVENT_FILE, 'utf-8');
  } else {
    backup = null;
  }
});

afterEach(() => {
  if (backup !== null) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(EVENT_FILE, backup, 'utf-8');
  } else if (fs.existsSync(EVENT_FILE)) {
    fs.unlinkSync(EVENT_FILE);
  }
});

// ─── generateKey ─────────────────────────────────────────────────────────────

describe('generateKey', () => {
  it('T-A01: returns base64url string from 32 random bytes', () => {
    const key = generateKey();
    expect(typeof key).toBe('string');
    // 32 bytes → 43 base64url chars (no padding)
    expect(key.length).toBe(43);
    // No padding characters
    expect(key).not.toContain('=');
    // Valid base64url character set
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 10 }, () => generateKey()));
    expect(keys.size).toBe(10);
  });
});

// ─── validateAdminKey ────────────────────────────────────────────────────────

describe('validateAdminKey', () => {
  it('T-A02: matches loaded event admin key', () => {
    const event = makeEvent({ adminKey: 'my-secret-admin-key-1234567890aaa' });
    saveEvent(event);
    expect(validateAdminKey('my-secret-admin-key-1234567890aaa')).toBe(true);
  });

  it('T-A03: rejects wrong key', () => {
    const event = makeEvent({ adminKey: 'correct-key-abcdefghij1234567890' });
    saveEvent(event);
    expect(validateAdminKey('wrong-key-abcdefghijkl1234567890x')).toBe(false);
  });

  it('T-A06: null key → false (no crash)', () => {
    saveEvent(makeEvent());
    expect(validateAdminKey(null)).toBe(false);
  });
});

// ─── validateJudgeKey ────────────────────────────────────────────────────────

describe('validateJudgeKey', () => {
  it('T-A04: maps to correct role', () => {
    const event = makeEvent({
      judgeKeys: { J1: 'key-j1-aaaa', J2: 'key-j2-bbbb', J3: 'key-j3-cccc' },
    });
    saveEvent(event);
    expect(validateJudgeKey('key-j1-aaaa')).toBe('J1');
    expect(validateJudgeKey('key-j2-bbbb')).toBe('J2');
    expect(validateJudgeKey('key-j3-cccc')).toBe('J3');
  });

  it('T-A05: rejects unknown key', () => {
    saveEvent(makeEvent());
    expect(validateJudgeKey('unknown-key')).toBeNull();
  });

  it('null key → null', () => {
    saveEvent(makeEvent());
    expect(validateJudgeKey(null)).toBeNull();
  });
});

// ─── store: loadEvent / saveEvent / updateEvent ──────────────────────────────

describe('store', () => {
  it('T-ST01: saveEvent + loadEvent round-trip', () => {
    const event = makeEvent({ name: 'Round Trip Event' });
    saveEvent(event);
    const loaded = loadEvent();
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('Round Trip Event');
    expect(loaded!.id).toBe(event.id);
  });

  it('T-ST02: loadEvent when no file → null', () => {
    if (fs.existsSync(EVENT_FILE)) {
      fs.unlinkSync(EVENT_FILE);
    }
    const loaded = loadEvent();
    expect(loaded).toBeNull();
  });

  it('T-ST03: updateEvent merges partial data', () => {
    saveEvent(makeEvent({ name: 'Original' }));
    const updated = updateEvent({ name: 'Updated' });
    expect(updated.name).toBe('Updated');
    expect(updated.id).toBe('test-id'); // unchanged
    // Verify persisted
    const loaded = loadEvent();
    expect(loaded!.name).toBe('Updated');
  });

  it('T-ST04: saveEvent rejects malformed data', () => {
    const bad = { id: '', name: '', createdAt: '' } as unknown as EventData;
    expect(() => saveEvent(bad)).toThrow();
  });

  it('updateEvent throws when no event exists', () => {
    if (fs.existsSync(EVENT_FILE)) {
      fs.unlinkSync(EVENT_FILE);
    }
    expect(() => updateEvent({ name: 'boom' })).toThrow('No event exists');
  });
});
