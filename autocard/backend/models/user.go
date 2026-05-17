package models

import "time"

type User struct {
ID                string    `json:"id"`
Email             string    `json:"email"`
PasswordHash      string    `json:"-"`
Name              string    `json:"name"`
EmailVerified     bool      `json:"email_verified"`
VerificationToken string    `json:"-"`
CreatedAt         time.Time `json:"created_at"`
UpdatedAt         time.Time `json:"updated_at"`
}

type RegisterRequest struct {
Email    string `json:"email"`
Password string `json:"password"`
Name     string `json:"name"`
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
