import type { PatchSet } from './patches'
import type { ValidationError } from './validation'
import type { Point } from './document'
import type { PreviewNode } from './events'

export type WsMessageType =
  | 'join'
  | 'leave'
  | 'cursor-move'
  | 'patch-submit'
  | 'patch-ack'
  | 'patch-reject'
  | 'patch-broadcast'
  | 'presence-update'
  | 'lock-claim'
  | 'lock-release'
  | 'lock-broadcast'
  | 'ai-preview-start'
  | 'ai-preview-node'
  | 'ai-preview-end'
  | 'version-list'

export type WsEnvelope = {
  type: WsMessageType
  sessionId: string
  actorId: string
  seq: number
  payload: unknown
}

export type JoinPayload = { documentId: string; username: string }
export type LeavePayload = { reason?: string }
export type CursorMovePayload = { position: Point; viewportZoom?: number }
export type PatchSubmitPayload = { patchSet: PatchSet }
export type PatchAckPayload = { patchId: string; committedVersion: number }
export type PatchRejectPayload = { patchId: string; errors: ValidationError[] }
export type PatchBroadcastPayload = { patchSet: PatchSet; committedVersion: number }
export type PresenceUpdatePayload = {
  participants: Array<{
    userId: string; username: string; cursor?: Point; selectedNodeIds?: string[]
  }>
}
export type LockClaimPayload = { nodeId: string }
export type LockReleasePayload = { nodeId: string }
export type LockBroadcastPayload = { locks: Record<string, string> }
export type AiPreviewNodePayload = { sessionId: string; node: PreviewNode }
export type AiPreviewEndPayload = { sessionId: string }

export type CollaborationSession = {
  sessionId: string
  documentId: string
  documentVersion: number
  participants: Participant[]
  locks: Record<string, string>
}

export type Participant = {
  userId: string
  username: string
  cursor?: Point
  viewportCenter?: Point
  viewportZoom?: number
  selectedNodeIds?: string[]
  connectedAt: string
}

export type EditClaim = {
  nodeId: string
  userId: string
  claimedAt: string
}
