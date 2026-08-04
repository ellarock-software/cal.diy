import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

it("has a single favicon source for the /favicon.ico route", () => {
  const appDirectory = dirname(fileURLToPath(import.meta.url));
  const publicFavicon = resolve(appDirectory, "../public/favicon.ico");
  const faviconSources = [resolve(appDirectory, "favicon.ico"), publicFavicon].filter(existsSync);

  expect(faviconSources, "ZATCH_REPRO_DUPLICATE_PROOF_ellarock_software_cal_diy_140").toEqual([
    publicFavicon,
  ]);
});
