import type { BaseNode } from './base'
import type { Point } from '../document'

// BIM-ready node stubs — not implemented in Phase 1.
// These placeholders reserve the discriminated union slots so the schema
// can accommodate them without breaking changes when BIM work begins.

export type SiteNode = BaseNode & {
  type: 'site'
  childNodeIds: string[]
  address?: string
  coordinates?: { lat: number; lng: number }
}

export type BuildingNode = BaseNode & {
  type: 'building'
  siteId?: string
  childNodeIds: string[]
  buildingType?: string
}

export type LevelNode = BaseNode & {
  type: 'level'
  buildingId?: string
  elevation: number
  name: string
  childNodeIds: string[]
}

export type SlabNode = BaseNode & {
  type: 'slab'
  levelId: string
  boundary: Point[]
  thickness: number
  material?: string
}

export type ColumnNode = BaseNode & {
  type: 'column'
  levelId?: string
  position: Point
  width: number
  depth: number
  height?: number
  rotation?: number
  material?: string
}

export type RoofNode = BaseNode & {
  type: 'roof'
  levelId?: string
  boundary: Point[]
  pitch?: number
  material?: string
}

export type ZoneNode = BaseNode & {
  type: 'zone'
  boundary: Point[]
  zoneType?: string
  label?: string
  childNodeIds: string[]
}

export type FurnitureNode = BaseNode & {
  type: 'furniture'
  blockDefinitionId?: string
  position: Point
  rotation: number
  width?: number
  depth?: number
  category?: string
  label?: string
}
