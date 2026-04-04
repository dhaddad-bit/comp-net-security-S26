# Social Scheduler Current-State Audit

## Purpose
This document separates:
- **Current repo truth** (what code and tests currently show)
- **Legacy doc claims** (useful intent, sometimes outdated)
- **Required feature parity** (must survive migration)

The migration source of truth is **repo behavior**, not old hosting/deployment assumptions.

## Current Repo Truth

### Architecture and runtime
- Split app: `frontend` (Create React App, JavaScript) + `backend` (Node/Express, JavaScript).
- Stateful backend session model: `express-session` with Postgres-backed session table (`connect-pg-simple`).
- Backend serves built frontend and handles API + OAuth callback.
- PostgreSQL is required for users, calendars, events, groups, memberships, petitions, and petition responses.

### Authentication and onboarding behavior
- Google OAuth login flow exists (`/auth/google`, `/oauth2callback`) and persists user + tokens.
- App gates access by session and `/api/me`.
- New users are identified by placeholder username (`"New user!"`) and routed into onboarding.
- Onboarding requires username creation and at least one calendar selection.

### Calendar and scheduling behavior
- Google Calendar fetch + sync route exists (`/api/events`) with token refresh support.
- Local calendar cache route exists (`/api/get-events`) for rendering without forced external sync.
- Manual blocking events can be added (`/api/add-events`), deleted, and reprioritized.
- Availability endpoint exists (`/api/groups/:groupId/availability`) and computes strict/flexible/lenient views.
- Availability algorithm is separated from transport/persistence via service + adapter layers.

### Group, invite, and petition behavior
- Group CRUD-like flows exist: create, list my groups, view members, leave group.
- Invite links are tokenized and support pending-invite accept/decline flows.
- Invite emails exist via backend email integration.
- Petition endpoints exist and are active (preflight, create, list per group, list per user, respond, delete).
- Legacy petition compatibility route exists (`/api/add-petition`) to normalize old payload shapes.

### Test-backed behavior currently encoded
- App-level onboarding gating is tested (new user -> username flow; existing user -> main app).
- Group selection persistence behavior is tested across UI toggles.
- Availability mode switching and rendering semantics are tested.
- Event normalization for all-day and overnight behavior is tested on frontend + backend normalizer.

## Legacy Doc Claims (Useful but Not Source of Truth)

### Still useful
- Core product intent is stable: schedule with friends/groups while minimizing raw calendar sharing.
- Server-side availability aggregation is a deliberate requirement.
- Functional decomposition (auth, retrieval, availability, group coordination, petitions) is directionally valid.

### Conflicts with repo truth
- `docs/SDS.md` labels groups and petitions as MVP/Future gaps in places; repo currently contains working group + petition routes/UI flows.
- Legacy docs assume and describe a classic hosted server model (Express server + long-lived sessions).
- Older docs imply architecture-level choices (hosting/session coupling) that are implementation details, not enduring product requirements.

When conflicts appear, **repo behavior wins**.

## Required Feature Parity for Migration

The following are mandatory parity targets before any feature redesign:

1. **Auth and access**
   - Google OAuth sign-in.
   - Authenticated user identity endpoint (`me` equivalent).
   - Protected API boundaries.

2. **Onboarding**
   - Username creation with uniqueness/format validation.
   - Calendar selection as part of first-run setup.

3. **Calendar ingestion and rendering contract**
   - Pull selected calendars from Google.
   - Normalize all-day and overnight events consistently.
   - Support manual blocking events and priority levels.

4. **Groups and membership**
   - Create group, list groups, view members, leave group.
   - Invite flow via tokenized links (accept/decline).

5. **Availability**
   - Group-level availability endpoint.
   - Server-side computation with membership checks.
   - Strict/Flexible/Lenient view semantics.

6. **Petitions**
   - Create/list/respond/delete petitions with membership and creator checks.
   - Petition status model (`OPEN`, `FAILED`, `ACCEPTED_ALL`) preserved.

## Legacy Implementation Details to Retire (Not Product Requirements)
- Render-style always-on server assumptions.
- Session table dependence for web session continuity.
- Backend serving frontend build directly.
- Two-repo-in-one-project split as a required architecture.
- Environment model centered on single long-running Express process.

These are migration targets, not feature requirements.
