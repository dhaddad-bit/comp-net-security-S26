/*
File: token_crypto.js
Purpose: AES-256-GCM authenticated encryption for OAuth tokens at rest.
    Protects Google refresh and access tokens stored in the person table so
    a database read alone cannot yield usable credentials.
Date Created: 2026-04-18
Initial Author(s): Week 3 security hardening

System Context:
Called by dbInterface before writing tokens and after reading them. The
encryption key must be 32 bytes, provided via TOKEN_ENCRYPTION_KEY as hex
(64 chars) or base64 (44 chars). Generate one with:
  openssl rand -hex 32
*/

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION_TAG = 'v1';

let cachedKey = null;

function loadKey() {
  if (cachedKey) return cachedKey;

  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('TOKEN_ENCRYPTION_KEY is required (32 bytes hex or base64)');
  }

  let key;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    // Fall through to base64 for operators who prefer it.
    key = Buffer.from(raw, 'base64');
  }

  if (key.length !== 32) {
    throw new Error(`TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length})`);
  }

  cachedKey = key;
  return key;
}

/**
 * Encrypt a token string for storage at rest.
 * Returns null for null/undefined inputs so callers can pass tokens through
 * unchanged when Google did not provide one on a given response.
 *
 * @param {string|null|undefined} plaintext
 * @returns {string|null} "v1:<ivB64>:<tagB64>:<cipherB64>" or null
 */
function encryptToken(plaintext) {
  if (plaintext == null) return null;
  const key = loadKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION_TAG,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64')
  ].join(':');
}

/**
 * Decrypt a stored token. Legacy rows written before encryption shipped are
 * returned unchanged so the migration can happen lazily on next write; any
 * value prefixed with the version tag must decrypt cleanly or we surface the
 * failure rather than silently returning ciphertext.
 *
 * @param {string|null|undefined} stored
 * @returns {string|null}
 */
function decryptToken(stored) {
  if (stored == null) return null;
  if (typeof stored !== 'string') return stored;
  if (!stored.startsWith(VERSION_TAG + ':')) {
    // Legacy plaintext row — return as-is; next write will upgrade it.
    return stored;
  }

  const parts = stored.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted token payload');
  }

  const [, ivB64, tagB64, cipherB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(cipherB64, 'base64');

  if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES) {
    throw new Error('Malformed encrypted token payload');
  }

  const key = loadKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

module.exports = { encryptToken, decryptToken };
