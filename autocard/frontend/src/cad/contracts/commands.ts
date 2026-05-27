import type { CadNode, CadNodeType } from './nodes'
import type { LayerDef } from './layers'
import type { Point } from './document'

export type CommandActor = {
  userId: string
  type: 'user' | 'user-ai-assisted' | 'system'
  sessionId?: string
}

type BaseCommand = {
  id: string
  actor: CommandActor
  timestamp: number
}

export type CreateNodeCommand = BaseCommand & {
  type: 'create-node'
  node: CadNode
}

export type UpdateNodeCommand = BaseCommand & {
  type: 'update-node'
  nodeId: string
  nodeType: CadNodeType
  changes: Partial<Omit<CadNode, 'id' | 'type'>>
}

export type DeleteNodeCommand = BaseCommand & {
  type: 'delete-node'
  nodeId: string
}

export type MoveNodeCommand = BaseCommand & {
  type: 'move-node'
  nodeId: string
  delta: Point
}

export type SetLayerVisibilityCommand = BaseCommand & {
  type: 'set-layer-visibility'
  layerId: string
  visible: boolean
}

export type UpdateLayerCommand = BaseCommand & {
  type: 'update-layer'
  layerId: string
  changes: Partial<LayerDef>
}

export type InsertBlockCommand = BaseCommand & {
  type: 'insert-block'
  blockDefinitionId: string
  position: Point
  rotation: number
  scaleX: number
  scaleY: number
  layerId: string
  attributes?: Record<string, string | number | boolean>
}

export type GroupNodesCommand = BaseCommand & {
  type: 'group-nodes'
  nodeIds: string[]
  groupId: string
  label?: string
}

export type UngroupNodesCommand = BaseCommand & {
  type: 'ungroup-nodes'
  groupId: string
}

export type ApplyAiPlanCommand = BaseCommand & {
  type: 'apply-ai-plan'
  planId: string
  commands: CadCommand[]
  promptSummary: string
  validationPassed: boolean
}

export type CommitPatchSetCommand = BaseCommand & {
  type: 'commit-patch-set'
  patchSetId: string
}

export type CadCommand =
  | CreateNodeCommand
  | UpdateNodeCommand
  | DeleteNodeCommand
  | MoveNodeCommand
  | SetLayerVisibilityCommand
  | UpdateLayerCommand
  | InsertBlockCommand
  | GroupNodesCommand
  | UngroupNodesCommand
  | ApplyAiPlanCommand
  | CommitPatchSetCommand
