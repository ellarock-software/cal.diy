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

test("required aggregation accepts intentionally skipped E2E jobs while preserving mandatory failures", async () => {
  const source = await readFile(workflowPath, "utf8");
  const requiredJob = source.slice(source.indexOf("  required:"));
  const optionalGuard = requiredJob.indexOf("needs.prepare.outputs.run-e2e == 'true' &&");
  expect(optionalGuard).toBeGreaterThan(-1);

  for (const mandatoryJob of [
    "needs.lint.result != 'success'",
    "needs.type-check.result != 'success'",
    "needs.unit-test.result != 'success'",
    "needs.api-v2-unit-test.result != 'success'",
    "needs.security-audit.result != 'success'",
  ]) {
    expect(requiredJob.indexOf(mandatoryJob)).toBeGreaterThan(-1);
    expect(requiredJob.indexOf(mandatoryJob)).toBeLessThan(optionalGuard);
  }

  for (const optionalJob of [
    "needs.build.result != 'success'",
    "needs.build-api-v2.result != 'success'",
    "needs.build-atoms.result != 'success'",
    "needs.setup-db.result != 'success'",
    "needs.integration-test.result != 'success'",
    "needs.e2e.result != 'success'",
    "needs.e2e-api-v2.result != 'success'",
    "needs.e2e-embed.result != 'success'",
    "needs.e2e-embed-react.result != 'success'",
    "needs.e2e-app-store.result != 'success'",
  ]) {
    expect(requiredJob.indexOf(optionalJob)).toBeGreaterThan(optionalGuard);
  }

  expect(requiredJob).toMatch(
    /needs\.prepare\.outputs\.run-e2e == 'true'\s*&&\s*\(\s*needs\.build\.result != 'success'[\s\S]*needs\.e2e-app-store\.result != 'success'\s*\)\s*\)/u
  );
});
