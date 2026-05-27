import type { CadNode } from './nodes'
import type { LayerDef } from './layers'
import type { DerivedDocumentState } from './document'
import type { CommandActor } from './commands'

export type CreateNodePatch = {
  op: 'create-node'
  node: CadNode
}

export type UpdateNodePatch = {
  op: 'update-node'
  nodeId: string
  changes: Record<string, unknown>
}

export type DeleteNodePatch = {
  op: 'delete-node'
  nodeId: string
}

export type ReorderRootPatch = {
  op: 'reorder-root'
  roots: string[]
}

export type UpdateLayerPatch = {
  op: 'update-layer'
  layerId: string
  layer: Partial<LayerDef>
}

export type UpdateDerivedCachePatch = {
  op: 'update-derived-cache'
  cache: Partial<DerivedDocumentState>
}

export type DocumentPatch =
  | CreateNodePatch
  | UpdateNodePatch
  | DeleteNodePatch
  | ReorderRootPatch
  | UpdateLayerPatch
  | UpdateDerivedCachePatch

export type PatchSet = {
  id: string
  documentId: string
  baseVersion: number
  actor: CommandActor
  timestamp: number
  patches: DocumentPatch[]
  commandId?: string
}

export type CommittedPatchSet = PatchSet & {
  committedVersion: number
  committedAt: string
}
