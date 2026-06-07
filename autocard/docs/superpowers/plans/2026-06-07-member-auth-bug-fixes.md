# Member Auth Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 confirmed bugs in the member authentication system — covering corrupt JWTs from empty member IDs, OAuth lockout, dead routes, duplicate memberships, Base64URL decoding crashes, and login-flow enumeration.

**Architecture:** Six targeted tasks across backend Go handlers/middleware and frontend Zustand store. No new abstractions are introduced — fixes are surgical. A `GetPrincipalID` middleware helper eliminates the copy-pasted dual-key extraction pattern across handlers. Role type is added to all auth response bodies, removing the need for client-side JWT decoding entirely.

**Tech Stack:** Go 1.22 / GORM + pgx/v5 (PostgreSQL) / net/http — React 19 + TypeScript + Zustand

---

## Files Changed

| File | Change |
|---|---|
| `backend/handlers/member_handler.go` | Add `ID` before Create; provider guard in Login; pre-check email before Create to fix 409 masking |
| `backend/middleware/auth.go` | Remove `UserIDKey` from member token path; add `GetPrincipalID` helper |
| `backend/handlers/organization_handler.go` | Replace 3× copy-pasted dual-key block with `GetPrincipalID` |
| `backend/handlers/drawing_handler.go` | Replace 9× bare `UserIDKey` assertions with `GetPrincipalID` |
| `backend/handlers/auth_handler.go` | Add `role_type` field to all auth responses |
| `backend/main.go` | Add `mux.Handle("/api/members/", authMiddleware(protected))` |
| `backend/migrations/006_members_table.sql` | Add `UNIQUE(org_id, user_id)` constraint + mutual-exclusivity CHECK |
| `backend/migrations/migrate_all.sql` | Mirror the same constraint additions |
| `frontend/src/api/client.ts` | Add `parseJwtPayload` helper; expose HTTP status on thrown errors |
| `frontend/src/stores/authStore.ts` | Use `parseJwtPayload`; read `role_type` from response body; waterfall only on 401 |

---

## Task 1 — Fix empty member.ID in Register (Finding #1)

**Files:**
- Modify: `autocard/backend/handlers/member_handler.go:55`

GORM does not issue `RETURNING id` for a `string` primary key with `gorm:"default:gen_random_uuid()"`. After `memberRepo.Create(member)` the `member.ID` field stays `""`. Every downstream call in the same function (`ClaimPendingInvites`, `orgRepo.Create`, `GenerateToken`) receives an empty string. The fix is one line: set the ID before calling Create, matching the pattern already used in `auth_handler.go` GoogleLogin.

- [ ] **Step 1: Add ID generation before Create**

In `autocard/backend/handlers/member_handler.go`, change the member struct literal in `Register` from:

```go
member := &models.Member{
    Email:         req.Email,
    PasswordHash:  string(hash),
    Name:          req.Name,
    EmailVerified: true,
    Provider:      "email",
    CreatedAt:     time.Now(),
    UpdatedAt:     time.Now(),
}
```

to:

```go
member := &models.Member{
    ID:            uuid.New().String(),
    Email:         req.Email,
    PasswordHash:  string(hash),
    Name:          req.Name,
    EmailVerified: true,
    Provider:      "email",
    CreatedAt:     time.Now(),
    UpdatedAt:     time.Now(),
}
```

(`uuid` is already imported — `github.com/google/uuid` is in the import block.)

- [ ] **Step 2: Verify it compiles**

```bash
cd autocard/backend && go build ./...
```

Expected: no output (clean build).

- [ ] **Step 3: Commit**

```bash
git add autocard/backend/handlers/member_handler.go
git commit -m "fix: set member.ID before Create in Register to avoid empty JWT subject"
```

---

## Task 2 — Fix Google OAuth lockout + 409 error masking (Findings #2 and #10)

**Files:**
- Modify: `autocard/backend/handlers/member_handler.go:113` (Login)
- Modify: `autocard/backend/handlers/member_handler.go:63` (Register)

**Finding #2:** Members registered via Google OAuth have `PasswordHash: ""`. `bcrypt.CompareHashAndPassword([]byte(""), ...)` always returns `bcrypt.ErrHashTooShort`, causing a permanent 401. Fix: reject OAuth members at the start of Login with a clear error.

**Finding #10:** `memberRepo.Create` failures (network timeouts, FK violations, any DB error) all return HTTP 409 "email already exists". Fix: pre-check for existing email before creating, so 409 is only returned for known duplicates; unexpected DB errors return 500.

- [ ] **Step 1: Add provider guard in Login**

In `member_handler.go`, in the `Login` function, add the provider check immediately after the `FindByEmail` lookup succeeds:

```go
member, err := h.memberRepo.FindByEmail(req.Email)
if err != nil {
    http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
    return
}

// OAuth members have no password — they must use their provider's login flow
if member.Provider != "email" {
    http.Error(w, `{"error":"this account uses Google sign-in, please use the Google login button"}`, http.StatusUnauthorized)
    return
}

if err := bcrypt.CompareHashAndPassword([]byte(member.PasswordHash), []byte(req.Password)); err != nil {
    http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
    return
}
```

- [ ] **Step 2: Fix 409 masking in Register**

Replace the Create block in `Register`:

```go
// Before:
if err := h.memberRepo.Create(member); err != nil {
    http.Error(w, `{"error":"email already exists"}`, http.StatusConflict)
    return
}
```

with a pre-existence check:

```go
existing, _ := h.memberRepo.FindByEmail(member.Email)
if existing != nil {
    http.Error(w, `{"error":"email already exists"}`, http.StatusConflict)
    return
}

if err := h.memberRepo.Create(member); err != nil {
    http.Error(w, `{"error":"failed to create account"}`, http.StatusInternalServerError)
    return
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd autocard/backend && go build ./...
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add autocard/backend/handlers/member_handler.go
git commit -m "fix: guard OAuth members from email login; distinguish DB errors from duplicate-email in Register"
```

---

## Task 3 — Add GetPrincipalID helper and fix dual-key context pollution (Finding #7)

**Files:**
- Modify: `autocard/backend/middleware/auth.go`
- Modify: `autocard/backend/handlers/organization_handler.go`
- Modify: `autocard/backend/handlers/drawing_handler.go`

Auth middleware currently sets **both** `UserIDKey` and `MemberIDKey` to the same UUID for member tokens. This means any handler that reads only `UserIDKey` (all 9 sites in `drawing_handler.go`, 2 in `auth_handler.go`) silently receives a member UUID and queries the wrong table. The fix has two parts:

1. Stop dual-setting `UserIDKey` for members — member tokens now only set `MemberIDKey`.
2. Add a `GetPrincipalID(ctx) (string, bool)` helper that checks `MemberIDKey` then `UserIDKey` — callers use this instead of reading context keys directly.

After removing the dual-set, bare `UserIDKey` assertions in `drawing_handler.go` would panic (nil type assertion). Those are updated to use `GetPrincipalID`. The `auth_handler.go` `Me` and `UpdatePreferences` handlers are user-only routes — they should explicitly reject member tokens.

- [ ] **Step 1: Remove dual UserIDKey from auth middleware + add helper**

In `autocard/backend/middleware/auth.go`, replace:

```go
roleType, _ := claims["role_type"].(string)
ctx := r.Context()
if roleType == "member" {
    ctx = context.WithValue(ctx, MemberIDKey, userID)
    ctx = context.WithValue(ctx, UserIDKey, userID)
} else {
    ctx = context.WithValue(ctx, UserIDKey, userID)
}
```

with:

```go
roleType, _ := claims["role_type"].(string)
ctx := r.Context()
if roleType == "member" {
    ctx = context.WithValue(ctx, MemberIDKey, userID)
} else {
    ctx = context.WithValue(ctx, UserIDKey, userID)
}
```

Then add this helper function at the bottom of `auth.go` (before the closing brace of the file):

```go
// GetPrincipalID returns the caller's ID and whether they are a member (true) or a user (false).
// Always use this instead of reading UserIDKey or MemberIDKey directly when the handler
// should serve both users and members.
func GetPrincipalID(ctx context.Context) (id string, isMember bool, ok bool) {
    if v := ctx.Value(MemberIDKey); v != nil {
        return v.(string), true, true
    }
    if v := ctx.Value(UserIDKey); v != nil {
        return v.(string), false, true
    }
    return "", false, false
}
```

Make sure `context` is already imported in the file (it is).

- [ ] **Step 2: Replace copy-pasted blocks in organization_handler.go**

In `autocard/backend/handlers/organization_handler.go`, replace every occurrence of the copy-pasted dual-key block with the helper. There are three:

**In `Create` (~line 29):**
```go
// REMOVE this block:
var userID string
isMember := false
if mID := r.Context().Value(middleware.MemberIDKey); mID != nil {
    userID = mID.(string)
    isMember = true
} else if uID := r.Context().Value(middleware.UserIDKey); uID != nil {
    userID = uID.(string)
} else {
    http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
    return
}

// REPLACE with:
userID, isMember, ok := middleware.GetPrincipalID(r.Context())
if !ok {
    http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
    return
}
```

**In `List` (~line 72) — note: no `isMember` needed here:**
```go
// REMOVE:
var userID string
if mID := r.Context().Value(middleware.MemberIDKey); mID != nil {
    userID = mID.(string)
} else if uID := r.Context().Value(middleware.UserIDKey); uID != nil {
    userID = uID.(string)
} else {
    http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
    return
}

// REPLACE with:
userID, _, ok := middleware.GetPrincipalID(r.Context())
if !ok {
    http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
    return
}
```

**In `Invite` (~line 111):**
```go
// REMOVE:
var userID string
if mID := r.Context().Value(middleware.MemberIDKey); mID != nil {
    userID = mID.(string)
} else if uID := r.Context().Value(middleware.UserIDKey); uID != nil {
    userID = uID.(string)
} else {
    http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
    return
}

// REPLACE with:
userID, _, ok := middleware.GetPrincipalID(r.Context())
if !ok {
    http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
    return
}
```

- [ ] **Step 3: Update drawing_handler.go to use GetPrincipalID**

In `autocard/backend/handlers/drawing_handler.go`, replace every bare `UserIDKey` extraction. There are 9 occurrences, all with the same pattern: `userID := r.Context().Value(middleware.UserIDKey).(string)`.

Replace every one with:

```go
userID, _, ok := middleware.GetPrincipalID(r.Context())
if !ok {
    http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
    return
}
```

The lines to update are (read the file to confirm exact line numbers before editing): `List`, `Create`, `Get`, `Update`, `Delete`, `Rename`, `UploadAvatar`, `GetVersions`/`GetVersion`, `GetComments`/`CreateComment`, `Share`/`GetPermissions`/`RemovePermission` handlers.

- [ ] **Step 4: Protect auth_handler Me and UpdatePreferences from member tokens**

In `autocard/backend/handlers/auth_handler.go`, the `Me` and `UpdatePreferences` handlers are user-only. Add an explicit member rejection at the top of each:

**Me (~line 191):**
```go
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
    // Members must use GET /api/members/me instead
    if r.Context().Value(middleware.MemberIDKey) != nil {
        http.Error(w, `{"error":"members must use /api/members/me"}`, http.StatusForbidden)
        return
    }
    userID := r.Context().Value(middleware.UserIDKey).(string)
    // ... rest unchanged
```

**UpdatePreferences (~line 204):**
```go
func (h *AuthHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
    if r.Context().Value(middleware.MemberIDKey) != nil {
        http.Error(w, `{"error":"members do not have preferences"}`, http.StatusForbidden)
        return
    }
    userID := r.Context().Value(middleware.UserIDKey).(string)
    // ... rest unchanged
```

- [ ] **Step 5: Verify compilation**

```bash
cd autocard/backend && go build ./...
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add autocard/backend/middleware/auth.go \
        autocard/backend/handlers/organization_handler.go \
        autocard/backend/handlers/drawing_handler.go \
        autocard/backend/handlers/auth_handler.go
git commit -m "fix: remove dual UserIDKey for members; add GetPrincipalID helper; protect user-only routes"
```

---

## Task 4 — Mount /api/members/ through auth middleware (Finding #3)

**Files:**
- Modify: `autocard/backend/main.go:160`

The `protected` sub-mux has `GET /api/members/me` and `PUT /api/members/me` registered but the outer mux never mounts `authMiddleware(protected)` for the `/api/members/` prefix. Both routes return 404.

- [ ] **Step 1: Add the mount**

In `autocard/backend/main.go`, in the block of `mux.Handle(...)` calls (~line 160), add two lines after the existing `/api/auth/` mounts:

```go
mux.Handle("/api/auth/me", authMiddleware(protected))
mux.Handle("/api/auth/preferences", authMiddleware(protected))
mux.Handle("/api/members/me", authMiddleware(protected))       // ← add
mux.Handle("/api/members/me/", authMiddleware(protected))      // ← add (trailing slash for PUT)
```

Note: Go's `net/http` ServeMux distinguishes exact paths from prefix paths. Since both routes are exact (`GET /api/members/me`, `PUT /api/members/me`), two exact mounts are sufficient. A single `/api/members/me` mount handles both methods.

- [ ] **Step 2: Verify compilation**

```bash
cd autocard/backend && go build ./...
```

Expected: clean build.

- [ ] **Step 3: Manual verify**

Start the backend, then in a separate terminal:
```bash
# Should return 401 (not 404) — auth middleware is now in the path
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/members/me
```
Expected output: `401`

- [ ] **Step 4: Commit**

```bash
git add autocard/backend/main.go
git commit -m "fix: mount /api/members/me through authMiddleware so GET and PUT are reachable"
```

---

## Task 5 — Restore unique constraint on (org_id, user_id) + add CHECK constraint (Finding #4)

**Files:**
- Modify: `autocard/backend/migrations/006_members_table.sql`
- Modify: `autocard/backend/migrations/migrate_all.sql`

The migration dropped `UNIQUE(organization_id, user_id)` and replaced it with `UNIQUE(organization_id, member_id)`. PostgreSQL NULL uniqueness means the new constraint is ineffective for user-lane rows (member_id = NULL). `ON CONFLICT DO NOTHING` in `ClaimPendingInvites` silently stops deduplicating user memberships.

Additionally, there is no CHECK constraint ensuring exactly one of `user_id`/`member_id` is non-NULL, allowing orphan rows (both NULL) and ambiguous rows (both non-NULL).

- [ ] **Step 1: Update 006_members_table.sql**

In `autocard/backend/migrations/006_members_table.sql`, find the unique constraint section and replace:

```sql
-- Step 3: Add new unique constraint on organization_id and member_id
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS org_member_unique;
ALTER TABLE organization_members ADD CONSTRAINT org_member_unique UNIQUE (organization_id, member_id);
```

with:

```sql
-- Step 3: Restore unique constraint for user-lane + add new one for member-lane
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS org_member_unique;
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS org_user_unique;
-- Partial unique index: one user per org (ignores rows where user_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS org_user_unique
    ON organization_members (organization_id, user_id)
    WHERE user_id IS NOT NULL;
-- Partial unique index: one member per org (ignores rows where member_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS org_member_unique
    ON organization_members (organization_id, member_id)
    WHERE member_id IS NOT NULL;
-- Ensure each row has exactly one identity (prevents orphan and ambiguous rows)
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS org_member_identity_check;
ALTER TABLE organization_members ADD CONSTRAINT org_member_identity_check
    CHECK (
        (user_id IS NOT NULL AND member_id IS NULL) OR
        (user_id IS NULL AND member_id IS NOT NULL)
    );
```

Why partial unique indexes instead of a plain `UNIQUE` constraint: a plain `UNIQUE(org_id, member_id)` treats NULL as not-equal (so `(org1, NULL)` can appear many times). A partial index with `WHERE member_id IS NOT NULL` ignores NULL rows entirely, giving correct uniqueness for non-NULL values only.

- [ ] **Step 2: Mirror the same change in migrate_all.sql**

In `autocard/backend/migrations/migrate_all.sql`, find the same section (added in migration 006) and apply the identical replacement as in Step 1.

- [ ] **Step 3: Commit**

```bash
git add autocard/backend/migrations/006_members_table.sql \
        autocard/backend/migrations/migrate_all.sql
git commit -m "fix: restore partial unique index on (org_id, user_id); add mutual-exclusivity CHECK constraint"
```

---

## Task 6 — Fix Base64URL JWT decode + role_type in responses + login waterfall (Findings #5, #6, #8, #9)

**Files:**
- Modify: `autocard/frontend/src/api/client.ts`
- Modify: `autocard/frontend/src/stores/authStore.ts`
- Modify: `autocard/backend/handlers/auth_handler.go` (GoogleLogin member response)
- Modify: `autocard/backend/handlers/member_handler.go` (Register + Login responses)

**Root cause chain:**
- JWT uses Base64URL encoding (no padding, `-` and `_` chars). `atob()` requires standard Base64 with `=` padding. Any JWT whose payload length mod 4 ≠ 0 throws `InvalidCharacterError`.
- This affects `googleLogin` (crashes before storing user) and `fetchMe` (broad catch logs user out on every page load).
- The JWT is decoded client-side only to read `role_type`. The cleaner fix: include `role_type` in every auth response body — then no JWT decoding is needed in the frontend.

**Plan:** (a) Add `role_type` to all auth responses on the backend. (b) Add a safe `parseJwtPayload` fallback for legacy tokens (kept but no longer the primary path). (c) Fix the login waterfall to only retry on 401.

- [ ] **Step 1: Add role_type to backend auth responses**

In `autocard/backend/handlers/auth_handler.go`, update the GoogleLogin member-path response:

```go
// BEFORE:
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]interface{}{
    "token": jwtToken,
    "user":  member,
})

// AFTER:
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]interface{}{
    "token":     jwtToken,
    "user":      member,
    "role_type": "member",
})
```

Also update the GoogleLogin **user-path** response to include `role_type: "user"`:

```go
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]interface{}{
    "token":     jwtToken,
    "user":      user,
    "role_type": "user",
})
```

In `autocard/backend/handlers/member_handler.go`, update `Register` response:

```go
// BEFORE:
json.NewEncoder(w).Encode(models.MemberAuthResponse{
    Token:  jwtToken,
    Member: *member,
})

// AFTER: switch to a map so we can add role_type without changing the model
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]interface{}{
    "token":     jwtToken,
    "member":    member,
    "role_type": "member",
})
```

Update `Login` response similarly:

```go
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]interface{}{
    "token":     jwtToken,
    "member":    member,
    "role_type": "member",
})
```

- [ ] **Step 2: Add parseJwtPayload helper to client.ts**

In `autocard/frontend/src/api/client.ts`, add this helper at the top (after the API_BASE line):

```typescript
// Safely decode a JWT payload. JWT uses Base64URL (no padding, uses - and _).
// atob() requires standard Base64, so we normalise before decoding.
export function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}
```

Also update `apiRequest` to expose the HTTP status on thrown errors so the login waterfall can distinguish credential errors from server errors:

```typescript
export async function apiRequest(endpoint: string, options: Record<string, any> = {}): Promise<any> {
  const token: string | null = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res: Response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data: any = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || "Request failed") as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  return data;
}
```

- [ ] **Step 3: Update authStore.ts**

Replace the entire `authStore.ts` with these updated functions (import `parseJwtPayload` first):

**Update the import:**
```typescript
import { auth, members, parseJwtPayload } from "../api/client";
```

**Update `register`** (reads `data.member` and `data.role_type` from response body):
```typescript
register: async (email: string, password: string, name: string, org?: string) => {
  set({ loading: true, error: null });
  try {
    const data = await members.register({ email, password, name, org });
    localStorage.setItem("token", data.token);
    set({ user: { ...data.member, role_type: data.role_type ?? "member" }, token: data.token, loading: false });
    return data;
  } catch (err: any) {
    set({ error: err.message, loading: false });
    throw err;
  }
},
```

**Update `login`** (waterfall only on 401 — credential error — not on 5xx/network):
```typescript
login: async (email: string, password: string) => {
  set({ loading: true, error: null });
  try {
    const data = await auth.login({ email, password });
    localStorage.setItem("token", data.token);
    set({ user: { ...data.user, role_type: data.role_type ?? "user" }, token: data.token, loading: false });
    return data;
  } catch (err: any) {
    // Only fall through to member login for credential errors (401/404),
    // not for server errors or network failures.
    if (err.status !== 401 && err.status !== 404) {
      set({ error: err.message, loading: false });
      throw err;
    }
    try {
      const data = await members.login({ email, password });
      localStorage.setItem("token", data.token);
      set({ user: { ...data.member, role_type: data.role_type ?? "member" }, token: data.token, loading: false });
      return data;
    } catch (memberErr: any) {
      set({ error: memberErr.message || "Invalid email or password", loading: false });
      throw memberErr;
    }
  }
},
```

**Update `googleLogin`** (read `role_type` from response body, fall back to JWT decode):
```typescript
googleLogin: async (body: any) => {
  set({ loading: true, error: null });
  try {
    const data = await auth.googleLogin(body);
    localStorage.setItem("token", data.token);
    // Prefer role_type from response body; fall back to JWT payload for older tokens
    const roleType = data.role_type ?? parseJwtPayload(data.token)?.role_type ?? "user";
    set({ user: { ...data.user, role_type: roleType }, token: data.token, loading: false });
    return data;
  } catch (err: any) {
    set({ error: err.message, loading: false });
    throw err;
  }
},
```

**Update `fetchMe`** (read `role_type` from Zustand state first; use `parseJwtPayload` as fallback instead of bare `atob`):
```typescript
fetchMe: async () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;

    // Prefer role_type from existing Zustand state; fall back to JWT payload
    const existingRole = (useAuthStore.getState() as any).user?.role_type;
    const payload = existingRole ? { role_type: existingRole } : parseJwtPayload(token);
    const roleType = payload?.role_type;

    let user;
    if (roleType === "member") {
      user = await members.me();
      user = { ...user, role_type: "member" };
    } else {
      user = await auth.me();
      user = { ...user, role_type: "user" };
    }

    set({ user });
    return user;
  } catch {
```

Note: `useAuthStore.getState()` inside the store action requires referencing the store itself. Since Zustand stores can self-reference via the `get` parameter, update the `create` call signature so `get` is available:

```typescript
export const useAuthStore = create<AuthStore>((set: any, get: any) => ({
```

Then use `get().user?.role_type` instead of `useAuthStore.getState()`:

```typescript
const existingRole = get().user?.role_type;
```

- [ ] **Step 4: TypeScript check**

```bash
cd autocard/frontend && npx tsc --noEmit
```

Expected: no errors (the pre-existing error in `StoreOrderPage.tsx:493` can be ignored).

- [ ] **Step 5: Go compilation check**

```bash
cd autocard/backend && go build ./...
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add autocard/backend/handlers/auth_handler.go \
        autocard/backend/handlers/member_handler.go \
        autocard/frontend/src/api/client.ts \
        autocard/frontend/src/stores/authStore.ts
git commit -m "fix: add role_type to all auth responses; add parseJwtPayload helper; fix Base64URL decode and login waterfall"
```

---

## Self-Review Checklist

- [x] **Finding #1** (member.ID = "") — Task 1, Step 1
- [x] **Finding #2** (OAuth lockout) — Task 2, Step 1
- [x] **Finding #3** (/api/members/me 404) — Task 4
- [x] **Finding #4** (unique constraint) — Task 5
- [x] **Finding #5** (atob googleLogin) — Task 6, Step 3 (googleLogin uses parseJwtPayload, response body first)
- [x] **Finding #6** (atob fetchMe) — Task 6, Step 3 (fetchMe uses parseJwtPayload)
- [x] **Finding #7** (dual UserIDKey) — Task 3
- [x] **Finding #8** (GoogleLogin "user" key contains Member) — Task 6, Step 1 (role_type added; key stays "user" but is now explicit)
- [x] **Finding #9** (login waterfall enumeration) — Task 6, Step 3 (only waterfall on 401)
- [x] **Finding #10** (409 masking) — Task 2, Step 2

**Dependency order:** Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6. Task 3 (auth middleware) must come before Task 4 (mount) since the middleware now behaves differently for member tokens. All backend tasks should be done before Task 6 (frontend) so the response body changes are in place when the frontend is updated.
