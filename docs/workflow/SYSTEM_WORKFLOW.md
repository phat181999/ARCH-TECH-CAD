# ARCH-TECH-CAD — System Workflow & Architecture

> **Version**: 1.0  
> **Last Updated**: 2026-05-31  
> **Stack**: Go + PostgreSQL + Redis (Backend) · React + TypeScript + Vite (Frontend) · Three.js (3D)

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Authentication Flow](#2-authentication-flow)
3. [Application Navigation Flow](#3-application-navigation-flow)
4. [Drawing Lifecycle](#4-drawing-lifecycle)
5. [2D Canvas Rendering Pipeline](#5-2d-canvas-rendering-pipeline)
6. [3D Viewer Pipeline](#6-3d-viewer-pipeline)
7. [AI Drawing Generation Flow](#7-ai-drawing-generation-flow)
8. [Real-Time Collaboration Flow](#8-real-time-collaboration-flow)
9. [Block Library & Furniture System](#9-block-library--furniture-system)
10. [Organization Management Flow](#10-organization-management-flow)
11. [RAG Knowledge Base Flow](#11-rag-knowledge-base-flow)
12. [State Management Architecture](#12-state-management-architecture)
13. [Data Models](#13-data-models)

---

## 1. System Architecture Overview

```mermaid
graph TB
    subgraph CLIENT["🖥 Client (Browser)"]
        UI["React + TypeScript\nVite SPA"]
        CANVAS["2D CAD Canvas\nCadEngine.ts\nHTML5 Canvas API"]
        THREE["3D Viewer\nThreeViewer.tsx\nThree.js / React Three Fiber"]
        STORE["Zustand Store\ndrawingStore.ts"]
        UI --> CANVAS
        UI --> THREE
        UI <--> STORE
        CANVAS <--> STORE
        THREE <--> STORE
    end

    subgraph BACKEND["⚙️ Backend (Go)"]
        API["REST API\nnet/http\nPort 8080"]
        WS["WebSocket\n/ws/collaborate"]
        AUTH["JWT Middleware\nBcrypt Auth"]
        AI_H["AI Handler\nOpenAI / Gemini"]
        ORG_H["Org Handler\nRole Guards"]
        DRAW_H["Drawing Handler\nCRUD + Versions"]
        RAG_H["RAG Handler\nPgVector Search"]
        API --> AUTH
        AUTH --> AI_H
        AUTH --> ORG_H
        AUTH --> DRAW_H
        AUTH --> RAG_H
    end

    subgraph STORAGE["🗄 Storage"]
        PG["PostgreSQL\ngorm.io/postgres\nDrawings · Users · Orgs\nVersions · Comments · RAG"]
        REDIS["Redis\ngo-redis/v9\nSession Cache\nOrg Membership Cache"]
        FILES["Local Filesystem\n./uploads/\nAvatars · Logos"]
        PGVEC["pgvector extension\nVector Embeddings\n1536 dimensions"]
    end

    subgraph AI["🤖 External AI Services"]
        OPENAI["OpenAI GPT-4\nSSE Streaming\nDrawing Generation"]
        GEMINI["Google Gemini 2.0 Flash\nSSE Streaming\nFallback / Primary"]
    end

    CLIENT <-->|"REST + SSE\nHTTP/HTTPS"| API
    CLIENT <-->|"WebSocket\nJSON messages"| WS
    API <--> PG
    API <--> REDIS
    API --> FILES
    PG --- PGVEC
    AI_H --> OPENAI
    AI_H --> GEMINI
```

---

## 2. Authentication Flow

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant FE as 🖥 Frontend
    participant BE as ⚙️ Backend
    participant DB as 🗄 PostgreSQL
    participant EMAIL as 📧 SMTP

    rect rgb(240, 248, 255)
        note over U,EMAIL: Registration Flow
        U->>FE: Fill register form\n(name, email, password)
        FE->>BE: POST /api/auth/register
        BE->>BE: Validate (min 6 char password,\nunique email check)
        BE->>BE: bcrypt.GenerateFromPassword()
        BE->>BE: Generate 32-byte hex verification token
        BE->>DB: INSERT user\n(email_verified=false)
        BE->>EMAIL: Send verification email\n(token link)
        BE-->>FE: 201 Created
        FE->>FE: Navigate to login\n"Check your email"
    end

    rect rgb(255, 248, 240)
        note over U,EMAIL: Email Verification
        U->>FE: Click email link
        FE->>BE: POST /api/auth/verify-email\n{token}
        BE->>DB: UPDATE users SET email_verified=true\nWHERE verification_token=token
        BE-->>FE: 200 OK + JWT token
        FE->>FE: Store JWT in localStorage\nNavigate to dashboard
    end

    rect rgb(240, 255, 240)
        note over U,EMAIL: Login Flow
        U->>FE: Email + Password
        FE->>BE: POST /api/auth/login
        BE->>DB: SELECT user WHERE email=?
        BE->>BE: bcrypt.CompareHashAndPassword()
        BE->>BE: jwt.NewWithClaims()\n(expires in 24h)
        BE-->>FE: 200 OK\n{token, user}
        FE->>FE: localStorage.setItem("token")\nNavigate to dashboard
    end

    rect rgb(248, 240, 255)
        note over U,EMAIL: Google OAuth Flow
        U->>FE: Click "Sign in with Google"
        FE->>BE: POST /api/auth/google\n{google_token}
        BE->>BE: Verify Google ID token
        BE->>DB: UPSERT user by email\nemail_verified=true
        BE-->>FE: 200 OK + JWT token
        FE->>FE: Store JWT + navigate
    end

    rect rgb(255, 240, 240)
        note over U,EMAIL: Protected Request Pattern
        FE->>BE: Any protected endpoint\nAuthorization: Bearer {jwt}
        BE->>BE: middleware.Auth()\nParse + verify JWT
        BE->>BE: Inject userID into context
        BE-->>FE: 200 OK / 401 Unauthorized
    end
```

---

## 3. Application Navigation Flow

```mermaid
stateDiagram-v2
    [*] --> LoginPage : Not authenticated\n(no JWT in localStorage)

    LoginPage --> RegisterPage : "Create account"
    LoginPage --> ForgotPasswordPage : "Forgot password"
    RegisterPage --> LoginPage : "Back to login"

    LoginPage --> Dashboard : Login success\n(JWT stored)
    RegisterPage --> LoginPage : Email sent for verification
    
    Dashboard --> CanvasEditor : Open / create drawing
    Dashboard --> TeamPage : "Team" nav link
    Dashboard --> SettingsPage : "Settings" nav link
    Dashboard --> StoreOrderPage : "Store Orders" nav link
    Dashboard --> AdminConsolePage : Only if system_role = "system_admin"

    CanvasEditor --> Dashboard : "Back" button\nor logo click

    TeamPage --> Dashboard : "Back"
    SettingsPage --> Dashboard : "Back"
    StoreOrderPage --> Dashboard : "Back"
    AdminConsolePage --> Dashboard : "Back"

    note right of CanvasEditor
        Hash routing:
        #/editor?id={drawingId}
        Refresh-safe (no server redirect)
    end note

    note right of Dashboard
        Default page when authenticated.
        Also: email verify flow at
        #/verify-email?token=...
    end note
```

**Hash Routing Table:**

| Route (URL Hash) | Page Component | Auth Required |
|---|---|---|
| `#/login` | `LoginPage` | No |
| `#/register` | `RegisterPage` | No |
| `#/forgot-password` | `ForgotPasswordPage` | No |
| `#/verify-email?token=` | Inline handler | No |
| `#/dashboard` | `DrawingDashboard` | ✅ Yes |
| `#/editor?id={uuid}` | `CanvasEditor` | ✅ Yes |
| `#/settings` | `SettingsPage` | ✅ Yes |
| `#/team` | `TeamPage` | ✅ Yes |
| `#/store-orders` | `StoreOrderPage` | ✅ Yes |
| `#/admin` | `AdminConsolePage` | ✅ system_admin only |

---

## 4. Drawing Lifecycle

```mermaid
flowchart TD
    A([🏠 Dashboard]) -->|"Click 'New Drawing'"| B[POST /api/drawings\nname: 'Untitled']
    A -->|"Click existing card"| C[Load Drawing\nGET /api/drawings/id]

    B --> D[Navigate to\n#/editor?id=uuid]
    C --> D

    D --> E{{"⚙️ CanvasEditor\nMounted"}}
    E --> F[loadDrawing\nfetch elements from JSONB]
    F --> G[Hydrate Zustand store\nelements, layers, blockDefs]
    G --> H[CadEngine renders\n2D canvas]
    G --> I[ThreeViewer renders\n3D scene]

    H --> J{{"🖊 User draws / edits"}}
    J --> K[updateElement / addElement\nin Zustand store]
    K --> L[Canvas re-renders\nvia RAF loop]
    K --> M{autoSave\ndebounced 2s}
    M -->|"PUT /api/drawings/id"| N[(PostgreSQL\ndata JSONB updated)]
    N --> O[version_history\nrecord saved]

    J --> P{{"Undo / Redo"}}
    P -->|"Ctrl+Z"| Q[Pop history stack\nrestore elements[]]
    P -->|"Ctrl+Y"| R[Advance historyIndex]

    H --> S{{"Export"}}
    S -->|"SVG"| T[Generate SVG string\nfrom elements]
    S -->|"PNG"| U[canvas.toDataURL]
    S -->|"DXF"| V[dxfExporter.ts\nDXF format string]
    S -->|"JSON"| W[JSON.stringify elements]

    style E fill:#1e40af,color:#fff
    style J fill:#065f46,color:#fff
    style S fill:#7c3aed,color:#fff
```

---

## 5. 2D Canvas Rendering Pipeline

```mermaid
flowchart LR
    subgraph INPUT["📥 Input Sources"]
        EL["elements[]\nfrom Zustand store"]
        BK["blockDefs\nRecord<id, BlockDef>"]
        PO["panOffset, zoom\nviewport state"]
        ST["currentStyle\nstroke/fill defaults"]
        GR["gridVisible\nsnapEnabled"]
    end

    subgraph ENGINE["⚙️ CadEngine.ts"]
        direction TB
        RENDER["render(ctx, elements,\nblockDefs, opts)"]
        GRID["drawGrid()\nbackground grid"]
        DISP["dispatch per type:\nline → drawLine\nrect → drawRect\ncircle → drawCircle\narc → drawArc\nblock → drawBlock\npolyline → drawPolyline\ntext → drawText\nhatch → drawHatch\ndimension → drawDimension\nleader → drawLeader\nspline → drawSpline (Catmull-Rom)\nmtext → drawMText\ndim-linear → drawDimLinear\ndim-angular → drawDimAngular\nmark → drawMark"]
        PREV["drawPreview()\nLive ghost while drawing"]
        SNAP["snap engine\nOSnap detection"]
    end

    subgraph OUTPUT["📤 Canvas Output"]
        CNV["HTML5 Canvas\n2D Context\nRequestAnimationFrame loop"]
    end

    EL --> RENDER
    BK --> RENDER
    PO --> RENDER
    ST --> RENDER
    GR --> GRID

    RENDER --> GRID
    GRID --> DISP
    DISP --> PREV
    PREV --> CNV

    SNAP --> PREV
```

**Element Type → Renderer Map:**

| Element Type | Renderer | Key Properties |
|---|---|---|
| `line` | `drawLine` | x1, y1, x2, y2, lineType (solid/dashed/dotted) |
| `rectangle` | `drawRect` | x, y, width, height, fillColor, strokeColor |
| `circle` | `drawCircle` | cx, cy, radius, fillColor |
| `arc` | `drawArc` | cx, cy, radius, startAngle, endAngle |
| `polyline` | `drawPolyline` | points[], closed |
| `spline` | `drawSpline` | points[] (Catmull-Rom bezier) |
| `text` | `drawText` | x, y, text, fontSize, fontFamily |
| `mtext` | `drawMText` | x, y, text (multiline, `\n` separated) |
| `block` | `drawBlock` | blockId, x, y, scale, rotation |
| `hatch` | `drawHatch` | points[], pattern, fillColor |
| `dimension` | `drawDimension` | x1,y1,x2,y2, offset |
| `dim-linear` | `drawDimLinear` | x1,y1,x2,y2, dimAxis (h/v) |
| `dim-angular` | `drawDimAngular` | vertex, point1, point2 |
| `leader` | `drawLeader` | points[], text |
| `mark` | `drawMark` | x, y, markNumber |
| `wall` | via `polyline` | archType="wall", wallThickness |
| `door` | via `arc`+`rect` | archType="door", swing |
| `window` | via `rect` | archType="window" |

---

## 6. 3D Viewer Pipeline

```mermaid
flowchart TD
    subgraph INPUT["📥 Input"]
        EL2["elements[]\nfrom Zustand"]
        PLAN["currentArchitecturalPlan\n(from AI generation)"]
        BK2["blockDefs"]
    end

    subgraph CLASSIFY["🔍 Classification"]
        direction TB
        C1{Has ArchitecturalPlan?}
        C1 -->|Yes| SEMANTIC["Use semantic plan:\nwalls[], rooms[],\nopenings[], footprint"]
        C1 -->|No| AUTO["classifyPlan(elements):\nshell, walls, doors,\nwindows, rooms, loose"]
    end

    subgraph RENDER3D["🎲 Three.js Scene (React Three Fiber)"]
        direction TB
        FLOOR["Floor Slab\nboxGeometry (grey)"]
        WALLS["DynamicWall\nboxGeometry × N\nOpacity fades near camera"]
        ROOMS["RoomMesh\nFloor tile + semi-transparent volume"]
        DOORS["DoorMesh\nTranslucent box"]
        WINS["WindowMesh\nFlatElementMesh"]
        BLOCKS3D["FlatElementMesh → BlockElementMesh\nrect → boxGeometry\ncircle → cylinderGeometry\nHeight by blockType"]
        LOOSE["FlatElementMesh\nAll other elements as flat slabs"]
    end

    subgraph CAMERA["📷 Camera Controls"]
        ORBIT["OrbitControls\n(pan, rotate, zoom)"]
        VIEWS["ViewAngle presets:\nperspective | top | front\nback | left | right"]
        AUTOFRAME["AutoFrame()\nAuto-position camera\nto fit all elements"]
    end

    EL2 --> CLASSIFY
    PLAN --> CLASSIFY
    BK2 --> CLASSIFY

    CLASSIFY --> FLOOR
    CLASSIFY --> WALLS
    CLASSIFY --> ROOMS
    CLASSIFY --> DOORS
    CLASSIFY --> WINS
    CLASSIFY --> BLOCKS3D
    CLASSIFY --> LOOSE

    FLOOR --> RENDER3D
    ORBIT --> CAMERA
    VIEWS --> CAMERA
    AUTOFRAME --> CAMERA
```

**Block Height in 3D:**

| Block Type | 3D Height (canvas units) |
|---|---|
| `door` | 20 |
| `window` | 10 |
| `car` | 18 |
| All other blocks | 8 (flat) |
| Walls | `wallHeight` (configurable, default ~25) |

---

## 7. AI Drawing Generation Flow

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant FE as 🖥 Frontend
    participant BE as ⚙️ AI Handler
    participant GEMINI as 🤖 Gemini 2.0 Flash
    participant OPENAI as 🤖 OpenAI GPT-4

    U->>FE: Type prompt in AI panel\n"Generate a 10x12m house\nwith 2 bedrooms and a kitchen"
    FE->>FE: aiDrawingService.generateDrawing(prompt)
    FE->>BE: POST /api/ai/generate\n{prompt, stream: true}

    BE->>BE: parsePlanRequest(prompt)\nExtract: width, height,\nrooms, style tags
    BE->>BE: generateHousePlan(req)\nCreate structured JSON plan\n(walls, doors, windows, rooms)

    alt Gemini available
        BE->>GEMINI: POST streamGenerateContent\nSSE endpoint + prompt
        GEMINI-->>BE: data: {candidates:[...]}\nStreaming JSON chunks
    else OpenAI available
        BE->>OPENAI: POST /chat/completions\n{stream: true}
        OPENAI-->>BE: data: {choices:[{delta:{content:...}}]}\nSSE chunks
    end

    BE->>BE: stripMarkdown()\nParse JSON array from response
    BE->>BE: assignElementIDs(elements)\nAdd UUIDs + layerIds
    BE->>BE: addSiteHatch()\nAdd site boundary hatch

    loop SSE Streaming
        BE-->>FE: data: {...element JSON...}\n(one element per event)
        FE->>FE: Parse JSON element
        FE->>FE: addElement(element)\nZustand store update
        FE->>FE: Canvas re-renders\n(real-time drawing appears)
    end

    BE-->>FE: data: [DONE]
    FE->>FE: Set currentArchitecturalPlan\nfor 3D structured rendering
    FE->>FE: autoSave() → PUT /api/drawings/id
```

---

## 8. Real-Time Collaboration Flow

```mermaid
sequenceDiagram
    participant U1 as 👤 User A (Editor)
    participant U2 as 👤 User B (Viewer)
    participant FE1 as 🖥 Client A
    participant FE2 as 🖥 Client B
    participant WS as 🔌 WebSocket\n/ws/collaborate
    participant DB as 🗄 PostgreSQL

    note over WS: Session management:\nMap[drawingID] → DrawingSession{clients[]}

    FE1->>WS: Connect\n?drawing={id}&user={userId}&name={name}
    WS->>WS: getOrCreateSession(drawingID)
    WS->>FE1: {type:"users_update", users:[...]}

    FE2->>WS: Connect (same drawingID)
    WS->>FE2: {type:"users_update", users:[A, B]}
    WS->>FE1: {type:"join", userId:B, name:"User B"}

    rect rgb(240, 248, 255)
        note over U1,DB: Element Edit
        U1->>FE1: Draw/modify element
        FE1->>WS: {type:"element_update",\nelementId, data:{...}}
        WS->>WS: broadcast(msg, senderID)\nskip sender
        WS->>FE2: {type:"element_update",\nelementId, data}
        FE2->>FE2: updateElement()\nin local Zustand store
        FE1->>DB: PUT /api/drawings/id\n(debounced 2s auto-save)
    end

    rect rgb(255, 248, 240)
        note over U1,DB: Object Locking
        U1->>FE1: Start editing element X
        FE1->>WS: {type:"lock",\nelementId: "X"}
        WS->>FE2: {type:"lock",\nelementId: "X", lockedBy: A}
        FE2->>FE2: Show locked indicator\nPrevent editing X
        U1->>FE1: Finish editing
        FE1->>WS: {type:"unlock",\nelementId: "X"}
        WS->>FE2: {type:"unlock", elementId: "X"}
    end

    rect rgb(240, 255, 240)
        note over U1,DB: Disconnect
        FE1->>WS: Connection closed
        WS->>WS: Remove client from session
        WS->>FE2: {type:"leave", userId: A}
        WS->>WS: broadcast unlock all\nlocks held by A
    end
```

**WebSocket Message Types:**

| Type | Direction | Payload |
|---|---|---|
| `join` | Server → Clients | `{userId, name}` |
| `leave` | Server → Clients | `{userId}` |
| `users_update` | Server → Client | `{users: [{id, name}]}` |
| `element_update` | Client ↔ Server | `{elementId, data}` |
| `element_add` | Client ↔ Server | `{element}` |
| `element_delete` | Client ↔ Server | `{elementId}` |
| `lock` | Client ↔ Server | `{elementId}` |
| `unlock` | Client ↔ Server | `{elementId}` |

---

## 9. Block Library & Furniture System

```mermaid
flowchart TD
    subgraph SOURCES["📚 Block Sources (3 tiers)"]
        DEF["🏠 Default Library\nblockLibrary.ts\n~40 blocks · 11 categories\nAlways offline"]
        USR["👤 My Imports\n/api/my-blocks\nUser-uploaded custom blocks\nRequires auth"]
        ORG["🏢 Org Store\n/api/organizations/id/blocks\nOrg-published blocks\nRequires auth + org"]
    end

    subgraph SIDEBAR["🗂 CadSidebar Blocks Panel"]
        TABS["[ 🏠 Default ] [ 👤 Mine ] [ 🏢 Org ]"]
        TILES["Block tile grid\n(SVG preview + label)\nDraggable tiles"]
        SEARCH["Search / filter\nby name or category"]
    end

    subgraph PLACE["📌 Block Placement"]
        DRAG["Drag tile → canvas\n(ghost footprint overlay)"]
        CLICK["Click tile →\ninsert at canvas center"]
        DEFINE["defineBlock(blockDef)\nRegister in Zustand blockDefs"]
        INSERT["insertBlock(blockId, x, y)\nAdd {type:'block'} element"]
    end

    subgraph RENDER["🎨 Block Rendering"]
        R2D["CadEngine.drawBlock()\n2D canvas\nctx.translate+scale+rotate\nRender sub-elements"]
        R3D["ThreeViewer BlockElementMesh\n3D Three.js\nrect→box, circle→cylinder\nHeight by blockType"]
    end

    subgraph BLOCKDEF["📦 BlockDef Structure"]
        BD["BlockDef {\n  id: string\n  name: string\n  insertionPoint: {x,y}\n  elements: DrawingElement[]\n    (line|rect|circle|arc|\n     polyline|text)\n}"]
    end

    DEF --> TABS
    USR --> TABS
    ORG --> TABS

    TABS --> TILES
    TILES --> SEARCH
    TILES --> DRAG
    TILES --> CLICK

    DRAG --> DEFINE
    CLICK --> DEFINE
    DEFINE --> INSERT
    INSERT --> R2D
    INSERT --> R3D
    BLOCKDEF -.-> BD
```

**Block Categories:**

| Category | Blocks | Icon |
|---|---|---|
| Living Room | sofa, sofa-l, armchair, coffee-table, tv-unit, bookshelf, rug, floor-lamp | 🛋 |
| Bedroom | bed, bed-single, wardrobe, dresser, nightstand | 🛏 |
| Dining | dining-table-rect, table (round), dining-chair | 🍽 |
| Kitchen | sink, stove, refrigerator, kitchen-counter, oven, kitchen-sink-double | 🍳 |
| Bathroom | toilet, bath, shower, bidet, sink, sink-double | 🚿 |
| Office | desk, desk-l, chair, conference-table, printer | 🖥 |
| Structural | column-sq, column-rnd, stair, elevator, ramp, door, window | ⬛ |
| Electrical | outlet, switch, ceiling-light, ac-unit, smoke-detector | ⚡ |
| Landscape | plant, tree, car, parking, swimming-pool | 🌳 |
| Elevation | windows, arched-window, column elevations | 🏛 |
| Annotation | bubbles, arrows, north arrow, room tags | 📍 |

---

## 10. Organization Management Flow

```mermaid
flowchart TD
    subgraph CREATION["🏢 Org Creation"]
        C1["User registers / logs in"]
        C2["POST /api/organizations\n{name}"]
        C3["User becomes 'owner'\nOrganizationMember record created"]
        C1 --> C2 --> C3
    end

    subgraph INVITE["📨 Inviting Members"]
        I1["Owner: POST /api/organizations/id/invitations\n{email, role: 'editor'|'viewer'}"]
        I2["Invitation stored\nin Redis cache"]
        I3["Invited user registers/logs in\nwith matching email"]
        I4["User added to org_members\nwith specified role"]
        I1 --> I2 --> I3 --> I4
    end

    subgraph ROLES["🔐 Role Permissions"]
        R1["viewer\n- Browse org data\n- View drawings (if shared)\n- Use org block store"]
        R2["editor\n- All viewer permissions\n- Edit shared drawings\n- Upload blocks to org store"]
        R3["owner\n- All editor permissions\n- Manage members\n- Publish/delete org blocks\n- Update org settings\n- Upload org logo"]
        R4["system_admin\n- All org permissions\n- Admin console access\n- Manage subscription packages"]
        R1 --> R2 --> R3 --> R4
    end

    subgraph SUBSCRIPTION["💳 Subscription Tiers"]
        S1["Free\n$0/mo\n5 drawings\n3 members"]
        S2["Pro Monthly\n$29/mo\n100 drawings\n15 members"]
        S3["Enterprise\n$299/yr\nUnlimited\nUnlimited"]
    end

    C3 --> INVITE
    INVITE --> ROLES
    ROLES -.-> SUBSCRIPTION
```

---

## 11. RAG Knowledge Base Flow

```mermaid
sequenceDiagram
    participant U as 👤 User / System
    participant FE as 🖥 Frontend
    participant RAG as ⚙️ RAG Handler
    participant PG as 🗄 PostgreSQL\n(pgvector)
    participant AI as 🤖 Gemini/OpenAI

    rect rgb(240, 248, 255)
        note over U,AI: Ingestion (Admin/System)
        U->>RAG: POST /api/rag/knowledge-chunks\n{title, content, tenantId}
        RAG->>AI: Generate embedding (1536-dim vector)
        RAG->>PG: INSERT knowledge_chunks\n(content, embedding, metadata)

        U->>RAG: POST /api/rag/components\n{name, category, svg, geometry}
        RAG->>AI: Generate embedding
        RAG->>PG: INSERT cad_components

        U->>RAG: POST /api/rag/building-rules\n{jurisdiction, rule_type, parameters}
        RAG->>PG: INSERT building_rules
    end

    rect rgb(240, 255, 240)
        note over U,AI: Query (Runtime)
        U->>FE: Ask AI about building codes\nor design patterns
        FE->>RAG: POST /api/rag/query\n{query, tenantId, context}
        RAG->>AI: Embed query string
        RAG->>PG: Vector similarity search\n(cosine distance < threshold)\nTop-K chunks from:\n  knowledge_chunks\n  cad_components\n  building_rules
        PG-->>RAG: Relevant context chunks
        RAG->>AI: Augmented prompt =\n  system context + retrieved chunks + query
        AI-->>RAG: Generated response
        RAG-->>FE: {answer, sources[]}
    end

    rect rgb(255, 248, 240)
        note over U,AI: Learning (Post-edit)
        FE->>RAG: POST /api/rag/projects/id/edits\n{initial_elements, final_elements, ops_log}
        RAG->>PG: INSERT user_edits\n(track AI→user corrections)
        U->>RAG: POST /api/rag/golden\n{project_id, comments}
        RAG->>PG: INSERT golden_designs\n(verified high-quality examples)
    end
```

---

## 12. State Management Architecture

```mermaid
graph TB
    subgraph STORE["📦 Zustand: drawingStore.ts (Single Store)"]
        subgraph CANVAS_STATE["Canvas State"]
            ES["elements: DrawingElement[]"]
            SEL["selectedElementIds: string[]"]
            TOOL["tool: ToolType"]
            ZOOM["zoom, panOffset"]
            STYLE["currentStyle"]
            GRID2["gridVisible, snapEnabled"]
        end

        subgraph DRAWING_STATE["Drawing State"]
            DRAWINGS["drawings: Drawing[]"]
            CURR["currentDrawing, currentDrawingId"]
            VER["currentVersion, versions[]"]
            HIST["history[][], historyIndex"]
        end

        subgraph UI_STATE["UI State"]
            LAYERS["layers[], activeLayerId"]
            BLOCKS["blockDefs: Record<id, BlockDef>"]
            COMMENTS["comments[], showComments"]
            PERMS["permissions[], showShareDialog"]
            MEAS["measurements[], measurementMode"]
        end

        subgraph ARCH_STATE["Architectural State"]
            PLAN["currentArchitecturalPlan\n(from AI generation)"]
            CONS["constraints[]"]
            UNIT["unit: m|mm|ft|in"]
        end
    end

    subgraph ACTIONS["⚡ Store Actions"]
        A1["fetchDrawings / loadDrawing\ncreateDrawing / saveDrawing"]
        A2["addElement / updateElement\ndeleteSelectedElements"]
        A3["undo / redo\n(history stack)"]
        A4["setTool / setZoom / setPanOffset"]
        A5["insertBlock / defineBlock\nexplodeBlock"]
        A6["addLayer / setActiveLayer\ntoggleLayerVisibility"]
    end

    STORE --> ACTIONS

    subgraph CONSUMERS["🎯 Store Consumers"]
        CE["CadEngine.ts\nReads elements, blockDefs\nRenders 2D"]
        TV["ThreeViewer.tsx\nReads elements, plan, blockDefs\nRenders 3D"]
        CS["CadSidebar.tsx\nReads/writes tool, layers,\nblockDefs, zoom"]
        PE["PropertyEditor.tsx\nReads/writes selectedElementIds\nupdates style/geometry"]
        AP["App.tsx\nReads drawings for routing"]
    end

    STORE --> CE
    STORE --> TV
    STORE --> CS
    STORE --> PE
    STORE --> AP
```

---

## 13. Data Models

```mermaid
erDiagram
    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar name
        boolean email_verified
        varchar verification_token
        varchar system_role
        text preferences
        timestamptz created_at
        timestamptz updated_at
    }

    drawings {
        uuid id PK
        uuid user_id FK
        varchar name
        jsonb data
        integer version
        text image_url
        timestamptz created_at
        timestamptz updated_at
    }

    version_history {
        uuid id PK
        uuid drawing_id FK
        integer version
        jsonb data
        uuid created_by FK
        timestamptz created_at
    }

    comments {
        uuid id PK
        uuid drawing_id FK
        uuid user_id FK
        varchar username
        float x
        float y
        text message
        uuid parent_id
        timestamptz created_at
    }

    permissions {
        uuid id PK
        uuid drawing_id FK
        uuid user_id FK
        varchar email
        varchar role
        timestamptz created_at
    }

    organizations {
        uuid id PK
        varchar name
        text image_org
        varchar subscription_tier
        timestamptz subscription_expires
        uuid subscription_package_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    organization_members {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        varchar role
        timestamptz created_at
        timestamptz updated_at
    }

    subscription_packages {
        uuid id PK
        varchar name UK
        varchar code UK
        decimal price
        integer duration_days
        integer max_members
        integer max_drawings
        text features
    }

    cad_components {
        uuid id PK
        uuid tenant_id
        varchar component_name
        varchar category
        text svg_representation
        jsonb geometry_data
        jsonb tags
        vector embedding
    }

    users ||--o{ drawings : "owns"
    users ||--o{ permissions : "has"
    users ||--o{ organization_members : "member of"
    users ||--o{ comments : "writes"
    drawings ||--o{ version_history : "has versions"
    drawings ||--o{ comments : "has"
    drawings ||--o{ permissions : "has"
    organizations ||--o{ organization_members : "has members"
    organizations }o--o| subscription_packages : "subscribed to"
```

---

## Appendix: Technology Versions

| Component | Technology | Version |
|---|---|---|
| Frontend Framework | React | 18.x |
| Frontend Language | TypeScript | 5.x |
| Frontend Build | Vite | 5.x |
| State Management | Zustand | 4.x |
| 3D Rendering | Three.js + React Three Fiber | Latest |
| Backend Language | Go | 1.24 |
| Backend HTTP | net/http (stdlib) | Go 1.22+ patterns |
| ORM | GORM | gorm.io/gorm |
| Database | PostgreSQL | 15+ (with pgvector) |
| Cache | Redis | 7.x |
| Auth | JWT (golang-jwt/jwt v5) | v5 |
| Realtime | Gorilla WebSocket | v1 |
| Password Hashing | bcrypt (golang.org/x/crypto) | latest |
| AI (primary) | Google Gemini 2.0 Flash | API v1beta |
| AI (fallback) | OpenAI GPT-4 | API v1 |
| Vector Search | pgvector | 0.5+ |

---

*Generated by ARCH-TECH-CAD documentation system · 2026-05-31*
