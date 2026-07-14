// Browsers fire pointermove far above frame rate; processing every raw event
// (raycast + snap + setState) forces a synchronous React re-render of the
// whole (already GPU-heavy) scene subtree per event — measured at ~70%
// main-thread blocking during continuous mouse movement. Coalesce to at most
// one processing pass per animation frame: stash the latest event, schedule a
// single rAF flush, drop any events that land before it fires (same visual
// result — only the intermediate positions are lost).
export function createPointerCoalescer(process: (event: PointerEvent) => void) {
  let pending: PointerEvent | null = null;
  let handle: number | null = null;

  return {
    push(event: PointerEvent) {
      pending = event;
      if (handle != null) return; // a flush is already scheduled
      handle = requestAnimationFrame(() => {
        handle = null;
        const ev = pending;
        pending = null;
        if (ev) process(ev);
      });
    },
    cancel() {
      if (handle != null) cancelAnimationFrame(handle);
      handle = null;
      pending = null;
    },
  };
}
