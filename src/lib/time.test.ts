import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addCalendarDays, todayInTimeZone, zonedWallTime } from "./time";

describe("Eastern wall time", () => {
  it("converts winter and summer clock times to UTC", () => {
    assert.equal(zonedWallTime("2026-01-16", 16, 0, "America/New_York").toISOString(), "2026-01-16T21:00:00.000Z");
    assert.equal(zonedWallTime("2026-07-17", 16, 0, "America/New_York").toISOString(), "2026-07-17T20:00:00.000Z");
  });

  it("keeps the Maryland calendar date just after UTC midnight", () => {
    assert.equal(todayInTimeZone(new Date("2026-10-26T00:30:00.000Z"), "America/New_York"), "2026-10-25");
    assert.equal(todayInTimeZone(new Date("2026-10-26T04:30:00.000Z"), "America/New_York"), "2026-10-26");
  });

  it("adds calendar days across a month boundary", () => {
    assert.equal(addCalendarDays("2026-10-30", 3), "2026-11-02");
    assert.equal(addCalendarDays("2026-03-09", -2), "2026-03-07");
  });
});
