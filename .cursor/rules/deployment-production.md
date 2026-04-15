# Social Scheduler Production Deployment Rules

You are assisting on Social Scheduler as a production deployment engineer with security responsibilities.

## Purpose

Keep deployments repeatable, auditable, and safe for a live OAuth-enabled app.
Prevent regressions caused by environment drift, path drift, and inconsistent runtime assumptions.

## Canonical production runtime contract

Assume the following unless explicitly updated in repo:

* app host: Linux VPS with NGINX + PM2 + PostgreSQL
* backend process: `social-scheduler-backend` under PM2
* repository path: `/var/www/comp-net-security-S26`
* backend env file: `backend/.env.production`
* frontend build output: `frontend/dist` (Vite)
* primary API proxy prefix: `/api/`

If runtime differs, do not guess; report mismatch and update docs/rules before broad changes.

## Non-negotiable deployment rules

### 1) API prefix integrity

All backend data endpoints must be exposed as `/api/*`.
Do not introduce unprefixed backend JSON routes that conflict with SPA fallback behavior.

### 2) Static path consistency

Express static and fallback references must align with Vite output:

* use `frontend/dist`
* do not reintroduce `frontend/build` paths

### 3) Environment loading and process restart

Production deploys must load `.env.production` before restart and use PM2 env refresh.

Expected pattern:

* load env
* `pm2 startOrRestart ... --env production --update-env`
* persist process list with `pm2 save`

### 4) Secrets handling

Never commit secrets, tokens, or credentials.
Do not print secret values in logs, diagnostics, or command output summaries.
If a secret is exposed during troubleshooting, rotate it and note the rotation requirement.

### 5) Safe defaults for security headers/config

Avoid insecure placeholders in production configurations:

* no permissive wildcard CORS in production
* no missing secure cookie flags in production
* no unbounded debug endpoints exposed publicly

## Required post-deploy smoke checks

After any production-impacting change, verify:

1. process health:
   * `pm2 status` shows backend online and stable restarts
2. backend local health:
   * `GET http://127.0.0.1:3000/health` returns JSON healthy response
3. public API proxy behavior:
   * `GET https://<host>/api/me` returns JSON response (expected auth state is acceptable)
4. OAuth redirect generation:
   * `/auth/google` Location header has expected `client_id` and `redirect_uri`
5. frontend build artifact path:
   * `frontend/dist/index.html` exists on host after deploy

## Incident playbook triggers

### If API returns HTML instead of JSON

Likely causes:

* frontend calling non-`/api` endpoint
* NGINX SPA fallback catching endpoint
* route path drift between frontend and backend

Actions:

* inspect requested path
* verify backend route prefix
* verify NGINX `/api` proxy block

### If 502 appears while PM2 looks online

Likely causes:

* process restart race
* backend boot error after quick restart
* upstream port mismatch

Actions:

* check `pm2 logs`
* check local `127.0.0.1:3000/health`
* verify NGINX upstream target

### If OAuth starts failing after deploy

Actions:

* verify PM2 env values loaded from `.env.production`
* inspect `/auth/google` Location for client/redirect correctness
* verify Google Cloud redirect/origin entries

## Change management expectations

For deployment-significant changes:

* keep edits small and reversible
* include rollback note in PR/summary
* include exact files changed and why
* separate infra config commits from feature logic commits where practical

## Definition of done for production-facing changes

A change is not done unless:

* relevant lint/tests/build checks are run or explicitly blocked
* deploy path is validated in a realistic environment
* smoke checks pass
* known residual risks are documented
