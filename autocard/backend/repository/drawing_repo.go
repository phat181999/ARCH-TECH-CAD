package repository

import (
	"database/sql"
	"autocard-backend/models"
)

type DrawingRepo struct {
	db *sql.DB
}

func NewDrawingRepo(db *sql.DB) *DrawingRepo {
	return &DrawingRepo{db: db}
}

func (r *DrawingRepo) Create(drawing *models.Drawing) error {
	query := `INSERT INTO drawings (id, user_id, name, data) VALUES ($1, $2, $3, $4)`
	_, err := r.db.Exec(query, drawing.ID, drawing.UserID, drawing.Name, drawing.Data)
	return err
}

func (r *DrawingRepo) FindByUserID(userID string) ([]models.Drawing, error) {
	query := `SELECT id, user_id, name, data, created_at, updated_at FROM drawings WHERE user_id = $1 ORDER BY updated_at DESC`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var drawings []models.Drawing
	for rows.Next() {
		var d models.Drawing
		if err := rows.Scan(&d.ID, &d.UserID, &d.Name, &d.Data, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		drawings = append(drawings, d)
	}
	return drawings, nil
}

func (r *DrawingRepo) FindByID(id string) (*models.Drawing, error) {
	d := &models.Drawing{}
	query := `SELECT id, user_id, name, data, created_at, updated_at FROM drawings WHERE id = $1`
	err := r.db.QueryRow(query, id).Scan(&d.ID, &d.UserID, &d.Name, &d.Data, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return d, nil
}

func (r *DrawingRepo) Update(id string, drawing *models.SaveDrawingRequest) error {
	query := `UPDATE drawings SET name = $1, data = $2, updated_at = NOW() WHERE id = $3`
	_, err := r.db.Exec(query, drawing.Name, drawing.Data, id)
	return err
}

func (r *DrawingRepo) Delete(id string) error {
	query := `DELETE FROM drawings WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}
