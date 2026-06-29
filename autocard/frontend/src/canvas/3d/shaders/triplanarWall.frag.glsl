uniform vec3  uColor;
uniform float uRoughness;
uniform float uMetalness;
uniform float uTileScale;
uniform vec3  uLightDir;
uniform vec3  uLightColor;
uniform float uAmbient;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vUv;

// Simple triplanar blending weights
vec3 triplanarWeights(vec3 normal) {
  vec3 w = abs(normal);
  w = max(w - 0.2, 0.0);
  w /= (w.x + w.y + w.z + 0.001);
  return w;
}

// Procedural brick pattern for concrete walls
float brickPattern(vec2 uv) {
  vec2 scaledUv = uv * uTileScale;
  float row = floor(scaledUv.y);
  float offset = mod(row, 2.0) * 0.5;
  vec2 brickUv = vec2(scaledUv.x + offset, scaledUv.y);
  vec2 mortar = fract(brickUv);
  float mortarX = smoothstep(0.0, 0.05, mortar.x) * smoothstep(1.0, 0.95, mortar.x);
  float mortarY = smoothstep(0.0, 0.08, mortar.y) * smoothstep(1.0, 0.92, mortar.y);
  return mortarX * mortarY;
}

void main() {
  vec3 weights = triplanarWeights(vWorldNormal);

  // Sample brick pattern from 3 axes
  float brickX = brickPattern(vWorldPosition.yz * 0.001);
  float brickY = brickPattern(vWorldPosition.xz * 0.001);
  float brickZ = brickPattern(vWorldPosition.xy * 0.001);
  float brick  = brickX * weights.x + brickY * weights.y + brickZ * weights.z;

  // Base color with slight variation
  vec3 baseColor  = uColor;
  vec3 brickColor = baseColor * 0.85;
  vec3 color      = mix(brickColor, baseColor * 1.05, brick);

  // Simple PBR-ish lighting
  vec3  norm    = normalize(vWorldNormal);
  float NdotL   = max(dot(norm, normalize(uLightDir)), 0.0);
  float ambient = uAmbient;

  vec3 diffuse  = color * (ambient + NdotL * (1.0 - uRoughness * 0.5));

  // Specular (Blinn-Phong approximation)
  vec3 viewDir  = normalize(cameraPosition - vWorldPosition);
  vec3 halfDir  = normalize(normalize(uLightDir) + viewDir);
  float spec    = pow(max(dot(norm, halfDir), 0.0), mix(4.0, 64.0, 1.0 - uRoughness));
  vec3 specular = uLightColor * spec * uMetalness * 0.5;

  gl_FragColor = vec4(diffuse + specular, 1.0);
}
