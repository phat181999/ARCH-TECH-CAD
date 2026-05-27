import { create } from 'zustand'

export type ToolName =
  | 'select'
  | 'line'
  | 'polyline'
  | 'arc'
  | 'circle'
  | 'rectangle'
  | 'wall'
  | 'door'
  | 'window'
  | 'room'
  | 'text'
  | 'dimension'
  | 'leader'
  | 'hatch'
  | 'move'
  | 'copy'
  | 'rotate'
  | 'scale'
  | 'trim'
  | 'extend'
  | 'offset'
  | 'mirror'
  | 'measure'
  | 'pan'
  | 'zoom'

type SnapModes = {
  endpoint: boolean
  midpoint: boolean
  center: boolean
  intersection: boolean
  perpendicular: boolean
  tangent: boolean
  nearest: boolean
  grid: boolean
}

type CadToolStore = {
  activeTool: ToolName
  previousTool: ToolName
  snapModes: SnapModes
  snapEnabled: boolean
  orthoMode: boolean
  polarAngle: number

  setTool: (tool: ToolName) => void
  setPreviousTool: () => void
  setSnapMode: (mode: keyof SnapModes, enabled: boolean) => void
  setSnapEnabled: (enabled: boolean) => void
  setOrthoMode: (enabled: boolean) => void
  setPolarAngle: (angle: number) => void
}

const DEFAULT_SNAP: SnapModes = {
  endpoint: true,
  midpoint: true,
  center: true,
  intersection: true,
  perpendicular: false,
  tangent: false,
  nearest: false,
  grid: true,
}

export const useCadToolStore = create<CadToolStore>((set, get) => ({
  activeTool: 'select',
  previousTool: 'select',
  snapModes: DEFAULT_SNAP,
  snapEnabled: true,
  orthoMode: false,
  polarAngle: 45,

  setTool: (tool) => set((s) => ({ activeTool: tool, previousTool: s.activeTool })),
  setPreviousTool: () => set((s) => ({ activeTool: s.previousTool })),
  setSnapMode: (mode, enabled) => set((s) => ({ snapModes: { ...s.snapModes, [mode]: enabled } })),
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  setOrthoMode: (enabled) => set({ orthoMode: enabled }),
  setPolarAngle: (angle) => set({ polarAngle: angle }),
}))
