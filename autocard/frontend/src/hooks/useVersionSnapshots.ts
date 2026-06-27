import { useEffect, useCallback, useState } from "react";

export interface Snapshot {
  id: string;
  label: string;
  timestamp: number;
  data: string; // JSON-serialised elements array
}

const MAX_SNAPSHOTS = 20;
const AUTO_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function snapshotKey(drawingId: string) {
  return `arch-tech-snapshots-v1-${drawingId}`;
}

export function useVersionSnapshots(drawingId: string | null, elements: unknown[]) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  // Load from localStorage on drawingId change
  useEffect(() => {
    if (!drawingId) { setSnapshots([]); return; }
    try {
      const raw = localStorage.getItem(snapshotKey(drawingId));
      setSnapshots(raw ? (JSON.parse(raw) as Snapshot[]) : []);
    } catch { setSnapshots([]); }
  }, [drawingId]);

  const persist = useCallback((snaps: Snapshot[], id: string) => {
    try { localStorage.setItem(snapshotKey(id), JSON.stringify(snaps)); } catch {}
  }, []);

  // Auto-save every 5 minutes when there are elements
  useEffect(() => {
    if (!drawingId || elements.length === 0) return;
    const timer = setInterval(() => {
      const snap: Snapshot = {
        id: Date.now().toString(),
        label: `Auto ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`,
        timestamp: Date.now(),
        data: JSON.stringify(elements),
      };
      setSnapshots(prev => {
        const next = [snap, ...prev].slice(0, MAX_SNAPSHOTS);
        persist(next, drawingId);
        return next;
      });
    }, AUTO_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [drawingId, elements, persist]);

  /** Save a named snapshot immediately */
  const saveSnapshot = useCallback((label: string) => {
    if (!drawingId) return;
    const snap: Snapshot = {
      id: Date.now().toString(),
      label: label || `Snapshot ${new Date().toLocaleString("vi-VN")}`,
      timestamp: Date.now(),
      data: JSON.stringify(elements),
    };
    setSnapshots(prev => {
      const next = [snap, ...prev].slice(0, MAX_SNAPSHOTS);
      persist(next, drawingId);
      return next;
    });
  }, [drawingId, elements, persist]);

  /** Delete a snapshot by id */
  const deleteSnapshot = useCallback((id: string) => {
    if (!drawingId) return;
    setSnapshots(prev => {
      const next = prev.filter(s => s.id !== id);
      persist(next, drawingId);
      return next;
    });
  }, [drawingId, persist]);

  /** Restore elements from a snapshot — returns parsed elements or null */
  const getSnapshotData = useCallback((id: string): unknown[] | null => {
    const snap = snapshots.find(s => s.id === id);
    if (!snap) return null;
    try { return JSON.parse(snap.data) as unknown[]; } catch { return null; }
  }, [snapshots]);

  return { snapshots, saveSnapshot, deleteSnapshot, getSnapshotData };
}
