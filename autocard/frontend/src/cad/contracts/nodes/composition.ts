import type { BaseNode } from './base'
import type { Point } from '../document'

export type BlockCategory = 'symbol' | 'fixture' | 'furniture' | 'annotation' | 'equipment' | 'custom'

export type BlockDefinitionNode = BaseNode & {
  type: 'block-definition'
  insertionPoint: Point
  childNodeIds: string[]
  category?: BlockCategory
  tags?: string[]
  description?: string
}

export type BlockInstanceNode = BaseNode & {
  type: 'block-instance'
  blockDefinitionId: string
  position: Point
  rotation: number
  scaleX: number
  scaleY: number
  attributes?: Record<string, string | number | boolean>
}

export type GroupNode = BaseNode & {
  type: 'group'
  childNodeIds: string[]
  label?: string
}
