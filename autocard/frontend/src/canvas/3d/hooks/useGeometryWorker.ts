import { useEffect, useRef, useState } from "react";
import type { DrawingElement } from "../../../types";

// Lazy singleton — one worker instance shared across hook invocations.
// Vite resolves `new URL(..., import.meta.url)` at build time and bundles
// the worker file separately, so no extra config is needed.
let workerSingleton: Worker | null = null;

function getWorker(): Worker {
  if (!workerSingleton) {
    workerSingleton = new Worker(
      new URL("../../../workers/geometryWorker.ts", import.meta.url),
      { type: "module" },
    );
  }
  return workerSingleton;
}

export interface WallSegmentWorkerResult {
  id:              string;
  centerX:         number;
  centerZ:         number;
  width:           number;
  depth:           number;
  heightOverride?: number;
}

export interface GeometryWorkerResult {
  wallSegments: WallSegmentWorkerResult[];
  centroid:     { cx: number; cz: number };
}

/** Default wall thickness in drawing units (cm) when not specified per-element */
const DEFAULT_WALL_THICKNESS = 20;

/**
 * useGeometryWorker — offloads wall-segment computation to a Web Worker so the
 * main thread (and React render loop) is not blocked by large DXF data sets.
 *
 * @param elements            All drawing elements
 * @param defaultWallThickness Fallback wall depth when element has none
 */
export function useGeometryWorker(
  elements: DrawingElement[],
  defaultWallThickness = DEFAULT_WALL_THICKNESS,
): GeometryWorkerResult {
  const [result, setResult] = useState<GeometryWorkerResult>({
    wallSegments: [],
    centroid:     { cx: 0, cz: 0 },
  });

  // Persist the last-known centroid so the worker can reuse it on subsequent
  // calls (avoids re-computing centroid when only element data changed slightly)
  const prevCentroidRef = useRef({ cx: 0, cz: 0 });

  useEffect(() => {
    if (elements.length === 0) return;

    const worker = getWorker();

    const handler = (e: MessageEvent) => {
      if (e.data.type === "wallsComputed") {
        prevCentroidRef.current = e.data.centroid as { cx: number; cz: number };
        setResult({
          wallSegments: e.data.wallSegments as WallSegmentWorkerResult[],
          centroid:     e.data.centroid as { cx: number; cz: number },
        });
      }
    };

    worker.addEventListener("message", handler);
    worker.postMessage({
      type:                 "computeWalls",
      elements,
      cx:                   prevCentroidRef.current.cx,
      cz:                   prevCentroidRef.current.cz,
      defaultWallThickness,
    });

    return () => worker.removeEventListener("message", handler);
  }, [elements, defaultWallThickness]);

  return result;
}
