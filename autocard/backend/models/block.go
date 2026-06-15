package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// BlockDefJSON is the raw JSON block definition stored as JSONB in Postgres.
type BlockDefJSON map[string]interface{}

func (b BlockDefJSON) Value() (driver.Value, error) {
	return json.Marshal(b)
}

func (b *BlockDefJSON) Scan(src interface{}) error {
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, b)
	case string:
		return json.Unmarshal([]byte(v), b)
	}
	return errors.New("cannot scan into BlockDefJSON")
}

// Block represents a user-uploaded or org-shared block (CAD component / furniture).
type Block struct {
	ID             string      `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID         string      `json:"user_id" gorm:"type:uuid;not null;index"`
	OrganizationID *string     `json:"organization_id" gorm:"type:uuid;index"`
	Name           string      `json:"name" gorm:"not null"`
	Description    string      `json:"description" gorm:"type:text;not null;default:''"`
	Category       string      `json:"category" gorm:"not null;default:'general'"`
	Tags           StringSlice `json:"tags" gorm:"type:text;not null;default:'[]'"`
	BlockDef       BlockDefJSON `json:"block_def" gorm:"type:jsonb;not null;default:'{}'"`
	PreviewSVG     string      `json:"preview_svg" gorm:"type:text;not null;default:''"`
	ThumbnailURL   string      `json:"thumbnail_url" gorm:"type:text;not null;default:''"`
	IsPublished    bool        `json:"is_published" gorm:"not null;default:false"`
	DownloadCount  int         `json:"download_count" gorm:"not null;default:0"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

// StringSlice handles []string <-> Postgres text JSON serialisation.
type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	b, err := json.Marshal(s)
	return string(b), err
}

func (s *StringSlice) Scan(src interface{}) error {
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, s)
	case string:
		return json.Unmarshal([]byte(v), s)
	}
	*s = []string{}
	return nil
}
