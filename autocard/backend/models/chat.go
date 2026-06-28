package models

import "time"

// ChatSession represents a conversation thread for a user.
type ChatSession struct {
	ID        string        `gorm:"primaryKey;type:uuid;default:gen_random_uuid();column:id" json:"id"`
	UserID    string        `gorm:"type:uuid;not null;index;column:user_id" json:"user_id"`
	TenantID  string        `gorm:"type:uuid;not null;index;column:tenant_id" json:"tenant_id"`
	Title     string        `gorm:"type:varchar(255);not null;default:'New Chat';column:title" json:"title"`
	DrawingID string        `gorm:"type:varchar(255);column:drawing_id;index" json:"drawing_id,omitempty"`
	CreatedAt time.Time     `gorm:"column:created_at" json:"created_at"`
	UpdatedAt time.Time     `gorm:"column:updated_at" json:"updated_at"`
	Messages  []ChatMessage `gorm:"foreignKey:SessionID;constraint:OnDelete:CASCADE" json:"messages,omitempty"`
}

// ChatMessage represents a single message exchange in a session.
type ChatMessage struct {
	ID        string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid();column:id" json:"id"`
	SessionID string    `gorm:"type:uuid;not null;index;column:session_id" json:"session_id"`
	Role      string    `gorm:"type:varchar(50);not null;column:role" json:"role"` // "user" or "assistant"
	Content   string    `gorm:"type:text;not null;column:content" json:"content"`
	Category   string `gorm:"type:varchar(100);column:category" json:"category,omitempty"`    // primary classification result (backward compat)
	Categories string `gorm:"type:text;column:categories" json:"categories,omitempty"`        // JSON array e.g. ["cad_drawing","permit_and_licensing"]
	Commands   string `gorm:"type:text;column:commands" json:"commands,omitempty"`             // JSON CAD commands stored as string
	CreatedAt time.Time `gorm:"column:created_at" json:"created_at"`
}
