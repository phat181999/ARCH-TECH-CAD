import { useState, useEffect, useRef, useCallback } from "react";
import { drawings, type BIMResult } from "../api/client";

type AnalysisStatus = "idle" | "pending" | "running" | "done" | "error";

export function useAnalysisJob(drawingId: string | null) {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [result, setResult] = useState<BIMResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const loadResult = useCallback(async (id: string) => {
    try {
      const bim = await drawings.getAnalysisResult(id);
      setResult(bim);
    } catch {
      // result not ready yet — ignore
    }
  }, []);

  const poll = useCallback(async (id: string) => {
    try {
      const job = await drawings.getAnalysisStatus(id);
      setStatus(job.status as AnalysisStatus);
      if (job.status === "done") {
        stopPolling();
        await loadResult(id);
      } else if (job.status === "error") {
        stopPolling();
        setError(job.error ?? "Analysis failed");
      }
    } catch {
      stopPolling();
      setStatus("idle");
    }
  }, [stopPolling, loadResult]);

  const start = useCallback(async () => {
    if (!drawingId) return;
    setStatus("pending");
    setResult(null);
    setError(null);
    try {
      await drawings.analyzeDrawing(drawingId);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to start analysis");
      return;
    }
    intervalRef.current = setInterval(() => poll(drawingId), 3000);
  }, [drawingId, poll]);

  // On mount or drawing change: check if there's already a result
  useEffect(() => {
    if (!drawingId) return;
    loadResult(drawingId);
    return () => stopPolling();
  }, [drawingId, loadResult, stopPolling]);

  return { status, result, error, start };
}
