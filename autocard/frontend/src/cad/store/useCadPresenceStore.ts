import { create } from 'zustand'
import type { Point } from '../contracts/document'
import type { EditClaim } from '../contracts/collaboration'

export type RemoteUser = {
  userId: string
  username: string
  cursor?: Point
  viewportCenter?: Point
  viewportZoom?: number
  selectedNodeIds?: string[]
  color: string
}

type CadPresenceStore = {
  connected: boolean
  sessionId: string | null
  localUserId: string | null
  remoteUsers: Record<string, RemoteUser>
  editClaims: Record<string, EditClaim>

  setConnected: (connected: boolean, sessionId?: string) => void
  setLocalUser: (userId: string) => void
  updateRemoteUser: (userId: string, data: Partial<RemoteUser>) => void
  removeRemoteUser: (userId: string) => void
  claimEdit: (claim: EditClaim) => void
  releaseEdit: (nodeId: string) => void
  isClaimedByOther: (nodeId: string) => boolean
}

const USER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8']

export const useCadPresenceStore = create<CadPresenceStore>((set, get) => ({
  connected: false,
  sessionId: null,
  localUserId: null,
  remoteUsers: {},
  editClaims: {},

  setConnected: (connected, sessionId) => set({ connected, sessionId: sessionId ?? null }),
  setLocalUser: (userId) => set({ localUserId: userId }),

  updateRemoteUser: (userId, data) => set((s) => {
    const existing = s.remoteUsers[userId]
    const colorIndex = Object.keys(s.remoteUsers).length % USER_COLORS.length
    return {
      remoteUsers: {
        ...s.remoteUsers,
        [userId]: { ...existing, userId, color: existing?.color ?? USER_COLORS[colorIndex], ...data },
      },
    }
  }),

  removeRemoteUser: (userId) => set((s) => {
    const users = { ...s.remoteUsers }
    delete users[userId]
    return { remoteUsers: users }
  }),

  claimEdit: (claim) => set((s) => ({ editClaims: { ...s.editClaims, [claim.nodeId]: claim } })),

  releaseEdit: (nodeId) => set((s) => {
    const claims = { ...s.editClaims }
    delete claims[nodeId]
    return { editClaims: claims }
  }),

  isClaimedByOther: (nodeId) => {
    const { editClaims, localUserId } = get()
    const claim = editClaims[nodeId]
    return !!claim && claim.userId !== localUserId
  },
}))
