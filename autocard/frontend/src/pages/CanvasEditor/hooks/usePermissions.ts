import { useCallback } from "react";
import { useDrawingStore } from "../../../stores/drawingStore";
import { BLOCK_CATALOG } from "../../../data/blockLibrary";
import type { DrawingElement } from "../../../types";

interface UsePermissionsOptions {
  currentDrawing: any;
  user: { id: string; email?: string } | null;
  permissions: Array<{ user_id: string; email?: string; role: string }>;
  storeInsertBlock: (id: string, x: number, y: number) => void;
  storeAddLayer: () => void;
  storeToggleLayerLock: (id: string) => void;
  storeDeleteLayer: (id: string) => void;
  storeRenameLayer: (id: string, name: string) => void;
  storeDuplicateLayer: (id: string) => void;
}

export function usePermissions({
  currentDrawing,
  user,
  permissions,
  storeInsertBlock,
  storeAddLayer,
  storeToggleLayerLock,
  storeDeleteLayer,
  storeRenameLayer,
  storeDuplicateLayer,
}: UsePermissionsOptions) {
  // Until both the drawing and the logged-in user have loaded, ownership is
  // unknown — don't flash "viewer"/Read Only at the actual owner. The server
  // still enforces real permissions on every write.
  const permissionsResolved = Boolean(currentDrawing && user);
  const isOwner = Boolean(currentDrawing && user && (currentDrawing.user?.id === user.id || (currentDrawing as any).user_id === user.id));
  const userPermission = permissions.find(
    (p) => p.user_id === user?.id || p.email === user?.email
  );
  const userRole: "owner" | "editor" | "viewer" = isOwner ? "owner" : (userPermission?.role as "owner" | "editor" | "viewer" || "viewer");
  const isReadOnly = permissionsResolved && userRole === "viewer";

  const insertBlock = useCallback((blockId: string, x: number, y: number) => {
    if (isReadOnly) return;
    const current = useDrawingStore.getState();
    if (!current.blockDefs[blockId]) {
      const catalogEntry = BLOCK_CATALOG.find((b) => b.id === blockId);
      if (catalogEntry) {
        useDrawingStore.setState((s) => ({
          blockDefs: {
            ...s.blockDefs,
            [blockId]: {
              id: blockId,
              name: catalogEntry.label,
              elements: catalogEntry.def.elements as DrawingElement[],
              insertionPoint: catalogEntry.def.insertionPoint,
            },
          },
        }));
      }
    }
    storeInsertBlock(blockId, x, y);
  }, [isReadOnly, storeInsertBlock]);

  const addLayer = useCallback(() => {
    if (isReadOnly) return;
    storeAddLayer();
  }, [storeAddLayer, isReadOnly]);

  const toggleLayerLock = useCallback((id: string) => {
    if (isReadOnly) return;
    storeToggleLayerLock(id);
  }, [storeToggleLayerLock, isReadOnly]);

  const deleteLayer = useCallback((id: string) => {
    if (isReadOnly) return;
    storeDeleteLayer(id);
  }, [storeDeleteLayer, isReadOnly]);

  const renameLayer = useCallback((id: string, name: string) => {
    if (isReadOnly) return;
    storeRenameLayer(id, name);
  }, [storeRenameLayer, isReadOnly]);

  const duplicateLayer = useCallback((id: string) => {
    if (isReadOnly) return;
    storeDuplicateLayer(id);
  }, [storeDuplicateLayer, isReadOnly]);

  return { isOwner, isReadOnly, userRole, insertBlock, addLayer, toggleLayerLock, deleteLayer, renameLayer, duplicateLayer };
}
