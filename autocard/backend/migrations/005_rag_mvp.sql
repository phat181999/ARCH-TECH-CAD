CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- knowledge_chunks: building codes, IBC, Neufert, etc.
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    document_title VARCHAR(255) NOT NULL,
    section_identifier VARCHAR(100) NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- cad_components: block library (doors, windows, toilets, furniture)
CREATE TABLE IF NOT EXISTS cad_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    component_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    svg_representation TEXT DEFAULT '',
    geometry_data JSONB NOT NULL DEFAULT '{}',
    tags JSONB NOT NULL DEFAULT '[]',
    embedding VECTOR(1536) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- building_rules: structured compliance rules
CREATE TABLE IF NOT EXISTS building_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    jurisdiction VARCHAR(100) NOT NULL DEFAULT 'global',
    rule_category VARCHAR(100) NOT NULL,
    target_element VARCHAR(50) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('min_area','min_width','max_occupancy','egress_count','door_swing_clearance')),
    parameters JSONB NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- historical_projects: completed CAD drawings with embeddings
CREATE TABLE IF NOT EXISTS historical_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    project_name VARCHAR(100) NOT NULL,
    footprint_width NUMERIC NOT NULL DEFAULT 0,
    footprint_length NUMERIC NOT NULL DEFAULT 0,
    room_count INTEGER NOT NULL DEFAULT 0,
    style_tag VARCHAR(50) NOT NULL DEFAULT 'modern',
    graph_representation JSONB NOT NULL DEFAULT '{}',
    geometry_json JSONB NOT NULL DEFAULT '{}',
    dxf_data BYTEA,
    project_embedding VECTOR(1536) NOT NULL,
    quality_score NUMERIC DEFAULT 0.0 CHECK (quality_score >= 0 AND quality_score <= 1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_edits: per-session edit logs (capped at 500 ops by application)
CREATE TABLE IF NOT EXISTS user_edits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES historical_projects(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    initial_ai_elements JSONB NOT NULL DEFAULT '[]',
    final_user_elements JSONB NOT NULL DEFAULT '[]',
    operations_log JSONB NOT NULL DEFAULT '[]',
    number_of_edits INTEGER NOT NULL DEFAULT 0,
    export_triggered BOOLEAN DEFAULT FALSE,
    user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- design_templates: skeletal layout templates
CREATE TABLE IF NOT EXISTS design_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    room_topology JSONB NOT NULL DEFAULT '{}',
    embedding VECTOR(1536) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- golden_designs: architect-approved reference layouts
CREATE TABLE IF NOT EXISTS golden_designs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    source_project_id UUID REFERENCES historical_projects(id) ON DELETE SET NULL,
    architect_reviewer_id UUID NOT NULL REFERENCES users(id),
    review_comments TEXT DEFAULT '',
    verified_compliance_rules JSONB NOT NULL DEFAULT '[]',
    embedding VECTOR(1536) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chunks_tenant ON knowledge_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_components_tenant ON cad_components(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rules_tenant ON building_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON historical_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_edits_tenant ON user_edits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_edits_user ON user_edits(user_id);
CREATE INDEX IF NOT EXISTS idx_golden_tenant ON golden_designs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_geometry ON historical_projects(footprint_width, footprint_length);
CREATE INDEX IF NOT EXISTS idx_projects_style ON historical_projects(style_tag);

-- Full-text indexes for BM25
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON knowledge_chunks USING gin(tsv);
CREATE INDEX IF NOT EXISTS idx_rules_fts ON building_rules USING gin(to_tsvector('english', description));

-- HNSW vector indexes
CREATE INDEX IF NOT EXISTS idx_chunks_vector ON knowledge_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_projects_vector ON historical_projects USING hnsw (project_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_components_vector ON cad_components USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_templates_vector ON design_templates USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_golden_vector ON golden_designs USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 128);

-- RLS policies
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE golden_designs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current tenant from session setting
-- Returns nil UUID if setting not present (allows global/public records through)
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

DROP POLICY IF EXISTS rag_select_policy ON knowledge_chunks;
DROP POLICY IF EXISTS rag_insert_policy ON knowledge_chunks;
CREATE POLICY rag_select_policy ON knowledge_chunks FOR SELECT
  USING (tenant_id = current_tenant_id() OR tenant_id = '00000000-0000-0000-0000-000000000000'::uuid);
CREATE POLICY rag_insert_policy ON knowledge_chunks FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS rag_select_policy ON cad_components;
DROP POLICY IF EXISTS rag_insert_policy ON cad_components;
CREATE POLICY rag_select_policy ON cad_components FOR SELECT
  USING (tenant_id = current_tenant_id() OR tenant_id = '00000000-0000-0000-0000-000000000000'::uuid);
CREATE POLICY rag_insert_policy ON cad_components FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS rag_select_policy ON building_rules;
DROP POLICY IF EXISTS rag_insert_policy ON building_rules;
CREATE POLICY rag_select_policy ON building_rules FOR SELECT
  USING (tenant_id = current_tenant_id() OR tenant_id = '00000000-0000-0000-0000-000000000000'::uuid);
CREATE POLICY rag_insert_policy ON building_rules FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS rag_select_policy ON historical_projects;
DROP POLICY IF EXISTS rag_insert_policy ON historical_projects;
DROP POLICY IF EXISTS rag_update_policy ON historical_projects;
CREATE POLICY rag_select_policy ON historical_projects FOR SELECT
  USING (tenant_id = current_tenant_id());
CREATE POLICY rag_insert_policy ON historical_projects FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY rag_update_policy ON historical_projects FOR UPDATE
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS rag_select_policy ON user_edits;
DROP POLICY IF EXISTS rag_insert_policy ON user_edits;
DROP POLICY IF EXISTS rag_update_policy ON user_edits;
CREATE POLICY rag_select_policy ON user_edits FOR SELECT
  USING (tenant_id = current_tenant_id());
CREATE POLICY rag_insert_policy ON user_edits FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY rag_update_policy ON user_edits FOR UPDATE
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS rag_select_policy ON golden_designs;
DROP POLICY IF EXISTS rag_insert_policy ON golden_designs;
CREATE POLICY rag_select_policy ON golden_designs FOR SELECT
  USING (tenant_id = current_tenant_id() OR tenant_id = '00000000-0000-0000-0000-000000000000'::uuid);
CREATE POLICY rag_insert_policy ON golden_designs FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());
