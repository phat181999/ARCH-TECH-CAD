import { describe, it, expect } from "vitest";
import { parseNumericInput } from "./numericInput";

describe("parseNumericInput", () => {
  it("parses a plain number as meters", () => {
    expect(parseNumericInput("3.5")).toBe(3.5);
  });
  it("trims whitespace", () => {
    expect(parseNumericInput(" 2 ")).toBe(2);
  });
  it("rejects empty, zero, negative and garbage", () => {
    expect(parseNumericInput("")).toBeNull();
    expect(parseNumericInput("0")).toBeNull();
    expect(parseNumericInput("-3")).toBeNull();
    expect(parseNumericInput("abc")).toBeNull();
    expect(parseNumericInput("1.2.3")).toBeNull();
  });
});
