// Wall-mounted MEP fixture catalog — labels + default mounting heights from
// the house-planner demo (công tắc ~1.1m, ổ cắm ~0.3m, hộp nối gần trần…).
export type MepFixtureType = "switch" | "socket" | "juncbox" | "dboard" | "valve" | "elbow";

export const MEP_FIXTURES: Record<MepFixtureType, { label: string; heightCm: number }> = {
  switch:  { label: "Công tắc",  heightCm: 110 },
  socket:  { label: "Ổ cắm",     heightCm: 30 },
  juncbox: { label: "Hộp nối",   heightCm: 235 },
  dboard:  { label: "Tủ điện",   heightCm: 150 },
  valve:   { label: "Van cầu",   heightCm: 55 },
  elbow:   { label: "Co ống",    heightCm: 30 },
};
