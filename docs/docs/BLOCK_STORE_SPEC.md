# Organization Block Store & Furniture Import System

> **Spec Version**: 1.1
> **Last Updated**: 2026-05-31
> **Status**: Planning
> **Authors**: ARCH-TECH-CAD Team

---

## Overview

Enable a **3-tier block library** system for ARCH-TECH-CAD:

| Tier | Who | Storage | Network |
|---|---|---|---|
| 🏠 **Default Library** | Everyone | `src/data/blockLibrary.ts` (built-in) | Always offline |
| 👤 **My Imports** | Any logged-in user | PostgreSQL `/api/my-blocks` | JWT required |
| 🏢 **Org Library** | Organization members | PostgreSQL `/api/organizations/{id}/blocks` | JWT + Org role required |

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────┐
│                BLOCK LIBRARY TIERS                     │
├────────────────┬───────────────┬──────────────────────┤
│  🏠 Default   │ 👤 My Imports │  🏢 Org Library      │
│ src/data/      │ /api/my-blocks│ /api/org/{id}/blocks │
│ blockLibrary   │ user-scoped   │ org-scoped           │
│ Read-only      │ JWT required  │ JWT + org role req.  │
└────────────────┴───────────────┴──────────────────────┘
```

---

## What Already Exists

| Feature | Status | File / Notes |
|---|---|---|
| Go backend (PostgreSQL + local file uploads `./uploads/`) | ✅ Done | `main.go:168` — serves `./uploads/` at `/uploads/` |
| Organization + OrganizationMember model (owner/editor/viewer roles) | ✅ Done | `models/organization.go` — `Role string` comment: `// 'owner', 'editor', 'viewer'` |
| `orgOwnerMiddleware` + `orgViewerMiddleware` | ✅ Done | Variables in `main.go:99-100` created via `middleware.RequireOrgRole(userRepo, orgRepo, "owner"/"viewer")` |
| `src/data/blockLibrary.ts` — **443 blocks** across 11 categories | ✅ Done | living(46), bedroom(29), dining(20), kitchen(43), bathroom(33), office(29), structural(64), electrical(33), landscape(38), elevation(67), annotation(41) |
| `defineBlock(name, elements, insertionPoint)` in drawingStore | ✅ Done | `drawingStore.ts:790` — generates ID `block-${Date.now()}`, returns **void** |
| `insertBlock(blockId, x, y, scale?, rotation?)` in drawingStore | ✅ Done | `drawingStore.ts:801` — `scale` defaults to 1, `rotation` defaults to 0 |
| `deleteBlockDef(blockId)` in drawingStore | ✅ Done | `drawingStore.ts:838` |
| DXF parser | ✅ Done | `src/canvas/dxf.ts` — exports `elementsToDxf()` and parse functions for LINE, LWPOLYLINE, CIRCLE, TEXT, DIMENSION |
| Block/library API routes | 🔴 Not implemented | No `/api/my-blocks` or `/api/organizations/{id}/blocks` routes exist |
| Frontend block store service | 🔴 Not implemented | Only `src/services/aiDrawingService.ts` exists |
| `src/utils/` directory | 🔴 Does not exist | Must be created |

---

## Key Types (Existing)

```typescript
// src/types.ts:141
export interface BlockDef {
  id: string;
  name: string;
  elements: DrawingElement[];
  insertionPoint: Point;
}

// drawingStore blockDefs shape
blockDefs: Record<string, BlockDef>
```

`defineBlock` auto-generates `id = "block-${Date.now()}"` and returns **void**. This means the generated ID is not exposed to callers. For org blocks (which use a server-assigned UUID), callers must **directly inject into the store** rather than calling `defineBlock`. See Data Flow section.

---

## Implementation Components (10 total)

---

### Backend (Go)

#### 1. `models/block_store.go` — NEW

```go
package models

import (
    "encoding/json"
    "time"
)

type OrgBlock struct {
    ID             string          `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
    OrganizationID *string         `json:"organization_id" gorm:"type:uuid;index"` // null = user-private
    UserID         string          `json:"user_id" gorm:"type:uuid;not null;index"`
    Name           string          `json:"name" gorm:"not null"`
    Description    string          `json:"description" gorm:"type:text;default:''"`
    Category       string          `json:"category" gorm:"type:varchar(100);not null;default:'custom'"`
    Tags           json.RawMessage `json:"tags" gorm:"type:jsonb;default:'[]'"`       // JSONB array, not text
    BlockDef       json.RawMessage `json:"block_def" gorm:"type:jsonb;not null"`       // serialized BlockDef
    PreviewSVG     string          `json:"preview_svg" gorm:"type:text;default:''"`
    ThumbnailURL   string          `json:"thumbnail_url" gorm:"type:text;default:''"`
    IsPublished    bool            `json:"is_published" gorm:"default:false"`
    DownloadCount  int             `json:"download_count" gorm:"default:0"`
    CreatedAt      time.Time       `json:"created_at"`
    UpdatedAt      time.Time       `json:"updated_at"`
}

// Note: CreatedBy display name is resolved via JOIN with users table on UserID.
// No denormalized CreatedBy field — avoids stale display names on profile updates.

type CreateOrgBlockRequest struct {
    Name        string          `json:"name"`
    Description string          `json:"description"`
    Category    string          `json:"category"`
    Tags        json.RawMessage `json:"tags"`     // e.g. ["sofa","living","modern"]
    BlockDef    json.RawMessage `json:"block_def"` // full BlockDef JSON
    PreviewSVG  string          `json:"preview_svg"`
}

type UpdateOrgBlockRequest struct {
    Name        *string          `json:"name"`
    Description *string          `json:"description"`
    Category    *string          `json:"category"`
    Tags        *json.RawMessage `json:"tags"`
    PreviewSVG  *string          `json:"preview_svg"`  // can update preview
    IsPublished *bool            `json:"is_published"`
}
```

**Why `json.RawMessage` not `string` for JSONB fields:** GORM maps a Go `string` field with `type:jsonb` tag by passing the string value directly to the DB. This works but loses type safety and makes double-encoding errors easy. `json.RawMessage` is `[]byte` and serializes/deserializes cleanly with GORM's JSONB support and `encoding/json`.

**Migration SQL** (run at startup via `db.Exec()` in `main.go`):

```sql
CREATE TABLE IF NOT EXISTS org_blocks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    category        VARCHAR(100) NOT NULL DEFAULT 'custom',
    tags            JSONB NOT NULL DEFAULT '[]',
    block_def       JSONB NOT NULL,
    preview_svg     TEXT NOT NULL DEFAULT '',
    thumbnail_url   TEXT NOT NULL DEFAULT '',
    is_published    BOOLEAN NOT NULL DEFAULT FALSE,
    download_count  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_org_blocks_org      ON org_blocks(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_blocks_user     ON org_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_org_blocks_category ON org_blocks(category);
-- Full-text search index on name + category
CREATE INDEX IF NOT EXISTS idx_org_blocks_fts
    ON org_blocks USING gin(to_tsvector('english', name || ' ' || category));
```

---

#### 2. `repository/block_store_repo.go` — NEW

```go
type BlockStoreRepo struct{ db *gorm.DB }

// User-private blocks (organization_id IS NULL)
func (r *BlockStoreRepo) CreateUserBlock(block *models.OrgBlock) error
func (r *BlockStoreRepo) ListUserBlocks(userID string) ([]models.OrgBlock, error)
func (r *BlockStoreRepo) DeleteUserBlock(id, userID string) error

// Org-scoped blocks
func (r *BlockStoreRepo) CreateOrgBlock(block *models.OrgBlock) error
func (r *BlockStoreRepo) ListOrgBlocks(orgID string, publishedOnly bool) ([]models.OrgBlock, error)
func (r *BlockStoreRepo) GetOrgBlock(id, orgID string) (*models.OrgBlock, error)
func (r *BlockStoreRepo) UpdateOrgBlock(id, orgID string, req *models.UpdateOrgBlockRequest) error
func (r *BlockStoreRepo) DeleteOrgBlock(id, orgID string) error
func (r *BlockStoreRepo) SetPublished(id, orgID string, pub bool) error
func (r *BlockStoreRepo) IncrementDownloadCount(id string) error
// Search uses PostgreSQL full-text: to_tsvector('english', name || ' ' || category) @@ plainto_tsquery($1)
func (r *BlockStoreRepo) SearchOrgBlocks(orgID, query string, publishedOnly bool) ([]models.OrgBlock, error)
```

---

#### 3. `handlers/block_store_handler.go` — NEW

REST API handler wiring `BlockStoreRepo` to HTTP routes.

---

#### 4. `main.go` — MODIFY

Wire new handler, run migration SQL, and register routes.

**New API routes:**

```
# User-private blocks (JWT required)
GET    /api/my-blocks               → list user's blocks
POST   /api/my-blocks               → create/import user block
DELETE /api/my-blocks/{id}          → delete user's own block

# Org block store
# IMPORTANT: Register /blocks/search BEFORE /blocks/{blockId} to avoid
# Go mux capturing "search" as the {blockId} wildcard value.
GET    /api/organizations/{id}/blocks                          → list blocks (query param: ?q=sofa for search, ?published=true)
POST   /api/organizations/{id}/blocks                          → upload block to org store (editor+)
GET    /api/organizations/{id}/blocks/{blockId}                → get block details + increment download_count
PUT    /api/organizations/{id}/blocks/{blockId}                → update block metadata (editor+, own blocks)
DELETE /api/organizations/{id}/blocks/{blockId}                → delete block (creator or org owner)
PUT    /api/organizations/{id}/blocks/{blockId}/publish        → publish / unpublish (org owner only)
POST   /api/organizations/{id}/blocks/{blockId}/thumbnail      → upload PNG thumbnail (multipart, max 2MB)
```

**Unified list + search:** `GET /api/organizations/{id}/blocks?q=sofa` handles both listing and full-text search through the same endpoint. Avoids the route ambiguity between `/blocks/search` and `/blocks/{blockId}` in Go 1.22 `net/http.ServeMux`.

**Role-based access control:**

| Action | Required Role |
|---|---|
| Browse published blocks | viewer (any org member) |
| Browse unpublished (drafts) | editor or owner |
| Upload / edit own blocks | editor |
| Publish / unpublish | owner |
| Delete any block | owner |
| Delete own block | creator (user_id match) |

---

### Frontend (React + TypeScript)

#### 5. `src/services/blockStoreService.ts` — NEW

```typescript
// Mirror of models/block_store.go — block_def is pre-parsed from JSON
export interface OrgBlockRecord {
  id: string;
  organization_id: string | null;
  user_id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];        // deserialized from JSONB array
  block_def: BlockDef;   // deserialized from JSONB — matches src/types.ts BlockDef
  preview_svg: string;
  thumbnail_url: string;
  is_published: boolean;
  download_count: number;
  created_at: string;
  // Note: display name resolved server-side; include created_by_name in response if needed
}

export interface CreateBlockPayload {
  name: string;
  description: string;
  category: string;
  tags: string[];
  block_def: BlockDef;
  preview_svg?: string;
}

// My blocks
export async function listMyBlocks(token: string): Promise<OrgBlockRecord[]>
export async function createMyBlock(token: string, payload: CreateBlockPayload): Promise<OrgBlockRecord>
export async function deleteMyBlock(token: string, id: string): Promise<void>

// Org store
export async function listOrgBlocks(token: string, orgId: string, q?: string): Promise<OrgBlockRecord[]>
export async function createOrgBlock(token: string, orgId: string, payload: CreateBlockPayload): Promise<OrgBlockRecord>
export async function getOrgBlock(token: string, orgId: string, blockId: string): Promise<OrgBlockRecord>
export async function updateOrgBlock(token: string, orgId: string, blockId: string, payload: Partial<UpdateBlockPayload>): Promise<OrgBlockRecord>
export async function publishOrgBlock(token: string, orgId: string, blockId: string, publish: boolean): Promise<void>
export async function deleteOrgBlock(token: string, orgId: string, blockId: string): Promise<void>
export async function uploadBlockThumbnail(token: string, orgId: string, blockId: string, file: File): Promise<string>

export interface UpdateBlockPayload {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  preview_svg?: string;
  is_published?: boolean;
}
```

---

#### 6. `src/components/ui/BlockPreview.tsx` — NEW

SVG mini-preview for any `BlockDef`. Used in sidebar tiles, store cards, and drag ghost.

```tsx
// src/types.ts BlockDef:
//   { id, name, elements: DrawingElement[], insertionPoint: Point }

interface BlockPreviewProps {
  def: BlockDef;
  size?: number;    // rendered px size (default 60)
  padding?: number; // canvas padding in model units (default 8)
  isDark?: boolean;
}

// Renders sub-elements:
//   rectangle → <rect>  |  circle → <circle>  |  line → <line>
//   arc → <path>         |  text → <text>       |  polyline → <polyline>
// Auto-computes viewBox from bounding box of all sub-elements + padding
export function BlockPreview({ def, size = 60, padding = 8, isDark = false }: BlockPreviewProps)
```

---

#### 7. `src/pages/BlockStorePage.tsx` — NEW

Full-page Organization Block Store.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  🏢 Org Block Store              [+ Upload] [← Back] │
├──────────┬──────────────────────────────────────────┤
│ 📦 Store │  [🔍 Search...]   [Category ▼]            │
│ 👤 Mine  │                                           │
│ ⬆ Drafts│  ┌──────┐  ┌──────┐  ┌──────┐            │
│ (editor+)│  │ SVG  │  │ SVG  │  │ SVG  │            │
│          │  │Sofa  │  │ Bed  │  │Chair │            │
│          │  │42↓   │  │by Alex│ │draft │            │
│          │  │[Use] │  │[Use] │  │[Use] │            │
│          │  └──────┘  └──────┘  └──────┘            │
└──────────┴──────────────────────────────────────────┘
```

**Upload Block dialog fields:**
- Name, Category (dropdown), Tags (multi-tag input), Description
- Import file: `.json` (ARCH-TECH-CAD drawing) / `.svg` / `.dxf` → auto-parsed to `BlockDef`
- Live `BlockPreview` SVG rendered from parsed `BlockDef`
- Optional thumbnail PNG upload (sent after block creation via thumbnail endpoint)
- [Save to My Imports] / [Publish to Org Store] buttons

---

#### 8. `src/utils/blockImporter.ts` — NEW

**Note:** `src/utils/` directory does not currently exist and must be created.

Parse external files into `BlockDef`:

| Format | Source | Notes |
|---|---|---|
| `.json` | ARCH-TECH-CAD drawing export | Extract `elements` array + compute `insertionPoint` from centroid |
| `.svg` | SVG symbol/icon file | SVG primitives → `DrawingElement[]` |
| `.dxf` | AutoCAD exchange format | Use existing parser at `src/canvas/dxf.ts` |

```typescript
import { parseDxf } from "../canvas/dxf";  // existing parser

export function importBlockFromJson(json: string): BlockDef | null
export function importBlockFromSVG(svgString: string): BlockDef | null
export function importBlockFromDXF(dxfString: string): BlockDef | null
```

All three return `null` on parse failure (not throw) so the UI can show a clear error message.

---

#### 9. `src/components/CadSidebar.tsx` — MODIFY

Add 3-source switcher at top of Blocks section:

```
[ 🏠 Default ] [ 👤 My Imports ] [ 🏢 Org Store ]
```

- **Default** — existing built-in catalog (443 blocks, 11 categories). Redesign tile grid to use `BlockPreview` SVG instead of emoji-only tiles.
- **My Imports** — fetches `/api/my-blocks`, renders `BlockPreview` SVG tile grid.
- **Org Store** — fetches `/api/organizations/{id}/blocks`, renders published blocks. Tab hidden if user has no org.

**Inserting a block from any tab (critical — see data flow):**

`defineBlock()` in drawingStore auto-generates `"block-${Date.now()}"` as the ID and returns **void**, so the generated ID is not retrievable by callers. For org and user-imported blocks, bypass `defineBlock` and inject directly:

```typescript
// Do NOT call defineBlock() for org/imported blocks — ID not recoverable
const store = useDrawingStore.getState();
if (!store.blockDefs[orgBlock.id]) {
  useDrawingStore.setState((s) => ({
    blockDefs: {
      ...s.blockDefs,
      [orgBlock.id]: {
        id: orgBlock.id,
        name: orgBlock.name,
        elements: orgBlock.block_def.elements,
        insertionPoint: orgBlock.block_def.insertionPoint ?? { x: 0, y: 0 },
      },
    },
  }));
}
store.insertBlock(orgBlock.id, dropX, dropY, scale, rotation);
```

Add **[Open Full Store →]** button at the bottom of the Blocks section.

---

#### 10. `src/App.tsx` — MODIFY

Add `#/block-store` route:

```typescript
// In parseHash():
if (cleanHash.startsWith("/block-store")) {
  return { page: "block-store", orgId: params.get("org") };
}

// In AppContent render:
case "block-store":
  return <BlockStorePage onNavigate={handleNavigate} orgId={routeState?.orgId} />;
```

---

## Data Flows

### Using an Org Block in the Editor

```
1. Open CadSidebar → "Org Store" tab
2. GET /api/organizations/{id}/blocks → fetch published blocks (cached in component state)
3. User drags tile → SVG ghost footprint (BlockPreview) follows cursor on canvas
4. Drop at (x, y) →
   a. Inject block def into store.blockDefs[orgBlock.id] if not already present
   b. store.insertBlock(orgBlock.id, x, y)
5. CadEngine.drawBlock() renders in 2D canvas
6. ThreeViewer renders in 3D
7. Background (fire and forget): GET /api/organizations/{id}/blocks/{blockId}
      → server increments download_count
```

### Uploading a Custom Block

```
1. User selects elements in editor → right-click "Save as Block"
   OR clicks "+ Upload Block" in BlockStorePage
2. File import (JSON/SVG/DXF) → blockImporter.ts → BlockDef
   OR: selected elements + chosen insertionPoint → BlockDef
3. BlockPreview auto-renders live SVG preview
4. User fills: name, category, tags[], description
5. POST /api/my-blocks → saved as user-private (is_published: false)
   Response: OrgBlockRecord with server-assigned UUID
6. Optional: POST /api/my-blocks/{id}/thumbnail (if user provided PNG)
7. From Block Store page: click "Publish to Org"
   → PUT /api/organizations/{id}/blocks/{blockId}/publish  body: { is_published: true }
8. Block now visible in Org Store for all org members
```

---

## Verification Checklist

### Automated
```bash
# Backend
cd autocard/backend && go build ./...
cd autocard/backend && go test ./...

# Frontend
cd autocard/frontend && npx tsc --noEmit
```

### Manual
- [ ] Built-in Default blocks (all 443) work offline with no regression
- [ ] User uploads JSON file → appears in "My Imports" tab in sidebar
- [ ] User uploads SVG file → parsed to BlockDef, preview renders correctly
- [ ] User uploads DXF file → parsed via `src/canvas/dxf.ts`, elements correct
- [ ] Drag from "My Imports" → block placed at drop position with correct scale/rotation
- [ ] Org editor publishes a block → appears in "Org Store" for all org members
- [ ] Org viewer → sees published blocks only; draft tab hidden
- [ ] Non-org user → "Org Store" tab not rendered
- [ ] Member uses org block → `download_count` increments in DB
- [ ] Search `?q=sofa` → filtered tile grid in real-time (debounced)
- [ ] BlockPreview renders SVG correctly for representative blocks from all 11 categories
- [ ] 3D viewer renders placed org blocks correctly (block elements extruded)
- [ ] Thumbnail upload → PNG shown in tile; falls back to SVG preview if absent
- [ ] `store.blockDefs[orgBlock.id]` not duplicated on repeated insertions of same block

---

## Design Decisions

### Why direct store injection instead of `defineBlock()` for org blocks?
`defineBlock()` generates `id = "block-${Date.now()}"` and returns void. This makes the generated ID unreachable to the caller. Org blocks carry a stable server-assigned UUID; bypassing `defineBlock` and writing directly to `blockDefs` preserves that UUID, prevents duplicate registrations of the same block, and keeps block identity consistent across saves and collaboration sync.

### Why unified list+search (`?q=`) instead of a separate `/search` route?
With Go 1.22 `net/http.ServeMux`, registering `GET /api/organizations/{id}/blocks/search` before `GET /api/organizations/{id}/blocks/{blockId}` would work (more-specific patterns win), but it is fragile — registration order matters and the separation offers no benefit. A single list endpoint with an optional `?q=` query parameter is simpler, testable, and idiomatic REST.

### Why `json.RawMessage` for `BlockDef` and `Tags` in Go?
A `string` field tagged `gorm:"type:jsonb"` stores the raw string bytes into the JSONB column, which works but bypasses PostgreSQL's JSONB validation and risks double-encoding. `json.RawMessage` (`[]byte`) serializes/deserializes as native JSON, allowing PostgreSQL to validate and index the JSONB, and avoids escaped-string encoding issues when returning values in API responses.

### Why `tags` as JSONB instead of TEXT?
Using PostgreSQL JSONB for tags enables `@>` containment queries (e.g. `tags @> '["sofa"]'`) without a full-text index, supports future tag-filtered listing without `LIKE` scans, and avoids manual JSON string parsing in Go.

### Why local filesystem for thumbnails?
The backend already serves `./uploads/` for org logos and drawing avatars. Reusing the same pattern avoids new infrastructure dependencies. Cloud storage (S3/GCS) is a drop-in replacement: change the file-writing code in `block_store_handler.go` and update the URL prefix — no schema or API changes required.

### Why auto-generate SVG previews?
Eliminates manual thumbnail creation for text-only blocks. `BlockPreview` reuses the same shape-rendering logic as the 2D canvas, ensuring visual consistency. A PNG thumbnail upload is always optional and overrides the SVG preview in the tile.

---

## Future Enhancements

- [ ] Public marketplace — blocks shared across all organizations
- [ ] Block versioning — track definition changes over time with version history
- [ ] Rating / review system for org members
- [ ] Cloud storage (S3/GCS) for thumbnails and block assets at scale
- [ ] GLTF/GLB 3D model attachment — link photorealistic 3D mesh to a block for ThreeViewer
- [ ] Block collections / packs — bundle related blocks and install as a set
- [ ] "Fork" a block from org store into personal My Imports for local modification
- [ ] Tag-based filtering alongside full-text search
