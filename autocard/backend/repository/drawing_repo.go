package repository

import (
	"autocard-backend/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type DrawingRepo struct {
	db *gorm.DB
}

func NewDrawingRepo(db *gorm.DB) *DrawingRepo {
	return &DrawingRepo{db: db}
}

func (r *DrawingRepo) Create(drawing *models.Drawing) error {
	drawing.Version = 1
	return r.db.Create(drawing).Error
}

func (r *DrawingRepo) FindByUserID(userID string) ([]models.Drawing, error) {
	var drawings []models.Drawing
	err := r.db.Preload("User").
		Joins("LEFT JOIN permissions ON permissions.drawing_id = drawings.id").
		Where("drawings.user_id = ? OR permissions.user_id = ?", userID, userID).
		Group("drawings.id").
		Order("drawings.updated_at desc").
		Find(&drawings).Error
	return drawings, err
}

func (r *DrawingRepo) FindByID(id string) (*models.Drawing, error) {
	var drawing models.Drawing
	err := r.db.Preload("User").Where("id = ?", id).First(&drawing).Error
	if err != nil {
		return nil, err
	}
	return &drawing, nil
}

func (r *DrawingRepo) Update(id string, drawing *models.SaveDrawingRequest) error {
	result := r.db.Model(&models.Drawing{}).Where("id = ? AND version = ?", id, drawing.Version).
		Updates(map[string]interface{}{
			"name":    drawing.Name,
			"data":    drawing.Data,
			"version": gorm.Expr("version + 1"),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *DrawingRepo) UpdateName(id string, name string) error {
	return r.db.Model(&models.Drawing{}).Where("id = ?", id).Update("name", name).Error
}

func (r *DrawingRepo) UpdateAvatar(id string, imageURL string) error {
	return r.db.Model(&models.Drawing{}).Where("id = ?", id).Update("image_url", imageURL).Error
}

func (r *DrawingRepo) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&models.Drawing{}).Error
}

func (r *DrawingRepo) SaveVersion(version *models.VersionHistory) error {
	return r.db.Create(version).Error
}

func (r *DrawingRepo) GetVersions(drawingID string) ([]models.VersionHistory, error) {
	var versions []models.VersionHistory
	err := r.db.Where("drawing_id = ?", drawingID).Order("version desc").Find(&versions).Error
	return versions, err
}

func (r *DrawingRepo) GetVersion(drawingID string, version int) (*models.VersionHistory, error) {
	var v models.VersionHistory
	err := r.db.Where("drawing_id = ? AND version = ?", drawingID, version).First(&v).Error
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *DrawingRepo) CreateComment(comment *models.Comment) error {
	return r.db.Create(comment).Error
}

func (r *DrawingRepo) GetComments(drawingID string) ([]models.Comment, error) {
	var comments []models.Comment
	err := r.db.Where("drawing_id = ?", drawingID).Order("created_at asc").Find(&comments).Error
	return comments, err
}

func (r *DrawingRepo) SetPermission(perm *models.Permission) error {
	if perm.UserID == "" && perm.Email != "" {
		var user models.User
		if err := r.db.Where("email = ?", perm.Email).First(&user).Error; err != nil {
			return err
		}
		perm.UserID = user.ID
	} else if perm.UserID != "" && perm.Email == "" {
		var user models.User
		if err := r.db.Where("id = ?", perm.UserID).First(&user).Error; err == nil {
			perm.Email = user.Email
		}
	}
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "drawing_id"}, {Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"role"}),
	}).Create(perm).Error
}

func (r *DrawingRepo) GetPermissions(drawingID string) ([]models.Permission, error) {
	var perms []models.Permission
	err := r.db.Where("drawing_id = ?", drawingID).Find(&perms).Error
	return perms, err
}

func (r *DrawingRepo) GetUserRole(drawingID, userID string) (string, error) {
	var ownerID string
	err := r.db.Model(&models.Drawing{}).Select("user_id").Where("id = ?", drawingID).Scan(&ownerID).Error
	if err == nil && ownerID == userID {
		return "owner", nil
	}

	var role string
	err = r.db.Model(&models.Permission{}).Select("role").Where("drawing_id = ? AND user_id = ?", drawingID, userID).Scan(&role).Error
	if err != nil || role == "" {
		return "viewer", nil
	}
	return role, nil
}

func (r *DrawingRepo) RemovePermission(drawingID, userID string) error {
	return r.db.Where("drawing_id = ? AND user_id = ?", drawingID, userID).Delete(&models.Permission{}).Error
}
