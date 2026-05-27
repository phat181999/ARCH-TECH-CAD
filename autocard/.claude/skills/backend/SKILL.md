---
name: backend
description: Work on the AutoCard Go backend — HTTP handlers, PostgreSQL schema, JWT auth, WebSocket collaboration, AI generation, and CAD document validation. Use when adding endpoints, fixing bugs, running migrations, or reviewing changes in autocard/backend/.
allowed-tools: Bash(go *) Bash(psql *) Bash(find *) Bash(grep *) Read Write Edit Glob
---

# AutoCard Backend Skill

## Stack at a glance

| What | Technology |
|---|---|
| Language | Go 1.22 |
| HTTP | Standard library `net/http` — no Gin/Echo/Chi |
| ORM | GORM 1.31 + `gorm.io/driver/postgres` |
| Database | PostgreSQL 15+ |
| Auth | JWT (`golang-jwt/jwt/v5`) + bcrypt (`golang.org/x/crypto`) |
| WebSocket | `gorilla/websocket v1.5.3` |
| IDs | `google/uuid` |
| Env | `joho/godotenv` |

## 1. Start the backend

```bash
cd autocard/backend
cp .env.example .env        # if .env doesn't exist — fill in DB creds
go run main.go              # starts on http://localhost:8080
```

Or to run with live reload (if air is installed):
```bash
air
```

## 2. Source tree — what lives where

```
backend/
├── main.go                  Entry point: DB connect, route registration, server start
├── run_migration.go         Run SQL migrations in order
├── go.mod / go.sum          Module + dependency lock
├── .env                     Environment variables (never commit secrets)
├── main                     Compiled binary (gitignored)
│
├── config/
│   └── config.go            Config struct, DSN builder, Load() reads .env
│
├── models/
│   ├── user.go              User, RegisterRequest, LoginRequest, AuthResponse,
│   │                        VerifyEmailRequest
│   └── drawing.go           Drawing, VersionHistory, Comment, Permission,
│                            ObjectLock, SaveDrawingRequest
│
├── repository/
│   ├── user_repo.go         CRUD: users, email verification tokens
│   └── drawing_repo.go      CRUD: drawings, version_history, comments, permissions
│
├── handlers/
│   ├── auth_handler.go      /api/auth/* — register, login, verify-email, me
│   ├── drawing_handler.go   /api/drawings/* — CRUD + versions + comments + share
│   ├── ai_handler.go        /api/ai/generate — streaming AI generation
│   └── websocket_handler.go /ws/collaborate — real-time cursors + presence
│
├── middleware/
│   ├── auth.go              JWT verification → sets userID in request context
│   ├── cors.go              CORS headers (allow localhost:51530 in dev)
│   └── logger.go            Structured JSON request logging
│
├── cad/
│   └── schema/
│       ├── document.go      CAD document schema (Go mirror of frontend contracts)
│       ├── nodes.go         Node type definitions
│       ├── layers.go        Layer schema
│       ├── patches.go       CRDT patch operations for collaboration
│       └── validation.go    Server-side document validation logic
│
└── migrations/
    ├── 001_init.sql          users + drawings tables
    └── 002_add_collaboration.sql  version_history + comments + permissions tables
```

## 3. Route map

All routes registered in `main.go`. Protected routes run through `middleware.Auth(cfg.JWTSecret)`.

| Method | Path | Auth | Handler | Purpose |
|--------|------|------|---------|---------|
| POST | `/api/auth/register` | ❌ | `authHandler.Register` | Create user account |
| POST | `/api/auth/login` | ❌ | `authHandler.Login` | Get JWT token |
| POST | `/api/auth/verify-email` | ❌ | `authHandler.VerifyEmail` | Confirm email token |
| GET | `/api/auth/me` | ✅ | `authHandler.Me` | Current user info |
| GET | `/api/drawings` | ✅ | `drawingHandler.List` | User's drawings |
| POST | `/api/drawings` | ✅ | `drawingHandler.Create` | New drawing |
| GET | `/api/drawings/{id}` | ✅ | `drawingHandler.Get` | Single drawing |
| PUT | `/api/drawings/{id}` | ✅ | `drawingHandler.Update` | Save drawing data |
| DELETE | `/api/drawings/{id}` | ✅ | `drawingHandler.Delete` | Delete drawing |
| GET | `/api/drawings/{id}/versions` | ✅ | `drawingHandler.GetVersions` | Version list |
| GET | `/api/drawings/{id}/versions/{v}` | ✅ | `drawingHandler.GetVersion` | Restore version |
| GET | `/api/drawings/{id}/comments` | ✅ | `drawingHandler.GetComments` | Thread comments |
| POST | `/api/drawings/{id}/comments` | ✅ | `drawingHandler.AddComment` | Add comment |
| POST | `/api/drawings/{id}/share` | ✅ | `drawingHandler.Share` | Invite user |
| GET | `/api/drawings/{id}/permissions` | ✅ | `drawingHandler.GetPermissions` | List access |
| DELETE | `/api/drawings/{id}/permissions/{uid}` | ✅ | `drawingHandler.RevokePermission` | Revoke access |
| POST | `/api/ai/generate` | ✅ | `aiHandler.Generate` | AI drawing generation (streaming) |
| GET | `/ws/collaborate` | ❌ | `wsHandler.Handle` | WebSocket for real-time |

## 4. Database schema

### Tables

**`users`**
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
email           VARCHAR(255) UNIQUE NOT NULL
password_hash   VARCHAR(255) NOT NULL
name            VARCHAR(255)
email_verified  BOOLEAN DEFAULT FALSE
verification_token VARCHAR(255)
created_at, updated_at TIMESTAMPTZ
```

**`drawings`**
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID REFERENCES users(id) ON DELETE CASCADE
name        VARCHAR(255) NOT NULL
data        JSONB                    -- serialized DrawingState
version     INTEGER DEFAULT 1
created_at, updated_at TIMESTAMPTZ
```

**`version_history`**
```sql
id          UUID PRIMARY KEY
drawing_id  UUID REFERENCES drawings(id) ON DELETE CASCADE
version     INTEGER NOT NULL
data        JSONB
created_by  UUID REFERENCES users(id)
created_at  TIMESTAMPTZ
```

**`comments`** (threaded)
```sql
id          UUID PRIMARY KEY
drawing_id  UUID REFERENCES drawings(id) ON DELETE CASCADE
user_id     UUID REFERENCES users(id)
x, y        FLOAT              -- canvas position
message     TEXT NOT NULL
parent_id   UUID REFERENCES comments(id)   -- null = top-level
created_at, updated_at TIMESTAMPTZ
```

**`permissions`**
```sql
id          UUID PRIMARY KEY
drawing_id  UUID REFERENCES drawings(id) ON DELETE CASCADE
user_id     UUID REFERENCES users(id)
email       VARCHAR(255)
role        VARCHAR(50)        -- "viewer" | "editor" | "owner"
created_at, updated_at TIMESTAMPTZ
```

## 5. Adding a new endpoint

1. **Add the model** (if new data shape) in `models/`.
2. **Add the repo method** in `repository/drawing_repo.go` or `user_repo.go`.
3. **Add the handler** in the appropriate file in `handlers/`. Handler pattern:

```go
func (h *DrawingHandler) MyNewEndpoint(w http.ResponseWriter, r *http.Request) {
    // Get authenticated user ID from context (set by middleware.Auth)
    userID := r.Context().Value("userID").(string)

    // Parse request body
    var req models.MyRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid body", http.StatusBadRequest)
        return
    }

    // Call repository
    result, err := h.repo.DoSomething(userID, req)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    // Write JSON response
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}
```

4. **Register the route** in `main.go`:
```go
mux.Handle("POST /api/drawings/{id}/my-endpoint",
    middleware.Auth(cfg.JWTSecret)(http.HandlerFunc(drawingHandler.MyNewEndpoint)))
```

## 6. Running migrations

Migrations are plain SQL files in `backend/migrations/`. They run in filename order.

```bash
# Run via the migration runner
cd autocard/backend
go run run_migration.go

# Or connect directly with psql
psql $DATABASE_URL -f migrations/003_my_change.sql
```

**Naming convention:** `NNN_description.sql` where `NNN` is the next sequential number (001, 002, 003…).

**Migration rules:**
- Always additive if possible (add columns with `DEFAULT`, add tables).
- Dropping columns or changing types requires backfilling or a multi-step migration.
- JSONB column `drawings.data` stores the full frontend state — schema changes there are handled by the frontend (no SQL migration needed for CAD data fields).

## 7. Authentication

### Flow
1. `POST /api/auth/login` → validates credentials, returns `{ token: "...", user: {...} }`
2. Frontend stores token in `localStorage`.
3. All protected requests: `Authorization: Bearer <token>` header.
4. `middleware.Auth` verifies signature with `cfg.JWTSecret`, injects `userID` string into request context.

### Reading the user in a handler
```go
userID := r.Context().Value("userID").(string)
```

### JWT claims structure
```go
type Claims struct {
    UserID string `json:"user_id"`
    jwt.RegisteredClaims
}
```

## 8. AI generation (streaming)

`handlers/ai_handler.go` handles `POST /api/ai/generate`. It:

1. Reads the prompt from the request body.
2. Calls OpenAI or Gemini (configured via `.env` — `OPENAI_API_KEY` or `GEMINI_API_KEY`).
3. Streams back the response as `text/event-stream` (SSE).
4. The response ultimately resolves to a JSON `ArchitecturalPlan` matching `cad/schema/document.go`.

To change the AI prompt template or output schema, edit `ai_handler.go`. The Go schema in `cad/schema/` must stay in sync with the TypeScript contracts in `frontend/src/cad/contracts/`.

## 9. WebSocket collaboration

`handlers/websocket_handler.go` handles `/ws/collaborate`. Each client sends cursor position and receives broadcasts of all other cursors.

Message format (JSON):
```json
{ "type": "cursor", "userId": "...", "x": 120.5, "y": 340.2 }
{ "type": "join",   "userId": "...", "username": "..." }
{ "type": "leave",  "userId": "..." }
```

CRDT patch operations for collaborative edits are defined in `cad/schema/patches.go` — not yet fully wired to the WebSocket handler.

## 10. Environment variables

File: `autocard/backend/.env`

```env
DATABASE_URL=postgres://user:pass@localhost:5432/autocard
JWT_SECRET=your-secret-key-min-32-chars
PORT=8080

# AI providers (use at least one)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# Email (for verification)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=...
```

## 11. Config struct

`config/config.go` → `type Config struct`. All env vars are loaded by `config.Load()` called in `main.go`. Pass `cfg` or individual fields to handlers/middleware — never use `os.Getenv()` directly in handlers.

## 12. Things to avoid

- **Do not use a web framework** (no Gin, Echo, Chi). Stick with `net/http` + the existing mux.
- **Do not put business logic in `main.go`** — it is wiring only.
- **Do not bypass the repository layer** — handlers call repo methods, not raw GORM.
- **Do not store secrets in code** — always `.env` via `config.Load()`.
- **Do not write raw SQL in handlers** — use GORM or put SQL in a repo method.
- **Do not change `drawings.data` JSONB schema via SQL migration** — that's frontend-driven.
- **Do not break the CORS setup** — the frontend dev server is on port 51530; `middleware.cors.go` must allow it.
- **Always check `userID` authorization** before returning drawing data — a user must own the drawing or have a permission row.

## 13. Common debugging

```bash
# Check DB connection
psql $DATABASE_URL -c "SELECT version();"

# List tables
psql $DATABASE_URL -c "\dt"

# Check a drawing's stored JSON
psql $DATABASE_URL -c "SELECT id, name, version FROM drawings LIMIT 5;"

# Tail logs (if running with structured logging)
go run main.go 2>&1 | jq .

# Check JWT (decode without verification)
echo "<token>" | cut -d. -f2 | base64 -d | jq .
```
