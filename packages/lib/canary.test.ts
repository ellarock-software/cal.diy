import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// This test file lives at <repoRoot>/packages/lib/canary.test.ts,
// so the repository root is two directories up.
const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const canaryPath = path.join(repoRoot, "CANARY.md");

const EXPECTED_CONTENT = `# Live Supervisor Canary

This file was created by the cal.diy autonomous supervisor to prove the
end-to-end ticket pipeline executes real work.

Adapter: ClaudeCodeAdapter (tmux, provider anthropic)
`;

describe("CANARY.md", () => {
  it("exists at the repository root", () => {
    expect(existsSync(canaryPath)).toBe(true);
  });

  it("contains exactly the required content block", () => {
    expect(readFileSync(canaryPath, "utf8")).toBe(EXPECTED_CONTENT);
  });
});
