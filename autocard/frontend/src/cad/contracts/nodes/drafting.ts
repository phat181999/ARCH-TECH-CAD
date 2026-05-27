import type { BaseNode } from './base'
import type { Point } from '../document'

export type LineNode = BaseNode & {
  type: 'line'
  start: Point
  end: Point
}

export type PolylineNode = BaseNode & {
  type: 'polyline'
  points: Point[]
  closed: boolean
}

export type ArcNode = BaseNode & {
  type: 'arc'
  center: Point
  radius: number
  startAngle: number
  endAngle: number
}

export type CircleNode = BaseNode & {
  type: 'circle'
  center: Point
  radius: number
}

export type RectangleNode = BaseNode & {
  type: 'rectangle'
  origin: Point
  width: number
  height: number
  rotation?: number
}

export type TextNode = BaseNode & {
  type: 'text'
  position: Point
  content: string
  fontSize: number
  fontFamily?: string
  rotation?: number
  horizontalAlign?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  width?: number
}

export type HatchPattern = 'solid' | 'ansi31' | 'ansi32' | 'ansi33' | 'ansi34' | 'ansi35' | 'ansi36' | 'ansi37' | 'user'

export type HatchNode = BaseNode & {
  type: 'hatch'
  boundary: Point[]
  pattern: HatchPattern
  scale: number
  angle: number
  associative: boolean
}

export type DimensionType = 'linear' | 'aligned' | 'angular' | 'radius' | 'diameter' | 'ordinate'

export type DimensionNode = BaseNode & {
  type: 'dimension'
  dimensionType: DimensionType
  anchorIds: string[]
  anchorPoints: Point[]
  textPosition?: Point
  overrideText?: string
  styleId?: string
}

export type LeaderNode = BaseNode & {
  type: 'leader'
  points: Point[]
  text?: string
  arrowStyle?: 'open' | 'closed' | 'dot' | 'none'
}
