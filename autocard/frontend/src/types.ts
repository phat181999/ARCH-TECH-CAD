// ===== Core Types =====

export interface Point {
  x: number;
  y: number;
}

export interface Style {
  strokeColor: string;
  fillColor: string;
  lineWidth: number;
  lineType: string;
  pattern?: string;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  style?: Partial<Style>;
}

export interface DrawingElement {
  id: string;
  type: string;
  layerId: string;
  archType?:
    | "wall" | "door" | "window" | "room" | "grid" | "dimension" | "meta" | "floor"
    | "foundation-strip" | "foundation-spread" | "foundation-raft" | "foundation-pile"
    | "column" | "grade-beam" | "pipe" | "stair";
  semanticRole?: string;
  wallThickness?: number;
  hostWall?: string;
  openingWidth?: number;
  swing?: "left-in" | "right-in" | "left-out" | "right-out";
  roomType?: string;
  roomName?: string;
  axisName?: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  points?: Point[];
  startPoint?: Point;
  endPoint?: Point;
  center?: Point;
  radius?: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  rotation?: number;
  scale?: number;
  blockId?: string;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  lineWidth?: number;
  lineType?: string;
  pattern?: string;
  offset?: number;
  closed?: boolean;
  [key: string]: unknown;
}

export interface ArchitecturalPoint {
  x: number;
  y: number;
}

export interface ArchitecturalFootprint {
  widthMeters: number;
  heightMeters: number;
}

export interface ArchitecturalWall {
  id: string;
  role: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  hostBoundary?: string;
}

export interface ArchitecturalOpening {
  id: string;
  type: "door" | "window";
  hostWallId: string;
  x: number;
  y: number;
  width: number;
  swing?: string;
  orientation?: string;
}

export interface ArchitecturalRoom {
  id: string;
  name: string;
  roomType: string;
  boundary: ArchitecturalPoint[];
  labelX: number;
  labelY: number;
}

export interface ArchitecturalGridAxis {
  id: string;
  name: string;
  orientation: "vertical" | "horizontal";
  value: number;
}

export interface ArchitecturalDimension {
  id: string;
  role: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}

export interface ArchitecturalPlan {
  units: string;
  footprint: ArchitecturalFootprint;
  walls: ArchitecturalWall[];
  openings: ArchitecturalOpening[];
  rooms: ArchitecturalRoom[];
  gridAxes: ArchitecturalGridAxis[];
  dimensions: ArchitecturalDimension[];
  meta?: Record<string, unknown>;
}

export interface BlockDef {
  id: string;
  name: string;
  elements: DrawingElement[];
  insertionPoint: Point;
}

export interface Measurement {
  id: string;
  type: "distance" | "angle" | "area";
  points: Point[];
  value: number;
  label: string;
}

export interface Constraint {
  id: string;
  type: string;
  elementIds: string[];
  value?: number;
  [key: string]: unknown;
}

export interface Comment {
  id: string;
  x: number;
  y: number;
  message: string;
  parent_id: string | null;
  user_id?: string;
  created_at?: string;
}

export interface Permission {
  id: string;
  user_id: string;
  email: string;
  role: string;
}

export interface Version {
  id: string;
  version: number;
  created_at: string;
  user_id?: string;
}

export interface Drawing {
  id: string;
  name: string;
  data: string;
  version: number;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type ToolType = "pan" | "select" | "wall" | "door" | "window" | "line" | "polyline" | "rectangle" | "circle" | "arc" | "polygon" | "ellipse" | "text" | "text-input" | "dimension" | "leader" | "hatch" | "room-label" | "stair" | "numbering" | "move" | "copy" | "rotate" | "scale" | "trim" | "offset" | "fillet" | "chamfer" | "stretch" | "mirror" | "explode" | "extend" | "spline" | "mtext" | "dim-linear" | "dim-angular" | "mark" | "dim-radius" | "dim-diameter" | "dim-continue" | "dim-baseline" | "array" | "break";


export type MeasurementMode = "distance" | "angle" | "area" | null;

export interface SnapModes {
  endpoint: boolean;
  midpoint: boolean;
  center: boolean;
  grid: boolean;
  intersection: boolean;
  nearest: boolean;
  geometricCenter: boolean;
  node: boolean;
  quadrant: boolean;
  perpendicular: boolean;
  tangent: boolean;
  insertion: boolean;
  extension: boolean;
  apparentIntersection: boolean;
}

export interface DrawingDocument {
  fileType: "ARCH-TECH-CAD-DOCUMENT";
  version: number;
  elements: DrawingElement[];
  layers: Layer[];
  activeLayerId: string;
  blockDefs: Record<string, BlockDef>;
  currentArchitecturalPlan: ArchitecturalPlan | null;
  measurements: Measurement[];
  constraints: Constraint[];
  currentStyle?: Style;
}

export interface DrawingState {
  drawings: Drawing[];
  loading: boolean;
  error: string | null;
  currentDrawing: Drawing | null;
  currentDrawingId: string | null;
  currentVersion: number;
  elements: DrawingElement[];
  selectedElementIds: string[];
  tool: ToolType;
  panOffset: Point;
  zoom: number;
  currentStyle: Style;
  gridVisible: boolean;
  snapEnabled: boolean;
  osnapEnabled: boolean;
  snapModes: SnapModes;

  snapThreshold: number;
  blockDefs: Record<string, BlockDef>;
  layers: Layer[];
  activeLayerId: string;
  history: DrawingElement[][];
  historyIndex: number;
  measurementMode: MeasurementMode;
  measurementPoints: Point[];
  measurements: Measurement[];
  constraints: Constraint[];
  versions: Version[];
  showVersionHistory: boolean;
  comments: Comment[];
  showComments: boolean;
  commentMode: boolean;
  permissions: Permission[];
  showShareDialog: boolean;
  viewportBounds: ViewportBounds | null;
  visibleElementIds: string[];
  currentArchitecturalPlan: ArchitecturalPlan | null;
}
