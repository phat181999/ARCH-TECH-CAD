package repository

import (
	"encoding/json"
	"time"

	"autocard-backend/models"

	pgvector "github.com/pgvector/pgvector-go"
	"gorm.io/gorm"
)

const nilUUID = "00000000-0000-0000-0000-000000000000"

type RAGRepo struct {
	db *gorm.DB
}

func NewRAGRepo(db *gorm.DB) *RAGRepo {
	return &RAGRepo{db: db}
}

// ── Knowledge chunks ──────────────────────────────────────────────────────────

func (r *RAGRepo) CreateKnowledgeChunk(chunk *models.KnowledgeChunk) error {
	return r.db.Create(chunk).Error
}

func (r *RAGRepo) VectorSearchChunks(tenantID string, embedding pgvector.Vector, limit int) ([]models.KnowledgeChunk, error) {
	var results []models.KnowledgeChunk
	err := r.db.Raw(
		`SELECT * FROM knowledge_chunks
		 WHERE (tenant_id = ? OR tenant_id = ?::uuid)
		 ORDER BY embedding <=> ? LIMIT ?`,
		tenantID, nilUUID, embedding, limit,
	).Scan(&results).Error
	return results, err
}

func (r *RAGRepo) BM25SearchChunks(tenantID string, query string, limit int) ([]models.KnowledgeChunk, error) {
	var results []models.KnowledgeChunk
	err := r.db.Raw(
		`SELECT * FROM knowledge_chunks
		 WHERE (tenant_id = ? OR tenant_id = ?::uuid)
		   AND tsv @@ plainto_tsquery('english', ?)
		 ORDER BY ts_rank(tsv, plainto_tsquery('english', ?)) DESC LIMIT ?`,
		tenantID, nilUUID, query, query, limit,
	).Scan(&results).Error
	return results, err
}

// ── CAD components ────────────────────────────────────────────────────────────

func (r *RAGRepo) CreateCADComponent(c *models.CADComponent) error {
	return r.db.Create(c).Error
}

func (r *RAGRepo) VectorSearchComponents(tenantID string, embedding pgvector.Vector, limit int) ([]models.CADComponent, error) {
	var results []models.CADComponent
	err := r.db.Raw(
		`SELECT * FROM cad_components
		 WHERE (tenant_id = ? OR tenant_id = ?::uuid)
		 ORDER BY embedding <=> ? LIMIT ?`,
		tenantID, nilUUID, embedding, limit,
	).Scan(&results).Error
	return results, err
}

// ── Building rules ────────────────────────────────────────────────────────────

func (r *RAGRepo) CreateBuildingRule(rule *models.BuildingRule) error {
	return r.db.Create(rule).Error
}

func (r *RAGRepo) GetBuildingRules(tenantID, jurisdiction string) ([]models.BuildingRule, error) {
	var results []models.BuildingRule
	// Always include INTL (international ergonomic standards) and global rules
	// alongside the jurisdiction-specific rules so every query gets a baseline set.
	err := r.db.Where(
		"(tenant_id = ? OR tenant_id = ?) AND (jurisdiction = ? OR jurisdiction = 'global' OR jurisdiction = 'INTL')",
		tenantID, nilUUID, jurisdiction,
	).Find(&results).Error
	return results, err
}

func (r *RAGRepo) BM25SearchRules(tenantID string, query string, limit int) ([]models.BuildingRule, error) {
	var results []models.BuildingRule
	err := r.db.Raw(
		`SELECT * FROM building_rules
		 WHERE (tenant_id = ? OR tenant_id = ?::uuid)
		   AND to_tsvector('english', description) @@ plainto_tsquery('english', ?)
		 ORDER BY ts_rank(to_tsvector('english', description), plainto_tsquery('english', ?)) DESC LIMIT ?`,
		tenantID, nilUUID, query, query, limit,
	).Scan(&results).Error
	return results, err
}

// ── Historical projects ───────────────────────────────────────────────────────

func (r *RAGRepo) CreateHistoricalProject(p *models.HistoricalProject) error {
	return r.db.Create(p).Error
}

func (r *RAGRepo) VectorSearchProjects(tenantID string, embedding pgvector.Vector, widthMin, widthMax, lengthMin, lengthMax float64, styleTag string, limit int) ([]models.HistoricalProject, error) {
	var results []models.HistoricalProject

	query := r.db.Raw(
		`SELECT * FROM historical_projects
		 WHERE tenant_id = ?
		   AND footprint_width BETWEEN ? AND ?
		   AND footprint_length BETWEEN ? AND ?
		   AND (? = '' OR style_tag = ?)
		 ORDER BY project_embedding <=> ? LIMIT ?`,
		tenantID, widthMin, widthMax, lengthMin, lengthMax, styleTag, styleTag, embedding, limit,
	)
	err := query.Scan(&results).Error
	return results, err
}

func (r *RAGRepo) UpdateProjectQuality(id string, score float64) error {
	return r.db.Model(&models.HistoricalProject{}).
		Where("id = ?", id).
		Update("quality_score", score).Error
}

// ── User edits ────────────────────────────────────────────────────────────────

func (r *RAGRepo) CreateUserEditSession(session *models.UserEdits) error {
	return r.db.Create(session).Error
}

func (r *RAGRepo) AppendEditActions(sessionID string, actions []json.RawMessage, count int) error {
	newActions, err := json.Marshal(actions)
	if err != nil {
		return err
	}
	// Atomic JSONB concatenation — no read-modify-write, no race condition.
	// Postgres || on jsonb arrays appends in place; the CASE caps the log at 500 entries.
	return r.db.Exec(`
		UPDATE user_edits
		SET
			operations_log = (
				CASE
					WHEN jsonb_array_length(operations_log || ?::jsonb) > 500
					THEN (operations_log || ?::jsonb)[jsonb_array_length(operations_log || ?::jsonb)-500:]
					ELSE operations_log || ?::jsonb
				END
			),
			number_of_edits = number_of_edits + ?,
			updated_at = NOW()
		WHERE id = ?`,
		string(newActions), string(newActions), string(newActions), string(newActions),
		count, sessionID,
	).Error
}

func (r *RAGRepo) MarkExported(sessionID string, rating *int) error {
	updates := map[string]interface{}{
		"export_triggered": true,
		"updated_at":       time.Now(),
	}
	if rating != nil {
		updates["user_rating"] = *rating
	}
	return r.db.Model(&models.UserEdits{}).
		Where("id = ?", sessionID).
		Updates(updates).Error
}

func (r *RAGRepo) GetUserEdits(tenantID, userID string, limit int) ([]models.UserEdits, error) {
	var results []models.UserEdits
	err := r.db.Where("tenant_id = ? AND user_id = ?", tenantID, userID).
		Order("created_at desc").
		Limit(limit).
		Find(&results).Error
	return results, err
}

func (r *RAGRepo) GetEditSessionByID(sessionID string) (*models.UserEdits, error) {
	var session models.UserEdits
	err := r.db.Where("id = ?", sessionID).First(&session).Error
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// ── Design templates ──────────────────────────────────────────────────────────

func (r *RAGRepo) CreateDesignTemplate(t *models.DesignTemplate) error {
	return r.db.Create(t).Error
}

func (r *RAGRepo) VectorSearchTemplates(tenantID string, embedding pgvector.Vector, limit int) ([]models.DesignTemplate, error) {
	var results []models.DesignTemplate
	err := r.db.Raw(
		`SELECT * FROM design_templates
		 WHERE (tenant_id = ? OR tenant_id = ?::uuid)
		 ORDER BY embedding <=> ? LIMIT ?`,
		tenantID, nilUUID, embedding, limit,
	).Scan(&results).Error
	return results, err
}

// ── Golden designs ────────────────────────────────────────────────────────────

func (r *RAGRepo) CreateGoldenDesign(g *models.GoldenDesign) error {
	return r.db.Create(g).Error
}

func (r *RAGRepo) GetProjectByID(id string, out *models.HistoricalProject) error {
	return r.db.Where("id = ?", id).First(out).Error
}

func (r *RAGRepo) GetGoldenDesigns(tenantID string, limit int) ([]models.GoldenDesign, error) {
	var results []models.GoldenDesign
	err := r.db.Where("tenant_id = ? OR tenant_id = ?", tenantID, nilUUID).
		Order("created_at desc").
		Limit(limit).
		Find(&results).Error
	return results, err
}
