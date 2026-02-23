# Architecture Reference

> Read this file first in every agent session. It gives you 90 % of the context
> without reading every source file.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, inline styles (no CSS framework) |
| Language | TypeScript 5 (strict) |
| Database | None — single JSON file `data/event.json` |
| Auth | URL query param `?key=…`, 32-byte base64url keys, timing-safe compare |
| Persistence | Atomic temp-file-then-rename via `saveEvent()` |
| Runtime | Node.js 18+ |

## Data Model (`lib/types.ts`)

```
EventData
├── id: string (UUID)
├── name: string
├── createdAt: string (ISO 8601)
├── adminKey: string (secret)
├── judgeKeys: { J1: string, J2: string, J3: string }
├── categories: Category[]
│   ├── id: string (UUID)
│   ├── name: string
│   └── athletes: Athlete[]
│       ├── bib: number (unique within category)
│       └── name: string
├── scores: Score[]
│   ├── judgeRole: "J1" | "J2" | "J3"
│   ├── categoryId: string
│   ├── athleteBib: number
│   ├── run: 1 | 2
│   ├── attempt: number (≥ 1)
│   └── value: number (1–100)
├── liveState: LiveState
│   ├── activeCategoryId: string | null
│   ├── activeRun: 1 | 2
│   ├── activeAthleteIndex: number
│   └── activeAttemptNumber: number
└── lockedRuns: string[] (format: "categoryId:run")
```

## Scoring Rules

- 3 judges (J1, J2, J3), scores 1–100 (integer)
- 2 runs per category, multiple attempts per run possible (re-run)
- Best attempt per run → best-of-two-runs → final score
- Dense ranking with tie detection

## File Map

```
middleware.ts                 — guards /admin/* (admin key) and /judge (judge key)
                               via internal fetch to /api/auth/validate

lib/
  types.ts                   — all interfaces + type guards (isEventData, etc.)
                               also: DEFAULT_LIVE_STATE, LiveUpdatePayload, RouteContext
  store.ts                   — loadEvent / saveEvent / updateEvent (atomic rename)
  auth.ts                    — generateKey / validateAdminKey / validateJudgeKey
  scoring.ts                 — computeRunScore / computeFinalScore / rankAthletes
  client-types.ts            — shared client-side types (CategorySummary, ClientAthlete,
                               thStyle/tdStyle) + re-exports from scoring.ts
  admin-handler.ts           — withAdminAuth(handler) — shared admin key + event
                               validation wrapper for API routes

app/
  layout.tsx                 — root layout (html, body)
  page.tsx                   — public landing page (link to /admin/create)

  admin/
    page.tsx                 — admin dashboard (categories + athletes CRUD)
    create/page.tsx          — event creation form, copy-to-clipboard for keys
    live/page.tsx            — live controls: category/run/athlete selection,
                               judge score tiles, lock/unlock, re-run, prev/next
    results/page.tsx         — overall + per-judge leaderboards with view
                               switcher (Overall/J1/J2/J3), 2s polling

  judge/
    page.tsx                 — judge scoring + personal leaderboard
                               (polls /api/state, /api/score, /api/score/leaderboard)

  api/
    event/route.ts           — GET: public event info (no secrets)
    state/route.ts           — GET: public live state (category, run, athlete)
    score/route.ts           — GET: own score | POST: submit score (judge key)
    score/leaderboard/route.ts — GET: judge-specific leaderboard (judge key)
    auth/validate/route.ts   — GET: internal key validation for middleware

    admin/
      create-event/route.ts  — GET: check exists | POST: create event
      categories/route.ts    — GET/POST/PUT/DELETE: category CRUD
      categories/[categoryId]/
        athletes/route.ts    — POST/DELETE: athlete CRUD
        athletes/import/route.ts — POST: CSV bulk import
      live/route.ts          — GET/PUT: live state + lock/unlock + re-run
      results/route.ts       — GET: ranked leaderboard (optional ?judge=J1|J2|J3
                               for per-judge filtering). Uses withAdminAuth.

    export/
      csv/route.ts           — GET: CSV download (admin key)
      json/route.ts          — GET: JSON backup (secrets stripped)
                               POST: JSON import with validation

__tests__/
  scoring.test.ts            — 18 unit tests for computeRunScore / computeFinalScore /
                               rankAthletes (ties, partial, multi-attempt, rounding)
  auth-store.test.ts         — 13 unit tests for generateKey / validateAdminKey /
                               validateJudgeKey / loadEvent / saveEvent / updateEvent
```

## Key Patterns

| Pattern | Detail |
|---------|--------|
| **Auth (admin)** | `validateAdminKey(key)` returns boolean |
| **Auth (judge)** | `validateJudgeKey(key)` returns `"J1"│"J2"│"J3"│null` |
| **Auth wrapper** | `withAdminAuth(handler)` eliminates per-route boilerplate |
| **Page guards** | Middleware calls `/api/auth/validate` internally |
| **Persistence** | `loadEvent()` → modify → `updateEvent(partial)` or `saveEvent(full)` |
| **Atomic writes** | Write to temp file → `fs.renameSync()` (same filesystem) |
| **Polling** | Client pages poll APIs every 2 s (`setInterval` + `fetch`). All polled endpoints set `Cache-Control: no-store`. |
| **Score key** | `(categoryId, athleteBib, judgeRole, run, attempt)` — upsert |
| **Lock key** | `"categoryId:run"` string in `lockedRuns[]` |
| **Client types** | Client pages import from `lib/client-types.ts` — no local interface re-declarations |
| **Live defaults** | `DEFAULT_LIVE_STATE` from `lib/types.ts` — single source of truth |

## Testing

| Command | Description |
|---------|-------------|
| `npm test` | Run all unit tests (Vitest, single run) |
| `npm run test:watch` | Run tests in watch mode |

Tests live in `__tests__/`. Vitest config is in `vitest.config.ts`.
Coverage targets: `lib/scoring.ts` (18 tests), `lib/auth.ts` (6 tests), `lib/store.ts` (5 tests).

## Known Limitations

- TOCTOU on concurrent writes (acceptable for single-process LAN use)
- No rate limiting (LAN-appropriate)
- Single event at a time
- No HTTPS (LAN only, no internet required)
