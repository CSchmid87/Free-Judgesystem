import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { GET, PUT } from '../app/api/admin/finals/route';
import { saveEvent, loadEvent } from '../lib/store';
import { DEFAULT_LIVE_STATE, DEFAULT_FINAL_RUN_COUNT } from '../lib/types';
import type { EventData } from '../lib/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const EVENT_FILE = path.join(DATA_DIR, 'event.json');

const ADMIN_KEY = 'admin-key-for-finals-test-1234567890';

function makeEvent(overrides: Partial<EventData> = {}): EventData {
  return {
    id: 'test-id-finals',
    name: 'Finals Test Event',
    createdAt: new Date().toISOString(),
    adminKey: ADMIN_KEY,
    judgeKeys: { J1: 'j1', J2: 'j2', J3: 'j3' },
    categories: [
      {
        id: 'cat-1',
        name: 'Open',
        athletes: [{ bib: 1, name: 'Anna' }],
      },
    ],
    liveState: { ...DEFAULT_LIVE_STATE },
    scores: [
      { judgeRole: 'J1', categoryId: 'cat-1', athleteBib: 1, run: 1, attempt: 1, value: 80 },
    ],
    lockedRuns: ['cat-1:1'],
    finalRunCount: DEFAULT_FINAL_RUN_COUNT,
    finalsStarted: false,
    ...overrides,
  };
}

function makeRequest(method: 'GET' | 'PUT', key: string | null, body?: unknown): NextRequest {
  const url = new URL('http://localhost/api/admin/finals' + (key ? `?key=${encodeURIComponent(key)}` : ''));
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let backup: string | null = null;

beforeEach(() => {
  backup = fs.existsSync(EVENT_FILE) ? fs.readFileSync(EVENT_FILE, 'utf-8') : null;
});

afterEach(() => {
  if (backup !== null) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(EVENT_FILE, backup, 'utf-8');
  } else if (fs.existsSync(EVENT_FILE)) {
    fs.unlinkSync(EVENT_FILE);
  }
});

describe('GET /api/admin/finals', () => {
  it('returns 401 without admin key', async () => {
    saveEvent(makeEvent());
    const res = await GET(makeRequest('GET', null));
    expect(res.status).toBe(401);
  });

  it('returns finalRunCount and finalsStarted', async () => {
    saveEvent(makeEvent({ finalRunCount: 3, finalsStarted: false }));
    const res = await GET(makeRequest('GET', ADMIN_KEY));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ finalRunCount: 3, finalsStarted: false });
  });
});

describe('PUT /api/admin/finals — adjust before finals start', () => {
  it('updates finalRunCount before finals start', async () => {
    saveEvent(makeEvent({ finalRunCount: 2, finalsStarted: false }));
    const res = await PUT(makeRequest('PUT', ADMIN_KEY, { finalRunCount: 4 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ finalRunCount: 4, finalsStarted: false });
    expect(loadEvent()!.finalRunCount).toBe(4);
  });

  it('rejects non-integer finalRunCount', async () => {
    saveEvent(makeEvent());
    const res = await PUT(makeRequest('PUT', ADMIN_KEY, { finalRunCount: 2.5 }));
    expect(res.status).toBe(400);
  });

  it('rejects finalRunCount below the minimum', async () => {
    saveEvent(makeEvent());
    const res = await PUT(makeRequest('PUT', ADMIN_KEY, { finalRunCount: 0 }));
    expect(res.status).toBe(400);
    expect(loadEvent()!.finalRunCount).toBe(DEFAULT_FINAL_RUN_COUNT);
  });

  it('rejects finalRunCount above the maximum', async () => {
    saveEvent(makeEvent());
    const res = await PUT(makeRequest('PUT', ADMIN_KEY, { finalRunCount: 99 }));
    expect(res.status).toBe(400);
  });

  it('does not touch qualification data (categories, scores, lockedRuns, liveState)', async () => {
    const before = makeEvent({ finalRunCount: 2 });
    saveEvent(before);
    await PUT(makeRequest('PUT', ADMIN_KEY, { finalRunCount: 5 }));
    const after = loadEvent()!;
    expect(after.categories).toEqual(before.categories);
    expect(after.scores).toEqual(before.scores);
    expect(after.lockedRuns).toEqual(before.lockedRuns);
    expect(after.liveState).toEqual(before.liveState);
  });
});

describe('PUT /api/admin/finals — start finals', () => {
  it('marks finals as started', async () => {
    saveEvent(makeEvent({ finalRunCount: 3, finalsStarted: false }));
    const res = await PUT(makeRequest('PUT', ADMIN_KEY, { start: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ finalRunCount: 3, finalsStarted: true });
    expect(loadEvent()!.finalsStarted).toBe(true);
  });

  it('rejects start: false (finals cannot be un-started)', async () => {
    saveEvent(makeEvent({ finalsStarted: true }));
    const res = await PUT(makeRequest('PUT', ADMIN_KEY, { start: false }));
    expect(res.status).toBe(400);
    expect(loadEvent()!.finalsStarted).toBe(true);
  });
});

describe('PUT /api/admin/finals — locked after start', () => {
  it('rejects finalRunCount changes once finals have started', async () => {
    saveEvent(makeEvent({ finalRunCount: 3, finalsStarted: true }));
    const res = await PUT(makeRequest('PUT', ADMIN_KEY, { finalRunCount: 5 }));
    expect(res.status).toBe(409);
    expect(loadEvent()!.finalRunCount).toBe(3);
  });

  it('still allows idempotent start: true after already started', async () => {
    saveEvent(makeEvent({ finalRunCount: 3, finalsStarted: true }));
    const res = await PUT(makeRequest('PUT', ADMIN_KEY, { start: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ finalRunCount: 3, finalsStarted: true });
  });
});
