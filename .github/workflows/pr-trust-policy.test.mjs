import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL("./pr.yml", import.meta.url);

test("trust-check admits only the configured Zatch review bot outside association/write trust", async () => {
  const source = await readFile(workflowUrl, "utf8");
  assert.match(source, /const trustedBotLogins = \['reia-code-review-bot\[bot\]'\];/u);
  assert.match(source, /pr\.user\.type === 'Bot' && trustedBotLogins\.includes\(pr\.user\.login\)/u);
  assert.doesNotMatch(source, /pr\.user\.type === 'Bot'\)\s*\{/u);
  assert.doesNotMatch(source, /trustedBotLogins = \[[^\]]*graphite/iu);
});
