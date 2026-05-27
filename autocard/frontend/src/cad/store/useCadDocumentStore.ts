import { create } from 'zustand'
import type { CadDocument, DerivedDocumentState } from '../contracts/document'
import type { CadNode } from '../contracts/nodes'
import type { PatchSet } from '../contracts/patches'

type CadDocumentStore = {
  document: CadDocument | null
  activeVersion: number
  dirtyNodeIds: Set<string>
  localChangeQueue: PatchSet[]

  setDocument: (doc: CadDocument) => void
  updateNode: (nodeId: string, changes: Partial<CadNode>) => void
  addNode: (node: CadNode) => void
  removeNode: (nodeId: string) => void
  updateDerived: (derived: Partial<DerivedDocumentState>) => void
  markDirty: (nodeIds: string[]) => void
  clearDirty: () => void
  enqueueLocalChange: (patch: PatchSet) => void
  flushLocalChanges: () => PatchSet[]
  setActiveVersion: (version: number) => void
}

export const useCadDocumentStore = create<CadDocumentStore>((set, get) => ({
  document: null,
  activeVersion: 0,
  dirtyNodeIds: new Set(),
  localChangeQueue: [],

  setDocument: (doc) => set({ document: doc, activeVersion: doc.schemaVersion, dirtyNodeIds: new Set() }),

  updateNode: (nodeId, changes) => set((state) => {
    if (!state.document) return state
    const existing = state.document.nodes[nodeId]
    if (!existing) return state
    return {
      document: {
        ...state.document,
        nodes: { ...state.document.nodes, [nodeId]: { ...existing, ...changes } as CadNode },
      },
      dirtyNodeIds: new Set([...state.dirtyNodeIds, nodeId]),
    }
  }),

  addNode: (node) => set((state) => {
    if (!state.document) return state
    return {
      document: {
        ...state.document,
        nodes: { ...state.document.nodes, [node.id]: node },
        roots: state.document.roots.includes(node.id) ? state.document.roots : [...state.document.roots, node.id],
      },
      dirtyNodeIds: new Set([...state.dirtyNodeIds, node.id]),
    }
  }),

  removeNode: (nodeId) => set((state) => {
    if (!state.document) return state
    const nodes = { ...state.document.nodes }
    delete nodes[nodeId]
    return {
      document: {
        ...state.document,
        nodes,
        roots: state.document.roots.filter(id => id !== nodeId),
      },
      dirtyNodeIds: new Set([...state.dirtyNodeIds, nodeId]),
    }
  }),

  updateDerived: (derived) => set((state) => {
    if (!state.document) return state
    return {
      document: {
        ...state.document,
        derived: { ...state.document.derived, ...derived } as DerivedDocumentState,
      },
    }
  }),

  markDirty: (nodeIds) => set((state) => ({
    dirtyNodeIds: new Set([...state.dirtyNodeIds, ...nodeIds]),
  })),

  clearDirty: () => set({ dirtyNodeIds: new Set() }),

  enqueueLocalChange: (patch) => set((state) => ({
    localChangeQueue: [...state.localChangeQueue, patch],
  })),

  flushLocalChanges: () => {
    const queue = get().localChangeQueue
    set({ localChangeQueue: [] })
    return queue
  },

  setActiveVersion: (version) => set({ activeVersion: version }),
}))
