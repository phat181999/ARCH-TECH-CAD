package models

import "time"

type Member struct {
	ID            string    `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Email         string    `json:"email" gorm:"uniqueIndex;not null"`
	PasswordHash  string    `json:"-" gorm:"column:password_hash"`
	Name          string    `json:"name" gorm:"not null;default:''"`
	AvatarURL     string    `json:"avatar_url" gorm:"column:avatar_url;type:text;not null;default:''"`
	JobTitle      string    `json:"job_title" gorm:"column:job_title;type:varchar(100);not null;default:''"`
	Phone         string    `json:"phone" gorm:"type:varchar(50);not null;default:''"`
	InvitedBy     string    `json:"invited_by" gorm:"column:invited_by;not null;default:''"`
	EmailVerified bool      `json:"email_verified" gorm:"column:email_verified;default:false"`
	Provider      string    `json:"provider" gorm:"column:provider;type:varchar(50);not null;default:'email'"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type MemberLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type MemberRegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
	Token    string `json:"token"` // invitation token
	Org      string `json:"org"`   // organization name
}

type MemberAuthResponse struct {
	Token  string `json:"token"`
	Member Member `json:"member"`
}
