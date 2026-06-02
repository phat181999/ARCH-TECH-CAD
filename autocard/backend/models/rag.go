package models

import (
	"encoding/json"
	"time"

	pgvector "github.com/pgvector/pgvector-go"
)

type KnowledgeChunk struct {
	ID                string          `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TenantID          string          `gorm:"type:uuid;not null" json:"tenant_id"`
	DocumentTitle     string          `gorm:"column:document_title" json:"document_title"`
	SectionIdentifier string          `gorm:"column:section_identifier" json:"section_identifier"`
	Content           string          `json:"content"`
	Embedding         pgvector.Vector `gorm:"type:vector(1536)" json:"-"`
	Metadata          json.RawMessage `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	CreatedAt         time.Time       `json:"created_at"`
}

type CADComponent struct {
	ID                string          `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TenantID          string          `gorm:"type:uuid;not null" json:"tenant_id"`
	ComponentName     string          `gorm:"column:component_name" json:"component_name"`
	Category          string          `json:"category"`
	SVGRepresentation string          `gorm:"column:svg_representation" json:"svg_representation"`
	GeometryData      json.RawMessage `gorm:"column:geometry_data;type:jsonb;default:'{}'" json:"geometry_data"`
	Tags              json.RawMessage `gorm:"type:jsonb;default:'[]'" json:"tags"`
	Embedding         pgvector.Vector `gorm:"type:vector(1536)" json:"-"`
	CreatedAt         time.Time       `json:"created_at"`
}

type BuildingRule struct {
	ID            string          `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TenantID      string          `gorm:"type:uuid;not null" json:"tenant_id"`
	Jurisdiction  string          `json:"jurisdiction"`
	RuleCategory  string          `gorm:"column:rule_category" json:"rule_category"`
	TargetElement string          `gorm:"column:target_element" json:"target_element"`
	RuleType      string          `gorm:"column:rule_type" json:"rule_type"`
	Parameters    json.RawMessage `gorm:"type:jsonb" json:"parameters"`
	Description   string          `json:"description"`
	Severity      string          `json:"severity"`
	CreatedAt     time.Time       `json:"created_at"`
}

type HistoricalProject struct {
	ID                  string          `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TenantID            string          `gorm:"type:uuid;not null" json:"tenant_id"`
	ProjectName         string          `gorm:"column:project_name" json:"project_name"`
	FootprintWidth      float64         `gorm:"column:footprint_width" json:"footprint_width"`
	FootprintLength     float64         `gorm:"column:footprint_length" json:"footprint_length"`
	RoomCount           int             `gorm:"column:room_count" json:"room_count"`
	StyleTag            string          `gorm:"column:style_tag" json:"style_tag"`
	GraphRepresentation json.RawMessage `gorm:"column:graph_representation;type:jsonb;default:'{}'" json:"graph_representation"`
	GeometryJSON        json.RawMessage `gorm:"column:geometry_json;type:jsonb;default:'{}'" json:"geometry_json"`
	DXFData             []byte          `gorm:"column:dxf_data" json:"-"`
	ProjectEmbedding    pgvector.Vector `gorm:"column:project_embedding;type:vector(1536)" json:"-"`
	QualityScore        float64         `gorm:"column:quality_score" json:"quality_score"`
	CreatedAt           time.Time       `json:"created_at"`
}

type UserEdits struct {
	ID                  string          `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	ProjectID           *string         `gorm:"column:project_id;type:uuid" json:"project_id"`
	TenantID            string          `gorm:"type:uuid;not null" json:"tenant_id"`
	UserID              string          `gorm:"column:user_id;type:uuid;not null" json:"user_id"`
	InitialAIElements   json.RawMessage `gorm:"column:initial_ai_elements;type:jsonb;default:'[]'" json:"initial_ai_elements"`
	FinalUserElements   json.RawMessage `gorm:"column:final_user_elements;type:jsonb;default:'[]'" json:"final_user_elements"`
	OperationsLog       json.RawMessage `gorm:"column:operations_log;type:jsonb;default:'[]'" json:"operations_log"`
	NumberOfEdits       int             `gorm:"column:number_of_edits" json:"number_of_edits"`
	ExportTriggered     bool            `gorm:"column:export_triggered" json:"export_triggered"`
	UserRating          *int            `gorm:"column:user_rating" json:"user_rating"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

type DesignTemplate struct {
	ID           string          `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TenantID     string          `gorm:"type:uuid;not null" json:"tenant_id"`
	TemplateName string          `gorm:"column:template_name" json:"template_name"`
	RoomTopology json.RawMessage `gorm:"column:room_topology;type:jsonb;default:'{}'" json:"room_topology"`
	Embedding    pgvector.Vector `gorm:"type:vector(1536)" json:"-"`
	CreatedAt    time.Time       `json:"created_at"`
}

type GoldenDesign struct {
	ID                     string          `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TenantID               string          `gorm:"type:uuid;not null" json:"tenant_id"`
	SourceProjectID        *string         `gorm:"column:source_project_id;type:uuid" json:"source_project_id"`
	ArchitectReviewerID    string          `gorm:"column:architect_reviewer_id;type:uuid;not null" json:"architect_reviewer_id"`
	ReviewComments         string          `gorm:"column:review_comments" json:"review_comments"`
	VerifiedComplianceRules json.RawMessage `gorm:"column:verified_compliance_rules;type:jsonb;default:'[]'" json:"verified_compliance_rules"`
	Embedding              pgvector.Vector `gorm:"type:vector(1536)" json:"-"`
	CreatedAt              time.Time       `json:"created_at"`
}
