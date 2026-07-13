import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { MaterialService, catalogToMaterialProps, type MaterialProps } from "./materialService";
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
  it("legacy preset ids resolve with their full historical props (catches silent catalog drift)", () => {
    const expected: Record<string, Partial<MaterialProps>> = {
      concrete: {
        color: "#8c8d8a", roughness: 0.85, metalness: 0.05,
        albedoMap: "/textures/concrete/albedo.jpg", normalMap: "/textures/concrete/normal.jpg",
        roughnessMap: "/textures/concrete/roughness.jpg",
      },
      brick: {
        color: "#b55a30", roughness: 0.95, metalness: 0.0,
        albedoMap: "/textures/brick/albedo.jpg", normalMap: "/textures/brick/normal.jpg",
        roughnessMap: "/textures/brick/roughness.jpg",
      },
      wood: {
        color: "#b48a53", roughness: 0.72, metalness: 0.0,
        albedoMap: "/textures/wood/albedo.jpg", normalMap: "/textures/wood/normal.jpg",
        roughnessMap: "/textures/wood/roughness.jpg",
      },
      glass: {
        color: "#c8e8f4", roughness: 0.04, metalness: 0.12,
        transparent: true, opacity: 0.28, side: THREE.DoubleSide,
      },
      steel: { color: "#9ca3af", roughness: 0.22, metalness: 0.9 },
      marble: {
        color: "#e8eae6", roughness: 0.12, metalness: 0.08,
        albedoMap: "/textures/marble/albedo.jpg", normalMap: "/textures/marble/normal.jpg",
      },
      plaster: { color: "#f5f5f0", roughness: 0.88, metalness: 0.0 },
      insulation: { color: "#fde68a", roughness: 0.95, metalness: 0.0 },
      drywall: { color: "#ece9e2", roughness: 0.9, metalness: 0.0 },
      steel_stud: { color: "#94a3b8", roughness: 0.35, metalness: 0.7 },
      roof_tile: {
        color: "#994d3d", roughness: 0.82, metalness: 0.0,
        albedoMap: "/textures/roof_tile/albedo.jpg", normalMap: "/textures/roof_tile/normal.jpg",
      },
    };
    for (const [id, props] of Object.entries(expected)) {
      const actual = catalogToMaterialProps(MaterialRegistry.get(id)!);
      expect(actual.color, `${id}.color`).toBe(props.color);
      expect(actual.roughness, `${id}.roughness`).toBe(props.roughness);
      expect(actual.metalness, `${id}.metalness`).toBe(props.metalness);
      expect(actual.transparent, `${id}.transparent`).toBe(props.transparent);
      expect(actual.opacity, `${id}.opacity`).toBe(props.opacity);
      expect(actual.side, `${id}.side`).toBe(props.side);
      expect(actual.albedoMap, `${id}.albedoMap`).toBe(props.albedoMap);
      expect(actual.normalMap, `${id}.normalMap`).toBe(props.normalMap);
      expect(actual.roughnessMap, `${id}.roughnessMap`).toBe(props.roughnessMap);
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
