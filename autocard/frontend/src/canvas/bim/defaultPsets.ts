import type { BimPropertySet, IfcEntityType } from "../../types";

export const DEFAULT_PSETS: Partial<Record<IfcEntityType, BimPropertySet[]>> = {
  IfcWall: [
    {
      name: "Pset_WallCommon",
      properties: {
        Reference:      { type: "string",  value: "" },
        LoadBearing:    { type: "boolean", value: false },
        IsExternal:     { type: "boolean", value: false },
        FireRating:     { type: "enum",    value: "None", options: ["None", "REI 30", "REI 60", "REI 90", "REI 120"] },
        AcousticRating: { type: "string",  value: "" },
      },
    },
  ],
  IfcDoor: [
    {
      name: "Pset_DoorCommon",
      properties: {
        Reference:           { type: "string",  value: "" },
        FireRating:          { type: "enum",    value: "None", options: ["None", "EI 30", "EI 60", "EI 90"] },
        IsExternal:          { type: "boolean", value: false },
        HandicapAccessible:  { type: "boolean", value: false },
      },
    },
  ],
  IfcWindow: [
    {
      name: "Pset_WindowCommon",
      properties: {
        Reference:   { type: "string",  value: "" },
        IsExternal:  { type: "boolean", value: true },
        FireRating:  { type: "enum",    value: "None", options: ["None", "EI 30", "EI 60"] },
        GlazingType: { type: "enum",    value: "Single", options: ["Single", "Double", "Triple", "Laminated"] },
      },
    },
  ],
  IfcSlab: [
    {
      name: "Pset_SlabCommon",
      properties: {
        Reference:   { type: "string",  value: "" },
        LoadBearing: { type: "boolean", value: true },
        IsExternal:  { type: "boolean", value: false },
        FireRating:  { type: "enum",    value: "REI 60", options: ["None", "REI 30", "REI 60", "REI 90", "REI 120"] },
      },
    },
  ],
  IfcColumn: [
    {
      name: "Pset_ColumnCommon",
      properties: {
        Reference:      { type: "string",  value: "" },
        LoadBearing:    { type: "boolean", value: true },
        FireRating:     { type: "enum",    value: "REI 60", options: ["None", "REI 30", "REI 60", "REI 90", "REI 120"] },
        ThermalTransmittance: { type: "number", value: 0, unit: "W/m²K" },
      },
    },
  ],
  IfcStair: [
    {
      name: "Pset_StairCommon",
      properties: {
        Reference:          { type: "string",  value: "" },
        HandicapAccessible: { type: "boolean", value: false },
        FireExit:           { type: "boolean", value: false },
        NumberOfRiser:      { type: "number",  value: 0, unit: "" },
        RiserHeight:        { type: "number",  value: 180, unit: "mm" },
        TreadLength:        { type: "number",  value: 270, unit: "mm" },
      },
    },
  ],
  IfcFooting: [
    {
      name: "Pset_FootingCommon",
      properties: {
        Reference:        { type: "string", value: "" },
        LoadBearing:      { type: "boolean", value: true },
        ConcreteGrade:    { type: "enum", value: "M200", options: ["M200", "M250", "M300", "M350", "M400"] },
        ReinforcingSteel: { type: "string", value: "CB300-V" },
      },
    },
  ],
};

/** Get default psets for an IfcType, with deep clone to avoid mutation */
export function getDefaultPsets(ifcType: IfcEntityType): BimPropertySet[] {
  const templates = DEFAULT_PSETS[ifcType];
  if (!templates) return [];
  return JSON.parse(JSON.stringify(templates)) as BimPropertySet[];
}
