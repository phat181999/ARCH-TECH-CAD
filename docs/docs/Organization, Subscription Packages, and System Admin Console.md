# Implementation Plan: Organization, Subscription Packages, and System Admin Console

This plan details the implementation of organization management, roles, and a dedicated **System Admin Module**. This console allows platform administrators (`system_admin`) to manage users, organizations, member roles, and organization subscription packages (defining the tier and active period of the organization).

---

## Role Definitions & Privileges

### 1. Application-Wide Role (`users.system_role`)
- **`user`** (Default): Standard user. Can only manage their own organizations.
- **`system_admin`**: Platform superuser. Has access to the **Admin Console** to manage all users, organizations, drawing assets, and subscription packages.

### 2. Organization Member Roles (`organization_members.role`)
- **`owner`**: Full administrative control over the specific organization. Can edit settings, manage billing/billing plans, and add/remove members.
- **`editor`**: Read-write access to drawings within the organization.
- **`viewer`**: Read-only access to drawings within the organization.

---

## Proposed Changes

### 1. Database Schema & GORM Models

#### [MODIFY] [user.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/models/user.go)
- Add `SystemRole` to the `User` model:
  ```go
  SystemRole string `json:"system_role" gorm:"not null;default:'user'"` // 'user' or 'system_admin'
  ```

#### [NEW] [organization.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/models/organization.go)
- Define `Organization` with subscription package details:
  ```go
  type Organization struct {
      ID                  string     `json:"id" gorm:"primaryKey"`
      Name                string     `json:"name" gorm:"not null"`
      SubscriptionTier    string     `json:"subscription_tier" gorm:"not null;default:'free'"` // 'free', 'premium', 'enterprise'
      SubscriptionExpires *time.Time `json:"subscription_expires"` // expiration period of the organization
      CreatedAt           time.Time  `json:"created_at"`
      UpdatedAt           time.Time  `json:"updated_at"`
  }
  ```
- Define `OrganizationMember` join model (separate from `User` to avoid combining them):
  ```go
  type OrganizationMember struct {
      ID             string    `json:"id" gorm:"primaryKey"`
      OrganizationID string    `json:"organization_id" gorm:"index"`
      UserID         string    `json:"user_id" gorm:"index"`
      Role           string    `json:"role"` // 'owner', 'editor', 'viewer'
      CreatedAt      time.Time `json:"created_at"`
      UpdatedAt      time.Time `json:"updated_at"`
      User           *User     `json:"user,omitempty" gorm:"foreignKey:UserID"`
  }
  ```

#### [NEW] [003_add_organizations_and_packages.sql](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/migrations/003_add_organizations_and_packages.sql)
- Raw SQL migration table definitions:
  - Alter `users` table to add `system_role`.
  - Create `organizations` table with `subscription_tier` and `subscription_expires` fields.
  - Create `organization_members` join table.

#### [MODIFY] [run_migration.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/run_migration.go)
- Add `&models.Organization{}` and `&models.OrganizationMember{}` to GORM `db.AutoMigrate()`.

---

### 2. Configuration & Redis Setup

#### [MODIFY] [config.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/config/config.go)
- Parse `RedisHost` and `RedisPort` configuration.

#### [MODIFY] [main.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/main.go)
- Initialize Redis client and pass to repositories/handlers.
- Register Admin Console routes.

---

### 3. Repository Layer

#### [NEW] [organization_repo.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/repository/organization_repo.go)
- Implement `OrganizationRepo`:
  - `Create(org *models.Organization, creatorUserID string)`: Saves to DB and adds creator as `owner`.
  - `GetUserOrganizations(userID string)`: Fetch organizations user belongs to.
  - `InviteMember(orgID, email, role, invitedBy)`: Saves pending invite to Redis with a 24h TTL.
  - `GetMembersAndInvites(orgID)`: Returns separate lists of DB members and Redis pending invitations.
  - `ClaimPendingInvites(userEmail, userID)`: Promotes matching Redis invites to DB members.
  - **Admin Actions**:
    - `GetAllOrganizations()`: List all organizations.
    - `UpdateSubscription(orgID string, tier string, expires *time.Time)`: Updates subscription package and active period.
    - `DeleteOrganization(orgID string)`: Deletes organization and cleans up members.
    - `GetAllUsers()`: List all platform users.
    - `UpdateSystemRole(userID string, role string)`: Update user's system role.

---

### 4. HTTP Handlers & Middlewares

#### [NEW] [organization_handler.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/handlers/organization_handler.go)
- Handle organization endpoints.

#### [NEW] [admin_handler.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/handlers/admin_handler.go)
- Handle system-admin specific endpoints:
  - `GET /api/admin/organizations` -> List all organizations + package periods.
  - `PUT /api/admin/organizations/{id}/subscription` -> Modify organization package/period.
  - `DELETE /api/admin/organizations/{id}` -> Delete organization.
  - `GET /api/admin/users` -> List all system users.
  - `PUT /api/admin/users/{id}/system-role` -> Toggle/change a user's system role.

#### [NEW] [role_middleware.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/middleware/role_middleware.go)
- Create `RequireSystemAdmin` middleware to block non-admin access to `/api/admin/*` routes.
- Create `RequireOrgRole(minRole string)` middleware for organization routes.

---

### 5. Frontend Integration

#### [MODIFY] [client.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/api/client.ts)
- Add endpoints for organizations and admin actions:
  - `admin.getOrganizations()`, `admin.updateSubscription(orgId, body)`, `admin.deleteOrganization(orgId)`
  - `admin.getUsers()`, `admin.updateSystemRole(userId, body)`

#### [NEW] [AdminConsolePage.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/AdminConsolePage.tsx)
- Create a beautiful control panel visible *only* to users with `system_role === 'system_admin'`.
- Includes three main tabs:
  - **Organizations**: Manage all organizations, edit subscription packages/expiration dates, and delete organizations.
  - **Users**: List all platform users and promote/demote standard users to `system_admin`.
  - **Organization Members**: Select any organization and inspect/manage roles of its members.

#### [MODIFY] [Sidebar.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/components/layout/Sidebar.tsx)
- Conditionally render a premium-looking **"Admin Console"** link under a new "Administration" group if the logged-in user is a `system_admin`.

#### [MODIFY] [TeamPage.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/TeamPage.tsx)
- Fetch and display the split active members (GORM) and pending invitations (Redis) list.
- Support promoting/demoting organization member roles (e.g. promoting `editor` to `owner` or demoting to `viewer`).

---

## Verification Plan

### Automated Tests
- Run migration checks.
- Build and compile frontend: `npx tsc --noEmit && npm run build`.

### Manual Verification
1. Log in as a standard user; confirm that the "Admin Console" link in the sidebar is invisible.
2. Directly promote a test user to `system_admin` in the DB. Verify they can see the "Admin Console" sidebar link and navigate to `/admin`.
3. In the Admin Console, change an organization's subscription package to "Premium" and set its expiration period to 1 year in the future. Verify it updates in GORM.
4. Invite members to an organization, and verify they appear under the separate "Pending Invitations" list.
