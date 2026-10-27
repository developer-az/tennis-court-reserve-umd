import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeStoreError, isReadOnlyStoreError } from "./store-error";

describe("describeStoreError", () => {
  it("explains the Vercel read-only data directory instead of leaking the filesystem error", () => {
    const err = Object.assign(new Error("ENOENT: no such file or directory, mkdir '/var/task/data'"), {
      code: "ENOENT",
    });
    assert.equal(isReadOnlyStoreError(err), true);
    assert.equal(
      describeStoreError(err),
      "Redis is not configured, so watches and check history cannot be saved on this host."
    );
  });

  it("keeps unrelated failures verbatim", () => {
    const err = new Error("Redis error: 401");
    assert.equal(isReadOnlyStoreError(err), false);
    assert.equal(describeStoreError(err), "Redis error: 401");
  });
});
