import { useSyncExternalStore } from "react";
import catalogSeed from "./config/materials.catalog.json";
import objectTypesSeed from "./config/object-types.json";

export interface CatalogMaterial {
  id: string; family: string; name: string; color: string;
  objectTypes: string[];
  pattern?: "brick" | "stone" | "wood" | "tile" | "shingle";
  note?: string;
  roughness?: number; metalness?: number;
  transparent?: boolean; opacity?: number; side?: "double" | "front" | "back";
  albedoMap?: string; normalMap?: string; roughnessMap?: string;
  quickAccess?: boolean;
}
export interface MepFixtureDef { label: string; heightCm: number }
export interface ObjectTypeDef {
  id: string; label: string; materialFamilies: string[];
  defaultMaterial?: string;
  items?: Record<string, MepFixtureDef>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function parseCatalog(raw: unknown): { materials: CatalogMaterial[]; skipped: number } {
  if (!isRecord(raw) || !Array.isArray(raw.materials)) {
    console.warn("[MaterialRegistry] malformed materials catalog root — using no entries");
    return { materials: [], skipped: 0 };
  }
  const materials: CatalogMaterial[] = [];
  let skipped = 0;
  for (const entry of raw.materials) {
    if (isRecord(entry)
      && typeof entry.id === "string" && typeof entry.family === "string"
      && typeof entry.name === "string" && typeof entry.color === "string"
      && Array.isArray(entry.objectTypes)) {
      materials.push(entry as unknown as CatalogMaterial);
    } else {
      skipped++;
      console.warn("[MaterialRegistry] skipping invalid material entry:", entry);
    }
  }
  return { materials, skipped };
}

export function parseObjectTypes(raw: unknown): { objectTypes: ObjectTypeDef[]; skipped: number } {
  if (!isRecord(raw) || !Array.isArray(raw.objectTypes)) {
    console.warn("[MaterialRegistry] malformed object-types root — using no entries");
    return { objectTypes: [], skipped: 0 };
  }
  const objectTypes: ObjectTypeDef[] = [];
  let skipped = 0;
  for (const entry of raw.objectTypes) {
    if (isRecord(entry) && typeof entry.id === "string" && typeof entry.label === "string" && Array.isArray(entry.materialFamilies)) {
      objectTypes.push(entry as unknown as ObjectTypeDef);
    } else {
      skipped++;
      console.warn("[MaterialRegistry] skipping invalid object-type entry:", entry);
    }
  }
  return { objectTypes, skipped };
}

let materials = new Map(parseCatalog(catalogSeed).materials.map((m) => [m.id, m]));
let objectTypes = new Map(parseObjectTypes(objectTypesSeed).objectTypes.map((t) => [t.id, t]));
let version = 1;
const listeners = new Set<() => void>();

function notify() {
  version++;
  for (const cb of listeners) cb();
}

export class MaterialRegistry {
  static get(id: string): CatalogMaterial | undefined {
    return materials.get(id);
  }
  static getByObjectType(type: string): CatalogMaterial[] {
    return [...materials.values()].filter((m) => m.objectTypes.includes(type));
  }
  static getFamilies(type: string): string[] {
    return objectTypes.get(type)?.materialFamilies ?? [];
  }
  static listObjectTypes(): ObjectTypeDef[] {
    return [...objectTypes.values()];
  }
  static getObjectType(id: string): ObjectTypeDef | undefined {
    return objectTypes.get(id);
  }
  /** Optional runtime override: drop the same JSON files in public/config/
      to change the catalog without a rebuild. Any failure keeps the seed. */
  static async refreshFromServer(): Promise<void> {
    try {
      const [catRes, typesRes] = await Promise.all([
        fetch("/config/materials.catalog.json"),
        fetch("/config/object-types.json"),
      ]);
      if (catRes.ok) {
        const parsed = parseCatalog(await catRes.json());
        if (parsed.materials.length > 0) materials = new Map(parsed.materials.map((m) => [m.id, m]));
      }
      if (typesRes.ok) {
        const parsed = parseObjectTypes(await typesRes.json());
        if (parsed.objectTypes.length > 0) objectTypes = new Map(parsed.objectTypes.map((t) => [t.id, t]));
      }
      if (catRes.ok || typesRes.ok) notify();
    } catch {
      /* offline or no override files — seed stays in effect */
    }
  }
  static subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }
  static getVersion(): number {
    return version;
  }
}

export function useMaterialCatalogVersion(): number {
  return useSyncExternalStore(MaterialRegistry.subscribe, MaterialRegistry.getVersion);
}
