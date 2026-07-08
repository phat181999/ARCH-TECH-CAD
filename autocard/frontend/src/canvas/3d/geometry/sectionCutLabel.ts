// Auto-labels section cuts A-A, B-B, C-C... in creation order.
export function nextSectionCutLabel(existingCount: number): string {
  const letter = String.fromCharCode(65 + (existingCount % 26));
  return `${letter}-${letter}`;
}
