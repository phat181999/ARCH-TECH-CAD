package models

import (
	"encoding/json"
	"time"
)

type User struct {
	ID                string    `json:"id"`
	Email             string    `json:"email"`
	PasswordHash      string    `json:"-"`
	Name              string    `json:"name"`
	EmailVerified     bool      `json:"email_verified"`
	VerificationToken string    `json:"-"`
	SystemRole        string    `json:"system_role" gorm:"column:system_role;type:varchar(50);not null;default:'user'"`
	PreferencesJSON   string    `json:"-" gorm:"column:preferences;type:text;not null;default:'{}'"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func (u User) MarshalJSON() ([]byte, error) {
	prefs := json.RawMessage("{}")
	if u.PreferencesJSON != "" {
		prefs = json.RawMessage(u.PreferencesJSON)
	}
	return json.Marshal(struct {
		ID            string          `json:"id"`
		Email         string          `json:"email"`
		Name          string          `json:"name"`
		EmailVerified bool            `json:"email_verified"`
		SystemRole    string          `json:"system_role"`
		CreatedAt     time.Time       `json:"created_at"`
		UpdatedAt     time.Time       `json:"updated_at"`
		Preferences   json.RawMessage `json:"preferences"`
	}{
		ID:            u.ID,
		Email:         u.Email,
		Name:          u.Name,
		EmailVerified: u.EmailVerified,
		SystemRole:    u.SystemRole,
		CreatedAt:     u.CreatedAt,
		UpdatedAt:     u.UpdatedAt,
		Preferences:   prefs,
	})
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
	Org      string `json:"org"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type VerifyEmailRequest struct {
	Token string `json:"token"`
}
