# Plan: 3D-First Architecture — Auto-Generated 2D Views + AI TCVN Reviewer

## Tầm nhìn (Vision)

Thay đổi triết lý cốt lõi của app:

| | Trước | Sau |
|--|-------|-----|
| **Source of truth** | 2D canvas (user vẽ tay) | 3D model |
| **2D views** | User vẽ thủ công | App auto-generate từ 3D |
| **User input** | Line-by-line drawing | Brief text / DXF import / AI |
| **Output** | DXF export | PDF permit-ready + DXF |
| **Differentiator** | Không có | AI TCVN reviewer |

---

## Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────┐
│                    Input Layer                       │
│  [Brief Text]  [DXF Import]  [Photo Scan]  [Manual] │
│        ↓             ↓            ↓           ↓     │
│              AI Design Generator (Phase 5)           │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│              3D Model (Source of Truth)              │
│         Zustand store — DrawingElement[]             │
│    walls, floors, doors, stairs, foundations...      │
└──────┬───────────┬──────────┬───────────────────────┘
       ↓           ↓          ↓
┌──────────┐ ┌─────────┐ ┌──────────────────────────┐
│ 3D Scene │ │AI TCVN  │ │  Auto-Generated 2D Views  │
│(đã có)   │ │Reviewer │ │  ┌─────────────────────┐  │
│          │ │(Phase 4)│ │  │ Mặt bằng tầng 1     │  │
│ThreeViewer│ │         │ │  │ Mặt bằng tầng 2     │  │
│          │ └─────────┘ │  │ Mặt đứng (4 hướng)  │  │
└──────────┘             │  │ Mặt cắt A-A, B-B    │  │
                         │  │ Mặt bằng nền móng   │  │
                         │  └─────────────────────┘  │
                         └──────────────────────────┘
                                      ↓
                         ┌────────────────────────┐
                         │  Export (Phase 6)       │
                         │  PDF permit-ready       │
                         │  DXF (AutoCAD compat)   │
                         └────────────────────────┘
```

---

## Phase 1 — Orthographic View Engine

**Mục tiêu**: Render 3D scene thành 2D vector lines dùng OrthographicCamera của Three.js.

### 1A. OrthographicViewRenderer

Tạo `/autocard/frontend/src/canvas/3d/renderers/OrthographicViewRenderer.ts`:

**Nguyên lý**: Thêm một `OrthographicCamera` vào scene, render ra offscreen canvas, export thành SVG/PNG.

```ts
export type ViewType =
  | "plan"         // top-down (mặt bằng)
  | "elevation-N"  // nhìn từ bắc (mặt đứng trước)
  | "elevation-S"  // nhìn từ nam (mặt đứng sau)
  | "elevation-E"  // nhìn từ đông
  | "elevation-W"  // nhìn từ tây
  | "section-X"    // cắt theo trục X
  | "section-Z";   // cắt theo trục Z

export interface OrthographicViewConfig {
  type: ViewType;
  floorIndex?: number;    // chỉ render tầng này (undefined = tất cả)
  sectionOffset?: number; // vị trí mặt cắt (world units)
  scale: number;          // e.g. 100 = 1:100
  paperSize: "A1" | "A2" | "A3" | "A4";
  showDimensions: boolean;
  showAnnotations: boolean;
  showGrid: boolean;
}
```

**Camera setup cho từng view:**

```ts
// Mặt bằng — nhìn từ trên xuống
camera.position.set(0, 10000, 0);
camera.lookAt(0, 0, 0);
camera.up.set(0, 0, -1); // Z là "up" trong 2D plan

// Mặt đứng trước — nhìn từ nam lên bắc
camera.position.set(0, sceneHeight / 2, -10000);
camera.lookAt(0, sceneHeight / 2, 0);
camera.up.set(0, 1, 0);

// Mặt cắt X — cắt ở x = sectionOffset
// dùng clipping plane: THREE.Plane(new THREE.Vector3(-1, 0, 0), sectionOffset)
```

**Output**: Offscreen WebGL render → `gl.domElement.toDataURL("image/png")`.

### 1B. ViewPanel Component

Tạo `/autocard/frontend/src/canvas/3d/components/OrthographicViewPanel.tsx`:

- Embedded `<Canvas>` riêng với OrthographicCamera (không dùng chung với 3D scene để tránh conflict)
- Cùng `elements[]` từ store nhưng render với different camera + line-only material
- Hiện dimensions tự động (auto-dimensioning)

**Line-only rendering**: Override materials với `MeshBasicMaterial({ color: "#000", wireframe: false })` + `EdgesGeometry` để chỉ render cạnh, không có shading.

### 1C. Auto-Dimensioning

Tự động tính và vẽ dimension lines:

```ts
function generatePlanDimensions(elements: DrawingElement[]): DimensionLine[] {
  // 1. Detect tất cả walls
  // 2. Group walls theo hướng (horizontal / vertical)
  // 3. Tạo dimension chains theo TCVN: 
  //    - Chain 1: từng phòng
  //    - Chain 2: tổng chiều ngang
  //    - Chain 3: tổng chiều dọc
  // 4. Vẽ dimension lines ở margin ngoài bounding box
}
```

---

## Phase 2 — Views Manager UI

**Mục tiêu**: Tab "Views" trong app, user có thể generate và xem tất cả 2D views.

### Layout

```
┌─ VIEWS ───────────────────────────────────────────┐
│                                                    │
│  Mặt bằng                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Tầng 1   │  │ Tầng 2   │  │ Tầng 3   │         │
│  │  [img]   │  │  [img]   │  │  [img]   │         │
│  │ 1:100    │  │ 1:100    │  │ 1:100    │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                    │
│  Mặt đứng                                         │
│  ┌──────────┐  ┌──────────┐                        │
│  │ Trước    │  │ Bên      │                        │
│  │  [img]   │  │  [img]   │                        │
│  └──────────┘  └──────────┘                        │
│                                                    │
│  Mặt cắt                                          │
│  ┌──────────┐  ┌──────────┐                        │
│  │ A-A      │  │ B-B      │                        │
│  │  [img]   │  │  [img]   │                        │
│  └──────────┘  └──────────┘                        │
│                                                    │
│  [ + Thêm mặt cắt ]    [ Export tất cả → PDF ]    │
└────────────────────────────────────────────────────┘
```

### Section Cut Tool

User định nghĩa mặt cắt bằng cách kéo line trên mặt bằng preview:
- Click "Thêm mặt cắt" → drag một đường qua mặt bằng
- App render OrthographicCamera nhìn vuông góc với đường đó
- Label tự động: A-A, B-B, C-C...

---

## Phase 3 — Layout (Trang bản vẽ) Upgrade

**Mục tiêu**: Tab "Layout" hiện có → trở thành nơi compose các auto-generated views lên trang A3/A1 với title block.

### Auto-Layout

```ts
function autoLayout(
  views: GeneratedView[],
  paper: PaperSize,
  titleBlock: TitleBlockData,
): LayoutComposition {
  // 1. Tính scale tối ưu cho mỗi view vừa trang
  // 2. Arrange views: mặt bằng trên, mặt đứng dưới, mặt cắt bên phải
  // 3. Auto-fit scale: thử 1:50, 1:100, 1:200 cho đến khi vừa
  // 4. Đặt title block theo TCVN 7:2011 (góc phải phía dưới)
}
```

### Title Block theo TCVN

```
┌────────────────────────────────────┐
│  Tên công trình                    │
│  Chủ đầu tư                        │
│  Đơn vị thiết kế          Tỷ lệ   │
│  KTS thiết kế             Bản vẽ  │
│  Ngày                     Số tờ   │
└────────────────────────────────────┘
```

---

## Phase 4 — AI TCVN Reviewer

**Mục tiêu**: AI tự động review 3D model và cảnh báo vi phạm quy chuẩn xây dựng.

### Kiến trúc

```
3D Model (DrawingElement[])
  ↓
GeometryAnalyzer — extract measurements từ elements
  ↓
TCVNRuleEngine — check từng rule
  ↓
IssueList — danh sách vi phạm + suggestions
  ↓
Overlay trên 3D scene (highlight element vi phạm đỏ)
+ Panel "AI Review" bên phải
```

### GeometryAnalyzer

Tạo `/autocard/frontend/src/canvas/analysis/geometryAnalyzer.ts`:

```ts
export interface BuildingMetrics {
  floors: FloorMetrics[];
  totalHeight: number;
  footprintArea: number;
  totalFloorArea: number;
  facadeWidth: number;
  facadeDepth: number;
  roomMetrics: RoomMetrics[];
  stairMetrics: StairMetrics[];
  corridorMetrics: CorridorMetrics[];
  openingRatios: OpeningRatioByRoom[];   // window/floor area ratio
  setbacks: SetbackMetrics;              // khoảng lùi
}

export interface RoomMetrics {
  elementId: string;
  area: number;          // m²
  perimeter: number;     // m
  minDimension: number;  // cạnh ngắn nhất (m)
  windowArea: number;    // m² cửa sổ
  hasDirectLight: boolean;
  hasVentilation: boolean;
  archType: string;
}
```

### TCVN Rule Engine

Tạo `/autocard/frontend/src/canvas/analysis/tcvnRules.ts`:

Rules theo **QCVN 03:2012/BXD** (Quy chuẩn kỹ thuật quốc gia về nhà ở):

```ts
export interface TCVNRule {
  code: string;        // e.g. "QCVN03-4.2.1"
  name: string;
  description: string;
  severity: "error" | "warning" | "info";
  check(metrics: BuildingMetrics): RuleViolation[];
}

// Ví dụ các rules:
const RULES: TCVNRule[] = [
  {
    code: "QCVN03-4.2",
    name: "Chiều cao phòng ở tối thiểu",
    severity: "error",
    check: (m) => m.floors.filter(f => f.wallHeight < 270).map(f => ({
      message: `Tầng ${f.index + 1}: chiều cao ${f.wallHeight}cm < 270cm tối thiểu`,
      elementIds: f.wallIds,
    })),
  },
  {
    code: "QCVN03-5.1",
    name: "Chiều rộng cầu thang tối thiểu",
    severity: "error",
    check: (m) => m.stairMetrics.filter(s => s.width < 100).map(s => ({
      message: `Cầu thang ${s.elementId}: rộng ${s.width}cm < 100cm (TCVN 9386)`,
      elementIds: [s.elementId],
    })),
  },
  {
    code: "QCVN03-5.4",
    name: "Chiều cao bậc thang",
    severity: "warning",
    check: (m) => m.stairMetrics.filter(s => s.riserHeight > 18).map(s => ({
      message: `Cầu thang: bậc cao ${s.riserHeight}cm > 18cm khuyến nghị`,
      elementIds: [s.elementId],
    })),
  },
  {
    code: "QCVN03-6.1",
    name: "Thông gió và ánh sáng tự nhiên",
    severity: "warning",
    check: (m) => m.roomMetrics
      .filter(r => r.archType === "bedroom" && r.windowArea / r.area < 0.1)
      .map(r => ({
        message: `Phòng ngủ: diện tích cửa sổ ${(r.windowArea/r.area*100).toFixed(0)}% < 10% diện tích sàn`,
        elementIds: [r.elementId],
      })),
  },
  {
    code: "QCVN03-3.1",
    name: "Khoảng lùi tối thiểu",
    severity: "error",
    check: (m) => {
      const issues = [];
      if (m.setbacks.front < 300) issues.push({
        message: `Khoảng lùi mặt tiền ${m.setbacks.front}cm < 300cm quy định`,
        elementIds: [],
      });
      return issues;
    },
  },
  {
    code: "QCVN03-4.4",
    name: "Diện tích phòng ở tối thiểu",
    severity: "error",
    check: (m) => m.roomMetrics
      .filter(r => ["bedroom", "living"].includes(r.archType) && r.area < 9)
      .map(r => ({
        message: `Phòng: diện tích ${r.area.toFixed(1)}m² < 9m² tối thiểu`,
        elementIds: [r.elementId],
      })),
  },
  {
    code: "QCVN03-5.2",
    name: "Chiều rộng hành lang tối thiểu",
    severity: "warning",
    check: (m) => m.corridorMetrics.filter(c => c.width < 120).map(c => ({
      message: `Hành lang: rộng ${c.width}cm < 120cm khuyến nghị`,
      elementIds: [c.elementId],
    })),
  },
];
```

### AI Review Panel UI

```
┌─ AI REVIEW ──────────────────────────────────┐
│  [ Chạy Review ]         Cập nhật: 14:32      │
│                                               │
│  ❌ 2 lỗi nghiêm trọng                        │
│  ⚠️  3 cảnh báo                               │
│  ℹ️  1 gợi ý                                  │
│                                               │
│  ❌ QCVN03-4.2 — Chiều cao tầng              │
│     Tầng 1: 260cm < 270cm tối thiểu          │
│     [Xem trên bản vẽ] [Sửa]                  │
│                                               │
│  ❌ QCVN03-5.1 — Cầu thang quá hẹp           │
│     Chiều rộng 90cm < 100cm                  │
│     [Xem trên bản vẽ] [Sửa]                  │
│                                               │
│  ⚠️  QCVN03-6.1 — Thông gió phòng ngủ 2     │
│     Cửa sổ 8% < 10% diện tích sàn            │
│     [Xem trên bản vẽ]                        │
│                                               │
│  💬 Hỏi AI về quy chuẩn...                   │
│  ┌────────────────────────────────────────┐   │
│  │ Tôi cần làm gì để sửa lỗi cầu thang? │   │
│  └────────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

"Xem trên bản vẽ" → highlight element vi phạm bằng màu đỏ trong cả 3D scene lẫn 2D view.

---

## Phase 5 — AI Design Generator

**Mục tiêu**: User nhập brief → AI generate 3D model hoàn chỉnh.

### Input

```
Nhà phố 4m × 18m
4 tầng + 1 tầng mái
3 phòng ngủ, 3 toilet
Phong cách: hiện đại
Ngân sách: 1.8 tỷ
Yêu cầu: sân thượng, kho
```

### Pipeline

```
Brief text
  ↓
LLM (Claude) → BuildingProgram JSON
  {
    lot: { width: 400, depth: 1800 },  // cm
    floors: 4,
    rooms: [
      { type: "living", floor: 0, minArea: 20 },
      { type: "kitchen", floor: 0, minArea: 12 },
      { type: "bedroom", floor: 1, minArea: 12 },
      ...
    ],
    style: "modern",
    budget: 1800000000
  }
  ↓
SpaceLayoutEngine → room placement algorithm
  (bin-packing + adjacency rules)
  ↓
DrawingElement[] → store
  ↓
3D model hiển thị ngay
```

### SpaceLayoutEngine

Tạo `/autocard/frontend/src/canvas/ai/spaceLayoutEngine.ts`:

```ts
export function generateFloorPlan(program: BuildingProgram): DrawingElement[] {
  // 1. Place perimeter walls
  // 2. Place stair at center or side (based on floor count)
  // 3. Allocate rooms using constraint satisfaction:
  //    - Living room: ground floor, south-facing (ánh sáng tốt)
  //    - Bedrooms: upper floors, min 12m²
  //    - Bathrooms: adjacent to bedrooms
  //    - Kitchen: adjacent to living, ventilation access
  // 4. Place doors between adjacent rooms
  // 5. Place windows on exterior walls (10% area rule)
  // Return as DrawingElement[]
}
```

---

## Phase 6 — Export Pipeline

**Mục tiêu**: Export PDF/DXF chuẩn xin phép xây dựng.

### PDF Export

Tạo `/autocard/frontend/src/canvas/export/permitPdfExporter.ts`:

Dùng **pdf-lib** (đã có trong nhiều React apps) để compose:

```
Tờ 1: Mặt bằng tất cả các tầng + title block
Tờ 2: Mặt đứng (4 hướng) + title block  
Tờ 3: Mặt cắt (A-A, B-B) + title block
Tờ 4: Mặt bằng nền móng + title block
Tờ 5: Dự toán chi phí
```

Mỗi tờ = rendered PNG từ OrthographicViewRenderer + title block vector từ pdf-lib.

### DXF Export Upgrade

Export DXF với proper Paper Space layouts (hiện tại chỉ export Model Space):

```
Model Space: 3D geometry (walls at real height)
Paper Space Layout 1: "MAT BANG TANG 1" với viewport + title block
Paper Space Layout 2: "MAT DUNG" với viewport + title block
```

---

## UI Transformation

### Tab cũ → Tab mới

| Tab cũ | Tab mới | Thay đổi |
|--------|---------|----------|
| Mô hình 2D (canvas vẽ tay) | **Views** (auto-generated) | Complete overhaul |
| Mô hình 3D | **3D** (giữ nguyên) | Thêm AI Review panel |
| Layout | **Layout** (upgrade) | Auto-compose từ views |
| Dự toán | **Dự toán** (giữ nguyên) | Kết nối với AI review |

### Toolbar 2D → bỏ

Bỏ toàn bộ drawing tools trong 2D mode (pen, line, rectangle, eraser…). Thay bằng:
- **Annotation tools**: text, dimension, cloud revision mark
- **View controls**: zoom, pan, print area
- **Section cut tool**: kéo đường mặt cắt

---

## File Change Map

| File | Thay đổi | Phase |
|------|----------|-------|
| `canvas/3d/renderers/OrthographicViewRenderer.ts` | **NEW** — offscreen ortho render | 1 |
| `canvas/3d/components/OrthographicViewPanel.tsx` | **NEW** — embedded ortho canvas | 1 |
| `canvas/3d/components/AutoDimensioning.tsx` | **NEW** — dimension chain generator | 1 |
| `pages/ViewsPage.tsx` | **NEW** — Views tab (replaces 2D canvas tab) | 2 |
| `canvas/3d/components/SectionCutTool.tsx` | **NEW** — interactive section line | 2 |
| `pages/CanvasEditor.tsx` | Simplify — remove drawing tools, add Views tab | 2 |
| `canvas/analysis/geometryAnalyzer.ts` | **NEW** — extract BuildingMetrics từ elements | 4 |
| `canvas/analysis/tcvnRules.ts` | **NEW** — QCVN rule definitions + checker | 4 |
| `canvas/3d/components/ThreeViewerUI.tsx` | Thêm AI Review tab | 4 |
| `handlers/ai_tcvn_review_handler.go` | **NEW** — backend AI TCVN review endpoint | 4 |
| `canvas/ai/spaceLayoutEngine.ts` | **NEW** — room placement algorithm | 5 |
| `canvas/ai/designBriefParser.ts` | **NEW** — parse natural language brief | 5 |
| `canvas/export/permitPdfExporter.ts` | **NEW** — PDF permit export | 6 |
| `canvas/dxf.ts` | Upgrade — Paper Space layout export | 6 |

---

## Thứ tự implementation

| Phase | Deliverable | Impact | Thời gian |
|-------|------------|--------|-----------|
| **1** | OrthographicViewRenderer — render mặt bằng từ 3D | Cao | 3 ngày |
| **2** | Views tab UI — xem tất cả 2D views | Cao | 2 ngày |
| **3** | Layout auto-compose + title block TCVN | Trung | 2 ngày |
| **4** | AI TCVN Reviewer — GeometryAnalyzer + Rules | Rất cao | 4 ngày |
| **5** | AI Design Generator từ brief | Rất cao | 5 ngày |
| **6** | PDF permit export | Cao | 2 ngày |

**Tổng: ~18 ngày** để có product hoàn toàn khác biệt.

---

## Competitive Moat

Sau khi hoàn thành:

| Tính năng | ARCH-TECH-CAD | AutoCAD | Revit | SketchUp |
|-----------|--------------|---------|-------|----------|
| 3D real-time | ✅ | ❌ | ✅ | ✅ |
| Auto 2D từ 3D | ✅ | ❌ | ✅ | ❌ |
| AI TCVN review | ✅ | ❌ | ❌ | ❌ |
| Tiếng Việt native | ✅ | ❌ | ❌ | ❌ |
| AI design brief | ✅ | ❌ | ❌ | ❌ |
| PDF permit-ready | ✅ | Manual | Manual | ❌ |
| Giá | Free/SaaS | $600/năm | $3,000/năm | $300/năm |

---

## Non-Goals

- Real-time structural analysis (FEA) — quá phức tạp
- MEP detailed engineering (chỉ layout, không tính load)
- BIM IFC full compliance — IFC export cơ bản đủ dùng
- Mobile app — web-first trước
- Geotechnical analysis
