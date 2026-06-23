package repository

import (
	"autocard-backend/models"
	"gorm.io/gorm"
)

type DrawingTaskRepo struct {
	db *gorm.DB
}

func NewDrawingTaskRepo(db *gorm.DB) *DrawingTaskRepo {
	_ = db.AutoMigrate(&models.DrawingTask{})
	return &DrawingTaskRepo{db: db}
}

func (r *DrawingTaskRepo) ListByDrawing(drawingID string) ([]models.DrawingTask, error) {
	var tasks []models.DrawingTask
	err := r.db.Where("drawing_id = ?", drawingID).Order("phase ASC, name ASC").Find(&tasks).Error
	return tasks, err
}

func (r *DrawingTaskRepo) Create(task *models.DrawingTask) error {
	return r.db.Create(task).Error
}

func (r *DrawingTaskRepo) Update(id string, updates map[string]interface{}) error {
	return r.db.Model(&models.DrawingTask{}).Where("id = ?", id).Updates(updates).Error
}

func (r *DrawingTaskRepo) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&models.DrawingTask{}).Error
}

func (r *DrawingTaskRepo) BulkCreate(tasks []models.DrawingTask) error {
	if len(tasks) == 0 {
		return nil
	}
	return r.db.Create(&tasks).Error
}

func (r *DrawingTaskRepo) FindByID(id string) (*models.DrawingTask, error) {
	var task models.DrawingTask
	err := r.db.Where("id = ?", id).First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}
