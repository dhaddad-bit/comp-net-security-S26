/*
audit_log.test.js
Validates the security audit writer: field mapping, client-IP extraction, and
that a failed DB write never propagates out of the request path.
*/

describe("audit_log.recordAuditEvent", () => {
  function load(insertImpl) {
    jest.resetModules();
    const insertSecurityAudit = jest.fn(insertImpl || (() => Promise.resolve()));
    jest.doMock("../db/dbInterface", () => ({ insertSecurityAudit }));
    const audit = require("../services/audit_log");
    return { audit, insertSecurityAudit };
  }

  test("maps fields and extracts first X-Forwarded-For hop + user agent", async () => {
    const { audit, insertSecurityAudit } = load();
    const req = {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": "jest-agent" },
    };

    await audit.recordAuditEvent({
      eventType: audit.EVENT_TYPES.LOGIN_SUCCESS,
      outcome: audit.OUTCOMES.SUCCESS,
      userId: "42",
      req,
      detail: { email: "a@b.c" },
    });

    expect(insertSecurityAudit).toHaveBeenCalledTimes(1);
    expect(insertSecurityAudit).toHaveBeenCalledWith({
      eventType: "LOGIN_SUCCESS",
      outcome: "SUCCESS",
      userId: 42,
      ip: "203.0.113.9",
      userAgent: "jest-agent",
      detail: { email: "a@b.c" },
    });
  });

  test("defaults outcome to SUCCESS and nulls missing actor context", async () => {
    const { audit, insertSecurityAudit } = load();

    await audit.recordAuditEvent({ eventType: "LOGOUT" });

    expect(insertSecurityAudit).toHaveBeenCalledWith({
      eventType: "LOGOUT",
      outcome: "SUCCESS",
      userId: null,
      ip: null,
      userAgent: null,
      detail: null,
    });
  });

  test("falls back to req.ip when no forwarded header is present", async () => {
    const { audit, insertSecurityAudit } = load();

    await audit.recordAuditEvent({
      eventType: "AUTH_DENIED",
      outcome: "DENIED",
      req: { ip: "198.51.100.7", headers: {} },
    });

    expect(insertSecurityAudit).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "198.51.100.7", userAgent: null })
    );
  });

  test("never throws when the audit write fails", async () => {
    const { audit } = load(() => Promise.reject(new Error("db down")));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      audit.recordAuditEvent({ eventType: "LOGIN_FAILURE", outcome: "FAILURE" })
    ).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
