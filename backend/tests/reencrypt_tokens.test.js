/*
reencrypt_tokens.test.js
Validates the legacy-token backfill: only plaintext values are re-encrypted,
already-encrypted values are skipped, and the operation is idempotent.
*/

const { runBackfill, isLegacyPlaintext } = require("../scripts/reencrypt_tokens");

describe("reencrypt_tokens.isLegacyPlaintext", () => {
  test("flags plaintext but skips the v1 envelope and empty/null", () => {
    expect(isLegacyPlaintext("ya29.sometoken")).toBe(true);
    expect(isLegacyPlaintext("v1:iv:tag:ct")).toBe(false);
    expect(isLegacyPlaintext("")).toBe(false);
    expect(isLegacyPlaintext(null)).toBe(false);
    expect(isLegacyPlaintext(undefined)).toBe(false);
  });
});

describe("reencrypt_tokens.runBackfill", () => {
  const encrypt = (v) => `v1:enc(${v})`;

  test("re-encrypts only the legacy plaintext columns", async () => {
    const rows = [
      { user_id: 1, refresh_token: "plain-r", access_token: "plain-a" }, // both legacy
      { user_id: 2, refresh_token: "v1:already", access_token: "plain-a2" }, // one legacy
      { user_id: 3, refresh_token: "v1:r3", access_token: "v1:a3" }, // none
      { user_id: 4, refresh_token: null, access_token: null }, // none
    ];
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows }) // SELECT
      .mockResolvedValue({ rowCount: 1 }); // UPDATEs

    const result = await runBackfill({ query }, encrypt);

    expect(result).toEqual({ scanned: 4, updatedRows: 2, updatedColumns: 3 });

    expect(query.mock.calls[0][0]).toContain(
      "SELECT user_id, refresh_token, access_token FROM person"
    );

    // Row 1: both columns rewritten in one UPDATE.
    expect(query.mock.calls[1][0]).toBe(
      "UPDATE person SET refresh_token = $2, access_token = $3 WHERE user_id = $1"
    );
    expect(query.mock.calls[1][1]).toEqual([1, "v1:enc(plain-r)", "v1:enc(plain-a)"]);

    // Row 2: only the access_token was plaintext.
    expect(query.mock.calls[2][0]).toBe(
      "UPDATE person SET access_token = $2 WHERE user_id = $1"
    );
    expect(query.mock.calls[2][1]).toEqual([2, "v1:enc(plain-a2)"]);

    // SELECT + exactly two UPDATEs.
    expect(query).toHaveBeenCalledTimes(3);
  });

  test("is idempotent: no writes when everything is already encrypted", async () => {
    const rows = [{ user_id: 1, refresh_token: "v1:r", access_token: "v1:a" }];
    const query = jest.fn().mockResolvedValueOnce({ rows });

    const result = await runBackfill({ query }, encrypt);

    expect(result).toEqual({ scanned: 1, updatedRows: 0, updatedColumns: 0 });
    expect(query).toHaveBeenCalledTimes(1); // SELECT only
  });
});
