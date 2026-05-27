package models

import "time"

type Drawing struct {
	ID        string    `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID    string    `json:"user_id" gorm:"type:uuid;not null;index"`
	User      *User     `json:"user,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
	Name      string    `json:"name" gorm:"not null"`
	Data      string    `json:"data" gorm:"type:text;not null;default:''"`
	ImageUrl  string    `json:"image_url" gorm:"type:text;not null;default:''"`
	Version   int       `json:"version" gorm:"not null;default:1"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SaveDrawingRequest struct {
	Name    string `json:"name"`
	Data    string `json:"data"`
	Version int    `json:"version"`
}

// VersionHistory stores snapshots of drawing versions
type VersionHistory struct {
	ID        string    `json:"id"`
	DrawingID string    `json:"drawing_id"`
	Version   int       `json:"version"`
	Data      string    `json:"data"`
	CreatedAt time.Time `json:"created_at"`
	CreatedBy string    `json:"created_by"`
}

func (VersionHistory) TableName() string {
	return "version_history"
}

// Comment represents a threaded comment on a drawing
type Comment struct {
	ID        string    `json:"id"`
	DrawingID string    `json:"drawing_id"`
	UserID    string    `json:"user_id"`
	Username  string    `json:"username"`
	X         float64   `json:"x"`
	Y         float64   `json:"y"`
	Message   string    `json:"message"`
	ParentID  *string   `json:"parent_id,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// Permission represents user access to a drawing
type Permission struct {
	ID        string    `json:"id"`
	DrawingID string    `json:"drawing_id"`
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"` // "owner", "editor", "viewer"
	CreatedAt time.Time `json:"created_at"`
}

// ObjectLock represents a locked element
type ObjectLock struct {
	ObjectID string `json:"object_id"`
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}
