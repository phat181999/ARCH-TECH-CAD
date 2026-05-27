import { create } from 'zustand'
import type { Point } from '../contracts/document'

type SpaceMode = 'model' | 'paper'

type CadViewportStore = {
  pan: Point
  zoom: number
  spaceMode: SpaceMode
  activeViewId: string | null
  activeSheetId: string | null
  canvasWidth: number
  canvasHeight: number

  setPan: (pan: Point) => void
  setZoom: (zoom: number) => void
  panBy: (delta: Point) => void
  zoomTo: (zoom: number, pivot?: Point) => void
  setSpaceMode: (mode: SpaceMode) => void
  setActiveView: (viewId: string | null) => void
  setActiveSheet: (sheetId: string | null) => void
  setCanvasSize: (width: number, height: number) => void
  screenToWorld: (screen: Point) => Point
  worldToScreen: (world: Point) => Point
}

export const useCadViewportStore = create<CadViewportStore>((set, get) => ({
  pan: { x: 0, y: 0 },
  zoom: 1,
  spaceMode: 'model',
  activeViewId: null,
  activeSheetId: null,
  canvasWidth: 800,
  canvasHeight: 600,

  setPan: (pan) => set({ pan }),
  setZoom: (zoom) => set({ zoom: Math.max(0.01, Math.min(200, zoom)) }),
  panBy: (delta) => set((s) => ({ pan: { x: s.pan.x + delta.x, y: s.pan.y + delta.y } })),

  zoomTo: (newZoom, pivot) => set((s) => {
    const clamped = Math.max(0.01, Math.min(200, newZoom))
    if (!pivot) return { zoom: clamped }
    const scale = clamped / s.zoom
    return {
      zoom: clamped,
      pan: {
        x: pivot.x - (pivot.x - s.pan.x) * scale,
        y: pivot.y - (pivot.y - s.pan.y) * scale,
      },
    }
  }),

  setSpaceMode: (mode) => set({ spaceMode: mode }),
  setActiveView: (viewId) => set({ activeViewId: viewId }),
  setActiveSheet: (sheetId) => set({ activeSheetId: sheetId }),
  setCanvasSize: (width, height) => set({ canvasWidth: width, canvasHeight: height }),

  screenToWorld: (screen) => {
    const { pan, zoom } = get()
    return { x: (screen.x - pan.x) / zoom, y: (screen.y - pan.y) / zoom }
  },

  worldToScreen: (world) => {
    const { pan, zoom } = get()
    return { x: world.x * zoom + pan.x, y: world.y * zoom + pan.y }
  },
}))
