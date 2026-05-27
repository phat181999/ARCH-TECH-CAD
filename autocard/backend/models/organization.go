package models

import "time"

type Organization struct {
	ID                    string               `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Name                  string               `json:"name" gorm:"not null"`
	ImageOrg              string               `json:"image_org" gorm:"column:image_org;type:text;default:''"`
	SubscriptionPackageID *string              `json:"subscription_package_id" gorm:"type:uuid;column:subscription_package_id;index"`
	SubscriptionPackage   *SubscriptionPackage `json:"subscription_package,omitempty" gorm:"foreignKey:SubscriptionPackageID;constraint:OnDelete:SET NULL"`
	SubscriptionTier      string               `json:"subscription_tier" gorm:"column:subscription_tier;type:varchar(50);not null;default:'free'"`
	SubscriptionExpires   *time.Time           `json:"subscription_expires" gorm:"column:subscription_expires"`
	CreatedAt             time.Time            `json:"created_at"`
	UpdatedAt             time.Time            `json:"updated_at"`
}

type OrganizationMember struct {
	ID             string       `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	OrganizationID string       `json:"organization_id" gorm:"type:uuid;not null;index"`
	UserID         string       `json:"user_id" gorm:"type:uuid;not null;index"`
	Role           string       `json:"role" gorm:"type:varchar(50);not null"` // 'owner', 'editor', 'viewer'
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
	User           *User        `json:"user,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
	Organization   *Organization `json:"organization,omitempty" gorm:"foreignKey:OrganizationID;constraint:OnDelete:CASCADE"`
}

// Request and Response Types

type CreateOrganizationRequest struct {
	Name string `json:"name"`
}

type InviteMemberRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type PendingInvitation struct {
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	InvitedBy string    `json:"invited_by"`
	CreatedAt time.Time `json:"created_at"`
}

type OrganizationMembersResponse struct {
	Members     []MemberResponse    `json:"members"`
	Invitations []PendingInvitation `json:"invitations"`
}

type MemberResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type UpdateSubscriptionRequest struct {
	SubscriptionTier    string     `json:"subscription_tier"`
	SubscriptionExpires *time.Time `json:"subscription_expires"`
}

type UpdateSystemRoleRequest struct {
	SystemRole string `json:"system_role"`
}
