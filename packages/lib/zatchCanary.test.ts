import { describe, it, expect } from "vitest";

import { zatchCanaryAdd } from "./zatchCanary";

describe("zatchCanaryAdd", () => {
  it("adds two numbers", () => {
    expect(zatchCanaryAdd(2, 3)).toBe(5);
  });
});
