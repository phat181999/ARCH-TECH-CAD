package repository

import (
	"time"

	"autocard-backend/models"

	"gorm.io/gorm"
)

type AnalysisJobRepo struct {
	db *gorm.DB
}

func NewAnalysisJobRepo(db *gorm.DB) *AnalysisJobRepo {
	return &AnalysisJobRepo{db: db}
}

func (r *AnalysisJobRepo) Create(job *models.AnalysisJob) error {
	return r.db.Create(job).Error
}

func (r *AnalysisJobRepo) FindByID(id string) (*models.AnalysisJob, error) {
	var job models.AnalysisJob
	if err := r.db.First(&job, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *AnalysisJobRepo) FindLatestByDrawing(drawingID string) (*models.AnalysisJob, error) {
	var job models.AnalysisJob
	if err := r.db.Where("drawing_id = ?", drawingID).
		Order("created_at desc").
		First(&job).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *AnalysisJobRepo) SetRunning(id string) error {
	return r.db.Model(&models.AnalysisJob{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{"status": "running", "updated_at": time.Now()}).Error
}

func (r *AnalysisJobRepo) SetDone(id string) error {
	return r.db.Model(&models.AnalysisJob{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{"status": "done", "updated_at": time.Now()}).Error
}

func (r *AnalysisJobRepo) SetError(id, errMsg string) error {
	return r.db.Model(&models.AnalysisJob{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{"status": "error", "error": errMsg, "updated_at": time.Now()}).Error
}

// FailStuckJobs marks jobs left in 'running' longer than olderThan as errored.
// Guards against jobs orphaned by a worker/server crash after BRPOP.
func (r *AnalysisJobRepo) FailStuckJobs(olderThan time.Duration) (int64, error) {
	cutoff := time.Now().Add(-olderThan)
	res := r.db.Model(&models.AnalysisJob{}).
		Where("status = ? AND updated_at < ?", "running", cutoff).
		Updates(map[string]interface{}{
			"status":     "error",
			"error":      "analysis timed out or worker was interrupted",
			"updated_at": time.Now(),
		})
	return res.RowsAffected, res.Error
}

// SaveBIMResult writes the BIM JSON string to drawings.bim_data.
func (r *AnalysisJobRepo) SaveBIMResult(drawingID, bimJSON string) error {
	return r.db.Exec("UPDATE drawings SET bim_data = ? WHERE id = ?", bimJSON, drawingID).Error
}

// GetBIMResult reads drawings.bim_data for a drawing.
func (r *AnalysisJobRepo) GetBIMResult(drawingID string) (string, error) {
	var result struct {
		BimData string `gorm:"column:bim_data"`
	}
	if err := r.db.Raw("SELECT bim_data FROM drawings WHERE id = ?", drawingID).
		Scan(&result).Error; err != nil {
		return "", err
	}
	return result.BimData, nil
}
