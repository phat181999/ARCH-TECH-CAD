// Move/Rotate/Scale/Copy gizmo for selected elements. A proxy group sits at
// the selection's anchor; drei TransformControls manipulates the proxy, and on
// drag end the world-space delta is converted to drawing-space patches and
// committed as ONE history entry. Ctrl/Cmd at drag start duplicates first.
import { useEffect, useMemo, useRef, useState } from "react";
import { TransformControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { useDrawingStore } from "../../../stores/drawingStore";
import type { DrawingElement } from "../../../types";
import { elementAnchor, translatePatch, rotatePatch, scalePatch, duplicateElement } from "../geometry/transformGeometry";
import { drawingToWorld, type Center } from "../geometry/coordBridge";

type GizmoMode = "translate" | "rotate" | "scale";

const MODE_LABEL: Record<GizmoMode, string> = { translate: "Di chuyển", rotate: "Xoay", scale: "Tỉ lệ" };

export function TransformGizmoController({ activeTool, center }: { activeTool: string; center: Center }) {
  const selectedIds = useDrawingStore((s) => s.selectedElementIds);
  const elements = useDrawingStore((s) => s.elements);
  const [mode, setMode] = useState<GizmoMode>("translate");
  // The keyboard-shortcut cheatsheet used to be baked into the per-selection
  // pill itself ("1 selected · translate · G/R/S · Ctrl+drag = copy"),
  // repeating on every single click and, at typical camera distance, landing
  // right on top of DimensionHandles' own "L 123cm"/"T 20cm" pills — two
  // unrelated floating labels stacking illegibly. Splitting them apart: the
  // per-selection pill now only says what's selected/what mode it's in, and
  // the shortcuts move to a one-time dismissible toast (shown once per
  // session, not per click) — same shape as the object-scale-edit-demo's
  // hint-toast this was modeled after.
  const [hintDismissed, setHintDismissed] = useState(false);
  // The proxy group must be tracked via ref-callback + state (not a plain ref)
  // so TransformControls only ever attaches once the object actually exists —
  // drei's TransformControls can begin its render pass before a plain ref's
  // `.current` is populated, throwing on `null.updateMatrixWorld`.
  const [proxyObj, setProxyObj] = useState<THREE.Group | null>(null);
  const draggingRef = useRef(false);
  const copiedRef = useRef(false);
  const ctrlRef = useRef(false);

  const selected = useMemo(
    () => elements.filter((el) => selectedIds.includes(el.id)),
    [elements, selectedIds],
  );

  // Anchor = average of selected anchors, in world space.
  const anchorWorld = useMemo(() => {
    const anchors = selected.map(elementAnchor).filter((a): a is { x: number; y: number } => a != null);
    if (anchors.length === 0) return null;
    const ax = anchors.reduce((s, a) => s + a.x, 0) / anchors.length;
    const ay = anchors.reduce((s, a) => s + a.y, 0) / anchors.length;
    const w = drawingToWorld({ x: ax, y: ay }, center);
    return new THREE.Vector3(w.x, 0, w.z);
  }, [selected, center]);

  const active = activeTool === "select" && selected.length > 0 && anchorWorld != null;

  // Mode hotkeys + Ctrl tracking.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      ctrlRef.current = e.ctrlKey || e.metaKey;
      if (e.type !== "keydown") return;
      if (e.key === "g") setMode("translate");
      if (e.key === "r" && selected.length === 1) setMode("rotate");
      if (e.key === "s" && selected.length === 1) setMode("scale");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); };
  }, [active, selected.length]);

  // Multi-select supports translate only.
  useEffect(() => { if (selected.length > 1) setMode("translate"); }, [selected.length]);

  // Keep the proxy parked at the anchor whenever not mid-drag.
  useEffect(() => {
    if (!active || draggingRef.current || !proxyObj) return;
    proxyObj.position.copy(anchorWorld!);
    proxyObj.rotation.set(0, 0, 0);
    proxyObj.scale.set(1, 1, 1);
  }, [active, anchorWorld, proxyObj]);

  if (!active) return null;

  // Commit patches for all ids as a single history entry.
  const commitPatches = (patches: Map<string, Partial<DrawingElement>>) => {
    useDrawingStore.setState((state) => {
      const newElements = state.elements.map((el) => {
        const patch = patches.get(el.id);
        return patch ? { ...el, ...patch, editedIn3D: true } : el;
      });
      return {
        elements: newElements,
        history: [...state.history.slice(0, state.historyIndex + 1), newElements],
        historyIndex: state.historyIndex + 1,
      };
    });
  };

  const handleMouseDown = () => {
    draggingRef.current = true;
    copiedRef.current = false;
    if (ctrlRef.current && mode === "translate") {
      // Copy: duplicate selection in place; the drag then moves the copies.
      const copies = selected.map(duplicateElement);
      const { addElements, setSelectedElementIds } = useDrawingStore.getState();
      addElements(copies);
      setSelectedElementIds(copies.map((c) => c.id));
      copiedRef.current = true;
    }
  };

  const handleMouseUp = () => {
    draggingRef.current = false;
    const proxy = proxyObj;
    if (!proxy) return;
    const ids = useDrawingStore.getState().selectedElementIds;
    const els = useDrawingStore.getState().elements.filter((el) => ids.includes(el.id));
    const patches = new Map<string, Partial<DrawingElement>>();

    if (mode === "translate") {
      const dx = proxy.position.x - anchorWorld!.x;
      const dz = proxy.position.z - anchorWorld!.z;
      if (Math.hypot(dx, dz) > 0.01) {
        for (const el of els) patches.set(el.id, translatePatch(el, dx, dz));
      }
    } else if (mode === "rotate") {
      // Canvas 2D y-down: +θ on screen = −θ around three.js Y.
      const deltaDeg = -THREE.MathUtils.radToDeg(proxy.rotation.y);
      if (Math.abs(deltaDeg) > 0.1) {
        for (const el of els) patches.set(el.id, rotatePatch(el, deltaDeg));
      }
    } else {
      const factor = proxy.scale.x;
      if (Math.abs(factor - 1) > 0.01 && factor > 0) {
        for (const el of els) patches.set(el.id, scalePatch(el, factor));
      }
    }

    if (patches.size > 0) commitPatches(patches);
    // Reset the proxy — element re-render reflects the committed state.
    proxy.position.copy(anchorWorld!);
    proxy.rotation.set(0, 0, 0);
    proxy.scale.set(1, 1, 1);
  };

  return (
    <>
      <group ref={setProxyObj} />
      {proxyObj && (
        <TransformControls
          object={proxyObj}
          mode={mode}
          showY={mode !== "translate"}
          showX={mode !== "rotate"}
          showZ={mode !== "rotate"}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        />
      )}
      {/* Raised well above the object (was y=40, right where DimensionHandles'
          own dimension pills sit) and trimmed down to just count + mode —
          the shortcuts live in the one-time toast below instead. */}
      <Html position={[anchorWorld.x, 90, anchorWorld.z]} center zIndexRange={[25, 35]} style={{ pointerEvents: "none" }}>
        <div className="bg-slate-950/85 border border-white/10 rounded-full px-2.5 py-1 text-[9px] font-bold text-slate-300 whitespace-nowrap select-none shadow-lg">
          {selected.length} đã chọn · <span className="text-blue-400">{MODE_LABEL[mode]}</span>
        </div>
      </Html>
      {!hintDismissed && (
        <Html fullscreen style={{ pointerEvents: "none" }} zIndexRange={[25, 35]}>
          <div
            style={{ position: "absolute", left: "50%", bottom: 24, transform: "translateX(-50%)", pointerEvents: "auto" }}
            className="flex items-center gap-2.5 bg-slate-950/92 border border-white/10 rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-md select-none whitespace-nowrap"
          >
            <span className="flex items-center gap-1.5 text-[10.5px] text-slate-300">
              <kbd className="bg-white/10 border border-white/15 border-b-2 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-100">G</kbd> Di chuyển
            </span>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1.5 text-[10.5px] text-slate-300">
              <kbd className="bg-white/10 border border-white/15 border-b-2 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-100">R</kbd> Xoay
            </span>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1.5 text-[10.5px] text-slate-300">
              <kbd className="bg-white/10 border border-white/15 border-b-2 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-100">S</kbd> Tỉ lệ
            </span>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1.5 text-[10.5px] text-slate-300">
              <kbd className="bg-white/10 border border-white/15 border-b-2 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-100">Ctrl</kbd>+kéo = nhân bản
            </span>
            <button
              onClick={() => setHintDismissed(true)}
              className="ml-1.5 bg-blue-600/25 border border-blue-500/50 text-blue-300 text-[10px] font-bold px-2.5 py-1 rounded-lg hover:bg-blue-600/40 transition-colors"
            >
              Đã hiểu
            </button>
          </div>
        </Html>
      )}
    </>
  );
}
