import { describe, it, expect } from "vitest";
import { timeOfDayToWindowEmissive } from "./windowEmissive";

describe("timeOfDayToWindowEmissive", () => {
  it("is near-zero intensity at midday", () => {
    const { intensity } = timeOfDayToWindowEmissive(12);
    expect(intensity).toBeCloseTo(0, 5);
  });

  it("is at its brightest at night", () => {
    const midnight = timeOfDayToWindowEmissive(0);
    const lateNight = timeOfDayToWindowEmissive(22);
    expect(midnight.intensity).toBeGreaterThan(1);
    expect(lateNight.intensity).toBeGreaterThan(1);
  });

  it("ramps monotonically upward through dusk", () => {
    const samples = [16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5].map(
      (h) => timeOfDayToWindowEmissive(h).intensity,
    );
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
    // Confirms the ramp actually moves, not just non-decreasing at a flat 0/max.
    expect(samples[samples.length - 1]).toBeGreaterThan(samples[0]);
  });

  it("ramps monotonically downward through dawn", () => {
    const samples = [4, 5, 5.5, 6, 6.5, 7, 7.5, 8].map(
      (h) => timeOfDayToWindowEmissive(h).intensity,
    );
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1]);
    }
    expect(samples[0]).toBeGreaterThan(samples[samples.length - 1]);
  });

  it("uses a warm interior-light color regardless of time", () => {
    expect(timeOfDayToWindowEmissive(12).color).toBe("#ffd9a0");
    expect(timeOfDayToWindowEmissive(22).color).toBe("#ffd9a0");
  });

  it("normalizes out-of-range hours (e.g. 24 -> 0, negative wraps)", () => {
    expect(timeOfDayToWindowEmissive(24).intensity).toBeCloseTo(
      timeOfDayToWindowEmissive(0).intensity,
      5,
    );
    expect(timeOfDayToWindowEmissive(-2).intensity).toBeCloseTo(
      timeOfDayToWindowEmissive(22).intensity,
      5,
    );
  });
});
