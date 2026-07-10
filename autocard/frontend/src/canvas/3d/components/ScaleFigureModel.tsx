// Real rigged/textured human figure ("Business Man" by Quaternius, CC0 —
// https://poly.pizza/m/JFrLIKqvCH) replacing the procedural capsule-and-box
// Mannequin for the two places a convincing human is worth the extra weight:
// the static scale-reference figure and the room-to-room walkthrough avatar.
// (Background sidewalk pedestrians in Landscape still use the cheap
// procedural Mannequin — dozens of skinned GLTF instances isn't worth it for
// distant ambient scenery.)
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

const MODEL_URL = "/models/business-man.glb";

// Fallback target height (meter-scale units) for contexts that don't pass
// an explicit targetHeight — matches the old AvatarWalkController usage,
// which already wraps its output in an explicit `scale={100}` to convert
// meter-scale to the scene's "100 units = 1m" world space.
//
// The static scale-reference figure in ThreeViewer.tsx's Scene does NOT go
// through that wrapper — it renders directly in whatever raw Y scale that
// context uses (walls there report "Wall {(wallHeight/10)*100} cm", i.e.
// 1 raw unit ≈ 10cm). Hardcoding 1.78 there rendered a ~17.8cm speck. Pass
// targetHeight explicitly (e.g. wallHeight * 0.5, an average person being
// roughly half an average wall) instead of relying on this fallback for
// that case.
const DEFAULT_TARGET_HEIGHT = 1.78;

const IDLE_CLIP = "CharacterArmature|Idle";
const WALK_CLIP = "CharacterArmature|Walk";

export function ScaleFigureModel({
  x = 0,
  z = 0,
  targetHeight = DEFAULT_TARGET_HEIGHT,
  walkingRef,
}: {
  x?: number;
  z?: number;
  /** Desired total figure height in the caller's own coordinate space —
      pass this explicitly whenever the figure isn't already wrapped in a
      known meter-to-scene-unit conversion (see note above). */
  targetHeight?: number;
  /** When provided, cross-fades Idle → Walk while true (room-to-room
      walkthrough tool); omitted for the static scale-reference figure. */
  walkingRef?: React.RefObject<boolean>;
}) {
  const { scene, animations } = useGLTF(MODEL_URL);

  // SkeletonUtils.clone (not scene.clone()) — a plain Object3D clone doesn't
  // rebind skinned-mesh bones, so multiple mounts (this component renders
  // both the static reference figure AND the walkthrough avatar at once)
  // would share and fight over one skeleton.
  const cloned = useMemo(() => cloneSkeleton(scene), [scene]);

  const group = useRef<THREE.Group>(null!);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    cloned.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }, [cloned]);

  const scale = useMemo(() => {
    // A freshly cloned object that hasn't been through a render pass yet has
    // stale/identity matrixWorld on every descendant — Box3.setFromObject
    // doesn't recursively refresh children's matrices on its own, so
    // measuring immediately after clone silently ignored the armature's own
    // scale and any bone offsets, producing a bogus (near-zero) height that
    // made every targetHeight change look like a no-op. Force a full
    // recursive matrix update first so the box reflects the real hierarchy.
    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const height = box.max.y - box.min.y;
    if (!(height > 0)) {
      console.warn("[ScaleFigureModel] could not measure model height, falling back to unscaled render", { box });
      return 1;
    }
    return targetHeight / height;
  }, [cloned, targetHeight]);

  // Idle by default; cross-fade to Walk while walkingRef is true.
  const currentClip = useRef<string | null>(null);
  useEffect(() => {
    const first = walkingRef?.current ? WALK_CLIP : IDLE_CLIP;
    actions[first]?.reset().play();
    currentClip.current = first;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFrame(() => {
    if (!walkingRef) return;
    const want = walkingRef.current ? WALK_CLIP : IDLE_CLIP;
    if (currentClip.current === want) return;
    const next = actions[want];
    const prev = currentClip.current ? actions[currentClip.current] : null;
    if (next) {
      next.reset().fadeIn(0.25).play();
      prev?.fadeOut(0.25);
      currentClip.current = want;
    }
  });

  return (
    <group position={[x, 0, z]} scale={scale}>
      <primitive ref={group} object={cloned} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
