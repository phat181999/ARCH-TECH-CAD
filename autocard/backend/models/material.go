package models

import "time"

type Material struct {
	ID          string    `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID      string    `json:"user_id" gorm:"type:uuid;not null;index"`
	Name        string    `json:"name" gorm:"not null"`
	Unit        string    `json:"unit" gorm:"not null"`
	UnitPrice   float64   `json:"unit_price" gorm:"not null;default:0"`
	Category    string    `json:"category" gorm:"not null;default:'general'"`
	Description string    `json:"description" gorm:"type:text;not null;default:''"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
