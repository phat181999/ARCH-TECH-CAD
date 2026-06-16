import test from "node:test";
import assert from "node:assert";
import { DXF_UNIT_MM, unitFactorToMm, insUnitsToUnit, type DxfUnit } from "./dxf.units.js";
import { parseDxfInsUnits } from "./dxf.js";

test("unitFactorToMm converts each unit to millimetres", () => {
  assert.equal(unitFactorToMm("mm"), 1);
  assert.equal(unitFactorToMm("cm"), 10);
  assert.equal(unitFactorToMm("m"), 1000);
  assert.ok(Math.abs(unitFactorToMm("in") - 25.4) < 1e-9);
  assert.ok(Math.abs(unitFactorToMm("ft") - 304.8) < 1e-9);
});

test("insUnitsToUnit maps DXF $INSUNITS codes", () => {
  assert.equal(insUnitsToUnit(4), "mm");
  assert.equal(insUnitsToUnit(5), "cm");
  assert.equal(insUnitsToUnit(6), "m");
  assert.equal(insUnitsToUnit(1), "in");
  assert.equal(insUnitsToUnit(2), "ft");
  assert.equal(insUnitsToUnit(0), null);   // unitless / unknown
  assert.equal(insUnitsToUnit(999), null); // unsupported
});

test("DXF_UNIT_MM is the default unit", () => {
  const u: DxfUnit = DXF_UNIT_MM;
  assert.equal(u, "mm");
});

test("parseDxfInsUnits reads $INSUNITS from the HEADER section", () => {
  const dxf = [
    "0", "SECTION", "2", "HEADER",
    "9", "$INSUNITS", "70", "6",   // 6 = metres
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES", "0", "ENDSEC", "0", "EOF",
  ].join("\r\n");
  assert.equal(parseDxfInsUnits(dxf), "m");
});

test("parseDxfInsUnits returns null when $INSUNITS absent", () => {
  const dxf = ["0", "SECTION", "2", "ENTITIES", "0", "ENDSEC", "0", "EOF"].join("\r\n");
  assert.equal(parseDxfInsUnits(dxf), null);
});
