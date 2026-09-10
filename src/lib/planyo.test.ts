import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseResUsage } from "./planyo";
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
});
