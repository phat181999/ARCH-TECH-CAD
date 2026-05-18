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
	query := `INSERT INTO drawings (id, user_id, name, data, version) VALUES ($1, $2, $3, $4, 1)`
	_, err := r.db.Exec(query, drawing.ID, drawing.UserID, drawing.Name, drawing.Data)
	return err
}

func (r *DrawingRepo) FindByUserID(userID string) ([]models.Drawing, error) {
	query := `SELECT id, user_id, name, data, version, created_at, updated_at FROM drawings WHERE user_id = $1 ORDER BY updated_at DESC`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var drawings []models.Drawing
	for rows.Next() {
		var d models.Drawing
		if err := rows.Scan(&d.ID, &d.UserID, &d.Name, &d.Data, &d.Version, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		drawings = append(drawings, d)
	}
	return drawings, nil
}

func (r *DrawingRepo) FindByID(id string) (*models.Drawing, error) {
	d := &models.Drawing{}
	query := `SELECT id, user_id, name, data, version, created_at, updated_at FROM drawings WHERE id = $1`
	err := r.db.QueryRow(query, id).Scan(&d.ID, &d.UserID, &d.Name, &d.Data, &d.Version, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return d, nil
}

func (r *DrawingRepo) Update(id string, drawing *models.SaveDrawingRequest) error {
	query := `UPDATE drawings SET name = $1, data = $2, version = version + 1, updated_at = NOW() WHERE id = $3 AND version = $4`
	result, err := r.db.Exec(query, drawing.Name, drawing.Data, id, drawing.Version)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *DrawingRepo) Delete(id string) error {
	query := `DELETE FROM drawings WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

func (r *DrawingRepo) SaveVersion(version *models.VersionHistory) error {
	query := `INSERT INTO version_history (id, drawing_id, version, data, created_by) VALUES ($1, $2, $3, $4, $5)`
	_, err := r.db.Exec(query, version.ID, version.DrawingID, version.Version, version.Data, version.CreatedBy)
	return err
}

func (r *DrawingRepo) GetVersions(drawingID string) ([]models.VersionHistory, error) {
	query := `SELECT id, drawing_id, version, data, created_at, created_by FROM version_history WHERE drawing_id = $1 ORDER BY version DESC`
	rows, err := r.db.Query(query, drawingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var versions []models.VersionHistory
	for rows.Next() {
		var v models.VersionHistory
		if err := rows.Scan(&v.ID, &v.DrawingID, &v.Version, &v.Data, &v.CreatedAt, &v.CreatedBy); err != nil {
			return nil, err
		}
		versions = append(versions, v)
	}
	return versions, nil
}

func (r *DrawingRepo) GetVersion(drawingID string, version int) (*models.VersionHistory, error) {
	v := &models.VersionHistory{}
	query := `SELECT id, drawing_id, version, data, created_at, created_by FROM version_history WHERE drawing_id = $1 AND version = $2`
	err := r.db.QueryRow(query, drawingID, version).Scan(&v.ID, &v.DrawingID, &v.Version, &v.Data, &v.CreatedAt, &v.CreatedBy)
	if err != nil {
		return nil, err
	}
	return v, nil
}

func (r *DrawingRepo) CreateComment(comment *models.Comment) error {
	query := `INSERT INTO comments (id, drawing_id, user_id, username, x, y, message, parent_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.Exec(query, comment.ID, comment.DrawingID, comment.UserID, comment.Username, comment.X, comment.Y, comment.Message, comment.ParentID)
	return err
}

func (r *DrawingRepo) GetComments(drawingID string) ([]models.Comment, error) {
	query := `SELECT id, drawing_id, user_id, username, x, y, message, parent_id, created_at FROM comments WHERE drawing_id = $1 ORDER BY created_at ASC`
	rows, err := r.db.Query(query, drawingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comments []models.Comment
	for rows.Next() {
		var c models.Comment
		if err := rows.Scan(&c.ID, &c.DrawingID, &c.UserID, &c.Username, &c.X, &c.Y, &c.Message, &c.ParentID, &c.CreatedAt); err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	return comments, nil
}

func (r *DrawingRepo) SetPermission(perm *models.Permission) error {
	query := `INSERT INTO permissions (id, drawing_id, user_id, email, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (drawing_id, user_id) DO UPDATE SET role = $5`
	_, err := r.db.Exec(query, perm.ID, perm.DrawingID, perm.UserID, perm.Email, perm.Role)
	return err
}

func (r *DrawingRepo) GetPermissions(drawingID string) ([]models.Permission, error) {
	query := `SELECT id, drawing_id, user_id, email, role, created_at FROM permissions WHERE drawing_id = $1`
	rows, err := r.db.Query(query, drawingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var perms []models.Permission
	for rows.Next() {
		var p models.Permission
		if err := rows.Scan(&p.ID, &p.DrawingID, &p.UserID, &p.Email, &p.Role, &p.CreatedAt); err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	return perms, nil
}

func (r *DrawingRepo) GetUserRole(drawingID, userID string) (string, error) {
	var role string
	query := `SELECT role FROM permissions WHERE drawing_id = $1 AND user_id = $2`
	err := r.db.QueryRow(query, drawingID, userID).Scan(&role)
	if err != nil {
		return "viewer", nil
	}
	return role, nil
}

func (r *DrawingRepo) RemovePermission(drawingID, userID string) error {
	query := `DELETE FROM permissions WHERE drawing_id = $1 AND user_id = $2`
	_, err := r.db.Exec(query, drawingID, userID)
	return err
}
