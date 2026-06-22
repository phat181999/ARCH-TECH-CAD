import { VERTEX_SHADER, FRAGMENT_SHADER } from "./webglShaders";
import type { DrawingElement, Point, Layer } from "../../types";

export class WebGl2dRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private colorBuffer: WebGLBuffer | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.initShaders();
    this.initBuffers();
  }

  private initShaders() {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERTEX_SHADER);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error("Vertex shader compile error:", gl.getShaderInfoLog(vs));
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAGMENT_SHADER);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error("Fragment shader compile error:", gl.getShaderInfoLog(fs));
    }

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(this.program));
    }
  }

  private initBuffers() {
    const gl = this.gl;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(0); // position
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.enableVertexAttribArray(1); // color
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  private parseHexColor(hex: string): [number, number, number, number] {
    if (!hex || hex === "transparent") return [0.5, 0.5, 0.5, 1.0];
    const clean = hex.replace("#", "");
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16) / 255;
      const g = parseInt(clean[1] + clean[1], 16) / 255;
      const b = parseInt(clean[2] + clean[2], 16) / 255;
      return [r, g, b, 1.0];
    }
    if (clean.length === 6) {
      const r = parseInt(clean.substring(0, 2), 16) / 255;
      const g = parseInt(clean.substring(2, 4), 16) / 255;
      const b = parseInt(clean.substring(4, 6), 16) / 255;
      return [r, g, b, 1.0];
    }
    return [0.2, 0.2, 0.2, 1.0];
  }

  public render(
    width: number,
    height: number,
    panOffset: Point,
    zoom: number,
    elements: DrawingElement[],
    layers: Layer[],
    selectedElementIds: string[],
    isDarkMode: boolean
  ) {
    const gl = this.gl;

    // 1. Setup viewport and clear
    const dpr = window.devicePixelRatio || 1;
    gl.canvas.width = width * dpr;
    gl.canvas.height = height * dpr;
    gl.viewport(0, 0, width * dpr, height * dpr);

    if (isDarkMode) {
      gl.clearColor(0.12, 0.16, 0.23, 1.0); // slate-900 equivalent
    } else {
      gl.clearColor(0.97, 0.98, 0.99, 1.0); // slate-50 equivalent
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!this.program || elements.length === 0) return;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // 2. Build 3x3 2D transformation matrix in row-major layout
    // Convert 2D pixel coordinates -> WebGL Clip Space [-1, 1]
    const translationX = panOffset.x;
    const translationY = panOffset.y;

    // Compute mapping matrix
    // Clip space X = ((pixelX * zoom + translateX) / width) * 2 - 1
    // Clip space Y = -(((pixelY * zoom + translateY) / height) * 2 - 1)
    const m00 = (2.0 * zoom) / width;
    const m01 = 0.0;
    const m02 = (2.0 * translationX) / width - 1.0;

    const m10 = 0.0;
    const m11 = (-2.0 * zoom) / height;
    const m12 = 1.0 - (2.0 * translationY) / height;

    const m20 = 0.0;
    const m21 = 0.0;
    const m22 = 1.0;

    // WebGL uniform expect column-major:
    const matrix = new Float32Array([
      m00, m10, m20,
      m01, m11, m21,
      m02, m12, m22
    ]);

    const matrixLoc = gl.getUniformLocation(this.program, "u_matrix");
    gl.uniformMatrix3fv(matrixLoc, false, matrix);

    // 3. Batch geometry
    const positions: number[] = [];
    const colors: number[] = [];

    const pushLine = (x1: number, y1: number, x2: number, y2: number, col: [number, number, number, number]) => {
      positions.push(x1, y1, x2, y2);
      colors.push(...col, ...col);
    };

    const selectedSet = new Set(selectedElementIds);
    const visibleLayerIds = new Set(layers.filter(l => l.visible).map(l => l.id));

    for (const el of elements) {
      if (el.layerId && !visibleLayerIds.has(el.layerId)) continue;

      let color = this.parseHexColor(el.strokeColor || "#1f2937");
      if (selectedSet.has(el.id)) {
        color = [0.23, 0.51, 0.96, 1.0]; // bright selection blue
      }

      // Render Line
      if (el.type === "line" && el.x1 !== undefined && el.y1 !== undefined) {
        pushLine(el.x1, el.y1, el.x2 ?? el.x1, el.y2 ?? el.y1, color);
      }
      // Render Rectangle
      else if (el.type === "rectangle" && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
        const x = el.x, y = el.y, w = el.width, h = el.height;
        pushLine(x, y, x + w, y, color);
        pushLine(x + w, y, x + w, y + h, color);
        pushLine(x + w, y + h, x, y + h, color);
        pushLine(x, y + h, x, y, color);
      }
      // Render Circle
      else if (el.type === "circle" && el.cx !== undefined && el.cy !== undefined && el.radius !== undefined) {
        const cx = el.cx, cy = el.cy, r = el.radius;
        const steps = 36;
        for (let i = 0; i < steps; i++) {
          const a1 = (i / steps) * 2 * Math.PI;
          const a2 = ((i + 1) / steps) * 2 * Math.PI;
          pushLine(cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2), color);
        }
      }
      // Render Polyline / Spline
      else if ((el.type === "polyline" || el.type === "leader") && Array.isArray(el.points) && el.points.length >= 2) {
        const pts = el.points as Point[];
        for (let i = 0; i < pts.length - 1; i++) {
          pushLine(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, color);
        }
        if ((el as any).closed && pts.length >= 3) {
          pushLine(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y, color);
        }
      }
      // Render Walls (dual-format line walls or start/end box outlines)
      else if (el.type === "wall") {
        const s = (el as any).start || { x: el.x1 ?? 0, y: el.y1 ?? 0 };
        const e = (el as any).end || { x: el.x2 ?? 0, y: el.y2 ?? 0 };
        const t = (el as any).thickness ?? 20;
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        const len = Math.hypot(dx, dy);
        if (len > 0.1) {
          const nx = -dy / len;
          const ny = dx / len;
          const wColor: [number, number, number, number] = selectedSet.has(el.id) ? color : [0.12, 0.16, 0.23, 0.8];

          // Draw the outline of the wall segment
          const p1x = s.x + nx * (t / 2), p1y = s.y + ny * (t / 2);
          const p2x = e.x + nx * (t / 2), p2y = e.y + ny * (t / 2);
          const p3x = e.x - nx * (t / 2), p3y = e.y - ny * (t / 2);
          const p4x = s.x - nx * (t / 2), p4y = s.y - ny * (t / 2);

          pushLine(p1x, p1y, p2x, p2y, wColor);
          pushLine(p2x, p2y, p3x, p3y, wColor);
          pushLine(p3x, p3y, p4x, p4y, wColor);
          pushLine(p4x, p4y, p1x, p1y, wColor);
        }
      }
      // Render Openings snap outlines
      else if (el.type === "opening" && el.position) {
        const p = el.position as Point;
        const w = el.width ?? 30;
        const oColor: [number, number, number, number] = selectedSet.has(el.id) ? color : [0.06, 0.46, 0.43, 1.0];
        // simple cross indicator at opening position
        pushLine(p.x - w/2, p.y, p.x + w/2, p.y, oColor);
        pushLine(p.x, p.y - 10, p.x, p.y + 10, oColor);
      }
    }

    if (positions.length === 0) return;

    // 4. Upload data and Draw
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);

    gl.drawArrays(gl.LINES, 0, positions.length / 2);

    gl.bindVertexArray(null);
  }
}
