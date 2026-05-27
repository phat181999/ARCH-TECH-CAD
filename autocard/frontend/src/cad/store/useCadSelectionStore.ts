import { create } from 'zustand'
import type { Point } from '../contracts/document'

type HandleInfo = {
  nodeId: string
  handleType: 'endpoint' | 'midpoint' | 'center' | 'corner' | 'edge'
  index?: number
  position: Point
}

type CadSelectionStore = {
  selectedNodeIds: string[]
  hoveredNodeId: string | null
  activeHandles: HandleInfo[]

  select: (nodeIds: string[]) => void
  addToSelection: (nodeIds: string[]) => void
  deselect: (nodeIds: string[]) => void
  clearSelection: () => void
  setHovered: (nodeId: string | null) => void
  setActiveHandles: (handles: HandleInfo[]) => void
  isSelected: (nodeId: string) => boolean
}

export const useCadSelectionStore = create<CadSelectionStore>((set, get) => ({
  selectedNodeIds: [],
  hoveredNodeId: null,
  activeHandles: [],

  select:           (nodeIds) => set({ selectedNodeIds: nodeIds }),
  addToSelection:   (nodeIds) => set((s) => ({ selectedNodeIds: [...new Set([...s.selectedNodeIds, ...nodeIds])] })),
  deselect:         (nodeIds) => set((s) => ({ selectedNodeIds: s.selectedNodeIds.filter(id => !nodeIds.includes(id)) })),
  clearSelection:   ()        => set({ selectedNodeIds: [], activeHandles: [] }),
  setHovered:       (nodeId)  => set({ hoveredNodeId: nodeId }),
  setActiveHandles: (handles) => set({ activeHandles: handles }),
  isSelected:       (nodeId)  => get().selectedNodeIds.includes(nodeId),
}))
