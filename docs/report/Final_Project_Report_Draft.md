# Securing a Real, Deployed Web Application: A Security Engineering Case Study of *Social Scheduler*

**CS 434/534 — Computer and Network Security II**
**Final Project Report**
**Date: June 2026**

> **Draft note (for the author):** This is a first draft sized to roughly 5–7 double-spaced
> pages at 12-point font. Bracketed `[SCREENSHOT: …]` and `[FIGURE: …]` markers indicate
> where to drop images/diagrams before final submission. Replace the team/author block below.

**Author / Team:** _[your name + teammates]_
**Live deployment:** `https://social-scheduler.me`

---

## 1. Why I Chose This Area

Most coursework in security treats vulnerabilities as isolated puzzles: here is a SQL
injection, here is a CSRF token, find it and patch it. What I wanted from this project was the
opposite experience — to take a *real, already-running, internet-facing application* that I had a
genuine stake in, and ask the uncomfortable question every production system eventually faces:
**if an attacker came at this today, where would it break?**

I chose to do my security work on **Social Scheduler**, a web application that lets users share
their Google Calendar availability within groups and negotiate meeting times through a feature we
call "petitions." The app is publicly reachable at `social-scheduler.me`, runs on a Linux VPS
behind NGINX, and — critically for a security course — it handles two categories of data that
make it a meaningful target:

1. **Google OAuth tokens.** The app holds long-lived *refresh tokens* that grant offline access
   to users' Google Calendars. A refresh token is not just a password; it is a persistent key to
   someone's schedule that survives logout. Compromising it is account takeover with a long tail.
2. **Personal scheduling data and a social graph.** Calendar event times, group membership, and
   petition responses together reveal who a user knows, when they are free, and what they are
   committed to.

This combination is exactly what makes the project a good fit for *Computer and Network Security
II*. The interesting threats are not theoretical — they map directly onto the OWASP Top 10, the
STRIDE categories, and the vulnerability–threat–control paradigm we studied (Pfleeger Ch. 1). I
also chose it because securing a system you built yourself is humbling in a productive way: every
gap in the threat model is a gap *I* left, and every control is one I had to actually wire into
running code without breaking the live site.

---

## 2. Scope of the Project

The scope of this project is **the security posture of Social Scheduler**, not the development of
its features. The features already existed; my work was to threat-model the system, identify where
it was exposed, implement controls, and document the residual risk honestly.

### 2.1 What the application does (brief)

Social Scheduler is a single-page React (Vite) frontend backed by a Node.js/Express API and a
PostgreSQL database. Users authenticate with Google, the app reads their calendar availability
(read-only scope), and groups of users coordinate meeting times. The production request path is:

```
Browser ──HTTPS──► NGINX ──► Express (port 3000) ──► PostgreSQL (localhost)
                                  │
                                  ├──► Google OAuth 2.0 / Calendar API
                                  └──► Resend (transactional email)
```

### 2.2 What was *in scope* for the security work

- **Threat modeling** the full system using the vulnerability–threat–control paradigm, organized
  with STRIDE, with explicit trust boundaries, asset ranking, and attacker profiles.
- **Authentication & OAuth hardening** — the highest-value attack surface.
- **Session security** — cookie flags, session storage, fixation resistance.
- **Injection and access-control defenses** — parameterized queries, group-membership
  authorization, removal of unauthenticated/debug endpoints.
- **Availability / abuse resistance** — rate limiting and security headers.
- **Honest documentation of residual gaps** with a remediation timeline.

### 2.3 What was explicitly *out of scope*

- A formal third-party penetration test or automated DAST sweep.
- Encryption of *all* data at rest (focused only on the high-value token gap).
- Compliance certification (SOC 2, etc.) — not relevant at this stage.
- The scheduling algorithm's correctness (a separate sub-package with its own tests).

### 2.4 Methodology

I followed a four-step loop drawn from the course: **(1)** enumerate assets and trust boundaries;
**(2)** identify threats per boundary using STRIDE; **(3)** rate each threat by likelihood ×
impact; **(4)** map controls to threats and re-rate the residual risk. The deliverable artifacts
are a written **threat model** (`docs/threat-model.md`) and the **implemented controls** in the
codebase, cross-referenced below.

---

## 3. Threat Model and Demonstration

This section is the technical core. It shows the architecture, the trust boundaries, the threats I
found, and the concrete controls I implemented — with pointers to source.

### 3.1 Trust boundaries

[FIGURE 1: Trust-boundary diagram — paste the ASCII/architecture diagram from docs/threat-model.md
or a redrawn version.]

The system has five trust boundaries. The two that carry the most risk are **TB1** (public
internet → NGINX), which is the only externally exposed surface and is defended by TLS and rate
limiting, and **TB4** (Express → Google OAuth/Calendar), which is where the high-value tokens live
and flow. TB2 and TB3 (Express ↔ PostgreSQL, both localhost-only) are lower risk because they are
not reachable from the public internet.

| Boundary | Direction | Risk | Primary Control |
|---|---|---|---|
| TB1 Internet → NGINX | Inbound | **HIGH** | TLS termination, rate limiting |
| TB2 NGINX → Express | Internal | LOW | Localhost only |
| TB3 Express → PostgreSQL | Internal | MEDIUM | Localhost socket |
| TB4 Express → Google API | Outbound | MEDIUM | Tokens in DB (see gap I-1) |
| TB5 Express → Resend | Outbound | LOW | API key only; no user data |

### 3.2 Highest-value assets

Assets were ranked by CIA priority. The top of the list is dominated by credentials:

- **Google OAuth refresh tokens** (Confidentiality ≫ Integrity > Availability): compromise =
  *persistent* account takeover.
- **OAuth access tokens** (short-lived, 1 hr): Calendar API access.
- **Session tokens** (Postgres `session` table + browser cookie): theft = session hijack.
- **`SESSION_SECRET` and `GOOGLE_CLIENT_SECRET`** env vars: signing key and app identity.
- **User calendar data, email addresses, and group membership**: PII and social graph.

### 3.3 Threats found (STRIDE summary)

The full STRIDE table lives in the threat model; the summary risk matrix below shows the threats
that mattered and their disposition after my work:

| ID | Threat | Likelihood | Impact | Status |
|---|---|---|---|---|
| **S-1** | CSRF on OAuth callback (forged login flow) | MEDIUM | HIGH | **Fixed** |
| **I-1** | Plaintext OAuth tokens at rest (DB breach exposes all) | MEDIUM | CRITICAL | **Fixed** (AES-256-GCM at rest) |
| **E-3** | Refresh-token theft → persistent access after logout | MEDIUM | CRITICAL | Mitigated (tokens encrypted at rest) |
| **I-2** | User enumeration via `/api/users/search` | LOW | MEDIUM | **Fixed** |
| **I-3** | Session contents leaked via debug endpoint | LOW | HIGH | **Fixed** |
| **D-1** | Brute-force login exhausts session store | MEDIUM | MEDIUM | **Fixed** |
| **T-1** | SQL injection | LOW | CRITICAL | Mitigated (parameterized) |
| **E-1** | Cross-group petition access | LOW | HIGH | Mitigated (membership check) |
| **I-5** | DB SSL cert validation disabled | LOW | MEDIUM | **Fixed** (no insecure flag; loopback) |
| **R-1/R-2** | No security audit trail (non-repudiation) | LOW | MEDIUM | **Fixed** (`security_audit_log`) |

[SCREENSHOT: optionally include the summary risk matrix as a rendered table image.]

### 3.4 Controls implemented (the demo)

The following controls were implemented and are live. Each is cross-referenced to source so the
work is auditable.

**OAuth CSRF protection (fixes S-1).** The OAuth `state` parameter is now generated per request,
stored in the session, and verified on the `/oauth2callback` route before the authorization code
is exchanged — then cleared. This had been commented out, leaving the login flow forgeable; it is
the single most important fix. The session is also explicitly saved *before* the redirect to
Google so the state survives the round trip.
*Source: `server.js` — `/auth/google` and `/oauth2callback`.*

[SCREENSHOT: the OAuth consent screen + a before/after of the state check in code.]

**Hardened session cookies (fixes/mitigates S-1, S-3).** Session cookies are `HttpOnly`,
`SameSite=Lax`, and `Secure` in production. Sessions are persisted server-side in PostgreSQL via
`connect-pg-simple`, so the cookie carries only an opaque ID — there is no sensitive state in the
browser to steal or tamper with. *Source: `server.js` session config.*

**Injection defense (mitigates T-1).** All SQL is funneled through a single thin data-access layer
and uses parameterized queries exclusively — there is no string concatenation of user input into
SQL anywhere in the app. *Source: `db/dbInterface.js`.*

**Authorization / access control (mitigates E-1, T-2).** Petition and group operations verify
group membership before acting, so an authenticated user cannot read or respond to another group's
petitions. *Source: `routes/petition_routes.js`.*

**Attack-surface reduction (fixes I-2, I-3).** The previously *unauthenticated* user-search
endpoint now requires a valid session, closing a user-enumeration hole, and debug endpoints that
exposed session contents were removed entirely. *Source: `server.js`.*

**Abuse resistance (fixes D-1).** Rate limiting was added to `/api/*` and `/auth/*` to blunt
brute-force and flooding attempts, and `helmet.js` sets standard browser-protection security
headers (mitigating browser-side XSS classes and reducing info leakage). *Source: `server.js`.*

**Signed invite tokens (supports E-2).** Group invite links are HMAC-signed and validated with a
timing-safe comparison, so invite tokens cannot be forged or guessed.
*Source: `inviteToken.js`.*

**OAuth tokens encrypted at rest (fixes I-1, mitigates E-3).** Refresh and access tokens are
encrypted with AES-256-GCM before any database write and decrypted only at the data-access
boundary, using a 32-byte key (`TOKEN_ENCRYPTION_KEY`) held in the environment, outside the
database. A database dump alone therefore yields ciphertext, not usable Google credentials. Each
value is sealed in a versioned envelope (`v1:<iv>:<tag>:<ciphertext>`) with a per-value random IV
and an authentication tag, so tampering is detectable. A one-time, idempotent migration
(`npm run migrate:tokens`) upgrades any pre-existing plaintext rows.
*Source: `services/token_crypto.js`, `db/dbInterface.js`, `scripts/reencrypt_tokens.js`.*

**Safe database TLS (fixes I-5).** The production connection no longer disables certificate
validation (`rejectUnauthorized: false` was removed). PostgreSQL runs on the same host over the
loopback interface, so TLS is unnecessary and is disabled cleanly; if the database is ever moved
off-host, `DB_SSL=verify-full` plus a pinned CA (`DB_CA_CERT`) enforces a verified certificate —
validation is never silently disabled. *Source: `db/dbInterface.js` (`buildSslConfig`).*

**Structured security audit logging (fixes R-1, R-2).** Authentication, token, and authorization
events — login success/failure, CSRF state mismatch, token refresh success/failure, logout, and
auth/permission denials — are recorded to a dedicated `security_audit_log` table with actor, IP,
user-agent, outcome, and structured (secret-free) detail. Writes are fire-and-forget so logging
can never break a request, and the table carries no foreign key to users so the trail survives
account deletion. This provides non-repudiation and an incident-investigation trail.
*Source: `services/audit_log.js`, `db/002_security_audit_log.sql`, `db/dbInterface.js`.*

**Least-privilege OAuth scopes.** The app requests only `calendar.readonly`,
`userinfo.email`, and `userinfo.profile` — no write access to calendars, no wildcards. This caps
the blast radius of any token compromise to *read-only* calendar access.

[SCREENSHOT: app UI — login page, group availability view, and a petition — to show the live,
functioning system the controls protect. See `frontend/src/Login.jsx`, `Main.jsx`.]

### 3.5 Honest residual risk

A credible security report names what is *not* yet fixed. The previously dominant gap — **I-1 /
E-3: OAuth tokens stored in plaintext** — has since been closed: tokens are now AES-256-GCM
encrypted at rest, so a database dump alone no longer yields usable credentials. The two secondary
open items have likewise been addressed: the insecure DB SSL flag was removed (`I-5`), and a
structured `security_audit_log` now records auth, token, and authorization events (`R-1`, `R-2`).

The remaining residual risk is narrower. Refresh tokens, though encrypted at rest, are still
**long-lived and not rotated** (`E-3`, partial): a token exfiltrated from a *running* process
(not from a database dump) would remain valid until Google expires it. Refresh-token rotation
(§4) is the next step. Audit logs are also written to the application database rather than a
separate, append-only sink, so an attacker with full DB write access could in principle tamper
with the trail — shipping logs off-host is a future hardening item.

---

## 4. Future Considerations

The threat model doubles as a remediation roadmap. In priority order:

1. ~~**Encrypt OAuth tokens at rest (AES-256-GCM).**~~ **Done** — refresh and access tokens are
   now encrypted with an environment-held key before any DB write, so a database dump alone no
   longer yields usable credentials (closes I-1, mitigates E-3).
2. **Refresh-token rotation.** Rotate the refresh token on each use and invalidate the prior one,
   so a stolen token has a much shorter useful life and reuse is detectable (E-3). *Now the
   highest-priority open item, since at-rest encryption is in place.*
3. ~~**Re-enable strict DB SSL.**~~ **Done** — the `rejectUnauthorized: false` flag was removed;
   the loopback connection needs no TLS, and an off-host move enforces `verify-full` with a
   pinned CA via `DB_SSL`/`DB_CA_CERT` (closes I-5).
4. ~~**Structured security audit logging.**~~ **Done** — auth, token, and authorization events
   are recorded to `security_audit_log` for non-repudiation and incident investigation (R-1, R-2).
   Next: ship logs to a separate append-only sink so the trail is tamper-resistant.
5. **Input sanitization for user-supplied event/group names** to fully close stored-XSS classes,
   layered on top of the existing `helmet` headers.
6. **Automated security testing in CI** — dependency scanning (the project already cleared a
   `uuid` CVE via `npm audit`) plus a lightweight DAST pass on each deploy, so regressions like
   the once-disabled OAuth state check are caught automatically rather than by manual review.

**Longer-term:** a formal third-party penetration test before any broad public launch, and
completing Google's OAuth verification process so the app can move out of "tester-only" mode.

---

## 5. Conclusion

The value of this project was treating security as a property of a *running system* rather than a
checklist. Working from a structured threat model, I closed the most dangerous reachable gaps —
the forgeable OAuth flow (S-1), the unauthenticated enumeration and debug endpoints (I-2, I-3),
and brute-force exposure (D-1) — and then closed the highest-impact data-at-rest gap by
encrypting OAuth tokens (I-1, E-3), removing the insecure DB TLS flag (I-5), and adding a
structured audit trail (R-1, R-2), while being explicit about the narrower residual risk that
remains (long-lived, un-rotated refresh tokens) and exactly how it will be closed. The result is a
defensible, documented, and honest security posture for a real application, and a workflow —
model, mitigate, re-rate, record — that I would now apply to any system before trusting it with
someone's data.

---

### Appendix A — Source Cross-Reference

| Control | Source |
|---|---|
| OAuth CSRF state | `server.js` (`/auth/google`, `/oauth2callback`) |
| Session cookie flags / store | `server.js`; `connect-pg-simple` (`session` table) |
| Parameterized SQL | `db/dbInterface.js` |
| Group-membership authorization | `routes/petition_routes.js` |
| Rate limiting + security headers | `server.js` (`helmet`) |
| HMAC invite tokens | `inviteToken.js` |
| Token refresh logic | `server.js` (`ensureValidToken`) |
| OAuth tokens encrypted at rest (AES-256-GCM) | `services/token_crypto.js`; `db/dbInterface.js`; `scripts/reencrypt_tokens.js` |
| Safe DB TLS (`buildSslConfig`) | `db/dbInterface.js` |
| Security audit logging | `services/audit_log.js`; `db/002_security_audit_log.sql`; `db/dbInterface.js` |
| Full threat model | `docs/threat-model.md` |
