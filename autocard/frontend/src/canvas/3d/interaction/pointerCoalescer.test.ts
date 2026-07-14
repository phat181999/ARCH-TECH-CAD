import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPointerCoalescer } from "./pointerCoalescer";

// Node test environment has no rAF: stub it to capture callbacks so the test
// controls exactly when a "frame" fires.
let rafCallbacks: Map<number, FrameRequestCallback>;
let nextHandle: number;

beforeEach(() => {
  rafCallbacks = new Map();
  nextHandle = 1;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback): number => {
    const h = nextHandle++;
    rafCallbacks.set(h, cb);
    return h;
  });
  vi.stubGlobal("cancelAnimationFrame", (h: number): void => {
    rafCallbacks.delete(h);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function flushFrame() {
  const cbs = [...rafCallbacks.values()];
  rafCallbacks.clear();
  for (const cb of cbs) cb(0);
}

const fakeEvent = (clientX: number) => ({ clientX }) as unknown as PointerEvent;

describe("createPointerCoalescer", () => {
  it("coalesces a burst of events before a flush into exactly one processing pass with the latest event", () => {
    const process = vi.fn();
    const coalescer = createPointerCoalescer(process);

    const events = [1, 2, 3, 4, 5].map(fakeEvent);
    for (const ev of events) coalescer.push(ev);

    // Nothing processed until the frame fires, and only ONE flush scheduled.
    expect(process).not.toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(1);

    flushFrame();
    expect(process).toHaveBeenCalledTimes(1);
    expect(process).toHaveBeenCalledWith(events[4]);
  });

  it("processes a new burst after a flush (one pass per frame, not one ever)", () => {
    const process = vi.fn();
    const coalescer = createPointerCoalescer(process);

    coalescer.push(fakeEvent(1));
    flushFrame();
    coalescer.push(fakeEvent(2));
    coalescer.push(fakeEvent(3));
    flushFrame();

    expect(process).toHaveBeenCalledTimes(2);
    expect(process).toHaveBeenNthCalledWith(1, fakeEvent(1));
    expect(process).toHaveBeenNthCalledWith(2, fakeEvent(3));
  });

  it("cancel() drops the pending event and the scheduled flush", () => {
    const process = vi.fn();
    const coalescer = createPointerCoalescer(process);

    coalescer.push(fakeEvent(1));
    coalescer.cancel();
    flushFrame();

    expect(process).not.toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(0);
  });
});
