# Parity Verification Matrix

## How to Use
- Every row is a must-survive behavior for migration cutover.
- “Automated tests” lists tests that already exist in repo.
- “Gaps” identifies what is not currently covered and must be manually verified until tests are added.

## Must-Survive Features

| Feature | Automated Tests Already Cover It | Gaps in Coverage | Manual Test Scenario | Migration Acceptance Criteria | Cutover Blocker if Broken |
|---|---|---|---|---|---|
| Auth gating into app vs login | `frontend/src/tests/App.onboarding-flow.test.jsx` (user present vs absent flow logic indirectly via `api/me`) | No end-to-end OAuth callback/session test | Login with Google, reload, confirm app stays authenticated | Authenticated user reaches app; unauthenticated user reaches login path | **Yes** |
| New-user onboarding gate | `frontend/src/tests/App.onboarding-flow.test.jsx` (`"New user!"` -> username screen) | No test for transition from onboarding completion to main app | New account logs in, sees username/calendar flow, completes, lands on main | Onboarding required before main for new user and bypassed after completion | **Yes** |
| Username + calendar onboarding writes | No direct frontend/backend test coverage | Validation, duplicate username, and selected-calendar persistence not test-covered | Try invalid/duplicate username, then valid + select calendars | Same validation semantics and successful persistence | **Yes** |
| Personal event normalization (all-day/overnight) | `frontend/src/tests/CustomCalendar.event-normalization.test.jsx`, `backend/tests/calendar_event_normalizer.test.js` | No integrated sync->normalize test for provider data edge cases | Sync calendar with all-day and overnight events, verify rendered placement/opacities | Event rendering parity for all-day and overnight behavior | **Yes** |
| Availability fetch + view switching semantics | `frontend/src/tests/CustomCalendar.availability-mode.test.jsx` | No backend route integration tests for auth/membership failures | Select group, switch Strict/Flexible/Lenient, compare legend and block behavior | View toggles without refetch regressions; fallback payload still works | **Yes** |
| Group selection persistence in UI | `frontend/src/tests/Main.availability-state.test.jsx` | No tests for persistence across full page reload/session restoration | Select group, toggle sidebars/event panel, verify selected group remains expected | Group selection behavior matches current tests/UI expectations | **Yes** |
| Group lifecycle (create/list/detail/leave) | No direct backend route tests | No automated auth/membership regression tests | Create group, open info, leave group, verify membership updates and view state | All core group workflows work for authenticated user | **Yes** |
| Invite token + pending invite flow | No direct automated tests | Logged-out invite click and post-login pending resolution untested | Generate invite link, open logged-out browser, login, accept/decline pending invite | Invite continuation across auth works with valid/expired token handling | **Yes** |
| Petition lifecycle + status/actions | Availability tests verify petition rendering colors/status usage via mocked payload; no backend lifecycle tests | Preflight, create/respond/delete and authorization are not fully integration-tested | Create petition, respond as member, delete as creator, confirm status transitions | Petition routes and UI action semantics preserved | **Yes** |
| Availability domain correctness (algorithm semantics) | `backend/algorithm/tests/algorithm.test.js`, `backend/algorithm/tests/algorithm_adapter.test.js` | No integration test from route -> DB adapter -> frontend consumption | Compare known fixture group data against expected strict/flexible/lenient counts | Output contract and blocking-level semantics unchanged | **Yes** |
| Manual blocking event mutations | No dedicated automated tests for mutation endpoints | apply-to-all and delete-by-title ownership semantics untested | Add manual events, update one/all priorities, delete one/all, refresh calendar | Mutation endpoints behave exactly as current UI expects | **Yes** |
| Logout behavior | No dedicated test | No auth cookie/session invalidation regression checks | Logout and attempt protected actions; verify user is unauthenticated | Session/auth state is cleared and app returns to login | **Yes** |

## Cutover Checklist (Minimum)
- All “Cutover Blocker” rows pass manual verification in staging.
- Existing frontend tests listed above pass without changes or with intentional, reviewed updates.
- Availability and petition domain semantics validated against existing algorithm tests and UI rendering checks.

## Unresolved Decisions Before Coding
- Lock auth session approach for parity phase: DB-backed sessions vs JWT (recommend DB-backed first for behavior matching).
- Decide compatibility strategy for non-REST legacy routes (`/group/*`, `/user/groups`) during migration window.
- Decide timeline for deprecating legacy alias `POST /api/add-petition`.
- Confirm final invite pending-state persistence method in serverless runtime (cookie-only vs temporary DB state).
- Decide whether to keep `/api/events` as sync+read combined endpoint after parity or split later.

## Recommended First Implementation Slice
- **Safest first slice**: implement only identity + read-only baseline in Next.js while preserving existing backend as reference.
  1. Stand up Next.js + TypeScript skeleton.
  2. Implement `GET /api/me` with auth wiring and compatibility response shape.
  3. Implement read-only `GET /api/get-events` path from local DB with existing event normalization.
  4. Render minimal authenticated page consuming these two endpoints (no writes yet).
- **Why this slice**:
  - touches highest-risk boundary (auth + event read shape) with lowest mutation risk.
  - unlocks immediate validation against existing frontend expectations.
  - keeps availability/petition/group writes out until identity and event contracts are stable.
