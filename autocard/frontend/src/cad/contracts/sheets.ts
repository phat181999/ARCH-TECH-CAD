import type { Point } from './document'
import type { LayerDef } from './layers'

export type SheetDef = {
  id: string
  name: string
  width: number
  height: number
  scale: number
  viewportIds: string[]
  titleBlockNodeId?: string
  drawingNumber?: string
  revision?: string
}

export type ViewDef = {
  id: string
  name: string
  center: Point
  zoom: number
  layerOverrides?: Record<string, Partial<LayerDef>>
}

export type ViewportDef = {
  id: string
  name: string
  sheetId: string
  x: number
  y: number
  width: number
  height: number
  scale: number
  viewCenter: Point
  rotation?: number
  layerOverrides?: Record<string, Partial<LayerDef>>
  clipped?: boolean
}

export const ISO_PAPER_SIZES: Record<string, { width: number; height: number }> = {
  A4:  { width: 297,  height: 210 },
  A3:  { width: 420,  height: 297 },
  A2:  { width: 594,  height: 420 },
  A1:  { width: 841,  height: 594 },
  A0:  { width: 1189, height: 841 },
}
