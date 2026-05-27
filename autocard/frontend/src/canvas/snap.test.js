import test from "node:test";
import assert from "node:assert";
import { findNearestSnap } from "./snap.js";
const allOff = {
    endpoint: false,
    midpoint: false,
    center: false,
    grid: false,
    intersection: false,
    nearest: false,
};
const nearestOnly = { ...allOff, nearest: true };
test("snapNearest: projects cursor onto a horizontal segment", () => {
    const elements = [
        { id: "1", type: "line", layerId: "0", x1: 0, y1: 0, x2: 100, y2: 0 },
    ];
    const result = findNearestSnap(elements, { x: 50, y: 20 }, nearestOnly, 30, 10);
    assert.ok(result, "expected a snap result");
    assert.strictEqual(result.type, "nearest");
    assert.ok(Math.abs(result.point.x - 50) < 0.01, `x should be 50, got ${result.point.x}`);
    assert.ok(Math.abs(result.point.y - 0) < 0.01, `y should be 0, got ${result.point.y}`);
});
test("snapNearest: picks the closest segment when two exist", () => {
    const elements = [
        { id: "near", type: "line", layerId: "0", x1: 0, y1: 5, x2: 100, y2: 5 },
        { id: "far", type: "line", layerId: "0", x1: 0, y1: 40, x2: 100, y2: 40 },
    ];
    // Cursor is close to the y=5 line
    const result = findNearestSnap(elements, { x: 50, y: 10 }, nearestOnly, 30, 10);
    assert.ok(result, "expected a snap result");
    assert.ok(Math.abs(result.point.y - 5) < 0.01, `should snap to y=5, got y=${result.point.y}`);
});
test("snapNearest: snaps to wall segments passed as optional parameter", () => {
    const elements = [];
    const wallSegments = [{ x1: 0, y1: 100, x2: 200, y2: 100 }];
    const result = findNearestSnap(elements, { x: 80, y: 115 }, nearestOnly, 30, 10, wallSegments);
    assert.ok(result, "expected a snap result from wall segment");
    assert.strictEqual(result.type, "nearest");
    assert.ok(Math.abs(result.point.y - 100) < 0.01, `should snap to y=100, got y=${result.point.y}`);
});
test("snapNearest: snaps to polyline edge", () => {
    const elements = [
        {
            id: "pl", type: "polyline", layerId: "0",
            points: [{ x: 0, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 150 }],
        },
    ];
    const result = findNearestSnap(elements, { x: 50, y: 65 }, nearestOnly, 30, 10);
    assert.ok(result, "expected a snap result");
    assert.ok(Math.abs(result.point.y - 50) < 0.01, `should snap to y=50 edge, got y=${result.point.y}`);
});
test("findNearestSnap: nearest=false suppresses nearest snap", () => {
    const elements = [
        { id: "1", type: "line", layerId: "0", x1: 0, y1: 0, x2: 100, y2: 0 },
    ];
    const result = findNearestSnap(elements, { x: 50, y: 15 }, allOff, 30, 10);
    assert.strictEqual(result, null, "should return null when all snap modes off");
});
test("findNearestSnap: nearest=true returns result when cursor is within threshold", () => {
    const elements = [
        { id: "1", type: "line", layerId: "0", x1: 0, y1: 0, x2: 100, y2: 0 },
    ];
    const result = findNearestSnap(elements, { x: 50, y: 10 }, nearestOnly, 30, 10);
    assert.ok(result, "expected snap result");
    assert.strictEqual(result.type, "nearest");
});
test("findNearestSnap: nearest=true returns null when cursor is beyond threshold", () => {
    const elements = [
        { id: "1", type: "line", layerId: "0", x1: 0, y1: 0, x2: 100, y2: 0 },
    ];
    const result = findNearestSnap(elements, { x: 50, y: 50 }, nearestOnly, 30, 10);
    assert.strictEqual(result, null, "should return null when beyond threshold");
});
