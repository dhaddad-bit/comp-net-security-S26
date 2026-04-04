# Auth and Calendar Boundary Spec

## Objective
Define execution-grade boundaries for auth, identity, calendar sync, and local event state in the serverless migration, while preserving current behavior.

## 1) Session Strategy Recommendation
- **Recommendation**: Use serverless-compatible auth middleware/library with Google OAuth provider and DB-backed account linkage.
- **Preferred session mode for parity**: database-backed sessions (closest to current semantics), then evaluate JWT later if needed.
- **Why for parity**:
  - Current app assumes cookie + server-validated identity in every request.
  - Invite continuation and logout behavior are easier to preserve with server-validated sessions.
- **Explicit non-goal in phase 1**: redesigning auth UX or changing provider.

## 2) Protected Request Identity Pattern
- Introduce one shared server helper for identity extraction:
  - returns `{ userId, isAuthenticated }` or typed auth error.
- All parity-critical protected routes must call this helper before business logic:
  - calendar sync/read, groups, invites, petitions, availability, username write.
- Keep authorization split:
  - **authentication** (who is caller)
  - **resource membership/ownership checks** (can caller act on this group/event)

## 3) Onboarding State Logic
- **Current behavior to preserve**:
  - authenticated user with username `"New user!"` is sent to onboarding.
  - onboarding requires username + selected calendars.
- **Execution-grade migration rule**:
  - Maintain current sentinel behavior for compatibility.
  - Add target-compatible derived field in `GET /api/me` (e.g., `needsOnboarding`) without breaking current frontend.
- **Post-parity cleanup candidate**:
  - remove sentinel coupling once frontend reads explicit onboarding status.

## 4) Provider Token Storage Model
- **Current behavior**: access/refresh/expiry persisted in `person`.
- **Recommendation for parity**:
  - keep persisted token refresh model.
  - allow migration to provider-account table only if route contracts remain unchanged.
- **Security guardrails**:
  - do not return token fields to browser in target API shape.
  - keep token refresh server-side only.

## 5) Token Refresh and Recovery Expectations
- Preserve current user-facing semantics:
  - refresh if token missing/near expiry.
  - if refresh fails with invalid grant, require reauthentication.
  - treat provider/internal failures as retriable server errors where appropriate.
- Required parity outcomes:
  - `/api/events` and `/api/calendars` still work after access-token expiration if refresh token is valid.
  - app reliably routes user to login/reauth when refresh token is invalid.

## 6) Selected Calendar Persistence
- Preserve one-time onboarding selection + persisted selected calendars.
- Persist by user and provider calendar id (multi-calendar supported).
- `POST /api/select-calendars` must remain idempotent enough to tolerate repeated submissions.

## 7) Google Event Sync Strategy
- Keep split behavior:
  - `GET /api/events`: sync from Google -> reconcile local DB -> return normalized events.
  - `GET /api/get-events`: read local snapshot only.
- Keep reconciliation semantics:
  - add new provider events.
  - update modified provider events.
  - remove deleted provider events (except manual-only rows).
- Keep manual sync button behavior in `Main.jsx`.

## 8) Local Snapshot / Cache Policy
- Local DB remains the immediate rendering source for calendar UI.
- Sync is on-demand (current behavior) to stay free-tier friendly.
- Optional future optimization (not parity-critical): incremental sync tokens via `calendar_sync_meta`.

## 9) Manual Block Handling
- Preserve manual block writes into local event store via `/api/add-events`.
- Preserve event mutation semantics used by UI:
  - change priority by event or by title.
  - delete by event or by title.
- Preserve compatibility with priority mapping used by availability algorithm.

## 10) Failure Modes and Fallback Behavior
- **Auth/session missing**: return 401 on protected APIs.
- **Membership failure**: return 403 on group-scoped routes.
- **Provider permission revoked**: return auth-related failure and trigger reauth path.
- **DB/schema unavailable**:
  - petition endpoints can return classified 503 (`PETITION_SCHEMA_MISSING` behavior currently exists).
  - other routes return 5xx with traceable logs.
- **Availability route fallback**:
  - if `views` absent in payload, frontend falls back to strict-compatible behavior (already tested).

## Explicit Underspecification to Resolve Before Coding
- Whether to keep DB-backed sessions as final state or transitional state.
- Whether to retain `/api/events` as sync+read combined endpoint long term.
- Whether invite pending state remains cookie/session-based only or gets DB-backed continuation.
