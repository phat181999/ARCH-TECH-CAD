import React, { useEffect } from "react";
import { useDrawingStore } from "../stores/drawingStore";
import { drawings as drawingsApi } from "../api/client";

export default function VersionHistory() {
  const { versions, showVersionHistory, setShowVersionHistory, currentDrawingId, fetchVersions } = useDrawingStore();

  useEffect(() => {
    if (showVersionHistory && currentDrawingId) {
      fetchVersions(currentDrawingId);
    }
  }, [showVersionHistory, currentDrawingId, fetchVersions]);

  const handleRestore = async (version) => {
    try {
      const v = await drawingsApi.getVersion(currentDrawingId, version);
      if (v && v.data) {
        const parsed = JSON.parse(v.data);
        useDrawingStore.setState({
          elements: parsed.elements || [],
          blockDefs: parsed.blockDefs || {},
          measurements: parsed.measurements || [],
          constraints: parsed.constraints || [],
        });
      }
    } catch (e) {
      console.error("Failed to restore version:", e);
    }
  };

  if (!showVersionHistory) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowVersionHistory(false)}>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 w-96 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold">Version History</h3>
          <button onClick={() => setShowVersionHistory(false)} className="text-gray-400 hover:text-white text-lg">&times;</button>
        </div>
        {versions.length === 0 ? (
          <p className="text-gray-400 text-sm">No version history available.</p>
        ) : (
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="bg-gray-700 rounded p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">v{v.version}</span>
                  <span className="text-gray-400 text-xs">{new Date(v.created_at).toLocaleString()}</span>
                </div>
                <p className="text-gray-400 text-xs mt-1">by {v.created_by}</p>
                <button
                  onClick={() => handleRestore(v.version)}
                  className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
