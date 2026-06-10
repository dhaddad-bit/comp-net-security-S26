# Social Scheduler

Share Google Calendar availability within groups and negotiate meeting times via "petitions."

**Live:** https://social-scheduler.me

The application's Google OAuth client is **verified**, so anyone with a Google account can sign in
directly — no tester allowlist required. To revoke the app's access at any time, go to your Google
Account → **Security → Third-party apps & services → Social Scheduler → Remove access**.

> Security engineering for this app (threat model, OAuth hardening, token encryption, audit
> logging) is documented in [`docs/threat-model.md`](docs/threat-model.md) and the CS 434/534
> final report under [`docs/report/`](docs/report/).

---

## Tech Stack

* **Frontend:** React + **Vite**
* **Backend:** Node.js + Express
* **Database:** PostgreSQL (sessions persisted via `connect-pg-simple`)
* **Production:** Linux VPS · NGINX reverse proxy (TLS via Let's Encrypt/Certbot) · PM2

---

## Prerequisites

1. [Node.js](https://nodejs.org/) (v18+ recommended)
2. [PostgreSQL](https://www.postgresql.org/download/) (local or hosted)
3. A Google Cloud OAuth 2.0 client (Web) with `calendar.readonly`, `userinfo.email`,
   `userinfo.profile` scopes.

---

## Local Setup

### 1. Install dependencies

```bash
cd backend  && npm install
cd ../frontend && npm install
```

### 2. Set up the database

Create a database, then apply the schema files in [`db/`](db/) (in order):

```bash
psql -d social_scheduler -f db/table_initialization.sql
psql -d social_scheduler -f db/group_support.sql
psql -d social_scheduler -f db/001_petitions_schema.sql
psql -d social_scheduler -f db/calendar_sync_meta.sql
# db/002_security_audit_log.sql is applied automatically at server boot (ensureAuditSchema)
```

### 3. Configure environment variables

The backend loads `backend/.env.development` or `backend/.env.production` depending on
`NODE_ENV`. Create `backend/.env.development` from this template:

```bash
# --- backend/.env.development ---
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=          # must exactly match the Google Cloud Console entry
SESSION_SECRET=
PORT=3000

# Database: either DATABASE_URL or the individual DB_* vars
DATABASE_URL=
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=
DB_NAME=
DB_SSL=disable               # disable (loopback) | require | verify-full
DB_CA_CERT=                  # path to CA bundle when DB_SSL enforces verification

# AES-256-GCM key for encrypting OAuth tokens at rest (32 bytes, hex or base64)
TOKEN_ENCRYPTION_KEY=

NODE_ENV=development
FRONTEND_URL=
BACKEND_URL=

RESEND_API_KEY=
```

> **Never commit secrets.** `TOKEN_ENCRYPTION_KEY` is required at boot — without it the server
> cannot encrypt/decrypt stored tokens.

### 4. Build the frontend and run

```bash
cd frontend && npm run build      # → frontend/dist
cd ../backend && npm run dev      # nodemon, http://localhost:3000
```

---

## Security

The app implements defense-in-depth controls; details and source pointers live in the
[threat model](docs/threat-model.md).

* **OAuth tokens encrypted at rest** with AES-256-GCM (`backend/services/token_crypto.js`),
  applied at the DB boundary. Migrate legacy plaintext rows with `npm run migrate:tokens`.
* **OAuth CSRF protection** — per-request `state` generated, stored in session, and verified on
  the callback.
* **Security audit log** — `security_audit_log` table records auth/authorization events with no
  token or secret material (`backend/services/audit_log.js`).
* **Session hardening** — `HttpOnly` + `SameSite=Lax` + `Secure` (prod) cookies; server-side
  Postgres session store.
* **`helmet`** security headers (incl. CSP) and **`express-rate-limit`** on `/api/*` and
  `/auth/*`.
* **Parameterized SQL** throughout; **least-privilege** read-only Google scopes.

---

## Useful commands

| Where | Command | Purpose |
|---|---|---|
| backend | `npm run dev` | Dev server (nodemon) |
| backend | `npm run start:prod` | Production start (`NODE_ENV=production`) |
| backend | `npm test` | Jest tests |
| backend | `npm run typecheck` | TypeScript check |
| backend | `npm run migrate:tokens` | Encrypt legacy plaintext tokens |
| backend | `npm run pm2:start` / `pm2:reload` | PM2 process management |
| frontend | `npm run dev` | Vite dev server |
| frontend | `npm run build` | Production build → `frontend/dist` |
| frontend | `npm run test:vitest` | Vitest unit tests |

**Health check:** `GET http://127.0.0.1:3000/health`
