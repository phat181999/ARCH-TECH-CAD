export type BaseNode = {
  id: string
  type: string
  parentId: string | null
  name?: string
  visible: boolean
  locked: boolean
  layerId: string
  styleId?: string
  metadata?: Record<string, unknown>
}
