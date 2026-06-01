import type { StateCreator } from "zustand";
import { drawings as drawingsApi } from "../../api/client";
import type { Version, Comment, Permission } from "../../types";

export interface CollaborationSlice {
  versions: Version[];
  comments: Comment[];
  showComments: boolean;
  permissions: Permission[];
  showShareDialog: boolean;
  showVersionHistory: boolean;
  commentMode: boolean;
  fetchVersions(drawingId: string): Promise<void>;
  setShowVersionHistory(show: boolean): void;
  fetchComments(drawingId: string): Promise<void>;
  setShowComments(show: boolean): void;
  setCommentMode(mode: boolean): void;
  addComment(x: number, y: number, message: string, parentId?: string | null): Promise<void>;
  fetchPermissions(drawingId: string): Promise<void>;
  setShowShareDialog(show: boolean): void;
  shareDrawing(email: string, role: string): Promise<void>;
  removePermission(userId: string): Promise<void>;
}

export const createCollaborationSlice: StateCreator<CollaborationSlice & any, [], [], CollaborationSlice> = (set, get) => ({
  versions: [],
  comments: [],
  showComments: false,
  permissions: [],
  showShareDialog: false,
  showVersionHistory: false,
  commentMode: false,

  fetchVersions: async (drawingId) => {
    try {
      const versions = await drawingsApi.getVersions(drawingId);
      set({ versions });
    } catch (e: any) {
      // ignore
    }
  },

  setShowVersionHistory: (show) => set({ showVersionHistory: show }),

  fetchComments: async (drawingId) => {
    try {
      const comments = await drawingsApi.getComments(drawingId);
      set({ comments });
    } catch (e: any) {
      // ignore
    }
  },

  setShowComments: (show) => set({ showComments: show }),
  setCommentMode: (mode) => set({ commentMode: mode }),

  addComment: async (x, y, message, parentId = null) => {
    const { currentDrawingId } = get();
    if (!currentDrawingId) return;
    try {
      const comment = await drawingsApi.createComment(currentDrawingId, { x, y, message, parent_id: parentId });
      set((state: CollaborationSlice) => ({ comments: [...state.comments, comment] }));
    } catch (e: any) {
      // ignore
    }
  },

  fetchPermissions: async (drawingId) => {
    try {
      const permissions = await drawingsApi.getPermissions(drawingId);
      set({ permissions });
    } catch (e: any) {
      // ignore
    }
  },

  setShowShareDialog: (show) => set({ showShareDialog: show }),

  shareDrawing: async (email, role) => {
    const { currentDrawingId } = get();
    if (!currentDrawingId) return;
    try {
      await drawingsApi.share(currentDrawingId, { email, role });
      await get().fetchPermissions(currentDrawingId);
    } catch (e: any) {
      // ignore
    }
  },

  removePermission: async (userId) => {
    const { currentDrawingId } = get();
    if (!currentDrawingId) return;
    try {
      await drawingsApi.removePermission(currentDrawingId, userId);
      await get().fetchPermissions(currentDrawingId);
    } catch (e: any) {
      // ignore
    }
  },
});
