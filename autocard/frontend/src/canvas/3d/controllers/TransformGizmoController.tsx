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

export function TransformGizmoController({ activeTool, center }: { activeTool: string; center: Center }) {
  const selectedIds = useDrawingStore((s) => s.selectedElementIds);
  const elements = useDrawingStore((s) => s.elements);
  const [mode, setMode] = useState<GizmoMode>("translate");
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
      <Html position={[anchorWorld.x, 40, anchorWorld.z]} center zIndexRange={[30, 40]}>
        <div className="bg-slate-900/90 border border-slate-700 rounded-full px-2 py-0.5 text-[9px] font-bold text-slate-300 whitespace-nowrap select-none">
          {selected.length} selected · <span className="text-blue-400">{mode}</span> · G/R/S · Ctrl+drag = copy
        </div>
      </Html>
    </>
  );
}
