package models

import "time"

type DrawingTask struct {
	ID             string     `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	DrawingID      string     `json:"drawing_id" gorm:"type:uuid;not null;index"`
	Name           string     `json:"name" gorm:"not null"`
	Phase          string     `json:"phase" gorm:"type:varchar(50);not null;default:'Foundation'"` // Foundation, Structural, MEP, Finishes, Roofing
	Description    string     `json:"description" gorm:"type:text;not null;default:''"`
	AssigneeID     *string    `json:"assignee_id" gorm:"type:uuid;index"`
	AssigneeName   string     `json:"assignee_name" gorm:"type:varchar(100);not null;default:''"`
	Status         string     `json:"status" gorm:"type:varchar(20);not null;default:'todo'"` // todo, in_progress, done
	DurationDays   int        `json:"duration_days" gorm:"not null;default:1"`
	LaborPrice     float64    `json:"labor_price" gorm:"not null;default:0"`
	TotalLaborCost float64    `json:"total_labor_cost" gorm:"not null;default:0"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
