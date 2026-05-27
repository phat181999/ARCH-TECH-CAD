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

-- Seed default packages
INSERT INTO subscription_packages (id, name, code, price, duration_days, max_members, max_drawings, features) VALUES
('b27e8ea7-a37a-4467-bc1b-85fe302636a0', 'Free Tier', 'free', 0.00, 3650, 3, 5, '3 Drawings, 3 members max, Basic 2D Drafting'),
('c53ef821-2ef3-40f4-a82f-8d2b78b0213d', 'Pro Monthly', 'pro-monthly', 29.00, 30, 15, 100, '100 Drawings, 15 members, 3D Rendering, AI Drawing Assistant, DXF Export'),
('f84a4411-8e0a-4fb4-bbfd-1deeb6b3b24f', 'Enterprise Plan', 'enterprise-annual', 299.00, 365, 999, 999, 'Unlimited Drawings, Unlimited members, 3D Rendering, Dedicated Support, Custom Integrations, DXF/DWG Export')
ON CONFLICT (code) DO NOTHING;
