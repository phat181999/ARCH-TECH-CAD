-- New independent members table (no FK to users)
CREATE TABLE IF NOT EXISTS members (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          VARCHAR(255) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL DEFAULT '',
    name           VARCHAR(100) NOT NULL DEFAULT '',
    avatar_url     TEXT         NOT NULL DEFAULT '',
    job_title      VARCHAR(100) NOT NULL DEFAULT '',
    phone          VARCHAR(50)  NOT NULL DEFAULT '',
    invited_by     VARCHAR(255) NOT NULL DEFAULT '', -- email of admin/owner who invited
    email_verified BOOLEAN      DEFAULT FALSE,
    provider       VARCHAR(50)  NOT NULL DEFAULT 'email', -- 'email', 'google', 'github', etc.
    created_at     TIMESTAMPTZ  DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);

-- Alter organization_members to reference members instead of users
-- Step 1: Add new member_id column
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE CASCADE;

-- Step 2: Make user_id nullable and drop old unique constraint
ALTER TABLE organization_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_organization_id_user_id_key;

-- Step 3: Restore user-lane uniqueness + add member-lane uniqueness + mutual-exclusivity check
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS org_member_unique;
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS org_member_identity_check;
-- Partial unique indexes prevent duplicate memberships while allowing NULL in the other column
DROP INDEX IF EXISTS org_user_unique;
DROP INDEX IF EXISTS org_member_unique;
CREATE UNIQUE INDEX org_user_unique
    ON organization_members (organization_id, user_id)
    WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX org_member_unique
    ON organization_members (organization_id, member_id)
    WHERE member_id IS NOT NULL;
-- Ensure exactly one identity per row (no orphan or ambiguous rows)
ALTER TABLE organization_members ADD CONSTRAINT org_member_identity_check
    CHECK (
        (user_id IS NOT NULL AND member_id IS NULL) OR
        (user_id IS NULL AND member_id IS NOT NULL)
    );

-- Step 4: Drop strict foreign key constraints referencing users(id) in other tables
-- This allows drawings, comments, and permissions to be created/held by member accounts.
ALTER TABLE drawings DROP CONSTRAINT IF EXISTS drawings_user_id_fkey;
ALTER TABLE version_history DROP CONSTRAINT IF EXISTS version_history_created_by_fkey;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_user_id_fkey;
ALTER TABLE user_edits DROP CONSTRAINT IF EXISTS user_edits_user_id_fkey;
ALTER TABLE golden_designs DROP CONSTRAINT IF EXISTS golden_designs_architect_reviewer_id_fkey;
