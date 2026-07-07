// Construction assemblies for the wall tool's layer picker — each preset is
// an ordered list of layers from one face to the other, matching the
// MaterialService preset names so the same texture/color renders per layer.
export interface WallAssemblyPreset {
  id: string;
  label: string;
  layers: { material: string; thicknessMm: number }[];
}

export const WALL_ASSEMBLY_PRESETS: WallAssemblyPreset[] = [
  { id: "brick100",  label: "Gạch 100mm",      layers: [{ material: "brick", thicknessMm: 100 }] },
  { id: "brick200",  label: "Gạch 200mm",      layers: [{ material: "brick", thicknessMm: 200 }] },
  { id: "insulated", label: "3 lớp cách nhiệt", layers: [{ material: "brick", thicknessMm: 100 }, { material: "insulation", thicknessMm: 50 }, { material: "drywall", thicknessMm: 12 }] },
  { id: "drywall",   label: "Vách thạch cao",   layers: [{ material: "drywall", thicknessMm: 12 }, { material: "steel_stud", thicknessMm: 75 }, { material: "drywall", thicknessMm: 12 }] },
];
