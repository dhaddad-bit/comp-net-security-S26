# Migration Backlog (Incremental, Cursor-Friendly)

## Phase 0 - Baseline and Safety Net
### Goal
Create a clear parity baseline and prevent regressions during migration.

### Scope
- Lock and document current API/behavior contracts used by frontend.
- Identify and catalog existing tests that represent product-critical behavior.
- Add migration checklist tying each core feature to a verification step.

### Dependencies
- `docs/current-state-audit.md`
- Existing frontend/backend tests and routes.

### Success Criteria
- Core parity matrix exists and is agreed.
- Each must-survive feature has at least one verification path (test or manual scenario).
- Team can answer “what cannot break” unambiguously.

### Risks
- Missing hidden behaviors not captured in tests.
- Over-reliance on legacy docs instead of executable behavior.

---

## Phase 1 - Repository and Runtime Foundation
### Goal
Stand up Next.js + TypeScript skeleton in-repo without removing legacy app yet.

### Scope
- Initialize Next.js app structure and TypeScript config.
- Define folders for API handlers, domain logic, and data access layers.
- Add shared environment variable strategy for local/dev/prod serverless runtime.

### Dependencies
- Phase 0 parity matrix.
- Decision alignment from `docs/migration-decisions.md`.

### Success Criteria
- Next.js app boots locally.
- Basic authenticated/public route scaffolding exists.
- No parity features migrated yet, but migration foundation is stable.

### Risks
- Scope creep into feature work too early.
- Mixing legacy and new runtime concerns without boundaries.

---

## Phase 2 - Data Layer and Auth Core
### Goal
Migrate persistence + authentication primitives into serverless-compatible implementations.

### Scope
- Stand up managed free-tier Postgres target and migration scripts.
- Port user/profile/token persistence model.
- Implement Google OAuth in serverless auth flow.
- Implement protected request identity helper for API routes.

### Dependencies
- Phase 1 foundation.
- OAuth credentials and DB environment setup.

### Success Criteria
- Users can authenticate via Google and retrieve `me` equivalent from new stack.
- User/token records persist correctly in managed Postgres.
- Unauthorized requests are correctly blocked.

### Risks
- OAuth callback/session semantics differ from Express behavior.
- Token refresh edge cases may regress silently.

---

## Phase 3 - Onboarding and Calendar Parity
### Goal
Restore first-run onboarding and calendar ingestion behavior in new architecture.

### Scope
- Port username creation + validation + uniqueness checks.
- Port calendar listing/selection flow.
- Port event sync endpoint and local event retrieval endpoint.
- Port event normalization rules (all-day and overnight handling).

### Dependencies
- Phase 2 auth/user/token readiness.
- Google Calendar API integration in new API layer.

### Success Criteria
- New user can complete onboarding end-to-end.
- Calendar events render with parity for tested all-day/overnight cases.
- Manual sync flow works from UI.

### Risks
- Timezone/all-day normalization drift.
- API shape mismatch causing subtle frontend rendering issues.

---

## Phase 4 - Groups and Invite Workflow
### Goal
Migrate group management and invite acceptance flows.

### Scope
- Port group create/list/detail/leave routes.
- Port invite token generation, pending invite state, accept/decline handling.
- Preserve membership checks and authorization boundaries.

### Dependencies
- Phase 2 auth identity.
- Phase 3 user/calendar baseline for integrated UI.

### Success Criteria
- Users can create groups, view members, and leave groups.
- Invite links can be generated and consumed successfully.
- Group membership updates are reflected in UI state correctly.

### Risks
- Pending invite state handling differs in stateless serverless requests.
- Email send path may hit free-tier service limits.

---

## Phase 5 - Availability Domain and Endpoint Migration
### Goal
Restore server-side group availability calculations with view-mode parity.

### Scope
- Port availability endpoint contract.
- Port adapter/service/algorithm layering into typed modules.
- Preserve strict/flexible/lenient view semantics and compatibility fields.

### Dependencies
- Phase 4 groups + memberships.
- Calendar and petition data availability from prior phases.

### Success Criteria
- Availability endpoint returns parity-compatible payload.
- UI availability mode toggles and rendering behavior remain intact.
- Group membership enforcement remains server-side.

### Risks
- Contract drift (`availability` vs `blocks`) can break UI.
- Performance/cost spikes if query or compute path is inefficient.

---

## Phase 6 - Petition Workflow Migration
### Goal
Migrate petition lifecycle endpoints and UI compatibility behavior.

### Scope
- Port petition preflight/create/list/respond/delete routes.
- Preserve creator and membership authorization checks.
- Preserve status derivation semantics (`OPEN`, `FAILED`, `ACCEPTED_ALL`).
- Keep legacy alias behavior only if needed for transitional compatibility.

### Dependencies
- Phase 4 group membership and Phase 5 availability/event data flow.

### Success Criteria
- Petition creation and response lifecycle works end-to-end.
- Petition status displays correctly in calendar/group contexts.
- Legacy callers (if any) have explicit compatibility path or migration completed.

### Risks
- Status computation drift leading to incorrect UI signaling.
- Partial migration leaving duplicate/competing petition endpoints.

---

## Phase 7 - Cutover, Hardening, and Legacy Decommission
### Goal
Promote serverless stack to primary and retire old architecture safely.

### Scope
- Run full parity verification checklist.
- Update docs and runbooks to new architecture only.
- Remove deprecated Express/CRA paths after verification freeze.
- Confirm deployability on free-tier hosting with acceptable reliability.

### Dependencies
- Phases 0 through 6 completed and validated.

### Success Criteria
- New stack is default in production environment.
- Core parity checklist passes.
- Legacy stack can be removed without losing core functionality.

### Risks
- Hidden dependency on removed legacy routes.
- Free-tier limits discovered late under real usage patterns.

## Cross-Phase Execution Notes
- Keep each phase in small PRs with explicit parity checks.
- Favor adapter layers over broad rewrites to reduce risk.
- Keep domain logic independent from UI components at every phase.
- Record any intentional parity gaps immediately in backlog updates.
