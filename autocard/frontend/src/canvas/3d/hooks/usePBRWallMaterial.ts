import { useEffect, useMemo } from "react";
import { createTriplanarWallMaterial } from "../materials/TriplanarWallMaterial";

interface UsePBRWallMaterialOptions {
  color?: string;
  roughness?: number;
  enabled?: boolean;  // false = fall back to MeshStandardMaterial
}

export function usePBRWallMaterial(options: UsePBRWallMaterialOptions = {}) {
  const material = useMemo(() => {
    if (options.enabled === false) return null;
    return createTriplanarWallMaterial({
      color:     options.color     ?? "#c8bfb0",
      roughness: options.roughness ?? 0.85,
    });
  }, [options.color, options.roughness, options.enabled]);

  // Every wall calls this hook, and the toggle/facade-preset picker both recompute
  // the memo live — without disposing the outgoing ShaderMaterial (and its compiled
  // GPU program) here, repeated toggling/preset-switching leaks one orphan per wall
  // per change. Effect cleanup fires right before `material` changes and on unmount.
  useEffect(() => {
    return () => {
      material?.dispose();
    };
  }, [material]);

  return material;
}
