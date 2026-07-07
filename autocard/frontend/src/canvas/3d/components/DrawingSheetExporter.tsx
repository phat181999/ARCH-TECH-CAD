// Renders one frame through a sheet-view ortho camera on a white background
// (hiding grid/sky/environment via userData.exportHide, and the roof for plan
// view via userData.exportRoof), downloads it as PNG, then restores the scene.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sheetFrustum, type SheetView } from "../geometry/sheetCamera";

const FILENAMES: Record<SheetView, string> = {
  plan: "mat-bang-2d.png", front: "mat-dung-truoc.png", side: "mat-dung-ben.png",
};

export function DrawingSheetExporter({ trigger, onDone, bounds, wallHeight }: {
  trigger: "" | "plan-png" | "front-png" | "side-png";
  onDone: () => void;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null;
  wallHeight: number;
}) {
  const { gl, scene } = useThree();

  useEffect(() => {
    if (!trigger) return;
    if (!bounds) { onDone(); return; }
    const view: SheetView = trigger === "plan-png" ? "plan" : trigger === "front-png" ? "front" : "side";
    const f = sheetFrustum(bounds, view, wallHeight);
    const cam = new THREE.OrthographicCamera(f.left, f.right, f.top, f.bottom, 0.1, 20000);
    cam.position.set(...f.position);
    cam.up.set(...f.up);
    cam.lookAt(...f.target);
    cam.updateProjectionMatrix();

    const prevBg = scene.background;
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) return;
      if (o.userData.exportHide || (view === "plan" && o.userData.exportRoof)) {
        o.visible = false;
        hidden.push(o);
      }
    });
    scene.background = new THREE.Color("#ffffff");

    gl.render(scene, cam);
    const url = gl.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = FILENAMES[view];
    a.click();

    scene.background = prevBg;
    for (const o of hidden) o.visible = true;
    onDone();
  }, [trigger, bounds, wallHeight, gl, scene, onDone]);

  return null;
}
