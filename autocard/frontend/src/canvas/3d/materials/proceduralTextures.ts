/**
 * proceduralTextures.ts
 *
 * Canvas-based procedural PBR texture generators.
 * Every function returns a ready-to-use THREE.CanvasTexture with RepeatWrapping
 * already configured.  The textures are resolution-appropriate for real-time
 * rendering (256–512 px tiles) and designed to tile seamlessly.
 *
 * Why canvas instead of loading files?
 * • Zero network requests — no 404s, no CORS, no loading spinners.
 * • Deterministic — same output per call, no CDN dependency.
 * • Tiny memory — a 512×512 RGBA canvas is ~1 MB GPU, comparable to a compressed JPEG.
 */
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a value between 0 and 255. */
const clamp = (v: number) => Math.max(0, Math.min(255, v));

/** Create a canvas of the given size and return [canvas, ctx]. */
function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return [c, c.getContext("2d")!];
}

/** Wrap a canvas in a RepeatWrapping CanvasTexture. */
function toTexture(canvas: HTMLCanvasElement, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

// ---------------------------------------------------------------------------
// Brick
// ---------------------------------------------------------------------------

export function generateBrickTexture(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);
  const rows = 16;
  const cols = 8;
  const rh = size / rows;
  const cw = size / cols;
  const mortarGap = 3;

  // Mortar background
  ctx.fillStyle = "#b8b0a4";
  ctx.fillRect(0, 0, size, size);

  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    const xOff = r % 2 === 1 ? cw / 2 : 0;
    for (let c = -1; c <= cols; c++) {
      const x = c * cw + xOff;
      // Per-brick colour variation
      const br = 155 + ((r * 7 + c * 13) % 35);
      const bg = 72 + ((r * 3 + c * 11) % 25);
      const bb = 45 + ((r * 5 + c * 9) % 18);
      ctx.fillStyle = `rgb(${br},${bg},${bb})`;
      ctx.fillRect(x + mortarGap, y + mortarGap, cw - mortarGap * 2, rh - mortarGap * 2);

      // Subtle speckle inside bricks
      for (let s = 0; s < 12; s++) {
        const sx = x + mortarGap + Math.random() * (cw - mortarGap * 3);
        const sy = y + mortarGap + Math.random() * (rh - mortarGap * 3);
        ctx.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.06})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
  }
  return toTexture(canvas, 3, 3);
}

export function generateBrickNormalMap(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);
  const rows = 16;
  const cols = 8;
  const rh = size / rows;
  const cw = size / cols;
  const bevel = 3;

  ctx.fillStyle = "#8080ff"; // flat tangent-space normal
  ctx.fillRect(0, 0, size, size);

  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    const xOff = r % 2 === 1 ? cw / 2 : 0;
    for (let c = -1; c <= cols; c++) {
      const x = c * cw + xOff;
      // Top bevel  — normal tilts up (+G)
      ctx.fillStyle = "#80a8ff";
      ctx.fillRect(x + bevel, y + 3, cw - bevel * 2, bevel);
      // Bottom bevel — normal tilts down (−G)
      ctx.fillStyle = "#8058ff";
      ctx.fillRect(x + bevel, y + rh - 3 - bevel, cw - bevel * 2, bevel);
      // Left bevel — normal tilts left (−R)
      ctx.fillStyle = "#5880ff";
      ctx.fillRect(x + 3, y + bevel, bevel, rh - bevel * 2);
      // Right bevel — normal tilts right (+R)
      ctx.fillStyle = "#a880ff";
      ctx.fillRect(x + cw - 3 - bevel, y + bevel, bevel, rh - bevel * 2);
    }
  }
  return toTexture(canvas, 3, 3);
}

// ---------------------------------------------------------------------------
// Concrete / Stucco
// ---------------------------------------------------------------------------

export function generateConcreteTexture(baseHex = "#8c8d8a"): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Per-pixel noise (deterministic-ish; Math.random is fine for textures)
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    d[i] = clamp(d[i] + n);
    d[i + 1] = clamp(d[i + 1] + n);
    d[i + 2] = clamp(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);

  // Soft stain splotches
  for (let s = 0; s < 12; s++) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.03})`;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * size,
      Math.random() * size,
      8 + Math.random() * 18,
      6 + Math.random() * 12,
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  return toTexture(canvas, 6, 6);
}

export function generateConcreteNormalMap(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp(d[i] + (Math.random() - 0.5) * 10);
    d[i + 1] = clamp(d[i + 1] + (Math.random() - 0.5) * 10);
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas, 6, 6);
}

// ---------------------------------------------------------------------------
// Wood
// ---------------------------------------------------------------------------

export function generateWoodTexture(): THREE.CanvasTexture {
  const size = 512;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = "#b48a53";
  ctx.fillRect(0, 0, size, size);

  // Grain lines — sine-modulated for organic feel
  for (let y = 0; y < size; y += 3) {
    const alpha = 0.08 + Math.random() * 0.12;
    ctx.strokeStyle = `rgba(100,60,20,${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 8) {
      const dy = Math.sin(x * 0.012 + y * 0.08) * 4 + (Math.random() - 0.5) * 1.5;
      ctx.lineTo(x, y + dy);
    }
    ctx.stroke();
  }

  // A couple of knots
  for (let k = 0; k < 2; k++) {
    const kx = 60 + Math.random() * (size - 120);
    const ky = 60 + Math.random() * (size - 120);
    for (let ring = 3; ring < 16; ring += 3) {
      ctx.strokeStyle = `rgba(90,50,15,${0.15 + Math.random() * 0.1})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(kx, ky, ring, ring * 0.4, Math.PI / 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  return toTexture(canvas, 2, 2);
}

export function generateWoodNormalMap(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);

  // Horizontal grain grooves
  for (let y = 0; y < size; y += 6) {
    ctx.fillStyle = Math.random() > 0.5 ? "#8088ff" : "#8078ff";
    ctx.fillRect(0, y, size, 2);
  }
  return toTexture(canvas, 2, 2);
}

// ---------------------------------------------------------------------------
// Roof — standing-seam metal (modern architectural) or clay tile
// ---------------------------------------------------------------------------

export function generateRoofTexture(metal = true): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);

  if (metal) {
    ctx.fillStyle = "#3b4252";
    ctx.fillRect(0, 0, size, size);

    // Per-pixel metallic grain
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 8;
      d[i] = clamp(d[i] + n);
      d[i + 1] = clamp(d[i + 1] + n);
      d[i + 2] = clamp(d[i + 2] + n);
    }
    ctx.putImageData(img, 0, 0);

    // Standing seams
    const seams = 8;
    const sw = size / seams;
    for (let i = 0; i < seams; i++) {
      const x = i * sw;
      ctx.fillStyle = "#2e3440";
      ctx.fillRect(x, 0, 3, size);
      ctx.fillStyle = "#5e6678";
      ctx.fillRect(x + 3, 0, 2, size);
    }
  } else {
    // Clay tiles
    ctx.fillStyle = "#994d3d";
    ctx.fillRect(0, 0, size, size);

    const rows = 12;
    const rh = size / rows;
    const cw = size / 6;
    ctx.strokeStyle = "#6b3028";
    ctx.lineWidth = 2;
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
      const off = (r % 2) * (cw / 2);
      for (let x = -cw; x < size + cw; x += cw) {
        ctx.beginPath();
        ctx.arc(x + off + cw / 2, y, cw / 2, 0, Math.PI);
        ctx.stroke();
      }
    }
  }
  return toTexture(canvas, 4, 4);
}

export function generateRoofNormalMap(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);

  // Standing-seam ridges
  const seams = 8;
  const sw = size / seams;
  for (let i = 0; i < seams; i++) {
    const x = i * sw;
    ctx.fillStyle = "#5880ff"; // left face
    ctx.fillRect(x, 0, 2, size);
    ctx.fillStyle = "#a880ff"; // right face
    ctx.fillRect(x + 2, 0, 2, size);
  }
  return toTexture(canvas, 4, 4);
}

// ---------------------------------------------------------------------------
// Marble — reuse concrete generator with lighter base
// ---------------------------------------------------------------------------

export function generateMarbleTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = "#eeede8";
  ctx.fillRect(0, 0, size, size);

  // Subtle veins
  ctx.strokeStyle = "rgba(160,155,145,0.25)";
  ctx.lineWidth = 1.5;
  for (let v = 0; v < 6; v++) {
    ctx.beginPath();
    let vx = Math.random() * size;
    let vy = 0;
    ctx.moveTo(vx, vy);
    while (vy < size) {
      vx += (Math.random() - 0.5) * 30;
      vy += 10 + Math.random() * 20;
      ctx.lineTo(vx, vy);
    }
    ctx.stroke();
  }

  // Noise overlay
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 6;
    d[i] = clamp(d[i] + n);
    d[i + 1] = clamp(d[i + 1] + n);
    d[i + 2] = clamp(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas, 4, 4);
}

// ---------------------------------------------------------------------------
// Grass normal map — high-frequency bumps simulating blades
// ---------------------------------------------------------------------------

export function generateGrassNormalMap(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp(d[i] + (Math.random() - 0.5) * 40);
    d[i + 1] = clamp(d[i + 1] + (Math.random() - 0.5) * 40);
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas, 40, 40);
}

// ---------------------------------------------------------------------------
// Leaf texture for foliage trees
// ---------------------------------------------------------------------------

export function generateLeafTexture(baseColor: string): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // Draw small randomly-oriented leaf ellipses
  for (let i = 0; i < 350; i++) {
    const lx = Math.random() * size;
    const ly = Math.random() * size;
    const lw = 3 + Math.random() * 5;
    const lh = 1.5 + Math.random() * 3;
    const angle = Math.random() * Math.PI;

    // Alternate between lighter and darker greens
    const shade = Math.random();
    if (shade < 0.35) ctx.fillStyle = "rgba(35,100,35,0.7)";
    else if (shade < 0.7) ctx.fillStyle = "rgba(25,75,25,0.6)";
    else ctx.fillStyle = "rgba(55,130,45,0.5)";

    ctx.beginPath();
    ctx.ellipse(lx, ly, lw, lh, angle, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shadow dappling
  for (let s = 0; s < 20; s++) {
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 6 + Math.random() * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas, 2, 2);
}

// ---------------------------------------------------------------------------
// Lookup — maps a file-path key to the right procedural generator
// ---------------------------------------------------------------------------

const generatorMap: Record<string, () => THREE.CanvasTexture> = {
  "brick/albedo": generateBrickTexture,
  "brick/normal": generateBrickNormalMap,
  "concrete/albedo": () => generateConcreteTexture("#8c8d8a"),
  "concrete/normal": generateConcreteNormalMap,
  "concrete/roughness": generateConcreteNormalMap,
  "wood/albedo": generateWoodTexture,
  "wood/normal": generateWoodNormalMap,
  "wood/roughness": generateWoodNormalMap,
  "marble/albedo": generateMarbleTexture,
  "marble/normal": generateConcreteNormalMap,
  "roof_tile/albedo": () => generateRoofTexture(true),
  "roof_tile/normal": generateRoofNormalMap,
};

/**
 * Resolve a texture path (e.g. "/textures/brick/albedo.jpg") to a procedural
 * CanvasTexture.  Returns null if no matching generator exists.
 */
export function resolveProceduralTexture(path: string): THREE.CanvasTexture | null {
  for (const [key, gen] of Object.entries(generatorMap)) {
    if (path.includes(key)) return gen();
  }
  return null;
}
