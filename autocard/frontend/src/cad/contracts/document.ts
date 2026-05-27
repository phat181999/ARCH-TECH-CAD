export type Point = { x: number; y: number }
export type Point3D = { x: number; y: number; z: number }

export type UnitSystem = 'mm' | 'cm' | 'm' | 'inch' | 'ft'

export type DocumentSettings = {
  units: UnitSystem
  precision: number
  angleUnit: 'deg' | 'rad'
  gridSpacing: number
  snapThreshold: number
  defaultLayerId: string
  defaultStyleId: string
  wallDefaultThickness: number
  dimensionStyle: string
}

export type CadDocument = {
  schemaVersion: number
  documentId: string
  name: string
  createdAt: string
  updatedAt: string
  units: UnitSystem
  settings: DocumentSettings
  roots: string[]
  nodes: Record<string, import('./nodes').CadNode>
  layers: Record<string, import('./layers').LayerDef>
  styles: Record<string, import('./layers').StyleDef>
  blocks: Record<string, import('./nodes/composition').BlockDefinitionNode>
  views: Record<string, import('./sheets').ViewDef>
  sheets: Record<string, import('./sheets').SheetDef>
  constraints: Record<string, import('./constraints').ConstraintDef>
  derived?: DerivedDocumentState
  metadata?: Record<string, unknown>
}

export type WallPolygonCache = {
  nodeId: string
  outline: Point[]
  centerLine: Point[]
  thickness: number
  joinsWith: string[]
}

export type WallJoinCache = {
  nodeId: string
  joinTypeByNeighbor: Record<string, 'miter' | 'butt' | 'tee' | 'none'>
  intersectionPoints: Point[]
}

export type RoomGraphCache = {
  nodeId: string
  boundary: Point[]
  area: number
  perimeter: number
  wallIds: string[]
  openingIds: string[]
  roomType?: string
}

export type RoomLabelCache = {
  nodeId: string
  label: string
  position: Point
  angle?: number
}

export type OpeningPlacementCache = {
  nodeId: string
  hostWallId: string
  position: Point
  wallTangent: Point
  wallNormal: Point
  cutWidth: number
}

export type BoundsCache = {
  nodeId: string
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type LayerVisibilityCache = {
  layerId: string
  visible: boolean
  effectiveNodeIds: string[]
}

export type SnapPoint = {
  position: Point
  type: 'endpoint' | 'midpoint' | 'center' | 'intersection' | 'perpendicular' | 'tangent' | 'grid' | 'nearest'
  nodeId?: string
  priority: number
}

export type SnapIndexCache = {
  revision: number
  endpoints: SnapPoint[]
  midpoints: SnapPoint[]
  centers: SnapPoint[]
  intersections: SnapPoint[]
  gridPoints?: SnapPoint[]
}

export type SpatialBucket = {
  bucketKey: string
  nodeIds: string[]
}

export type SpatialIndexCache = {
  revision: number
  buckets: Record<string, string[]>
  boundsByNode: Record<string, BoundsCache>
}

export type RenderIndexCache = {
  revision: number
  drawOrder: string[]
  selectableOrder: string[]
  hoverPriority: string[]
}

export type DerivedDiagnostic = {
  code: string
  severity: 'info' | 'warning' | 'error'
  nodeIds: string[]
  message: string
}

export type DerivedDocumentState = {
  revision: number
  fromDocumentVersion: number
  wallPolygons: Record<string, WallPolygonCache>
  wallJoins: Record<string, WallJoinCache>
  roomGraphs: Record<string, RoomGraphCache>
  roomLabels: Record<string, RoomLabelCache>
  openingPlacements: Record<string, OpeningPlacementCache>
  nodeBounds: Record<string, BoundsCache>
  layerVisibility: Record<string, LayerVisibilityCache>
  snapIndex?: SnapIndexCache
  spatialIndex?: SpatialIndexCache
  renderIndex?: RenderIndexCache
  diagnostics: DerivedDiagnostic[]
}
