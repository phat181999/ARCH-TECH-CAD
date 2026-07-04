import type { StateCreator } from "zustand";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Weather = "sunny" | "overcast" | "rainy" | "stormy" | "foggy" | "snowy";
export type NeighborhoodContext = "none" | "suburban" | "urban" | "rural" | "highrise";

export interface SceneSlice {
  season: Season;
  weather: Weather;
  timeOfDay: number;               // 0–24
  neighborhoodContext: NeighborhoodContext;
  neighborCount: number;           // 0–6
  undergroundSectionDepth: number; // cm, 0 = no section cut
  enableSSAO: boolean;
  enablePBRShaders: boolean;
  useTextures: boolean;
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
  season: "summer",
  weather: "sunny",
  timeOfDay: 14,
  neighborhoodContext: "none",
  neighborCount: 0,
  undergroundSectionDepth: 0,
  enableSSAO: true,
  enablePBRShaders: false,
  useTextures: true,
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
