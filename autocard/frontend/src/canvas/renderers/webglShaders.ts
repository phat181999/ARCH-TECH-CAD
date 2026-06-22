// Vertex and Fragment Shaders for GPU-accelerated WebGL 2D CAD Renderer

export const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 position;
layout(location = 1) in vec4 color;

uniform mat3 u_matrix; // 2D transform matrix (pan/zoom/device-pixel-ratio)

out vec4 v_color;

void main() {
  // Transform coordinate to clip space
  vec3 transformed = u_matrix * vec3(position, 1.0);
  gl_Position = vec4(transformed.xy, 0.0, 1.0);
  v_color = color;
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec4 v_color;
out vec4 outColor;

void main() {
  outColor = v_color;
}
`;
