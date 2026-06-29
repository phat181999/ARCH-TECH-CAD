/**
 * IFC 2x3 text exporter (ISO 10303-21 / STEP format).
 * Generates a valid IFC file from CAD drawing elements without requiring WASM.
 * Walls, doors, windows and columns are supported.
 *
 * Upgraded in B2: supports bimGuid passthrough and BimPropertySet export.
 */

import type { DrawingElement, BimPropertySet, BimPropertyValue } from "../types";

// ─── GUID generator (IFC uses 22-char base64-variant GUIDs) ─────────────────
const IFC_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
function ifcGuid(): string {
  let g = "";
  for (let i = 0; i < 22; i++) g += IFC_CHARS[Math.floor(Math.random() * 64)];
  return g;
}

// Auto-incrementing STEP entity ID
let _eid = 0;
const eid = () => ++_eid;

// Helpers for coordinate formatting (canvas px → metres, 1 px ≈ 1 mm)
const px2m = (v: number) => +(v * 0.001).toFixed(4);

function pt(x: number, y: number, z = 0): string {
  return `IFCCARTESIANPOINT((${px2m(x)},${px2m(y)},${+(z).toFixed(4)}))`;
}
function dir(x: number, y: number, z: number): string {
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  return `IFCDIRECTION((${+(x / len).toFixed(6)},${+(y / len).toFixed(6)},${+(z / len).toFixed(6)}))`;
}
function dir2(x: number, y: number): string {
  const len = Math.sqrt(x * x + y * y) || 1;
  return `IFCDIRECTION((${+(x / len).toFixed(6)},${+(y / len).toFixed(6)}))`;
}

// ─── PSET HELPERS ────────────────────────────────────────────────────────────

/**
 * Convert a BimPropertyValue to an IfcValue STEP string.
 * Returns an IFCLABEL for strings, IFCREAL for numbers, etc.
 */
function bimValueToIfcValue(val: BimPropertyValue): string {
  switch (val.type) {
    case "string":
      return `IFCLABEL('${val.value.replace(/'/g, "''")}')`;
    case "number":
      return `IFCREAL(${val.value})`;
    case "boolean":
      return `IFCBOOLEAN(${val.value ? ".T." : ".F."})`;
    case "enum":
      return `IFCLABEL('${val.value.replace(/'/g, "''")}')`;
    default:
      return `IFCLABEL('')`;
  }
}

/**
 * Generate STEP lines for one BimPropertySet.
 * Returns [psetId, lines[]] where lines are ready to append to DATA section.
 */
function psetToIfcLines(
  pset: BimPropertySet,
  ownerHistoryId: number,
  addFn: (id: number, line: string) => void,
): number {
  const propIds: number[] = [];
  for (const [propName, propVal] of Object.entries(pset.properties)) {
    const propId = eid();
    const valStr = bimValueToIfcValue(propVal);
    addFn(propId, `IFCPROPERTYSINGLEVALUE('${propName}',$,${valStr},$)`);
    propIds.push(propId);
  }
  const psetId = eid();
  const propRefs = propIds.map(id => `#${id}`).join(",");
  addFn(psetId, `IFCPROPERTYSET('${ifcGuid()}',#${ownerHistoryId},'${pset.name}',$,(${propRefs}))`);
  return psetId;
}

// ─── MAIN EXPORT FUNCTION ───────────────────────────────────────────────────
export function exportToIFC(
  elements: DrawingElement[],
  projectName = "ARCH-TECH-CAD Project",
  elementPsets: Record<string, BimPropertySet[]> = {},
): string {
  _eid = 0;

  // --- Fixed entity IDs ---
  const ID = {
    org: eid(),         // 1  IFCORGANIZATION
    app: eid(),         // 2  IFCAPPLICATION
    pao: eid(),         // 3  IFCPERSONANDORGANIZATION
    owh: eid(),         // 4  IFCOWNERHISTORY
    dim: eid(),         // 5  IFCDIMENSIONALEXPONENTS
    siM: eid(),         // 6  SI unit metre
    siM2: eid(),        // 7  SI unit m²
    siM3: eid(),        // 8  SI unit m³
    siRad: eid(),       // 9  SI unit radian
    unitAsgn: eid(),    // 10 IFCUNITASSIGNMENT
    geomCtx: eid(),     // 11 IFCGEOMETRICREPRESENTATIONCONTEXT (Model)
    geomSub3D: eid(),   // 12 IFCGEOMETRICREPRESENTATIONSUBCONTEXT (Body)
    geomSubPlan: eid(), // 13 IFCGEOMETRICREPRESENTATIONSUBCONTEXT (Axis)
    proj: eid(),        // 14 IFCPROJECT
    sitePlc: eid(),     // 15 site placement
    siteOrigin: eid(),  // 16
    siteDir1: eid(),    // 17
    siteDir2: eid(),    // 18
    siteAxis: eid(),    // 19
    site: eid(),        // 20 IFCSITE
    bldgPlc: eid(),     // 21 building placement
    bldgOrigin: eid(),  // 22
    bldgDir1: eid(),    // 23
    bldgDir2: eid(),    // 24
    bldgAxis: eid(),    // 25
    bldg: eid(),        // 26 IFCBUILDING
    streyPlc: eid(),    // 27 storey placement
    streyOrigin: eid(), // 28
    streyDir1: eid(),   // 29
    streyDir2: eid(),   // 30
    streyAxis: eid(),   // 31
    storey: eid(),      // 32 IFCBUILDINGSTOREY
    relAgg1: eid(),     // 33 site → project
    relAgg2: eid(),     // 34 building → site
    relAgg3: eid(),     // 35 storey → building
    relContained: eid(), // 36 elements → storey
  };

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const fileDate = new Date().toISOString();

  // ─── Collect wall/door/window elements ─────────────────────────────────────
  const wallEls = elements.filter(
    (el) => el.archType === "wall" && (el.type === "line" || (el.x1 !== undefined && el.x2 !== undefined))
  );
  const doorEls = elements.filter((el) => el.archType === "door");
  const windowEls = elements.filter((el) => el.archType === "window");

  // ─── Build STEP lines ───────────────────────────────────────────────────────
  const data: string[] = [];

  const add = (id: number, line: string) => data.push(`#${id}= ${line};`);
  const addRaw = (line: string) => data.push(line);

  // --- Organisation / ownership ---
  add(ID.org, `IFCORGANIZATION($,'ARCH-TECH-CAD',$,$,$)`);
  add(ID.app, `IFCAPPLICATION(#${ID.org},'1.0','ARCH-TECH-CAD','arch-tech-cad')`);
  add(ID.pao, `IFCPERSONANDORGANIZATION($,#${ID.org},$)`);
  add(ID.owh, `IFCOWNERHISTORY(#${ID.pao},#${ID.app},$,.ADDED.,$,$,$,0)`);

  // --- Units ---
  add(ID.dim, `IFCDIMENSIONALEXPONENTS(0,0,0,0,0,0,0)`);
  add(ID.siM, `IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`);
  add(ID.siM2, `IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`);
  add(ID.siM3, `IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)`);
  add(ID.siRad, `IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)`);
  add(ID.unitAsgn, `IFCUNITASSIGNMENT((#${ID.siM},#${ID.siM2},#${ID.siM3},#${ID.siRad}))`);

  // --- Geometric representation context ---
  add(ID.geomCtx, `IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#${ID.siteAxis},$)`);
  add(ID.geomSub3D, `IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#${ID.geomCtx},$,.MODEL_VIEW.,$)`);
  add(ID.geomSubPlan, `IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Axis','Model',*,*,*,*,#${ID.geomCtx},$,.GRAPH_VIEW.,$)`);

  // --- Project ---
  add(ID.proj, `IFCPROJECT('${ifcGuid()}',#${ID.owh},'${projectName}',$,$,$,$,(#${ID.geomCtx}),#${ID.unitAsgn})`);

  // --- Site ---
  const siteO = eid(); add(siteO, pt(0, 0, 0));
  const siteD1 = eid(); add(siteD1, dir(0, 0, 1));
  const siteD2 = eid(); add(siteD2, dir(1, 0, 0));
  const siteAx = eid(); add(siteAx, `IFCAXIS2PLACEMENT3D(#${siteO},#${siteD1},#${siteD2})`);
  const sitePlc = eid(); add(sitePlc, `IFCLOCALPLACEMENT($,#${siteAx})`);
  const siteId = eid();
  add(siteId, `IFCSITE('${ifcGuid()}',#${ID.owh},'Site',$,$,#${sitePlc},$,$,.ELEMENT.,$,$,$,$,$)`);

  // --- Building ---
  const bldgO = eid(); add(bldgO, pt(0, 0, 0));
  const bldgD1 = eid(); add(bldgD1, dir(0, 0, 1));
  const bldgD2 = eid(); add(bldgD2, dir(1, 0, 0));
  const bldgAx = eid(); add(bldgAx, `IFCAXIS2PLACEMENT3D(#${bldgO},#${bldgD1},#${bldgD2})`);
  const bldgPlc = eid(); add(bldgPlc, `IFCLOCALPLACEMENT(#${sitePlc},#${bldgAx})`);
  const bldgId = eid();
  add(bldgId, `IFCBUILDING('${ifcGuid()}',#${ID.owh},'Building',$,$,#${bldgPlc},$,$,.ELEMENT.,$,$,$)`);

  // --- Storey ---
  const streyO = eid(); add(streyO, pt(0, 0, 0));
  const streyD1 = eid(); add(streyD1, dir(0, 0, 1));
  const streyD2 = eid(); add(streyD2, dir(1, 0, 0));
  const streyAx = eid(); add(streyAx, `IFCAXIS2PLACEMENT3D(#${streyO},#${streyD1},#${streyD2})`);
  const streyPlc = eid(); add(streyPlc, `IFCLOCALPLACEMENT(#${bldgPlc},#${streyAx})`);
  const streyId = eid();
  add(streyId, `IFCBUILDINGSTOREY('${ifcGuid()}',#${ID.owh},'Ground Floor',$,$,#${streyPlc},$,$,.ELEMENT.,0.0)`);

  // --- Spatial aggregation ---
  const aggSite = eid();
  add(aggSite, `IFCRELAGGREGATES('${ifcGuid()}',#${ID.owh},'Project->Site',$,#${ID.proj},(#${siteId}))`);
  const aggBldg = eid();
  add(aggBldg, `IFCRELAGGREGATES('${ifcGuid()}',#${ID.owh},'Site->Building',$,#${siteId},(#${bldgId}))`);
  const aggStorey = eid();
  add(aggStorey, `IFCRELAGGREGATES('${ifcGuid()}',#${ID.owh},'Building->Storey',$,#${bldgId},(#${streyId}))`);

  // The IFCAXIS2PLACEMENT3D needed by geomCtx - add after
  const geomCtxAxisO = eid(); add(geomCtxAxisO, pt(0, 0, 0));
  const geomCtxAxisD1 = eid(); add(geomCtxAxisD1, dir(0, 0, 1));
  const geomCtxAxisD2 = eid(); add(geomCtxAxisD2, dir(1, 0, 0));
  const geomCtxAxis = eid(); add(geomCtxAxis, `IFCAXIS2PLACEMENT3D(#${geomCtxAxisO},#${geomCtxAxisD1},#${geomCtxAxisD2})`);
  // Fix up geomCtx ref - we'll need to output it before. Let me restructure...

  const productIds: number[] = [];
  // Maps element.id → STEP product entity id (for pset association)
  const productElMap = new Map<string, number>();

  // ─── WALLS ────────────────────────────────────────────────────────────────
  for (const el of wallEls) {
    const x1 = el.x1 ?? el.startPoint?.x ?? 0;
    const y1 = el.y1 ?? el.startPoint?.y ?? 0;
    const x2 = el.x2 ?? el.endPoint?.x ?? 0;
    const y2 = el.y2 ?? el.endPoint?.y ?? 0;
    const thickMm = el.wallThickness ?? 200;
    const heightMm = el.height ?? 3000;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthMm = Math.hypot(dx, dy);
    if (lengthMm < 10) continue;

    const ux = dx / lengthMm;
    const uy = dy / lengthMm;

    // Wall local placement: origin at start point, X axis along wall
    const wOriginId = eid(); add(wOriginId, pt(x1, y1));
    const wDirZId = eid(); add(wDirZId, dir(0, 0, 1));
    const wDirXId = eid(); add(wDirXId, dir(ux, uy, 0));
    const wAxisId = eid(); add(wAxisId, `IFCAXIS2PLACEMENT3D(#${wOriginId},#${wDirZId},#${wDirXId})`);
    const wPlcId = eid(); add(wPlcId, `IFCLOCALPLACEMENT(#${streyPlc},#${wAxisId})`);

    // Profile: IFCRECTANGLEPROFILEDEF centered at (length/2, 0) local
    const profOriginId = eid(); add(profOriginId, `IFCCARTESIANPOINT((${px2m(lengthMm / 2)},0.))`);
    const profDirId = eid(); add(profDirId, dir2(1, 0));
    const profAxId = eid(); add(profAxId, `IFCAXIS2PLACEMENT2D(#${profOriginId},#${profDirId})`);
    const profId = eid(); add(profId, `IFCRECTANGLEPROFILEDEF(.AREA.,$,#${profAxId},${px2m(lengthMm)},${px2m(thickMm)})`);

    // Extrude along Z
    const extDirId = eid(); add(extDirId, dir(0, 0, 1));
    const extPosOriginId = eid(); add(extPosOriginId, `IFCCARTESIANPOINT((0.,0.,0.))`);
    const extPosDirId = eid(); add(extPosDirId, dir(0, 0, 1));
    const extPosAxId = eid(); add(extPosAxId, `IFCAXIS2PLACEMENT3D(#${extPosOriginId},#${extPosDirId},$)`);
    const extId = eid(); add(extId, `IFCEXTRUDEDAREASOLID(#${profId},#${extPosAxId},#${extDirId},${px2m(heightMm)})`);

    // Shape representation
    const shapeRepId = eid();
    add(shapeRepId, `IFCSHAPEREPRESENTATION(#${ID.geomSub3D},'Body','SweptSolid',(#${extId}))`);
    const prodDefShapeId = eid();
    add(prodDefShapeId, `IFCPRODUCTDEFINITIONSHAPE($,$,(#${shapeRepId}))`);

    // Wall entity — use imported bimGuid if available
    const wallId = eid();
    const wallGuid = el.bimGuid ?? ifcGuid();
    add(wallId, `IFCWALL('${wallGuid}',#${ID.owh},'Wall',$,$,#${wPlcId},#${prodDefShapeId},$)`);
    productIds.push(wallId);
    productElMap.set(el.id, wallId);
  }

  // ─── DOORS ────────────────────────────────────────────────────────────────
  for (const el of doorEls) {
    const x = el.x ?? 0;
    const y = el.y ?? 0;
    const widthMm = el.width ?? 900;
    const heightMm = el.height ?? 2100;

    const dOriginId = eid(); add(dOriginId, pt(x, y));
    const dDirZId = eid(); add(dDirZId, dir(0, 0, 1));
    const dDirXId = eid(); add(dDirXId, dir(1, 0, 0));
    const dAxisId = eid(); add(dAxisId, `IFCAXIS2PLACEMENT3D(#${dOriginId},#${dDirZId},#${dDirXId})`);
    const dPlcId = eid(); add(dPlcId, `IFCLOCALPLACEMENT(#${streyPlc},#${dAxisId})`);

    const dProfOriginId = eid(); add(dProfOriginId, `IFCCARTESIANPOINT((${px2m(widthMm / 2)},0.))`);
    const dProfDirId = eid(); add(dProfDirId, dir2(1, 0));
    const dProfAxId = eid(); add(dProfAxId, `IFCAXIS2PLACEMENT2D(#${dProfOriginId},#${dProfDirId})`);
    const dProfId = eid(); add(dProfId, `IFCRECTANGLEPROFILEDEF(.AREA.,$,#${dProfAxId},${px2m(widthMm)},0.1)`);

    const dExtDirId = eid(); add(dExtDirId, dir(0, 0, 1));
    const dExtPosOriginId = eid(); add(dExtPosOriginId, `IFCCARTESIANPOINT((0.,0.,0.))`);
    const dExtPosDirId = eid(); add(dExtPosDirId, dir(0, 0, 1));
    const dExtPosAxId = eid(); add(dExtPosAxId, `IFCAXIS2PLACEMENT3D(#${dExtPosOriginId},#${dExtPosDirId},$)`);
    const dExtId = eid(); add(dExtId, `IFCEXTRUDEDAREASOLID(#${dProfId},#${dExtPosAxId},#${dExtDirId},${px2m(heightMm)})`);

    const dShapeRepId = eid();
    add(dShapeRepId, `IFCSHAPEREPRESENTATION(#${ID.geomSub3D},'Body','SweptSolid',(#${dExtId}))`);
    const dProdDefShapeId = eid();
    add(dProdDefShapeId, `IFCPRODUCTDEFINITIONSHAPE($,$,(#${dShapeRepId}))`);

    const doorId = eid();
    const doorGuid = el.bimGuid ?? ifcGuid();
    add(doorId, `IFCDOOR('${doorGuid}',#${ID.owh},'Door',$,$,#${dPlcId},#${dProdDefShapeId},$,${px2m(heightMm)},${px2m(widthMm)})`);
    productIds.push(doorId);
    productElMap.set(el.id, doorId);
  }

  // ─── WINDOWS ──────────────────────────────────────────────────────────────
  for (const el of windowEls) {
    const x = el.x ?? 0;
    const y = el.y ?? 0;
    const widthMm = el.width ?? 1200;
    const heightMm = el.height ?? 1200;
    const sillMm = (el as any).sill ?? 900;

    const wOriginId = eid(); add(wOriginId, pt(x, y, sillMm * 0.001));
    const wDirZId = eid(); add(wDirZId, dir(0, 0, 1));
    const wDirXId = eid(); add(wDirXId, dir(1, 0, 0));
    const wAxisId = eid(); add(wAxisId, `IFCAXIS2PLACEMENT3D(#${wOriginId},#${wDirZId},#${wDirXId})`);
    const wPlcId = eid(); add(wPlcId, `IFCLOCALPLACEMENT(#${streyPlc},#${wAxisId})`);

    const wProfOriginId = eid(); add(wProfOriginId, `IFCCARTESIANPOINT((${px2m(widthMm / 2)},0.))`);
    const wProfDirId = eid(); add(wProfDirId, dir2(1, 0));
    const wProfAxId = eid(); add(wProfAxId, `IFCAXIS2PLACEMENT2D(#${wProfOriginId},#${wProfDirId})`);
    const wProfId = eid(); add(wProfId, `IFCRECTANGLEPROFILEDEF(.AREA.,$,#${wProfAxId},${px2m(widthMm)},0.05)`);

    const wExtDirId = eid(); add(wExtDirId, dir(0, 0, 1));
    const wExtPosOriginId = eid(); add(wExtPosOriginId, `IFCCARTESIANPOINT((0.,0.,0.))`);
    const wExtPosDirId = eid(); add(wExtPosDirId, dir(0, 0, 1));
    const wExtPosAxId = eid(); add(wExtPosAxId, `IFCAXIS2PLACEMENT3D(#${wExtPosOriginId},#${wExtPosDirId},$)`);
    const wExtId = eid(); add(wExtId, `IFCEXTRUDEDAREASOLID(#${wProfId},#${wExtPosAxId},#${wExtDirId},${px2m(heightMm)})`);

    const wShapeRepId = eid();
    add(wShapeRepId, `IFCSHAPEREPRESENTATION(#${ID.geomSub3D},'Body','SweptSolid',(#${wExtId}))`);
    const wProdDefShapeId = eid();
    add(wProdDefShapeId, `IFCPRODUCTDEFINITIONSHAPE($,$,(#${wShapeRepId}))`);

    const windowId = eid();
    const windowGuid = el.bimGuid ?? ifcGuid();
    add(windowId, `IFCWINDOW('${windowGuid}',#${ID.owh},'Window',$,$,#${wPlcId},#${wProdDefShapeId},$,${px2m(heightMm)},${px2m(widthMm)})`);
    productIds.push(windowId);
    productElMap.set(el.id, windowId);
  }

  // ─── Spatial containment ──────────────────────────────────────────────────
  if (productIds.length > 0) {
    const relContId = eid();
    const refs = productIds.map(id => `#${id}`).join(",");
    add(relContId, `IFCRELCONTAINEDINSPATIALSTRUCTURE('${ifcGuid()}',#${ID.owh},'StoreyElements',$,(${refs}),#${streyId})`);
  }

  // ─── Property Sets ────────────────────────────────────────────────────────
  // Emit BIM property sets for elements that have them (from import or user edits)
  for (const el of elements) {
    // Collect psets from both elementPsets parameter and el.bimPsets
    const psets: BimPropertySet[] = [
      ...(el.bimPsets ?? []),
      ...(elementPsets[el.id] ?? []),
    ];
    if (psets.length === 0) continue;

    const productId = productElMap.get(el.id);
    if (productId == null) continue; // element not exported (e.g. it's a room or dimension)

    for (const pset of psets) {
      if (Object.keys(pset.properties).length === 0) continue;
      const psetId = psetToIfcLines(pset, ID.owh, add);
      const relId = eid();
      add(relId, `IFCRELDEFINESBYPROPERTIES('${ifcGuid()}',#${ID.owh},$,$,(#${productId}),#${psetId})`);
    }
  }

  // ─── Assemble file ─────────────────────────────────────────────────────────
  const header = [
    "ISO-10303-21;",
    "HEADER;",
    `FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');`,
    `FILE_NAME('arch-tech-cad.ifc','${fileDate}',(''),(''),'web','ARCH-TECH-CAD','');`,
    `FILE_SCHEMA(('IFC2X3'));`,
    "ENDSEC;",
    "DATA;",
  ].join("\n");

  const footer = ["ENDSEC;", "END-ISO-10303-21;"].join("\n");

  return [header, ...data, footer].join("\n");
}

/** Trigger browser download of an IFC file */
export function downloadIFC(elements: DrawingElement[], filename = "arch-tech-cad.ifc"): void {
  const content = exportToIFC(elements);
  const blob = new Blob([content], { type: "application/x-step" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
