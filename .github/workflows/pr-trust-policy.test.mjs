import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { expect, test } from "vitest";

const workflowPath = resolve(process.cwd(), ".github/workflows/pr.yml");

test("trust-check admits only the configured Zatch review bot outside association/write trust", async () => {
  const source = await readFile(workflowPath, "utf8");
  expect(source).toMatch(/const trustedBotLogins = \['reia-code-review-bot\[bot\]'\];/u);
  expect(source).toMatch(/pr\.user\.type === 'Bot' && trustedBotLogins\.includes\(pr\.user\.login\)/u);
  expect(source).not.toMatch(/pr\.user\.type === 'Bot'\)\s*\{/u);
  expect(source).not.toMatch(/trustedBotLogins = \[[^\]]*graphite/iu);
});
