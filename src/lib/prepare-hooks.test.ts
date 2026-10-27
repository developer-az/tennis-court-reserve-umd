import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts/prepare.js");

describe("prepare git hooks", () => {
  it("exits successfully outside a git checkout", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "no-git-"));
    const result = execFileSync(process.execPath, [script], { cwd: dir, encoding: "utf8" });
    assert.equal(result, "");
  });
});
