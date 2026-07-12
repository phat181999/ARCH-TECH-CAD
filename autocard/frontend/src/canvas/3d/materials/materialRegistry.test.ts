import { describe, it, expect, vi } from "vitest";
import { MaterialRegistry, parseCatalog, parseObjectTypes } from "./materialRegistry";

describe("parseCatalog", () => {
  it("keeps valid entries and skips invalid ones with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { materials, skipped } = parseCatalog({ materials: [
      { id: "a", family: "F", name: "A", color: "#fff", objectTypes: ["wall"] },
      { id: "bad-no-color", family: "F", name: "B", objectTypes: ["wall"] },
      { family: "F", name: "no-id", color: "#000", objectTypes: ["wall"] },
    ]});
    expect(materials.map(m => m.id)).toEqual(["a"]);
    expect(skipped).toBe(2);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
  it("returns nothing for a malformed root", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseCatalog(null).materials).toEqual([]);
    expect(parseCatalog({ nope: 1 }).materials).toEqual([]);
    warn.mockRestore();
  });
});

describe("parseObjectTypes", () => {
  it("keeps valid entries and skips invalid ones", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { objectTypes } = parseObjectTypes({ objectTypes: [
      { id: "wall", label: "Tường", materialFamilies: ["Sơn"] },
      { id: "broken" },
    ]});
    expect(objectTypes.map(t => t.id)).toEqual(["wall"]);
    warn.mockRestore();
  });
});

describe("MaterialRegistry (bundled seed)", () => {
  it("resolves every legacy MATERIAL_PRESETS id", () => {
    for (const id of ["concrete","brick","wood","glass","steel","marble","plaster","insulation","drywall","steel_stud","roof_tile"]) {
      expect(MaterialRegistry.get(id), id).toBeDefined();
    }
  });
  it("filters materials by object type", () => {
    const walls = MaterialRegistry.getByObjectType("wall");
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.every(m => m.objectTypes.includes("wall"))).toBe(true);
    expect(MaterialRegistry.getByObjectType("floor").some(m => m.id === "w-b1")).toBe(false);
  });
  it("returns families in object-types.json order", () => {
    expect(MaterialRegistry.getFamilies("wall")).toEqual(["Cơ bản", "Gạch xây", "Sơn", "Ốp ngoại thất", "Lớp cấu tạo"]);
  });
  it("lists object types and exposes mep fixture items", () => {
    const ids = MaterialRegistry.listObjectTypes().map(t => t.id);
    expect(ids).toEqual(expect.arrayContaining(["wall", "floor", "mep_fixture"]));
    expect(MaterialRegistry.getObjectType("mep_fixture")?.items?.switch).toEqual({ label: "Công tắc", heightCm: 110 });
  });
  it("unknown id → undefined; unknown type → empty list", () => {
    expect(MaterialRegistry.get("nope")).toBeUndefined();
    expect(MaterialRegistry.getByObjectType("nope")).toEqual([]);
    expect(MaterialRegistry.getFamilies("nope")).toEqual([]);
  });
});
