# ARCH-TECH-CAD — Task List

> Xem kế hoạch đầy đủ: [`ke-hoach-phat-trien-arch-tech-cad.docx`](./ke-hoach-phat-trien-arch-tech-cad.docx)

---

## ✅ Hoàn thành (Session 1 — nền tảng)

- [x] Đổi nhãn nút `2D` → `Mô hình 2D`, `3D` → `Mô hình 3D` — `EditorHeader.tsx`
- [x] Nâng cấp lighting 3D: HemisphereLight, DirectionalLight shadow-mapSize 4096
- [x] PCFSoftShadowMap — bóng đổ mềm, giảm aliasing
- [x] ACESFilmic tone mapping, exposure 1.15
- [x] `BuildingSummaryPanel.tsx` — panel vật liệu + Gantt timeline overlay trong 3D view
- [x] Auto-show BuildingSummaryPanel khi vào Mô hình 3D
- [x] Tài liệu kế hoạch phát triển v2.0 (`ke-hoach-phat-trien-arch-tech-cad.docx`)

---

## ✅ P1 — Đã hoàn thành

- [x] PBR texture maps: concrete, brick, glass, wood, roof_tile — `materialService.ts`
- [x] Kính (glass): opacity 0.28, roughness 0.04, metalness 0.12
- [x] Toggle "Chất liệu thực (PBR)" trong `ThreeViewerUI.tsx → BimStylingPanel`
- [x] `<Sky>` component (@react-three/drei) — sun position, azimuth, turbidity
- [x] `<ContactShadows>` bóng mềm dưới công trình
- [x] Export Excel (.xlsx) dự toán từ `EstimationDashboard.tsx` — 3 sheet: Tổng hợp / Chi tiết / Nhân công
- [x] Input "Số tầng" trong estimation — nhân hệ số toàn bộ vật liệu
- [x] Dropdown "Loại kết cấu": Tường gạch / Khung BTCT / Khung thép

---

## ✅ P2 — Đã hoàn thành

- [x] Post-processing: Bloom + Vignette, `EffectComposer` — `@react-three/postprocessing`
- [x] Auto-disable effects khi FPS < 30 — `PerformanceMonitor onDecline`
- [x] Quality selector (Thấp / Vừa / Cao) trong `BimStylingPanel`
- [x] `<Environment preset='sunset'>` HDRI environment map
- [x] Room-level takeoff: gạch + sơn riêng WC / bếp / ngủ / khách — `EstimationDashboard.tsx`
- [x] Ground texture cỏ PBR tiling — `THREE.CanvasTexture` 512×512, repeat 40×40 — `ThreeViewer.tsx`
- [x] GLTF 2.0 export — Three.js `GLTFExporter` (dynamic import) — `ThreeViewer.tsx`
- [x] API giá VLXD theo vùng: HN×1.05 / HCM×1.00 / ĐN×0.92 — `material_handler.go`
- [x] Model `MaterialPreset` + route `GET /api/material-presets?region=HN` — `backend/`
- [x] AI Smart Dimension: auto generate dimension elements từ wall geometry — `ai_handler.go`
- [x] Cursor presence: `useCursorPresence.ts` + `CursorOverlay.tsx` — WebSocket live cursors
- [x] Wire cursor overlay vào `CanvasEditor.tsx` — broadcastCursor on mousemove
- [x] Version snapshots: `useVersionSnapshots.ts` — auto-save 5 phút, max 20, localStorage
- [x] AI Cost Optimizer: 3 tier Tiết kiệm 0.72× / Tiêu chuẩn 1.00× / Cao cấp 1.45× — `EstimationDashboard.tsx`
- [x] Region selector HN/HCM/ĐN trong header EstimationDashboard — `materialPresets` API client
- [x] IFC 2x3 export (STEP text, không cần WASM) — `canvas/ifcExporter.ts`
- [x] Nút "Xuất IFC 2x3" trong BimStylingPanel — `ThreeViewerUI.tsx` + `ThreeViewer.tsx`
- [x] Human mannequin 3D 1.7m (torso cylinder, đầu sphere, 2 chân, 2 tay) — `ThreeViewer.tsx`

---

## ✅ Tech Debt — Đã hoàn thành

- [x] Vitest setup + unit tests — `vite.config.js` test block, `npm run test`
- [x] `snap.test.ts` — 16 tests: endpoint, midpoint, nearest, grid, priority, master switches
- [x] `ifcExporter.test.ts` — 13 tests: file structure, walls, doors/windows, px→m, determinism
- [x] `materialPresets` API client — `api/client.ts`
- [x] `web-ifc` npm package installed (dùng STEP text writer không cần WASM)

---

## 🟢 P3 — Còn lại (backlog)

- [ ] GLTF furniture library: ghế, bàn, giường, bồn rửa (< 100KB/model)
- [ ] `FurnitureLibrary.tsx` — panel kéo thả furniture, snap xuống sàn
- [ ] Cây xanh low-poly billboarding: 5 loại, bụi cây, cỏ
- [ ] Yjs CRDT — auto merge khi 2 user sửa cùng element — `websocket_handler.go`
- [ ] Comment annotations: ghim vào tọa độ canvas, reply, resolve
- [ ] Gantt tương tác: kéo thanh phase, dependency arrows
- [ ] AI Design Suggestions: hướng cửa sổ, thông gió, lưu thông người

---

## ⚪ P4 — Backlog

- [ ] AI Chat trong 3D: lệnh tự nhiên → cập nhật elements realtime
- [ ] DepthOfField, ChromaticAberration post-processing
- [ ] OBJ + MTL export — Three.js `OBJExporter`
- [ ] PDF bản vẽ A0/A1 chất lượng in — `pdf-lib`: khung tên, tỉ lệ, con dấu KTS
- [ ] Push notification: mention, share, task assign
- [ ] E57 Point Cloud import

---

## ⚙️ Technical Debt — Còn lại

- [ ] 3D InstancedMesh cho tường cùng material — giảm draw calls
- [ ] R-tree spatial index cho snap queries — thay O(n) linear scan
- [ ] Web Worker cho DXF parse — không block UI thread
- [ ] Service Worker cache: textures, block definitions, static assets
- [ ] API retry: exponential backoff 3 lần, circuit breaker WebSocket
- [ ] Unit tests bổ sung: `hitDetection.ts`, `wallGeometry.ts`
- [ ] Tách `CanvasEditor.tsx` (2700+ dòng) → `Canvas2DLayer`, `ToolbarPanel`, `HUD`

---

## 📋 Tóm tắt toàn bộ công việc đã hoàn thành (2 session)

### Session 1 — P1: Nền tảng 3D & Estimation

| # | Feature | File(s) | Chi tiết |
|---|---------|---------|---------|
| 1 | Sky + Sun | `ThreeViewer.tsx` | `<Sky>` rayleigh scattering, `<ContactShadows>` bóng mềm |
| 2 | PBR Materials | `materialService.ts` | TextureLoader cache, 8 preset: concrete/brick/wood/glass/steel/marble/plaster/roof_tile |
| 3 | Glass material | `materialService.ts` | opacity=0.28, roughness=0.04, DoubleSide |
| 4 | Toggle PBR | `ThreeViewerUI.tsx` | Switch "Chất liệu thực" trong BimStylingPanel |
| 5 | Excel export | `EstimationDashboard.tsx` | SheetJS: 3 sheet (Tổng hợp / Chi tiết / Nhân công) |
| 6 | Số tầng | `EstimationDashboard.tsx` | Input floors → nhân hệ số toàn bộ vật liệu |
| 7 | Loại kết cấu | `EstimationDashboard.tsx` | Dropdown: gạch/BTCT/thép → điều chỉnh thời gian |

### Session 2 — P2: Visual, AI, Collaboration, Export

| # | Feature | File(s) | Chi tiết |
|---|---------|---------|---------|
| 8 | Post-processing | `ThreeViewer.tsx` | `EffectComposer` + `Bloom` (luminanceThreshold 0.85) + `Vignette` |
| 9 | Auto FPS | `ThreeViewer.tsx` | `PerformanceMonitor` onDecline → quality="low" → tắt effects |
| 10 | Quality selector | `ThreeViewerUI.tsx` | Thấp/Vừa/Cao chips, auto-downgrade badge |
| 11 | Environment map | `ThreeViewer.tsx` | `<Environment preset='sunset'>` HDRI, conditional on quality≠low |
| 12 | Room takeoff | `EstimationDashboard.tsx` | 5 loại phòng: WC/bếp/ngủ/khách/other — gạch+sơn riêng |
| 13 | Ground texture | `ThreeViewer.tsx` | `THREE.CanvasTexture` 512×512 vẽ cỏ, repeat 40×40, receiveShadow |
| 14 | GLTF export | `ThreeViewer.tsx` | `GLTFExporter` dynamic import, filter ground-plane, download blob |
| 15 | IFC 2x3 export | `canvas/ifcExporter.ts` | STEP P21 text writer: IFCWALL, IFCDOOR, IFCWINDOW, px→metres |
| 16 | Mannequin 3D | `ThreeViewer.tsx` | Hình người 1.7m: torso+đầu+2 chân+2 tay, auto-position cạnh công trình |
| 17 | Regional pricing | `material_handler.go` | 15 vật liệu, hệ số: HN×1.05/HCM×1.00/ĐN×0.92 |
| 18 | AI Smart Dim | `ai_handler.go` | Auto dimension từ wall elements, offset 80px, label "X.XX m" |
| 19 | Cursor presence | `useCursorPresence.ts` + `CursorOverlay.tsx` | WebSocket live cursors, màu deterministic per userId, prune 5s |
| 20 | Region selector | `EstimationDashboard.tsx` | HN/HCM/ĐN toggle, `materialPresets` API, regionFactor áp vào KPI card |
| 21 | Version snapshots | `useVersionSnapshots.ts` | Auto-save 5 phút, max 20, localStorage, named restore |
| 22 | AI Cost Optimizer | `EstimationDashboard.tsx` | 3 tier: Tiết kiệm 0.72×/Tiêu chuẩn/Cao cấp 1.45× |
| 23 | Vitest tests | `snap.test.ts` + `ifcExporter.test.ts` | 29 tests pass: snap geometry + IFC structure/dimensions/determinism |

### Thống kê

- **Files đã sửa/tạo mới**: 18 frontend files, 3 backend files
- **Unit tests**: 29 tests pass (0 fail) — `npm run test`
- **TypeScript**: 0 errors — `npx tsc --noEmit --skipLibCheck`
- **Backend routes mới**: `GET /api/material-presets`, `POST /api/ai/smart-dimensions`
- **npm packages mới**: `web-ifc`, `vitest`, `@vitest/ui`
