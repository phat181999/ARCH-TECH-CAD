# 3D Editor UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-load welcome card for the empty 3D scene, and finish the wall-drawing UX with a live progress panel, a one-time hint toast, and a pulsing snap-point marker — all UI chrome, no change to how wall drawing actually works.

**Architecture:** Both features slot into `ThreeViewer.tsx`'s existing structure, following the pattern already established by `perfStats` (a callback from inside `<Canvas>` populates a local `useState`, read by HTML overlay components outside the canvas). New JSX components live in `ThreeViewerUI.tsx` alongside the existing `ViewerTopBar`/`RightSidebar` they extend.

**Tech Stack:** React 19 + TypeScript, @react-three/fiber, Tailwind CSS, localStorage (one dismiss flag).

**Spec:** `docs/superpowers/specs/2026-07-09-3d-editor-ux-redesign-design.md`

**Correction discovered while grounding this plan (not in the spec, found during file reads):** the spec assumed an "active-tool badge pill" needed to be built new. It doesn't — `ToolBadge` (`canvas/3d/components/ToolRail.tsx:337-346`) already exists, is already mounted in `ThreeViewer.tsx` (`<ToolBadge activeTool={activeTool} />`), and `TOOL_LABELS.wall3d` is already exactly `"Vẽ tường (W)"` — verbatim matching the demo. This plan does **not** touch it or duplicate it; the badge requirement is already satisfied by existing code.

## Global Constraints

- All frontend paths below are relative to `autocard/frontend/` unless prefixed otherwise.
- Type-check after every task: `cd autocard/frontend && npx tsc --noEmit` — must stay clean (the pre-existing error in `src/pages/StoreOrderPage.tsx:493` is ignorable).
- No new pure geometry/math logic is introduced by this plan — no new vitest test files. Verification throughout is a manual browser pass (dev server on port 51530), per the spec's explicit non-goal of forcing tests where none are needed.
- Do NOT change `WallDrawController.tsx`'s existing drawing/snapping/numeric-entry/axis-lock behavior — only additive callbacks and a cosmetic marker animation.
- Do NOT touch `ToolBadge`, `ToolRail`, or any other already-working tool-chrome component.
- Match existing Tailwind conventions in this codebase: dark glass chrome uses `bg-slate-950/90 backdrop-blur-md border-white/[0.06]`, blue accents `bg-blue-600`/`text-blue-400`/`border-blue-500/50`, text sizes `text-[9px]` to `text-[11px]` with `font-black`/`font-bold`, `select-none`.
- Match existing code style; commit after every task.

---

### Task 1: Thread `onImportDxf` into `ThreeViewer`

**Files:**
- Modify: `src/components/ThreeViewer.tsx:1191-1197` (props interface + destructure)
- Modify: `src/pages/CanvasEditor.tsx:2722-2730` (call site)

**Interfaces:**
- Consumes: `handleImportDxf` (existing, `src/pages/CanvasEditor.tsx:1911`, signature `() => void`, already passed to `EditorHeader`/`CadSidebar` as `onImportDxf`).
- Produces (used by Task 2): `ThreeViewer` gains an optional prop `onImportDxf?: () => void`, available inside the component as a plain variable for the welcome card's "Nhập bản vẽ DXF" action.

- [x] **Step 1: Add the prop to `ThreeViewer`'s interface**

In `src/components/ThreeViewer.tsx`, change the function signature at line 1191:
```tsx
export default function ThreeViewer({ elements, plan, visible, blockDefs, revisionKey, onImportDxf }: {
  elements: DrawingElement[];
  plan: ArchitecturalPlan | null;
  blockDefs: any;
  visible: boolean;
  revisionKey?: string;
  onImportDxf?: () => void;
}) {
```

- [x] **Step 2: Pass it from `CanvasEditor.tsx`**

In `src/pages/CanvasEditor.tsx`, add one line to the `<ThreeViewer>` call site (around line 2722-2730):
```tsx
                <ThreeViewer
                  elements={elements.filter(el => {
                    if (!el.layerId) return true;
                    const l = layers.find(l => l.id === el.layerId);
                    return l ? l.visible : true;
                  })}
                  plan={currentArchitecturalPlan}
                  blockDefs={blockDefs}
                  visible={show3D}
                  onImportDxf={handleImportDxf}
```
(leave the existing `revisionKey={revisionKey}` line below it untouched — only inserting the new prop line above it).

- [x] **Step 3: Type-check and commit**

Run: `cd autocard/frontend && npx tsc --noEmit` — expect clean (the new optional prop has no other consumers yet, so nothing else should change).

```bash
git add src/components/ThreeViewer.tsx src/pages/CanvasEditor.tsx
git commit -m "feat(3d-ux): thread onImportDxf into ThreeViewer for the welcome card"
```

---

### Task 2: `WelcomeCard` component + wire into `ThreeViewer`

**Files:**
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (add new exported component)
- Modify: `src/components/ThreeViewer.tsx` (render it)

**Interfaces:**
- Consumes: `onImportDxf` prop (Task 1); `elements`, `setActiveTool` (already in scope in `ThreeViewer.tsx`).
- Produces: `<WelcomeCard onDrawWall={() => void} onImportDxf={() => void} onSkip={() => void} />`, exported from `ThreeViewerUI.tsx`.

- [x] **Step 1: Add the component to `ThreeViewerUI.tsx`**

Add this new exported component (place it near `ViewerTopBar`, e.g. directly above it, since both are top-level chrome components in this file):

```tsx
/** First-load welcome card — shown whenever the 3D scene is empty (derived
 * from elements.length, not a "seen it once" flag: skipping just reveals the
 * blank canvas without drawing anything, so it reappears if the drawing is
 * still empty next time). */
export function WelcomeCard({ onDrawWall, onImportDxf, onSkip }: {
  onDrawWall: () => void;
  onImportDxf?: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none">
      <div className="w-[420px] max-w-[90%] bg-slate-950/90 backdrop-blur-md border border-white/[0.12] rounded-2xl p-6 shadow-2xl pointer-events-auto">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-blue-600/35 to-violet-500/25 border border-blue-400/40">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="text-base font-black text-slate-100">Bắt đầu mô hình 3D</div>
            <div className="text-[12px] text-slate-400 mt-1 leading-relaxed">
              Cảnh 3D đang trống. Chọn một cách bắt đầu bên dưới — bạn có thể đổi bất cứ lúc nào.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <button
            onClick={onDrawWall}
            className="text-left bg-white/[0.03] border border-white/[0.12] rounded-xl p-3.5 flex flex-col gap-2 hover:bg-blue-500/[0.08] hover:border-blue-400/40 hover:-translate-y-0.5 transition-all"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
              <path d="M4 21V5a1 1 0 011-1h14a1 1 0 011 1v16M4 9h16M4 15h16M9 9v6m6-6v6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-bold text-slate-100">Vẽ tường đầu tiên</span>
            <span className="text-[10px] text-slate-500 leading-snug">Bắt đầu từ khối trống, dựng tường trực tiếp trong 3D.</span>
          </button>
          <button
            onClick={onImportDxf}
            disabled={!onImportDxf}
            className="text-left bg-white/[0.03] border border-white/[0.12] rounded-xl p-3.5 flex flex-col gap-2 hover:bg-blue-500/[0.08] hover:border-blue-400/40 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-bold text-slate-100">Nhập bản vẽ DXF</span>
            <span className="text-[10px] text-slate-500 leading-snug">Tự động dựng tường, cửa, mái từ mặt bằng 2D.</span>
          </button>
        </div>

        <div className="h-px bg-white/[0.06] mb-3.5" />
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-3.5 flex-wrap">
            {[["W", "Tường"], ["F", "Sàn"], ["Space", "Kéo"], ["Scroll", "Zoom"]].map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <kbd className="bg-white/[0.06] border border-white/[0.12] border-b-2 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-300 font-mono">{key}</kbd>
                {label}
              </div>
            ))}
          </div>
          <button onClick={onSkip} className="text-[10.5px] text-slate-500 underline underline-offset-2 hover:text-slate-300">
            Bỏ qua, vào canvas trống →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 2: Import and render it in `ThreeViewer.tsx`**

Add `WelcomeCard` to the existing `ThreeViewerUI` import line near the top of `src/components/ThreeViewer.tsx` (find the line importing `ViewerTopBar`/`RightSidebar` from `"../canvas/3d/components/ThreeViewerUI"` and add `WelcomeCard` to that same import).

In the return JSX, inside the canvas-area `<div className="absolute inset-0 top-9 right-56" ...>` (`src/components/ThreeViewer.tsx:1629`), add the welcome card right after the `<ToolBadge activeTool={activeTool} />` line (`:1658`) and before the `{activeTool === "floor-pick" && (...)}` block:

```tsx
        <ToolBadge activeTool={activeTool} />

        {elements.length === 0 && (
          <WelcomeCard
            onDrawWall={() => setActiveTool("wall3d")}
            onImportDxf={onImportDxf}
            onSkip={() => setActiveTool("select")}
          />
        )}
```

(`onSkip` sets the tool to `"select"`, not `"wall3d"` — skipping must leave the user on a blank canvas with no tool forced, per the spec.)

- [x] **Step 3: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.

- [x] **Step 4: Manual smoke test**

Start the dev server if not already running (`npm run dev` from `autocard/frontend`, or check `lsof -i :51530` first), open an empty drawing's 3D tab, confirm: the card appears centered over the viewport (not overlapping the top bar, left rail, or right sidebar); "Vẽ tường đầu tiên" activates the wall tool and dismisses the card (since `elements.length` doesn't change yet, actually — dismissal only happens once a wall is actually drawn, since the card is gated purely on `elements.length === 0`; confirm this is the case — the card should stay visible with the wall tool now active, until the first wall is committed); "Nhập bản vẽ DXF" opens the existing DXF import dialog; "Skip" dismisses to a blank canvas with the select tool active; reload the page on the still-empty drawing and confirm the card reappears.

- [x] **Step 5: Commit**

```bash
git add src/canvas/3d/components/ThreeViewerUI.tsx src/components/ThreeViewer.tsx
git commit -m "feat(3d-ux): first-load welcome card for the empty 3D scene"
```

---

### Task 3: Static "Perspective" chip in `ViewerTopBar`

**Files:**
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx:457-495` (`ViewerTopBar`)

**Interfaces:**
- Consumes: nothing new — purely static text, no new props.
- Produces: nothing consumed by later tasks.

- [x] **Step 1: Add the chip**

In `ViewerTopBar`'s JSX (`src/canvas/3d/components/ThreeViewerUI.tsx`), add a static chip right after the existing `<span className="w-px h-4 bg-white/[0.08]" />` separator (line 460) and before the `{hasBim && (...)}` block:

```tsx
      <span className="w-px h-4 bg-white/[0.08]" />
      <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-blue-500/[0.12] border-blue-500/30 text-blue-300">Perspective</span>
      {hasBim && (
```

- [x] **Step 2: Type-check and manual check**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean. Visually confirm the chip renders between the "Mô hình 3D" label and the BIM/wall-height chips, styled consistently with the other chips in the bar.

- [x] **Step 3: Commit**

```bash
git add src/canvas/3d/components/ThreeViewerUI.tsx
git commit -m "feat(3d-ux): static Perspective chip in the 3D top bar"
```

---

### Task 4: `onProgress` callback in `WallDrawController` + `wallProgress` state in `ThreeViewer`

**Files:**
- Modify: `src/canvas/3d/controllers/WallDrawController.tsx`
- Modify: `src/components/ThreeViewer.tsx`

**Interfaces:**
- Produces (used by Task 5): `WallDrawController` gains an optional prop `onProgress?: (p: { segmentCount: number; currentLength: number; totalLength: number } | null) => void`, called on every chain-state change with `null` whenever no chain is in progress (tool inactive, or active but no start point placed yet). `ThreeViewer.tsx` gains local state `wallProgress: { segmentCount: number; currentLength: number; totalLength: number } | null`, following the exact same pattern as the existing `perfStats`/`setPerfStats`.

- [x] **Step 1: Add the prop and running-total state to `WallDrawController`**

In `src/canvas/3d/controllers/WallDrawController.tsx`, change the function signature (currently lines 18-26):

```tsx
export function WallDrawController({
  activeTool,
  center,
  wallPreset = WALL_ASSEMBLY_PRESETS[1],
  onProgress,
}: {
  activeTool: string;
  center: { cx: number; cz: number };
  wallPreset?: WallAssemblyPreset;
  onProgress?: (p: { segmentCount: number; currentLength: number; totalLength: number } | null) => void;
}) {
```

Add two new state variables alongside the existing `snapType` state (near line 31):
```tsx
  const [snapType, setSnapType] = useState<SnapType>("none");
  const [segmentCount, setSegmentCount] = useState(0);
  const [totalLength, setTotalLength] = useState(0);
```

- [x] **Step 2: Reset the running totals wherever a chain ends**

In the main effect (currently starting at line 44), the `!active` early return already resets `startWorld`/`hoverWorld`/`snapType` — add the two new resets there too:

```tsx
    if (!active) {
      setStartWorld(null);
      setHoverWorld(null);
      setSnapType("none");
      setSegmentCount(0);
      setTotalLength(0);
      return;
    }
```

In the same effect's `handleKeyDown` (Escape case, currently line 86-88):
```tsx
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setStartWorld(null); setHoverWorld(null); setSegmentCount(0); setTotalLength(0); }
    };
```

And `handleDblClick` (currently line 89):
```tsx
    const handleDblClick = () => { setStartWorld(null); setSegmentCount(0); setTotalLength(0); };
```

- [x] **Step 3: Increment the running totals on each commit**

In `handlePointerDown`'s commit branch (currently lines 70-77):
```tsx
      if (isValidWall(a, b)) {
        const { activeLayerId, currentStyle, addElement } = useDrawingStore.getState();
        addElement(makeWallElement(a, b, {
          layerId: activeLayerId,
          strokeColor: currentStyle?.strokeColor,
          wallLayers: wallPreset.layers,
        }));
        const segLen = Math.hypot(b.x - a.x, b.y - a.y) / 100;
        setSegmentCount((c) => c + 1);
        setTotalLength((t) => t + segLen);
      }
```

In the numeric-entry commit effect (currently lines 110-126), inside its `if (isValidWall(a, b))` block:
```tsx
    if (isValidWall(a, b)) {
      const { activeLayerId, currentStyle, addElement } = useDrawingStore.getState();
      addElement(makeWallElement(a, b, { layerId: activeLayerId, strokeColor: currentStyle?.strokeColor, wallLayers: wallPreset.layers }));
      setSegmentCount((c) => c + 1);
      setTotalLength((t) => t + meters);
    }
```

- [x] **Step 4: Report progress via a new effect**

Add this new `useEffect` after the existing numeric-entry effect (after line 126, before the `if (!active) return null;` render guard at line 128):

```tsx
  useEffect(() => {
    if (!onProgress) return;
    if (!active || !startWorld) { onProgress(null); return; }
    const currentLength = hoverWorld ? startWorld.distanceTo(hoverWorld) / 100 : 0;
    onProgress({ segmentCount, currentLength, totalLength });
  }, [onProgress, active, startWorld, hoverWorld, segmentCount, totalLength]);
```

- [x] **Step 5: Wire `wallProgress` state into `ThreeViewer.tsx` and pass the callback down through `Scene`**

`WallDrawController` is mounted inside a separate `Scene` function component (`src/components/ThreeViewer.tsx:757`), not the top-level `ThreeViewer` function — the callback must be threaded through `Scene`'s own props.

In `src/components/ThreeViewer.tsx`, add new local state to the top-level `ThreeViewer` function, alongside the existing `perfStats` state (near line 1240):
```tsx
  const [perfStats, setPerfStats] = useState<PerfStats | null>(null);
  const [wallProgress, setWallProgress] = useState<{ segmentCount: number; currentLength: number; totalLength: number } | null>(null);
```

Add `onWallProgress` to `Scene`'s destructured props (`src/components/ThreeViewer.tsx:764`, in the same group as `wallPreset`/`fixtureType`):
```tsx
  quality, onExitWalk, onRoomChange, wallPreset, fixtureType, onWallProgress,
```
and to `Scene`'s type block (`:800`, right after `fixtureType: MepFixtureType;`):
```tsx
  fixtureType: MepFixtureType;
  onWallProgress?: (p: { segmentCount: number; currentLength: number; totalLength: number } | null) => void;
```

Pass it at the `<Scene>` call site (`src/components/ThreeViewer.tsx:1736`, alongside `quality={quality}` at line 1764):
```tsx
            quality={quality}
            onWallProgress={setWallProgress}
```

Finally, forward it into the existing `<WallDrawController>` mount inside `Scene`'s own body (currently `src/components/ThreeViewer.tsx:1081`):
```tsx
      <WallDrawController activeTool={activeTool} center={center} wallPreset={wallPreset} onProgress={onWallProgress} />
```

- [x] **Step 6: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.

- [x] **Step 7: Manual smoke test**

Add a temporary `console.log(wallProgress)` right after the `useState` line, start the wall tool, click twice to place a segment, and confirm the console shows `{segmentCount: 1, currentLength: ..., totalLength: ...}` values that make sense (matching what you drew). Remove the temporary log before committing.

- [x] **Step 8: Commit**

```bash
git add src/canvas/3d/controllers/WallDrawController.tsx src/components/ThreeViewer.tsx
git commit -m "feat(3d-ux): track and report wall-drawing chain progress"
```

---

### Task 5: Wall-draw progress panel in `RightSidebar`

**Files:**
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (`RightSidebar`)
- Modify: `src/components/ThreeViewer.tsx` (pass the new prop)

**Interfaces:**
- Consumes: `wallProgress` state (Task 4), `formatLength` (already imported in `ThreeViewer.tsx` via `useDrawingStore`).
- Produces: nothing consumed by later tasks.

- [x] **Step 1: Add the prop to `RightSidebar`**

In `src/canvas/3d/components/ThreeViewerUI.tsx`, add to `RightSidebar`'s destructured props and type (near the existing `quality`/`setQuality` props, around lines 508 and 528):

```tsx
  quality, setQuality,
  wallProgress,
  formatLength,
```
and in the type block:
```tsx
  quality: "low" | "medium" | "high"; setQuality: (v: "low" | "medium" | "high") => void;
  wallProgress: { segmentCount: number; currentLength: number; totalLength: number } | null;
  formatLength: (units: number) => string;
```

- [x] **Step 2: Render the panel in the "render" tab**

Inside the `{tab === "render" && (...)}` block, add this right after the existing Quality block (after the closing `</div>` that follows the `{quality === "low" && (...)}` line, currently around line 640, before the `<div className="space-y-2 pt-1 border-t border-white/[0.06]">` block):

```tsx
            {wallProgress && (
              <div className="pt-1 border-t border-white/[0.06]">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Đang vẽ tường</p>
                <div className="bg-white/[0.03] border border-white/[0.12] rounded-lg p-2.5 space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Đoạn đã đặt</span><b className="text-emerald-400 font-bold">{wallProgress.segmentCount}</b>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Đoạn hiện tại</span><b className="text-emerald-400 font-bold">{formatLength(wallProgress.currentLength)}</b>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Tổng chiều dài</span><b className="text-emerald-400 font-bold">{formatLength(wallProgress.totalLength)}</b>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-snug pt-1">
                    Gõ số rồi <kbd className="bg-white/[0.08] border border-white/[0.15] rounded px-1 font-mono">Enter</kbd> để chốt chiều dài chính xác. Bắt dính vào điểm cuối tường trước đó tại góc.
                  </p>
                </div>
              </div>
            )}
```

- [x] **Step 3: Pass the new props from `ThreeViewer.tsx`**

At the `<RightSidebar>` call site (currently `src/components/ThreeViewer.tsx:1813` onward), add two lines near the existing `quality={quality}` / `setQuality={setQuality}` props:

```tsx
        quality={quality}
        setQuality={setQuality}
        wallProgress={wallProgress}
        formatLength={formatLength}
```

- [x] **Step 4: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.

- [x] **Step 5: Manual smoke test**

Activate the wall tool, click one point, move the mouse — confirm the sidebar's Render tab shows the "Đang vẽ tường" panel with a live-updating "Đoạn hiện tại" value as you move the mouse, and "Đoạn đã đặt"/"Tổng chiều dài" updating after each committed segment. Press Escape and confirm the panel disappears.

- [x] **Step 6: Commit**

```bash
git add src/canvas/3d/components/ThreeViewerUI.tsx src/components/ThreeViewer.tsx
git commit -m "feat(3d-ux): live wall-drawing progress panel in the sidebar"
```

---

### Task 6: `WallDrawHintToast` — one-time contextual hint

**Files:**
- Modify: `src/canvas/3d/components/ThreeViewerUI.tsx` (add new exported component)
- Modify: `src/components/ThreeViewer.tsx` (wire it in)

**Interfaces:**
- Consumes: `activeTool` (already in scope in `ThreeViewer.tsx`).
- Produces: `<WallDrawHintToast />`, exported from `ThreeViewerUI.tsx`. Self-contained — manages its own visibility/dismissal via `localStorage`, needs only to be conditionally mounted by its parent.

- [x] **Step 1: Add the component to `ThreeViewerUI.tsx`**

Add near `WelcomeCard`:

```tsx
const WALL_HINT_DISMISSED_KEY = "autocard.walldraw-hint-dismissed";

/** One-time contextual hint shown the first time the wall tool activates on
 * this browser. Dismissal is permanent (localStorage), not per-drawing —
 * matches a standard "got it" onboarding pattern, distinct from
 * WelcomeCard's derived (elements.length === 0) visibility. */
export function WallDrawHintToast() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(WALL_HINT_DISMISSED_KEY) === "1");
  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(WALL_HINT_DISMISSED_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="absolute left-1/2 bottom-6 -translate-x-1/2 z-25 flex items-center gap-3.5 bg-slate-950/92 backdrop-blur-md border border-white/[0.12] rounded-2xl px-4 py-2.5 shadow-2xl">
      <div className="flex items-center gap-2.5 text-[11px] text-slate-400 flex-wrap">
        <span className="flex items-center gap-1.5"><kbd className="bg-white/[0.06] border border-white/[0.12] border-b-2 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-300 font-mono">Click</kbd> đặt điểm</span>
        <span className="text-slate-600">→</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-white/[0.06] border border-white/[0.12] border-b-2 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-300 font-mono">Gõ số</kbd> + <kbd className="bg-white/[0.06] border border-white/[0.12] border-b-2 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-300 font-mono">Enter</kbd> chiều dài chính xác</span>
        <span className="text-slate-600">→</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-white/[0.06] border border-white/[0.12] border-b-2 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-300 font-mono">Shift</kbd> khoá trục</span>
        <span className="text-slate-600">→</span>
        <span className="flex items-center gap-1.5"><kbd className="bg-white/[0.06] border border-white/[0.12] border-b-2 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-300 font-mono">Esc</kbd> / <kbd className="bg-white/[0.06] border border-white/[0.12] border-b-2 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-300 font-mono">Double-click</kbd> kết thúc</span>
      </div>
      <button onClick={dismiss} className="ml-1.5 bg-blue-600/20 border border-blue-500/50 text-blue-300 text-[10.5px] font-bold px-3 py-1.5 rounded-lg hover:bg-blue-600/30 flex-shrink-0">
        Đã hiểu
      </button>
    </div>
  );
}
```

Add `useState` to this file's React import if not already present (it already is, per the existing `RightSidebar`'s `useState` usage).

- [x] **Step 2: Wire it into `ThreeViewer.tsx`**

Import `WallDrawHintToast` alongside `WelcomeCard` in the same import line. Render it conditionally right after the `WelcomeCard` block added in Task 2:

```tsx
        {activeTool === "wall3d" && <WallDrawHintToast />}
```

(`WallDrawHintToast` internally no-ops via `localStorage` once dismissed, so this simple `activeTool === "wall3d"` gate is sufficient — no need to track "first time" state in `ThreeViewer.tsx` itself.)

- [x] **Step 3: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.

- [x] **Step 4: Manual smoke test**

Clear `localStorage` (or use a fresh browser profile), activate the wall tool, confirm the toast appears at the bottom of the viewport. Click "Đã hiểu", confirm it disappears. Deactivate and reactivate the wall tool, confirm it does NOT reappear. Reload the page, reactivate the wall tool, confirm it still does not reappear (localStorage persisted).

- [x] **Step 5: Commit**

```bash
git add src/canvas/3d/components/ThreeViewerUI.tsx src/components/ThreeViewer.tsx
git commit -m "feat(3d-ux): one-time wall-drawing hint toast"
```

---

### Task 7: Pulsing snap-point marker

**Files:**
- Modify: `src/canvas/3d/controllers/WallDrawController.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks (this is the last task).

- [x] **Step 1: Add the pulse animation**

In `src/canvas/3d/controllers/WallDrawController.tsx`, add `useFrame` to the existing `@react-three/fiber` import (currently `import { useThree } from "@react-three/fiber";` — change to `import { useThree, useFrame } from "@react-three/fiber";`).

Add a ref and a `useFrame` hook (place these near the top of the component body, after the existing `useState`/`useRef` declarations, before the `active` constant):

```tsx
  const snapMarkerRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (snapMarkerRef.current) {
      snapMarkerRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 6) * 0.15);
    }
  });
```

Attach the ref to the existing snap-marker mesh (currently lines 143-151):
```tsx
      {hoverWorld && snapType !== "none" && (
        <mesh ref={snapMarkerRef} position={hoverWorld}>
          <sphereGeometry args={[3, 12, 12]} />
          <meshBasicMaterial
            color={snapType === "endpoint" ? "#22c55e" : snapType === "midpoint" ? "#38bdf8" : snapType === "axis" ? "#f59e0b" : "#94a3b8"}
            depthTest={false}
          />
        </mesh>
      )}
```

- [x] **Step 2: Type-check**

Run: `cd autocard/frontend && npx tsc --noEmit` — clean.

- [x] **Step 3: Manual smoke test**

Activate the wall tool, hover near an existing wall's endpoint until the snap marker appears — confirm it visibly pulses (grows/shrinks smoothly) rather than staying static. Confirm this doesn't affect snapping accuracy (the scale change is purely visual, position is unaffected).

- [x] **Step 4: Commit**

```bash
git add src/canvas/3d/controllers/WallDrawController.tsx
git commit -m "feat(3d-ux): pulsing animation on the wall-draw snap marker"
```

---

## Final verification (after all tasks)

- [x] `cd autocard/frontend && npx tsc --noEmit` — clean.
- [x] `cd autocard/frontend && npx vitest run` — all existing tests still pass (no new test files expected from this plan).
- [x] `cd autocard/frontend && npm run build` — succeeds.
- [x] Full manual pass in the dev app: empty drawing shows the welcome card with working actions and correct reappear-on-reload behavior; drawing walls shows the (pre-existing) active-tool badge, the new live progress panel, the new one-time hint toast (correctly not reappearing after dismissal), and the new pulsing snap marker; the static Perspective chip renders in the top bar; none of `WallDrawController`'s existing drawing/snapping/numeric-entry/axis-lock behavior has changed.
