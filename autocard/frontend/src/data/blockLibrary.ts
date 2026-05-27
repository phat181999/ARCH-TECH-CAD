import type { BlockDef, DrawingElement } from "../types";

// Block sub-elements don't need a layerId (they're drawn through the block instance)
type BlockElement = Omit<DrawingElement, "layerId"> & { layerId?: string };
type LooseBlockDef = Omit<BlockDef, "elements"> & { elements: BlockElement[] };

export type BlockCategory =
  | "living"
  | "bedroom"
  | "dining"
  | "kitchen"
  | "bathroom"
  | "office"
  | "structural"
  | "electrical"
  | "landscape"
  | "elevation"
  | "annotation";

export interface CatalogBlock {
  id: string;
  label: string;
  icon: string;
  category: BlockCategory;
  def: LooseBlockDef;
}

const S = "#111827";   // stroke
const F = "#F3F4F6";   // fill light
const FB = "#E5E7EB";  // fill mid

// ─── LIVING ROOM ─────────────────────────────────────────────────────────────
const living: CatalogBlock[] = [
  {
    id: "sofa", label: "Sofa 3-seat", icon: "🛋", category: "living",
    def: {
      id: "sofa", name: "Sofa 3-seat", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "s1", type: "rectangle", x: -55, y: -20, width: 110, height: 45, strokeWidth: 2, strokeColor: S, fillColor: FB },
        { id: "s2", type: "rectangle", x: -55, y: -30, width: 110, height: 12, strokeWidth: 1.5, strokeColor: S, fillColor: "#D1D5DB" },
        { id: "s3", type: "rectangle", x: -60, y: -20, width: 10, height: 45, strokeWidth: 1.5, strokeColor: S, fillColor: "#D1D5DB" },
        { id: "s4", type: "rectangle", x: 50, y: -20, width: 10, height: 45, strokeWidth: 1.5, strokeColor: S, fillColor: "#D1D5DB" },
      ],
    },
  },
  {
    id: "sofa-l", label: "Sofa L-shape", icon: "📐", category: "living",
    def: {
      id: "sofa-l", name: "Sofa L-shape", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "sl1", type: "rectangle", x: -60, y: -20, width: 120, height: 42, strokeWidth: 2, strokeColor: S, fillColor: FB },
        { id: "sl2", type: "rectangle", x: 35, y: 22, width: 42, height: 80, strokeWidth: 2, strokeColor: S, fillColor: FB },
        { id: "sl3", type: "rectangle", x: -60, y: -30, width: 120, height: 12, strokeWidth: 1, strokeColor: S, fillColor: "#D1D5DB" },
        { id: "sl4", type: "rectangle", x: 65, y: 22, width: 12, height: 80, strokeWidth: 1, strokeColor: S, fillColor: "#D1D5DB" },
      ],
    },
  },
  {
    id: "armchair", label: "Armchair", icon: "🪑", category: "living",
    def: {
      id: "armchair", name: "Armchair", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "a1", type: "rectangle", x: -28, y: -22, width: 56, height: 48, strokeWidth: 2, strokeColor: S, fillColor: FB },
        { id: "a2", type: "rectangle", x: -28, y: -32, width: 56, height: 12, strokeWidth: 1.5, strokeColor: S, fillColor: "#D1D5DB" },
        { id: "a3", type: "rectangle", x: -35, y: -22, width: 10, height: 48, strokeWidth: 1.5, strokeColor: S, fillColor: "#D1D5DB" },
        { id: "a4", type: "rectangle", x: 25, y: -22, width: 10, height: 48, strokeWidth: 1.5, strokeColor: S, fillColor: "#D1D5DB" },
      ],
    },
  },
  {
    id: "coffee-table", label: "Coffee Table", icon: "☕", category: "living",
    def: {
      id: "coffee-table", name: "Coffee Table", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "cft1", type: "rectangle", x: -55, y: -28, width: 110, height: 56, strokeWidth: 2, strokeColor: S, fillColor: F },
      ],
    },
  },
  {
    id: "tv-unit", label: "TV Unit", icon: "📺", category: "living",
    def: {
      id: "tv-unit", name: "TV Unit", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "tv1", type: "rectangle", x: -70, y: -12, width: 140, height: 24, strokeWidth: 2, strokeColor: S, fillColor: "#374151" },
        { id: "tv2", type: "rectangle", x: -58, y: -55, width: 116, height: 58, strokeWidth: 1.5, strokeColor: S, fillColor: "#1F2937" },
        { id: "tv3", type: "line", x1: -58, y1: -55, x2: 58, y2: 3, strokeWidth: 0.5, strokeColor: "#4B5563" },
        { id: "tv4", type: "line", x1: 58, y1: -55, x2: -58, y2: 3, strokeWidth: 0.5, strokeColor: "#4B5563" },
      ],
    },
  },
  {
    id: "bookshelf", label: "Bookshelf", icon: "📚", category: "living",
    def: {
      id: "bookshelf", name: "Bookshelf", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "bk1", type: "rectangle", x: -32, y: -55, width: 64, height: 110, strokeWidth: 2, strokeColor: S, fillColor: "#FEF3C7" },
        { id: "bk2", type: "line", x1: -30, y1: -18, x2: 30, y2: -18, strokeWidth: 1, strokeColor: "#9CA3AF" },
        { id: "bk3", type: "line", x1: -30, y1: 18, x2: 30, y2: 18, strokeWidth: 1, strokeColor: "#9CA3AF" },
        { id: "bk4", type: "line", x1: 0, y1: -55, x2: 0, y2: 55, strokeWidth: 0.5, strokeColor: "#D1D5DB" },
      ],
    },
  },
  {
    id: "rug", label: "Rug / Mat", icon: "🔲", category: "living",
    def: {
      id: "rug", name: "Rug", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "rug1", type: "rectangle", x: -80, y: -55, width: 160, height: 110, strokeWidth: 1.5, strokeColor: "#B45309", fillColor: "rgba(180,83,9,0.08)" },
        { id: "rug2", type: "rectangle", x: -72, y: -47, width: 144, height: 94, strokeWidth: 0.8, strokeColor: "#B45309", fillColor: "transparent" },
      ],
    },
  },
  {
    id: "floor-lamp", label: "Floor Lamp", icon: "💡", category: "living",
    def: {
      id: "floor-lamp", name: "Floor Lamp", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "fl1", type: "circle", cx: 0, cy: 0, radius: 18, strokeWidth: 1.5, strokeColor: "#B45309", fillColor: "rgba(251,191,36,0.2)" },
        { id: "fl2", type: "circle", cx: 0, cy: 0, radius: 5, strokeWidth: 1, strokeColor: "#111827", fillColor: "#F9FAFB" },
        { id: "fl3", type: "line", x1: 0, y1: -18, x2: 0, y2: -5, strokeWidth: 1, strokeColor: "#111827" },
        { id: "fl4", type: "line", x1: 13, y1: -13, x2: 4, y2: -4, strokeWidth: 1, strokeColor: "#111827" },
        { id: "fl5", type: "line", x1: 13, y1: 13, x2: 4, y2: 4, strokeWidth: 1, strokeColor: "#111827" },
        { id: "fl6", type: "line", x1: -13, y1: -13, x2: -4, y2: -4, strokeWidth: 1, strokeColor: "#111827" },
        { id: "fl7", type: "line", x1: -13, y1: 13, x2: -4, y2: 4, strokeWidth: 1, strokeColor: "#111827" },
      ],
    },
  },
];

// ─── BEDROOM ──────────────────────────────────────────────────────────────────
const bedroom: CatalogBlock[] = [
  {
    id: "bed", label: "Bed Double", icon: "🛏", category: "bedroom",
    def: {
      id: "bed", name: "Bed Double", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "bd1", type: "rectangle", x: -52, y: -70, width: 104, height: 140, strokeWidth: 2, strokeColor: S, fillColor: F },
        { id: "bd2", type: "rectangle", x: -45, y: -65, width: 42, height: 22, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#fff" },
        { id: "bd3", type: "rectangle", x: 3, y: -65, width: 42, height: 22, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#fff" },
        { id: "bd4", type: "line", x1: -52, y1: -38, x2: 52, y2: -38, strokeWidth: 1.5, strokeColor: S },
      ],
    },
  },
  {
    id: "bed-single", label: "Bed Single", icon: "🛏", category: "bedroom",
    def: {
      id: "bed-single", name: "Bed Single", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "bs1", type: "rectangle", x: -40, y: -70, width: 80, height: 140, strokeWidth: 2, strokeColor: S, fillColor: F },
        { id: "bs2", type: "rectangle", x: -33, y: -65, width: 66, height: 22, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#fff" },
        { id: "bs3", type: "line", x1: -40, y1: -38, x2: 40, y2: -38, strokeWidth: 1.5, strokeColor: S },
      ],
    },
  },
  {
    id: "wardrobe", label: "Wardrobe", icon: "🚪", category: "bedroom",
    def: {
      id: "wardrobe", name: "Wardrobe", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "wd1", type: "rectangle", x: -65, y: -30, width: 130, height: 60, strokeWidth: 2, strokeColor: S, fillColor: "#FEF3C7" },
        { id: "wd2", type: "line", x1: 0, y1: -30, x2: 0, y2: 30, strokeWidth: 1, strokeColor: S },
        { id: "wd3", type: "circle", cx: -12, cy: 0, radius: 3, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#9CA3AF" },
        { id: "wd4", type: "circle", cx: 12, cy: 0, radius: 3, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#9CA3AF" },
      ],
    },
  },
  {
    id: "dresser", label: "Dresser", icon: "🗄", category: "bedroom",
    def: {
      id: "dresser", name: "Dresser", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "dr1", type: "rectangle", x: -40, y: -28, width: 80, height: 56, strokeWidth: 2, strokeColor: S, fillColor: "#FEF3C7" },
        { id: "dr2", type: "line", x1: -40, y1: -10, x2: 40, y2: -10, strokeWidth: 1, strokeColor: "#9CA3AF" },
        { id: "dr3", type: "line", x1: -40, y1: 10, x2: 40, y2: 10, strokeWidth: 1, strokeColor: "#9CA3AF" },
        { id: "dr4", type: "circle", cx: 0, cy: -19, radius: 3, strokeWidth: 1, strokeColor: "#6B7280", fillColor: "#6B7280" },
        { id: "dr5", type: "circle", cx: 0, cy: 0, radius: 3, strokeWidth: 1, strokeColor: "#6B7280", fillColor: "#6B7280" },
        { id: "dr6", type: "circle", cx: 0, cy: 19, radius: 3, strokeWidth: 1, strokeColor: "#6B7280", fillColor: "#6B7280" },
      ],
    },
  },
  {
    id: "nightstand", label: "Nightstand", icon: "🕯", category: "bedroom",
    def: {
      id: "nightstand", name: "Nightstand", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "ns1", type: "rectangle", x: -22, y: -22, width: 44, height: 44, strokeWidth: 2, strokeColor: S, fillColor: F },
        { id: "ns2", type: "circle", cx: 0, cy: 0, radius: 5, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "transparent" },
      ],
    },
  },
];

// ─── DINING ROOM ──────────────────────────────────────────────────────────────
const dining: CatalogBlock[] = [
  {
    id: "dining-table-rect", label: "Dining Table (6)", icon: "🍽", category: "dining",
    def: {
      id: "dining-table-rect", name: "Dining Table 6", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "dt1", type: "rectangle", x: -55, y: -38, width: 110, height: 76, strokeWidth: 2, strokeColor: S, fillColor: F },
        // top chairs
        { id: "dt2", type: "rectangle", x: -40, y: -54, width: 30, height: 18, strokeWidth: 1, strokeColor: S, fillColor: FB },
        { id: "dt3", type: "rectangle", x: 10, y: -54, width: 30, height: 18, strokeWidth: 1, strokeColor: S, fillColor: FB },
        // bottom chairs
        { id: "dt4", type: "rectangle", x: -40, y: 36, width: 30, height: 18, strokeWidth: 1, strokeColor: S, fillColor: FB },
        { id: "dt5", type: "rectangle", x: 10, y: 36, width: 30, height: 18, strokeWidth: 1, strokeColor: S, fillColor: FB },
        // left chair
        { id: "dt6", type: "rectangle", x: -73, y: -14, width: 18, height: 28, strokeWidth: 1, strokeColor: S, fillColor: FB },
        // right chair
        { id: "dt7", type: "rectangle", x: 55, y: -14, width: 18, height: 28, strokeWidth: 1, strokeColor: S, fillColor: FB },
      ],
    },
  },
  {
    id: "table", label: "Round Table (4)", icon: "⭕", category: "dining",
    def: {
      id: "table", name: "Round Table 4", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "rt1", type: "circle", cx: 0, cy: 0, radius: 40, strokeWidth: 2, strokeColor: S, fillColor: F },
        // 4 chairs
        { id: "rt2", type: "rectangle", x: -14, y: -58, width: 28, height: 18, strokeWidth: 1, strokeColor: S, fillColor: FB },
        { id: "rt3", type: "rectangle", x: -14, y: 40, width: 28, height: 18, strokeWidth: 1, strokeColor: S, fillColor: FB },
        { id: "rt4", type: "rectangle", x: -58, y: -14, width: 18, height: 28, strokeWidth: 1, strokeColor: S, fillColor: FB },
        { id: "rt5", type: "rectangle", x: 40, y: -14, width: 18, height: 28, strokeWidth: 1, strokeColor: S, fillColor: FB },
      ],
    },
  },
  {
    id: "dining-chair", label: "Dining Chair", icon: "💺", category: "dining",
    def: {
      id: "dining-chair", name: "Dining Chair", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "dc1", type: "rectangle", x: -18, y: -18, width: 36, height: 36, strokeWidth: 2, strokeColor: S, fillColor: FB },
        { id: "dc2", type: "rectangle", x: -18, y: -28, width: 36, height: 12, strokeWidth: 1.5, strokeColor: S, fillColor: "#D1D5DB" },
      ],
    },
  },
];

// ─── KITCHEN ─────────────────────────────────────────────────────────────────
const kitchen: CatalogBlock[] = [
  {
    id: "kitchen-sink-double", label: "Double Sink", icon: "🚰", category: "kitchen",
    def: {
      id: "kitchen-sink-double", name: "Double Sink", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "ksd1", type: "rectangle", x: -45, y: -25, width: 90, height: 50, strokeWidth: 2, strokeColor: S, fillColor: "#F0F9FF" },
        { id: "ksd2", type: "rectangle", x: -40, y: -20, width: 36, height: 40, strokeWidth: 1, strokeColor: "#64748B", fillColor: "#E0F2FE" },
        { id: "ksd3", type: "rectangle", x: 4, y: -20, width: 36, height: 40, strokeWidth: 1, strokeColor: "#64748B", fillColor: "#E0F2FE" },
        { id: "ksd4", type: "circle", cx: -22, cy: 0, radius: 3, strokeWidth: 1, strokeColor: "#374151", fillColor: "#374151" },
        { id: "ksd5", type: "circle", cx: 22, cy: 0, radius: 3, strokeWidth: 1, strokeColor: "#374151", fillColor: "#374151" },
        { id: "ksd6", type: "circle", cx: 0, cy: -8, radius: 2, strokeWidth: 1.5, strokeColor: "#374151", fillColor: "transparent" },
      ],
    },
  },
  {
    id: "sink", label: "Kitchen Sink", icon: "🚰", category: "kitchen",
    def: {
      id: "sink", name: "Kitchen Sink", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "sk1", type: "rectangle", x: -28, y: -20, width: 56, height: 40, strokeWidth: 2, strokeColor: S, fillColor: "#F0F9FF" },
        { id: "sk2", type: "rectangle", x: -22, y: -16, width: 44, height: 32, strokeWidth: 1, strokeColor: "#64748B", fillColor: "#E0F2FE" },
        { id: "sk3", type: "circle", cx: 0, cy: 0, radius: 4, strokeWidth: 1, strokeColor: "#374151", fillColor: "#374151" },
        { id: "sk4", type: "circle", cx: 0, cy: -12, radius: 2, strokeWidth: 1.5, strokeColor: "#374151", fillColor: "transparent" },
      ],
    },
  },
  {
    id: "stove", label: "Stove / Hob", icon: "🍳", category: "kitchen",
    def: {
      id: "stove", name: "Stove 4-burner", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "st1", type: "rectangle", x: -35, y: -35, width: 70, height: 70, strokeWidth: 2, strokeColor: S, fillColor: "#F9FAFB" },
        { id: "st2", type: "circle", cx: -15, cy: -15, radius: 12, strokeWidth: 1.5, strokeColor: "#374151", fillColor: "#E5E7EB" },
        { id: "st3", type: "circle", cx: 15, cy: -15, radius: 12, strokeWidth: 1.5, strokeColor: "#374151", fillColor: "#E5E7EB" },
        { id: "st4", type: "circle", cx: -15, cy: 15, radius: 12, strokeWidth: 1.5, strokeColor: "#374151", fillColor: "#E5E7EB" },
        { id: "st5", type: "circle", cx: 15, cy: 15, radius: 12, strokeWidth: 1.5, strokeColor: "#374151", fillColor: "#E5E7EB" },
        { id: "st6", type: "circle", cx: -15, cy: -15, radius: 4, strokeWidth: 1, strokeColor: "#6B7280", fillColor: "#9CA3AF" },
        { id: "st7", type: "circle", cx: 15, cy: -15, radius: 4, strokeWidth: 1, strokeColor: "#6B7280", fillColor: "#9CA3AF" },
        { id: "st8", type: "circle", cx: -15, cy: 15, radius: 4, strokeWidth: 1, strokeColor: "#6B7280", fillColor: "#9CA3AF" },
        { id: "st9", type: "circle", cx: 15, cy: 15, radius: 4, strokeWidth: 1, strokeColor: "#6B7280", fillColor: "#9CA3AF" },
      ],
    },
  },
  {
    id: "refrigerator", label: "Refrigerator", icon: "🧊", category: "kitchen",
    def: {
      id: "refrigerator", name: "Refrigerator", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "rf1", type: "rectangle", x: -32, y: -45, width: 64, height: 90, strokeWidth: 2, strokeColor: S, fillColor: "#F8FAFC" },
        { id: "rf2", type: "line", x1: -32, y1: 5, x2: 32, y2: 5, strokeWidth: 1.5, strokeColor: "#9CA3AF" },
        { id: "rf3", type: "circle", cx: 20, cy: -18, radius: 4, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#9CA3AF" },
        { id: "rf4", type: "circle", cx: 20, cy: 28, radius: 4, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#9CA3AF" },
      ],
    },
  },
  {
    id: "kitchen-counter", label: "Counter (L)", icon: "⬛", category: "kitchen",
    def: {
      id: "kitchen-counter", name: "Kitchen Counter L", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "kc1", type: "rectangle", x: -70, y: -32, width: 140, height: 32, strokeWidth: 2, strokeColor: S, fillColor: "#F1F5F9" },
        { id: "kc2", type: "rectangle", x: 38, y: 0, width: 32, height: 100, strokeWidth: 2, strokeColor: S, fillColor: "#F1F5F9" },
      ],
    },
  },
  {
    id: "oven", label: "Oven", icon: "🔲", category: "kitchen",
    def: {
      id: "oven", name: "Oven", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "ov1", type: "rectangle", x: -35, y: -35, width: 70, height: 70, strokeWidth: 2, strokeColor: S, fillColor: "#374151" },
        { id: "ov2", type: "rectangle", x: -28, y: -28, width: 56, height: 50, strokeWidth: 1.5, strokeColor: "#6B7280", fillColor: "#1F2937" },
        { id: "ov3", type: "line", x1: -35, y1: 25, x2: 35, y2: 25, strokeWidth: 1, strokeColor: "#6B7280" },
        { id: "ov4", type: "circle", cx: -18, cy: 31, radius: 4, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#9CA3AF" },
        { id: "ov5", type: "circle", cx: 0, cy: 31, radius: 4, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#9CA3AF" },
        { id: "ov6", type: "circle", cx: 18, cy: 31, radius: 4, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#9CA3AF" },
      ],
    },
  },
];

// ─── BATHROOM ─────────────────────────────────────────────────────────────────
const bathroom: CatalogBlock[] = [
  {
    id: "toilet", label: "Toilet", icon: "🚽", category: "bathroom",
    def: {
      id: "toilet", name: "Toilet", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "tl1", type: "rectangle", x: -17, y: -30, width: 34, height: 20, strokeWidth: 2, strokeColor: S, fillColor: "#F8FAFC" },
        { id: "tl2", type: "circle", cx: 0, cy: 10, radius: 20, strokeWidth: 2, strokeColor: S, fillColor: "#F8FAFC" },
        { id: "tl3", type: "circle", cx: 0, cy: 10, radius: 13, strokeWidth: 1, strokeColor: "#94A3B8", fillColor: "transparent" },
      ],
    },
  },
  {
    id: "bath", label: "Bathtub", icon: "🛁", category: "bathroom",
    def: {
      id: "bath", name: "Bathtub", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "bt1", type: "rectangle", x: -35, y: -55, width: 70, height: 110, strokeWidth: 2, strokeColor: S, fillColor: "#F0F9FF" },
        { id: "bt2", type: "rectangle", x: -28, y: -48, width: 56, height: 92, strokeWidth: 1, strokeColor: "#7DD3FC", fillColor: "#E0F2FE" },
        { id: "bt3", type: "circle", cx: 0, cy: 40, radius: 5, strokeWidth: 1, strokeColor: "#64748B", fillColor: "#64748B" },
      ],
    },
  },
  {
    id: "shower", label: "Shower", icon: "🚿", category: "bathroom",
    def: {
      id: "shower", name: "Shower Stall", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "sh1", type: "rectangle", x: -40, y: -40, width: 80, height: 80, strokeWidth: 2, strokeColor: "#2563EB", fillColor: "rgba(219,234,254,0.4)" },
        { id: "sh2", type: "circle", cx: 0, cy: 0, radius: 15, strokeWidth: 1, strokeColor: "#60A5FA", fillColor: "transparent" },
        { id: "sh3", type: "circle", cx: 0, cy: 0, radius: 4, strokeWidth: 1.5, strokeColor: "#2563EB", fillColor: "#BFDBFE" },
        { id: "sh4", type: "line", x1: -40, y1: -40, x2: -40, y2: 40, strokeWidth: 3, strokeColor: "#2563EB" },
      ],
    },
  },
  {
    id: "bidet", label: "Bidet", icon: "🪣", category: "bathroom",
    def: {
      id: "bidet", name: "Bidet", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "bi1", type: "rectangle", x: -14, y: -28, width: 28, height: 18, strokeWidth: 2, strokeColor: S, fillColor: "#F8FAFC" },
        { id: "bi2", type: "circle", cx: 0, cy: 5, radius: 15, strokeWidth: 2, strokeColor: S, fillColor: "#F8FAFC" },
        { id: "bi3", type: "circle", cx: 0, cy: 5, radius: 8, strokeWidth: 1, strokeColor: "#94A3B8", fillColor: "transparent" },
      ],
    },
  },
  {
    id: "sink", label: "Sink", icon: "🚰", category: "bathroom",
    def: {
      id: "sink", name: "Sink", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "sk1", type: "rectangle", x: -22, y: -18, width: 44, height: 36, strokeWidth: 2, strokeColor: S, fillColor: "#F8FAFC" },
        { id: "sk2", type: "circle", cx: 0, cy: 2, radius: 12, strokeWidth: 1, strokeColor: "#94A3B8", fillColor: "#E0F2FE" },
        { id: "sk3", type: "circle", cx: 0, cy: -8, radius: 3, strokeWidth: 1.5, strokeColor: S, fillColor: "transparent" },
      ],
    },
  },
  {
    id: "sink-double", label: "Double Vanity", icon: "🪞", category: "bathroom",
    def: {
      id: "sink-double", name: "Double Vanity", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "sdv1", type: "rectangle", x: -55, y: -22, width: 110, height: 44, strokeWidth: 2, strokeColor: S, fillColor: "#F8FAFC" },
        { id: "sdv2", type: "circle", cx: -27, cy: 0, radius: 14, strokeWidth: 1, strokeColor: "#94A3B8", fillColor: "#E0F2FE" },
        { id: "sdv3", type: "circle", cx: 27, cy: 0, radius: 14, strokeWidth: 1, strokeColor: "#94A3B8", fillColor: "#E0F2FE" },
        { id: "sdv4", type: "circle", cx: -27, cy: -10, radius: 3, strokeWidth: 1.5, strokeColor: S, fillColor: "transparent" },
        { id: "sdv5", type: "circle", cx: 27, cy: -10, radius: 3, strokeWidth: 1.5, strokeColor: S, fillColor: "transparent" },
      ],
    },
  },
];

// ─── OFFICE ───────────────────────────────────────────────────────────────────
const office: CatalogBlock[] = [
  {
    id: "desk", label: "Office Desk", icon: "🖥", category: "office",
    def: {
      id: "desk", name: "Office Desk", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "od1", type: "rectangle", x: -45, y: -25, width: 90, height: 50, strokeWidth: 2, strokeColor: S, fillColor: F },
        { id: "od2", type: "rectangle", x: -38, y: -18, width: 50, height: 28, strokeWidth: 1, strokeColor: "#374151", fillColor: "#1F2937" },
      ],
    },
  },
  {
    id: "desk-l", label: "L-Desk", icon: "📐", category: "office",
    def: {
      id: "desk-l", name: "L-Desk", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "dl1", type: "rectangle", x: -70, y: -28, width: 140, height: 28, strokeWidth: 2, strokeColor: S, fillColor: F },
        { id: "dl2", type: "rectangle", x: -70, y: 0, width: 28, height: 70, strokeWidth: 2, strokeColor: S, fillColor: F },
      ],
    },
  },
  {
    id: "chair", label: "Office Chair", icon: "💺", category: "office",
    def: {
      id: "chair", name: "Office Chair", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "oc1", type: "circle", cx: 0, cy: 0, radius: 20, strokeWidth: 2, strokeColor: S, fillColor: FB },
        { id: "oc2", type: "rectangle", x: -15, y: -26, width: 30, height: 10, strokeWidth: 2, strokeColor: S, fillColor: "#D1D5DB" },
        { id: "oc3", type: "circle", cx: 0, cy: 0, radius: 4, strokeWidth: 1, strokeColor: "#9CA3AF", fillColor: "#D1D5DB" },
      ],
    },
  },
  {
    id: "conference-table", label: "Conf. Table", icon: "🤝", category: "office",
    def: {
      id: "conference-table", name: "Conference Table", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "ct1", type: "rectangle", x: -80, y: -35, width: 160, height: 70, strokeWidth: 2, strokeColor: S, fillColor: F },
        // top chairs (4)
        { id: "ct2", type: "rectangle", x: -70, y: -50, width: 28, height: 16, strokeWidth: 1, strokeColor: S, fillColor: FB },
        { id: "ct3", type: "rectangle", x: -26, y: -50, width: 28, height: 16, strokeWidth: 1, strokeColor: S, fillColor: FB },
        { id: "ct4", type: "rectangle", x: 18, y: -50, width: 28, height: 16, strokeWidth: 1, strokeColor: S, fillColor: FB },
        { id: "ct5", type: "rectangle", x: 52, y: -50, width: 28, height: 16, strokeWidth: 1, strokeColor: S, fillColor: FB },
        // bottom chairs (4)
        { id: "ct6", type: "rectangle", x: -70, y: 34, width: 28, height: 16, strokeWidth: 1, strokeColor: S, fillColor: FB },
        { id: "ct7", type: "rectangle", x: -26, y: 34, width: 28, height: 16, strokeWidth: 1, strokeColor: S, fillColor: FB },
        { id: "ct8", type: "rectangle", x: 18, y: 34, width: 28, height: 16, strokeWidth: 1, strokeColor: S, fillColor: FB },
        { id: "ct9", type: "rectangle", x: 52, y: 34, width: 28, height: 16, strokeWidth: 1, strokeColor: S, fillColor: FB },
      ],
    },
  },
  {
    id: "printer", label: "Printer", icon: "🖨", category: "office",
    def: {
      id: "printer", name: "Printer", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "pr1", type: "rectangle", x: -28, y: -18, width: 56, height: 36, strokeWidth: 2, strokeColor: S, fillColor: "#374151" },
        { id: "pr2", type: "rectangle", x: -22, y: -14, width: 44, height: 10, strokeWidth: 1, strokeColor: "#6B7280", fillColor: "#F9FAFB" },
        { id: "pr3", type: "rectangle", x: -8, y: 8, width: 16, height: 8, strokeWidth: 1, strokeColor: "#6B7280", fillColor: "#9CA3AF" },
      ],
    },
  },
];

// ─── STRUCTURAL ───────────────────────────────────────────────────────────────
const structural: CatalogBlock[] = [
  {
    id: "column-square", label: "Column (sq.)", icon: "⬛", category: "structural",
    def: {
      id: "column-square", name: "Column Square", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "cq1", type: "rectangle", x: -15, y: -15, width: 30, height: 30, strokeWidth: 2.5, strokeColor: S, fillColor: "#1F2937" },
        { id: "cq2", type: "line", x1: -15, y1: -15, x2: 15, y2: 15, strokeWidth: 1, strokeColor: "#9CA3AF" },
        { id: "cq3", type: "line", x1: 15, y1: -15, x2: -15, y2: 15, strokeWidth: 1, strokeColor: "#9CA3AF" },
      ],
    },
  },
  {
    id: "column-round", label: "Column (rnd.)", icon: "⭕", category: "structural",
    def: {
      id: "column-round", name: "Column Round", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "cr1", type: "circle", cx: 0, cy: 0, radius: 15, strokeWidth: 2.5, strokeColor: S, fillColor: "#1F2937" },
        { id: "cr2", type: "line", x1: -10, y1: -10, x2: 10, y2: 10, strokeWidth: 1, strokeColor: "#9CA3AF" },
        { id: "cr3", type: "line", x1: 10, y1: -10, x2: -10, y2: 10, strokeWidth: 1, strokeColor: "#9CA3AF" },
      ],
    },
  },
  {
    id: "stair-straight", label: "Stair (straight)", icon: "🪜", category: "structural",
    def: {
      id: "stair-straight", name: "Stair Straight", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "ss1", type: "rectangle", x: -35, y: -70, width: 70, height: 140, strokeWidth: 2, strokeColor: S, fillColor: "transparent" },
        { id: "ss2", type: "line", x1: -35, y1: -50, x2: 35, y2: -50, strokeWidth: 1, strokeColor: S },
        { id: "ss3", type: "line", x1: -35, y1: -30, x2: 35, y2: -30, strokeWidth: 1, strokeColor: S },
        { id: "ss4", type: "line", x1: -35, y1: -10, x2: 35, y2: -10, strokeWidth: 1, strokeColor: S },
        { id: "ss5", type: "line", x1: -35, y1: 10, x2: 35, y2: 10, strokeWidth: 1, strokeColor: S },
        { id: "ss6", type: "line", x1: -35, y1: 30, x2: 35, y2: 30, strokeWidth: 1, strokeColor: S },
        { id: "ss7", type: "line", x1: -35, y1: 50, x2: 35, y2: 50, strokeWidth: 1, strokeColor: S },
        // direction arrow
        { id: "ss8", type: "line", x1: 0, y1: -62, x2: 0, y2: 62, strokeWidth: 1.5, strokeColor: "#DC2626" },
        { id: "ss9", type: "line", x1: 0, y1: -62, x2: -8, y2: -50, strokeWidth: 1.5, strokeColor: "#DC2626" },
        { id: "ss10", type: "line", x1: 0, y1: -62, x2: 8, y2: -50, strokeWidth: 1.5, strokeColor: "#DC2626" },
      ],
    },
  },
  {
    id: "stair-u", label: "Stair (U-shape)", icon: "🔄", category: "structural",
    def: {
      id: "stair-u", name: "Stair U-shape", insertionPoint: { x: 0, y: 0 },
      elements: [
        // Left flight
        { id: "su1", type: "rectangle", x: -65, y: -50, width: 30, height: 100, strokeWidth: 2, strokeColor: S, fillColor: "transparent" },
        { id: "su2", type: "line", x1: -65, y1: -30, x2: -35, y2: -30, strokeWidth: 1, strokeColor: S },
        { id: "su3", type: "line", x1: -65, y1: -10, x2: -35, y2: -10, strokeWidth: 1, strokeColor: S },
        { id: "su4", type: "line", x1: -65, y1: 10, x2: -35, y2: 10, strokeWidth: 1, strokeColor: S },
        { id: "su5", type: "line", x1: -65, y1: 30, x2: -35, y2: 30, strokeWidth: 1, strokeColor: S },
        // Right flight
        { id: "su6", type: "rectangle", x: 35, y: -50, width: 30, height: 100, strokeWidth: 2, strokeColor: S, fillColor: "transparent" },
        { id: "su7", type: "line", x1: 35, y1: -30, x2: 65, y2: -30, strokeWidth: 1, strokeColor: S },
        { id: "su8", type: "line", x1: 35, y1: -10, x2: 65, y2: -10, strokeWidth: 1, strokeColor: S },
        { id: "su9", type: "line", x1: 35, y1: 10, x2: 65, y2: 10, strokeWidth: 1, strokeColor: S },
        { id: "su10", type: "line", x1: 35, y1: 30, x2: 65, y2: 30, strokeWidth: 1, strokeColor: S },
        // Landing
        { id: "su11", type: "rectangle", x: -35, y: -50, width: 70, height: 100, strokeWidth: 2, strokeColor: S, fillColor: "#F3F4F6" },
      ],
    },
  },
  {
    id: "elevator", label: "Elevator", icon: "🔼", category: "structural",
    def: {
      id: "elevator", name: "Elevator", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "el1", type: "rectangle", x: -35, y: -35, width: 70, height: 70, strokeWidth: 2, strokeColor: S, fillColor: "#F3F4F6" },
        { id: "el2", type: "line", x1: -35, y1: -35, x2: 35, y2: 35, strokeWidth: 1, strokeColor: "#9CA3AF" },
        { id: "el3", type: "line", x1: 35, y1: -35, x2: -35, y2: 35, strokeWidth: 1, strokeColor: "#9CA3AF" },
        { id: "el4", type: "circle", cx: 0, cy: 0, radius: 10, strokeWidth: 1.5, strokeColor: "#374151", fillColor: "#E5E7EB" },
        // Up arrow
        { id: "el5", type: "line", x1: -3, y1: 3, x2: 0, y2: -5, strokeWidth: 1.5, strokeColor: S },
        { id: "el6", type: "line", x1: 3, y1: 3, x2: 0, y2: -5, strokeWidth: 1.5, strokeColor: S },
      ],
    },
  },
  {
    id: "ramp", label: "Ramp", icon: "📐", category: "structural",
    def: {
      id: "ramp", name: "Ramp / Wheelchair", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "rm1", type: "rectangle", x: -40, y: -55, width: 80, height: 110, strokeWidth: 2, strokeColor: S, fillColor: "rgba(16,185,129,0.08)" },
        { id: "rm2", type: "line", x1: -40, y1: 55, x2: 40, y2: -55, strokeWidth: 1.5, strokeColor: "#10B981" },
        { id: "rm3", type: "line", x1: 40, y1: -55, x2: 25, y2: -55, strokeWidth: 1.5, strokeColor: "#10B981" },
        { id: "rm4", type: "line", x1: 40, y1: -55, x2: 40, y2: -40, strokeWidth: 1.5, strokeColor: "#10B981" },
      ],
    },
  },
  {
    id: "door", label: "Door (single)", icon: "🚪", category: "structural",
    def: {
      id: "door", name: "Door Single", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "do1", type: "rectangle", x: 0, y: -40, width: 40, height: 40, strokeWidth: 1.5, strokeColor: "#78350F", fillColor: "#FEF3C7" },
        { id: "do2", type: "arc", cx: 0, cy: 0, radius: 40, startAngle: 270, endAngle: 360, strokeWidth: 1, lineType: "dashed", strokeColor: "#9CA3AF" },
      ],
    },
  },
  {
    id: "door-double", label: "Door (double)", icon: "🚪", category: "structural",
    def: {
      id: "door-double", name: "Door Double", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "dd1", type: "rectangle", x: -40, y: -40, width: 40, height: 40, strokeWidth: 1.5, strokeColor: "#78350F", fillColor: "#FEF3C7" },
        { id: "dd2", type: "arc", cx: 0, cy: 0, radius: 40, startAngle: 180, endAngle: 270, strokeWidth: 1, lineType: "dashed", strokeColor: "#9CA3AF" },
        { id: "dd3", type: "rectangle", x: 0, y: -40, width: 40, height: 40, strokeWidth: 1.5, strokeColor: "#78350F", fillColor: "#FEF3C7" },
        { id: "dd4", type: "arc", cx: 0, cy: 0, radius: 40, startAngle: 270, endAngle: 360, strokeWidth: 1, lineType: "dashed", strokeColor: "#9CA3AF" },
      ],
    },
  },
  {
    id: "window", label: "Window", icon: "🪟", category: "structural",
    def: {
      id: "window", name: "Window", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "wn1", type: "rectangle", x: -30, y: -6, width: 60, height: 12, strokeWidth: 1.5, strokeColor: "#2563EB", fillColor: "#EFF6FF" },
        { id: "wn2", type: "line", x1: -30, y1: 0, x2: 30, y2: 0, strokeWidth: 1, strokeColor: "#93C5FD" },
        { id: "wn3", type: "line", x1: 0, y1: -6, x2: 0, y2: 6, strokeWidth: 0.5, strokeColor: "#BFDBFE" },
      ],
    },
  },
];

// ─── ELECTRICAL ───────────────────────────────────────────────────────────────
const electrical: CatalogBlock[] = [
  {
    id: "outlet", label: "Outlet", icon: "🔌", category: "electrical",
    def: {
      id: "outlet", name: "Electrical Outlet", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "ou1", type: "circle", cx: 0, cy: 0, radius: 12, strokeWidth: 1.5, strokeColor: S, fillColor: "#F9FAFB" },
        { id: "ou2", type: "line", x1: -4, y1: -5, x2: -4, y2: 5, strokeWidth: 1.5, strokeColor: S },
        { id: "ou3", type: "line", x1: 4, y1: -5, x2: 4, y2: 5, strokeWidth: 1.5, strokeColor: S },
      ],
    },
  },
  {
    id: "switch", label: "Switch", icon: "🔆", category: "electrical",
    def: {
      id: "switch", name: "Light Switch", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "sw1", type: "rectangle", x: -8, y: -12, width: 16, height: 24, strokeWidth: 1.5, strokeColor: S, fillColor: "#F9FAFB" },
        { id: "sw2", type: "line", x1: 0, y1: -8, x2: 0, y2: 8, strokeWidth: 2, strokeColor: "#374151" },
      ],
    },
  },
  {
    id: "ceiling-light", label: "Ceiling Light", icon: "💡", category: "electrical",
    def: {
      id: "ceiling-light", name: "Ceiling Light", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "cl1", type: "circle", cx: 0, cy: 0, radius: 18, strokeWidth: 1.5, strokeColor: "#B45309", fillColor: "rgba(254,240,138,0.3)" },
        { id: "cl2", type: "circle", cx: 0, cy: 0, radius: 6, strokeWidth: 1, strokeColor: "#D97706", fillColor: "#FEF08A" },
        { id: "cl3", type: "line", x1: 0, y1: -18, x2: 0, y2: 0, strokeWidth: 1, strokeColor: "#111827" },
        { id: "cl4", type: "line", x1: 13, y1: -13, x2: 5, y2: -5, strokeWidth: 0.8, strokeColor: "#D97706" },
        { id: "cl5", type: "line", x1: -13, y1: -13, x2: -5, y2: -5, strokeWidth: 0.8, strokeColor: "#D97706" },
        { id: "cl6", type: "line", x1: 13, y1: 13, x2: 5, y2: 5, strokeWidth: 0.8, strokeColor: "#D97706" },
        { id: "cl7", type: "line", x1: -13, y1: 13, x2: -5, y2: 5, strokeWidth: 0.8, strokeColor: "#D97706" },
        { id: "cl8", type: "line", x1: 18, y1: 0, x2: 6, y2: 0, strokeWidth: 0.8, strokeColor: "#D97706" },
        { id: "cl9", type: "line", x1: -18, y1: 0, x2: -6, y2: 0, strokeWidth: 0.8, strokeColor: "#D97706" },
      ],
    },
  },
  {
    id: "ac-unit", label: "A/C Unit", icon: "❄", category: "electrical",
    def: {
      id: "ac-unit", name: "A/C Unit (wall)", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "ac1", type: "rectangle", x: -45, y: -15, width: 90, height: 30, strokeWidth: 2, strokeColor: "#1E40AF", fillColor: "#EFF6FF" },
        { id: "ac2", type: "line", x1: -38, y1: -5, x2: 38, y2: -5, strokeWidth: 0.8, strokeColor: "#93C5FD" },
        { id: "ac3", type: "line", x1: -38, y1: 0, x2: 38, y2: 0, strokeWidth: 0.8, strokeColor: "#93C5FD" },
        { id: "ac4", type: "line", x1: -38, y1: 5, x2: 38, y2: 5, strokeWidth: 0.8, strokeColor: "#93C5FD" },
        { id: "ac5", type: "circle", cx: 35, cy: 0, radius: 5, strokeWidth: 1, strokeColor: "#1E40AF", fillColor: "#DBEAFE" },
      ],
    },
  },
  {
    id: "smoke-detector", label: "Smoke Detector", icon: "🔔", category: "electrical",
    def: {
      id: "smoke-detector", name: "Smoke Detector", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "sd1", type: "circle", cx: 0, cy: 0, radius: 10, strokeWidth: 1.5, strokeColor: "#DC2626", fillColor: "#FEE2E2" },
        { id: "sd2", type: "circle", cx: 0, cy: 0, radius: 4, strokeWidth: 1, strokeColor: "#DC2626", fillColor: "#DC2626" },
        { id: "sd3", type: "line", x1: -10, y1: 0, x2: -15, y2: -8, strokeWidth: 0.8, strokeColor: "#DC2626" },
        { id: "sd4", type: "line", x1: 10, y1: 0, x2: 15, y2: -8, strokeWidth: 0.8, strokeColor: "#DC2626" },
      ],
    },
  },
];

// ─── LANDSCAPE ────────────────────────────────────────────────────────────────
const landscape: CatalogBlock[] = [
  {
    id: "plant", label: "Plant (pot)", icon: "🪴", category: "landscape",
    def: {
      id: "plant", name: "Plant", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "pl1", type: "circle", cx: 0, cy: 0, radius: 16, strokeWidth: 2, strokeColor: "#111827", fillColor: "#D1D5DB" },
        { id: "pl2", type: "circle", cx: 0, cy: -10, radius: 9, strokeWidth: 1, strokeColor: "#059669", fillColor: "#34D399" },
        { id: "pl3", type: "circle", cx: 11, cy: 4, radius: 8, strokeWidth: 1, strokeColor: "#059669", fillColor: "#34D399" },
        { id: "pl4", type: "circle", cx: -11, cy: 4, radius: 8, strokeWidth: 1, strokeColor: "#059669", fillColor: "#34D399" },
      ],
    },
  },
  {
    id: "tree-circle", label: "Tree (top)", icon: "🌳", category: "landscape",
    def: {
      id: "tree-circle", name: "Tree Top View", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "tc1", type: "circle", cx: 0, cy: 0, radius: 30, strokeWidth: 1.5, strokeColor: "#15803D", fillColor: "rgba(21,128,61,0.15)" },
        { id: "tc2", type: "circle", cx: 0, cy: 0, radius: 18, strokeWidth: 1, strokeColor: "#15803D", fillColor: "rgba(21,128,61,0.25)" },
        { id: "tc3", type: "circle", cx: -8, cy: -8, radius: 10, strokeWidth: 0.8, strokeColor: "#15803D", fillColor: "rgba(21,128,61,0.3)" },
        { id: "tc4", type: "circle", cx: 8, cy: 5, radius: 8, strokeWidth: 0.8, strokeColor: "#15803D", fillColor: "rgba(21,128,61,0.3)" },
        { id: "tc5", type: "circle", cx: 0, cy: 0, radius: 4, strokeWidth: 1, strokeColor: "#92400E", fillColor: "#A16207" },
      ],
    },
  },
  {
    id: "tree-large", label: "Tree (large)", icon: "🌲", category: "landscape",
    def: {
      id: "tree-large", name: "Tree Large", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "tl1", type: "circle", cx: 0, cy: 0, radius: 50, strokeWidth: 1.5, strokeColor: "#15803D", fillColor: "rgba(21,128,61,0.1)" },
        { id: "tl2", type: "circle", cx: 0, cy: 0, radius: 35, strokeWidth: 1, strokeColor: "#15803D", fillColor: "rgba(21,128,61,0.18)" },
        { id: "tl3", type: "circle", cx: -15, cy: -12, radius: 20, strokeWidth: 0.8, strokeColor: "#15803D", fillColor: "rgba(21,128,61,0.25)" },
        { id: "tl4", type: "circle", cx: 12, cy: 10, radius: 18, strokeWidth: 0.8, strokeColor: "#15803D", fillColor: "rgba(21,128,61,0.25)" },
        { id: "tl5", type: "circle", cx: 0, cy: 0, radius: 6, strokeWidth: 1.5, strokeColor: "#92400E", fillColor: "#A16207" },
      ],
    },
  },
  {
    id: "car", label: "Car", icon: "🚗", category: "landscape",
    def: {
      id: "car", name: "Car", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "cr1", type: "rectangle", x: -26, y: -55, width: 52, height: 110, strokeWidth: 2, strokeColor: S, fillColor: "#E5E7EB" },
        { id: "cr2", type: "rectangle", x: -20, y: -25, width: 40, height: 50, strokeWidth: 1, strokeColor: "#38BDF8", fillColor: "#BAE6FD" },
        { id: "cr3", type: "circle", cx: -18, cy: -48, radius: 7, strokeWidth: 1, strokeColor: "#374151", fillColor: "#1F2937" },
        { id: "cr4", type: "circle", cx: 18, cy: -48, radius: 7, strokeWidth: 1, strokeColor: "#374151", fillColor: "#1F2937" },
        { id: "cr5", type: "circle", cx: -18, cy: 48, radius: 7, strokeWidth: 1, strokeColor: "#374151", fillColor: "#1F2937" },
        { id: "cr6", type: "circle", cx: 18, cy: 48, radius: 7, strokeWidth: 1, strokeColor: "#374151", fillColor: "#1F2937" },
      ],
    },
  },
  {
    id: "parking-space", label: "Parking", icon: "🅿", category: "landscape",
    def: {
      id: "parking-space", name: "Parking Space", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "ps1", type: "rectangle", x: -30, y: -60, width: 60, height: 120, strokeWidth: 1.5, strokeColor: "#374151", fillColor: "rgba(55,65,81,0.05)" },
        { id: "ps2", type: "text", x: -6, y: 6, text: "P", fontSize: 22, strokeColor: "#6B7280" },
      ],
    },
  },
  {
    id: "swimming-pool", label: "Pool", icon: "🏊", category: "landscape",
    def: {
      id: "swimming-pool", name: "Swimming Pool", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "sp1", type: "rectangle", x: -70, y: -40, width: 140, height: 80, strokeWidth: 2, strokeColor: "#0EA5E9", fillColor: "rgba(14,165,233,0.15)" },
        { id: "sp2", type: "line", x1: -70, y1: -20, x2: 70, y2: -20, strokeWidth: 0.8, strokeColor: "#7DD3FC", lineType: "dashed" },
        { id: "sp3", type: "line", x1: -70, y1: 0, x2: 70, y2: 0, strokeWidth: 0.8, strokeColor: "#7DD3FC", lineType: "dashed" },
        { id: "sp4", type: "line", x1: -70, y1: 20, x2: 70, y2: 20, strokeWidth: 0.8, strokeColor: "#7DD3FC", lineType: "dashed" },
      ],
    },
  },
];

// ─── ELEVATION ────────────────────────────────────────────────────────────────
const elevation: CatalogBlock[] = [
  {
    id: "win-elev", label: "Window (elev.)", icon: "🪟", category: "elevation",
    def: {
      id: "win-elev", name: "Window Elevation", insertionPoint: { x: 0, y: 0 },
      elements: [
        // Outer frame
        { id: "we1", type: "rectangle", x: -30, y: -45, width: 60, height: 90, strokeWidth: 2, strokeColor: S, fillColor: "transparent" },
        // Glass pane
        { id: "we2", type: "rectangle", x: -24, y: -39, width: 48, height: 78, strokeWidth: 1, strokeColor: "#60A5FA", fillColor: "rgba(219,234,254,0.35)" },
        // Center mullion (vertical)
        { id: "we3", type: "line", x1: 0, y1: -39, x2: 0, y2: 39, strokeWidth: 1.5, strokeColor: S },
        // Center rail (horizontal)
        { id: "we4", type: "line", x1: -24, y1: 0, x2: 24, y2: 0, strokeWidth: 1.5, strokeColor: S },
        // Sill projection
        { id: "we5", type: "rectangle", x: -34, y: 39, width: 68, height: 8, strokeWidth: 1.5, strokeColor: S, fillColor: "#E5E7EB" },
        // Sill nosing
        { id: "we6", type: "line", x1: -34, y1: 47, x2: 34, y2: 47, strokeWidth: 1, strokeColor: S },
      ],
    },
  },
  {
    id: "win-arch-elev", label: "Arched Window", icon: "⛪", category: "elevation",
    def: {
      id: "win-arch-elev", name: "Arched Window Elevation", insertionPoint: { x: 0, y: 0 },
      elements: [
        // Side jambs
        { id: "wa1", type: "line", x1: -28, y1: 40, x2: -28, y2: -15, strokeWidth: 2, strokeColor: S },
        { id: "wa2", type: "line", x1: 28, y1: 40, x2: 28, y2: -15, strokeWidth: 2, strokeColor: S },
        // Sill
        { id: "wa3", type: "line", x1: -32, y1: 40, x2: 32, y2: 40, strokeWidth: 2, strokeColor: S },
        // Arch (semicircle)
        { id: "wa4", type: "arc", cx: 0, cy: -15, radius: 28, startAngle: 180, endAngle: 360, strokeWidth: 2, strokeColor: S },
        // Spring line
        { id: "wa5", type: "line", x1: -28, y1: -15, x2: 28, y2: -15, strokeWidth: 1, strokeColor: S },
        // Glazing bars
        { id: "wa6", type: "line", x1: 0, y1: -15, x2: 0, y2: 40, strokeWidth: 1, strokeColor: "#60A5FA" },
        { id: "wa7", type: "line", x1: -28, y1: 12, x2: 28, y2: 12, strokeWidth: 1, strokeColor: "#60A5FA" },
        // Keystone
        { id: "wa8", type: "rectangle", x: -5, y: -45, width: 10, height: 14, strokeWidth: 1, strokeColor: S, fillColor: "#E5E7EB" },
        // Sill projection
        { id: "wa9", type: "rectangle", x: -32, y: 40, width: 64, height: 7, strokeWidth: 1.5, strokeColor: S, fillColor: "#E5E7EB" },
      ],
    },
  },
  {
    id: "door-elev", label: "Door (elev.)", icon: "🚪", category: "elevation",
    def: {
      id: "door-elev", name: "Door Elevation", insertionPoint: { x: 0, y: 0 },
      elements: [
        // Outer frame
        { id: "de1", type: "rectangle", x: -28, y: -55, width: 56, height: 110, strokeWidth: 2.5, strokeColor: S, fillColor: "#FEF9C3" },
        // Top panel
        { id: "de2", type: "rectangle", x: -20, y: -48, width: 40, height: 30, strokeWidth: 1, strokeColor: "#92400E", fillColor: "rgba(120,53,15,0.06)" },
        // Upper mid panel
        { id: "de3", type: "rectangle", x: -20, y: -12, width: 40, height: 20, strokeWidth: 1, strokeColor: "#92400E", fillColor: "rgba(120,53,15,0.06)" },
        // Lower panel
        { id: "de4", type: "rectangle", x: -20, y: 14, width: 40, height: 34, strokeWidth: 1, strokeColor: "#92400E", fillColor: "rgba(120,53,15,0.06)" },
        // Handle
        { id: "de5", type: "circle", cx: 18, cy: 2, radius: 3, strokeWidth: 1.5, strokeColor: "#78350F", fillColor: "#D97706" },
        { id: "de6", type: "line", x1: 18, y1: -8, x2: 18, y2: 12, strokeWidth: 2, strokeColor: "#78350F" },
        // Threshold
        { id: "de7", type: "rectangle", x: -30, y: 54, width: 60, height: 5, strokeWidth: 1.5, strokeColor: S, fillColor: "#E5E7EB" },
      ],
    },
  },
  {
    id: "column-elev", label: "Column (elev.)", icon: "🏛", category: "elevation",
    def: {
      id: "column-elev", name: "Classical Column", insertionPoint: { x: 0, y: 0 },
      elements: [
        // Abacus (top of capital)
        { id: "ce1", type: "rectangle", x: -22, y: -68, width: 44, height: 10, strokeWidth: 2, strokeColor: S, fillColor: "#F1F5F9" },
        // Echinus
        { id: "ce2", type: "rectangle", x: -16, y: -58, width: 32, height: 8, strokeWidth: 1.5, strokeColor: S, fillColor: "#F1F5F9" },
        // Shaft (tapered polyline)
        {
          id: "ce3", type: "polyline",
          points: [{ x: -12, y: -50 }, { x: 12, y: -50 }, { x: 8, y: 50 }, { x: -8, y: 50 }],
          closed: true, strokeWidth: 1.5, strokeColor: S, fillColor: "#F8FAFC"
        },
        // Shaft flute lines
        { id: "ce4", type: "line", x1: -4, y1: -50, x2: -2, y2: 50, strokeWidth: 0.5, strokeColor: "#CBD5E1" },
        { id: "ce5", type: "line", x1: 4, y1: -50, x2: 2, y2: 50, strokeWidth: 0.5, strokeColor: "#CBD5E1" },
        // Base torus
        { id: "ce6", type: "rectangle", x: -14, y: 50, width: 28, height: 7, strokeWidth: 1.5, strokeColor: S, fillColor: "#F1F5F9" },
        // Plinth
        { id: "ce7", type: "rectangle", x: -20, y: 57, width: 40, height: 8, strokeWidth: 2, strokeColor: S, fillColor: "#E5E7EB" },
      ],
    },
  },
  {
    id: "cornice-elev", label: "Cornice (elev.)", icon: "🏗", category: "elevation",
    def: {
      id: "cornice-elev", name: "Cornice Elevation", insertionPoint: { x: 0, y: 0 },
      elements: [
        // Cornice bed
        { id: "cn1", type: "rectangle", x: -55, y: -20, width: 110, height: 12, strokeWidth: 2, strokeColor: S, fillColor: "#F1F5F9" },
        // Frieze
        { id: "cn2", type: "rectangle", x: -55, y: -8, width: 110, height: 20, strokeWidth: 1.5, strokeColor: S, fillColor: "#FAFAFA" },
        // Architrave
        { id: "cn3", type: "rectangle", x: -55, y: 12, width: 110, height: 10, strokeWidth: 1.5, strokeColor: S, fillColor: "#F1F5F9" },
        // Dentils in frieze (7 evenly spaced)
        { id: "cn4", type: "rectangle", x: -48, y: -6, width: 8, height: 14, strokeWidth: 0.8, strokeColor: S, fillColor: "#E5E7EB" },
        { id: "cn5", type: "rectangle", x: -32, y: -6, width: 8, height: 14, strokeWidth: 0.8, strokeColor: S, fillColor: "#E5E7EB" },
        { id: "cn6", type: "rectangle", x: -16, y: -6, width: 8, height: 14, strokeWidth: 0.8, strokeColor: S, fillColor: "#E5E7EB" },
        { id: "cn7", type: "rectangle", x: 0, y: -6, width: 8, height: 14, strokeWidth: 0.8, strokeColor: S, fillColor: "#E5E7EB" },
        { id: "cn8", type: "rectangle", x: 16, y: -6, width: 8, height: 14, strokeWidth: 0.8, strokeColor: S, fillColor: "#E5E7EB" },
        { id: "cn9", type: "rectangle", x: 32, y: -6, width: 8, height: 14, strokeWidth: 0.8, strokeColor: S, fillColor: "#E5E7EB" },
        { id: "cn10", type: "rectangle", x: 40, y: -6, width: 8, height: 14, strokeWidth: 0.8, strokeColor: S, fillColor: "#E5E7EB" },
        // Crown line
        { id: "cn11", type: "line", x1: -55, y1: -20, x2: 55, y2: -20, strokeWidth: 2, strokeColor: S },
      ],
    },
  },
  {
    id: "balustrade-elev", label: "Balustrade", icon: "🔧", category: "elevation",
    def: {
      id: "balustrade-elev", name: "Balustrade Section", insertionPoint: { x: 0, y: 0 },
      elements: [
        // Top rail
        { id: "bl1", type: "rectangle", x: -55, y: -35, width: 110, height: 8, strokeWidth: 2, strokeColor: S, fillColor: "#E5E7EB" },
        // Bottom rail
        { id: "bl2", type: "rectangle", x: -55, y: 25, width: 110, height: 8, strokeWidth: 2, strokeColor: S, fillColor: "#E5E7EB" },
        // Balusters (5 evenly spaced)
        { id: "bl3", type: "rectangle", x: -48, y: -27, width: 8, height: 52, strokeWidth: 1.5, strokeColor: S, fillColor: "#F8FAFC" },
        { id: "bl4", type: "rectangle", x: -24, y: -27, width: 8, height: 52, strokeWidth: 1.5, strokeColor: S, fillColor: "#F8FAFC" },
        { id: "bl5", type: "rectangle", x: 0, y: -27, width: 8, height: 52, strokeWidth: 1.5, strokeColor: S, fillColor: "#F8FAFC" },
        { id: "bl6", type: "rectangle", x: 16, y: -27, width: 8, height: 52, strokeWidth: 1.5, strokeColor: S, fillColor: "#F8FAFC" },
        { id: "bl7", type: "rectangle", x: 40, y: -27, width: 8, height: 52, strokeWidth: 1.5, strokeColor: S, fillColor: "#F8FAFC" },
      ],
    },
  },
  {
    id: "roof-hip-elev", label: "Hip Roof (elev.)", icon: "🏠", category: "elevation",
    def: {
      id: "roof-hip-elev", name: "Hip Roof Elevation", insertionPoint: { x: 0, y: 0 },
      elements: [
        // Roof outline (hip profile)
        {
          id: "rh1", type: "polyline",
          points: [{ x: -60, y: 20 }, { x: -40, y: 20 }, { x: 0, y: -30 }, { x: 40, y: 20 }, { x: 60, y: 20 }],
          closed: false, strokeWidth: 2.5, strokeColor: S
        },
        // Fascia
        { id: "rh2", type: "rectangle", x: -60, y: 20, width: 120, height: 8, strokeWidth: 2, strokeColor: S, fillColor: "#E5E7EB" },
        // Shingle lines (horizontal)
        { id: "rh3", type: "line", x1: -28, y1: 10, x2: 28, y2: 10, strokeWidth: 0.8, strokeColor: "#9CA3AF" },
        { id: "rh4", type: "line", x1: -18, y1: 0, x2: 18, y2: 0, strokeWidth: 0.8, strokeColor: "#9CA3AF" },
        { id: "rh5", type: "line", x1: -8, y1: -10, x2: 8, y2: -10, strokeWidth: 0.8, strokeColor: "#9CA3AF" },
        // Ridge
        { id: "rh6", type: "circle", cx: 0, cy: -30, radius: 3, strokeWidth: 1.5, strokeColor: S, fillColor: "#E5E7EB" },
      ],
    },
  },
];

// ─── ANNOTATION ───────────────────────────────────────────────────────────────
const annotation: CatalogBlock[] = [
  {
    id: "detail-bubble", label: "Detail Bubble", icon: "🔵", category: "annotation",
    def: {
      id: "detail-bubble", name: "Detail Bubble", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "db1", type: "circle", cx: 0, cy: 0, radius: 18, strokeWidth: 1.5, strokeColor: S, fillColor: "#FFFFFF" },
        { id: "db2", type: "line", x1: -18, y1: 0, x2: 18, y2: 0, strokeWidth: 1, strokeColor: S },
        { id: "db3", type: "text", x: 0, y: -3, text: "01", fontSize: 10, fontWeight: "bold", textAlign: "center", strokeColor: S },
        { id: "db4", type: "text", x: 0, y: 12, text: "A1", fontSize: 8, textAlign: "center", strokeColor: "#6B7280" },
      ],
    },
  },
  {
    id: "section-arrow", label: "Section Arrow", icon: "✂", category: "annotation",
    def: {
      id: "section-arrow", name: "Section Cut Arrow", insertionPoint: { x: 0, y: 0 },
      elements: [
        // Cutting plane line
        { id: "sa1", type: "line", x1: -50, y1: 0, x2: 50, y2: 0, strokeWidth: 1.5, strokeColor: S, lineType: "dashed" },
        // Left arrow block (filled triangle)
        {
          id: "sa2", type: "polyline",
          points: [{ x: -50, y: 0 }, { x: -40, y: -8 }, { x: -40, y: 8 }],
          closed: true, strokeWidth: 1, strokeColor: S, fillColor: S
        },
        // Right arrow block
        {
          id: "sa3", type: "polyline",
          points: [{ x: 50, y: 0 }, { x: 40, y: -8 }, { x: 40, y: 8 }],
          closed: true, strokeWidth: 1, strokeColor: S, fillColor: S
        },
        // Section ticks
        { id: "sa4", type: "line", x1: -50, y1: -10, x2: -50, y2: 10, strokeWidth: 2, strokeColor: S },
        { id: "sa5", type: "line", x1: 50, y1: -10, x2: 50, y2: 10, strokeWidth: 2, strokeColor: S },
        // Labels
        { id: "sa6", type: "text", x: -50, y: 22, text: "A", fontSize: 12, fontWeight: "bold", textAlign: "center", strokeColor: S },
        { id: "sa7", type: "text", x: 50, y: 22, text: "A", fontSize: 12, fontWeight: "bold", textAlign: "center", strokeColor: S },
      ],
    },
  },
  {
    id: "north-arrow", label: "North Arrow", icon: "🧭", category: "annotation",
    def: {
      id: "north-arrow", name: "North Arrow", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "na1", type: "circle", cx: 0, cy: 0, radius: 22, strokeWidth: 1.5, strokeColor: S, fillColor: "#FAFAFA" },
        // Arrow shaft
        { id: "na2", type: "line", x1: 0, y1: 14, x2: 0, y2: -14, strokeWidth: 1.5, strokeColor: S },
        // Arrow head (filled)
        {
          id: "na3", type: "polyline",
          points: [{ x: 0, y: -18 }, { x: -6, y: -8 }, { x: 6, y: -8 }],
          closed: true, strokeWidth: 1, strokeColor: S, fillColor: S
        },
        // N label
        { id: "na4", type: "text", x: 0, y: 28, text: "N", fontSize: 11, fontWeight: "bold", textAlign: "center", strokeColor: S },
      ],
    },
  },
  {
    id: "elevation-marker", label: "Elevation Marker", icon: "📐", category: "annotation",
    def: {
      id: "elevation-marker", name: "Elevation Datum Marker", insertionPoint: { x: 0, y: 0 },
      elements: [
        // Diamond marker
        {
          id: "em1", type: "polyline",
          points: [{ x: 0, y: -14 }, { x: 14, y: 0 }, { x: 0, y: 14 }, { x: -14, y: 0 }],
          closed: true, strokeWidth: 1.5, strokeColor: S, fillColor: "#FFFFFF"
        },
        // Horizontal leader line
        { id: "em2", type: "line", x1: 14, y1: 0, x2: 40, y2: 0, strokeWidth: 1, strokeColor: S },
        // Level label
        { id: "em3", type: "text", x: 44, y: 4, text: "±0.000", fontSize: 9, strokeColor: S },
      ],
    },
  },
  {
    id: "grid-bubble", label: "Grid Bubble", icon: "⭕", category: "annotation",
    def: {
      id: "grid-bubble", name: "Grid Axis Bubble", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "gb1", type: "circle", cx: 0, cy: 0, radius: 16, strokeWidth: 1.5, strokeColor: S, fillColor: "#FFFFFF" },
        { id: "gb2", type: "text", x: 0, y: 6, text: "A", fontSize: 14, fontWeight: "bold", textAlign: "center", strokeColor: S },
        // Axis line stub (down from bubble)
        { id: "gb3", type: "line", x1: 0, y1: 16, x2: 0, y2: 35, strokeWidth: 1, strokeColor: "#9CA3AF", lineType: "dashed" },
      ],
    },
  },
  {
    id: "room-tag", label: "Room Tag", icon: "🏷", category: "annotation",
    def: {
      id: "room-tag", name: "Room Tag", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "rt1", type: "rectangle", x: -36, y: -14, width: 72, height: 28, strokeWidth: 1.5, strokeColor: "#2563EB", fillColor: "rgba(239,246,255,0.9)" },
        { id: "rt2", type: "text", x: 0, y: -2, text: "ROOM", fontSize: 10, fontWeight: "bold", textAlign: "center", strokeColor: "#1D4ED8" },
        { id: "rt3", type: "text", x: 0, y: 11, text: "00.00 m²", fontSize: 8, textAlign: "center", strokeColor: "#3B82F6" },
      ],
    },
  },
  {
    id: "breakline", label: "Break Line", icon: "〰", category: "annotation",
    def: {
      id: "breakline", name: "Break Line", insertionPoint: { x: 0, y: 0 },
      elements: [
        { id: "br1", type: "line", x1: -45, y1: 0, x2: -15, y2: 0, strokeWidth: 1.5, strokeColor: S },
        {
          id: "br2", type: "polyline",
          points: [{ x: -15, y: 0 }, { x: -5, y: -12 }, { x: 5, y: 12 }, { x: 15, y: 0 }],
          closed: false, strokeWidth: 1.5, strokeColor: S
        },
        { id: "br3", type: "line", x1: 15, y1: 0, x2: 45, y2: 0, strokeWidth: 1.5, strokeColor: S },
      ],
    },
  },
];

// ─── Full catalog export ───────────────────────────────────────────────────────
export const BLOCK_CATALOG: CatalogBlock[] = [
  ...living,
  ...bedroom,
  ...dining,
  ...kitchen,
  ...bathroom,
  ...office,
  ...structural,
  ...electrical,
  ...landscape,
  ...elevation,
  ...annotation,
];

export const CATEGORY_META: Record<BlockCategory, { label: string; icon: string; color: string }> = {
  living:     { label: "Living",      icon: "🛋", color: "bg-blue-500/20 text-blue-300" },
  bedroom:    { label: "Bedroom",     icon: "🛏", color: "bg-purple-500/20 text-purple-300" },
  dining:     { label: "Dining",      icon: "🍽", color: "bg-amber-500/20 text-amber-300" },
  kitchen:    { label: "Kitchen",     icon: "🍳", color: "bg-orange-500/20 text-orange-300" },
  bathroom:   { label: "Bath",        icon: "🚿", color: "bg-cyan-500/20 text-cyan-300" },
  office:     { label: "Office",      icon: "🖥", color: "bg-green-500/20 text-green-300" },
  structural: { label: "Structure",   icon: "🏗", color: "bg-slate-500/20 text-slate-300" },
  electrical: { label: "Electrical",  icon: "⚡", color: "bg-yellow-500/20 text-yellow-300" },
  landscape:  { label: "Landscape",   icon: "🌳", color: "bg-emerald-500/20 text-emerald-300" },
  elevation:  { label: "Elevation",   icon: "🏛", color: "bg-indigo-500/20 text-indigo-300" },
  annotation: { label: "Annotation",  icon: "📍", color: "bg-red-500/20 text-red-300" },
};

export const ALL_BLOCK_DEFS = Object.fromEntries(
  BLOCK_CATALOG.map(b => [b.id, b.def])
) as unknown as Record<string, BlockDef>;
