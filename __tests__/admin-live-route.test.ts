import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import type { EventData } from '@/lib/types';

const updateEventMock = vi.fn();
const loadEventMock = vi.fn();
const validateAdminKeyMock = vi.fn();

vi.mock('@/lib/store', () => ({
  loadEvent: loadEventMock,
  updateEvent: updateEventMock,
}));

vi.mock('@/lib/auth', () => ({
  validateAdminKey: validateAdminKeyMock,
}));

function makeEvent(): EventData {
  return {
    id: 'event-1',
    name: 'Event',
    createdAt: new Date().toISOString(),
    adminKey: 'admin',
    judgeKeys: { J1: 'j1', J2: 'j2', J3: 'j3' },
    categories: [
      {
        id: 'cat-1',
        name: 'Category',
        athletes: [
          { bib: 1, name: 'Alice' },
          { bib: 2, name: 'Bob' },
        ],
      },
    ],
    liveState: {
      activeCategoryId: 'cat-1',
      activeRun: 1,
      activeAthleteIndex: 0,
      activeAttemptNumber: 3,
    },
    scores: [],
    lockedRuns: [],
  };
}

function makeRequest(body: Record<string, unknown>) {
  return {
    nextUrl: { searchParams: new URLSearchParams('key=admin-key') },
    json: async () => body,
  } as unknown as NextRequest;
}

describe('PUT /api/admin/live', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateAdminKeyMock.mockReturnValue(true);
    loadEventMock.mockReturnValue(makeEvent());
  });

  it('resets attempt to 1 when active athlete changes', async () => {
    const { PUT } = await import('@/app/api/admin/live/route');
    const res = await PUT(makeRequest({ activeAthleteIndex: 1 }));
    const json = await res.json();

    expect(updateEventMock).toHaveBeenCalledWith({
      liveState: {
        activeCategoryId: 'cat-1',
        activeRun: 1,
        activeAthleteIndex: 1,
        activeAttemptNumber: 1,
      },
    });
    expect(json.liveState.activeAttemptNumber).toBe(1);
  });

  it('keeps attempt when active athlete does not change', async () => {
    const { PUT } = await import('@/app/api/admin/live/route');
    const res = await PUT(makeRequest({ activeAthleteIndex: 0 }));
    const json = await res.json();

    expect(updateEventMock).toHaveBeenCalledWith({
      liveState: {
        activeCategoryId: 'cat-1',
        activeRun: 1,
        activeAthleteIndex: 0,
        activeAttemptNumber: 3,
      },
    });
    expect(json.liveState.activeAttemptNumber).toBe(3);
  });
});
