import type { RemoteCursor } from "../hooks/useCursorPresence";

interface Props {
  cursors: Record<string, RemoteCursor>;
  /** DOMRect of the canvas container — used to translate absolute coords to relative */
  canvasRect: DOMRect | null;
}

/**
 * Renders other users' cursor positions as overlays on the 2D canvas.
 * Position the parent container as `relative` and this as `absolute inset-0`.
 */
export function CursorOverlay({ cursors, canvasRect }: Props) {
  if (!canvasRect) return null;
  const entries = Object.values(cursors);
  if (entries.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {entries.map(c => {
        const left = c.x - canvasRect.left;
        const top  = c.y - canvasRect.top;
        return (
          <div key={c.userId} className="absolute" style={{ left, top }}>
            {/* Arrow cursor */}
            <svg width="16" height="20" viewBox="0 0 16 20" className="drop-shadow">
              <path
                d="M0 0 L0 16 L4 12 L7 18 L9 17 L6 11 L12 11 Z"
                fill={c.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* Name badge */}
            <div
              className="absolute left-4 top-0 px-1.5 py-0.5 rounded text-[9px] font-bold text-white whitespace-nowrap shadow"
              style={{ backgroundColor: c.color }}
            >
              {c.username}
            </div>
          </div>
        );
      })}
    </div>
  );
}
