// src/pages/CanvasEditor/utils/idGen.ts
let _counter = 0;
export function genId(): string {
  return `el-${Date.now()}-${(_counter++).toString(36)}`;
}
