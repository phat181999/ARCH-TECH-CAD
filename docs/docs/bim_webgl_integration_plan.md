# Plan: BIM Integration + WebGL Upgrade

## Tổng quan

Hai hướng song song:

| Track | Mục tiêu | Kết quả |
|-------|----------|---------|
| **BIM** | Property sets → IFC import → Quantity takeoff → Clash detection | App đọc/ghi file của toàn bộ industry; estimation chính xác; phát hiện xung đột tự động |
| **WebGL** | Custom shader pipeline + performance optimization | Scene 10k+ elements vẫn 60fps; visual đẹp hơn Revit web |

---

## Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────┐
│                    BIM Data Layer                            │
│                                                             │
│  IFC File ──► web-ifc (WASM) ──► IfcModel                  │
│                                      ↓                      │
│                             BimPropertyStore                 │
│                          (property sets, psets)              │
│                                      ↓                      │
│                    DrawingElement[] + BimProperties          │
└──────────────────────────────┬──────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ↓                ↓                ↓
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ WebGL Scene  │  │  Quantity    │  │    Clash     │
   │  (upgraded)  │  │  Takeoff     │  │  Detection   │
   │              │  │  (BIM-grade) │  │   Engine     │
   │ Custom shader│  │  Net areas   │  │ Hard/Soft    │
   │ Instanced    │  │  Net volumes │  │ clash report │
   │ LOD system   │  │  Per-element │  │              │
   └──────────────┘  └──────────────┘  └──────────────┘
```

---

## BIM Track

### Phase B1 — Property Sets (Foundation)

#### B1A. Extend DrawingElement với BIM data

Thêm vào `types.ts`:

```ts
// BIM Property Set — mỗi element có thể có nhiều psets
export interface BimPropertySet {
  name: string;          // e.g. "Pset_WallCommon"
  properties: Record<string, BimPropertyValue>;
}

export type BimPropertyValue =
  | { type: "string";  value: string }
  | { type: "number";  value: number; unit?: string }
  | { type: "boolean"; value: boolean }
  | { type: "enum";    value: string; options: string[] };

// BIM Quantities — tính từ geometry, không phải user nhập
export interface BimQuantities {
  length?:        number;   // mm
  width?:         number;   // mm
  height?:        number;   // mm
  grossArea?:     number;   // m² (không trừ openings)
  netArea?:       number;   // m² (đã trừ openings)
  grossVolume?:   number;   // m³
  netVolume?:     number;   // m³
  perimeter?:     number;   // m
}

// Thêm vào DrawingElement interface
export interface DrawingElement {
  // ... existing fields ...
  bimPsets?:      BimPropertySet[];   // IFC property sets
  bimQuantities?: BimQuantities;      // computed quantities
  bimGuid?:       string;             // IFC GlobalId (22-char base64)
  ifcType?:       IfcEntityType;      // IfcWall, IfcDoor, IfcSlab...
  bimLevel?:      number;             // storey index (0-based)
}

export type IfcEntityType =
  | "IfcWall" | "IfcWallStandardCase"
  | "IfcDoor" | "IfcWindow"
  | "IfcSlab" | "IfcRoof"
  | "IfcColumn" | "IfcBeam"
  | "IfcStair" | "IfcRamp"
  | "IfcSpace"
  | "IfcFooting" | "IfcPile"
  | "IfcFlowSegment"    // pipes
  | "IfcDistributionElement";  // MEP generic
```

#### B1B. BimPropertyStore (Zustand slice)

Tạo `/autocard/frontend/src/stores/slices/bimSlice.ts`:

```ts
export interface BimSlice {
  // Global property set templates (user có thể define)
  psetTemplates: Record<string, BimPropertySet>;

  // Per-element overrides (elementId → custom psets)
  elementPsets: Record<string, BimPropertySet[]>;

  // Computed quantities cache (recomputed khi geometry thay đổi)
  quantityCache: Record<string, BimQuantities>;

  // IFC storey levels
  storeys: IfcStorey[];

  // Actions
  setPset(elementId: string, pset: BimPropertySet): void;
  computeQuantities(elementId: string): BimQuantities;
  invalidateQuantityCache(elementIds: string[]): void;
  addStorey(storey: IfcStorey): void;
}

export interface IfcStorey {
  id: string;
  name: string;         // "Tầng trệt", "Tầng 1"...
  elevation: number;    // mm above ground
  floorIndex: number;
}
```

#### B1C. Default Psets theo IfcType

```ts
// canvas/bim/defaultPsets.ts
export const DEFAULT_PSETS: Record<IfcEntityType, BimPropertySet[]> = {
  IfcWall: [
    {
      name: "Pset_WallCommon",
      properties: {
        "Reference":      { type: "string",  value: "" },
        "LoadBearing":    { type: "boolean", value: false },
        "IsExternal":     { type: "boolean", value: false },
        "FireRating":     { type: "enum",    value: "None", options: ["None", "REI 30", "REI 60", "REI 90", "REI 120"] },
        "AcousticRating": { type: "string",  value: "" },
        "SurfaceSpreadOfFlame": { type: "string", value: "" },
      },
    },
  ],
  IfcDoor: [
    {
      name: "Pset_DoorCommon",
      properties: {
        "Reference":       { type: "string", value: "" },
        "FireRating":      { type: "enum",   value: "None", options: ["None", "EI 30", "EI 60", "EI 90"] },
        "SecurityRating":  { type: "string", value: "" },
        "IsExternal":      { type: "boolean", value: false },
        "HandicapAccessible": { type: "boolean", value: false },
      },
    },
  ],
  IfcSlab: [
    {
      name: "Pset_SlabCommon",
      properties: {
        "Reference":   { type: "string",  value: "" },
        "LoadBearing": { type: "boolean", value: true },
        "IsExternal":  { type: "boolean", value: false },
        "FireRating":  { type: "enum",    value: "REI 60", options: ["None", "REI 30", "REI 60", "REI 90", "REI 120"] },
      },
    },
  ],
  // ... other types
};
```

#### B1D. BIM Properties Panel UI

Panel trong RightSidebar khi chọn element — Tab "BIM":

```
┌─ BIM PROPERTIES ──────────────────────────────┐
│  Element: IfcWall  [W-001]                    │
│  IFC GUID: 2O2Fr$t4X7Zf8NOew3FLHP            │
│  Storey: Tầng 1                               │
│                                               │
│  ▼ Pset_WallCommon                           │
│    Load Bearing    [ ○ No  ● Yes ]            │
│    Is External     [ ● No  ○ Yes ]            │
│    Fire Rating     [ REI 60     ▼]            │
│    Acoustic Rating [ Rw 45dB      ]           │
│                                               │
│  ▼ Qto_WallBaseQuantities (auto)             │
│    Length          4,200 mm                   │
│    Height          3,000 mm                   │
│    Net Side Area   11.4 m² (trừ cửa)         │
│    Net Volume      2.28 m³                    │
│                                               │
│  [ + Thêm Property Set ]                      │
└───────────────────────────────────────────────┘
```

---

### Phase B2 — IFC Import (web-ifc)

#### Thư viện

```bash
npm install web-ifc @thatopen/components @thatopen/fragments
```

- `web-ifc`: WebAssembly IFC parser — đọc geometry + property sets từ IFC 2x3/IFC4
- `@thatopen/components`: High-level BIM toolkit (fragment-based rendering, clash, properties)
- `@thatopen/fragments`: Efficient 3D fragment format (nhanh hơn load IFC thô)

#### B2A. IFC Import Pipeline

Tạo `/autocard/frontend/src/canvas/bim/ifcImporter.ts`:

```ts
import * as WEBIFC from "web-ifc";
import { IfcAPI } from "web-ifc";

export async function importIfcFile(buffer: ArrayBuffer): Promise<IfcImportResult> {
  const api = new IfcAPI();
  await api.Init();
  
  const modelId = api.OpenModel(new Uint8Array(buffer));

  // 1. Extract storeys
  const storeys = extractStoreys(api, modelId);

  // 2. Extract elements by type
  const walls     = extractElements(api, modelId, WEBIFC.IFCWALL);
  const doors     = extractElements(api, modelId, WEBIFC.IFCDOOR);
  const windows   = extractElements(api, modelId, WEBIFC.IFCWINDOW);
  const slabs     = extractElements(api, modelId, WEBIFC.IFCSLAB);
  const columns   = extractElements(api, modelId, WEBIFC.IFCCOLUMN);
  const beams     = extractElements(api, modelId, WEBIFC.IFCBEAM);
  const stairs    = extractElements(api, modelId, WEBIFC.IFCSTAIR);
  const spaces    = extractElements(api, modelId, WEBIFC.IFCSPACE);
  const pipes     = extractElements(api, modelId, WEBIFC.IFCFLOWSEGMENT);

  // 3. Extract property sets for each element
  const allElements = [...walls, ...doors, ...windows, ...slabs, ...columns, ...beams, ...stairs, ...pipes];
  for (const el of allElements) {
    el.bimPsets = extractPropertySets(api, modelId, el.ifcExpressId);
    el.bimQuantities = extractQuantities(api, modelId, el.ifcExpressId);
  }

  // 4. Convert geometry to DrawingElement[]
  const drawingElements = convertToDrawingElements(allElements, storeys);

  api.CloseModel(modelId);
  return { elements: drawingElements, storeys };
}

function extractPropertySets(api: IfcAPI, modelId: number, expressId: number): BimPropertySet[] {
  // Traverse IfcRelDefinesByProperties → IfcPropertySet → IfcProperty
  const psets: BimPropertySet[] = [];
  const relProps = api.GetLine(modelId, expressId);
  // ... traverse relationships
  return psets;
}
```

#### B2B. IFC Import Wizard Tab

Thêm tab "IFC" vào Import dialog:

```
┌─ Import File ─────────────────────────────────┐
│  [ DXF ]  [ IFC ● ]  [ Image ]               │
├───────────────────────────────────────────────┤
│                                               │
│  ✅ File: project_rev12.ifc (24.3 MB)        │
│  Phiên bản: IFC 2x3                          │
│                                               │
│  Phát hiện:                                   │
│   • 4 tầng (Tầng hầm → Tầng 3)              │
│   • 1,247 walls                               │
│   • 89 doors, 124 windows                    │
│   • 312 MEP elements                         │
│   • 45 property sets                         │
│                                               │
│  [✓] Import geometry                         │
│  [✓] Import property sets                    │
│  [✓] Import MEP (pipes, ducts)               │
│  [ ] Import furniture/fixtures               │
│                                               │
│  [ Import → ]                                 │
└───────────────────────────────────────────────┘
```

#### B2C. IFC Export Upgrade

Nâng cấp `/autocard/frontend/src/canvas/ifcExporter.ts` hiện có:

- Hiện tại: Chỉ export geometry đơn giản
- Nâng cấp: Export proper IFC 4 với:
  - IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey → elements
  - Đầy đủ property sets từ `bimPsets`
  - GlobalId ổn định (bimGuid)
  - Relationships: IfcRelContainedInSpatialStructure, IfcRelDefinesByProperties
  - IfcOwnerHistory với metadata

---

### Phase B3 — BIM-Grade Quantity Takeoff

#### B3A. QuantityEngine

Tạo `/autocard/frontend/src/canvas/bim/quantityEngine.ts`:

```ts
export class QuantityEngine {
  
  computeWallQuantities(wall: DrawingElement, openings: DrawingElement[]): BimQuantities {
    const length = Math.hypot(wall.x2! - wall.x1!, wall.y2! - wall.y1!);
    const thickness = wall.wallThickness ?? 200; // mm
    const height = wall.wallHeightOverride ?? 3000; // mm

    const grossArea   = (length * height) / 1e6; // m²
    const grossVolume = (length * height * thickness) / 1e9; // m³

    // Trừ openings (cửa, cửa sổ) hosted trên wall này
    const openingArea = openings
      .filter(o => o.hostWall === wall.id || o.hostWallId === wall.id)
      .reduce((sum, o) => sum + (o.openingWidth ?? 0) * (o.height ?? 2100) / 1e6, 0);

    return {
      length,
      height,
      width:       thickness,
      grossArea,
      netArea:     grossArea - openingArea,
      grossVolume,
      netVolume:   grossVolume - (openingArea * thickness / 1000),
    };
  }

  computeSlabQuantities(slab: DrawingElement): BimQuantities {
    if (!slab.points || slab.points.length < 3) return {};
    const area = polygonArea(slab.points) / 1e6; // m²
    const thickness = (slab.slabThickness ?? 150) / 1000; // m
    return {
      grossArea:   area,
      netArea:     area,
      grossVolume: area * thickness,
      netVolume:   area * thickness,
      perimeter:   polygonPerimeter(slab.points) / 1000,
    };
  }

  // Tính cho tất cả elements và cache
  computeAll(elements: DrawingElement[]): Record<string, BimQuantities> {
    const cache: Record<string, BimQuantities> = {};
    const openings = elements.filter(e => e.archType === "door" || e.archType === "window");
    for (const el of elements) {
      if (el.ifcType === "IfcWall") cache[el.id] = this.computeWallQuantities(el, openings);
      if (el.ifcType === "IfcSlab") cache[el.id] = this.computeSlabQuantities(el);
      // ... other types
    }
    return cache;
  }
}
```

#### B3B. Estimation Page Upgrade

Nâng cấp tab "Dự toán" dùng BIM quantities:

```
┌─ DỰ TOÁN (BIM-Grade) ─────────────────────────────────────┐
│  Tổng diện tích sàn (net):   284.5 m²                      │
│  Tổng tường (net, trừ cửa):  892.3 m²                      │
│  Thể tích bê tông:           124.8 m³                       │
│                                                            │
│  ┌─ Chi tiết theo hạng mục ──────────────────────────────┐ │
│  │  Hạng mục     │ Đơn vị │  KL (net) │ Đơn giá │ T.tiền│ │
│  │  Tường gạch   │  m²    │   892.3   │ 280,000 │ 250M  │ │
│  │  Sàn BTCT     │  m³    │    48.2   │1,800,000│  87M  │ │
│  │  Cột BTCT     │  m³    │    12.4   │2,200,000│  27M  │ │
│  │  Cửa đi       │  bộ    │    12     │2,500,000│  30M  │ │
│  │  Cửa sổ       │  m²    │    68.4   │ 950,000 │  65M  │ │
│  └─────────────────────────────────────────────────────┘ │
│  Nguồn: BIM Quantities (net, tự động từ geometry)         │
└────────────────────────────────────────────────────────────┘
```

---

### Phase B4 — Clash Detection

#### B4A. ClashDetector Engine

Tạo `/autocard/frontend/src/canvas/bim/clashDetector.ts`:

```ts
export type ClashType = "hard" | "soft" | "workflow";

export interface Clash {
  id: string;
  type: ClashType;
  severity: "critical" | "major" | "minor";
  elementA: string;  // DrawingElement id
  elementB: string;
  description: string;
  intersectionVolume?: number;  // m³ (hard clash)
  clearanceViolation?: number;  // mm (soft clash)
  position: { x: number; y: number; z: number };  // world position
}

export class ClashDetector {

  detectAll(elements: DrawingElement[]): Clash[] {
    const clashes: Clash[] = [];
    clashes.push(...this.detectHardClashes(elements));
    clashes.push(...this.detectSoftClashes(elements));
    return clashes;
  }

  // Hard clash: elements intersect geometrically
  private detectHardClashes(elements: DrawingElement[]): Clash[] {
    const clashes: Clash[] = [];
    const pipes   = elements.filter(e => e.archType === "pipe");
    const walls   = elements.filter(e => e.archType === "wall");
    const columns = elements.filter(e => e.archType === "column");
    const beams   = elements.filter(e => (e as any).ifcType === "IfcBeam");

    // Pipe vs Wall intersection
    for (const pipe of pipes) {
      for (const wall of walls) {
        const intersection = lineSegmentIntersect3D(pipe, wall);
        if (intersection) {
          clashes.push({
            id: `clash-${pipe.id}-${wall.id}`,
            type: "hard",
            severity: "critical",
            elementA: pipe.id,
            elementB: wall.id,
            description: `Ống ${(pipe as any).pipeSystem ?? "nước"} Ø${(pipe as any).pipeDiameter}mm đâm qua tường`,
            position: intersection,
          });
        }
      }
    }

    // Column vs Beam, Beam vs Slab, etc.
    // ...

    return clashes;
  }

  // Soft clash: clearance zone violation
  private detectSoftClashes(elements: DrawingElement[]): Clash[] {
    const clashes: Clash[] = [];
    const doors = elements.filter(e => e.archType === "door");

    // Door swing clearance (door needs 90° swing space)
    for (const door of doors) {
      const swingZone = computeDoorSwingZone(door);
      for (const el of elements) {
        if (el.id === door.id) continue;
        if (overlapsZone(el, swingZone)) {
          clashes.push({
            id: `clash-${door.id}-${el.id}`,
            type: "soft",
            severity: "major",
            elementA: door.id,
            elementB: el.id,
            description: `Cửa va chạm ${el.archType ?? el.type} khi mở`,
            position: swingZone.center,
          });
        }
      }
    }

    return clashes;
  }
}
```

#### B4B. Clash Report UI

Panel "Clash" trong 3D sidebar:

```
┌─ CLASH DETECTION ────────────────────────────────┐
│  [ Chạy kiểm tra ]          Lần cuối: 14:45      │
│                                                   │
│  🔴 3 lỗi nghiêm trọng                           │
│  🟡 7 cảnh báo                                   │
│                                                   │
│  🔴 Ống nước Ø50mm ⟷ Tường (Tầng 2)             │
│     Tại: x=4200, z=8100                          │
│     [Zoom tới] [Highlight]                       │
│                                                   │
│  🔴 Cột C2 ⟷ Dầm D3 (Tầng 1)                    │
│     Overlap: 0.024m³                             │
│     [Zoom tới] [Highlight]                       │
│                                                   │
│  🟡 Cửa P1 swing ⟷ Tủ bếp (Tầng trệt)           │
│     Khoảng cách thiếu: 120mm                     │
│     [Zoom tới] [Highlight]                       │
│                                                   │
│  [ Export báo cáo BCF ]                           │
└───────────────────────────────────────────────────┘
```

Highlight element vi phạm → đổi màu đỏ trong 3D scene.

Export báo cáo dạng **BCF** (BIM Collaboration Format) — standard format để share clash report với team.

---

## WebGL Track

### Phase W1 — Custom Shader Pipeline

#### W1A. PBR Material System Upgrade

Hiện tại dùng `MeshStandardMaterial` của Three.js. Nâng cấp với custom GLSL shaders:

Tạo `/autocard/frontend/src/canvas/3d/shaders/`:

```
shaders/
  ├── wall.vert.glsl       — wall vertex shader với instance support
  ├── wall.frag.glsl       — wall fragment shader với PBR + triplanar mapping
  ├── ground.vert.glsl     — ground với displacement
  ├── ground.frag.glsl     — PBR ground với 4-way texture blend (season)
  ├── glass.frag.glsl      — window glass: refraction + fresnel
  └── wireframe.frag.glsl  — clean edge rendering cho orthographic views
```

**Wall shader highlights:**

```glsl
// wall.frag.glsl
uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform sampler2D uRoughness;
uniform sampler2D uAO;
uniform float uTriplanarScale;  // texture tiling

// Triplanar mapping — tránh texture stretching trên tường nghiêng
vec4 triplanar(sampler2D tex, vec3 worldPos, vec3 worldNormal) {
  vec3 blendWeights = abs(worldNormal);
  blendWeights = max(blendWeights - 0.2, 0.0);
  blendWeights /= dot(blendWeights, vec3(1.0));
  
  vec4 xPlane = texture2D(tex, worldPos.yz * uTriplanarScale);
  vec4 yPlane = texture2D(tex, worldPos.xz * uTriplanarScale);
  vec4 zPlane = texture2D(tex, worldPos.xy * uTriplanarScale);
  
  return xPlane * blendWeights.x + yPlane * blendWeights.y + zPlane * blendWeights.z;
}

// Screen-space ambient occlusion contribution
uniform sampler2D uSSAO;
```

**Glass shader:**

```glsl
// glass.frag.glsl
uniform samplerCube uEnvMap;
uniform float uIOR;        // Index of Refraction (1.52 for glass)
uniform float uRoughness;  // 0 = perfect mirror, 0.1 = frosted

void main() {
  vec3 viewDir  = normalize(vViewPosition);
  vec3 normal   = normalize(vNormal);
  
  // Fresnel — glass more reflective at glancing angles
  float fresnel = pow(1.0 - dot(viewDir, normal), 5.0);
  fresnel = mix(0.04, 1.0, fresnel);
  
  // Reflection
  vec3 reflectDir = reflect(-viewDir, normal);
  vec3 reflection = textureCube(uEnvMap, reflectDir).rgb;
  
  // Refraction
  vec3 refractDir = refract(-viewDir, normal, 1.0 / uIOR);
  vec3 refraction = textureCube(uEnvMap, refractDir).rgb;
  
  gl_FragColor = vec4(mix(refraction, reflection, fresnel), 0.85);
}
```

#### W1B. Screen-Space Ambient Occlusion (SSAO)

Dùng `@react-three/postprocessing` (đã có post-processing setup):

```tsx
import { SSAO, EffectComposer } from "@react-three/postprocessing";

// Trong ThreeViewer Canvas:
<EffectComposer>
  <SSAO
    radius={0.4}
    intensity={30}
    luminanceInfluence={0.6}
    color="black"
    samples={16}
    rings={4}
    distanceThreshold={1.0}
    distanceFalloff={0.0}
    rangeThreshold={0.5}
    rangeFalloff={0.1}
    bias={0.5}
  />
</EffectComposer>
```

SSAO tạo bóng tiếp xúc giữa các bề mặt — hiệu ứng khiến scene trông "có chiều sâu" hơn đáng kể mà không cần raytracing.

#### W1C. Edge Detection + Toon Shading (tuỳ chọn)

Cho mode "Architectural Sketch" — vẽ viền rõ nét như bản vẽ tay:

```tsx
import { Outline, EdgeDetection } from "@react-three/postprocessing";

<Outline
  selection={selectedObjects}
  edgeStrength={3.0}
  pulseSpeed={0}
  visibleEdgeColor={0x000000}
  hiddenEdgeColor={0x22b4c8}
  width={2}
/>
```

---

### Phase W2 — Performance Optimization

#### W2A. Level of Detail (LOD) System

Tạo `/autocard/frontend/src/canvas/3d/lod/LodManager.ts`:

```ts
// Tự động switch detail level theo camera distance
export class LodManager {
  private cameraDistance = 0;

  getLodLevel(objectDistance: number): "HIGH" | "MED" | "LOW" {
    if (objectDistance < 500)   return "HIGH";  // full detail + textures
    if (objectDistance < 2000)  return "MED";   // no textures, simplified geo
    return "LOW";                                // box representation only
  }
}

// Áp dụng cho WallMesh:
function WallMeshLod({ segment, distance }: ...) {
  const lod = useLodManager(distance);
  
  if (lod === "HIGH") return <DetailedWallMesh segment={segment} />;
  if (lod === "MED")  return <SimplifiedWallMesh segment={segment} />;
  return <BoxWallMesh segment={segment} />;
}
```

#### W2B. Instanced Rendering Expansion

Hiện có `InstancedWallsMesh` — expand sang tất cả element types:

```ts
// canvas/3d/components/InstancedElementsMesh.tsx

// Group elements theo type và geometry signature
const wallInstances   = useInstancedMesh(walls, wallGeometry, wallMaterial);
const columnInstances = useInstancedMesh(columns, columnGeometry, concreteMaterial);
const windowInstances = useInstancedMesh(windows, windowGeometry, glassMaterial);

// Một draw call cho mỗi nhóm — từ 1000 draw calls → <10
```

#### W2C. Web Worker cho heavy computation

Tạo `/autocard/frontend/src/workers/`:

```
workers/
  ├── geometryWorker.ts   — tính WallSegment[], planCentroid, room detection
  ├── clashWorker.ts      — clash detection (CPU intensive, off main thread)
  └── quantityWorker.ts   — compute BIM quantities cho toàn bộ model
```

```ts
// geometryWorker.ts
self.onmessage = (e: MessageEvent<{ elements: DrawingElement[] }>) => {
  const { elements } = e.data;
  
  // Heavy computation off main thread
  const wallSegments = computeWallSegments(elements);
  const centroid     = computePlanCentroid(wallSegments);
  const rooms        = detectRooms(elements);
  
  self.postMessage({ wallSegments, centroid, rooms });
};
```

#### W2D. Frustum Culling tường rõ ràng

Three.js đã có frustum culling nhưng per-object. Với BIM models lớn, cần:

```ts
// Spatial index dùng Octree
import { MeshBVH } from "three-mesh-bvh";

// Build BVH một lần sau import
const bvh = new MeshBVH(mergedGeometry);

// Raycast nhanh hơn 100x cho selection và clash detection
raycaster.firstHitOnly = true;
const hit = bvh.raycastFirst(ray);
```

#### W2E. Texture Atlas

Thay vì load nhiều texture files riêng lẻ, pack vào atlas:

```
TextureAtlas 4096×4096
├── Gạch đặc (512×512)
├── Bê tông (512×512)
├── Gỗ (512×512)
├── Đá granite (512×512)
├── Kính (256×256)
└── ...
```

Một texture bind → giảm GPU state changes đáng kể.

---

### Phase W3 — WebGPU Upgrade Path

#### W3A. Detection + Fallback

```ts
// canvas/3d/gpu/gpuCapabilities.ts
export async function detectGPUCapabilities() {
  const hasWebGPU = "gpu" in navigator;
  if (!hasWebGPU) return { backend: "webgl2" as const };

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { backend: "webgl2" as const };

  return {
    backend: "webgpu" as const,
    maxBufferSize: adapter.limits.maxBufferSize,
    maxTextureSize: adapter.limits.maxTextureDimension2D,
  };
}
```

#### W3B. React Three Fiber WebGPU mode

R3F đã support WebGPU trong v9:

```tsx
import { Canvas } from "@react-three/fiber";

<Canvas
  gl={(canvas) => {
    // WebGPU renderer khi supported, fallback WebGL2
    if (gpuCapabilities.backend === "webgpu") {
      const renderer = new THREE.WebGPURenderer({ canvas });
      return renderer;
    }
    return new THREE.WebGLRenderer({ canvas, antialias: true });
  }}
>
```

WebGPU benefits: Compute shaders (clash detection on GPU), bindless textures, better multi-threading.

---

## File Change Map

| File | Thay đổi | Phase |
|------|----------|-------|
| `types.ts` | Thêm BimPropertySet, BimQuantities, IfcEntityType vào DrawingElement | B1 |
| `stores/slices/bimSlice.ts` | **NEW** — psets, quantities cache, storeys | B1 |
| `stores/drawingStore.ts` | Thêm bimSlice | B1 |
| `canvas/bim/defaultPsets.ts` | **NEW** — default property sets per IfcType | B1 |
| `canvas/3d/components/BimPropertiesPanel.tsx` | **NEW** — BIM tab trong RightSidebar | B1 |
| `canvas/bim/ifcImporter.ts` | **NEW** — web-ifc import pipeline | B2 |
| `canvas/ifcExporter.ts` | **UPGRADE** — proper IFC4 với psets + relationships | B2 |
| `components/DxfImportWizard.tsx` | Thêm IFC tab | B2 |
| `canvas/bim/quantityEngine.ts` | **NEW** — net quantity computation | B3 |
| `pages/EstimationPage.tsx` | Upgrade dùng BIM quantities thay vì rough estimate | B3 |
| `canvas/bim/clashDetector.ts` | **NEW** — hard/soft clash detection | B4 |
| `canvas/3d/components/ThreeViewerUI.tsx` | Thêm Clash tab + BIM Properties tab | B4 |
| `canvas/3d/shaders/*.glsl` | **NEW** — wall, glass, ground PBR shaders | W1 |
| `components/ThreeViewer.tsx` | SSAO + Edge detection post-processing | W1 |
| `canvas/3d/lod/LodManager.ts` | **NEW** — distance-based LOD | W2 |
| `canvas/3d/components/InstancedElementsMesh.tsx` | **NEW** — instanced columns, windows | W2 |
| `workers/geometryWorker.ts` | **NEW** — off-thread geometry computation | W2 |
| `workers/clashWorker.ts` | **NEW** — off-thread clash detection | W2 |
| `canvas/3d/gpu/gpuCapabilities.ts` | **NEW** — WebGPU detection + fallback | W3 |

---

## Thứ tự implementation (Priority order)

| Priority | Phase | Deliverable | Impact | Thời gian |
|----------|-------|------------|--------|-----------|
| 🔴 P0 | B1 | Property sets + BimSlice | Foundation cho tất cả | 2 ngày |
| 🔴 P0 | W2 | Web Worker + Instanced rendering | Performance fix ngay | 2 ngày |
| 🟠 P1 | B2 | IFC import (web-ifc) | Mở file Revit/ArchiCAD | 3 ngày |
| 🟠 P1 | W1 | Custom shaders + SSAO | Visual upgrade | 3 ngày |
| 🟡 P2 | B3 | BIM quantity takeoff | Estimation chính xác | 2 ngày |
| 🟡 P2 | B4 | Clash detection | Differentiator cao | 3 ngày |
| 🟢 P3 | W3 | WebGPU upgrade path | Future-proof | 2 ngày |

**Tổng: ~17 ngày** để có BIM + WebGL hoàn chỉnh.

---

## Stack mới sau khi hoàn thành

```
Frontend:
  Three.js r184 + WebGPU renderer (fallback WebGL2)
  @react-three/fiber v9
  @react-three/postprocessing (SSAO, Outline, Bloom)
  web-ifc (WASM IFC parser)
  @thatopen/components (BIM toolkit)
  three-mesh-bvh (spatial indexing)
  Custom GLSL shaders (PBR triplanar, glass, SSAO)

Data:
  DrawingElement[] + BimPropertySet[] (property sets)
  BimQuantities (computed net quantities)
  Clash[] (detected conflicts)
  IfcStorey[] (building levels)
```

---

## Competitive Position sau khi hoàn thành

| Feature | ARCH-TECH-CAD | AutoCAD Web | BIMcloud | Speckle |
|---------|--------------|-------------|----------|---------|
| IFC import/export | ✅ | ❌ | ✅ | ✅ |
| BIM property sets | ✅ | ❌ | ✅ | ✅ |
| Clash detection | ✅ | ❌ | ✅ | Partial |
| AI TCVN review | ✅ | ❌ | ❌ | ❌ |
| WebGPU rendering | ✅ | ❌ | ❌ | ❌ |
| Tiếng Việt native | ✅ | ❌ | ❌ | ❌ |
| Free tier | ✅ | Limited | ❌ | ✅ |
| Vietnam market fit | ✅✅ | ❌ | ❌ | ❌ |

---

## Non-Goals

- Full structural FEA (finite element analysis) — dùng plugin riêng
- MEP load calculations (chỉ layout, không sizing)
- Geotechnical analysis
- 4D BIM (construction scheduling animation)
- Cost database tự build — tích hợp API giá VLXD đã có
