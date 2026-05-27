import { create } from 'zustand'
import type { CadCommand } from '../contracts/commands'
import type { CadDocument } from '../contracts/document'

type HistoryEntry = {
  command: CadCommand
  docBefore: CadDocument
  docAfter: CadDocument
}

type GroupBoundary = { type: 'group-start' | 'group-end'; label?: string }

type HistoryItem = HistoryEntry | GroupBoundary

type CadHistoryStore = {
  undoStack: HistoryItem[]
  redoStack: HistoryItem[]
  groupDepth: number

  pushCommand: (entry: HistoryEntry) => void
  undo: () => HistoryEntry | null
  redo: () => HistoryEntry | null
  beginGroup: (label?: string) => void
  endGroup: () => void
  clearRedo: () => void
  clearAll: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

export const useCadHistoryStore = create<CadHistoryStore>((set, get) => ({
  undoStack: [],
  redoStack: [],
  groupDepth: 0,

  pushCommand: (entry) => set((state) => ({
    undoStack: [...state.undoStack, entry],
    redoStack: [],
  })),

  undo: () => {
    const { undoStack } = get()
    if (undoStack.length === 0) return null
    const last = undoStack[undoStack.length - 1]
    if ('type' in last && (last.type === 'group-start' || last.type === 'group-end')) {
      set((state) => ({ undoStack: state.undoStack.slice(0, -1) }))
      return null
    }
    const entry = last as HistoryEntry
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
    }))
    return entry
  },

  redo: () => {
    const { redoStack } = get()
    if (redoStack.length === 0) return null
    const last = redoStack[redoStack.length - 1]
    if ('type' in last && (last.type === 'group-start' || last.type === 'group-end')) {
      set((state) => ({ redoStack: state.redoStack.slice(0, -1) }))
      return null
    }
    const entry = last as HistoryEntry
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, entry],
    }))
    return entry
  },

  beginGroup: (label) => set((state) => ({
    undoStack: [...state.undoStack, { type: 'group-start', label }],
    groupDepth: state.groupDepth + 1,
  })),

  endGroup: () => set((state) => ({
    undoStack: [...state.undoStack, { type: 'group-end' }],
    groupDepth: Math.max(0, state.groupDepth - 1),
  })),

  clearRedo: () => set({ redoStack: [] }),
  clearAll:  () => set({ undoStack: [], redoStack: [], groupDepth: 0 }),
  canUndo:   () => get().undoStack.length > 0,
  canRedo:   () => get().redoStack.length > 0,
}))
