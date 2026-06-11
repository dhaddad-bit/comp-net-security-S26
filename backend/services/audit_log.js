/*
File: audit_log.js
Purpose: Records security-relevant events (auth, token, authorization) to the
    security_audit_log table for a durable audit trail.
Date Created: 2026-06-04
Initial Author(s): Residual-risk hardening

System Context:
Called from the auth/token handlers in server.js and the access-control
middleware in routes/petition_routes.js. Writes are fire-and-forget: a logging
failure is swallowed (and console-logged) so it can never break a request.
The detail payload MUST contain only whitelisted, non-secret fields — never
tokens, authorization codes, or client secrets.
*/

const db = require('../db/dbInterface');

// Canonical event names so call sites and queries stay consistent.
const EVENT_TYPES = Object.freeze({
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  TOKEN_REFRESH_SUCCESS: 'TOKEN_REFRESH_SUCCESS',
  TOKEN_REFRESH_FAILURE: 'TOKEN_REFRESH_FAILURE',
  LOGOUT: 'LOGOUT',
  AUTH_DENIED: 'AUTH_DENIED',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
});

const OUTCOMES = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  DENIED: 'DENIED'
});

/**
 * Best-effort client IP extraction. Prefers the first X-Forwarded-For hop
 * (NGINX sits in front in production), then falls back to the socket address.
 *
 * @param {Object} [req]
 * @returns {string|null}
 */
function clientIp(req) {
  if (!req) return null;
  const fwd = req.headers && req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || null;
}

/**
 * Record one security audit event. Never throws.
 *
 * @param {Object} params
 * @param {string} params.eventType - One of EVENT_TYPES
 * @param {string} [params.outcome] - One of OUTCOMES (default SUCCESS)
 * @param {number|string|null} [params.userId]
 * @param {Object|null} [params.req] - Express request, for ip / user-agent
 * @param {Object|null} [params.detail] - Whitelisted, non-secret metadata
 * @returns {Promise<void>}
 */
async function recordAuditEvent({ eventType, outcome = OUTCOMES.SUCCESS, userId = null, req = null, detail = null }) {
  try {
    const numericUserId = userId == null ? null : Number(userId);
    await db.insertSecurityAudit({
      eventType,
      outcome,
      userId: Number.isFinite(numericUserId) ? numericUserId : null,
      ip: clientIp(req),
      userAgent: (req && req.headers && req.headers['user-agent']) || null,
      detail
    });
  } catch (error) {
    // A failed audit write must never break the request it describes.
    console.error('[audit] failed to record event', {
      eventType,
      outcome,
      errorMessage: error && error.message ? error.message : String(error)
    });
  }
}

module.exports = { recordAuditEvent, EVENT_TYPES, OUTCOMES, clientIp };
