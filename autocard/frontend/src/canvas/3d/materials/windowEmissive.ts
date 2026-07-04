/**
 * Maps the scene's time-of-day (hours, 0–24) to a warm interior-light glow
 * for window glass: dark/off at midday, ramping up through dusk, brightest at night.
 */
export interface WindowEmissive {
  color: string;
  intensity: number;
}

const WINDOW_LIGHT_COLOR = "#ffd9a0"; // warm incandescent interior glow
const MAX_INTENSITY = 1.4;

// Dusk ramp window — lights start switching on ~1.5h before sunset (18:00)
// and are fully on by full dark (~1.5h after sunset).
const DUSK_START = 16.5;
const NIGHT_START = 19.5;
// Mirror ramp for dawn — lights fade out over the same window in reverse.
const DAWN_START = 5.0;
const DAY_START = 7.5;

/**
 * Pure function: time-of-day (0–24) -> window emissive color/intensity.
 * Smoothly ramps intensity from 0 (day) to MAX_INTENSITY (night) across
 * dusk/dawn transition windows so lights don't snap on/off.
 */
export function timeOfDayToWindowEmissive(timeOfDay: number): WindowEmissive {
  const h = ((timeOfDay % 24) + 24) % 24; // normalize into [0, 24)

  let t: number; // 0 = daylight, 1 = full night
  if (h >= NIGHT_START || h < DAWN_START) {
    t = 1;
  } else if (h >= DUSK_START && h < NIGHT_START) {
    t = (h - DUSK_START) / (NIGHT_START - DUSK_START);
  } else if (h >= DAWN_START && h < DAY_START) {
    t = 1 - (h - DAWN_START) / (DAY_START - DAWN_START);
  } else {
    t = 0;
  }

  return {
    color: WINDOW_LIGHT_COLOR,
    intensity: t * MAX_INTENSITY,
  };
}
