# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Social Scheduler** — a web app that lets users share Google Calendar availability within groups and negotiate meeting times via "petitions." Live at `socialscheduler.me`.

Stack: React (Vite) frontend + Node.js/Express backend + PostgreSQL. Production runtime: Linux VPS with NGINX reverse proxy, PM2 process manager.

---

## Commands

### Backend (run from `backend/`)

```bash
npm run dev           # Start with nodemon (development, uses .env.development)
npm start             # Start without hot-reload (uses NODE_ENV to pick env file)
npm run start:prod    # NODE_ENV=production node server.js
npm test              # Jest tests (jest.config.cjs)
npm run test:watch    # Jest in watch mode
npm run test:ci       # Jest --runInBand --ci (for pipelines)
npm run test:algorithm  # Run algorithm sub-package tests
npm run typecheck     # TypeScript check (no emit)
npm run build         # Install frontend deps and run vite build
```

### Frontend (run from `frontend/`)

```bash
npm run dev           # Vite dev server (proxies API to localhost:3000)
npm run build         # Vite production build → frontend/dist/
npm run preview       # Serve the production build locally
npm run test:vitest   # Vitest unit tests
npm run typecheck     # TypeScript check (no emit)
```

### Production (PM2)

```bash
npm run pm2:start     # pm2 start ecosystem.config.cjs --env production
npm run pm2:reload    # Zero-downtime reload
npm run pm2:logs      # Stream logs
```

Health check: `GET http://127.0.0.1:3000/health`

---

## Architecture

### Request flow

```
Browser → NGINX (HTTPS) → /api/* → Express (port 3000)
                        → /auth/* → Express
                        → /*      → Express serves frontend/dist/index.html (SPA fallback)
```

Frontend dev server (`vite`) proxies all requests to `http://localhost:3000` (set in `frontend/package.json`).

### Backend module map

| File/Dir | Role |
|---|---|
| `server.js` | Entry point. Registers all middleware, session config, Google OAuth handlers (`/auth/google`, `/oauth2callback`), and inline API routes. Also mounts group routes and availability controller. |
| `db/dbInterface.js` | Thin wrapper around `pg` pool. All SQL lives here. |
| `groups.js` | Group CRUD and membership logic, mounted as `groupModule(app)` in server.js. |
| `routes/petition_routes.js` | Petition creation/response routes, mounted under `/api/`. |
| `routes/group_routes.js` | Group-specific sub-routes. |
| `routes/invite_routes.js` | Invite token generation and redemption. |
| `availability_controller.js` | Handles `GET /api/groups/:groupId/availability`; delegates to the algorithm. |
| `algorithm/` | Standalone scheduling algorithm sub-package (own `package.json`/tests). Entry via `algorithm_adapter.js`. |
| `event_management/` | MVC-style module (model/view/controller) for event CRUD logic. |
| `calendar_event_normalizer.js` | Pure function that normalizes raw Google Calendar event objects to the internal shape the frontend expects. |
| `emailer.js` | Sends transactional email via Resend. |
| `inviteToken.js` | Generates and validates invite tokens. |
| `services/` | Shared service helpers. |

### Session & Auth

- Sessions are persisted in Postgres via `connect-pg-simple` (table: `session`).
- `req.session.userId` and `req.session.isAuthenticated` are the auth signals throughout.
- `ensureValidToken(req, res)` in server.js refreshes the Google OAuth access token when it is within 5 minutes of expiry, reading/writing tokens from `db.users`.

### Frontend structure (`frontend/src/`)

| File/Dir | Role |
|---|---|
| `vite-main.jsx` | Vite entry point. |
| `App.jsx` | Root component, React Router setup. |
| `Main.jsx` | Main authenticated layout. |
| `Login.jsx` | Unauthenticated landing/login page. |
| `UsernameCreation.jsx` | Onboarding step after first OAuth login. |
| `api.js` / `api.ts` | All `fetch()` calls to the backend; import these instead of calling `fetch` directly. |
| `components/` | Shared UI components. |
| `pages/` | Error pages (Forbidden, NotAuthenticated, NotFound, ServerError). |
| `tests/` | Vitest unit tests. |

### Database tables (key ones)

`users`, `calendar`, `cal_event`, `groups`, `group_members`, `petitions`, `petition_responses`, `session`

---

## Environment Variables

Backend reads either `backend/.env.development` or `backend/.env.production` depending on `NODE_ENV`.

Required variables:
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI        # Must exactly match the Google Cloud Console entry
SESSION_SECRET
PORT
DATABASE_URL               # or individual DB_* vars
FRONTEND_URL               # Required in production
BACKEND_URL
RESEND_API_KEY
```

---

## OAuth Security Rules (non-negotiable)

These rules apply to any code touching auth, tokens, or Google API:

- **Approved scopes only**: `calendar.readonly`, `userinfo.email`, `userinfo.profile`. No wildcards.
- **State parameter**: CSRF state must be generated per-request, stored in session, verified on callback, and cleared after. The state check in `server.js` is currently **commented out** — do not leave it disabled.
- **Tokens at rest**: refresh tokens must be encrypted (AES-256-GCM) before DB writes. Currently stored plaintext (marked with `TODO: encrypt this` in server.js) — this is a known gap.
- **Never log** client secret, access tokens, refresh tokens, or raw authorization codes.
- **Session cookies**: `HttpOnly`, `Secure` in production, `SameSite=Lax`.
- **Redirect URI**: runtime `GOOGLE_REDIRECT_URI` must exactly match the Google Cloud Console entry.

---

## Production Deployment Rules

- All backend API routes must be under `/api/*`.
- Frontend build output is `frontend/dist` (not `frontend/build`).
- Production env is loaded from `backend/.env.production`; use `pm2 --update-env` on restarts.
- No wildcard CORS in production.
- After any production change, run smoke checks: `pm2 status`, `GET /health`, `GET /api/me`, inspect `/auth/google` redirect.

### Incident quick-reference

| Symptom | Likely cause |
|---|---|
| API returns HTML | Route missing `/api/` prefix or NGINX SPA fallback catching it |
| 502 while PM2 is online | Process restart race; check `pm2 logs` and `127.0.0.1:3000/health` |
| OAuth `redirect_uri_mismatch` | `GOOGLE_REDIRECT_URI` env value doesn't exactly match Google Cloud Console |
| OAuth `invalid_grant` on refresh | Refresh token expired; user must re-authenticate |
