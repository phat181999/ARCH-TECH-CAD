package models

import (
	"encoding/json"
	"time"
)

// AnalysisJob tracks an async Claude-powered analysis of a drawing.
type AnalysisJob struct {
	ID        string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	DrawingID string    `gorm:"type:uuid;not null;index" json:"drawing_id"`
	UserID    string    `gorm:"type:uuid;not null" json:"user_id"`
	Status    string    `gorm:"type:varchar(20);not null;default:'pending'" json:"status"` // pending|running|done|error
	Error     string    `gorm:"type:text" json:"error,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BIMResult is the structured output of the Claude analysis.
// Stored as JSON text in drawings.bim_data.
type BIMResult struct {
	JobID    string     `json:"job_id"`
	Analyzed time.Time  `json:"analyzed"`
	Units    string     `json:"units"` // "mm" | "m" | "ft"
	Levels   []BIMLevel `json:"levels"`
	Walls    []BIMWall  `json:"walls"`
	Openings []BIMOpening `json:"openings"`
	Rooms    []BIMRoom  `json:"rooms"`
	Columns  []BIMColumn `json:"columns"`
	Meta     map[string]interface{} `json:"meta,omitempty"`
}

type BIMLevel struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Elevation float64 `json:"elevation"`
	Height    float64 `json:"height"`
}

type BIMWall struct {
	ID        string  `json:"id"`
	LevelID   string  `json:"level_id"`
	Role      string  `json:"role"` // "exterior" | "interior" | "partition"
	X1        float64 `json:"x1"`
	Y1        float64 `json:"y1"`
	X2        float64 `json:"x2"`
	Y2        float64 `json:"y2"`
	Thickness float64 `json:"thickness"`
	Height    float64 `json:"height"`
	Material  string  `json:"material,omitempty"`
}

type BIMOpening struct {
	ID         string  `json:"id"`
	Type       string  `json:"type"` // "door" | "window"
	HostWallID string  `json:"host_wall_id"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Width      float64 `json:"width"`
	Height     float64 `json:"height"`
	Sill       float64 `json:"sill,omitempty"`
}

type BIMRoom struct {
	ID       string     `json:"id"`
	LevelID  string     `json:"level_id"`
	Name     string     `json:"name"`
	RoomType string     `json:"room_type"`
	Boundary []BIMPoint `json:"boundary"`
	Area     float64    `json:"area"`
}

type BIMColumn struct {
	ID       string  `json:"id"`
	LevelID  string  `json:"level_id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Width    float64 `json:"width"`
	Depth    float64 `json:"depth"`
	Height   float64 `json:"height"`
	Material string  `json:"material,omitempty"`
}

type BIMPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// BIMResultJSON marshals a BIMResult to a JSON string for storage.
func BIMResultJSON(r *BIMResult) (string, error) {
	b, err := json.Marshal(r)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
