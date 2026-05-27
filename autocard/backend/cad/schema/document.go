// Package schema defines the canonical CAD document model.
// These structs mirror the TypeScript types in cad/contracts/document.ts.
// When TS types change, update this file in the same commit.
package schema

import "encoding/json"

type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type UnitSystem string

const (
	UnitMM   UnitSystem = "mm"
	UnitCM   UnitSystem = "cm"
	UnitM    UnitSystem = "m"
	UnitInch UnitSystem = "inch"
	UnitFt   UnitSystem = "ft"
)

type DocumentSettings struct {
	Units                 UnitSystem `json:"units"`
	Precision             int        `json:"precision"`
	AngleUnit             string     `json:"angleUnit"`
	GridSpacing           float64    `json:"gridSpacing"`
	SnapThreshold         float64    `json:"snapThreshold"`
	DefaultLayerID        string     `json:"defaultLayerId"`
	DefaultStyleID        string     `json:"defaultStyleId"`
	WallDefaultThickness  float64    `json:"wallDefaultThickness"`
	DimensionStyle        string     `json:"dimensionStyle"`
}

// CadDocument mirrors cad/contracts/document.ts CadDocument.
type CadDocument struct {
	SchemaVersion int                        `json:"schemaVersion"`
	DocumentID    string                     `json:"documentId"`
	Name          string                     `json:"name"`
	CreatedAt     string                     `json:"createdAt"`
	UpdatedAt     string                     `json:"updatedAt"`
	Units         UnitSystem                 `json:"units"`
	Settings      DocumentSettings           `json:"settings"`
	Roots         []string                   `json:"roots"`
	Nodes         map[string]json.RawMessage `json:"nodes"`
	Layers        map[string]LayerDef        `json:"layers"`
	Styles        map[string]StyleDef        `json:"styles"`
	Blocks        map[string]json.RawMessage `json:"blocks"`
	Views         map[string]ViewDef         `json:"views"`
	Sheets        map[string]SheetDef        `json:"sheets"`
	Constraints   map[string]ConstraintDef   `json:"constraints"`
	Derived       *DerivedDocumentState      `json:"derived,omitempty"`
	Metadata      map[string]interface{}     `json:"metadata,omitempty"`
}

// DerivedDocumentState mirrors cad/contracts/document.ts DerivedDocumentState.
type DerivedDocumentState struct {
	Revision            int                             `json:"revision"`
	FromDocumentVersion int                             `json:"fromDocumentVersion"`
	WallPolygons        map[string]WallPolygonCache     `json:"wallPolygons"`
	WallJoins           map[string]WallJoinCache        `json:"wallJoins"`
	RoomGraphs          map[string]RoomGraphCache       `json:"roomGraphs"`
	RoomLabels          map[string]RoomLabelCache       `json:"roomLabels"`
	OpeningPlacements   map[string]OpeningPlacementCache `json:"openingPlacements"`
	NodeBounds          map[string]BoundsCache          `json:"nodeBounds"`
	LayerVisibility     map[string]LayerVisibilityCache `json:"layerVisibility"`
	SnapIndex           *SnapIndexCache                 `json:"snapIndex,omitempty"`
	SpatialIndex        *SpatialIndexCache              `json:"spatialIndex,omitempty"`
	RenderIndex         *RenderIndexCache               `json:"renderIndex,omitempty"`
	Diagnostics         []DerivedDiagnostic             `json:"diagnostics"`
}

type WallPolygonCache struct {
	NodeID     string    `json:"nodeId"`
	Outline    []Point   `json:"outline"`
	CenterLine []Point   `json:"centerLine"`
	Thickness  float64   `json:"thickness"`
	JoinsWith  []string  `json:"joinsWith"`
}

type WallJoinCache struct {
	NodeID              string             `json:"nodeId"`
	JoinTypeByNeighbor  map[string]string  `json:"joinTypeByNeighbor"`
	IntersectionPoints  []Point            `json:"intersectionPoints"`
}

type RoomGraphCache struct {
	NodeID     string   `json:"nodeId"`
	Boundary   []Point  `json:"boundary"`
	Area       float64  `json:"area"`
	Perimeter  float64  `json:"perimeter"`
	WallIDs    []string `json:"wallIds"`
	OpeningIDs []string `json:"openingIds"`
	RoomType   string   `json:"roomType,omitempty"`
}

type RoomLabelCache struct {
	NodeID   string  `json:"nodeId"`
	Label    string  `json:"label"`
	Position Point   `json:"position"`
	Angle    float64 `json:"angle,omitempty"`
}

type OpeningPlacementCache struct {
	NodeID      string  `json:"nodeId"`
	HostWallID  string  `json:"hostWallId"`
	Position    Point   `json:"position"`
	WallTangent Point   `json:"wallTangent"`
	WallNormal  Point   `json:"wallNormal"`
	CutWidth    float64 `json:"cutWidth"`
}

type BoundsCache struct {
	NodeID string  `json:"nodeId"`
	MinX   float64 `json:"minX"`
	MinY   float64 `json:"minY"`
	MaxX   float64 `json:"maxX"`
	MaxY   float64 `json:"maxY"`
}

type LayerVisibilityCache struct {
	LayerID         string   `json:"layerId"`
	Visible         bool     `json:"visible"`
	EffectiveNodeIDs []string `json:"effectiveNodeIds"`
}

type SnapPoint struct {
	Position Point   `json:"position"`
	Type     string  `json:"type"`
	NodeID   string  `json:"nodeId,omitempty"`
	Priority int     `json:"priority"`
}

type SnapIndexCache struct {
	Revision      int         `json:"revision"`
	Endpoints     []SnapPoint `json:"endpoints"`
	Midpoints     []SnapPoint `json:"midpoints"`
	Centers       []SnapPoint `json:"centers"`
	Intersections []SnapPoint `json:"intersections"`
	GridPoints    []SnapPoint `json:"gridPoints,omitempty"`
}

type SpatialIndexCache struct {
	Revision     int                    `json:"revision"`
	Buckets      map[string][]string    `json:"buckets"`
	BoundsByNode map[string]BoundsCache `json:"boundsByNode"`
}

type RenderIndexCache struct {
	Revision        int      `json:"revision"`
	DrawOrder       []string `json:"drawOrder"`
	SelectableOrder []string `json:"selectableOrder"`
	HoverPriority   []string `json:"hoverPriority"`
}

type DerivedDiagnostic struct {
	Code     string   `json:"code"`
	Severity string   `json:"severity"`
	NodeIDs  []string `json:"nodeIds"`
	Message  string   `json:"message"`
}
