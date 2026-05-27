# Implementation Plan: Implement Remaining AutoCAD-Style Snap Modes

This plan details the implementation of the remaining AutoCAD-style Object Snap (OSNAP) modes shown in the user's reference image:
1. **Geometric Center** (`geometricCenter`): Snaps to the centroid of closed polylines, rectangles, circles, and polygons.
2. **Node** (`node`): Snaps to point objects and text nodes.
3. **Quadrant** (`quadrant`): Snaps to the 4 quadrant points of circles, arcs, and ellipses.
4. **Insertion** (`insertion`): Snaps to the insertion points of blocks and text elements.
5. **Perpendicular** (`perpendicular`): Snaps to points forming a perpendicular angle from the active start point to lines, walls, or circles.
6. **Tangent** (`tangent`): Snaps to tangent points on circles or arcs from the active start point.
7. **Apparent Intersection** (`apparentIntersection`): Snaps to the intersection point of two non-parallel line segments if their infinite lines were extended.
8. **Extension** (`extension`): Snaps to points along the collinear extension lines of line segments.

---

## Proposed Changes

### 1. Types & Store State

#### [MODIFY] [types.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/types.ts)
* Expand the `SnapModes` interface to include the 8 new snap modes:
  ```typescript
  export interface SnapModes {
    endpoint: boolean;
    midpoint: boolean;
    center: boolean;
    grid: boolean;
    intersection: boolean;
    nearest: boolean;
    // New snap modes
    geometricCenter: boolean;
    node: boolean;
    quadrant: boolean;
    perpendicular: boolean;
    tangent: boolean;
    insertion: boolean;
    apparentIntersection: boolean;
    extension: boolean;
  }
  ```

#### [MODIFY] [drawingStore.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/stores/drawingStore.ts)
* Initialize the new snap modes in the default state and in `resetEditor`.
* Enable `endpoint`, `midpoint`, `center`, `geometricCenter`, `intersection`, and `nearest` by default. Set others to false by default.

---

### 2. Snapping Calculations Engine

#### [MODIFY] [snap.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/snap.ts)
* Update `findNearestSnap` to accept `startPoint?: Point | null` parameter.
* Implement geometry snap calculation helpers:
  * **Geometric Center**:
    * Rectangle centroid: `(x + w/2, y + h/2)`.
    * Polygon/Polyline centroid: Compute centroid of points using signed polygon area. Fallback to average vertex coordinates for degenerate shapes.
  * **Node**:
    * Snap to point elements `(x, y)`.
  * **Quadrant**:
    * Circle quadrants: `(cx ± radius, cy)` and `(cx, cy ± radius)`.
    * Arc quadrants: Apply the same circle quadrant coordinates, but verify if the angle lies within the arc's angular range (using a normalized angle-checking helper).
    * Ellipse quadrants: `(cx ± rx, cy)` and `(cx, cy ± ry)`.
  * **Insertion**:
    * Snap to block or text origin `(x, y)`.
  * **Perpendicular**:
    * Only active if `startPoint` is provided.
    * Line segment perpendicular: project `startPoint` onto the infinite line containing the segment. Check if the projection lies on the segment.
    * Circle perpendicular: Snap to points on circle perimeter collinear with `startPoint` and center `C` (i.e. `C ± R * unit(startPoint - C)`).
  * **Tangent**:
    * Only active if `startPoint` is provided and is outside the circle/arc.
    * Compute tangent points $T_1$ and $T_2$ on a circle using right-angled triangle trigonometry: $\alpha = \arccos(R/d)$ where $d$ is distance from center to `startPoint`.
  * **Apparent Intersection**:
    * Find intersection of infinite lines passing through segment pairs. If it exists and cursor is near the intersection, snap to it.
  * **Extension**:
    * Project cursor onto infinite line containing a segment. If projection is outside the segment but close to the segment's endpoint (within 100px) and close to the cursor, snap to it.
* Update `drawSnapIndicator` to render the correct SVG/Canvas symbols (with label text) for the new modes:
  * `geometricCenter`: green square with small central cross.
  * `node`: yellow circle with an X.
  * `quadrant`: orange diamond.
  * `perpendicular`: blue right-angle mark.
  * `tangent`: green circle with tangent line.
  * `insertion`: cyan overlapping offset squares.
  * `apparentIntersection`: pink X with a small dashed square box.
  * `extension`: purple dashed line extending from endpoint to snap point.

---

### 3. Editor & UI Hookups

#### [MODIFY] [CanvasEditor.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/CanvasEditor.tsx)
* Retrieve `startPoint` from component state and pass it as the last argument to `findNearestSnap` inside `getCanvasPoint`.
* Add `startPoint` to the dependency array of the `getCanvasPoint` callback.

#### [MODIFY] [StatusBar.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/CanvasEditor/components/StatusBar.tsx)
* Append the new snap modes to the status bar button array. Since there are 12 snap modes in total, we will list them cleanly using short abbreviations (e.g., `GCen`, `Quad`, `Perp`, `Tang`, `AppInt`, `Node`, `Insert`, `Ext`) to keep it compact and highly functional.

#### [MODIFY] [CadSidebar.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/components/CadSidebar.tsx)
* Append checkbox options for the new snap modes in the sidebar Snap/Grid section.

---

## Verification Plan

### Automated Verification
* Update the unit test suite [snap.test.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/canvas/snap.test.ts) to verify the mathematical correctness of:
  - Quadrant calculations for circles and arcs.
  - Centroid calculations for Geometric Center.
  - Perpendicular projection calculations.
  - Tangent point calculations on circles.
  - Apparent Intersection.
* Run type check:
  ```bash
  npx tsc --noEmit
  ```
* Run test suite:
  ```bash
  npx tsx --test src/canvas/snap.test.ts
  ```

### Manual Verification
* Draw elements (circles, closed rectangles, segments) and test snapping behaviors:
  - Verify that the diamond indicator appears on circle quadrants.
  - Verify that the geometric center indicator appears at the center of closed rectangles/polylines.
  - Verify that tangent/perpendicular snaps activate only when drawing a line from a start point.
