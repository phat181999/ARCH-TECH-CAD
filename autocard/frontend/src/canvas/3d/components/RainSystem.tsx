import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Weather } from "../../../stores/slices/sceneSlice";

const RAIN_COUNT   = 3000;
const SNOW_COUNT   = 1500;
const FIELD_SIZE   = 2000; // world units
const FIELD_HEIGHT = 1500;

const RAIN_SPEED_NORMAL = 600;
const RAIN_SPEED_STORM  = 900;
const SNOW_SPEED        = 60;
const LIGHTNING_INTERVAL_MIN  = 5;
const LIGHTNING_INTERVAL_RANGE = 10;
const LIGHTNING_DURATION_MIN  = 0.12;
const LIGHTNING_DURATION_RANGE = 0.08;
const LIGHTNING_INTENSITY = 80;

function randomInField(arr: Float32Array, count: number) {
  for (let i = 0; i < count; i++) {
    arr[i * 3]     = (Math.random() - 0.5) * FIELD_SIZE;
    arr[i * 3 + 1] = Math.random() * FIELD_HEIGHT;
    arr[i * 3 + 2] = (Math.random() - 0.5) * FIELD_SIZE;
  }
}

interface RainSystemProps {
  weather: Weather;
}

export function RainSystem({ weather }: RainSystemProps) {
  const { scene } = useThree();
  const rainRef  = useRef<THREE.Points>(null);
  const snowRef  = useRef<THREE.Points>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const lightTimer    = useRef(0);
  const lightDuration = useRef(0);

  const isRain  = weather === "rainy"  || weather === "stormy";
  const isSnow  = weather === "snowy";
  const isStorm = weather === "stormy";

  // Rain particle positions
  const rainPositions = useMemo(() => {
    const pos = new Float32Array(RAIN_COUNT * 3);
    randomInField(pos, RAIN_COUNT);
    return pos;
  }, []);

  // Snow particle positions
  const snowPositions = useMemo(() => {
    const pos = new Float32Array(SNOW_COUNT * 3);
    randomInField(pos, SNOW_COUNT);
    return pos;
  }, []);

  // Fog driven by weather
  useEffect(() => {
    const prevFog = scene.fog;
    switch (weather) {
      case "overcast": scene.fog = new THREE.Fog("#c8d8e8", 2000, 8000); break;
      case "rainy":    scene.fog = new THREE.Fog("#9aacb8", 1000, 5000); break;
      case "stormy":   scene.fog = new THREE.FogExp2("#606870", 0.0006); break;
      case "foggy":    scene.fog = new THREE.FogExp2("#b0bcbc", 0.0012); break;
      case "snowy":    scene.fog = new THREE.Fog("#dce8f0", 800, 4000);  break;
      default:         scene.fog = null;
    }
    return () => { scene.fog = prevFog; };
  }, [weather, scene]);

  useFrame((_, dt) => {
    // Rain animation
    if (rainRef.current && isRain) {
      const pos = rainRef.current.geometry.attributes.position;
      const arr = pos.array as Float32Array;
      const speed = isStorm ? RAIN_SPEED_STORM : RAIN_SPEED_NORMAL;
      for (let i = 0; i < RAIN_COUNT; i++) {
        arr[i * 3 + 1] -= speed * dt;
        if (arr[i * 3 + 1] < -10) {
          arr[i * 3]     = (Math.random() - 0.5) * FIELD_SIZE;
          arr[i * 3 + 1] = FIELD_HEIGHT;
          arr[i * 3 + 2] = (Math.random() - 0.5) * FIELD_SIZE;
        }
      }
      pos.needsUpdate = true;
    }

    // Snow animation — slower, drifting
    if (snowRef.current && isSnow) {
      const pos = snowRef.current.geometry.attributes.position;
      const arr = pos.array as Float32Array;
      const t = performance.now() * 0.0005;
      for (let i = 0; i < SNOW_COUNT; i++) {
        arr[i * 3]     += Math.sin(t + i) * 0.3;
        arr[i * 3 + 1] -= SNOW_SPEED * dt;
        if (arr[i * 3 + 1] < -10) {
          arr[i * 3]     = (Math.random() - 0.5) * FIELD_SIZE;
          arr[i * 3 + 1] = FIELD_HEIGHT;
          arr[i * 3 + 2] = (Math.random() - 0.5) * FIELD_SIZE;
        }
      }
      pos.needsUpdate = true;
    }

    // Lightning flash — stormy only
    if (isStorm && lightRef.current) {
      lightTimer.current -= dt;
      if (lightTimer.current <= 0) {
        // schedule next flash (5–15 s random interval)
        lightTimer.current    = LIGHTNING_INTERVAL_MIN + Math.random() * LIGHTNING_INTERVAL_RANGE;
        lightDuration.current = LIGHTNING_DURATION_MIN + Math.random() * LIGHTNING_DURATION_RANGE;
      }
      if (lightDuration.current > 0) {
        lightRef.current.intensity = LIGHTNING_INTENSITY;
        lightDuration.current -= dt;
      } else {
        lightRef.current.intensity = 0;
      }
    }
  });

  return (
    <>
      {/* Rain */}
      {isRain && (
        <points ref={rainRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[rainPositions, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={isStorm ? 1.8 : 1.2}
            color="#a8c8e0"
            transparent
            opacity={0.55}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}

      {/* Snow */}
      {isSnow && (
        <points ref={snowRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[snowPositions, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={3.5}
            color="#e8f0f8"
            transparent
            opacity={0.75}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}

      {/* Lightning point light */}
      {isStorm && (
        <pointLight
          ref={lightRef}
          position={[0, 1200, 0]}
          color="#c8e0ff"
          intensity={0}
          distance={6000}
          decay={1}
        />
      )}
    </>
  );
}
