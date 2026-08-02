// @vitest-environment node

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { expect, it } from "vitest";

it("does not duplicate the App Router favicon metadata route in public", () => {
  const publicFaviconPath = resolve(__dirname, "../public/favicon.ico");

  expect(existsSync(publicFaviconPath), "ZATCH_REPRO_DUPLICATE_PROOF_ellarock_software_cal_diy_140").toBe(false);
});
