import { useMemo } from "react";
import { createTriplanarWallMaterial } from "../materials/TriplanarWallMaterial";

interface UsePBRWallMaterialOptions {
  color?: string;
  roughness?: number;
  enabled?: boolean;  // false = fall back to MeshStandardMaterial
}

export function usePBRWallMaterial(options: UsePBRWallMaterialOptions = {}) {
  return useMemo(() => {
    if (options.enabled === false) return null;
    return createTriplanarWallMaterial({
      color:     options.color     ?? "#c8bfb0",
      roughness: options.roughness ?? 0.85,
    });
  }, [options.color, options.roughness, options.enabled]);
}
