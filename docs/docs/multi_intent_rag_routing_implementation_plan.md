# Implementation Plan: Multi-Intent RAG & CAD Routing Pipeline

## Goal

Support hybrid/multi-intent queries such as:
> *"Draw a 5×15m house, calculate materials, and check if it complies with HCMC setback codes."*

Instead of forcing the LLM to pick one category, the agent classifies the prompt into **multiple** categories (each with a confidence score), fires **parallel** Qdrant lookups only for categories that clear a 0.6 confidence threshold, and merges all RAG contexts into a single unified generation call.

---

## Architecture Overview

```
User Prompt
    │
    ▼
classifyPromptMulti()          ← 1 fast LLM call, returns []CategoryResult
    │  confidence threshold 0.6
    ▼
┌──────────────────────────────────────────────────────────┐
│  Active categories (confidence ≥ 0.6)                   │
│  e.g. ["cad_drawing", "permit_and_licensing"]            │
└──────────────────────────────────────────────────────────┘
    │
    ├─ RAG collections (non-CAD categories)
    │   └─ fetchParallelRAG()   ← errgroup, 3s deadline/collection, max 3 chunks each
    │       returns merged context string
    │
    └─ Route
         ├─ cad_drawing present  → CAD LLM (RAG context injected into USER turn)
         └─ cad_drawing absent   → Conversation LLM (RAG context in system prompt)
```

---

## Files Changed

| File | Change type |
|---|---|
| `backend/handlers/ai_edit_handler.go` | Major rewrite |
| `backend/models/chat.go` | Add `Categories` field |
| `backend/migrations/008_chat_categories.sql` | New migration |
| `backend/handlers/ai_edit_handler_test.go` | New test cases |
| `docs/docs/multi_intent_rag_routing_implementation_plan.md` | This file |

---

## 1. Classifier Schema Upgrade

### Updated system prompt

The classifier now returns an array. Confidence threshold 0.6 gates whether a category is acted on.

```
classifierRouterSystemPromptMulti = `You are a prompt routing agent for an architectural CAD application.
Classify the user's query into one OR MORE of these categories (include all that apply):

1. "cad_drawing"            — drawing, editing, modifying shapes, walls, doors, windows on the canvas
2. "permit_and_licensing"   — building codes, permits, compliance, TCVN, fire safety, egress
3. "construction_materials" — materials (concrete, brick, steel, wood), pricing, specifications
4. "general_knowledge"      — greetings, explanations, questions not covered above

Respond ONLY with a JSON object:
{"categories":[{"name":"cad_drawing","confidence":0.95},{"name":"permit_and_licensing","confidence":0.80}]}

Rules:
- Only include categories with genuine relevance (confidence ≥ 0.5 from your assessment).
- "general_knowledge" should only appear if no other category applies.
- Return at least one category.`
```

### `classifyPromptMulti(prompt string) []string`

- Calls the LLM with the new system prompt.
- Parses `{"categories":[{"name":..., "confidence":...}]}`.
- Filters to entries where `confidence >= 0.6`.
- Falls back to `fallbackClassifyMulti` on any parse error.
- Returns `[]string{"general_knowledge"}` if filtered list is empty.

### `fallbackClassifyMulti(prompt string) []string`

Keyword-based, same logic as before but:
- Appends all matching categories (not early-return).
- Returns `[]string{"general_knowledge"}` if none match.

---

## 2. Parallel RAG Retrieval

### `fetchParallelRAG(ctx context.Context, categories []string, prompt string) string`

```
for each non-CAD category in categories:
    spawn goroutine (errgroup) {
        childCtx, cancel := context.WithTimeout(ctx, 3s)
        defer cancel()
        chunks = queryQdrantRAG(category, prompt, maxChunks=3)
        collect result
    }
wait for all goroutines
merge results into labeled sections:
    --- CONTEXT: PERMITS & CODES ---
    [1] Source: tcvn_4319.md ...
    --- CONTEXT: CONSTRUCTION MATERIALS ---
    [1] Source: materials_db.md ...
```

Key constraints:
- **3-second per-collection deadline** — slow Qdrant never blocks the HTTP response.
- **Max 3 chunks per collection** — prevents context window overflow; at ~400 tokens/chunk, 2 collections × 3 chunks = ~2.4k tokens overhead, safe budget.
- Uses `golang.org/x/sync/errgroup` (already in go.mod).
- A Qdrant failure logs a warning and contributes an empty section — it does **not** abort the whole request.

---

## 3. Updated `Interact` Handler Routing

### API response — backward-compatible

```go
type AiInteractResponse struct {
    Category   string   `json:"category"`            // primary (first) category — unchanged for frontend compat
    Categories []string `json:"categories,omitempty"` // full list — NEW
    Commands   []AiEditCommand `json:"commands,omitempty"`
    Summary    string   `json:"summary"`
    Error      string   `json:"error,omitempty"`
}
```

### Routing logic

```
categories = classifyPromptMulti(prompt)
primary    = categories[0]
ragContext = fetchParallelRAG(ctx, categories, prompt)  // empty string if no RAG categories

if "cad_drawing" in categories:
    userTurn = CurrentElements JSON + "\n\nUser Request: " + prompt
    if ragContext != "":
        userTurn += "\n\nRegulatory & Material Reference:\n" + ragContext
    // RAG injected into USER turn — keeps aiEditSystemPrompt clean for JSON output
    call CAD LLM → parse commands + summary

else:
    systemPrompt = pick base prompt for primary category (permit / materials / general)
    if ragContext != "":
        systemPrompt += "\n\nContext from vector database:\n" + ragContext
    call conversation LLM → summary
```

**Why RAG goes in the user turn for CAD**: `aiEditSystemPrompt` is a strict JSON-output prompt. Appending prose context to the system message risks confusing the JSON structure. The user-turn injection keeps the system prompt clean and lets the model treat regulatory info as additional constraints on the drawing.

---

## 4. DB Schema — Backward Compatible

### `ChatMessage` model additions

```go
Categories string `gorm:"type:text;column:categories" json:"categories,omitempty"` // JSON array e.g. ["cad_drawing","permit_and_licensing"]
```

- `Category` (varchar 100) is kept and still stores the **primary** (first) category.
- `Categories` (text) stores the full JSON array for future queries.
- No existing data is touched; both columns are nullable.

### Migration `008_chat_categories.sql`

```sql
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS categories TEXT;
```

---

## 5. Test Cases (Required)

| Test | What it proves |
|---|---|
| `TestClassifyPromptMultiParseValid` | Parses `{"categories":[...]}`, filters by confidence 0.6, returns correct slice |
| `TestClassifyPromptMultiFallbackOnBadJSON` | Bad LLM output falls back to keyword classifier, still returns `[]string` |
| `TestClassifyPromptMultiSingleCategory` | Single-intent query returns a one-element slice (not broken multi-path) |
| `TestFetchParallelRAGMergesLabels` | With a mock ragRepo, verifies section headers appear in merged output |
| `TestFetchParallelRAGTimeoutIsolation` | One slow collection does not block the other; slow one returns empty, fast one contributes |
| `TestFallbackClassifyMultiAllCategories` | A prompt with CAD + permit keywords returns both in the slice |

---

## 6. Verification

### Automated

```bash
cd autocard/backend && go build ./...
cd autocard/backend && go test ./handlers/... -v -run TestClassify
cd autocard/backend && go test ./handlers/... -v -run TestFetchParallel
cd autocard/backend && go test ./handlers/... -v -run TestFallback
```

### Manual

| Query | Expected outcome |
|---|---|
| "Draw a 4×12m house and check if HCMC setback codes allow it" | Canvas updated **and** response cites TCVN setback rules from Qdrant |
| "What is the price of bê tông M300?" | Materials answer only, no canvas edit, Qdrant materials context used |
| "Add a door to the south wall" | CAD-only path, no Qdrant call, JSON commands returned |
| "Hello, what can you do?" | general_knowledge path, no Qdrant, no CAD |
| "Draw walls and list materials needed for a 3×8m room" | cad_drawing + construction_materials: canvas edit + materials context in user turn |

---

## Risk & Mitigations

| Risk | Mitigation |
|---|---|
| Classifier LLM adds ~400ms latency | Acceptable; future option: switch to Haiku-class model for classification only |
| Qdrant timeout blocks response | Per-collection 3s deadline; failure degrades gracefully (no RAG context, not an error) |
| Merged RAG blows context window | Max 3 chunks/collection enforced at `queryQdrantRAG` call site |
| Frontend breaks on `categories` field | `category` (singular) kept, `categories` is additive |
| Old chat history has no `categories` column | Migration uses `ADD COLUMN IF NOT EXISTS`; existing rows get NULL, safely ignored |
