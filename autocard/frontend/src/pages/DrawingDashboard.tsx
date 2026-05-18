import { useState, useEffect } from "react";
import { useDrawingStore } from "../stores/drawingStore";
import { Drawing } from "../types";

interface DrawingDashboardProps {
  onNavigate: (target: string, id?: string) => void;
}

export default function DrawingDashboard({ onNavigate }: DrawingDashboardProps) {
  const { drawings, loading, error, fetchDrawings, createDrawing, deleteDrawing }: any =
    useDrawingStore();
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetchDrawings();
  }, [fetchDrawings]);

  const handleCreate = async () => {
    const name = newName.trim() || "Untitled";
    const drawing = await createDrawing(name);
    if (drawing) {
      setNewName("");
      onNavigate("editor", drawing.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-gray-900">AutoCard</h1>
            <span className="text-sm text-gray-500">My Drawings</span>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create new drawing */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            New Drawing
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Drawing name (optional)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Drawings grid */}
        {loading && drawings.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : drawings.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎨</div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No drawings yet
            </h3>
            <p className="text-gray-500">
              Create your first drawing to get started!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {drawings.map((d: Drawing) => (
              <div
                key={d.id}
                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => onNavigate("editor", d.id)}
                  className="w-full text-left p-6"
                >
                  <div className="h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-gray-400">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-gray-900 truncate">{d.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(d.updated_at!).toLocaleDateString()}
                  </p>
                </button>
                <div className="px-6 pb-4 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this drawing?")) deleteDrawing(d.id);
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}