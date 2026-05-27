export type LineType =
  | 'continuous'
  | 'dashed'
  | 'dotted'
  | 'dashdot'
  | 'center'
  | 'phantom'
  | 'hidden'

export type LayerDef = {
  id: string
  name: string
  visible: boolean
  locked: boolean
  frozen: boolean
  color: string
  lineType: LineType
  lineWeight: number
  plotStyle?: string
  parentId?: string
}

export type StyleDef = {
  id: string
  name: string
  color?: string
  lineType?: LineType
  lineWeight?: number
  fillColor?: string
  fontSize?: number
  fontFamily?: string
  textAlign?: 'left' | 'center' | 'right'
  arrowStyle?: 'open' | 'closed' | 'dot' | 'tick'
}

export const DEFAULT_AEC_LAYERS: Omit<LayerDef, 'id'>[] = [
  { name: 'A-WALL',  visible: true, locked: false, frozen: false, color: '#FFFFFF', lineType: 'continuous', lineWeight: 0.5 },
  { name: 'A-DOOR',  visible: true, locked: false, frozen: false, color: '#4DA6FF', lineType: 'continuous', lineWeight: 0.35 },
  { name: 'A-WIND',  visible: true, locked: false, frozen: false, color: '#4DA6FF', lineType: 'continuous', lineWeight: 0.25 },
  { name: 'A-ROOM',  visible: true, locked: false, frozen: false, color: '#FFD700', lineType: 'continuous', lineWeight: 0.18 },
  { name: 'A-DIMS',  visible: true, locked: false, frozen: false, color: '#FF8C00', lineType: 'continuous', lineWeight: 0.18 },
  { name: 'A-ANNO',  visible: true, locked: false, frozen: false, color: '#CCCCCC', lineType: 'continuous', lineWeight: 0.18 },
  { name: 'A-GRID',  visible: true, locked: false, frozen: false, color: '#555555', lineType: 'dashdot',    lineWeight: 0.18 },
  { name: 'A-HATCH', visible: true, locked: false, frozen: false, color: '#888888', lineType: 'continuous', lineWeight: 0.13 },
]
