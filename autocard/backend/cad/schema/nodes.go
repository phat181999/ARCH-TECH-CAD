// mirrors cad/contracts/nodes/*.ts
package schema

import "encoding/json"

// BaseNode mirrors cad/contracts/nodes/base.ts BaseNode.
type BaseNode struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	ParentID *string                `json:"parentId"`
	Name     string                 `json:"name,omitempty"`
	Visible  bool                   `json:"visible"`
	Locked   bool                   `json:"locked"`
	LayerID  string                 `json:"layerId"`
	StyleID  string                 `json:"styleId,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// WallNode mirrors cad/contracts/nodes/architectural.ts WallNode.
type WallNode struct {
	BaseNode
	Start        Point    `json:"start"`
	End          Point    `json:"end"`
	Thickness    float64  `json:"thickness"`
	Height       float64  `json:"height,omitempty"`
	BaseOffset   float64  `json:"baseOffset,omitempty"`
	JoinStart    string   `json:"joinStart,omitempty"`
	JoinEnd      string   `json:"joinEnd,omitempty"`
	OpeningIDs   []string `json:"openingIds,omitempty"`
	IsCurtainWall bool    `json:"isCurtainWall,omitempty"`
}

// DoorNode mirrors cad/contracts/nodes/architectural.ts DoorNode.
type DoorNode struct {
	BaseNode
	HostWallID           string  `json:"hostWallId"`
	PositionAlongWall    float64 `json:"positionAlongWall"`
	Width                float64 `json:"width"`
	Height               float64 `json:"height,omitempty"`
	Swing                string  `json:"swing"`
	Inward               bool    `json:"inward"`
	IsDouble             bool    `json:"isDouble"`
	OpenAngle            float64 `json:"openAngle,omitempty"`
}

// WindowNode mirrors cad/contracts/nodes/architectural.ts WindowNode.
type WindowNode struct {
	BaseNode
	HostWallID        string  `json:"hostWallId"`
	PositionAlongWall float64 `json:"positionAlongWall"`
	Width             float64 `json:"width"`
	Height            float64 `json:"height,omitempty"`
	SillHeight        float64 `json:"sillHeight,omitempty"`
	WindowType        string  `json:"windowType"`
	PaneCount         int     `json:"paneCount,omitempty"`
}

// RoomNode mirrors cad/contracts/nodes/architectural.ts RoomNode.
type RoomNode struct {
	BaseNode
	Label           string   `json:"label"`
	RoomType        string   `json:"roomType,omitempty"`
	Area            float64  `json:"area,omitempty"`
	BoundaryWallIDs []string `json:"boundaryWallIds"`
	LabelPosition   *Point   `json:"labelPosition,omitempty"`
}

// LineNode mirrors cad/contracts/nodes/drafting.ts LineNode.
type LineNode struct {
	BaseNode
	Start Point `json:"start"`
	End   Point `json:"end"`
}

// TextNode mirrors cad/contracts/nodes/drafting.ts TextNode.
type TextNode struct {
	BaseNode
	Position         Point   `json:"position"`
	Content          string  `json:"content"`
	FontSize         float64 `json:"fontSize"`
	FontFamily       string  `json:"fontFamily,omitempty"`
	Rotation         float64 `json:"rotation,omitempty"`
	HorizontalAlign  string  `json:"horizontalAlign,omitempty"`
	VerticalAlign    string  `json:"verticalAlign,omitempty"`
	Width            float64 `json:"width,omitempty"`
}

// UnmarshalNode deserializes a raw JSON node based on its "type" discriminator.
func UnmarshalNode(raw json.RawMessage) (interface{}, error) {
	var base BaseNode
	if err := json.Unmarshal(raw, &base); err != nil {
		return nil, err
	}

	switch base.Type {
	case "wall":
		var n WallNode
		err := json.Unmarshal(raw, &n)
		return &n, err
	case "door":
		var n DoorNode
		err := json.Unmarshal(raw, &n)
		return &n, err
	case "window":
		var n WindowNode
		err := json.Unmarshal(raw, &n)
		return &n, err
	case "room":
		var n RoomNode
		err := json.Unmarshal(raw, &n)
		return &n, err
	case "line":
		var n LineNode
		err := json.Unmarshal(raw, &n)
		return &n, err
	case "text":
		var n TextNode
		err := json.Unmarshal(raw, &n)
		return &n, err
	default:
		return &base, nil
	}
}
