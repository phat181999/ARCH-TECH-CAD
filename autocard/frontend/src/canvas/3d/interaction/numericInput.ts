// Parses the numeric-entry buffer typed while drawing. Value is in meters.
export function parseNumericInput(buffer: string): number | null {
  const s = buffer.trim();
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const v = parseFloat(s);
  return Number.isFinite(v) && v > 0 ? v : null;
}
