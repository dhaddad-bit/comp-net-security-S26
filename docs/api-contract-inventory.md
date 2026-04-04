# API Contract Inventory (Parity-Critical)

## Scope and Authority
- Source of truth: backend route implementations in `backend/server.js`, `backend/routes/*.js`, and current frontend consumers in `frontend/src/**`.
- This inventory covers parity-critical contracts needed to migrate safely.
- If legacy prose conflicts with these contracts, preserve repo behavior first.

## Contract Entries

### 1) `GET /api/me`
- **Purpose**: Resolve current authenticated user and drive app gating.
- **Auth requirement**: Optional; returns `user: null` when unauthenticated.
- **Request/query shape**: none.
- **Response shape**:
  - Authenticated: `{ user: { user_id, username, email, first_name, last_name, google_id, ...tokens } }`
  - Unauthenticated: `{ user: null }`
- **Error cases**: DB failure can surface 500.
- **Current frontend consumers**: `App.jsx`, `Main.jsx`, `CustomCalendar.jsx`, `GroupCreator.jsx`.
- **Lifecycle**:
  - **Must-preserve**: yes.
  - **Can-change**: reduce token fields returned to frontend.
  - **Can-deprecate**: no.
- **Proposed Next.js replacement path**: `GET /api/me` (keep path stable).

### 2) `GET /auth/google` + `GET /oauth2callback`
- **Purpose**: Start/complete Google OAuth login.
- **Auth requirement**: Public entry; callback sets authenticated state.
- **Request/query shape**:
  - `/auth/google`: no payload.
  - `/oauth2callback`: Google query params (`code`, `state`, error variants).
- **Response shape**: redirects (not JSON).
- **Error cases**:
  - permission refusal -> redirect with login error.
  - OAuth/token exchange failures -> login redirect/failure.
- **Current frontend consumers**: `Login.jsx` initiates flow via location redirect.
- **Lifecycle**:
  - **Must-preserve**: behavior yes, exact path can be mapped.
  - **Can-change**: callback internal wiring/session mechanism.
  - **Can-deprecate**: old callback internals only.
- **Proposed Next.js replacement path**:
  - Keep UX entry at `/auth/google` (or equivalent auth provider endpoint + compatibility redirect).
  - Callback under auth framework handler with compatibility redirect.

### 3) Behavior: Onboarding Gate (`"New user!"`)
- **Purpose**: Route newly authenticated users to username/calendar setup before main app.
- **Auth requirement**: authenticated user required.
- **Request/query shape**: depends on `GET /api/me` + onboarding endpoints below.
- **Response shape**: UI behavior (not route-owned).
- **Error cases**: missing/invalid user record leads to error page/login.
- **Current frontend consumers**: `App.jsx`, `UsernameCreation.jsx`.
- **Lifecycle**:
  - **Must-preserve**: yes (behavior).
  - **Can-change**: replace sentinel string with explicit onboarding status field.
  - **Can-deprecate**: sentinel literal after migration.
- **Proposed Next.js replacement path**: keep `GET /api/me`, add normalized onboarding status in response.

### 4) `POST /api/create-username`
- **Purpose**: Persist user-selected username with uniqueness/format checks.
- **Auth requirement**: required.
- **Request/query shape**: body `{ username: string }`.
- **Response shape**:
  - success: `{ success: true }`
  - validation/auth/duplicate: `{ success: false, error? | errors?: string[] }`
- **Error cases**: unauthenticated, invalid format, duplicate username, DB errors.
- **Current frontend consumers**: `UsernameCreation.jsx`.
- **Lifecycle**:
  - **Must-preserve**: yes.
  - **Can-change**: validation error envelope standardization.
  - **Can-deprecate**: no.
- **Proposed Next.js replacement path**: `POST /api/create-username`.

### 5) `GET /api/calendars`
- **Purpose**: Fetch available Google calendars for onboarding selection.
- **Auth requirement**: required.
- **Request/query shape**: none.
- **Response shape**: `[{ id, summary, description, primary }]`.
- **Error cases**: auth/token refresh failure, provider failure.
- **Current frontend consumers**: `UsernameCreation.jsx`.
- **Lifecycle**:
  - **Must-preserve**: yes.
  - **Can-change**: omit unused fields if UI not dependent.
  - **Can-deprecate**: no.
- **Proposed Next.js replacement path**: `GET /api/calendars`.

### 6) `POST /api/select-calendars`
- **Purpose**: Persist selected calendars to local DB account.
- **Auth requirement**: required.
- **Request/query shape**: body `{ calendars: Array<{ id, summary, ... }> }`.
- **Response shape**: `{ success: true }` or `{ success: false, error }`.
- **Error cases**: unauthenticated, malformed payload, DB failure.
- **Current frontend consumers**: `UsernameCreation.jsx`.
- **Lifecycle**:
  - **Must-preserve**: yes.
  - **Can-change**: input schema hardening.
  - **Can-deprecate**: no.
- **Proposed Next.js replacement path**: `POST /api/select-calendars`.

### 7) `GET /api/events`
- **Purpose**: Sync selected Google calendars into local event snapshot and return normalized events.
- **Auth requirement**: required.
- **Request/query shape**: none.
- **Response shape**: array of normalized events (`title/start/end/event_id/isAllDay...`).
- **Error cases**:
  - token refresh invalid -> 401 + reauth-needed semantics.
  - provider failures -> 500/partial sync behavior.
- **Current frontend consumers**: `Main.jsx` (`fetchEvents`, sync button).
- **Lifecycle**:
  - **Must-preserve**: yes.
  - **Can-change**: split sync and read endpoints later (post-parity).
  - **Can-deprecate**: no during parity.
- **Proposed Next.js replacement path**: `GET /api/events` (server route handler).

### 8) `GET /api/get-events`
- **Purpose**: Return normalized local snapshot only (no external sync).
- **Auth requirement**: required.
- **Request/query shape**: none.
- **Response shape**: normalized event array.
- **Error cases**: unauthenticated (401), DB failure (500).
- **Current frontend consumers**: `CustomCalendar.jsx`.
- **Lifecycle**:
  - **Must-preserve**: yes.
  - **Can-change**: eventually merge behind query flag if desired.
  - **Can-deprecate**: not until UI and tests are migrated.
- **Proposed Next.js replacement path**: `GET /api/get-events`.

### 9) `POST /api/add-events`
- **Purpose**: Add manual blocking events into local event store.
- **Auth requirement**: required.
- **Request/query shape**: `{ events: [{ title, start, end, event_id, priority }] }`.
- **Response shape**: `{ success: true, message }` (201 on success).
- **Error cases**: bad payload (400), unauthorized (401), missing calendar (404), DB failure (500).
- **Current frontend consumers**: `EventSidebar.jsx`.
- **Lifecycle**:
  - **Must-preserve**: yes.
  - **Can-change**: canonical manual event id generation strategy.
  - **Can-deprecate**: no.
- **Proposed Next.js replacement path**: `POST /api/add-events`.

### 10) `POST /api/change-blocking-lvl`
- **Purpose**: Update event priority for one event or all same-title events for current user.
- **Auth requirement**: effectively required for bulk update.
- **Request/query shape**:
  - single: `{ event_id, priority, apply_to_all: false }`
  - bulk: `{ title, priority, apply_to_all: true }`
- **Response shape**: `{ success: true, message }`.
- **Error cases**: missing fields (400), server errors (500).
- **Current frontend consumers**: `EventClickModal.jsx`.
- **Lifecycle**:
  - **Must-preserve**: yes.
  - **Can-change**: path name + method can be normalized later.
  - **Can-deprecate**: no at parity phase.
- **Proposed Next.js replacement path**: `POST /api/change-blocking-lvl` (compat), future alias `/api/events/priority`.

### 11) `POST /api/delete-event` and `POST /api/delete-events-by-title`
- **Purpose**: Delete manual blocking event(s).
- **Auth requirement**: expected required (single-event route currently lacks explicit ownership guard; preserve behavior, then harden post-parity).
- **Request/query shape**:
  - single: `{ event_id }`
  - bulk: `{ title }`
- **Response shape**: success message + optional deleted count.
- **Error cases**: missing fields (400), server errors (500).
- **Current frontend consumers**: `EventClickModal.jsx`.
- **Lifecycle**:
  - **Must-preserve**: yes.
  - **Can-change**: migrate to RESTful `DELETE` forms after parity.
  - **Can-deprecate**: no before parity.
- **Proposed Next.js replacement path**:
  - keep compat `POST /api/delete-event`
  - keep compat `POST /api/delete-events-by-title`
  - future consolidation under `/api/events`.

### 12) `GET /user/groups`, `POST /group/creation`, `GET /group/:groupId`, `POST /group/leave`
- **Purpose**: Core group membership lifecycle.
- **Auth requirement**: required.
- **Request/query shape**:
  - create uses query string `group_name`.
  - leave uses body `{ groupId }`.
- **Response shape**:
  - list: `{ success: true, groups }`
  - create: `{ success, groupId, groupName, membershipAdded }`
  - detail: `{ success, group, members }`
  - leave: `{ success: true }`
- **Error cases**: unauthorized, missing group input, DB failure.
- **Current frontend consumers**: `Groups.jsx`, `GroupCreator.jsx`, `GroupInfo.jsx`, `Main.jsx`.
- **Lifecycle**:
  - **Must-preserve**: yes.
  - **Can-change**: move `group_name` to body in v2.
  - **Can-deprecate**: eventual non-REST path naming only.
- **Proposed Next.js replacement path**:
  - keep compatibility paths in parity phase.
  - add canonical `/api/groups/*` endpoints in later phase.

### 13) `POST /group/invite`, `GET /api/group-invite/pending`, `POST /api/group-invite/respond`, `POST /api/group/send_link_over_email`
- **Purpose**: Invite token generation + pending invite acceptance + optional email delivery.
- **Auth requirement**: required for creator and invite response checks.
- **Request/query shape**:
  - invite create: `{ group_id }`
  - respond: `{ decision: "accept" | "decline" }`
  - email send: `{ users, sender_user, shareable_link }`
- **Response shape**:
  - invite create: `{ invite }`
  - pending: `{ ok, hasPendingInvite, invite? }`
  - respond: `{ ok, decision, groupId }`
- **Error cases**: bad/expired token, unauthorized, non-member operations, send failures.
- **Current frontend consumers**: `GroupCreator.jsx`, `GroupInfo.jsx`, `Main.jsx`.
- **Lifecycle**:
  - **Must-preserve**: token invite + pending/response flows yes.
  - **Can-change**: email route can be moved behind queue/provider abstraction.
  - **Can-deprecate**: email send test/dev route behavior.
- **Proposed Next.js replacement path**:
  - `POST /api/groups/invite`
  - `GET /api/group-invite/pending`
  - `POST /api/group-invite/respond`
  - retain compatibility aliases for existing frontend.

### 14) `GET /group/respond-invitation` + pending invite persistence behavior
- **Purpose**: handle invite-link click, verify token, persist pending invite across auth redirect.
- **Auth requirement**: public route that then requires auth to complete acceptance.
- **Request/query shape**: query `q=<signed token>`.
- **Response shape**: redirects to login or home.
- **Error cases**: invalid token.
- **Current frontend consumers**: browser entrypoint via shared invite URL.
- **Lifecycle**:
  - **Must-preserve**: behavior yes.
  - **Can-change**: storage mechanism (cookie/session) in serverless implementation.
  - **Can-deprecate**: none until replacement proven.
- **Proposed Next.js replacement path**: `GET /group/respond-invitation` compatibility route or `/api/invites/respond` + UI redirect handler.

### 15) Petition APIs
- **Current routes**:
  - `GET /api/groups/:groupId/petitions/preflight`
  - `POST /api/groups/:groupId/petitions`
  - `GET /api/groups/:groupId/petitions`
  - `GET /api/petitions`
  - `POST /api/petitions/:petitionId/respond`
  - `DELETE /api/petitions/:petitionId`
  - compatibility alias: `POST /api/add-petition`
- **Purpose**: Petition lifecycle + user responses + traceable error envelopes.
- **Auth requirement**: required; group membership required for group-scoped routes.
- **Request/query shape**:
  - create: `{ title, start, end, blocking_level }`
  - respond: `{ response: ACCEPT|DECLINE }`
- **Response shape**:
  - petition object includes counts/status/current-user fields + `is_creator`.
  - classified error payload often includes `{ error, traceId, code? }`.
- **Error cases**: invalid groupId, unauthorized/forbidden, schema missing (503), validation errors.
- **Current frontend consumers**: `EventSidebar.jsx`, `CustomCalendar.jsx`, `PetitionActionModal.jsx`.
- **Lifecycle**:
  - **Must-preserve**: all main petition routes + status semantics.
  - **Can-change**: drop legacy alias once callers migrated.
  - **Can-deprecate**: `POST /api/add-petition` after parity cutover.
- **Proposed Next.js replacement path**: keep same paths in `/api/...` route handlers initially.

### 16) `GET /api/groups/:groupId/availability`
- **Purpose**: server-side group availability over a window with strict/flexible/lenient view support.
- **Auth requirement**: required + membership check.
- **Request/query shape**: `windowStartMs`, `windowEndMs`, optional `granularityMinutes`.
- **Response shape**:
  - `{ ok: true, groupId, windowStartMs, windowEndMs, availability, blocks }`
  - each block includes `start`, `end`, strict `count` fields + `views.{StrictView,FlexibleView,LenientView}`.
- **Error cases**: unauthorized (401), forbidden (403), invalid input (400), group empty/not found semantics.
- **Current frontend consumers**: `CustomCalendar.jsx`.
- **Lifecycle**:
  - **Must-preserve**: yes.
  - **Can-change**: keep both `availability` and `blocks` only during transition.
  - **Can-deprecate**: temporary duplicate field once frontend fully switched.
- **Proposed Next.js replacement path**: `GET /api/groups/[groupId]/availability`.

### 17) `POST /logout`
- **Purpose**: clear authenticated session.
- **Auth requirement**: authenticated session expected.
- **Request/query shape**: none.
- **Response shape**: `{ success: true }` or error.
- **Error cases**: session destroy failure (500).
- **Current frontend consumers**: `Main.jsx`.
- **Lifecycle**:
  - **Must-preserve**: yes (user-facing behavior).
  - **Can-change**: implementation tied to auth library.
  - **Can-deprecate**: no.
- **Proposed Next.js replacement path**: `POST /logout` compatibility endpoint mapped to auth sign-out.

## Explicitly Non-Parity / Operational Routes
- `GET /health`, `GET /api/test-db`, `GET /test-session`, `GET /api/email-send-test`.
- Recommendation: keep only `health` equivalent in target stack; others can be dev-only or removed.

## Underspecified or Inconsistent Contracts to Freeze Before Coding
- `POST /api/create-username` returns typo key `sucesss` in one validation branch; frontend currently tolerates loosely. Decide canonical error envelope.
- Event ownership/auth guards are inconsistent across some event mutation routes; preserve externally visible behavior for parity, then harden in explicit post-parity task.
- Group routes use non-REST path conventions (`/group/*`, `/user/groups`) while petitions use `/api/*`; keep compatibility first, normalize later.
