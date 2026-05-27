package models

import "time"

type SubscriptionPackage struct {
	ID           string    `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Name         string    `json:"name" gorm:"type:varchar(255);not null;unique"` // e.g. "Pro Yearly"
	Code         string    `json:"code" gorm:"type:varchar(50);not null;unique"`  // e.g. "pro-yearly"
	Price        float64   `json:"price" gorm:"type:decimal(10,2);not null;default:0"`
	DurationDays int       `json:"duration_days" gorm:"not null;default:30"`
	MaxMembers   int       `json:"max_members" gorm:"not null;default:5"`
	MaxDrawings  int       `json:"max_drawings" gorm:"not null;default:10"`
	Features     string    `json:"features" gorm:"type:text;not null;default:''"` // Comma-separated list
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type AssignPackageRequest struct {
	PackageID string `json:"package_id"`
}
