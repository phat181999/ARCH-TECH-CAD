import { describe, it, expect } from "vitest";
import { nextSectionCutLabel } from "./sectionCutLabel";

describe("nextSectionCutLabel", () => {
  it("labels the first cut A-A", () => expect(nextSectionCutLabel(0)).toBe("A-A"));
  it("labels the second cut B-B", () => expect(nextSectionCutLabel(1)).toBe("B-B"));
  it("labels the 26th cut Z-Z", () => expect(nextSectionCutLabel(25)).toBe("Z-Z"));
  it("wraps back to A-A after Z-Z", () => expect(nextSectionCutLabel(26)).toBe("A-A"));
});
