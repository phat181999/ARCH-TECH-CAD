# Implementation Plan: File Import/Export, Grid Toggle, and View Cube Navigation (Revised v3)

This plan details the implementation of file importing/exporting (DXF and native JSON format), a dedicated keyboard hotkey for toggling the drawing grid, a 3D View Cube controller for navigation in the 3D Viewer, and custom interactive React dialogs for Room Labels and annotations to replace browser-native prompts.

---

## User Review Required

> [!IMPORTANT]
> **Store-Level Hydration Actions**
> To support atomic "Replace" and "Merge" operations, we will add two new actions in [drawingStore.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/stores/drawingStore.ts):
> 1. `importDrawingState`: Completely overrides elements, layers, active layer, block definitions, current plan, measurements, constraints, and clears selected element IDs and history.
> 2. `mergeDrawingState`: Safely merges imported elements, layer structures, block definitions, and architectural plan elements, while appending the result to the history stack.
>
> **Interactive Annotation Dialogs**
> Instead of blocking browser-native `prompt()` dialogs, we will introduce a beautiful glassmorphic modal overlay. This will handle input for Room Labels, generic text, and leader annotations. It includes preset room chips (e.g. "Bedroom", "Kitchen") and optional area measurements for room labels.
>
> **3D Camera Control Ownership Model**
> To prevent conflict between user navigation, auto-framing, and View Cube animations:
> - **Initial Framing**: `<AutoFrame>` runs *exactly once* on drawing load using a `hasFramed` ref.
> - **User Orbiting**: Controlled entirely by `<OrbitControls>`.
> - **View Cube Animation**: `<CameraController>` overrides the camera position and `OrbitControls.target` using a `useFrame` lerp loop.
> - **Animation Interruption**: If the user clicks or drags the viewport canvas during transition, `viewAngle` resets to `null`, instantly relinquishing camera control back to `OrbitControls`.

---

## Proposed Changes

### 1. Store Updates
#### [MODIFY] [drawingStore.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/stores/drawingStore.ts)
- Add `revisionKey: string` to the state.
- Add `importDrawingState` and `mergeDrawingState` actions:
  - `importDrawingState(doc: DrawingDocument)`: Wipes existing state, applies the document parameters, and updates `revisionKey`.
  - `mergeDrawingState(doc: DrawingDocument)`: Applies the ID collision resolution logic (re-keying elements and plans, remapping relationships, checking layer/block name collisions), appends elements to the current array, and pushes a history state.

### 2. Canvas & Sidebar File Integration
#### [MODIFY] [CanvasEditor.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/CanvasEditor.tsx)
- Implement schema normalization inside `handleImportJson`:
  - **Legacy Array (v0a)**: Normalize raw arrays `[...]` into a `DrawingDocument` shape.
  - **Legacy Object (v0b)**: Normalize objects lacking `fileType` but containing elements into the `DrawingDocument` schema.
  - **Versioned Document (v1)**: Load directly.
- Add confirmation dialogs for **Replace** vs. **Merge**.
- Bind `F7` and `Ctrl+G` / `Cmd+G` keyboard events inside `handleKeyDown` to toggle `gridVisible`.
- Implement full `DrawingDocument` exporting inside `exportCanvas` under the `"json"` case.

#### [MODIFY] [CadSidebar.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/components/CadSidebar.tsx)
- Pass `onImportJson` and `onExportJson` callbacks.
- Place DXF/JSON import buttons side-by-side.

### 3. Annotation & Room Label Custom Dialogs
#### [MODIFY] [CanvasEditor.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/CanvasEditor.tsx)
- Declare local states:
    - `activeDialog: { type: "room-label" | "text" | "leader", x: number, y: number } | null`
    - Form inputs: `roomLabelText`, `roomLabelArea`, `roomLabelType` (preset category), `customTextContent`, `customTextSize`, `customTextColor`.
- Intercept tool clicks in the mouse handlers (line 589):
  - Instead of standard `prompt()`, open `activeDialog` capturing target coordinates.
  - On submit:
    - For `room-label`, place a standardized text block: `Name (Area m²)` using the `A-ROOM` layer.
    - For `text`, create a `DrawingElement` of type `"text"` with selected size and color.
    - For `leader`, store the annotation content in `textInput` and trigger the mouse-drag drawing state for leader lines.
- Implement HTML/JSX for the modal overlay with a dark/light glassmorphic card design. Add presets quick-click chips for rooms ("Bedroom", "Kitchen", "Living Room", "Bathroom", "Office").

### 4. View Cube camera control
#### [MODIFY] [ThreeViewer.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/components/ThreeViewer.tsx)
- Add props: `revisionKey?: string`.
- Add floating `<ViewCube>` HTML overlay component.
- Update `<AutoFrame>` to use `revisionKey` for framing resets.
- Implement `<CameraController>`:
  - Computes centers and camera target distances from bounds.
  - Runs a `useFrame` camera position and `OrbitControls.target` lerp loop.
  - Reset `viewAngle` to `null` to hand back control if pointer events are detected on the canvas container.

---

## Verification Plan

### Automated Tests
#### [NEW] [dxf.test.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/dxf.test.ts)
- Write tests using the native Node test runner (`node:test`) for:
  - DXF export/import round-tripping (checking geometry precision and layers preservation).
  - JSON schema validation and backward compatibility (normalizing legacy array, legacy object, and v1 shapes).
  - Store hydration and merge ID collision resolution (verifying mapped element/wall IDs, re-keyed doors reference links, block definition collision renames).
- Run tests via terminal command:
  ```bash
  npx tsx --test src/canvas/dxf.test.ts
  ```

### Manual Verification
1. **Canvas Grid Hotkeys**: Press `F7` or `Ctrl+G` to toggle drawing grids.
2. **File Export/Import**: Export drawing to JSON and DXF, then import them and confirm correctness (verifying replace vs. merge behavior).
3. **View Cube Angles**: Click direction buttons in the 3D Viewer overlay and check camera animations.
4. **Annotation Modal**: Activate Room Label tool, click canvas, select preset "Bedroom", type "15" for area, and verify the beautiful label `Bedroom (15 m²)` is added. Verify same dialog applies to Text and Leader.
