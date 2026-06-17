import React from "react";

// Catches errors thrown while loading/rendering lazy chunks (e.g. a stale
// "Failed to fetch dynamically imported module" that survived the auto-reload)
// so the app shows a recover button instead of a blank/broken page.
export class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(err: unknown) {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: unknown) {
    console.error("[ChunkErrorBoundary]", this.props.label ?? "", err);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-slate-950/80 px-6 text-center">
        <div className="text-sm font-bold text-slate-200">
          Couldn’t load the {this.props.label ?? "view"}.
        </div>
        <div className="max-w-md text-xs text-slate-400">
          This usually happens right after an update. Reloading fetches the latest version.
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-900 hover:bg-cyan-400"
        >
          Reload
        </button>
      </div>
    );
  }
}
