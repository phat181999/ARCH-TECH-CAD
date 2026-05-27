import type { BaseNode } from './base'
import type { Point } from '../document'

export type ModelSpaceNode = BaseNode & {
  type: 'model-space'
  childNodeIds: string[]
}

export type PaperSpaceNode = BaseNode & {
  type: 'paper-space'
  sheetId: string
  childNodeIds: string[]
}

export type ViewportNode = BaseNode & {
  type: 'viewport'
  sheetId: string
  x: number
  y: number
  width: number
  height: number
  scale: number
  viewCenter: Point
  rotation?: number
  clipped?: boolean
}
