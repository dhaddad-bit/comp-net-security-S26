# Target Architecture (Free-Tier Serverless)

## Goals
- Preserve current core behavior first.
- Move to low-cost/free-tier friendly hosting.
- Reduce operational burden and improve maintainability.
- Enable clean Cursor-driven iterative development.

## Proposed Topology
- **Single repo Next.js + TypeScript app** (App Router preferred).
- **Serverless API routes / server actions** for backend endpoints.
- **Managed free-tier Postgres** for persistent data.
- **OAuth + session/JWT via auth library** compatible with serverless (database-backed session optional).
- **External Google Calendar API integration** from server-side functions.

## Frontend
- Next.js UI replaces CRA frontend.
- Route groups:
  - Public: login, auth callbacks, error pages.
  - Authenticated: calendar, groups, petition flows, onboarding.
- Use shared typed API client utilities for browser-to-server calls.
- Keep current UX contracts stable during migration (group selection persistence, onboarding gating, petition/availability views).

## Backend/API
- Replace Express routes with Next.js route handlers (`app/api/...`).
- Route parity targets:
  - Auth/user: `me`, username creation, logout-equivalent behavior.
  - Calendar: calendar list, sync events, get local events.
  - Groups: create/list/detail/leave.
  - Invites: create token, pending invite, respond.
  - Petitions: preflight/create/list/respond/delete.
  - Availability: group availability query by time window.
- Keep request validation explicit and centralized (schema validation layer).
- Keep API error shape stable enough to minimize frontend rewrites in early phases.

## Auth
- Keep Google OAuth provider.
- Replace Express session middleware with serverless-compatible auth strategy:
  - Recommended: NextAuth/Auth.js with database adapter (or signed JWT sessions where appropriate).
- Persist user profile and OAuth refresh/access tokens in DB with rotation/refresh logic.
- Maintain protected-route semantics equivalent to current session checks.

## Database
- Use managed free-tier Postgres (e.g., Neon/Supabase Postgres).
- Keep relational model for:
  - users/person
  - calendars
  - calendar events
  - groups + memberships
  - petitions + responses
  - optional auth/session tables per auth strategy
- Introduce typed DB access (Prisma or lightweight typed SQL layer).
- Keep migrations first-class and repeatable.

## Calendar Integration
- Google Calendar access remains server-side only.
- Preserve selected-calendar model and event normalization behavior.
- Sync strategy on free tier:
  - User-triggered sync (existing behavior) remains primary.
  - Optional lightweight incremental sync metadata retained for future optimization.
- Handle token refresh and expired-grant recovery without requiring a persistent server process.

## Domain Logic
- Keep domain logic separate from UI and transport:
  - availability engine (pure computation)
  - petition state transitions
  - invite token lifecycle
  - event normalization
- Preserve explicit layering:
  - API handler -> service/domain -> repository/data access.
- Do not couple algorithm semantics to React component behavior.

## Deployment
- **Frontend + API**: Vercel free tier (or equivalent serverless platform).
- **Database**: free managed Postgres tier.
- **Environment/secrets**: platform-managed env vars.
- **Email**: keep current provider only if free-tier budget allows; otherwise defer or gate non-critical email sends.
- No requirement for always-on server instances.

## Free-Tier Constraints and Guardrails
- Favor on-demand compute over background daemons.
- Avoid heavy polling and long-running jobs.
- Keep payload sizes and DB round-trips controlled.
- Add simple observability:
  - request IDs
  - structured server logs
  - explicit error categories (auth, validation, external API, DB).

## Non-Goals (Initial Migration)
- No product redesign before parity.
- No algorithm rewrite unless needed for compatibility.
- No mandatory mobile/native client expansion.
