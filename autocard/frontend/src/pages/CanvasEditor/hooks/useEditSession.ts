import { useRef, useCallback } from "react";

export function useEditSession(drawingId: string | null, token: string | null) {
  const pendingActionsRef = useRef<object[]>([]);
  const editFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editSessionIdRef = useRef<string | null>(null);

  const queueEditAction = useCallback((action: object) => {
    if (!drawingId || !token) return;
    pendingActionsRef.current.push(action);
    if (editFlushTimer.current) clearTimeout(editFlushTimer.current);
    editFlushTimer.current = setTimeout(() => {
      if (!drawingId || pendingActionsRef.current.length === 0) return;
      const actions = pendingActionsRef.current.splice(0);
      fetch(`/api/rag/projects/${drawingId}/edits`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: editSessionIdRef.current, actions }),
      })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.session_id) editSessionIdRef.current = data.session_id;
        })
        .catch(() => {});
    }, 2000);
  }, [drawingId, token]);

  return { queueEditAction };
}
