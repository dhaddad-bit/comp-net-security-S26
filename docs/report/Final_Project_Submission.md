# Securing a Real, Deployed Web Application: A Security Engineering Case Study of *Social Scheduler*

**CS 434/534 — Computer and Network Security II**
**Final Project Submission Report**
**Author:** David Haddad
**Live deployment:** `https://social-scheduler.me` (Google-verified OAuth application)
**Date:** June 2026

> **Figure legend.** Markers like **[FIGURE F1 — … | concept: …]** show where an image is placed;
> each caption names the security concept it demonstrates.

---

## 1. Why I Chose This Area

Most security coursework treats vulnerabilities as isolated puzzles: find a SQL injection, patch
it, move on. For my final project I wanted the opposite — to take a *real, internet-facing
application* I had a stake in and ask the question every production system eventually faces: **if
an attacker came at this today, where would it break?** The system I chose is **Social
Scheduler**, a web app that lets users share Google Calendar availability within groups and
negotiate meeting times via "petitions." It runs live at `social-scheduler.me` on a hardened
Linux VPS behind NGINX.

It is a worthwhile target for two reasons. First, it holds long-lived **Google OAuth refresh
tokens** — persistent keys to users' calendars that survive logout, so a compromise is account
takeover with a long tail. Second, its calendar data, group memberships, and petition responses
form a **social graph** that reveals who a user knows and when they are free. The threats map
directly onto the OWASP Top 10, STRIDE, and the vulnerability–threat–control paradigm from
Pfleeger's *Security in Computing*. Securing a system you built is also humbling: every gap in
the threat model is one *I* left, and every control is one I had to wire into running code.

---

## 2. Scope of the Project

The scope is **the security posture of Social Scheduler**, not its features. The feature set
existed from a prior term; this term I threat-modeled the system, implemented controls on the
live deployment, and documented residual risk honestly.

**Application overview.** A single-page **React (Vite)** frontend, a **Node.js/Express** API, and
a **PostgreSQL** database. Users authenticate with Google (read-only `calendar.readonly` scope)
and coordinate meeting times. The backend runs under PM2; TLS is issued by Let's Encrypt/Certbot.

```
Browser ──HTTPS──► NGINX (TLS) ──► Express (:3000) ──► PostgreSQL (localhost)
                                        ├──► Google OAuth 2.0 / Calendar API
                                        └──► Resend (email)
```

**[FIGURE S7 — App runtime: login, group availability heat-map, and a petition | concept: the
protected system in context.]**

**In scope:** threat modeling (STRIDE, trust boundaries, asset ranking); OAuth/authentication
hardening incl. token encryption at rest; session security; injection and access-control
defenses; rate limiting and security headers; a PII-sanitized audit log; dependency hygiene.
**Out of scope:** a formal pen test/DAST, encryption of *all* data at rest (focused on the
high-value token gap), and SOC 2 compliance. **Methodology:** a four-step loop — enumerate assets
and trust boundaries → identify threats (STRIDE) → rate by likelihood × impact → map controls and
re-rate residual risk.

### 2.1 Theory → Production: the eight-week roadmap, delivered

I built an integration roadmap binding each week's textbook topic to a shipped control; every
academic concept had to land on the live site. The table shows the plan and its delivery, with
commit evidence.

| Wk | Course topic (Pfleeger) | Control delivered | Commit |
|---|---|---|---|
| 1 | Ch.1 — Vuln–Threat–Control; threat modeling | Threat model; CSRF state restored; debug endpoints removed; helmet + rate limiting | `dfcc2a5` |
| 2 | Ch.2 — Authentication; OAuth 2.0 grant | Least-privilege `calendar.readonly`; auth-code flow + callback hardening | server.js |
| 3 | Ch.2 & 8 — Access control; token theft | AES-256-GCM tokens at rest + refresh fix; stop logging tokens; hardened cookies | `0a108cd`, `0d1a349` |
| 4 | Privacy & data protection | Privacy Policy + ToS hosted; demo video; **Google verification passed** | `7815190` |
| 5 | Ch.8 — Cloud security; least privilege | Secrets in env + `TOKEN_ENCRYPTION_KEY`; DB localhost-only; deploy automation | `a182c9a` |
| 6 | Network defenses; firewalls; DDoS | NGINX + Certbot TLS; app-layer rate limiting; DB not internet-exposed | `88cabae` |
| 7 | Pen-testing; input validation | Dependency CVE fix (uuid GHSA); strict CORS; CSRF verification; **audit logging** | `a88d10d` |
| 8 | Launch & class deliverable | Production deploy; OAuth In-Production/verified; PM2 + audit monitoring | `7d1f11b` |

The roadmap originally targeted Google Cloud (Secret Manager, VPC firewall, Cloud Armor); it
shipped on a hardened **DigitalOcean VPS**, meeting each control objective by VPS-equivalent means
(NGINX + network firewall, `express-rate-limit`, an env-held `TOKEN_ENCRYPTION_KEY`) — itself a
lesson that a control objective and its mechanism are distinct. Throughout, AI coding assistants
were used as a disciplined collaborator (define a narrow target → commit → merge → repair), but
the threat model, control selection, and verification remained my responsibility.

---

## 3. Threat Model and Demonstration

### 3.1 Trust boundaries

**[FIGURE F1 — Network/architecture diagram with the five trust boundaries | concept:
defense-in-depth, trust boundaries, attack-surface reduction.]**

The two highest-risk boundaries are **TB1** (internet → NGINX), the only externally exposed
surface, and **TB4** (Express → Google), where the high-value tokens flow. TB2/TB3 (Express ↔
PostgreSQL) are low risk: localhost-only, unreachable from the internet.

| Boundary | Direction | Risk | Primary control |
|---|---|---|---|
| TB1 Internet → NGINX | Inbound | **HIGH** | TLS termination, rate limiting |
| TB2 NGINX → Express | Internal | LOW | Localhost binding only |
| TB3 Express → PostgreSQL | Internal | MEDIUM | Localhost socket; strict-TLS scaffolding |
| TB4 Express → Google API | Outbound | MEDIUM | Tokens encrypted at rest (AES-256-GCM) |
| TB5 Express → Resend API | Outbound | LOW | API key only; no user data |

Assets, ranked by the CIA triad: OAuth refresh tokens (persistent account takeover), access
tokens, session tokens, the secrets `SESSION_SECRET`/`GOOGLE_CLIENT_SECRET`/`TOKEN_ENCRYPTION_KEY`,
and user calendar/email/group data (PII + social graph).

### 3.2 Threats found (STRIDE summary)

The matrix below shows the threats that mattered and their disposition after this term's work.

| ID | Threat | Likelihood | Impact | Status |
|---|---|---|---|---|
| **I-1** | Plaintext OAuth tokens at rest | MEDIUM | CRITICAL | **Fixed** (AES-256-GCM) |
| **S-1** | CSRF on OAuth callback | MEDIUM | HIGH | **Fixed** |
| **R-1** | No audit trail / non-repudiation | HIGH | MEDIUM | **Fixed** (audit log) |
| **E-3** | Refresh-token theft → access after logout | MEDIUM | CRITICAL | Mitigated (encrypted) |
| **I-2** | User enumeration via `/api/users/search` | LOW | MEDIUM | **Fixed** |
| **I-3** | Session leak via debug endpoint | LOW | HIGH | **Fixed** |
| **D-1** | Brute-force login | MEDIUM | MEDIUM | **Fixed** (rate limit) |
| **I-5** | DB TLS validation disabled | LOW | MEDIUM | **Fixed** |
| **T-1** | SQL injection | LOW | CRITICAL | Mitigated (parameterized) |
| **E-1** | Cross-group petition access | LOW | HIGH | Mitigated (membership) |

### 3.3 Controls implemented

- **OAuth CSRF protection (S-1).** A per-request `state` is generated with `crypto.randomBytes(32)`,
  stored in the session, verified on `/oauth2callback` before the code exchange, then deleted —
  restored from a previously disabled state. *(`backend/server.js`)*
- **Token encryption at rest (I-1, E-3).** All OAuth tokens are AES-256-GCM encrypted at the DB
  boundary and decrypted only on read; an idempotent migration backfilled legacy rows, so a DB
  dump yields no usable credentials. *(`backend/services/token_crypto.js`,
  `backend/db/dbInterface.js`, `npm run migrate:tokens`)*
- **Security audit logging (R-1).** A durable `security_audit_log` records auth/authorization
  events (LOGIN, TOKEN_REFRESH, AUTH_DENIED, PERMISSION_DENIED) with user/IP/User-Agent and a
  sanitized payload that never holds tokens. *(`backend/services/audit_log.js`)*
- **Session & DB TLS hardening (S-3, I-5).** Cookies are `HttpOnly` + `SameSite=Lax` + `Secure`;
  sessions live server-side in Postgres. The insecure `rejectUnauthorized:false` DB anti-pattern
  was removed, with `verify-full` scaffolding for off-host use. *(`backend/server.js`,
  `backend/db/dbInterface.js`)*
- **Injection & access control (T-1, E-1).** Parameterized queries everywhere; group-membership
  checks gate petition operations. *(`backend/routes/petition_routes.js`)*
- **Attack-surface & abuse (I-2, I-3, D-1).** Auth required on user search; debug endpoints
  removed; `express-rate-limit` on `/api/*` and `/auth/*`; `helmet` headers incl. CSP.
- **Supply chain & least privilege.** A transitive `uuid` CVE (GHSA-w5hq-g745-h8pq) was cleared;
  only read-only Google scopes are requested, and the app passed Google's OAuth verification.

**[FIGURE F2 — OAuth 2.0 authorization-code flow with the `state` round-trip | concept:
authentication protocols, federated identity, CSRF prevention.]**

**[FIGURE S2 — Code: AES-256-GCM `encryptToken`/`decryptToken` at the DB boundary | concept:
cryptography at rest, authenticated encryption (GCM), key management.]**

**[FIGURE S3 — `security_audit_log` rows (sanitized) | concept: logging, monitoring,
non-repudiation.]**

**[FIGURE S4 — DevTools: `Set-Cookie` HttpOnly/Secure/SameSite + helmet response headers |
concept: TLS/HTTPS, session security, security headers.]**

### 3.4 Honest residual risk

The dominant critical risks are closed; what remains is architectural: **(1)** no refresh-token
rotation, so a token stolen from memory/transit stays valid until expiry (E-3); **(2)** limited
input sanitization for user-supplied group/event names (stored-XSS surface beyond `helmet`); and
**(3)** no WAF for volumetric DDoS beyond app-layer rate limiting.

---

## 4. Future Considerations

1. **Refresh-token rotation** — rotate on use and invalidate the prior token, making theft
   short-lived and reuse detectable (E-3).
2. **Strict input sanitization** — DOMPurify on the frontend plus server-side validation to close
   stored-XSS vectors.
3. **Automated security testing in CI** — dependency scanning (already caught the uuid CVE) and a
   lightweight DAST pass per deploy to catch regressions like the once-disabled state check.
4. **WAF + off-host DB with `DB_SSL=verify-full`**, then a formal penetration test before a broad
   public launch.

---

## 5. Conclusion

Treating security as a property of a *running system* rather than a checklist, I worked from a
structured threat model and an eight-week roadmap that bound each course concept to a shipped
control. I closed the most dangerous reachable gaps — the forgeable OAuth flow (S-1), plaintext
credentials (I-1), the missing audit trail (R-1), insecure DB TLS (I-5), and the enumeration,
debug, and brute-force exposures — while naming the architectural risks that remain. The result
is a defensible, documented posture for a live application and a repeatable methodology:
**model → mitigate → re-rate → record.**

---

## Appendix A — Source Cross-Reference

| Control | Source |
|---|---|
| Token encryption / key management | `backend/services/token_crypto.js` |
| Encrypt/decrypt at DB boundary; DB TLS; parameterized SQL | `backend/db/dbInterface.js` |
| Legacy-token backfill migration | `backend/scripts/reencrypt_tokens.js` (`npm run migrate:tokens`) |
| Security audit logging | `backend/services/audit_log.js`, `db/002_security_audit_log.sql` |
| OAuth CSRF state; cookies; rate limiting; helmet | `backend/server.js` |
| Group-membership authorization | `backend/routes/petition_routes.js` |
| Full threat model | `docs/threat-model.md` |
| Integration roadmap (theory↔production) | `.cursor/plans/roadmap.html` |
