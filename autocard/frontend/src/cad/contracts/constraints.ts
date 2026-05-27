export type ConstraintType =
  | 'parallel'
  | 'perpendicular'
  | 'equal-length'
  | 'fixed-angle'
  | 'fixed-length'
  | 'coincident'
  | 'collinear'
  | 'concentric'
  | 'tangent'
  | 'horizontal'
  | 'vertical'
  | 'symmetric'

export type ConstraintDef = {
  id: string
  type: ConstraintType
  nodeIds: string[]
  params?: Record<string, number | string>
  satisfied: boolean
  persistent: boolean
}
