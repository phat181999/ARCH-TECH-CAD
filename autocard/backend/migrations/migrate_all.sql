-- ═══════════════════════════════════════════════════════════════════════════
-- ARCH-TECH-CAD — Complete Database Migration (001 → 005 + column patches)
-- Run this once in Supabase SQL Editor or via psql
-- Safe to re-run: all statements use IF NOT EXISTS / IF EXISTS / ON CONFLICT
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 001: Core tables ─────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL DEFAULT '',
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drawings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Untitled',
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drawings_user_id ON drawings(user_id);

-- ── 002: Collaboration ───────────────────────────────────────────────────────

ALTER TABLE drawings ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS version_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id UUID NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    data JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_version_history_drawing ON version_history(drawing_id);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id UUID NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    username VARCHAR(100) NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    message TEXT NOT NULL,
    parent_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_drawing ON comments(drawing_id);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id UUID NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(drawing_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_permissions_drawing ON permissions(drawing_id);

-- ── 003: Organizations ───────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS system_role VARCHAR(50) NOT NULL DEFAULT 'user';

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free',
    subscription_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_org  ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id);

-- ── 004: Subscription packages ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    duration_days INTEGER NOT NULL DEFAULT 30,
    max_members INTEGER NOT NULL DEFAULT 5,
    max_drawings INTEGER NOT NULL DEFAULT 10,
    features TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_package_id UUID REFERENCES subscription_packages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_sub_package ON organizations(subscription_package_id);

INSERT INTO subscription_packages (id, name, code, price, duration_days, max_members, max_drawings, features) VALUES
    ('b27e8ea7-a37a-4467-bc1b-85fe302636a0', 'Free Tier',       'free',             0.00,  3650, 3,   5,   '3 Drawings, 3 members max, Basic 2D Drafting'),
    ('c53ef821-2ef3-40f4-a82f-8d2b78b0213d', 'Pro Monthly',     'pro-monthly',     29.00,    30, 15, 100,  '100 Drawings, 15 members, 3D Rendering, AI Drawing Assistant, DXF Export'),
    ('f84a4411-8e0a-4fb4-bbfd-1deeb6b3b24f', 'Enterprise Plan', 'enterprise-annual',299.00, 365, 999, 999, 'Unlimited Drawings, Unlimited members, 3D Rendering, Dedicated Support, Custom Integrations')
ON CONFLICT (code) DO NOTHING;

-- ── Column patches (applied by main.go on each startup) ──────────────────────

ALTER TABLE users        ADD COLUMN IF NOT EXISTS preferences TEXT NOT NULL DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS image_org TEXT NOT NULL DEFAULT '';
ALTER TABLE drawings      ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';

-- ── 005: RAG / AI knowledge base ─────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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

CREATE TABLE IF NOT EXISTS building_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    jurisdiction VARCHAR(100) NOT NULL DEFAULT 'global',
    rule_category VARCHAR(100) NOT NULL,
    target_element VARCHAR(50) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN (
        'min_area', 'min_width', 'max_occupancy', 'egress_count', 'door_swing_clearance',
        'min_ceiling_height', 'max_site_coverage', 'min_setback_front',
        'min_window_ratio', 'step_ergonomics', 'step_formula', 'max_rise'
    )),
    parameters JSONB NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS design_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    room_topology JSONB NOT NULL DEFAULT '{}',
    embedding VECTOR(1536) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Standard indexes
CREATE INDEX IF NOT EXISTS idx_chunks_tenant     ON knowledge_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_components_tenant ON cad_components(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rules_tenant      ON building_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant   ON historical_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_edits_tenant      ON user_edits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_edits_user        ON user_edits(user_id);
CREATE INDEX IF NOT EXISTS idx_golden_tenant     ON golden_designs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_geometry ON historical_projects(footprint_width, footprint_length);
CREATE INDEX IF NOT EXISTS idx_projects_style    ON historical_projects(style_tag);
CREATE INDEX IF NOT EXISTS idx_rules_category    ON building_rules(rule_category);

-- Full-text search indexes (BM25)
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON knowledge_chunks USING gin(tsv);
CREATE INDEX IF NOT EXISTS idx_rules_fts  ON building_rules   USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_rules_combined_fts ON building_rules USING gin(to_tsvector('english', rule_category || ' ' || target_element));

-- HNSW vector indexes (cosine similarity)
CREATE INDEX IF NOT EXISTS idx_chunks_vector     ON knowledge_chunks     USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_projects_vector   ON historical_projects  USING hnsw (project_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_components_vector ON cad_components       USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_templates_vector  ON design_templates     USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_golden_vector     ON golden_designs       USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 128);

-- Row Level Security
ALTER TABLE knowledge_chunks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_components       ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_edits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE golden_designs       ENABLE ROW LEVEL SECURITY;

-- Tenant resolver function
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- RLS Policies
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
CREATE POLICY rag_select_policy ON historical_projects FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY rag_insert_policy ON historical_projects FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY rag_update_policy ON historical_projects FOR UPDATE USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS rag_select_policy ON user_edits;
DROP POLICY IF EXISTS rag_insert_policy ON user_edits;
DROP POLICY IF EXISTS rag_update_policy ON user_edits;
CREATE POLICY rag_select_policy ON user_edits FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY rag_insert_policy ON user_edits FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY rag_update_policy ON user_edits FOR UPDATE USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS rag_select_policy ON golden_designs;
DROP POLICY IF EXISTS rag_insert_policy ON golden_designs;
CREATE POLICY rag_select_policy ON golden_designs FOR SELECT
  USING (tenant_id = current_tenant_id() OR tenant_id = '00000000-0000-0000-0000-000000000000'::uuid);
CREATE POLICY rag_insert_policy ON golden_designs FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Done ─────────────────────────────────────────────────────────────────────
-- Verify: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
