import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDateTime, getOpensAt, isSlotOpenForBooking, parseResUsage, parseSlotDateTime } from "./planyo";
import { PLANYO } from "./constants";
import {
  isValidDiscordWebhook,
  isValidEmail,
  isValidHour,
  isWatchDateAllowed,
} from "./validate";

describe("parseResUsage", () => {
  it("unwraps nested resourceId booking counts", () => {
    const parsed = parseResUsage({
      "11": {
        "13": { [PLANYO.RESOURCE_ID]: 3 },
        "20": { [PLANYO.RESOURCE_ID]: 7 },
        md: { [PLANYO.RESOURCE_ID]: 1 },
      },
    });
    assert.equal(parsed["11"]["13"], 3);
    assert.equal(parsed["11"]["20"], 7);
    assert.equal(parsed["11"].md, undefined);
  });

  it("keeps flat numeric hour counts", () => {
    const parsed = parseResUsage({
      "12": { "8": 2, "9": 1 },
    });
    assert.equal(parsed["12"]["8"], 2);
    assert.equal(parsed["12"]["9"], 1);
  });
});

describe("Eastern booking window", () => {
  it("formats Planyo timestamps in Eastern time, not UTC", () => {
    const winter = parseSlotDateTime("2026-01-16", 16);
    assert.equal(winter.toISOString(), "2026-01-16T21:00:00.000Z");
    assert.equal(formatDateTime(winter), "2026-01-16 16:00:00");

    const summer = parseSlotDateTime("2026-07-17", 16);
    assert.equal(summer.toISOString(), "2026-07-17T20:00:00.000Z");
    assert.equal(formatDateTime(summer), "2026-07-17 16:00:00");
  });

  it("opens a Friday 4 PM slot at Wednesday 4 PM Eastern, including across DST", () => {
    const friday = parseSlotDateTime("2026-10-30", 16);
    const opens = getOpensAt(friday);
    assert.equal(opens.toISOString(), "2026-10-28T20:00:00.000Z");
    assert.equal(isSlotOpenForBooking(friday, new Date("2026-10-28T19:59:00.000Z")), false);
    assert.equal(isSlotOpenForBooking(friday, new Date("2026-10-28T20:00:00.000Z")), true);
    assert.equal(isSlotOpenForBooking(friday, friday), false);

    const afterSpringForward = parseSlotDateTime("2026-03-09", 16);
    assert.equal(getOpensAt(afterSpringForward).toISOString(), "2026-03-07T21:00:00.000Z");

    const afterFallBack = parseSlotDateTime("2026-11-02", 16);
    assert.equal(getOpensAt(afterFallBack).toISOString(), "2026-10-31T20:00:00.000Z");
  });
});

describe("validate", () => {
  it("accepts normal emails and rejects junk", () => {
    assert.equal(isValidEmail("you@terpmail.umd.edu"), true);
    assert.equal(isValidEmail("not-an-email"), false);
  });

  it("validates hours and discord webhooks", () => {
    assert.equal(isValidHour(6), true);
    assert.equal(isValidHour(24), false);
    assert.equal(
      isValidDiscordWebhook("https://discord.com/api/webhooks/123/abc-def"),
      true
    );
    assert.equal(isValidDiscordWebhook("https://evil.example/hooks/1"), false);
  });

  it("allows watch dates within the configured window", () => {
    const now = new Date("2026-09-10T12:00:00");
    assert.equal(isWatchDateAllowed("2026-09-11", now), true);
    assert.equal(isWatchDateAllowed("2026-10-01", now), false);
    assert.equal(isWatchDateAllowed("2026-09-09", now), false);
  });

  it("uses the Eastern calendar date when UTC has already rolled over", () => {
    const now = new Date("2026-10-26T00:30:00.000Z");
    assert.equal(isWatchDateAllowed("2026-10-25", now), true);
    assert.equal(isWatchDateAllowed("2026-10-24", now), false);
  });
});
