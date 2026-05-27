import { create } from 'zustand'
import type { PreviewNode } from '../contracts/events'
import type { AiPreviewDiagnostic } from '../contracts/ai'
import type { CadCommand } from '../contracts/commands'
import type { CreateNodeCommand } from '../contracts/commands'
import { cadBus } from '../core/events/bus'
const nanoid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

type AiPreviewStatus = 'idle' | 'streaming' | 'complete' | 'failed'

type AiPreviewStore = {
  sessionId: string | null
  previewNodes: PreviewNode[]
  diagnostics: AiPreviewDiagnostic[]
  status: AiPreviewStatus
  planText: string

  startSession: () => string
  streamPreviewNode: (node: PreviewNode) => void
  appendPlanText: (text: string) => void
  addDiagnostic: (d: AiPreviewDiagnostic) => void
  completePreview: (sessionId: string) => void
  failPreview: (message: string) => void
  acceptDraft: (layerId?: string) => CadCommand[]
  discardDraft: () => void
}

function previewNodeToCommand(node: PreviewNode, defaultLayerId: string): CreateNodeCommand {
  const geo = node.geometry as Record<string, unknown>
  return {
    id: `cmd-accept-${node.previewId}`,
    type: 'create-node',
    actor: { userId: 'local', type: 'user-ai-assisted', sessionId: node.sessionId },
    timestamp: Date.now(),
    node: {
      id: `node-${node.previewId}`,
      type: node.nodeType,
      parentId: null,
      visible: true,
      locked: false,
      layerId: node.layerId ?? defaultLayerId,
      ...geo,
    } as any,
  }
}

export const useAiPreviewStore = create<AiPreviewStore>((set, get) => ({
  sessionId: null,
  previewNodes: [],
  diagnostics: [],
  status: 'idle',
  planText: '',

  startSession: () => {
    const id = nanoid()
    set({ sessionId: id, previewNodes: [], diagnostics: [], status: 'streaming', planText: '' })
    cadBus.emit('cad:ai:preview:started', { sessionId: id })
    return id
  },

  streamPreviewNode: (node) => {
    set((s) => ({ previewNodes: [...s.previewNodes.filter(n => n.previewId !== node.previewId), node] }))
    cadBus.emit('cad:ai:preview:node', { sessionId: node.sessionId, node })
  },

  appendPlanText: (text) => set((s) => ({ planText: s.planText + text })),

  addDiagnostic: (d) => set((s) => ({ diagnostics: [...s.diagnostics, d] })),

  completePreview: (sessionId) => {
    set({ status: 'complete' })
    cadBus.emit('cad:ai:preview:complete', { sessionId })
  },

  failPreview: (message) => {
    set({ status: 'failed' })
    cadBus.emit('cad:ai:preview:failed', { message })
  },

  acceptDraft: (layerId = 'A-WALL') => {
    const { previewNodes, sessionId } = get()
    const commands: CadCommand[] = previewNodes.map(n => previewNodeToCommand(n, layerId))
    cadBus.emit('cad:ai:draft:accepted', { commands })
    set({ previewNodes: [], status: 'idle', sessionId: null, planText: '' })
    return commands
  },

  discardDraft: () => {
    const { sessionId } = get()
    cadBus.emit('cad:ai:draft:discarded', { sessionId: sessionId ?? '' })
    set({ previewNodes: [], diagnostics: [], status: 'idle', sessionId: null, planText: '' })
  },
}))
