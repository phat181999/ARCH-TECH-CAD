package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"autocard-backend/models"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type OrganizationRepo struct {
	db  *gorm.DB
	rdb *redis.Client
}

func NewOrganizationRepo(db *gorm.DB, rdb *redis.Client) *OrganizationRepo {
	return &OrganizationRepo{db: db, rdb: rdb}
}

// Create organization and set the creator as owner in a transaction
func (r *OrganizationRepo) Create(org *models.Organization, creatorUserID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(org).Error; err != nil {
			return err
		}

		member := &models.OrganizationMember{
			ID:             uuid.New().String(),
			OrganizationID: org.ID,
			UserID:         creatorUserID,
			Role:           "owner",
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		}

		return tx.Create(member).Error
	})
}

// GetUserOrganizations returns all organizations the user belongs to
func (r *OrganizationRepo) GetUserOrganizations(userID string) ([]models.Organization, error) {
	var orgs []models.Organization
	err := r.db.Table("organizations").
		Select("organizations.*").
		Joins("JOIN organization_members ON organization_members.organization_id = organizations.id").
		Where("organization_members.user_id = ?", userID).
		Find(&orgs).Error
	return orgs, err
}

// InviteMember saves pending invite to Redis with 24 hours TTL
func (r *OrganizationRepo) InviteMember(orgID string, email string, role string, invitedBy string) error {
	ctx := context.Background()
	key := fmt.Sprintf("org_invite:%s:%s", orgID, strings.ToLower(email))

	invitation := models.PendingInvitation{
		Email:     strings.ToLower(email),
		Role:      role,
		InvitedBy: invitedBy,
		CreatedAt: time.Now(),
	}

	val, err := json.Marshal(invitation)
	if err != nil {
		return err
	}

	return r.rdb.Set(ctx, key, val, 24*time.Hour).Err()
}

// GetMembersAndInvites retrieves DB active members and Redis pending invitations separately
func (r *OrganizationRepo) GetMembersAndInvites(orgID string) (*models.OrganizationMembersResponse, error) {
	// 1. Fetch DB active members
	var dbMembers []models.OrganizationMember
	if err := r.db.Preload("User").Where("organization_id = ?", orgID).Find(&dbMembers).Error; err != nil {
		return nil, err
	}

	membersList := make([]models.MemberResponse, 0, len(dbMembers))
	for _, dbMem := range dbMembers {
		if dbMem.User != nil {
			membersList = append(membersList, models.MemberResponse{
				ID:        dbMem.User.ID,
				Name:      dbMem.User.Name,
				Email:     dbMem.User.Email,
				Role:      dbMem.Role,
				CreatedAt: dbMem.CreatedAt,
			})
		}
	}

	// 2. Fetch Redis pending invites
	ctx := context.Background()
	pattern := fmt.Sprintf("org_invite:%s:*", orgID)
	
	var cursor uint64
	var keys []string
	for {
		var err error
		var batch []string
		batch, cursor, err = r.rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return nil, err
		}
		keys = append(keys, batch...)
		if cursor == 0 {
			break
		}
	}

	invitationsList := make([]models.PendingInvitation, 0)
	for _, key := range keys {
		val, err := r.rdb.Get(ctx, key).Result()
		if err != nil {
			continue
		}
		var invite models.PendingInvitation
		if err := json.Unmarshal([]byte(val), &invite); err == nil {
			invitationsList = append(invitationsList, invite)
		}
	}

	return &models.OrganizationMembersResponse{
		Members:     membersList,
		Invitations: invitationsList,
	}, nil
}

// ClaimPendingInvites links any pre-existing Redis invitations to PostgreSQL on signup/login
func (r *OrganizationRepo) ClaimPendingInvites(userEmail string, userID string) error {
	ctx := context.Background()
	pattern := fmt.Sprintf("org_invite:*:%s", strings.ToLower(userEmail))

	var cursor uint64
	var keys []string
	for {
		var err error
		var batch []string
		batch, cursor, err = r.rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return err
		}
		keys = append(keys, batch...)
		if cursor == 0 {
			break
		}
	}

	for _, key := range keys {
		// Key structure: org_invite:{orgID}:{email}
		parts := strings.Split(key, ":")
		if len(parts) < 3 {
			continue
		}
		orgID := parts[1]

		val, err := r.rdb.Get(ctx, key).Result()
		if err != nil {
			continue
		}

		var invite models.PendingInvitation
		if err := json.Unmarshal([]byte(val), &invite); err != nil {
			continue
		}

		// Insert user to organization_members in DB
		member := &models.OrganizationMember{
			ID:             uuid.New().String(),
			OrganizationID: orgID,
			UserID:         userID,
			Role:           invite.Role,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		}

		// Save to PostgreSQL
		if err := r.db.Clauses(clause.OnConflict{DoNothing: true}).Create(member).Error; err != nil {
			return err
		}

		// Delete from Redis
		r.rdb.Del(ctx, key)
	}

	return nil
}

// GetUserMembership returns the membership role of a user in an organization
func (r *OrganizationRepo) GetUserMembership(orgID string, userID string) (*models.OrganizationMember, error) {
	var member models.OrganizationMember
	err := r.db.Where("organization_id = ? AND user_id = ?", orgID, userID).First(&member).Error
	if err != nil {
		return nil, err
	}
	return &member, nil
}

// UpdateMemberRole updates the role of a user in an organization
func (r *OrganizationRepo) UpdateMemberRole(orgID string, userID string, role string) error {
	return r.db.Model(&models.OrganizationMember{}).
		Where("organization_id = ? AND user_id = ?", orgID, userID).
		Update("role", role).Error
}

// RemoveMember deletes the user from the organization
func (r *OrganizationRepo) RemoveMember(orgID string, userID string) error {
	return r.db.Where("organization_id = ? AND user_id = ?", orgID, userID).
		Delete(&models.OrganizationMember{}).Error
}

// RemoveInvitation deletes a pending invitation from Redis
func (r *OrganizationRepo) RemoveInvitation(orgID string, email string) error {
	ctx := context.Background()
	key := fmt.Sprintf("org_invite:%s:%s", orgID, strings.ToLower(email))
	return r.rdb.Del(ctx, key).Err()
}

// === SYSTEM ADMIN ACTIONS ===

// GetAllOrganizations returns all organizations in the platform
func (r *OrganizationRepo) GetAllOrganizations() ([]models.Organization, error) {
	var orgs []models.Organization
	err := r.db.Preload("SubscriptionPackage").Order("created_at desc").Find(&orgs).Error
	return orgs, err
}

// UpdateSubscription updates the subscription tier and expiration of an organization
func (r *OrganizationRepo) UpdateSubscription(orgID string, tier string, expires *time.Time) error {
	return r.db.Model(&models.Organization{}).
		Where("id = ?", orgID).
		Updates(map[string]interface{}{
			"subscription_tier":    tier,
			"subscription_expires": expires,
		}).Error
}

// UpdateOrganizationPackage links a package to an organization and updates its expiration period
func (r *OrganizationRepo) UpdateOrganizationPackage(orgID string, packageID string, expires *time.Time) error {
	return r.db.Model(&models.Organization{}).
		Where("id = ?", orgID).
		Updates(map[string]interface{}{
			"subscription_package_id": packageID,
			"subscription_expires":    expires,
		}).Error
}

// DeleteOrganization deletes an organization from GORM DB
func (r *OrganizationRepo) DeleteOrganization(orgID string) error {
	return r.db.Delete(&models.Organization{}, "id = ?", orgID).Error
}

// GetAllUsers lists all registered users
func (r *OrganizationRepo) GetAllUsers() ([]models.User, error) {
	var users []models.User
	err := r.db.Order("created_at desc").Find(&users).Error
	return users, err
}

// UpdateSystemRole sets a user's system role (standard vs app administrator)
func (r *OrganizationRepo) UpdateSystemRole(userID string, role string) error {
	return r.db.Model(&models.User{}).
		Where("id = ?", userID).
		Update("system_role", role).Error
}

// GetOrganizationOwner finds the owner user of an organization
func (r *OrganizationRepo) GetOrganizationOwner(orgID string) (*models.User, error) {
	var member models.OrganizationMember
	err := r.db.Preload("User").
		Where("organization_id = ? AND role = ?", orgID, "owner").
		First(&member).Error
	if err != nil {
		return nil, err
	}
	return member.User, nil
}

// CreatePackage inserts a new subscription package into PostgreSQL
func (r *OrganizationRepo) CreatePackage(pkg *models.SubscriptionPackage) error {
	pkg.CreatedAt = time.Now()
	pkg.UpdatedAt = time.Now()
	return r.db.Create(pkg).Error
}

// GetAllPackages retrieves all subscription packages
func (r *OrganizationRepo) GetAllPackages() ([]models.SubscriptionPackage, error) {
	var pkgs []models.SubscriptionPackage
	err := r.db.Order("price asc").Find(&pkgs).Error
	return pkgs, err
}

// UpdatePackage modifies package attributes in GORM DB
func (r *OrganizationRepo) UpdatePackage(id string, pkg *models.SubscriptionPackage) error {
	return r.db.Model(&models.SubscriptionPackage{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"name":          pkg.Name,
			"code":          pkg.Code,
			"price":         pkg.Price,
			"duration_days": pkg.DurationDays,
			"max_members":   pkg.MaxMembers,
			"max_drawings":  pkg.MaxDrawings,
			"features":      pkg.Features,
			"updated_at":    time.Now(),
		}).Error
}

// DeletePackage removes a subscription package from the platform
func (r *OrganizationRepo) DeletePackage(id string) error {
	return r.db.Delete(&models.SubscriptionPackage{}, "id = ?", id).Error
}

// UpdateOrganization updates organization name and image_org
func (r *OrganizationRepo) UpdateOrganization(orgID string, name string, imageOrg string) error {
	return r.db.Model(&models.Organization{}).Where("id = ?", orgID).Updates(map[string]interface{}{
		"name":       name,
		"image_org":  imageOrg,
		"updated_at": time.Now(),
	}).Error
}

// UpdateLogo updates the image_org column for the organization
func (r *OrganizationRepo) UpdateLogo(orgID string, logoURL string) error {
	return r.db.Model(&models.Organization{}).Where("id = ?", orgID).Update("image_org", logoURL).Error
}
