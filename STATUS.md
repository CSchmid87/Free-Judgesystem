# Project Status

> Last updated: 2026-02-23

## Merged to `main`

| US | Title | PR | Status |
|----|-------|----|--------|
| US-A00 | Minimal Next.js app with event API | #2 | ✅ Merged |
| US-A01 | Admin create page with key generation & route guards | #4 | ✅ Merged |
| US-A02 | Category management CRUD | #6 | ✅ Merged |
| US-A02b | Remove category weight concept | #30 | ✅ Merged |
| US-A03 | Athlete management per category | #8 | ✅ Merged |
| US-A04 | CSV import for athletes | #10 | ✅ Merged |
| US-A05 | Live controls for admin | #12 | ✅ Merged |
| US-A06 | Public /api/state endpoint | #14 | ✅ Merged |
| US-A07 | Judge scoring page | — | ✅ Merged (via US-A08–A11) |
| US-A08 | /api/score endpoint | — | ✅ Merged (via US-A11) |
| US-A09 | Judge score tiles on admin live page | — | ✅ Merged (via US-A11) |
| US-A10 | Admin lock/unlock controls per category/run | — | ✅ Merged (via US-A11) |
| US-A11 | Admin re-run action with attempt tracking | #24 | ✅ Merged |
| US-A12 | Scoring library (computeRunScore, etc.) | — | ✅ Merged (via US-A11) |
| US-A13 | Admin results page with leaderboard | — | ✅ Merged (via US-A11) |
| US-A14 | CSV export endpoint | #32 | ✅ Merged |
| US-A15 | Empty states and null handling | #34 | ✅ Merged |
| US-A16 | JSON export/import with validation | #36 | ✅ Merged |
| US-A17 | README rewrite — LAN setup, checklist, troubleshooting | #38 | ✅ Merged |
| US-B01 | Judges see their own live leaderboard | #70 | ✅ Merged |
| US-B02 | Head Judge overall and per-judge leaderboards | #71 | ✅ Merged |
| US-REF-00 | Codebase Health Baseline | #74 | ✅ Merged |

## In Progress

| US | Title | Branch | Notes |
|----|-------|--------|-------|
| — | — | — | — |

### US-REF-00 Summary (merged via #74)

**Consolidated:**
- Eliminated duplicated interfaces across 4 client pages → shared `lib/client-types.ts`
- Removed all `as unknown as` type casts (live page lock/rerun calls)
- Unified `LiveState` default values → `DEFAULT_LIVE_STATE` constant (single source of truth)
- Shared table styles (`thStyle`/`tdStyle`) extracted; judge page overrides preserved
- `RouteContext<T>` generic replaces per-route local type aliases

**Patterns standardized:**
- `withAdminAuth(handler)` wrapper for admin routes (applied to results route; pattern ready for remaining routes)
- `LiveUpdatePayload` interface for type-safe live update calls
- `Cache-Control: no-store` on results endpoint
- "Rider" → "Athlete" naming across UI
- Provisional badge hidden in per-judge view (was incorrectly shown)
- Border overlap fix on results view switcher buttons

**Test coverage added:**
- Vitest 4.0 configured (`npm test` / `npm run test:watch`)
- 18 scoring tests: `computeRunScore`, `computeFinalScore`, `rankAthletes` (ties, partial, multi-attempt, rounding, multi-category, stable sort)
- 13 auth+store tests: `generateKey`, `validateAdminKey`, `validateJudgeKey`, `loadEvent`, `saveEvent`, `updateEvent`
- 26-scenario manual regression script passed (event lifecycle, scoring, leaderboard, per-judge view, best-of-two-runs, re-run attempts, lock enforcement, exports)

**Files changed:** 20 (4 new, 16 modified)

## Backlog / Ideas

- Apply `withAdminAuth` wrapper to remaining 6 admin routes (categories, live, create-event, CSV export)
- Public spectator live-score page (auto-updating)
- QR code generation for judge URLs
- Multi-event support
- Dark mode
- Mobile-optimized results view
