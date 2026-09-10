import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmailToken, verifyEmailToken } from "./tokens";

describe("email tokens", () => {
  it("round-trips verify tokens", () => {
    process.env.TOKEN_SECRET = "test-secret-for-tokens";
    const token = createEmailToken("you@terpmail.umd.edu", "verify");
    const payload = verifyEmailToken(token, "verify");
    assert.ok(payload);
    assert.equal(payload.email, "you@terpmail.umd.edu");
    assert.equal(payload.action, "verify");
  });

  it("rejects wrong action and tampering", () => {
    process.env.TOKEN_SECRET = "test-secret-for-tokens";
    const token = createEmailToken("a@b.com", "unsubscribe");
    assert.equal(verifyEmailToken(token, "verify"), null);
    assert.equal(verifyEmailToken(token.slice(0, -2) + "xx", "unsubscribe"), null);
  });
});
