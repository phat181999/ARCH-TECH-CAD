# Plan: Smart DXF Import — Cluster Detection, Layer Filter & Floor Assignment

## Vấn đề

Khi import file DXF từ AutoCAD, Model Space thường chứa **nhiều loại nội dung trộn lẫn** trên cùng một không gian phẳng:

- Nhiều mặt bằng tầng xếp cạnh nhau (tầng 1, tầng 2, tầng 3…)
- Mặt cắt, mặt đứng, chi tiết kiến trúc
- Bảng cửa, bảng cửa sổ (schedule)
- Title block, khung bản vẽ, ghi chú

App hiện tại import toàn bộ vào store rồi render 3D → **3D breaking** vì chi tiết cửa, bảng schedule, mặt cắt đều bị đẩy vào scene như thể chúng là tường/sàn của một ngôi nhà.

---

## Tại sao các app chuyên nghiệp không có vấn đề này

| App | Cách xử lý |
|-----|-----------|
| **Revit** | 3D model là nguồn gốc. 2D view (mặt bằng, mặt cắt) được *generate từ 3D*, không import ngược lại |
| **ArchiCAD** | Tương tự Revit — BIM-first |
| **AutoCAD** | Không có 3D render từ 2D plan — chỉ là 2D drafting tool |
| **SketchUp** | Import DXF nhưng yêu cầu user chọn thủ công đâu là floor plan |

ARCH-TECH-CAD đang làm thứ khó nhất: **tự động suy ra 3D từ 2D DXF** — cần pipeline thông minh hơn.

---

## Luồng hiện tại (Current Flow)

```
DXF file
  └─► dxfToElements()          ← canvas/dxf.ts
        └─► DrawingElement[]
              └─► DXF Wizard   ← show layer list, unit, scale
                    └─► importDrawingState() / mergeDrawingState()
                          └─► Zustand store (elements[])
                                └─► ThreeViewer render toàn bộ
```

**Vấn đề**: Không có bước phân tích spatial — mọi element đều vào 3D.

---

## Luồng đề xuất (Target Flow)

```
DXF file
  └─► dxfToElements()
        └─► DrawingElement[]
              └─► clusterElements()        ← NEW: canvas/dxf/clusterDetection.ts
                    └─► DxfCluster[]
                          └─► classifyClusters()   ← NEW: phân loại loại cluster
                                └─► DXF Import Wizard v2  ← UPGRADED
                                      ├─ Tab 1: Layers (đã có)
                                      ├─ Tab 2: Clusters   ← NEW
                                      │    └─ assign tầng / bỏ qua
                                      └─► importWithFloorStack()  ← NEW
                                            └─► Zustand store
                                                  └─► ThreeViewer (clean 3D)
```

---

## Kiến trúc chi tiết

### Data Types mới

```ts
// canvas/dxf/types.ts (NEW)

export interface DxfCluster {
  id: string;
  elements: DrawingElement[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  centroid: { x: number; y: number };
  area: number;               // bbox area — dùng để ưu tiên clusters lớn
  elementCount: number;
  wallCount: number;          // walls detected in cluster
  textCount: number;          // text/dim elements
  hasClosedPerimeter: boolean; // likely a floor plan if true
  clusterType: ClusterType;   // auto-classified
  floorAssignment?: number;   // 0-based floor index, undefined = ignored
  floorHeightCm?: number;     // wall height for this floor (default 300)
}

export type ClusterType =
  | "floor-plan"    // mặt bằng — nhiều wall, closed perimeter
  | "elevation"     // mặt đứng — nhiều line thẳng đứng
  | "section"       // mặt cắt
  | "detail"        // chi tiết — nhỏ, dense geometry
  | "schedule"      // bảng — nhiều text, line grid
  | "title-block"   // title block — text + border
  | "unknown";

export interface DxfImportConfig {
  clusters: DxfCluster[];
  layerOverrides: Record<string, string>;  // layerId → archType
  unit: "mm" | "cm" | "m";
  scaleFactor: number;
  stackDirection: "y" | "manual";   // stack floors vertically vs user sets Y
}
```

---

## Phase 1 — Cluster Detection

### File: `canvas/dxf/clusterDetection.ts` (NEW)

**Thuật toán**: DBSCAN-lite dựa trên bounding box proximity.

```
Bước 1: Tính bounding box cho mỗi element
Bước 2: Spatial sort (x tăng dần)
Bước 3: Union-Find — merge 2 elements vào cùng cluster nếu:
         gap giữa bboxes < GAP_THRESHOLD (mặc định 200px / drawing units)
Bước 4: Mỗi connected component = 1 cluster
Bước 5: Lọc cluster quá nhỏ (< MIN_CLUSTER_ELEMENTS = 5)
```

**Constants:**
```ts
const GAP_THRESHOLD      = 200;  // drawing units (~20cm ở scale 1:100)
const MIN_CLUSTER_AREA   = 10_000; // px² — loại bỏ cluster cực nhỏ
const MIN_WALL_COUNT     = 3;    // cần ít nhất 3 wall để coi là floor plan
```

**Exported API:**
```ts
export function clusterElements(elements: DrawingElement[]): DxfCluster[]
export function classifyCluster(cluster: DxfCluster): ClusterType
export function suggestFloorOrder(clusters: DxfCluster[]): DxfCluster[]
  // Trả về các floor-plan clusters, sort theo Y position (top → bottom = tầng 1 → N)
```

**Classify logic:**
```
floor-plan  : wallCount ≥ MIN_WALL_COUNT AND hasClosedPerimeter
elevation   : wallCount > 0 AND aspect ratio > 2:1 (rộng hơn cao)
section     : wallCount > 0 AND có hatch element
schedule    : textCount / elementCount > 0.5 AND có line grid
title-block : bbox area nhỏ AND textCount cao AND ở góc trang
detail      : bbox area < 50_000 AND wallCount > 0
unknown     : còn lại
```

---

## Phase 2 — Layer Intelligence Upgrade

### File: `canvas/dxf/layerClassifier.ts` (UPGRADE của `planClassification.ts`)

**Vấn đề hiện tại**: `inferArchTypeFromLayer` dựa trên tên layer prefix (`A-WALL`, `A-DOOR`…). Nhiều file thực tế dùng tên layer tùy ý (`tuong`, `wall1`, `0`, `Defpoints`).

**Upgrade**: Thêm 2 fallback tiers:

```ts
export function classifyLayer(layerId: string, sampleElements: DrawingElement[]): LayerClass {
  // Tier 1: Exact prefix match (đã có)
  // A-WALL → wall, M-PIPE → mep, S-FOUND → structural

  // Tier 2: Fuzzy name match (NEW)
  // "tuong", "wall", "mur" → wall
  // "cua", "door", "porte" → door
  // "cua so", "window", "fenetre" → window
  // "san", "floor", "slab", "plancher" → floor
  // "dim", "dimension", "kich thuoc" → dimension (ignore in 3D)
  // "text", "note", "ghi chu" → annotation (ignore in 3D)
  // "title", "khung", "border" → title-block (ignore in 3D)

  // Tier 3: Geometry heuristic (NEW)
  // If layer has mostly LINE entities with similar length → likely wall
  // If layer has mostly TEXT entities → likely annotation
  // If layer has CIRCLE + LINE → likely door swing
}

// Layers that should NEVER be rendered in 3D
export const IGNORE_IN_3D_PATTERNS = [
  /^dim/i, /^dimension/i, /^kich/i,
  /^text/i, /^ghi/i, /^note/i, /^chu/i,
  /^title/i, /^khung/i, /^border/i, /^frame/i,
  /^defpoints/i, /^0$/,
  /schedule/i, /^bang/i,
  /elevation/i, /^mat dung/i,
  /section/i, /^mat cat/i,
  /^hatch/i, /^fill/i,
];
```

---

## Phase 3 — DXF Wizard v2

### File: `components/DxfImportWizard.tsx` (UPGRADE)

Thêm **Tab 2: Clusters** vào wizard hiện tại.

**Layout:**

```
┌─ DXF Import ────────────────────────────────────┐
│  [Layers ✓]  [Clusters ●]  [Preview]             │
├──────────────────────────────────────────────────┤
│  Đã phát hiện 8 clusters:                        │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │ 🏢 Cluster A — 847 elements           [···] │ │
│  │    Loại: Mặt bằng (floor-plan) ✓            │ │
│  │    Tường: 124  Văn bản: 23  Kích thước 12m×8m│ │
│  │    Gán: [Tầng 1 ▼]  Cao: [300] cm           │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │ 🏢 Cluster B — 831 elements           [···] │ │
│  │    Loại: Mặt bằng (floor-plan) ✓            │ │
│  │    Gán: [Tầng 2 ▼]  Cao: [300] cm           │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │ 📋 Cluster C — 312 elements           [···] │ │
│  │    Loại: Bảng cửa (schedule)                │ │
│  │    Gán: [Bỏ qua ▼]                          │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │ 📐 Cluster D — 180 elements           [···] │ │
│  │    Loại: Chi tiết (detail)                  │ │
│  │    Gán: [Bỏ qua ▼]                          │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  Kết quả: 2 tầng sẽ được render 3D               │
│  [ Tự động ]     [ Import → ]                    │
└──────────────────────────────────────────────────┘
```

**Props/State:**

```ts
interface ClusterAssignment {
  clusterId: string;
  floorIndex: number | "ignore";   // 0 = tầng 1, 1 = tầng 2…
  floorHeightCm: number;
  offsetX: number;   // translation to move cluster to origin
  offsetY: number;
}
```

**Auto-assign button**: Tự động assign `floor-plan` clusters theo vị trí Y (cluster cao nhất trên canvas = tầng cuối cùng trong bản vẽ thường là tầng 1 — reverse sort theo Y).

---

## Phase 4 — Multi-Floor Import Pipeline

### File: `canvas/dxf/floorStackImporter.ts` (NEW)

```ts
export function importWithFloorStack(
  clusters:     DxfCluster[],
  assignments:  ClusterAssignment[],
  layerOverrides: Record<string, string>,
): { elements: DrawingElement[]; layers: Layer[] }
```

**Logic:**

```
Với mỗi assigned cluster (không phải "ignore"):
  1. Lấy elements của cluster
  2. Translate về origin:
       dx = -cluster.bbox.minX
       dy = -cluster.bbox.minY
  3. Filter bỏ các element thuộc IGNORE_IN_3D_PATTERNS layers
  4. Gán metadata:
       el.floorIndex = assignment.floorIndex
       el.floorHeightCm = assignment.floorHeightCm
       el.layerId = applyLayerOverride(el.layerId, layerOverrides)
  5. Merge vào elements[] với ID prefix để tránh collision:
       el.id = `f${floorIndex}-${el.id}`

Trả về flat elements[] — ThreeViewer đọc floorIndex để stack theo Y:
  floorY = floorIndex * floorHeightCm * SCALE  (100 units = 1m)
```

### ThreeViewer — đọc floorIndex

Trong `ThreeViewer.tsx`, khi render wall/floor meshes:

```ts
// Group elements theo floor
const floorGroups = groupBy(elements, el => el.floorIndex ?? 0);

// Render mỗi floor trong <group position={[0, floorY, 0]}>
{Object.entries(floorGroups).map(([floorIdx, els]) => {
  const floorY = Number(floorIdx) * avgFloorHeightCm * SCALE_FACTOR;
  return (
    <group key={floorIdx} position={[0, floorY, 0]}>
      {/* walls, doors, etc. */}
    </group>
  );
})}
```

---

## Phase 5 — Floor Manager UI (3D Viewer)

### File: `canvas/3d/components/ThreeViewerUI.tsx` (UPGRADE)

Thêm panel **"Floors"** trong RightSidebar — Tab mới với icon 🏗:

```
┌─ FLOORS ──────────────────────────┐
│                                    │
│  ☑ Tầng 3    Y: 600cm  [···]      │
│  ☑ Tầng 2    Y: 300cm  [···]      │
│  ☑ Tầng 1    Y: 0cm    [···]      │
│                                    │
│  Floor height:                     │
│  [300] cm — áp dụng cho tất cả    │
│                                    │
│  [ + Thêm tầng ]                   │
│  [ Xóa tầng trống ]                │
└────────────────────────────────────┘
```

**State** (thêm vào `sceneSlice.ts`):

```ts
interface FloorConfig {
  floorIndex: number;
  label: string;          // "Tầng 1", "Tầng hầm"…
  heightCm: number;       // wall height of this floor
  visible: boolean;
  yOffsetCm: number;      // manual Y override (optional)
}

floors: FloorConfig[];
setFloorVisible(floorIndex: number, visible: boolean): void;
setFloorHeight(floorIndex: number, heightCm: number): void;
addFloor(): void;
removeFloor(floorIndex: number): void;
```

---

## File Change Map

| File | Thay đổi | Phase |
|------|----------|-------|
| `canvas/dxf/types.ts` | **NEW** — DxfCluster, ClusterType, DxfImportConfig | 1 |
| `canvas/dxf/clusterDetection.ts` | **NEW** — clusterElements, classifyCluster, suggestFloorOrder | 1 |
| `canvas/dxf/layerClassifier.ts` | **NEW** — classifyLayer với fuzzy match + geometry heuristic | 2 |
| `canvas/planClassification.ts` | Refactor — delegate to layerClassifier, keep backward compat | 2 |
| `canvas/dxf.ts` | Expose clusterElements từ pipeline, thêm IGNORE_IN_3D filter | 1, 2 |
| `components/DxfImportWizard.tsx` | **UPGRADE** — thêm Clusters tab, ClusterCard UI | 3 |
| `canvas/dxf/floorStackImporter.ts` | **NEW** — importWithFloorStack, translate + merge logic | 4 |
| `types.ts` | Thêm `floorIndex?: number`, `floorHeightCm?: number` vào DrawingElement | 4 |
| `components/ThreeViewer.tsx` | Group render theo floorIndex + Y stack | 4 |
| `stores/slices/sceneSlice.ts` | Thêm floors: FloorConfig[], setFloorVisible, setFloorHeight | 5 |
| `canvas/3d/components/ThreeViewerUI.tsx` | Thêm Floors tab vào RightSidebar | 5 |
| `pages/CanvasEditor.tsx` | Gọi clusterElements trong DXF import flow | 3 |

---

## Thứ tự implementation

| Phase | Deliverable | Rủi ro | Thời gian |
|-------|------------|--------|-----------|
| **1** | clusterDetection.ts — thuật toán DBSCAN-lite | Thấp — pure logic, dễ test | 1 ngày |
| **2** | layerClassifier.ts — fuzzy + heuristic | Thấp — regex + sampling | 0.5 ngày |
| **3** | DxfImportWizard Clusters tab | Trung — UI phức tạp | 1 ngày |
| **4** | floorStackImporter + ThreeViewer floor groups | Trung — coordinate transform | 1 ngày |
| **5** | Floors panel trong 3D sidebar | Thấp — UI state only | 0.5 ngày |

**Tổng: ~4 ngày** để có pipeline hoàn chỉnh.

---

## Testing Checklist

- [ ] File DXF có 3 mặt bằng tầng → detect 3 clusters `floor-plan`
- [ ] File DXF có bảng cửa → detect cluster `schedule`, auto-ignore trong 3D
- [ ] File DXF có title block → detect cluster `title-block`, auto-ignore
- [ ] Layer `0`, `Defpoints` → bị lọc khỏi 3D
- [ ] Layer tên tiếng Việt `tuong`, `cua` → classify đúng qua fuzzy match
- [ ] 3 floor clusters → stack Y axis đúng: tầng 1 y=0, tầng 2 y=300cm×scale, tầng 3 y=600cm×scale
- [ ] Toggle Floor visibility trong 3D sidebar → hide/show đúng tầng
- [ ] Undo sau import → rollback toàn bộ
- [ ] File DXF một tầng đơn giản → không thay đổi so với flow cũ (backward compat)

---

## Non-Goals (ngoài scope)

- Detect mặt đứng / mặt cắt và render 3D section view (phức tạp, Phase riêng)
- Auto-detect tầng hầm (y âm) — user tự gán
- Multi-building trên cùng file (chỉ support 1 building)
- Import từ Revit IFC (IFC exporter đã có riêng)
- Real-time collaboration khi import
