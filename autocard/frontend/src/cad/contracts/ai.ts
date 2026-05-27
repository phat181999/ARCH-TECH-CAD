import type { PreviewNode } from './events'
import type { ValidationError } from './validation'
import type { CadCommand } from './commands'

export type AiPreviewStreamEvent =
  | { type: 'plan-fragment'; text: string }
  | { type: 'preview-node-upsert'; previewSessionId: string; nodes: PreviewNode[] }
  | { type: 'preview-diagnostic'; code: string; message: string; severity: 'info' | 'warning' | 'error' }
  | { type: 'preview-complete'; previewSessionId: string }
  | { type: 'preview-failed'; message: string }

export type AiPreviewDiagnostic = {
  code: string
  message: string
  severity: 'info' | 'warning' | 'error'
  nodeId?: string
}

export type AiIntentType = 'generation' | 'transformation' | 'annotation' | 'optimization' | 'explanation'

export type AiPlanRequest = {
  planId: string
  prompt: string
  intentType?: AiIntentType
  contextDocumentId: string
  contextVersion: number
  selectedNodeIds?: string[]
  constraints?: Record<string, unknown>
}

export type AiPlanPreview = {
  planId: string
  sessionId: string
  promptSummary: string
  intentType: AiIntentType
  proposedCommands: CadCommand[]
  affectedNodeIds: string[]
  warnings: AiPreviewDiagnostic[]
  explanation?: string
  validationErrors?: ValidationError[]
}

export type AiPlanStatus = 'pending' | 'generating' | 'preview-ready' | 'approved' | 'rejected' | 'failed'
