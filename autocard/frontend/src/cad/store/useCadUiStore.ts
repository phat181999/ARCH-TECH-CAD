import { create } from 'zustand'

type PanelId =
  | 'layers'
  | 'properties'
  | 'ai-assistant'
  | 'comments'
  | 'version-history'
  | 'sheets'
  | 'blocks'
  | 'styles'

type CadUiStore = {
  openPanels: Set<PanelId>
  activePanelId: PanelId | null
  shareModalOpen: boolean
  aiPreviewVisible: boolean
  aiPlanText: string
  commentModeActive: boolean
  commandLineVisible: boolean
  commandLineInput: string

  openPanel: (id: PanelId) => void
  closePanel: (id: PanelId) => void
  togglePanel: (id: PanelId) => void
  setActivePanel: (id: PanelId | null) => void
  isPanelOpen: (id: PanelId) => boolean
  setShareModalOpen: (open: boolean) => void
  setAiPreviewVisible: (visible: boolean) => void
  setAiPlanText: (text: string) => void
  setCommentMode: (active: boolean) => void
  setCommandLineVisible: (visible: boolean) => void
  setCommandLineInput: (input: string) => void
}

export const useCadUiStore = create<CadUiStore>((set, get) => ({
  openPanels: new Set<PanelId>(['layers', 'properties']),
  activePanelId: null,
  shareModalOpen: false,
  aiPreviewVisible: false,
  aiPlanText: '',
  commentModeActive: false,
  commandLineVisible: true,
  commandLineInput: '',

  openPanel:    (id) => set((s) => ({ openPanels: new Set([...s.openPanels, id]) })),
  closePanel:   (id) => set((s) => { const p = new Set(s.openPanels); p.delete(id); return { openPanels: p } }),
  togglePanel:  (id) => get().isPanelOpen(id) ? get().closePanel(id) : get().openPanel(id),
  setActivePanel: (id) => set({ activePanelId: id }),
  isPanelOpen:  (id) => get().openPanels.has(id),

  setShareModalOpen:  (open)    => set({ shareModalOpen: open }),
  setAiPreviewVisible: (visible) => set({ aiPreviewVisible: visible }),
  setAiPlanText:      (text)    => set({ aiPlanText: text }),
  setCommentMode:     (active)  => set({ commentModeActive: active }),
  setCommandLineVisible: (v)    => set({ commandLineVisible: v }),
  setCommandLineInput:   (i)    => set({ commandLineInput: i }),
}))
