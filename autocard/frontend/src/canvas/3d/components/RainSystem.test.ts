// Unit tests for the quality→particle-count scaling used by RainSystem.
import { describe, it, expect } from "vitest";
import { particleCountForQuality } from "./RainSystem";

describe("particleCountForQuality", () => {
  it("keeps full count at high quality (unchanged default behavior)", () => {
    expect(particleCountForQuality(3000, "high")).toBe(3000);
    expect(particleCountForQuality(1500, "high")).toBe(1500);
  });

  it("halves the count at medium quality", () => {
    expect(particleCountForQuality(3000, "medium")).toBe(1500);
    expect(particleCountForQuality(1500, "medium")).toBe(750);
  });

  it("disables particles entirely at low quality", () => {
    expect(particleCountForQuality(3000, "low")).toBe(0);
    expect(particleCountForQuality(1500, "low")).toBe(0);
  });
});
