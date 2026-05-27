# Implementation Plan: Organization Creation & Member Invitation Flow (PostgreSQL + Redis)

This plan outlines the architecture and steps to implement the **Create Organization** and **Invite Member** flow, combining persistent PostgreSQL storage (active members) with temporary Redis keys (pending invites with TTL) before returning them to the client.

## User Review Required

> [!IMPORTANT]
> - **Redis Connection**: The Go backend will connect to Redis at `localhost:6379` by default. Ensure Redis is running locally.
> - **Automatic Acceptance vs. Explicit Acceptance**: When a new user registers or logs in, any pending invites matching their email in Redis will automatically map them to those organizations in the DB. We will also provide a manual invitation acceptance endpoint `/api/organizations/invitations/accept`.

---

## Proposed Changes

### 1. Database Schema & Models (PostgreSQL)

#### [NEW] [organization.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/models/organization.go)
- Create GORM model structs for:
  - `Organization`: `id`, `name`, `created_at`, `updated_at`.
  - `OrganizationMember`: `id`, `organization_id`, `user_id`, `role` (Admin, Editor, Viewer), `created_at`, `updated_at`.

#### [NEW] [003_add_organizations.sql](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/migrations/003_add_organizations.sql)
- Raw SQL migration table definitions for `organizations` and `organization_members` tables with foreign keys and unique constraints.

#### [MODIFY] [run_migration.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/run_migration.go)
- Register `&models.Organization{}` and `&models.OrganizationMember{}` inside GORM `db.AutoMigrate()`.

---

### 2. Configuration & Redis Setup

#### [MODIFY] [config.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/config/config.go)
- Add `RedisHost` and `RedisPort` variables to the `Config` struct (default to `localhost:6379`).
- Implement `RedisAddr()` helper.

#### [MODIFY] [main.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/main.go)
- Import `github.com/redis/go-redis/v9`.
- Initialize `rdb := redis.NewClient(...)`.
- Pass GORM DB and Redis Client to the new `OrganizationRepo` and handler.

---

### 3. Repository Layer (PostgreSQL + Redis Integration)

#### [NEW] [organization_repo.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/repository/organization_repo.go)
- Create `OrganizationRepo` struct:
  ```go
  type OrganizationRepo struct {
      db  *gorm.DB
      rdb *redis.Client
  }
  ```
- Implement:
  - `Create(org *models.Organization, creatorUserID string) error`: Saves org to DB and creates a member row with "Admin" role.
  - `GetUserOrganizations(userID string) ([]models.Organization, error)`: Lists all organizations where user is a member.
  - `InviteMember(orgID string, email string, role string, invitedBy string) error`: Saves pending invite as Redis key `org_invite:{orgID}:{email}` with TTL (e.g. 24h).
  - `GetMembersAndInvites(orgID string) ([]models.MemberResponse, error)`:
    - Queries DB for active members from `organization_members` joined with `users`.
    - Scans/gets Redis keys starting with `org_invite:{orgID}:*` to extract pending invitation details.
    - Merges both lists with a `status` field ("Active" or "Pending") and returns them.
  - `ClaimPendingInvites(userEmail string, userID string) error`: Scans Redis for invites to `userEmail`, creates DB member entries, and deletes the Redis invite keys.

---

### 4. HTTP Handlers

#### [NEW] [organization_handler.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/handlers/organization_handler.go)
- Handle API endpoints:
  - `POST /api/organizations` -> Create organization.
  - `GET /api/organizations` -> List user's organizations.
  - `GET /api/organizations/{id}/members` -> Get combined DB members + Redis invites.
  - `POST /api/organizations/{id}/invitations` -> Invite a member.

#### [MODIFY] [auth_handler.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/handlers/auth_handler.go)
- On successful `Register`, extract `org` (Organization Name) if provided and invoke the organization creation logic.
- After creating a user account, call `ClaimPendingInvites` to automatically link any pre-existing pending Redis invitations to their new user ID.

---

### 5. Frontend Integration

#### [MODIFY] [client.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/api/client.ts)
- Add API client wrapper methods for organizations and invitations:
  - `organizations.create(...)`
  - `organizations.list()`
  - `organizations.getMembers(orgId)`
  - `organizations.invite(orgId, body)`

#### [MODIFY] [RegisterPage.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/RegisterPage.tsx)
- Pass `org` parameter to registration store call.

#### [MODIFY] [authStore.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/stores/authStore.ts)
- Modify `register` method signature and payload to include `orgName?: string`.

#### [MODIFY] [TeamPage.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/TeamPage.tsx)
- Dynamically fetch organization members/invitations from the backend API.
- Manage invitation modals and update the table state immediately after successful requests.

#### [MODIFY] [InviteMemberModal.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/components/ui/InviteMemberModal.tsx)
- Perform actual invitation request to the API, displaying errors or success statuses.

---

## Verification Plan

### Automated Tests
- Run migration and check for successful schema creation.
- Check TypeScript type completeness:
  ```bash
  npx tsc --noEmit
  ```
- Build frontend production bundles:
  ```bash
  npm run build
  ```

### Manual Verification
1. Register a new user with an Organization name; verify that both user and organization are initialized in the DB.
2. Go to the Team page and invite a non-existing email (e.g. `colleague@domain.com`).
3. Verify that the invited email appears as "Pending" in the members list.
4. Verify using `redis-cli KEYS "*"` that a TTL-bound key is created.
5. Register a new account with the invited email, and verify that the account is automatically associated with the organization, and the pending invite key is removed from Redis.
