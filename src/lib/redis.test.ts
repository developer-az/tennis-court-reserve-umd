import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { redisCredentials } from "./redis";

describe("redisCredentials", () => {
  it("reads the Upstash names from a manual setup", () => {
    const creds = redisCredentials({
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
    });
    assert.deepEqual(creds, { url: "https://example.upstash.io", token: "token" });
  });

  it("reads the names the Vercel Upstash integration writes", () => {
    const creds = redisCredentials({
      KV_REST_API_URL: "https://example.upstash.io",
      KV_REST_API_TOKEN: "token",
    });
    assert.deepEqual(creds, { url: "https://example.upstash.io", token: "token" });
  });

  it("stays unset when either half is missing", () => {
    assert.equal(redisCredentials({ KV_REST_API_URL: "https://example.upstash.io" }), null);
  });
});
