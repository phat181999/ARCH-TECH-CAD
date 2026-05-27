import type { BaseNode } from './base'
import type { Point } from '../document'

export type WallJoinType = 'miter' | 'butt' | 'tee' | 'none'

export type WallNode = BaseNode & {
  type: 'wall'
  start: Point
  end: Point
  thickness: number
  height?: number
  baseOffset?: number
  joinStart?: WallJoinType
  joinEnd?: WallJoinType
  openingIds?: string[]
  isCurtainWall?: boolean
}

export type DoorSwing = 'left' | 'right' | 'double' | 'sliding' | 'folding' | 'none'

export type DoorNode = BaseNode & {
  type: 'door'
  hostWallId: string
  positionAlongWall: number
  width: number
  height?: number
  swing: DoorSwing
  inward: boolean
  isDouble: boolean
  openAngle?: number
}

export type WindowType = 'fixed' | 'casement' | 'sliding' | 'awning' | 'bay' | 'skylight'

export type WindowNode = BaseNode & {
  type: 'window'
  hostWallId: string
  positionAlongWall: number
  width: number
  height?: number
  sillHeight?: number
  windowType: WindowType
  paneCount?: number
}

export type RoomNode = BaseNode & {
  type: 'room'
  label: string
  roomType?: string
  area?: number
  boundaryWallIds: string[]
  labelPosition?: Point
  finishFloor?: string
  finishCeiling?: string
  finishWall?: string
  height?: number
}

export type GridAxisOrientation = 'horizontal' | 'vertical' | 'angled'

export type GridAxisNode = BaseNode & {
  type: 'grid-axis'
  label: string
  orientation: GridAxisOrientation
  angle?: number
  offset: number
  start: Point
  end: Point
}

export type OpeningGroupNode = BaseNode & {
  type: 'opening-group'
  hostWallId: string
  openingIds: string[]
}
