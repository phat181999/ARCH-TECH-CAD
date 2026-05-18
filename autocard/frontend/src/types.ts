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
  created_at?: string;
  updated_at?: string;
}

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export type ToolType = "pan" | "select" | "line" | "polyline" | "rectangle" | "circle" | "arc" | "text" | "text-input" | "dimension" | "leader" | "hatch" | "numbering" | "move" | "copy" | "rotate" | "scale" | "trim" | "offset" | "mirror" | "explode" | "extend";


export type MeasurementMode = "distance" | "angle" | "area" | null;

export interface SnapModes {
  endpoint: boolean;
  midpoint: boolean;
  center: boolean;
  grid: boolean;
  intersection: boolean;
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
}