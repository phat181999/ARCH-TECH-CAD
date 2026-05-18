import React from "react";
import { useDrawingStore } from "../stores/drawingStore";

export default function MeasurementTool(): React.ReactElement {
  const { measurementMode, setMeasurementMode, measurements, clearMeasurements } = useDrawingStore();

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-slate-900 dark:text-white text-sm">
      <h3 className="font-semibold mb-2 text-blue-400">Measurement</h3>
      <div className="flex flex-wrap gap-1 mb-2">
        <button
          onClick={() => setMeasurementMode(measurementMode === "distance" ? null : "distance")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            measurementMode === "distance"
              ? "bg-blue-600 text-slate-900 dark:text-white"
              : "bg-gray-700 text-slate-700 dark:text-gray-300 hover:bg-gray-600"
          }`}
          title="Measure distance"
        >
          📏 Distance
        </button>
        <button
          onClick={() => setMeasurementMode(measurementMode === "angle" ? null : "angle")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            measurementMode === "angle"
              ? "bg-blue-600 text-slate-900 dark:text-white"
              : "bg-gray-700 text-slate-700 dark:text-gray-300 hover:bg-gray-600"
          }`}
          title="Measure angle"
        >
          📐 Angle
        </button>
        <button
          onClick={() => setMeasurementMode(measurementMode === "area" ? null : "area")}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            measurementMode === "area"
              ? "bg-blue-600 text-slate-900 dark:text-white"
              : "bg-gray-700 text-slate-700 dark:text-gray-300 hover:bg-gray-600"
          }`}
          title="Measure area"
        >
          ⬡ Area
        </button>
      </div>
      {measurementMode && (
        <p className="text-xs text-yellow-400 mb-2">
          {measurementMode === "distance" && "Click two points to measure distance"}
          {measurementMode === "angle" && "Click three points to measure angle"}
          {measurementMode === "area" && "Click points to define polygon, click near first point to close"}
        </p>
      )}
      {measurements.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Results:</span>
            <button onClick={clearMeasurements} className="text-xs text-red-400 hover:text-red-300">
              Clear all
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {measurements.map((m) => (
              <div key={m.id} className="bg-gray-700 rounded px-2 py-1 text-xs flex items-center gap-2">
                <span className="text-gray-400">
                  {m.type === "distance" && "📏"}
                  {m.type === "angle" && "📐"}
                  {m.type === "area" && "⬡"}
                </span>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
