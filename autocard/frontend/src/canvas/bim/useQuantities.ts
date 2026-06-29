import { useMemo } from "react";
import { useDrawingStore } from "../../stores/drawingStore";
import { computeAllQuantities, summarizeQuantities } from "./quantityEngine";
import type { QuantityMap, QuantitySummary } from "./quantityEngine";

const DEFAULT_WALL_HEIGHT = 3000; // mm

export function useQuantities(): {
  quantities: QuantityMap;
  summary: QuantitySummary;
} {
  const elements = useDrawingStore((s) => s.elements);

  const quantities = useMemo(
    () => computeAllQuantities(elements, DEFAULT_WALL_HEIGHT),
    [elements],
  );

  const summary = useMemo(
    () => summarizeQuantities(elements, quantities),
    [elements, quantities],
  );

  return { quantities, summary };
}
