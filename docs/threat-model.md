# Threat Model — Social Scheduler
**CS 434/534 Computer and Network Security II — Week 1 Deliverable**
**Framework:** Vulnerability–Threat–Control Paradigm (Pfleeger Ch. 1)
**Date:** 2026-04-14

---

## 1. System Description

Social Scheduler is a web application that allows authenticated users to share
Google Calendar availability within groups and negotiate meeting times via
"petitions." The application is deployed on a Linux VPS behind an NGINX reverse
proxy and is publicly accessible at `socialscheduler.me`.

---

## 2. Architecture Overview & Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│  INTERNET (untrusted)                                               │
│                                                                     │
│   [Browser / User Agent]  ──HTTPS──►  [NGINX reverse proxy]        │
│         │                                   │                       │
│         │                            /api/* │ /* (SPA fallback)     │
│         │                                   ▼                       │
│         │                        ┌─────────────────────┐           │
│         │                        │  Express (port 3000) │           │
│         │                        │  Node.js backend     │           │
│         │                        └──────────┬──────────┘           │
│         │                                   │                       │
│         │                    ┌──────────────┼──────────────┐        │
│         │                    ▼              ▼              ▼        │
│         │            [PostgreSQL]   [Google OAuth 2.0]  [Resend]   │
│         │            (localhost)    (external API)      (email)     │
│         │                                                           │
│         └──────── OAuth redirect ──► [Google Accounts] ────────────┘
│
└─────────────────────────────────────────────────────────────────────┘

Trust Boundary 1 (TB1): Public internet → NGINX
Trust Boundary 2 (TB2): NGINX → Express (localhost only, port 3000)
Trust Boundary 3 (TB3): Express → PostgreSQL (localhost socket)
Trust Boundary 4 (TB4): Express → Google OAuth / Calendar API (outbound HTTPS)
Trust Boundary 5 (TB5): Express → Resend email API (outbound HTTPS)
```

### Trust Boundary Notes

| Boundary | Direction | Risk Level | Control |
|---|---|---|---|
| TB1 | Inbound | HIGH | NGINX TLS termination, rate limiting |
| TB2 | Internal | LOW | Localhost only; not exposed externally |
| TB3 | Internal | MEDIUM | Localhost socket; SSL disabled in dev |
| TB4 | Outbound | MEDIUM | Google-managed; tokens stored in DB |
| TB5 | Outbound | LOW | API key only; no user data sent |

---

## 3. Asset Identification

Assets are ranked by confidentiality, integrity, and availability requirements.

### Primary Assets

| Asset | Location | CIA Priority | Description |
|---|---|---|---|
| Google OAuth refresh tokens | PostgreSQL `person` table | C > I > A | Long-lived credential granting offline calendar access; compromise = persistent account takeover |
| Google OAuth access tokens | PostgreSQL `person` table | C > I > A | Short-lived (1 hr) credential for Calendar API calls |
| User calendar event data | PostgreSQL `cal_event` table | C > I > A | Event titles, times, priorities — personal schedule data |
| Session tokens | PostgreSQL `session` table + browser cookie | C > I > A | Active login credential; theft = session hijack |
| `SESSION_SECRET` env var | VPS filesystem | C | Used to sign session cookies; exposure breaks all sessions |
| `GOOGLE_CLIENT_SECRET` env var | VPS filesystem | C | Compromise allows impersonation of the OAuth application |
| User email addresses | PostgreSQL `person` table | C | PII; used for invite emails |
| Group membership data | PostgreSQL `group_match` table | C > I | Reveals social graph of users |
| Petition / availability data | PostgreSQL `petitions` table | C > I | Reveals scheduling patterns and commitments |

### Secondary Assets

| Asset | Location | Description |
|---|---|---|
| `INVITE_LINK_SECRET` | VPS filesystem | HMAC signing key for invite tokens |
| `RESEND_API_KEY` | VPS filesystem | Transactional email API key |
| Application source code | Git repo | Architectural knowledge useful for targeted attacks |
| Database schema | PostgreSQL | Table structure aids SQL injection if exposed |

---

## 4. Threat Identification

Using the STRIDE model as an organizing framework:

### SPOOFING

| ID | Threat | Affected Asset | Likelihood | Impact |
|---|---|---|---|---|
| S-1 | CSRF attack on OAuth callback — attacker tricks user into completing a forged OAuth flow | Session, user account | MEDIUM (was unmitigated; now fixed) | HIGH |
| S-2 | Session fixation — attacker plants a known session ID before login | Session token | LOW (Postgres session store regenerates) | HIGH |
| S-3 | Stolen session cookie used from another device | Session token | MEDIUM | HIGH |

### TAMPERING

| ID | Threat | Affected Asset | Likelihood | Impact |
|---|---|---|---|---|
| T-1 | SQL injection via unsanitized query input | Database (all tables) | LOW (parameterized queries used throughout) | CRITICAL |
| T-2 | Petition response manipulation — user submits response for another user's petition | Petition data | LOW (group membership checked) | MEDIUM |
| T-3 | Calendar event priority tampered in transit | cal_event priority | LOW (HTTPS in production) | LOW |

### REPUDIATION

| ID | Threat | Affected Asset | Likelihood | Impact |
|---|---|---|---|---|
| R-1 | User denies sending a group invite | Invite log | MEDIUM (no audit log currently) | LOW |
| R-2 | User denies submitting a petition response | Petition response | MEDIUM (no audit log) | MEDIUM |

### INFORMATION DISCLOSURE

| ID | Threat | Affected Asset | Likelihood | Impact |
|---|---|---|---|---|
| I-1 | Plaintext OAuth token storage — DB breach exposes all tokens | refresh_token, access_token | MEDIUM (DB on localhost but unencrypted at rest) | CRITICAL |
| I-2 | User enumeration via `/api/users/search` | User email/username | LOW (now requires auth; was unauthenticated) | MEDIUM |
| I-3 | Session contents exposed via debug endpoint | Session, userId | LOW (endpoint now removed) | HIGH |
| I-4 | Server-side error messages leaking stack traces | Architecture details | MEDIUM (console.error used, not sent to client) | LOW |
| I-5 | SSL certificate validation disabled for DB connection | Tokens, all DB data | LOW (DB is localhost-only) | MEDIUM |

### DENIAL OF SERVICE

| ID | Threat | Affected Asset | Likelihood | Impact |
|---|---|---|---|---|
| D-1 | Brute-force login attempts exhaust session store | PostgreSQL, availability | MEDIUM (rate limiting now applied) | MEDIUM |
| D-2 | Large payload flooding `/api/add-events` | Server memory | LOW | MEDIUM |
| D-3 | Google Calendar API quota exhaustion via authenticated users | Calendar sync | LOW | MEDIUM |

### ELEVATION OF PRIVILEGE

| ID | Threat | Affected Asset | Likelihood | Impact |
|---|---|---|---|---|
| E-1 | Group member accesses another group's petitions | Petition data | LOW (group membership enforced) | HIGH |
| E-2 | Unauthenticated user accesses authenticated-only API routes | All API data | LOW (session checks on most routes) | HIGH |
| E-3 | Refresh token theft grants persistent access after logout | Google account | MEDIUM (tokens not encrypted at rest) | CRITICAL |

---

## 5. Control Mapping

### Implemented Controls (as of Week 1)

| Control | Threats Mitigated | Location |
|---|---|---|
| OAuth CSRF state parameter (restored) | S-1 | `server.js` `/auth/google` + `/oauth2callback` |
| Explicit session save before OAuth redirect | S-1 | `server.js` `/auth/google` |
| HttpOnly + SameSite=Lax session cookie | S-1, S-3 | `server.js` session config |
| Secure cookie flag in production | S-3 | `server.js` session config |
| Parameterized SQL queries | T-1 | `db/dbInterface.js` throughout |
| Group membership check before petition ops | T-2, E-1 | `routes/petition_routes.js` |
| Auth guard on `/api/users/search` (restored) | I-2 | `server.js` |
| Debug endpoints removed | I-3 | `server.js` |
| Rate limiting on `/api/` and `/auth/` | D-1 | `server.js` (new) |
| `helmet.js` security headers | I-4 + browser XSS | `server.js` (new) |
| HMAC-signed invite tokens (timing-safe) | E-2 | `inviteToken.js` |
| Session checks on all calendar/event routes | E-2 | `server.js` |

### Known Gaps (Future Weeks)

| Gap | Threat | Planned Fix | Week |
|---|---|---|---|
| OAuth tokens stored plaintext in DB | I-1, E-3 | AES-256-GCM encryption at rest | Week 3 |
| No refresh token rotation | E-3 | Rotate on each use | Week 3 |
| DB SSL certificate validation disabled | I-5 | `rejectUnauthorized: true` + correct CA cert | Week 5 |
| No HTTP security audit logging | R-1, R-2 | Structured access log via PM2 | Week 7 |
| No input sanitization for event names | Stored XSS (low risk) | Sanitize before DB write | Week 7 |

---

## 6. Attacker Profiles

| Profile | Motivation | Capability | Primary Targets |
|---|---|---|---|
| Unauthenticated web attacker | Data theft, account takeover | Low-medium (script kiddie to automated scanner) | OAuth flow, public endpoints |
| Authenticated malicious user | Access other users' schedules | Medium (has valid session) | Group data, petition responses |
| Network attacker (on path) | Token interception | Medium (requires MITM position) | DB connection (localhost, low risk), Google API traffic |
| Database compromise | Mass token exfiltration | High (requires server access) | All OAuth tokens (plaintext — critical gap) |

---

## 7. Summary Risk Matrix

| Threat ID | Likelihood | Impact | Risk | Status |
|---|---|---|---|---|
| I-1 (plaintext tokens) | MEDIUM | CRITICAL | HIGH | Open — Week 3 |
| S-1 (OAuth CSRF) | MEDIUM | HIGH | HIGH | **Fixed Week 1** |
| E-3 (token theft → persistent access) | MEDIUM | CRITICAL | HIGH | Partial — Week 3 |
| I-2 (user enumeration) | LOW | MEDIUM | MEDIUM | **Fixed Week 1** |
| I-3 (debug endpoint leak) | LOW | HIGH | MEDIUM | **Fixed Week 1** |
| D-1 (brute force) | MEDIUM | MEDIUM | MEDIUM | **Fixed Week 1** |
| T-1 (SQL injection) | LOW | CRITICAL | MEDIUM | Mitigated (parameterized) |
| E-1 (cross-group access) | LOW | HIGH | MEDIUM | Mitigated (membership check) |
| I-5 (DB SSL disabled) | LOW | MEDIUM | LOW | Open — Week 5 |
