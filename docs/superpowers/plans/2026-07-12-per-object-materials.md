# Per-Object Material Apply + Unified Material Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select objects in the 3D tab and apply materials to exactly them via a contextual Materials tab, with all three hard-coded catalogs (MATERIAL_PRESETS, FINISH_COLORS, MEP_FIXTURES) unified into one JSON-driven registry that new types/materials extend without touching TypeScript.

**Architecture:** A new `MaterialRegistry` (static class, mirroring `MaterialService`'s conventions) seeds synchronously from bundled JSON (`resolveJsonModule` is enabled) and optionally refreshes from `/config/*.json` at runtime. `MaterialService.getMaterial()` keeps its exact signature/fallback/texture-cache but reads the registry. The RightSidebar "Mat." tab's facade grid becomes a contextual panel driven by `selectedElementIds` (existing multi-select) and applies via the existing `updateElement(id, { material })` path already proven by paint3d.

**Tech Stack:** React 19 + TypeScript, Zustand (existing actions only), three.js, vitest, Playwright (verification).

**Spec:** `docs/superpowers/specs/2026-07-12-per-object-materials-design.md`

## Global Constraints

- All frontend paths relative to `autocard/frontend/` unless prefixed otherwise.
- **No smell code** (user's explicit demand): no reviewer-directed comments, no dead code/exports, no `// TODO`, match existing conventions (static-class services, Tailwind chrome styles in `ThreeViewerUI.tsx`, Vietnamese UI labels).
- Type-check after every task: `cd autocard/frontend && npx tsc --noEmit` — clean (pre-existing `StoreOrderPage.tsx:493` error is ignorable).
- Vitest baseline: **123 passing** + 8 pre-existing `node:test`-format file-load failures. Each task leaves ≥ baseline; Tasks 1–2 add tests.
- Backward compatibility is hard: every current `MATERIAL_PRESETS` id (concrete, brick, wood, glass, steel, marble, plaster, insulation, drywall, steel_stud, roof_tile) must keep resolving with identical `MaterialProps` (colors/roughness/metalness/maps/transparency); unknown ids still fall back to plaster; `getPresetList()` returns the same 8 entries with identical ids/labels/colors; the texture cache mechanism is untouched.
- The roof material picker stays the existing global grid (roof is generated geometry, not an element — spec correction 3). `facadeMaterial` stays as the walls' fallback (`materialById.get(id) || facadeMaterial` precedence unchanged).
- Never `git add` unrelated dirty files (`autocard/frontend/src/main.tsx`, `autocard/backend/main.go`, both `.env`s, `EstimationDashboard.tsx`). Commit per task, pathspec-scoped: `git commit -m "..." -- <files>`.

---

### Task 1: Catalog JSONs + `MaterialRegistry` (TDD)

**Files:**
- Create: `src/canvas/3d/materials/config/materials.catalog.json`
- Create: `src/canvas/3d/materials/config/object-types.json`
- Create: `src/canvas/3d/materials/materialRegistry.ts`
- Test: `src/canvas/3d/materials/materialRegistry.test.ts`

**Interfaces:**
- Consumes: nothing new (bundled JSON imports; `resolveJsonModule: true` confirmed in tsconfig).
- Produces (used by Tasks 2–5):

```ts
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
export class MaterialRegistry {
  static get(id: string): CatalogMaterial | undefined;
  static getByObjectType(type: string): CatalogMaterial[];
  static getFamilies(type: string): string[];           // order from object-types.json
  static listObjectTypes(): ObjectTypeDef[];
  static getObjectType(id: string): ObjectTypeDef | undefined;
  static refreshFromServer(): Promise<void>;            // /config/*.json; silent on any failure
  static subscribe(cb: () => void): () => void;
  static getVersion(): number;
}
export function useMaterialCatalogVersion(): number;     // useSyncExternalStore over subscribe/getVersion
export function parseCatalog(raw: unknown): { materials: CatalogMaterial[]; skipped: number };   // pure, exported for tests
export function parseObjectTypes(raw: unknown): { objectTypes: ObjectTypeDef[]; skipped: number };
```

- [x] **Step 1: Write the failing tests**

```ts
// src/canvas/3d/materials/materialRegistry.test.ts
import { describe, it, expect, vi } from "vitest";
import { MaterialRegistry, parseCatalog, parseObjectTypes } from "./materialRegistry";

describe("parseCatalog", () => {
  it("keeps valid entries and skips invalid ones with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { materials, skipped } = parseCatalog({ materials: [
      { id: "a", family: "F", name: "A", color: "#fff", objectTypes: ["wall"] },
      { id: "bad-no-color", family: "F", name: "B", objectTypes: ["wall"] },
      { family: "F", name: "no-id", color: "#000", objectTypes: ["wall"] },
    ]});
    expect(materials.map(m => m.id)).toEqual(["a"]);
    expect(skipped).toBe(2);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
  it("returns nothing for a malformed root", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseCatalog(null).materials).toEqual([]);
    expect(parseCatalog({ nope: 1 }).materials).toEqual([]);
    warn.mockRestore();
  });
});

describe("parseObjectTypes", () => {
  it("keeps valid entries and skips invalid ones", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { objectTypes } = parseObjectTypes({ objectTypes: [
      { id: "wall", label: "Tường", materialFamilies: ["Sơn"] },
      { id: "broken" },
    ]});
    expect(objectTypes.map(t => t.id)).toEqual(["wall"]);
    warn.mockRestore();
  });
});

describe("MaterialRegistry (bundled seed)", () => {
  it("resolves every legacy MATERIAL_PRESETS id", () => {
    for (const id of ["concrete","brick","wood","glass","steel","marble","plaster","insulation","drywall","steel_stud","roof_tile"]) {
      expect(MaterialRegistry.get(id), id).toBeDefined();
    }
  });
  it("filters materials by object type", () => {
    const walls = MaterialRegistry.getByObjectType("wall");
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.every(m => m.objectTypes.includes("wall"))).toBe(true);
    expect(MaterialRegistry.getByObjectType("floor").some(m => m.id === "w-b1")).toBe(false);
  });
  it("returns families in object-types.json order", () => {
    expect(MaterialRegistry.getFamilies("wall")).toEqual(["Cơ bản", "Gạch xây", "Sơn", "Ốp ngoại thất", "Lớp cấu tạo"]);
  });
  it("lists object types and exposes mep fixture items", () => {
    const ids = MaterialRegistry.listObjectTypes().map(t => t.id);
    expect(ids).toEqual(expect.arrayContaining(["wall", "floor", "mep_fixture"]));
    expect(MaterialRegistry.getObjectType("mep_fixture")?.items?.switch).toEqual({ label: "Công tắc", heightCm: 110 });
  });
  it("unknown id → undefined; unknown type → empty list", () => {
    expect(MaterialRegistry.get("nope")).toBeUndefined();
    expect(MaterialRegistry.getByObjectType("nope")).toEqual([]);
    expect(MaterialRegistry.getFamilies("nope")).toEqual([]);
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/materials/materialRegistry.test.ts`
Expected: FAIL — cannot resolve `./materialRegistry`.

- [x] **Step 3: Create the two JSON files**

`src/canvas/3d/materials/config/object-types.json` — exactly:

```json
{
  "objectTypes": [
    {
      "id": "wall",
      "label": "Tường",
      "materialFamilies": ["Cơ bản", "Gạch xây", "Sơn", "Ốp ngoại thất", "Lớp cấu tạo"],
      "defaultMaterial": "plaster"
    },
    {
      "id": "floor",
      "label": "Sàn",
      "materialFamilies": ["Hoàn thiện sàn", "Gạch lát nền", "Sàn gỗ", "Đá tự nhiên", "Khác"],
      "defaultMaterial": "floor_concrete"
    },
    {
      "id": "roof",
      "label": "Mái",
      "materialFamilies": [],
      "defaultMaterial": "roof_tile"
    },
    {
      "id": "mep_fixture",
      "label": "Thiết bị MEP",
      "materialFamilies": [],
      "items": {
        "switch":  { "label": "Công tắc", "heightCm": 110 },
        "socket":  { "label": "Ổ cắm", "heightCm": 30 },
        "juncbox": { "label": "Hộp nối", "heightCm": 235 },
        "dboard":  { "label": "Tủ điện", "heightCm": 150 },
        "valve":   { "label": "Van cầu", "heightCm": 55 },
        "elbow":   { "label": "Co ống", "heightCm": 30 }
      }
    }
  ]
}
```

(`roof.materialFamilies` is empty on purpose: the contextual rail derives from non-empty `materialFamilies`, and roof material stays the global picker — no special-case code needed.)

`src/canvas/3d/materials/config/materials.catalog.json` — exactly (legacy presets first with their current exact props from `materialService.ts:20-93` and the 8 `getPresetList()` labels/colors from `:176-187`; floor finishes with `FloorMesh.tsx:7-12` colors; then the demo catalog from `material-apply-demo.html:262-318` verbatim):

```json
{
  "materials": [
    { "id": "plaster",   "family": "Cơ bản", "name": "Vôi trát",     "color": "#f5f5f0", "objectTypes": ["wall"], "roughness": 0.88, "metalness": 0.0, "quickAccess": true },
    { "id": "concrete",  "family": "Cơ bản", "name": "Bê tông",      "color": "#8c8d8a", "objectTypes": ["wall"], "roughness": 0.85, "metalness": 0.05, "albedoMap": "/textures/concrete/albedo.jpg", "normalMap": "/textures/concrete/normal.jpg", "roughnessMap": "/textures/concrete/roughness.jpg", "quickAccess": true },
    { "id": "brick",     "family": "Cơ bản", "name": "Gạch đỏ",      "color": "#b55a30", "objectTypes": ["wall"], "roughness": 0.95, "metalness": 0.0, "albedoMap": "/textures/brick/albedo.jpg", "normalMap": "/textures/brick/normal.jpg", "roughnessMap": "/textures/brick/roughness.jpg", "quickAccess": true },
    { "id": "wood",      "family": "Cơ bản", "name": "Gỗ",           "color": "#b48a53", "objectTypes": ["wall"], "roughness": 0.72, "metalness": 0.0, "albedoMap": "/textures/wood/albedo.jpg", "normalMap": "/textures/wood/normal.jpg", "roughnessMap": "/textures/wood/roughness.jpg", "quickAccess": true },
    { "id": "steel",     "family": "Cơ bản", "name": "Thép",         "color": "#9ca3af", "objectTypes": ["wall"], "roughness": 0.22, "metalness": 0.9, "quickAccess": true },
    { "id": "marble",    "family": "Cơ bản", "name": "Đá cẩm thạch", "color": "#e8eae6", "objectTypes": ["wall"], "roughness": 0.12, "metalness": 0.08, "albedoMap": "/textures/marble/albedo.jpg", "normalMap": "/textures/marble/normal.jpg", "quickAccess": true },
    { "id": "glass",     "family": "Cơ bản", "name": "Kính",         "color": "#c8e8f4", "objectTypes": ["wall"], "roughness": 0.04, "metalness": 0.12, "transparent": true, "opacity": 0.28, "side": "double", "quickAccess": true },
    { "id": "roof_tile", "family": "Ngói",   "name": "Ngói mái",     "color": "#994d3d", "objectTypes": ["roof"], "roughness": 0.82, "metalness": 0.0, "albedoMap": "/textures/roof_tile/albedo.jpg", "normalMap": "/textures/roof_tile/normal.jpg", "quickAccess": true },
    { "id": "insulation", "family": "Lớp cấu tạo", "name": "Bông cách nhiệt", "color": "#fde68a", "objectTypes": ["wall"], "roughness": 0.95, "metalness": 0.0 },
    { "id": "drywall",    "family": "Lớp cấu tạo", "name": "Thạch cao",       "color": "#ece9e2", "objectTypes": ["wall"], "roughness": 0.9, "metalness": 0.0 },
    { "id": "steel_stud", "family": "Lớp cấu tạo", "name": "Khung thép",      "color": "#94a3b8", "objectTypes": ["wall"], "roughness": 0.35, "metalness": 0.7 },

    { "id": "floor_concrete", "family": "Hoàn thiện sàn", "name": "Bê tông hoàn thiện", "color": "#c4b9a8", "objectTypes": ["floor"], "roughness": 0.9, "metalness": 0.0 },
    { "id": "floor_tile",     "family": "Hoàn thiện sàn", "name": "Gạch lát",           "color": "#e8e0d0", "objectTypes": ["floor"], "roughness": 0.9, "metalness": 0.0 },
    { "id": "floor_wood",     "family": "Hoàn thiện sàn", "name": "Gỗ lát sàn",         "color": "#b5874d", "objectTypes": ["floor"], "roughness": 0.9, "metalness": 0.0 },
    { "id": "floor_screed",   "family": "Hoàn thiện sàn", "name": "Vữa cán nền",        "color": "#d4c8b4", "objectTypes": ["floor"], "roughness": 0.9, "metalness": 0.0 },

    { "id": "w-b1", "family": "Gạch xây", "name": "Gạch đất nung 2 lỗ", "color": "#a34a3a", "pattern": "brick", "objectTypes": ["wall"], "note": "KT 220×105×55mm, xây xen kẽ gạch đặc để giảm trọng lượng tường." },
    { "id": "w-b2", "family": "Gạch xây", "name": "Gạch đất nung 4 lỗ", "color": "#b0523f", "pattern": "brick", "objectTypes": ["wall"], "note": "Nhẹ, kích thước vừa, giá rẻ — loại dùng phổ biến nhất tại VN." },
    { "id": "w-b3", "family": "Gạch xây", "name": "Gạch 6 lỗ (Tuynel)", "color": "#9c4636", "pattern": "brick", "objectTypes": ["wall"], "note": "KT 220×105×150mm, nung trong lò tuynel công nghiệp." },
    { "id": "w-b4", "family": "Gạch xây", "name": "Gạch đặc (không lỗ)", "color": "#8a3c2e", "pattern": "brick", "objectTypes": ["wall"], "note": "Chịu lực cao, chống thấm tốt; dùng xây trang trí không tô trát." },
    { "id": "w-b5", "family": "Gạch xây", "name": "Gạch không nung (Block bê tông)", "color": "#9c9690", "pattern": "brick", "objectTypes": ["wall"], "note": "Cường độ nén gấp 2–4 lần gạch nung, thấm nước thấp, đúc đa dạng kích thước." },
    { "id": "w-b6", "family": "Gạch xây", "name": "Gạch bê tông khí chưng áp (AAC)", "color": "#c7c2b6", "pattern": "brick", "objectTypes": ["wall"], "note": "Siêu nhẹ, cách âm & cách nhiệt tốt, thi công nhanh." },
    { "id": "w-p1", "family": "Sơn", "name": "Dulux ngoại thất", "color": "#e3e0d4", "objectTypes": ["wall"], "note": "AkzoNobel (Hà Lan), >25 năm tại VN, bám dính tốt, chống bám bẩn, dễ lau chùi." },
    { "id": "w-p2", "family": "Sơn", "name": "Jotun chống thấm", "color": "#3b6ea5", "objectTypes": ["wall"], "note": "Thương hiệu Na Uy, nổi bật chống thấm & chống nấm mốc, bảo vệ lâu dài." },
    { "id": "w-p3", "family": "Sơn", "name": "Kova chống cháy/chống thấm", "color": "#c96a4a", "objectTypes": ["wall"], "note": "Thương hiệu Việt Nam, phù hợp khí hậu VN, tăng tuổi thọ công trình ~10 năm." },
    { "id": "w-p4", "family": "Sơn", "name": "Nippon Paint bền màu", "color": "#5b6f52", "objectTypes": ["wall"], "note": "Nhật Bản, công nghệ thân thiện môi trường, chất lượng cao & giá hợp lý." },
    { "id": "w-p5", "family": "Sơn", "name": "Sơn lót chống kiềm", "color": "#efe9db", "objectTypes": ["wall"], "note": "Lớp lót bắt buộc trước khi phủ màu, chống kiềm hoá & tăng độ bám." },
    { "id": "w-s1", "family": "Ốp ngoại thất", "name": "Đá ong / Granite tự nhiên", "color": "#5f6266", "pattern": "stone", "objectTypes": ["wall"], "note": "Độ bền cực cao, chịu lực tốt, vẻ đẹp tự nhiên bền vững theo thời gian." },
    { "id": "w-s2", "family": "Ốp ngoại thất", "name": "Gạch ốp ngoài trời (Porcelain/Granite)", "color": "#8b8f94", "pattern": "stone", "objectTypes": ["wall"], "note": "Hút nước thấp, chịu nhiệt -15°C đến 55°C, giá hợp lý." },
    { "id": "w-s3", "family": "Ốp ngoại thất", "name": "Gỗ nhựa composite (WPC)", "color": "#6f4a2f", "pattern": "wood", "objectTypes": ["wall"], "note": "Bột gỗ + nhựa HDPE/PVC, chống mối mọt, chống thấm, giữ màu tốt." },
    { "id": "w-s4", "family": "Ốp ngoại thất", "name": "Gỗ tự nhiên (lim, teak)", "color": "#8a5a34", "pattern": "wood", "objectTypes": ["wall"], "note": "Sang trọng, các loại gỗ chịu nhiệt phù hợp khí hậu nhiệt đới VN." },
    { "id": "w-s5", "family": "Ốp ngoại thất", "name": "Tấm ốp nhôm nhựa (Alu/Alcorest)", "color": "#b7bcc2", "objectTypes": ["wall"], "note": "Hợp kim nhôm + PE, cách nhiệt, cách âm, chống ẩm, bền màu (phủ PVDF)." },
    { "id": "w-s6", "family": "Ốp ngoại thất", "name": "Ván xi măng sợi (Fiber cement)", "color": "#c7c2b6", "objectTypes": ["wall"], "note": "Vật liệu xây dựng xanh, chịu nước, chống mối mọt, độ bền cao." },

    { "id": "f-c1", "family": "Gạch lát nền", "name": "Gạch Ceramic (men) — Đồng Tâm/Viglacera", "color": "#eef0f2", "pattern": "tile", "objectTypes": ["floor"], "note": "Đất sét + men bề mặt, giá rẻ, đa dạng mẫu mã, dễ thi công." },
    { "id": "f-c2", "family": "Gạch lát nền", "name": "Gạch Granite — Bạch Mã/Taicera", "color": "#2b2d31", "pattern": "tile", "objectTypes": ["floor"], "note": "Cứng, chịu mài mòn cao, dễ vệ sinh — loại dùng nhiều nhất thị trường VN." },
    { "id": "f-c3", "family": "Gạch lát nền", "name": "Gạch Porcelain (bán sứ)", "color": "#dfe3e6", "pattern": "tile", "objectTypes": ["floor"], "note": "Cao cấp, kết cấu nén chặt, chịu lực tốt, chống thấm vượt trội." },
    { "id": "f-c4", "family": "Gạch lát nền", "name": "Gạch giả vân gỗ", "color": "#c98a5e", "pattern": "tile", "objectTypes": ["floor"], "note": "Thay thế sàn gỗ, bền hơn, không lo cong vênh hay mối mọt." },
    { "id": "f-w1", "family": "Sàn gỗ", "name": "Sàn gỗ công nghiệp (laminate)", "color": "#b8895c", "pattern": "wood", "objectTypes": ["floor"], "note": "Giả vân gỗ/đá, giá hợp lý, phổ biến cho căn hộ & nhà phố." },
    { "id": "f-w2", "family": "Sàn gỗ", "name": "Sàn gỗ tự nhiên", "color": "#8a5a34", "pattern": "wood", "objectTypes": ["floor"], "note": "Sang trọng, tăng giá trị nhà, cần bảo trì định kỳ." },
    { "id": "f-s1", "family": "Đá tự nhiên", "name": "Đá marble (cẩm thạch)", "color": "#e4ded1", "pattern": "stone", "objectTypes": ["floor"], "note": "Chống bẩn, dễ vệ sinh, hay dùng cho phòng khách & bếp cao cấp." },
    { "id": "f-s2", "family": "Đá tự nhiên", "name": "Đá granite tự nhiên", "color": "#5f6266", "pattern": "stone", "objectTypes": ["floor"], "note": "Rất bền, chịu trầy xước tốt, phù hợp khu vực nhiều người qua lại." },
    { "id": "f-o1", "family": "Khác", "name": "Sàn nhựa vinyl/SPC", "color": "#c9b79a", "pattern": "tile", "objectTypes": ["floor"], "note": "Chống nước, thi công nhanh, giá tốt hơn sàn gỗ." },
    { "id": "f-o2", "family": "Khác", "name": "Sàn epoxy (nhà xưởng)", "color": "#8f9296", "objectTypes": ["floor"], "note": "Không bám bụi, chịu hoá chất, dùng nhiều cho nhà xưởng, tầng hầm." },
    { "id": "f-o3", "family": "Khác", "name": "Thảm (carpet)", "color": "#6b6f76", "objectTypes": ["floor"], "note": "Êm, cách âm tốt, thường dùng phòng ngủ, phòng chiếu phim." },

    { "id": "r-t1", "family": "Ngói", "name": "Ngói đất nung", "color": "#a8442f", "pattern": "shingle", "objectTypes": ["roof"], "note": "Vật liệu truyền thống được ưa chuộng nhất VN — độ bền cao, chống nóng tốt." },
    { "id": "r-t2", "family": "Ngói", "name": "Ngói xi măng (bê tông)", "color": "#8a7c6f", "pattern": "shingle", "objectTypes": ["roof"], "note": "Giá thành hợp lý, độ bền cao, thay thế ngói đất nung phổ biến." },
    { "id": "r-m1", "family": "Tôn", "name": "Tôn lạnh", "color": "#c7cbd0", "objectTypes": ["roof"], "note": "Sơn phản xạ nhiệt, loại lợp mái phổ biến nhất tại VN." },
    { "id": "r-m2", "family": "Tôn", "name": "Tôn giả ngói", "color": "#7a3629", "objectTypes": ["roof"], "note": "Kiểu dáng giống ngói truyền thống nhưng nhẹ hơn, thi công nhanh." },
    { "id": "r-m3", "family": "Tôn", "name": "Tôn cách nhiệt PU (3 lớp)", "color": "#9aa0a6", "objectTypes": ["roof"], "note": "2 lớp tôn lạnh + lớp Polyurethane giữa — cách nhiệt vượt trội." },
    { "id": "r-m4", "family": "Tôn", "name": "Tôn chống nóng", "color": "#8d949c", "objectTypes": ["roof"], "note": "Giảm hấp thụ nhiệt, phù hợp khí hậu nắng nóng miền Nam/Trung." },
    { "id": "r-e1", "family": "Sinh thái", "name": "Tấm lợp sinh thái (giả ngói nhẹ)", "color": "#5c3a2a", "pattern": "shingle", "objectTypes": ["roof"], "note": "Từ nguyên liệu tái sinh, siêu nhẹ, dạng sóng, đa dạng màu giống ngói." }
  ]
}
```

- [x] **Step 4: Implement `materialRegistry.ts`**

```ts
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
```

- [x] **Step 5: Run tests to verify pass**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/materials/materialRegistry.test.ts`
Expected: PASS (8 tests). Then `npx tsc --noEmit` — clean.

- [x] **Step 6: Commit**

```bash
git commit -m "feat(materials): unified JSON material catalog + MaterialRegistry" -- autocard/frontend/src/canvas/3d/materials/config autocard/frontend/src/canvas/3d/materials/materialRegistry.ts autocard/frontend/src/canvas/3d/materials/materialRegistry.test.ts
```

---

### Task 2: `MaterialService` reads the registry (backward compatible)

**Files:**
- Modify: `src/canvas/3d/materials/materialService.ts`
- Test: `src/canvas/3d/materials/materialService.test.ts` (new)

**Interfaces:**
- Consumes: `MaterialRegistry.get`, `CatalogMaterial` (Task 1).
- Produces: unchanged public surface — `MaterialService.getMaterial(name): THREE.MeshStandardMaterial`, `setUseTextures`, `getPresetList()` (same 8 entries). `MaterialProps` type stays exported (still used by the conversion). New internal: `catalogToMaterialProps(m: CatalogMaterial): MaterialProps` (exported for tests).

- [x] **Step 1: Write the failing tests**

```ts
// src/canvas/3d/materials/materialService.test.ts
import { describe, it, expect } from "vitest";
import { MaterialService, catalogToMaterialProps } from "./materialService";
import { MaterialRegistry } from "./materialRegistry";

describe("MaterialService registry integration", () => {
  it("legacy preset ids resolve with their historical colors", () => {
    const expected: Record<string, string> = {
      concrete: "#8c8d8a", brick: "#b55a30", wood: "#b48a53", glass: "#c8e8f4",
      steel: "#9ca3af", marble: "#e8eae6", plaster: "#f5f5f0",
      insulation: "#fde68a", drywall: "#ece9e2", steel_stud: "#94a3b8", roof_tile: "#994d3d",
    };
    for (const [id, color] of Object.entries(expected)) {
      expect(catalogToMaterialProps(MaterialRegistry.get(id)!).color, id).toBe(color);
    }
  });
  it("getPresetList keeps the same 8 quick-access entries", () => {
    expect(MaterialService.getPresetList()).toEqual([
      { id: "plaster",   label: "Vôi trát",    color: "#f5f5f0" },
      { id: "concrete",  label: "Bê tông",     color: "#8c8d8a" },
      { id: "brick",     label: "Gạch đỏ",     color: "#b55a30" },
      { id: "wood",      label: "Gỗ",          color: "#b48a53" },
      { id: "steel",     label: "Thép",        color: "#9ca3af" },
      { id: "marble",    label: "Đá cẩm thạch",color: "#e8eae6" },
      { id: "glass",     label: "Kính",        color: "#c8e8f4" },
      { id: "roof_tile", label: "Ngói mái",    color: "#994d3d" },
    ]);
  });
  it("pattern maps to procedural texture paths; explicit maps win", () => {
    expect(catalogToMaterialProps(MaterialRegistry.get("w-b1")!).albedoMap).toBe("/textures/brick/albedo.jpg");
    expect(catalogToMaterialProps(MaterialRegistry.get("f-s1")!).albedoMap).toBe("/textures/marble/albedo.jpg");
    expect(catalogToMaterialProps(MaterialRegistry.get("w-p1")!).albedoMap).toBeUndefined();
    expect(catalogToMaterialProps(MaterialRegistry.get("concrete")!).albedoMap).toBe("/textures/concrete/albedo.jpg");
  });
});
```

Note the getMaterial()/THREE-material behaviors (plaster fallback object, texture cache) construct WebGL-side objects — the existing vitest env handles plain `THREE.MeshStandardMaterial` construction (no GL context needed); add:

```ts
  it("unknown id falls back to plaster", () => {
    const m = MaterialService.getMaterial("definitely-not-a-material");
    const plaster = MaterialService.getMaterial("plaster");
    expect(m.color.getHexString()).toBe(plaster.color.getHexString());
  });
```

- [x] **Step 2: Run to verify failure**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/materials/materialService.test.ts`
Expected: FAIL — `catalogToMaterialProps` not exported.

- [x] **Step 3: Implement**

In `materialService.ts`: delete the `MATERIAL_PRESETS` literal (`:20-93`); add the conversion and rewire `getMaterial` and `getPresetList`. Keep `MaterialProps`, `loadTexture`, the cache, and `setUseTextures` exactly as they are.

```ts
import { MaterialRegistry, type CatalogMaterial } from "./materialRegistry";

const PATTERN_TEXTURES: Record<string, string> = {
  brick: "brick", wood: "wood", stone: "marble", shingle: "roof_tile",
};

const SIDE_MAP: Record<string, THREE.Side> = {
  double: THREE.DoubleSide, front: THREE.FrontSide, back: THREE.BackSide,
};

export function catalogToMaterialProps(m: CatalogMaterial): MaterialProps {
  const texDir = m.pattern ? PATTERN_TEXTURES[m.pattern] : undefined;
  return {
    color: m.color,
    roughness: m.roughness ?? 0.85,
    metalness: m.metalness ?? 0.0,
    transparent: m.transparent,
    opacity: m.opacity,
    side: m.side ? SIDE_MAP[m.side] : undefined,
    albedoMap: m.albedoMap ?? (texDir ? `/textures/${texDir}/albedo.jpg` : undefined),
    normalMap: m.normalMap ?? (texDir ? `/textures/${texDir}/normal.jpg` : undefined),
    roughnessMap: m.roughnessMap,
  };
}
```

`getMaterial` body change — only the props lookup line (`:130`) changes:

```ts
    const entry = MaterialRegistry.get(name.toLowerCase()) ?? MaterialRegistry.get("plaster")!;
    const props = catalogToMaterialProps(entry);
```

`getPresetList` becomes:

```ts
  static getPresetList(): { id: string; label: string; color: string }[] {
    return MaterialRegistry.getByObjectType("wall").concat(MaterialRegistry.getByObjectType("roof"))
      .filter((m) => m.quickAccess)
      .map((m) => ({ id: m.id, label: m.name, color: m.color }));
  }
```

(Order check: `getByObjectType` preserves catalog insertion order, and the catalog lists the 8 quick-access entries in the historical order — the Step 1 test pins this.)

- [x] **Step 4: Run tests + full suite**

Run: `cd autocard/frontend && npx vitest run src/canvas/3d/materials/` then `npx vitest run` (≥ 123 + new passing) and `npx tsc --noEmit`.

- [x] **Step 5: Commit**

```bash
git commit -m "feat(materials): MaterialService reads the unified registry" -- autocard/frontend/src/canvas/3d/materials/materialService.ts autocard/frontend/src/canvas/3d/materials/materialService.test.ts
```

---

### Task 3: `FloorMesh` uses the registry (delete `FINISH_COLORS`)

**Files:**
- Modify: `src/canvas/3d/components/FloorMesh.tsx:6-14,43-55`

**Interfaces:**
- Consumes: `MaterialRegistry.get` (Task 1). Floor-finish catalog ids follow `floor_<finish>` (`floor_concrete`, `floor_tile`, `floor_wood`, `floor_screed` — Task 1's catalog).
- Produces: unchanged component behavior; `el.material` (per-object) still wins over `el.floorFinish`.

- [x] **Step 1: Replace the local map**

Delete `FINISH_COLORS` (`:7-12`). Keep `DEFAULT_FINISH = "concrete"`. Add the import and change the material memo's fallback branch:

```tsx
import { MaterialRegistry } from "../materials/materialRegistry";
```

```tsx
  const material = useMemo(() => {
    if (typeof el.material === "string") {
      const m = MaterialService.getMaterial(el.material).clone();
      m.side = THREE.DoubleSide;
      return m;
    }
    const entry = MaterialRegistry.get(`floor_${finish}`) ?? MaterialRegistry.get(`floor_${DEFAULT_FINISH}`);
    return new THREE.MeshStandardMaterial({
      color: entry?.color ?? "#c4b9a8",
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });
  }, [finish, el.material]);
```

- [x] **Step 2: Verify**

Run: `cd autocard/frontend && npx tsc --noEmit` (clean) and `npx vitest run` (baseline holds). Visual check happens in Task 6's E2E.

- [x] **Step 3: Commit**

```bash
git commit -m "refactor(materials): FloorMesh finish colors from the registry" -- autocard/frontend/src/canvas/3d/components/FloorMesh.tsx
```

---

### Task 4: `mepFixtures` served by the registry (open the closed union)

**Files:**
- Modify: `src/canvas/3d/materials/mepFixtures.ts` (full rewrite, 13 lines)
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx:1357` (FixturePalettePanel entries)
- Modify: `src/canvas/3d/controllers/MepFixturePlacerController.tsx:29` (+ a missing-def guard)
- Check-only: `src/components/ThreeViewer.tsx:29,871,1522,1999` (type import — still valid since `MepFixtureType` remains exported), `MepFixtureMesh.tsx` (no `MEP_FIXTURES` import — verify it compiles with the widened type).

**Interfaces:**
- Consumes: `MaterialRegistry.getObjectType("mep_fixture")`, `MepFixtureDef` (Task 1).
- Produces: `export type MepFixtureType = string;` and `export function getMepFixtures(): Record<string, MepFixtureDef>`. `MEP_FIXTURES` const is deleted (consumers migrate — no dead exports).

- [x] **Step 1: Rewrite `mepFixtures.ts`**

```ts
// Wall-mounted MEP fixture catalog — labels + default mounting heights, served
// from object-types.json's mep_fixture entry so new fixture kinds are added by
// editing JSON, not this file.
import { MaterialRegistry, type MepFixtureDef } from "./materialRegistry";

export type MepFixtureType = string;

export function getMepFixtures(): Record<string, MepFixtureDef> {
  return MaterialRegistry.getObjectType("mep_fixture")?.items ?? {};
}
```

- [x] **Step 2: Migrate the two consumers**

`ThreeViewerUI.tsx:1357` (inside `FixturePalettePanel`):

```tsx
  const entries = Object.entries(getMepFixtures());
```

(update the import at `:4` from `{ MEP_FIXTURES, type MepFixtureType }` to `{ getMepFixtures, type MepFixtureType }`; the `entries` tuple type simplifies to what `Object.entries` infers).

`MepFixturePlacerController.tsx:29`:

```tsx
  const def = getMepFixtures()[fixtureType];
```

Directly below, the controller uses `def.heightCm`/`def.label` — add a guard only if none exists: check the file; if `def` is dereferenced unconditionally, gate the controller's effect/render on `if (!def) return …` consistent with its existing inactive-state handling.

- [x] **Step 3: Verify**

`cd autocard/frontend && npx tsc --noEmit` — clean (this proves every former `MepFixtureType`-union consumer still compiles). `npx vitest run` — baseline holds. Quick behavioral check in the browser is deferred to Task 6's E2E (fixture palette renders 6 fixtures as before).

- [x] **Step 4: Commit**

```bash
git commit -m "refactor(materials): MEP fixture catalog served by the registry" -- autocard/frontend/src/canvas/3d/materials/mepFixtures.ts autocard/frontend/src/canvas/3d/components/ThreeViewerUI.tsx autocard/frontend/src/canvas/3d/controllers/MepFixturePlacerController.tsx
```

---

### Task 5: Contextual Materials tab + `ThreeViewer` wiring

**Files:**
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (new `ContextualMaterialsPanel` component; `RightSidebar` materials tab at `:851-878` — facade grid replaced, roof grid kept; `RightSidebar` props)
- Modify: `src/components/ThreeViewer.tsx` (selection derivation, apply/reset handlers, `RightSidebar` call-site props, one `MaterialRegistry.refreshFromServer()` init effect)

**Interfaces:**
- Consumes: `MaterialRegistry`, `useMaterialCatalogVersion` (Task 1); `selectedElementIds`, `elements`, `updateElement`, `activeTool` (existing in `ThreeViewer`).
- Produces — `RightSidebar` gains exactly these props (types verbatim):

```ts
  materialSelection: { ids: string[]; objectType: string } | null;
  onApplyMaterial: (materialId: string) => void;
  onApplyMaterialToAll: (materialId: string, objectType: string) => void;
  onResetMaterials: (objectType: string) => void;
```

- [x] **Step 1: Add `ContextualMaterialsPanel` to `ThreeViewerUI.tsx`**

Place it above `RightSidebar`. Swatch backgrounds use the demo's pattern CSS; notes go on `title`.

```tsx
function materialSwatchCss(pattern: string | undefined, color: string): string {
  if (pattern === "brick") return `repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 2px, transparent 2px 16px), repeating-linear-gradient(90deg, rgba(0,0,0,.18) 0 2px, transparent 2px 34px), ${color}`;
  if (pattern === "stone") return `repeating-linear-gradient(45deg, rgba(0,0,0,.12) 0 3px, transparent 3px 22px), repeating-linear-gradient(-45deg, rgba(0,0,0,.1) 0 3px, transparent 3px 22px), ${color}`;
  if (pattern === "wood") return `repeating-linear-gradient(90deg, rgba(0,0,0,.14) 0 2px, transparent 2px 12px), ${color}`;
  if (pattern === "tile") return `repeating-linear-gradient(0deg, rgba(0,0,0,.15) 0 1px, transparent 1px 12px), repeating-linear-gradient(90deg, rgba(0,0,0,.15) 0 1px, transparent 1px 12px), ${color}`;
  if (pattern === "shingle") return `repeating-linear-gradient(0deg, rgba(0,0,0,.2) 0 2px, transparent 2px 10px), ${color}`;
  return color;
}

/** Selection-aware material picker: with a selection, swatches apply to it;
    without one, swatches apply to every object of the browsed type. */
function ContextualMaterialsPanel({ selection, onApply, onApplyToAll, onReset }: {
  selection: { ids: string[]; objectType: string } | null;
  onApply: (materialId: string) => void;
  onApplyToAll: (materialId: string, objectType: string) => void;
  onReset: (objectType: string) => void;
}) {
  useMaterialCatalogVersion();
  const railTypes = MaterialRegistry.listObjectTypes().filter((t) => t.materialFamilies.length > 0);
  const [browseType, setBrowseType] = useState(railTypes[0]?.id ?? "wall");
  const [applyToAll, setApplyToAll] = useState(false);
  const activeType = selection?.objectType ?? browseType;
  const families = MaterialRegistry.getFamilies(activeType);
  const mats = MaterialRegistry.getByObjectType(activeType);
  const typeLabel = MaterialRegistry.getObjectType(activeType)?.label ?? activeType;
  const applyAll = !selection || applyToAll;

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {railTypes.map((t) => (
          <button key={t.id}
            onClick={() => setBrowseType(t.id)}
            disabled={!!selection}
            className={`flex-1 py-1 rounded text-[9px] font-bold border transition-all ${activeType === t.id ? "bg-blue-500/20 border-blue-500/60 text-blue-400" : "border-white/10 text-slate-600 hover:text-slate-400"} disabled:opacity-60`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-slate-500">
        {selection ? `${selection.ids.length} đối tượng đang chọn` : "Chưa chọn — áp cho tất cả " + typeLabel.toLowerCase()}
      </p>
      {selection && (
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-[10px] text-slate-400">Áp cho tất cả {typeLabel.toLowerCase()}</span>
          <div onClick={() => setApplyToAll((v) => !v)}
            className={`w-8 h-4 rounded-full transition-colors cursor-pointer relative ${applyToAll ? "bg-blue-600" : "bg-slate-700"}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${applyToAll ? "right-0.5" : "left-0.5"}`} />
          </div>
        </label>
      )}
      {families.map((family) => {
        const familyMats = mats.filter((m) => m.family === family);
        if (familyMats.length === 0) return null;
        return (
          <div key={family}>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{family}</p>
            <div className="flex flex-wrap gap-1.5">
              {familyMats.map((m) => (
                <button key={m.id}
                  onClick={() => (applyAll ? onApplyToAll(m.id, activeType) : onApply(m.id))}
                  className="w-7 h-7 rounded-lg border-2 border-transparent hover:border-white hover:scale-105 transition-all"
                  style={{ background: materialSwatchCss(m.pattern, m.color) }}
                  title={m.note ? `${m.name} — ${m.note}` : m.name}
                />
              ))}
            </div>
          </div>
        );
      })}
      <button onClick={() => onReset(activeType)}
        className="w-full py-1.5 rounded text-[10px] font-bold bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-all">
        Đặt lại vật liệu {typeLabel.toLowerCase()}
      </button>
    </div>
  );
}
```

- [x] **Step 2: Swap the facade grid inside `RightSidebar`**

Add the four new props to `RightSidebar`'s destructure and type block (exact types from Interfaces above). Replace the "Wall facade" block (`:853-863`) with:

```tsx
            <ContextualMaterialsPanel
              selection={materialSelection}
              onApply={onApplyMaterial}
              onApplyToAll={onApplyMaterialToAll}
              onReset={onResetMaterials}
            />
```

Keep the Roofing block (`:864-876`) exactly as is. The `materials` local (`getPresetList()`, `:546`) remains used by the roof grid — still live, not dead.

- [x] **Step 3: Wire `ThreeViewer.tsx`**

Imports: add `MaterialRegistry` from `../canvas/3d/materials/materialRegistry`.

Init effect (near the other top-level effects):

```tsx
  useEffect(() => { MaterialRegistry.refreshFromServer(); }, []);
```

Selection derivation + handlers (place after the pipe-panel handlers, matching the memo/handler conventions there):

```tsx
  const materialSelection = useMemo(() => {
    if (activeTool !== "select" || selectedElementIds.length === 0) return null;
    const targets = selectedElementIds
      .map((id) => elements.find((e) => e.id === id))
      .filter((el): el is DrawingElement => !!el && !!el.archType && MaterialRegistry.getFamilies(el.archType).length > 0);
    if (targets.length === 0) return null;
    return { ids: targets.map((t) => t.id), objectType: targets[0].archType as string };
  }, [activeTool, selectedElementIds, elements]);

  const handleApplyMaterial = useCallback((materialId: string) => {
    const mat = MaterialRegistry.get(materialId);
    if (!mat || !materialSelection) return;
    for (const id of materialSelection.ids) {
      const el = elements.find((e) => e.id === id);
      if (el?.archType && mat.objectTypes.includes(el.archType)) updateElement(id, { material: materialId });
    }
  }, [materialSelection, elements, updateElement]);

  const handleApplyMaterialToAll = useCallback((materialId: string, objectType: string) => {
    const mat = MaterialRegistry.get(materialId);
    if (!mat || !mat.objectTypes.includes(objectType)) return;
    for (const el of elements) {
      if (el.archType === objectType) updateElement(el.id, { material: materialId });
    }
  }, [elements, updateElement]);

  const handleResetMaterials = useCallback((objectType: string) => {
    for (const el of elements) {
      if (el.archType === objectType && el.material != null) updateElement(el.id, { material: undefined });
    }
  }, [elements, updateElement]);
```

Pass at the `<RightSidebar>` call site (alongside the existing material props):

```tsx
        materialSelection={materialSelection}
        onApplyMaterial={handleApplyMaterial}
        onApplyMaterialToAll={handleApplyMaterialToAll}
        onResetMaterials={handleResetMaterials}
```

- [x] **Step 4: Verify**

`cd autocard/frontend && npx tsc --noEmit` — clean; `npx vitest run` — baseline holds. Browser smoke: select a wall → Mat. tab shows wall families; apply "Jotun chống thấm" (blue `#3b6ea5`) → only that wall turns blue; empty selection → rail browsable, swatch applies to all of that type; reset works; roof grid unchanged. (Full scripted verification is Task 6 — a quick manual/Playwright sanity pass here is enough.)

- [x] **Step 5: Commit**

```bash
git commit -m "feat(materials): contextual per-object Materials tab" -- autocard/frontend/src/canvas/3d/components/ThreeViewerUI.tsx autocard/frontend/src/components/ThreeViewer.tsx
```

---

### Task 6: End-to-end Playwright verification

**Files:**
- Create: `/private/tmp/claude-501/-Applications-project-ARCH-TECH-CAD/7099bd49-87ba-4bc0-afec-a3d675ac9348/scratchpad/verify-materials.mjs` (scratchpad — not committed)

**Interfaces:**
- Consumes: everything from Tasks 1–5; proven harness (dev :51530, backend :8080 — check `lsof -i :51530` / `lsof -i :8080`, start if down; credentials `/Applications/project/ARCH-TECH-CAD/credential.md`; Playwright in the scratchpad `node_modules`, run scripts from that directory; Chromium flags `--no-sandbox --enable-unsafe-swiftshader --ignore-gpu-blocklist --enable-webgl --use-gl=angle --use-angle=swiftshader`; seed drawings via `POST /api/drawings` with a NON-EMPTY `data` JSON string; grid-probe canvas clicks until the expected UI reacts).

- [x] **Step 1: Write and run the script**

Scenarios (spec's testing section — every "Bắt buộc" row from the docx):

1. Seed a drawing with 3 walls (`archType:"wall"` line elements at known coords) + 1 floor polygon (`archType:"floor"`, `points` array). Open 3D tab, select tool.
2. **Single apply:** select wall A (grid-probe; the Wall properties panel appearing confirms selection) → open sidebar "Mat." tab → click the "Jotun chống thấm" swatch (`title` starts with "Jotun") → screenshot; assert via a canvas pixel/scene check or before/after screenshot diff that ONLY wall A changed color (walls B/C unchanged — the regression the docx demands).
3. **Multi apply:** shift-click walls B and C too (3 selected) → apply "Kova chống cháy/chống thấm" → all three change in one action.
4. **Apply-to-all:** toggle "Áp cho tất cả tường" → apply "Dulux ngoại thất" → every wall changes; floor unaffected (type isolation).
5. **Floor apply:** select the floor → panel switches to Sàn families → apply "Gạch Granite — Bạch Mã/Taicera" (near-black `#2b2d31`, visually decisive) → floor darkens; walls unaffected.
6. **Reset:** press "Đặt lại vật liệu tường" → walls return to plaster/facade default.
7. **Persistence:** re-apply one distinctive wall material, click Save, reload, back to 3D → material survived (screenshot).
8. **Fixture palette regression:** activate the MEP fixture tool → palette still lists 6 fixtures (Công tắc … Co ống) — Task 4 regression check.
9. Assert zero pageerrors throughout.

Screenshots to `/Applications/project/ARCH-TECH-CAD/evidence-test/materials-*.png`.

- [x] **Step 2: Iterate script issues to a decisive result; report product bugs instead of papering over them**

- [x] **Step 3: Final suite**

```bash
cd autocard/frontend && npx tsc --noEmit && npx vitest run && npm run build
```
Expected: clean / ≥ 135 passing (123 baseline + ~12 new) / build succeeds.

- [x] **Step 4: No commit** (script is scratchpad-only; any product fixes get their own scoped commits).

---

## Final verification (after all tasks)

- [x] `cd autocard/frontend && npx tsc --noEmit` — clean.
- [x] `cd autocard/frontend && npx vitest run` — all baseline + new tests passing.
- [x] `cd autocard/frontend && npm run build` — succeeds.
- [x] Task 6 green across all scenarios with screenshot evidence.
- [x] Acceptance criterion (spec): adding a new object type + materials by editing ONLY the two JSON files (plus rebuild) surfaces it in the Materials tab rail with its families — verify by temporarily adding a `railing` type entry + one material, checking the rail, then removing it (leave the repo clean).
