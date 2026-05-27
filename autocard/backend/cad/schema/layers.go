// mirrors cad/contracts/layers.ts
package schema

type LayerDef struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Visible    bool    `json:"visible"`
	Locked     bool    `json:"locked"`
	Frozen     bool    `json:"frozen"`
	Color      string  `json:"color"`
	LineType   string  `json:"lineType"`
	LineWeight float64 `json:"lineWeight"`
	PlotStyle  string  `json:"plotStyle,omitempty"`
	ParentID   string  `json:"parentId,omitempty"`
}

type StyleDef struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Color       string  `json:"color,omitempty"`
	LineType    string  `json:"lineType,omitempty"`
	LineWeight  float64 `json:"lineWeight,omitempty"`
	FillColor   string  `json:"fillColor,omitempty"`
	FontSize    float64 `json:"fontSize,omitempty"`
	FontFamily  string  `json:"fontFamily,omitempty"`
	TextAlign   string  `json:"textAlign,omitempty"`
	ArrowStyle  string  `json:"arrowStyle,omitempty"`
}

type SheetDef struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Width            float64  `json:"width"`
	Height           float64  `json:"height"`
	Scale            float64  `json:"scale"`
	ViewportIDs      []string `json:"viewportIds"`
	TitleBlockNodeID string   `json:"titleBlockNodeId,omitempty"`
	DrawingNumber    string   `json:"drawingNumber,omitempty"`
	Revision         string   `json:"revision,omitempty"`
}

type ViewDef struct {
	ID             string                       `json:"id"`
	Name           string                       `json:"name"`
	Center         Point                        `json:"center"`
	Zoom           float64                      `json:"zoom"`
	LayerOverrides map[string]map[string]interface{} `json:"layerOverrides,omitempty"`
}

type ConstraintDef struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"`
	NodeIDs    []string               `json:"nodeIds"`
	Params     map[string]interface{} `json:"params,omitempty"`
	Satisfied  bool                   `json:"satisfied"`
	Persistent bool                   `json:"persistent"`
}
