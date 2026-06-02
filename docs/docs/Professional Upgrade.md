# Implementation Plan - ARCH-TECH-CAD Professional Upgrade

This document outlines the gap analysis and high-level architectural roadmap to transition ARCH-TECH-CAD from a "vector whiteboard drawing tool" into a "real, parametric CAD platform" based on professional workflows.

---

## 1. Codebase Audit & Gap Analysis

Following a thorough investigation of the active workspace, here is the current status of each of the 20 core CAD features:

| Feature / System | Current Codebase Status | Gap Details & Actions Needed |
| :--- | :--- | :--- |
| **1. Proper Selection System** | **Basic** | Single element selection and basic bounding box selection are active. Lacks visual hover highlights, shift-select modifiers, crossing selection (green, right-to-left intersection), and window selection (blue, left-to-right strict enclosure). |
| **2. Grip Points / Edit Handles** | **Missing** | Selected elements display a dashed blue bounding box border only. Interactive vertices (grip points) to stretch lines, resize circles/rectangles, and rotate blocks are missing. |
| **3. Object Data Model** | **Flat / Geometrical** | Elements inside `DrawingElement` (in `types.ts`) are stored in flat tables with direct properties. Structure lacks dedicated `metadata`, `constraints`, and `relations` schemas to enforce associative rules. |
| **4. Architectural Intelligence** | **Basic (AI only)** | The AI generator can output wall polylines and doors, but manually placed doors/windows do not automatically host on or cut openings into double-line manual walls. Walls do not calculate room enclosures dynamically. |
| **5. Constraint System** | **Missing** | No geometric solver exists (e.g. constraints like Parallel, Perpendicular, Horizontal, Vertical, or Fixed Distance). |
| **6. Command System Architecture** | **Missing (UI-driven)** | Direct store setters (`updateElement`) modify coordinates. Actions are not modeled as transactions or command objects (e.g. `LINE`, `MOVE`, `TRIM`, `FILLET` as commands). |
| **7. Missing CAD Operations** | **Missing / Basic** | Basic copy/move/rotate operations exist. Core modifying workflows (`Trim`, `Extend`, `Fillet`, `Chamfer`, `Mirror`, `Array`) are entirely missing. |
| **8. Snapping Engine Upgrade** | **Advanced** | Snapping (`snap.ts`) is highly developed, supporting Endpoint, Midpoint, Center, Nearest, Intersection, and Tangent snaps. However, it lacks Polar Tracking, Ortho tracking vectors, and tracking lines. |
| **9. Layer Management System** | **Basic** | Sidebar lists layers, locks, visibility, and basic name/color changes. Lacks "freeze/thaw" (excluding frozen elements from geometry operations), layer filters, and layer group management. |
| **10. Scene Graph / Hierarchy** | **Flat** | Canvas elements are stored in a flat array (`elements`). Lacks tree structure/hierarchy representation (Layers -> Groups -> Blocks -> Elements). |
| **11. Infinite Canvas / Precision** | **Basic** | Simple mouse wheel zoom and drag panning. Lacks true world-to-viewport coordinate matrix projection, infinite zoom limits, and dynamic scaling grids. |
| **12. Measurement Engine** | **Visual Only** | Dimension lines are static drawing elements. They do not dynamically attach to endpoints (associative dimensions) or update when hosting geometry changes. |
| **13. Undo / Redo Architecture** | **Basic** | Relies on linear Zustand store snapshots (`history: DrawingElement[][]`). High memory overhead; lacks incremental transaction command stacks. |
| **14. Object Relationship System** | **Missing** | Elements are independent; deleting/moving a parent wall does not affect hosted doors/windows/labels. |
| **15. AI Integration Layer** | **Direct Generation** | AI prompt converts to raw geometric objects instead of structured CAD commands fed to a parser/solver engine. |
| **16. Missing Professional UX** | **Basic HUD** | Lacks AutoCAD-style CLI Command Bar, coordinate entry (`@10,20` or absolute `100,50`), dynamic crosshair cursor prompts, and coordinate HUD tracking. |
| **17. Blocks / Symbols System** | **Basic** | Block library exists (`blockLibrary.ts` and insert functions), but blocks cannot be scaled, rotated, or mirrored interactively on canvas. |
| **18. Export Architecture** | **Basic** | Basic SVG/DXF export exists, but DXF does not support detailed layers, styles, custom text fonts, or native dimensions. |
| **19. Performance Layer** | **Missing** | Hit testing and rendering iterate over the entire list of elements sequentially. Needs spatial search (Quadtree) for high entity counts. |
| **20. CAD Rules** | **Missing** | Whiteboard-style drawing without strict precision, snapping enforcement, and boundary rules. |

---

## 2. Recommended Next Steps & Roadmap

To step up to **Parametric / Professional CAD**, we propose a phased execution. Phase 1 targets the highest impact items that establish the core CAD experience.

### Phase 1: Precision Selection, Grip Handles, & Layer Operations (Core Interaction)
- **Interactive Grip Points**: Add edit handles (blue square grips) to selected elements. Dragging a grip updates coordinates in the store (`x1/y1`, `cx/cy`, etc.).
- **Advanced Selection System**:
  - Implement crossing select (green box, right-to-left) and window select (blue box, left-to-right).
  - Add element hover highlighting.
  - Implement Shift+Click addition/removal.
- **Layer Visibility & 3D Filtering**: Filter elements on invisible layers out of selection click targeting, 2D canvas draws, and 3D viewer meshes. Use high-quality Lucide icons (`Eye`, `EyeOff`, `Lock`, `Unlock`) with visual fade outs for hidden layers in the sidebar.

### Phase 2: Command Architecture & CLI UX (Core Platform)
- **Command Dispatcher**: Implement a command pipeline (`Command.execute()`, `Command.undo()`).
- **Interactive Command Bar (CLI)**: Introduce a text command bar at the bottom. Typing shortcuts (`L` for line, `M` for move, `TR` for trim) changes states or prompts for parameters. Support typed absolute coordinates (e.g., `50,120`) and relative inputs (e.g., `@10,0`).
- **Transaction-based Undo/Redo**: Store diff mutations on the command stack instead of whole document snapshots.

### Phase 3: Parametric Architecture & Relationships (BIM Lite)
- **Associative Dimensions**: Bind dimensions to element vertices so resizing an element automatically stretches the dimension line and updates the text.
- **Architectural Hosting**: Embed openings (doors, windows) into wall entities. Translate child objects when the host wall moves, and automatically slice walls at opening intersections.

---

## 3. Immediate Phase 1 Implementation Plan

We will start with the immediate Phase 1 features, targeting the following components:

### Component: Canvas Interaction Layer
#### [MODIFY] [CanvasEditor.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/CanvasEditor.tsx)
- **Crossing / Window Select**:
  - Track drag start/current. If dragging left-to-right, set selection box color to blue. If right-to-left, set to green.
  - On mouse up, filter `elements` using:
    - *Window Select (L-to-R)*: Element must be fully within the selection bounds.
    - *Crossing Select (R-to-L)*: Element coordinates intersect or are inside selection bounds.
- **Hover Highlighting**:
  - Keep a `hoveredElementId` state. On mouse move, run a low-tolerance `getShapeAtPoint` check and set `hoveredElementId`.
- **Shift+Click Multi-select**:
  - On click, if `Shift` is pressed, append or remove clicked element ID from `selectedElementIds`.
- **Interactive Grips**:
  - Track active handle dragging (`activeGripRef`: `{ elementId: string, gripIndex: number }`).
  - Render small square grips on selected elements in `CadEngine.ts`.
  - In `handleMouseDown`, check if click hits any active element grip. If yes, start grip dragging.
  - In `handleMouseMove`, translate the grip's position and update the element's coordinate properties.

### Component: Render Engine
#### [MODIFY] [CadEngine.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/CadEngine.ts)
- **Hover Render**: Draw hovered elements with a distinct color (e.g., orange `#f97316`) or subtle outer glow.
- **Grip Render**: Draw small filled blue squares (`#3b82f6`) at:
  - Line: start, mid, end.
  - Circle / Arc: center, 4 quadrant points.
  - Rectangle: 4 corners.
  - Text / Block: origin anchor point.
- **Selection Box Color**: Draw green-shaded selection boxes for crossing selects, and blue-shaded selection boxes for window selects.

### Component: Sidebar UI
#### [MODIFY] [CadSidebar.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/components/CadSidebar.tsx)
- Re-style layers list using Lucide icons (`Eye`, `EyeOff`, `Lock`, `Unlock`, `Trash2`, `Copy`, `Edit3`).
- Implement visual fade-outs (`opacity-40`) on layers toggled hidden.

---

## 4. Verification Plan

### Automated Checks
- Check TypeScript build cleanly:
  ```bash
  npx tsc --noEmit
  ```

### Manual Verification
1. **Interactive Selection Box**:
   - Drag a selection box from left-to-right. Verify a blue box appears and only elements completely enclosed are selected.
   - Drag from right-to-left. Verify a green box appears and elements overlapping are selected.
2. **Hover Highlight**:
   - Hover the cursor over a line/circle. Verify its boundary turns orange, giving visual feedback.
3. **Grip Handles**:
   - Select a line. Verify blue square grips appear at start, mid, and end.
   - Drag the start grip. Verify the line stretches accordingly and updates the property panel coordinates.
4. **Layer Show/Hide UI**:
   - Toggle visibility on a layer. Verify its elements hide, cannot be clicked or selected, and the layer row fades in opacity.
