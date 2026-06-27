import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function WalkthroughController({ activeTool, onExit }: { activeTool: string; onExit: () => void }) {
  const { camera, gl } = useThree();
  const active = activeTool === "walk";
  const keys = useRef<Record<string, boolean>>({});
  const look = useRef({ yaw: 0, pitch: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const initialized = useRef(false);

  useEffect(() => {
    if (!active) { initialized.current = false; return; }
    if (initialized.current) return;
    initialized.current = true;
    camera.position.y = 160;
    look.current = { yaw: 0, pitch: 0 };
  }, [active, camera]);

  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === "Escape") onExit();
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [active, onExit]);

  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;
    const md = (e: MouseEvent) => { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; };
    const mu = () => { isDragging.current = false; };
    const mm = (e: MouseEvent) => {
      if (!isDragging.current) return;
      look.current.yaw   -= (e.clientX - lastMouse.current.x) * 0.004;
      look.current.pitch = Math.max(-1, Math.min(1, look.current.pitch - (e.clientY - lastMouse.current.y) * 0.004));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    el.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    el.addEventListener("mousemove", mm);
    return () => { el.removeEventListener("mousedown", md); window.removeEventListener("mouseup", mu); el.removeEventListener("mousemove", mm); };
  }, [active, gl]);

  useFrame((_, dt) => {
    if (!active) return;
    const speed = 220 * dt;
    const fwd = new THREE.Vector3(-Math.sin(look.current.yaw), 0, -Math.cos(look.current.yaw));
    const rgt = new THREE.Vector3(Math.cos(look.current.yaw), 0, -Math.sin(look.current.yaw));
    const k = keys.current;
    if (k["w"] || k["arrowup"])    camera.position.addScaledVector(fwd,  speed);
    if (k["s"] || k["arrowdown"])  camera.position.addScaledVector(fwd, -speed);
    if (k["a"] || k["arrowleft"])  camera.position.addScaledVector(rgt, -speed);
    if (k["d"] || k["arrowright"]) camera.position.addScaledVector(rgt,  speed);
    camera.position.y = 160;
    camera.quaternion.setFromEuler(new THREE.Euler(look.current.pitch, look.current.yaw, 0, "YXZ"));
  });

  return null;
}
