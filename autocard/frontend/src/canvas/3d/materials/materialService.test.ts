import { describe, it, expect } from "vitest";
import { MaterialService, catalogToMaterialProps } from "./materialService";
import { MaterialRegistry } from "./materialRegistry";

describe("MaterialService registry integration", () => {
  it("legacy preset ids resolve with their historical colors", () => {
    const expected: Record<string, string> = {
      concrete: "#8c8d8a", brick: "#b55a30", wood: "#b48a53", glass: "#c8e8f4",
      steel: "#9ca3af", marble: "#e8eae6", plaster: "#f5f5f0",
      insulation: "#fde68a", drywall: "#ece9e2", steel_stud: "#94a3b8", roof_tile: "#994d3d",
    };
    for (const [id, color] of Object.entries(expected)) {
      expect(catalogToMaterialProps(MaterialRegistry.get(id)!).color, id).toBe(color);
    }
  });
  it("getPresetList keeps the same 8 quick-access entries", () => {
    expect(MaterialService.getPresetList()).toEqual([
      { id: "plaster",   label: "Vôi trát",    color: "#f5f5f0" },
      { id: "concrete",  label: "Bê tông",     color: "#8c8d8a" },
      { id: "brick",     label: "Gạch đỏ",     color: "#b55a30" },
      { id: "wood",      label: "Gỗ",          color: "#b48a53" },
      { id: "steel",     label: "Thép",        color: "#9ca3af" },
      { id: "marble",    label: "Đá cẩm thạch",color: "#e8eae6" },
      { id: "glass",     label: "Kính",        color: "#c8e8f4" },
      { id: "roof_tile", label: "Ngói mái",    color: "#994d3d" },
    ]);
  });
  it("pattern maps to procedural texture paths; explicit maps win", () => {
    expect(catalogToMaterialProps(MaterialRegistry.get("w-b1")!).albedoMap).toBe("/textures/brick/albedo.jpg");
    expect(catalogToMaterialProps(MaterialRegistry.get("f-s1")!).albedoMap).toBe("/textures/marble/albedo.jpg");
    expect(catalogToMaterialProps(MaterialRegistry.get("w-p1")!).albedoMap).toBeUndefined();
    expect(catalogToMaterialProps(MaterialRegistry.get("concrete")!).albedoMap).toBe("/textures/concrete/albedo.jpg");
  });
  it("unknown id falls back to plaster", () => {
    const m = MaterialService.getMaterial("definitely-not-a-material");
    const plaster = MaterialService.getMaterial("plaster");
    expect(m.color.getHexString()).toBe(plaster.color.getHexString());
  });
});
