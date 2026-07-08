import type { StateCreator } from "zustand";
import type { RidgeLine } from "../../canvas/3d/geometry/roofRidge";
import { nextSectionCutLabel } from "../../canvas/3d/geometry/sectionCutLabel";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Weather = "sunny" | "overcast" | "rainy" | "stormy" | "foggy" | "snowy";
export type NeighborhoodContext = "none" | "suburban" | "urban" | "rural" | "highrise";

export interface SectionState { enabled: boolean; axis: "x" | "y" | "z"; offset: number }

export interface SceneSlice {
  section: SectionState;
  roofRidge: RidgeLine | null;
  sectionCuts: { id: string; label: string; line: RidgeLine }[];
  season: Season;
  weather: Weather;
  timeOfDay: number;               // 0–24
  neighborhoodContext: NeighborhoodContext;
  neighborCount: number;           // 0–6
  undergroundSectionDepth: number; // cm, 0 = no section cut
  enableSSAO: boolean;
  enablePBRShaders: boolean;
  useTextures: boolean;
  setSection(patch: Partial<SectionState>): void;
  setRoofRidge(r: RidgeLine | null): void;
  addSectionCut(line: RidgeLine): void;
  removeSectionCut(id: string): void;
  setSeason(s: Season): void;
  setWeather(w: Weather): void;
  setTimeOfDay(h: number): void;
  setNeighborhoodContext(c: NeighborhoodContext): void;
  setNeighborCount(n: number): void;
  setUndergroundSectionDepth(d: number): void;
  setEnableSSAO(v: boolean): void;
  setEnablePBRShaders(v: boolean): void;
  setUseTextures(v: boolean): void;
}

export const createSceneSlice: StateCreator<SceneSlice, [], [], SceneSlice> = (set) => ({
  section: { enabled: false, axis: "x", offset: 0 },
  roofRidge: null,
  sectionCuts: [],
  season: "summer",
  weather: "sunny",
  timeOfDay: 14,
  neighborhoodContext: "none",
  neighborCount: 0,
  undergroundSectionDepth: 0,
  enableSSAO: true,
  enablePBRShaders: false,
  useTextures: true,
  setSection: (patch) => set((s) => ({ section: { ...s.section, ...patch } })),
  setRoofRidge: (roofRidge) => set({ roofRidge }),
  addSectionCut: (line) => set((s) => ({
    sectionCuts: [...s.sectionCuts, { id: `cut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: nextSectionCutLabel(s.sectionCuts.length), line }],
  })),
  removeSectionCut: (id) => set((s) => ({ sectionCuts: s.sectionCuts.filter((c) => c.id !== id) })),
  setSeason: (season) => set({ season }),
  setWeather: (weather) => set({ weather }),
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  setNeighborhoodContext: (neighborhoodContext) => set({ neighborhoodContext }),
  setNeighborCount: (neighborCount) => set({ neighborCount }),
  setUndergroundSectionDepth: (undergroundSectionDepth) => set({ undergroundSectionDepth }),
  setEnableSSAO: (enableSSAO) => set({ enableSSAO }),
  setEnablePBRShaders: (enablePBRShaders) => set({ enablePBRShaders }),
  setUseTextures: (useTextures) => set({ useTextures }),
});
