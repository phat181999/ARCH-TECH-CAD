import type { CadCommand } from './commands'
import type { CadDocument, DerivedDocumentState } from './document'
import type { PatchSet } from './patches'
import type { ValidationError } from './validation'
import type { Point } from './document'

export type PreviewNode = {
  previewId: string
  sessionId: string
  nodeType: string
  geometry: Record<string, unknown>
  layerId?: string
  label?: string
}

export type Participant = {
  userId: string
  username: string
  cursor?: Point
  viewportCenter?: Point
  viewportZoom?: number
  selectedNodeIds?: string[]
}

export type CadEventMap = {
  'cad:command:committed': { command: CadCommand; dirtyNodeIds: string[]; newDoc: CadDocument }
  'cad:command:rejected': { command: CadCommand; errors: ValidationError[] }
  'cad:derived:invalidated': { caches: (keyof DerivedDocumentState)[]; dirtyNodeIds: string[] }
  'cad:derived:ready': { updatedCaches: Partial<DerivedDocumentState> }
  'cad:document:loaded': { doc: CadDocument }
  'cad:document:saved': { documentId: string; version: number }
  'cad:selection:changed': { selectedIds: string[]; hoveredIds: string[] }
  'cad:viewport:changed': { pan: Point; zoom: number }
  'cad:tool:changed': { tool: string }
  'cad:ai:preview:started': { sessionId: string }
  'cad:ai:preview:node': { sessionId: string; node: PreviewNode }
  'cad:ai:preview:complete': { sessionId: string }
  'cad:ai:preview:failed': { message: string }
  'cad:ai:draft:accepted': { commands: CadCommand[] }
  'cad:ai:draft:discarded': { sessionId: string }
  'cad:collab:patch:received': { patch: PatchSet; actorId: string }
  'cad:collab:patch:rejected': { errors: ValidationError[]; patchId: string }
  'cad:collab:presence:updated': { participants: Participant[] }
  'cad:collab:connected': { sessionId: string }
  'cad:collab:disconnected': { reason?: string }
}
