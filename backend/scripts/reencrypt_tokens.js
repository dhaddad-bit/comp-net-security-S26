/*
File: reencrypt_tokens.js
Purpose: One-time backfill that AES-256-GCM encrypts any OAuth tokens still
    stored as plaintext from before token encryption shipped.

System Context:
Tokens are encrypted at the DB boundary on every write, but a row written before
that change stays plaintext until its next write — and insertUpdateUser's ON
CONFLICT never rewrites refresh_token, so a legacy refresh_token would otherwise
never be upgraded. This script scans the person table and re-encrypts any value
not already carrying the "v1:" envelope. It is idempotent: already-encrypted
values are skipped, so it is safe to re-run.

Usage (env selects .env.development vs .env.production, like the app):
    NODE_ENV=production node scripts/reencrypt_tokens.js
or  npm run migrate:tokens

Requires TOKEN_ENCRYPTION_KEY to be set (same key the app uses). Never logs
token values.
*/

const { pool } = require('../db/dbInterface');
const { encryptToken } = require('../services/token_crypto');

const VERSION_PREFIX = 'v1:';
const TOKEN_COLUMNS = ['refresh_token', 'access_token'];

/**
 * @param {*} value
 * @returns {boolean} true when the value is plaintext and needs encrypting
 */
function isLegacyPlaintext(value) {
  return typeof value === 'string' && value.length > 0 && !value.startsWith(VERSION_PREFIX);
}

/**
 * Re-encrypt every legacy plaintext token in the person table. Idempotent.
 *
 * @param {{query: Function}} db - object exposing a pg-style query(text, params)
 * @param {(v: string) => string} [encrypt] - injectable for testing
 * @returns {Promise<{scanned:number, updatedRows:number, updatedColumns:number}>}
 */
async function runBackfill(db, encrypt = encryptToken) {
  const { rows } = await db.query('SELECT user_id, refresh_token, access_token FROM person');

  let scanned = 0;
  let updatedRows = 0;
  let updatedColumns = 0;

  for (const row of rows) {
    scanned++;
    const setClauses = [];
    const params = [row.user_id];

    for (const column of TOKEN_COLUMNS) {
      if (isLegacyPlaintext(row[column])) {
        params.push(encrypt(row[column]));
        setClauses.push(`${column} = $${params.length}`);
        updatedColumns++;
      }
    }

    if (setClauses.length > 0) {
      await db.query(`UPDATE person SET ${setClauses.join(', ')} WHERE user_id = $1`, params);
      updatedRows++;
    }
  }

  return { scanned, updatedRows, updatedColumns };
}

async function main() {
  const { scanned, updatedRows, updatedColumns } = await runBackfill(pool);
  console.log(
    `[reencrypt_tokens] scanned ${scanned} person rows; re-encrypted ${updatedColumns} ` +
    `legacy token value(s) across ${updatedRows} row(s).`
  );
}

// Only connect and run when invoked directly (`node scripts/reencrypt_tokens.js`),
// so the pure helpers above can be unit-tested without touching a database.
if (require.main === module) {
  main()
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error('[reencrypt_tokens] failed:', error && error.message ? error.message : String(error));
      try { await pool.end(); } catch (_) { /* ignore */ }
      process.exit(1);
    });
}

module.exports = { isLegacyPlaintext, runBackfill, VERSION_PREFIX, TOKEN_COLUMNS };
