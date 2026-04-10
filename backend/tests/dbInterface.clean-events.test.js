/*
dbInterface.clean-events.test.js
Validates retention behavior for cleanEvents query construction.
*/

describe("dbInterface.cleanEvents", () => {
  test("deletes old events while preserving manual rows", async () => {
    jest.resetModules();

    const mockQuery = jest.fn().mockResolvedValue({ rowCount: 0 });
    const mockPool = { query: mockQuery };

    jest.doMock("pg", () => ({
      Pool: jest.fn(() => mockPool),
    }));

    const db = require("../db/dbInterface");
    await db.cleanEvents(22, "2026-04-01T00:00:00.000Z");

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];

    expect(sql).toContain("DELETE FROM cal_event");
    expect(sql).toContain("event_end < ($2)");
    expect(sql).toContain("gcal_event_id NOT LIKE 'manual-%'");
    expect(params).toEqual([22, "2026-04-01T00:00:00.000Z"]);
  });
});
