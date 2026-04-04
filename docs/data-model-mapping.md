# Data Model Mapping (Legacy -> Target)

## Mapping Rules
- Repo schema and query behavior are authoritative.
- Target model is serverless-friendly but parity-first.
- Do not remove fields/routes required by current frontend/tests until compatibility is proven.

## 1) Users / Profile / Auth Records
- **Current source-of-truth model**
  - `person` table: `user_id`, `google_id` (unique), `email`, names, `username`, `refresh_token`, `access_token`, `token_expiry`, timestamps.
  - Session auth currently uses Postgres `session` table via `connect-pg-simple`.
- **Target model**
  - Keep `person` as primary user identity/profile record.
  - Keep provider token fields or move to auth-account table depending on auth adapter choice.
  - Replace legacy express-session dependency with auth-library session strategy.
- **Migration notes**
  - Preserve `username` semantics used by onboarding gate.
  - Keep `google_id` uniqueness and lookup path.
  - Avoid exposing token fields in API responses after parity.
- **Unresolved decisions**
  - Token storage location: `person` vs dedicated `oauth_accounts` table.
  - Session mode: DB sessions vs JWT with revocation strategy.
- **Recommended constraints/indexes**
  - `UNIQUE (google_id)`.
  - Add/confirm `UNIQUE (username)` (repo logic assumes uniqueness check).
  - Index on `email` if lookup patterns expand.

## 2) Calendars / Selected Calendars
- **Current source-of-truth model**
  - `calendar` table stores selected calendars by user (`user_id`, `google_calendar_id`, `calendar_name`).
  - `db/group_support.sql` and `calendar_sync_meta.sql` indicate optional migration artifacts (`person_id`, sync metadata).
- **Target model**
  - `selected_calendars` (or retained `calendar`) keyed by user and provider calendar id.
  - Enforce one row per `(user_id, provider_calendar_id)`.
- **Migration notes**
  - Keep onboarding write path from selected Google calendars.
  - Preserve multi-calendar per user behavior.
- **Unresolved decisions**
  - Keep existing table name vs rename to provider-neutral naming.
  - Whether to persist provider metadata beyond display fields.
- **Recommended constraints/indexes**
  - `UNIQUE (user_id, google_calendar_id)`.
  - Index `calendar(user_id)`.

## 3) External Provider Events (Google-synced)
- **Current source-of-truth model**
  - Stored in `cal_event`, keyed by `gcal_event_id` (unique in schema-init).
  - Sync logic in `/api/events` compares provider set to local rows and performs add/update/delete.
  - Events are normalized through `calendar_event_normalizer`.
- **Target model**
  - Keep local snapshot table for provider events with source marker.
  - Preserve `gcal_event_id` identity and start/end/title/priority fields.
- **Migration notes**
  - Preserve all-day and overnight normalization behavior.
  - Preserve sync behavior that handles modified/deleted provider events.
- **Unresolved decisions**
  - Keep one combined events table vs split provider/manual events.
  - Add sync metadata per calendar in core schema now vs later.
- **Recommended constraints/indexes**
  - `UNIQUE (gcal_event_id)` or scoped unique `(calendar_id, gcal_event_id)` if needed.
  - Index `(calendar_id, event_start, event_end)` for range queries.

## 4) Manual Blocking Events
- **Current source-of-truth model**
  - Manual events written via `/api/add-events` into `cal_event` with synthetic ids like `manual-...`.
  - Priority uses numeric levels `1/2/3` mapped to B1/B2/B3 semantics downstream.
- **Target model**
  - Keep manual events in same event snapshot for parity.
  - Track source (`manual` vs `provider`) explicitly if table is refactored.
- **Migration notes**
  - Preserve per-event and title-bulk update/delete behavior expected by UI.
  - Preserve ownership semantics by user calendars.
- **Unresolved decisions**
  - Numeric priority storage vs direct enum (`B1/B2/B3`) storage.
  - Should manual event ids remain string prefixed or become UUIDs.
- **Recommended constraints/indexes**
  - Check constraint for priority domain (`1,2,3`) or enum equivalent.
  - Index by `(calendar_id, event_name)` for bulk title operations.

## 5) Groups / Memberships
- **Current source-of-truth model**
  - `f_group` + `group_match` join table.
  - Group creation currently adds creator membership transactionally.
  - Membership checks gate availability/invite/petition operations.
- **Target model**
  - Keep same normalized model: groups table + memberships join table.
- **Migration notes**
  - Preserve auto-delete behavior when last member leaves (current `leaveGroup` implementation).
  - Preserve membership authorization checks on group-scoped APIs.
- **Unresolved decisions**
  - Keep auto-delete-on-empty behavior or move to soft-delete.
  - Keep `f_group` naming or normalize to `groups`.
- **Recommended constraints/indexes**
  - `PRIMARY KEY (group_id, user_id)` on membership.
  - Index `group_match(user_id)` and `group_match(group_id)`.

## 6) Invites
- **Current source-of-truth model**
  - Invite links are stateless HMAC tokens (`inviteToken.js`) with payload `{ v, gid, exp }`.
  - Pending invite state currently persisted in session + signed cookie (`invite_state_service.js`).
  - No persistent invite table in DB.
- **Target model**
  - Keep stateless signed token model for free-tier simplicity.
  - Replace session+cookie implementation with serverless-compatible pending-invite continuity strategy.
- **Migration notes**
  - Preserve expiry and signature semantics.
  - Preserve “click invite while logged out, complete after login” behavior.
- **Unresolved decisions**
  - Pending invite continuation via temporary cookie only vs short-lived DB state record.
  - Whether to add invite audit table (not needed for parity).
- **Recommended constraints/indexes**
  - If DB invite state is introduced: index by `user_id`, `expires_at`.
  - Otherwise no new required DB indexes for parity.

## 7) Petitions / Responses
- **Current source-of-truth model**
  - `petitions` + `petition_responses`.
  - Status is derived dynamically from response counts and group size.
  - Creator gets auto-accepted response on creation.
  - Schema readiness checked at startup (`ensurePetitionSchema`).
- **Target model**
  - Keep same relational model and derived status semantics.
  - Keep response enum domain (`ACCEPTED`/`DECLINED`) and blocking level domain (`B1/B2/B3`).
- **Migration notes**
  - Preserve route-level `is_creator` decoration behavior for frontend controls.
  - Preserve preflight route semantics for petition schema/access checks.
- **Unresolved decisions**
  - Keep derived status only vs storing denormalized status for read performance.
  - Keep startup schema auto-ensure behavior in serverless (likely move to migration-time guarantees).
- **Recommended constraints/indexes**
  - Existing checks: blocking level and time-order.
  - Indexes on `petitions(group_id, start_time, end_time)`, `petition_responses(petition_id, response)`, `petition_responses(user_id)`.

## 8) Availability Inputs and Computation Boundaries
- **Current source-of-truth model**
  - Inputs come from:
    - group membership (`group_match`)
    - calendar events (`cal_event`)
    - accepted petition windows (`petitions` + `petition_responses`)
  - Adapter maps DB rows -> `ParticipantSnapshot[]`.
  - Algorithm module is pure and independent of DB/UI.
- **Target model**
  - Preserve the same domain boundary:
    - repository query layer
    - adapter mapping layer
    - pure availability algorithm module
- **Migration notes**
  - Preserve strict/flexible/lenient output contract and compatibility fields (`availability` + `blocks` during transition).
  - Preserve all-day adjustment behavior currently in adapter/normalizer path.
- **Unresolved decisions**
  - Whether to include cross-group accepted petition rows in selected group availability (current SQL intentionally does).
  - Naming mismatch in algorithm docs/comments vs frontend labels should be clarified but not behavior-changed in parity phase.
- **Recommended constraints/indexes**
  - Range-query friendly indexes on event and petition time columns.
  - Membership indexes to keep group participant expansion cheap.

## Cross-Cutting Migration Notes
- Use migration scripts as source-controlled artifacts; do not rely on server startup side effects for schema creation.
- Keep compatibility columns/fields until all frontend consumers move to canonical target contracts.
- Add explicit data ownership checks where currently implicit, but gate those hardenings behind parity confirmation to avoid accidental behavior regressions.
