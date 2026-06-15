package repository

import (
	"autocard-backend/models"

	"gorm.io/gorm"
)

type BlockRepo struct {
	db *gorm.DB
}

func NewBlockRepo(db *gorm.DB) *BlockRepo {
	// Auto-migrate the blocks table
	_ = db.AutoMigrate(&models.Block{})
	return &BlockRepo{db: db}
}

// ── My Blocks (user-private) ──────────────────────────────────────────────────

func (r *BlockRepo) ListByUser(userID string) ([]models.Block, error) {
	var blocks []models.Block
	err := r.db.Where("user_id = ? AND (organization_id IS NULL)", userID).
		Order("created_at DESC").
		Find(&blocks).Error
	return blocks, err
}

func (r *BlockRepo) CreateForUser(block *models.Block) error {
	return r.db.Create(block).Error
}

func (r *BlockRepo) DeleteForUser(id, userID string) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Block{}).Error
}

func (r *BlockRepo) GetByID(id string) (*models.Block, error) {
	var block models.Block
	err := r.db.Where("id = ?", id).First(&block).Error
	return &block, err
}

// ── Org Block Store ───────────────────────────────────────────────────────────

func (r *BlockRepo) ListByOrg(orgID string, q string) ([]models.Block, error) {
	var blocks []models.Block
	db := r.db.Where("organization_id = ? AND is_published = true", orgID)
	if q != "" {
		db = db.Where("name ILIKE ? OR category ILIKE ?", "%"+q+"%", "%"+q+"%")
	}
	err := db.Order("download_count DESC, created_at DESC").Find(&blocks).Error
	return blocks, err
}

func (r *BlockRepo) CreateForOrg(block *models.Block) error {
	return r.db.Create(block).Error
}

func (r *BlockRepo) UpdateOrgBlock(id, orgID string, updates map[string]interface{}) error {
	return r.db.Model(&models.Block{}).
		Where("id = ? AND organization_id = ?", id, orgID).
		Updates(updates).Error
}

func (r *BlockRepo) DeleteOrgBlock(id, orgID string) error {
	return r.db.Where("id = ? AND organization_id = ?", id, orgID).Delete(&models.Block{}).Error
}

func (r *BlockRepo) IncrementDownloadCount(id string) error {
	return r.db.Model(&models.Block{}).Where("id = ?", id).
		UpdateColumn("download_count", gorm.Expr("download_count + 1")).Error
}
