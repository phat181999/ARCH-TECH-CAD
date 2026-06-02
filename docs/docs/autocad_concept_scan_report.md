# AutoCAD Concept Scan Report

This report evaluates **ARCH-TECH-CAD** against the **15 Core AutoCAD Concepts** specified in your reference document. We audit what is fully implemented, what is partially supported, and where the critical architectural/feature gaps lie.

> **Last updated:** 2026-05-29 — reflects all fixes applied in this session.

---

## 📊 Summary of System Gaps

| Concept | AutoCAD Capability | ARCH-TECH-CAD Status | Identified Gaps / Missing Items |
| :--- | :--- | :--- | :--- |
| **1. Coordinate System** | X/Y placement, WCS (World) & UCS (User) coordinates | 🟡 **Partially Implemented** | Missing UCS (User Coordinate System) for dynamic custom rotation/origin offsets. |
| **2. Objects / Entities** | Line, Polyline, Circle, Arc, Rectangle, Text, Hatch, Dimension | 🟡 **Partially Implemented** | Missing drawing tools for Polylines, Arcs, Ellipses, and Splines in the UI. Hatch lacks advanced vector patterns. |
| **3. Layers** | Organize, hide, lock, color, filter independently | 🟡 **Partially Implemented** | Missing "ByLayer" style inheritance (Linetypes/colors) and advanced layer filters. |
| **4. Blocks** | Reusable components with dynamic scaling & parameters | 🟡 **Partially Implemented** | Missing Dynamic Blocks, Block Attributes (unique tags per instance), and in-canvas Block Creation tool. |
| **5. Snap System** | Endpoint, midpoint, center, nearest, intersection | 🟢 **Fully Implemented** | Highly advanced. Implements endpoint, midpoint, center, nearest, intersection, quadrant, tangent, perpendicular, apparent intersection, insertion, extension. |
| **6. Grid & Units** | mm, cm, meters, inches. Grid lines help align | 🟢 **Fixed — Adaptive Grid** | Grid now adapts between 20–200px screen spacing dynamically as user zooms. Unit selector (m/mm/ft/in) functional. |
| **7. Model vs Layout Space** | Infinite drawing space vs sheet layouts & scaling | 🟢 **Fixed — LAYOUT Tab Added** | PaperSpace was previously orphaned. A `LAYOUT` tab is now exposed in the header next to `2D` / `3D`. |
| **8. Viewport / Camera** | Zoom, pan, rotate, split views, saved cameras | 🟡 **Partially Implemented** | Missing active viewport splits (multiple views showing top/side elevations) and Named Views. |
| **9. Dimensions** | Measure walls, rooms, angles | 🟡 **Partially Implemented** | Dimensions are static objects. Missing **Associative Dimensions** (updating when elements move) and customizable style overrides (DIMSTYLE). |
| **10. Constraints** | Parametric rules: parallel, perpendicular, fixed | 🔴 **Metadata Only** | Constraint schemas exist in types & DB, but **no geometric solver engine** exists to enforce rules during modifications. |
| **11. Transform Operations** | Move, Rotate, Scale, Mirror, Copy, Trim, Extend | 🟢 **Fixed — OFFSET + Trim/Extend** | Real perpendicular geometric OFFSET implemented. Trim and Extend tools now perform line-line intersection geometry and are enabled in the sidebar. |
| **12. Rendering Engine** | GPU rendering, high-performance drawing (WebGPU/GL) | 🟡 **Partially Implemented** | 2D canvas is CPU-bound. Large drawings will experience scaling latency without 2D GPU acceleration (WebGL/WebGPU). |
| **13. File Formats** | Native DWG, exchange DXF, SVG, STL | 🟡 **Partially Implemented** | Lacks native DWG binary import/export and 3D print file exports (STL/OBJ/glTF). |
| **14. CAD Architecture** | UI → Command → Geometry → Render → File System | 🟡 **Partially Implemented** | Tight coupling between rendering and domain logic in `CadEngine.ts`. Lacks a separate geometry engine library. |
| **15. Command System** | CLI execution, aliases, shortcuts | 🟡 **Partially Implemented** | CLI commands are flat single-line arguments. Missing multi-step interactive prompts and cursor dynamic inputs. |

---

## 🔍 In-Depth Concept Audit & Technical Findings

### Concept 1: Coordinate System
* **Status**: 🟡 Partially Implemented
* **Details**: Points and coordinates are modeled correctly in standard 2D Cartesian space. However, AutoCAD depends heavily on the **User Coordinate System (UCS)**, enabling users to re-orient the origin and angle to draw features at odd angles easily. ARCH-TECH-CAD only supports the static **World Coordinate System (WCS)**.

### Concept 2: Objects & Entities
* **Status**: 🟡 Partially Implemented
* **Details**:
  * [dxf.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/dxf.ts) imports lines, rectangles, circles, arcs, text, and hatches correctly.
  * However, there are no drawing tools for **Arcs**, **Polylines** (as single selectable multi-segment entities), **Ellipses**, or **Splines** in the toolbar.
  * **Hatch Pattern Styles**: The hatch tool only draws standard color fills. Standard AutoCAD vector patterns (like grass, steel, sand, cross-hatching) that scale dynamically are missing.

### Concept 3: Layers
* **Status**: 🟡 Partially Implemented
* **Details**:
  * Basic active layer switches, hiding, locking, duplicating, deleting, and renaming layers are supported.
  * `CadEngine.ts` applies `el.strokeColor || layerStyle.strokeColor` — partial ByLayer inheritance for stroke color is in place.
  * **Still missing**: default linetype (dashed/dotted) and lineweight inheritance per layer.

### Concept 4: Blocks (Reusable Components)
* **Status**: 🟡 Partially Implemented
* **Details**:
  * You can insert blocks from a library and explode them back into individual segments.
  * **Missing Dynamic Blocks**: Unable to stretch, rotate, flip, or switch visual states of blocks dynamically in the editor.
  * **Missing Block Attributes (ATTDEF)**: Unable to include text templates in blocks that hold custom strings per instance (e.g. unique label numbers for doors).
  * **Missing Block definition UI**: The library definitions are hardcoded; you cannot select canvas elements and combine them into a new block definition in the editor.

### Concept 5: Snap System (OSNAP)
* **Status**: 🟢 Fully Implemented
* **Details**:
  * The file [snap.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/snap.ts) is highly advanced and robust.
  * It fully implements Endpoint, Midpoint, Center, Nearest, Grid, Intersection, Geometric Center, Node, Quadrant, Perpendicular, Tangent, Insertion, Extension, and Apparent Intersection snapping with correct visual indicators.

### Concept 6: Grid & Units
* **Status**: 🟢 Fixed — Adaptive Grid
* **Details**:
  * Units support metric (`m`/`mm`) and imperial (`ft-in`/`in`) conversions with a working unit selector in the header.
  * **Adaptive Grid** (`CadEngine.ts`): the grid spacing now adjusts dynamically during zoom:
    ```typescript
    let gridSize = 40;
    while (gridSize * zoom < 20) gridSize *= 4;
    while (gridSize * zoom > 200) gridSize /= 4;
    ```
  * Grid lines always remain between 20–200px apart on screen regardless of zoom level, matching AutoCAD behaviour.

### Concept 7: Model Space vs Layout Space
* **Status**: 🟢 Fixed — LAYOUT Tab Added
* **Details**:
  * The full layout rendering engine [PaperSpace.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/components/PaperSpace.tsx) — with paper sizes A4–A0, title block overlays, and print scaling — is now accessible.
  * A **LAYOUT** button was added to the header view-mode switcher alongside `2D` and `3D`. Clicking it sets `showPaperSpace = true` (exclusively). Switching back to 2D or 3D hides Paper Space.
  * `EditorHeader.tsx`: props `showPaperSpace` and `setShowPaperSpace` added and wired to the `CanvasEditor.tsx` state.

### Concept 8: Viewport / Camera
* **Status**: 🟡 Partially Implemented
* **Details**:
  * Pan and zoom work correctly. Standard Orbit/Zoom controls work in the Three.js 3D window.
  * **Missing**: Ability to split the drafting canvas into multiple view tiles (e.g. drawing in top view while looking at the side view) or saving named view snapshots.

### Concept 9: Dimensions
* **Status**: 🟡 Partially Implemented
* **Details**:
  * Linear/Aligned dimensions can be drawn and measured.
  * **Missing Associative Dimensions**: Dimensions in AutoCAD automatically adjust their text measurement when you stretch or move a wall. In ARCH-TECH-CAD, dimensions are separate entities and do not resize when elements are modified.
  * **Missing DIMSTYLE presets**: Customizing arrows, text fonts, offsets, and tolerances is unsupported.

### Concept 10: Constraints (Parametric CAD)
* **Status**: 🔴 Metadata Only
* **Details**:
  * While the types define `Constraint` schemas, there is **no constraint solver engine** (like geometric solvers or numerical matrices) implemented to recalculate object positions when a constraint is active. Constraints are only stored as static data fields.

### Concept 11: Transform Operations
* **Status**: 🟢 Fixed — Real OFFSET + Trim/Extend
* **Details**:
  * Move, Copy, Rotate, Scale, and Mirror remain fully implemented.
  * **Geometric OFFSET** (`commandStore.ts`): The diagonal `x + offset` hack is replaced with proper perpendicular geometry:
    - **Line/Wall**: shifts both endpoints along the 90° CCW normal of the segment direction.
    - **Circle/Arc**: increases `radius` by `dist`.
    - **Rectangle**: expands all four sides outward by `dist`.
  * **Trim (TR)** (`CanvasEditor.tsx`): Enabled in sidebar. Click on a line segment — the tool finds all intersecting lines, computes intersection parameters along the clicked segment, and truncates the clicked side to the nearest intersection.
  * **Extend (EX)** (`CanvasEditor.tsx`): Enabled in sidebar. Click on the end of a line — the tool extrapolates the line direction and extends it until it meets an intersecting boundary line.

### Concept 12: Rendering Engine
* **Status**: 🟡 Partially Implemented
* **Details**:
  * ARCH-TECH-CAD renders its 2D canvas strictly on a CPU 2D Context. Complex layouts with thousands of vector assets will suffer from performance drop-offs. Modern CAD web applications (like AutoCAD Web) use WebGL/WebGPU to offload line drawing to the GPU.

### Concept 13: File Formats
* **Status**: 🟡 Partially Implemented
* **Details**:
  * Minimal DXF parsing (Ascii R12 continuous lines) and basic SVG/PNG exports are supported.
  * Native DWG files (standard binary format) and 3D printing exports (STL, OBJ) are missing.

### Concept 14: CAD Internals & Architecture
* **Status**: 🟡 Partially Implemented
* **Details**:
  * In [CadEngine.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/CadEngine.ts), rendering and domain updates are highly coupled (e.g. room boundary math is computed within the render loops). The state store holds too many mixed concerns, which compromises separation of concerns.

### Concept 15: Command System
* **Status**: 🟡 Partially Implemented
* **Details**:
  * The command bar allows executing aliases (e.g. `L`, `C`, `REC`, `TR`, `EX`, `O`).
  * `TR` and `EX` now activate working tools; `O` now performs a real geometric offset.
  * However, AutoCAD commands are interactive (e.g. calling `CIRCLE` asks you to type or click the center, then guides you to click or type the radius). Here, you must type the entire arguments string at once (e.g. `CIRCLE 100,100 50`) without interactive guidance prompts.

---

## ✅ Fixes Applied in This Session

| Fix | File(s) | Change |
|---|---|---|
| **Adaptive Grid** | `CadEngine.ts:283` | Replaced `const gridSize = 40` with a `while`-loop that keeps screen spacing between 20–200px at all zoom levels |
| **Layout / Paper Space toggle** | `EditorHeader.tsx`, `CanvasEditor.tsx` | Added `LAYOUT` tab to the 2D/3D view-mode switcher; wired to `showPaperSpace` state |
| **Real Geometric OFFSET** | `commandStore.ts` | Replaced diagonal `x+offset, y+offset` with correct perpendicular normal offsets for line, circle, arc, rectangle, and wall types |
| **Trim (TR)** | `CanvasEditor.tsx`, `CadSidebar.tsx` | Enabled sidebar button; added `handleMouseDown` handler using line-line intersection parameterization |
| **Extend (EX)** | `CanvasEditor.tsx`, `CadSidebar.tsx` | Enabled sidebar button; added `handleMouseDown` handler that extrapolates beyond endpoints to find boundary intersection |

---

> [!NOTE]
> Remaining high-impact gaps for future sprints: **Associative Dimensions** (Concept 9), **Parametric Constraint Solver** (Concept 10), **UCS support** (Concept 1), and **WebGL 2D rendering** (Concept 12).
