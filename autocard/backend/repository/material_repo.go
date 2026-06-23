package repository

import (
	"autocard-backend/models"
	"gorm.io/gorm"
)

type MaterialRepo struct {
	db *gorm.DB
}

func NewMaterialRepo(db *gorm.DB) *MaterialRepo {
	_ = db.AutoMigrate(&models.Material{})
	return &MaterialRepo{db: db}
}

func (r *MaterialRepo) ListByUser(userID string) ([]models.Material, error) {
	var materials []models.Material
	err := r.db.Where("user_id = ?", userID).Order("category ASC, name ASC").Find(&materials).Error
	if err != nil {
		return nil, err
	}

	// Auto-seed default materials if the user has none
	if len(materials) == 0 {
		defaults := []models.Material{
			{UserID: userID, Name: "Thép cốt bê tông (Iron/Steel Rebar)", Unit: "kg", UnitPrice: 30000, Category: "Structural", Description: "Thép xây dựng móng và dầm cột"},
			{UserID: userID, Name: "Ống nước PVC Ø90", Unit: "m", UnitPrice: 75000, Category: "Plumbing", Description: "Ống thoát nước PVC"},
			{UserID: userID, Name: "Dây cáp điện lõi đồng 2.5mm²", Unit: "m", UnitPrice: 20000, Category: "Electrical", Description: "Dây dẫn điện nguồn"},
			{UserID: userID, Name: "Xi măng trắng", Unit: "kg", UnitPrice: 6000, Category: "Finishes", Description: "Xi măng trắng trét khe mạch gạch"},
			{UserID: userID, Name: "Xi măng Portland đen", Unit: "kg", UnitPrice: 3500, Category: "Structural", Description: "Xi măng đen dùng xây tô và đổ bê tông"},
			{UserID: userID, Name: "Cát xây dựng", Unit: "m³", UnitPrice: 350000, Category: "Structural", Description: "Cát xây tô trộn vữa"},
			{UserID: userID, Name: "Gạch đỏ xây tường 8x8x18", Unit: "pcs", UnitPrice: 1800, Category: "Structural", Description: "Gạch tuynel xây tường bao"},
			{UserID: userID, Name: "Bê tông tươi Mác 250", Unit: "m³", UnitPrice: 1400000, Category: "Structural", Description: "Bê tông tươi trộn sẵn"},
		}
		for _, m := range defaults {
			_ = r.db.Create(&m)
		}
		// Query again after seeding
		err = r.db.Where("user_id = ?", userID).Order("category ASC, name ASC").Find(&materials).Error
	}

	return materials, err
}

func (r *MaterialRepo) Create(material *models.Material) error {
	return r.db.Create(material).Error
}

func (r *MaterialRepo) Update(id string, userID string, updates map[string]interface{}) error {
	return r.db.Model(&models.Material{}).Where("id = ? AND user_id = ?", id, userID).Updates(updates).Error
}

func (r *MaterialRepo) Delete(id string, userID string) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Material{}).Error
}
