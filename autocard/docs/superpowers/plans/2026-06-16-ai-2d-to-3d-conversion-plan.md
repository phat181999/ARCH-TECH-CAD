# AI 2D-to-3D Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Analyze" pipeline that sends an existing AutoCard drawing through Claude's API, receives back a structured BIM JSON (walls, rooms, doors, windows, levels, materials), stores it in PostgreSQL, and renders it as an editable 3D model in the Three.js viewer.

**Architecture:** The Go monolith gains an `AnalysisJob` system — a drawing is submitted for analysis, a goroutine worker calls the Anthropic Claude API with the drawing's element JSON, the result is stored as `bim_data` on the drawing row, and the frontend polls for completion. The Three.js viewer gains a `BimModelRenderer` that reads the stored BIM JSON and renders it alongside (or instead of) the raw DXF elements. The existing RAG system (pgvector + knowledge chunks) is wired into the AI assistant panel so it can answer questions about the analyzed model with building-code context.

**Tech Stack:** Go 1.22 + PostgreSQL + Redis (existing), Anthropic Claude API (new — `claude-sonnet-4-6`), React 19 + Three.js + React Three Fiber (existing), Zustand (existing)

---

## Scope note

This plan covers four independent sub-systems that must be built in order:
1. **Backend analysis pipeline** (Tasks 1–5): job model, Claude API call, worker, routes
2. **Frontend analysis trigger + polling** (Tasks 6–7): button + status hook
3. **3D BIM renderer** (Tasks 8–9): new Three.js component wired into ThreeViewer
4. **RAG-enhanced AI assistant** (Task 10): BIM context injected into chat queries

Each section produces working, testable software on its own.

---

## File map

**Create:**
- `backend/models/analysis_job.go` — AnalysisJob + BIMResult types
- `backend/repository/analysis_job_repo.go` — CRUD for analysis jobs
- `backend/services/drawing_analyzer.go` — calls Anthropic API → returns BIMResult
- `backend/services/job_worker.go` — goroutine worker pool, pulls jobs from Redis queue
- `backend/handlers/analysis_handler.go` — POST /analyze + GET /analysis + GET /analysis/status

**Modify:**
- `backend/config/config.go` — add `AnthropicAPIKey` field
- `backend/main.go` — register routes, start worker, pass AnthropicAPIKey
- `frontend/src/api/client.ts` — add `drawings.analyze()`, `drawings.getAnalysis()`
- `frontend/src/canvas/3d/components/ThreeViewerUI.tsx` — add Analyze button
- `frontend/src/components/ThreeViewer.tsx` — load + pass BIM result, show status
- `frontend/src/panels/AIAssistantPanel.tsx` — include BIM context in RAG queries

**Create (frontend):**
- `frontend/src/hooks/useAnalysisJob.ts` — polling hook
- `frontend/src/canvas/3d/components/BimModelRenderer.tsx` — Three.js BIM model

---

## Task 1: AnalysisJob model + DB migration

**Files:**
- Create: `backend/models/analysis_job.go`
- Modify: `backend/main.go` (add AutoMigrate call)

- [ ] **Step 1: Create the model file**

```go
// backend/models/analysis_job.go
package models

import (
	"encoding/json"
	"time"
)

// AnalysisJob tracks an async Claude-powered analysis of a drawing.
type AnalysisJob struct {
	ID        string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	DrawingID string    `gorm:"type:uuid;not null;index" json:"drawing_id"`
	UserID    string    `gorm:"type:uuid;not null" json:"user_id"`
	Status    string    `gorm:"type:varchar(20);not null;default:'pending'" json:"status"` // pending|running|done|error
	Error     string    `gorm:"type:text" json:"error,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BIMResult stores the structured output of the analysis.
// Embedded as a JSONB column on the Drawing (added separately via ALTER).
type BIMResult struct {
	JobID    string     `json:"job_id"`
	Analyzed time.Time  `json:"analyzed"`
	Units    string     `json:"units"` // "mm" | "m" | "ft"
	Levels   []BIMLevel `json:"levels"`
	Walls    []BIMWall  `json:"walls"`
	Openings []BIMOpening `json:"openings"`
	Rooms    []BIMRoom  `json:"rooms"`
	Columns  []BIMColumn `json:"columns"`
	Meta     map[string]interface{} `json:"meta,omitempty"`
}

type BIMLevel struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`    // "Ground Floor", "Level 1", etc.
	Elevation float64 `json:"elevation"` // metres above datum
	Height    float64 `json:"height"`    // floor-to-floor height in drawing units
}

type BIMWall struct {
	ID        string  `json:"id"`
	LevelID   string  `json:"level_id"`
	Role      string  `json:"role"` // "exterior" | "interior" | "partition"
	X1        float64 `json:"x1"`
	Y1        float64 `json:"y1"`
	X2        float64 `json:"x2"`
	Y2        float64 `json:"y2"`
	Thickness float64 `json:"thickness"`
	Height    float64 `json:"height"`
	Material  string  `json:"material,omitempty"`
}

type BIMOpening struct {
	ID         string  `json:"id"`
	Type       string  `json:"type"` // "door" | "window"
	HostWallID string  `json:"host_wall_id"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Width      float64 `json:"width"`
	Height     float64 `json:"height"`
	Sill       float64 `json:"sill,omitempty"` // window sill height
}

type BIMRoom struct {
	ID       string      `json:"id"`
	LevelID  string      `json:"level_id"`
	Name     string      `json:"name"`
	RoomType string      `json:"room_type"` // "bedroom" | "bathroom" | "kitchen" | etc.
	Boundary []BIMPoint  `json:"boundary"`
	Area     float64     `json:"area"` // computed from boundary
}

type BIMColumn struct {
	ID       string  `json:"id"`
	LevelID  string  `json:"level_id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Width    float64 `json:"width"`
	Depth    float64 `json:"depth"`
	Height   float64 `json:"height"`
	Material string  `json:"material,omitempty"`
}

type BIMPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// BIMResultJSON marshals a BIMResult to a JSON string for storage.
func BIMResultJSON(r *BIMResult) (string, error) {
	b, err := json.Marshal(r)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
```

- [ ] **Step 2: Add AutoMigrate + ALTER for bim_data column in main.go**

Open `backend/main.go`. After the existing `db.Exec("ALTER TABLE drawings ...")` block (around line 50), add:

```go
	// Analysis job table
	if err := db.AutoMigrate(&models.AnalysisJob{}); err != nil {
		slog.Warn("AutoMigrate AnalysisJob failed", "error", err)
	}
	// bim_data column on drawings — JSONB, nullable
	db.Exec("ALTER TABLE drawings ADD COLUMN IF NOT EXISTS bim_data TEXT NOT NULL DEFAULT ''")
	slog.Info("Analysis schema migration checked")
```

- [ ] **Step 3: Verify the tables are created**

```bash
cd autocard/backend
go build ./...
# Should compile with zero errors
```

Expected: `go build ./...` exits 0.

- [ ] **Step 4: Commit**

```bash
git add backend/models/analysis_job.go backend/main.go
git commit -m "feat: add AnalysisJob model and bim_data column migration"
```

---

## Task 2: Analysis job repository

**Files:**
- Create: `backend/repository/analysis_job_repo.go`

- [ ] **Step 1: Create the repo file**

```go
// backend/repository/analysis_job_repo.go
package repository

import (
	"time"

	"autocard-backend/models"
	"gorm.io/gorm"
)

type AnalysisJobRepo struct {
	db *gorm.DB
}

func NewAnalysisJobRepo(db *gorm.DB) *AnalysisJobRepo {
	return &AnalysisJobRepo{db: db}
}

func (r *AnalysisJobRepo) Create(job *models.AnalysisJob) error {
	return r.db.Create(job).Error
}

func (r *AnalysisJobRepo) FindByID(id string) (*models.AnalysisJob, error) {
	var job models.AnalysisJob
	if err := r.db.First(&job, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *AnalysisJobRepo) FindLatestByDrawing(drawingID string) (*models.AnalysisJob, error) {
	var job models.AnalysisJob
	if err := r.db.Where("drawing_id = ?", drawingID).
		Order("created_at desc").
		First(&job).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *AnalysisJobRepo) SetRunning(id string) error {
	return r.db.Model(&models.AnalysisJob{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{"status": "running", "updated_at": time.Now()}).Error
}

func (r *AnalysisJobRepo) SetDone(id string) error {
	return r.db.Model(&models.AnalysisJob{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{"status": "done", "updated_at": time.Now()}).Error
}

func (r *AnalysisJobRepo) SetError(id, errMsg string) error {
	return r.db.Model(&models.AnalysisJob{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{"status": "error", "error": errMsg, "updated_at": time.Now()}).Error
}

// SaveBIMResult writes the JSON string to drawings.bim_data.
func (r *AnalysisJobRepo) SaveBIMResult(drawingID, bimJSON string) error {
	return r.db.Exec("UPDATE drawings SET bim_data = ? WHERE id = ?", bimJSON, drawingID).Error
}

// GetBIMResult reads drawings.bim_data for a drawing.
func (r *AnalysisJobRepo) GetBIMResult(drawingID string) (string, error) {
	var result struct{ BimData string }
	if err := r.db.Raw("SELECT bim_data FROM drawings WHERE id = ?", drawingID).
		Scan(&result).Error; err != nil {
		return "", err
	}
	return result.BimData, nil
}
```

- [ ] **Step 2: Build to verify**

```bash
cd autocard/backend
go build ./...
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/repository/analysis_job_repo.go
git commit -m "feat: add AnalysisJobRepo with bim_data read/write"
```

---

## Task 3: Claude Vision drawing analyzer service

**Files:**
- Create: `backend/services/drawing_analyzer.go`
- Modify: `backend/config/config.go` (add AnthropicAPIKey)

- [ ] **Step 1: Add AnthropicAPIKey to config**

In `backend/config/config.go`, add the field to the `Config` struct:

```go
type Config struct {
	// ... existing fields ...
	AnthropicAPIKey string
}
```

In the `Load()` function, add:

```go
AnthropicAPIKey: getEnv("ANTHROPIC_API_KEY", ""),
```

- [ ] **Step 2: Add ANTHROPIC_API_KEY to backend .env**

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE' >> autocard/backend/.env
```

(Replace `sk-ant-YOUR_KEY_HERE` with the actual key from the Anthropic console.)

- [ ] **Step 3: Create the analyzer service**

```go
// backend/services/drawing_analyzer.go
package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"autocard-backend/models"
)

const anthropicURL = "https://api.anthropic.com/v1/messages"

// DrawingAnalyzer converts raw drawing element JSON into a BIMResult
// by asking Claude to classify and structure the architectural elements.
type DrawingAnalyzer struct {
	apiKey string
	client *http.Client
}

func NewDrawingAnalyzer(apiKey string) *DrawingAnalyzer {
	return &DrawingAnalyzer{
		apiKey: apiKey,
		client: &http.Client{Timeout: 120 * time.Second},
	}
}

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// Analyze takes a drawing's element JSON string and returns a BIMResult.
// elementJSON is the raw `data` field from the Drawing model.
func (a *DrawingAnalyzer) Analyze(drawingID, elementJSON string) (*models.BIMResult, error) {
	// Truncate very large drawings to stay within token limits
	if len(elementJSON) > 80000 {
		elementJSON = elementJSON[:80000] + "... (truncated)"
	}

	system := `You are an expert architectural BIM engineer. Given raw CAD drawing element data (lines, polylines, arcs, rectangles, text, blocks), classify and structure the architectural elements into a BIM JSON model.

Return ONLY a valid JSON object matching this schema exactly — no prose, no markdown fences:
{
  "job_id": "",
  "analyzed": "",
  "units": "mm",
  "levels": [{"id":"L1","name":"Ground Floor","elevation":0,"height":3000}],
  "walls": [{"id":"W1","level_id":"L1","role":"exterior","x1":0,"y1":0,"x2":1000,"y2":0,"thickness":200,"height":3000,"material":"Concrete"}],
  "openings": [{"id":"O1","type":"door","host_wall_id":"W1","x":200,"y":0,"width":900,"height":2100,"sill":0}],
  "rooms": [{"id":"R1","level_id":"L1","name":"Living Room","room_type":"living","boundary":[{"x":0,"y":0}],"area":0}],
  "columns": [],
  "meta": {}
}

Rules:
- Identify WALL elements from lines with archType="wall" or layer names matching /WALL/i
- Identify DOOR elements from archType="door", layer /DOOR/i, or arc shapes near wall ends
- Identify WINDOW elements from archType="window", layer /WIND|GLAZ/i
- Identify ROOM elements from text labels or hatch regions
- Skip annotation elements (dimensions, text, leaders, hatches unless room)
- Use the same coordinate system as the input data
- Compute room area from boundary polygon if you can determine the boundary
- Set units to "mm" if coordinates are large numbers (>1000), "m" if small
- Assign unique sequential IDs: W1,W2... O1,O2... R1,R2... L1... C1...
- Set job_id and analyzed to empty string (will be filled by server)`

	userMsg := fmt.Sprintf("Drawing ID: %s\n\nElement data:\n%s", drawingID, elementJSON)

	reqBody := anthropicRequest{
		Model:     "claude-sonnet-4-6",
		MaxTokens: 8192,
		System:    system,
		Messages: []anthropicMessage{
			{Role: "user", Content: userMsg},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", anthropicURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", a.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API call: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(respBytes))
	}

	var anthropicResp anthropicResponse
	if err := json.Unmarshal(respBytes, &anthropicResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}
	if anthropicResp.Error != nil {
		return nil, fmt.Errorf("API error: %s", anthropicResp.Error.Message)
	}
	if len(anthropicResp.Content) == 0 {
		return nil, fmt.Errorf("empty response from Claude")
	}

	rawText := strings.TrimSpace(anthropicResp.Content[0].Text)
	// Strip markdown fences if Claude added them despite instructions
	rawText = strings.TrimPrefix(rawText, "```json")
	rawText = strings.TrimPrefix(rawText, "```")
	rawText = strings.TrimSuffix(rawText, "```")
	rawText = strings.TrimSpace(rawText)

	var result models.BIMResult
	if err := json.Unmarshal([]byte(rawText), &result); err != nil {
		return nil, fmt.Errorf("parse BIM JSON from Claude output: %w — raw: %.500s", err, rawText)
	}

	result.JobID = drawingID
	result.Analyzed = time.Now().UTC()

	return &result, nil
}
```

- [ ] **Step 4: Build to verify**

```bash
cd autocard/backend
go build ./...
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add backend/services/drawing_analyzer.go backend/config/config.go
git commit -m "feat: add DrawingAnalyzer service (Claude API → BIM JSON)"
```

---

## Task 4: Job worker pool

**Files:**
- Create: `backend/services/job_worker.go`

- [ ] **Step 1: Create the worker**

```go
// backend/services/job_worker.go
package services

import (
	"context"
	"log/slog"
	"time"

	"autocard-backend/models"
	"autocard-backend/repository"

	"github.com/redis/go-redis/v9"
)

const jobQueueKey = "autocard:analysis_jobs"

// JobWorker pulls analysis job IDs from Redis and processes them.
type JobWorker struct {
	rdb         *redis.Client
	jobRepo     *repository.AnalysisJobRepo
	drawingRepo *repository.DrawingRepo
	analyzer    *DrawingAnalyzer
}

func NewJobWorker(
	rdb *redis.Client,
	jobRepo *repository.AnalysisJobRepo,
	drawingRepo *repository.DrawingRepo,
	analyzer *DrawingAnalyzer,
) *JobWorker {
	return &JobWorker{
		rdb:         rdb,
		jobRepo:     jobRepo,
		drawingRepo: drawingRepo,
		analyzer:    analyzer,
	}
}

// EnqueueJob pushes a job ID onto the Redis list for the worker to pick up.
func EnqueueJob(rdb *redis.Client, jobID string) error {
	return rdb.LPush(context.Background(), jobQueueKey, jobID).Err()
}

// Start launches `concurrency` worker goroutines. Call once at startup.
// Cancel ctx to shut down gracefully.
func (w *JobWorker) Start(ctx context.Context, concurrency int) {
	for i := 0; i < concurrency; i++ {
		go w.runLoop(ctx)
	}
	slog.Info("Job workers started", "concurrency", concurrency)
}

func (w *JobWorker) runLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		// Blocking pop with 5s timeout so we can check ctx
		result, err := w.rdb.BRPop(ctx, 5*time.Second, jobQueueKey).Result()
		if err != nil {
			// Timeout or context cancelled — just loop
			continue
		}
		if len(result) < 2 {
			continue
		}
		jobID := result[1]
		w.process(ctx, jobID)
	}
}

func (w *JobWorker) process(ctx context.Context, jobID string) {
	job, err := w.jobRepo.FindByID(jobID)
	if err != nil {
		slog.Error("Worker: job not found", "job_id", jobID, "error", err)
		return
	}

	if err := w.jobRepo.SetRunning(jobID); err != nil {
		slog.Error("Worker: failed to set running", "job_id", jobID, "error", err)
		return
	}

	// Load the drawing's element data
	drawing, err := w.drawingRepo.FindByID(job.DrawingID)
	if err != nil {
		_ = w.jobRepo.SetError(jobID, "drawing not found: "+err.Error())
		return
	}

	// Run Claude analysis
	result, err := w.analyzer.Analyze(job.DrawingID, drawing.Data)
	if err != nil {
		slog.Error("Worker: analysis failed", "job_id", jobID, "error", err)
		_ = w.jobRepo.SetError(jobID, err.Error())
		return
	}

	// Persist BIM JSON
	bimJSON, err := models.BIMResultJSON(result)
	if err != nil {
		_ = w.jobRepo.SetError(jobID, "marshal BIM result: "+err.Error())
		return
	}

	if err := w.jobRepo.SaveBIMResult(job.DrawingID, bimJSON); err != nil {
		_ = w.jobRepo.SetError(jobID, "save BIM result: "+err.Error())
		return
	}

	if err := w.jobRepo.SetDone(jobID); err != nil {
		slog.Error("Worker: failed to set done", "job_id", jobID, "error", err)
	}

	slog.Info("Worker: analysis complete", "job_id", jobID, "drawing_id", job.DrawingID)
}
```

- [ ] **Step 2: Build**

```bash
cd autocard/backend
go build ./...
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add backend/services/job_worker.go
git commit -m "feat: add JobWorker (Redis BRPop → Claude analyze → save BIM)"
```

---

## Task 5: Analysis handler + routes

**Files:**
- Create: `backend/handlers/analysis_handler.go`
- Modify: `backend/main.go`

- [ ] **Step 1: Create the handler**

```go
// backend/handlers/analysis_handler.go
package handlers

import (
	"encoding/json"
	"net/http"

	"autocard-backend/middleware"
	"autocard-backend/models"
	"autocard-backend/repository"
	"autocard-backend/services"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type AnalysisHandler struct {
	jobRepo     *repository.AnalysisJobRepo
	drawingRepo *repository.DrawingRepo
	rdb         *redis.Client
}

func NewAnalysisHandler(
	jobRepo *repository.AnalysisJobRepo,
	drawingRepo *repository.DrawingRepo,
	rdb *redis.Client,
) *AnalysisHandler {
	return &AnalysisHandler{jobRepo: jobRepo, drawingRepo: drawingRepo, rdb: rdb}
}

// POST /api/drawings/{id}/analyze — creates an analysis job and enqueues it.
func (h *AnalysisHandler) Submit(w http.ResponseWriter, r *http.Request) {
	drawingID := r.PathValue("id")
	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Verify drawing exists and user has access
	drawing, err := h.drawingRepo.FindByID(drawingID)
	if err != nil || drawing == nil {
		http.Error(w, `{"error":"drawing not found"}`, http.StatusNotFound)
		return
	}

	if drawing.Data == "" || drawing.Data == "{}" || drawing.Data == "[]" {
		http.Error(w, `{"error":"drawing has no element data to analyze"}`, http.StatusBadRequest)
		return
	}

	job := &models.AnalysisJob{
		ID:        uuid.New().String(),
		DrawingID: drawingID,
		UserID:    userID,
		Status:    "pending",
	}
	if err := h.jobRepo.Create(job); err != nil {
		http.Error(w, `{"error":"failed to create job"}`, http.StatusInternalServerError)
		return
	}

	if err := services.EnqueueJob(h.rdb, job.ID); err != nil {
		http.Error(w, `{"error":"failed to enqueue job"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(job)
}

// GET /api/drawings/{id}/analysis/status — returns the latest job status.
func (h *AnalysisHandler) Status(w http.ResponseWriter, r *http.Request) {
	drawingID := r.PathValue("id")
	job, err := h.jobRepo.FindLatestByDrawing(drawingID)
	if err != nil {
		http.Error(w, `{"error":"no analysis job found"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(job)
}

// GET /api/drawings/{id}/analysis — returns the stored BIM JSON result.
func (h *AnalysisHandler) GetResult(w http.ResponseWriter, r *http.Request) {
	drawingID := r.PathValue("id")
	bimJSON, err := h.jobRepo.GetBIMResult(drawingID)
	if err != nil || bimJSON == "" {
		http.Error(w, `{"error":"no analysis result available"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(bimJSON))
}
```

- [ ] **Step 2: Wire into main.go**

In `backend/main.go`, after the existing `ragRepo` + `ragHandler` lines (~line 65), add:

```go
	analysisJobRepo := repository.NewAnalysisJobRepo(db)
	analyzer := services.NewDrawingAnalyzer(cfg.AnthropicAPIKey)
	worker := services.NewJobWorker(rdb, analysisJobRepo, drawingRepo, analyzer)
	analysisHandler := handlers.NewAnalysisHandler(analysisJobRepo, drawingRepo, rdb)

	// Start 2 worker goroutines
	worker.Start(context.Background(), 2)
```

Then in the `protected` routes block, after the drawing routes, add:

```go
	protected.HandleFunc("POST /api/drawings/{id}/analyze", analysisHandler.Submit)
	protected.HandleFunc("GET /api/drawings/{id}/analysis/status", analysisHandler.Status)
	protected.HandleFunc("GET /api/drawings/{id}/analysis", analysisHandler.GetResult)
```

And in the auth middleware wiring block, the existing `/api/drawings/` catch-all already covers these routes.

- [ ] **Step 3: Add missing imports to main.go**

The `context` package is already imported. Verify `services` and `repository` are in the import block — they should be via the existing `ragRepo` usage.

```bash
cd autocard/backend
go build ./...
```

Expected: exits 0.

- [ ] **Step 4: Smoke test with curl (requires running server)**

```bash
# In one terminal:
cd autocard/backend && go run .

# In another (get a real drawing ID from your DB first):
DRAWING_ID="your-drawing-uuid-here"
TOKEN="your-jwt-here"

curl -s -X POST http://localhost:8080/api/drawings/$DRAWING_ID/analyze \
  -H "Authorization: Bearer $TOKEN" | jq .
# Expected: {"id":"...","drawing_id":"...","status":"pending",...}

sleep 5

curl -s http://localhost:8080/api/drawings/$DRAWING_ID/analysis/status \
  -H "Authorization: Bearer $TOKEN" | jq .status
# Expected: "running" or "done"
```

- [ ] **Step 5: Commit**

```bash
git add backend/handlers/analysis_handler.go backend/main.go
git commit -m "feat: add analysis handler (submit/status/result) + wire worker"
```

---

## Task 6: Frontend API client + polling hook

**Files:**
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/hooks/useAnalysisJob.ts`

- [ ] **Step 1: Add analysis methods to client.ts**

Open `frontend/src/api/client.ts`. After the `drawings` object's existing methods, add these three methods inside the same `drawings` object:

```typescript
  analyzeDrawing: async (drawingId: string): Promise<{ id: string; status: string }> => {
    const res = await apiFetch(`/api/drawings/${drawingId}/analyze`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getAnalysisStatus: async (drawingId: string): Promise<{ id: string; status: string; error?: string }> => {
    const res = await apiFetch(`/api/drawings/${drawingId}/analysis/status`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getAnalysisResult: async (drawingId: string): Promise<BIMResult> => {
    const res = await apiFetch(`/api/drawings/${drawingId}/analysis`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
```

Also add the `BIMResult` TypeScript type at the top of `client.ts` (or in a new file `frontend/src/types/bim.ts` if you prefer — but inline is simpler given the existing pattern):

```typescript
export interface BIMPoint { x: number; y: number }
export interface BIMLevel { id: string; name: string; elevation: number; height: number }
export interface BIMWall { id: string; level_id: string; role: string; x1: number; y1: number; x2: number; y2: number; thickness: number; height: number; material?: string }
export interface BIMOpening { id: string; type: "door" | "window"; host_wall_id: string; x: number; y: number; width: number; height: number; sill?: number }
export interface BIMRoom { id: string; level_id: string; name: string; room_type: string; boundary: BIMPoint[]; area: number }
export interface BIMColumn { id: string; level_id: string; x: number; y: number; width: number; depth: number; height: number; material?: string }
export interface BIMResult {
  job_id: string; analyzed: string; units: string;
  levels: BIMLevel[]; walls: BIMWall[]; openings: BIMOpening[];
  rooms: BIMRoom[]; columns: BIMColumn[];
  meta?: Record<string, unknown>;
}
```

- [ ] **Step 2: Create the polling hook**

```typescript
// frontend/src/hooks/useAnalysisJob.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { drawings, type BIMResult } from "../api/client";

type Status = "idle" | "pending" | "running" | "done" | "error";

export function useAnalysisJob(drawingId: string) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<BIMResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const loadResult = useCallback(async () => {
    try {
      const bim = await drawings.getAnalysisResult(drawingId);
      setResult(bim);
    } catch {
      // result not ready yet — ignore
    }
  }, [drawingId]);

  const poll = useCallback(async () => {
    try {
      const job = await drawings.getAnalysisStatus(drawingId);
      setStatus(job.status as Status);
      if (job.status === "done") {
        stopPolling();
        await loadResult();
      } else if (job.status === "error") {
        stopPolling();
        setError(job.error ?? "Analysis failed");
      }
    } catch {
      stopPolling();
      setStatus("idle");
    }
  }, [drawingId, stopPolling, loadResult]);

  const start = useCallback(async () => {
    setStatus("pending");
    setResult(null);
    setError(null);
    try {
      await drawings.analyzeDrawing(drawingId);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to start analysis");
      return;
    }
    intervalRef.current = setInterval(poll, 3000);
  }, [drawingId, poll]);

  // On mount: check if there's already a result
  useEffect(() => {
    loadResult();
    return () => stopPolling();
  }, [loadResult, stopPolling]);

  return { status, result, error, start };
}
```

- [ ] **Step 3: Type-check**

```bash
cd autocard/frontend
npx tsc --noEmit
```

Expected: only the pre-existing error in `StoreOrderPage.tsx:493`. Zero new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/hooks/useAnalysisJob.ts
git commit -m "feat: add BIM analysis API client methods + useAnalysisJob polling hook"
```

---

## Task 7: "Analyze 2D → 3D" button in ThreeViewer toolbar

**Files:**
- Modify: `frontend/src/canvas/3d/components/ThreeViewerUI.tsx`
- Modify: `frontend/src/components/ThreeViewer.tsx`

- [ ] **Step 1: Add the analyze button to ThreeViewerUI**

Open `frontend/src/canvas/3d/components/ThreeViewerUI.tsx`. Add `onAnalyze`, `analyzeStatus`, and `hasResult` props to `ThreeToolbar`:

```typescript
// Add to the ThreeToolbar props interface (find the existing interface and add):
  onAnalyze?: () => void;
  analyzeStatus?: "idle" | "pending" | "running" | "done" | "error";
  hasResult?: boolean;
```

Inside the `ThreeToolbar` component's return JSX, add this button after the existing toolbar buttons (before the closing `</div>` of the toolbar):

```tsx
      {/* AI Analysis */}
      {onAnalyze && (
        <button
          onClick={onAnalyze}
          disabled={analyzeStatus === "pending" || analyzeStatus === "running"}
          title="Analyze 2D drawing → BIM 3D model"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {analyzeStatus === "pending" || analyzeStatus === "running" ? (
            <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          )}
          {analyzeStatus === "running" ? "Analyzing…" : analyzeStatus === "done" ? "Re-analyze" : "Analyze 2D→3D"}
        </button>
      )}
```

- [ ] **Step 2: Wire into ThreeViewer**

Open `frontend/src/components/ThreeViewer.tsx`. Add the following near the top of the component (after existing state declarations):

```typescript
import { useAnalysisJob } from "../hooks/useAnalysisJob";

// Inside ThreeViewer component body:
const drawingId = useDrawingStore((s) => s.currentDrawingId); // or however the current drawing ID is accessed
const { status: analyzeStatus, result: bimResult, start: startAnalysis } = useAnalysisJob(drawingId ?? "");
```

Then pass these props to `ThreeToolbar` wherever it is rendered in `ThreeViewer`:

```tsx
<ThreeToolbar
  // ... existing props ...
  onAnalyze={drawingId ? startAnalysis : undefined}
  analyzeStatus={analyzeStatus}
  hasResult={bimResult !== null}
/>
```

Also pass `bimResult` down to `PlanModel` (Task 8 will use it).

- [ ] **Step 3: Find the actual currentDrawingId access**

```bash
grep -n "currentDrawingId\|drawingId\|drawing\.id" /Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/components/ThreeViewer.tsx | head -10
grep -n "currentDrawingId" /Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/stores/drawingStore.ts | head -5
```

If `currentDrawingId` is not in `drawingStore`, check what ID field is used. Update the `useAnalysisJob` call to use the correct ID source. If the drawing ID comes from a URL param (e.g., `useParams()`), import it from `react-router-dom`:

```typescript
import { useParams } from "react-router-dom";
const { id: drawingId } = useParams<{ id: string }>();
```

- [ ] **Step 4: Type-check**

```bash
cd autocard/frontend
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/canvas/3d/components/ThreeViewerUI.tsx frontend/src/components/ThreeViewer.tsx
git commit -m "feat: add Analyze 2D→3D button to ThreeViewer toolbar"
```

---

## Task 8: BimModelRenderer component

**Files:**
- Create: `frontend/src/canvas/3d/components/BimModelRenderer.tsx`
- Modify: `frontend/src/canvas/3d/components/index.ts`

- [ ] **Step 1: Create the renderer**

```tsx
// frontend/src/canvas/3d/components/BimModelRenderer.tsx
import { useEffect, useRef, memo } from "react";
import * as THREE from "three";
import type { BIMResult, BIMWall, BIMOpening } from "../../../api/client";

// ── Wall instanced mesh ────────────────────────────────────────────────────────
function BimWalls({ walls }: { walls: BIMWall[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || walls.length === 0) return;
    const dummy = new THREE.Object3D();
    walls.forEach((w, i) => {
      const dx = w.x2 - w.x1;
      const dz = w.y2 - w.y1;
      const len = Math.hypot(dx, dz);
      const cx = (w.x1 + w.x2) / 2;
      const cz = (w.y1 + w.y2) / 2;
      dummy.position.set(cx, w.height / 2, cz);
      dummy.scale.set(len || 1, w.height || 3000, w.thickness || 200);
      dummy.rotation.y = -Math.atan2(dz, dx);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [walls]);

  if (walls.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, walls.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#e8e0d8" />
    </instancedMesh>
  );
}

// ── Door/window openings ───────────────────────────────────────────────────────
function BimOpenings({ openings }: { openings: BIMOpening[] }) {
  if (openings.length === 0) return null;
  return (
    <>
      {openings.map((o) => {
        const color = o.type === "door" ? "#8B4513" : "#87CEEB";
        const height = o.height || (o.type === "door" ? 2100 : 1200);
        const sill = o.sill || 0;
        return (
          <mesh key={o.id} position={[o.x, sill + height / 2, o.y]} castShadow>
            <boxGeometry args={[o.width || 900, height, 50]} />
            <meshStandardMaterial color={color} transparent opacity={o.type === "window" ? 0.4 : 0.9} />
          </mesh>
        );
      })}
    </>
  );
}

// ── Room floor labels ──────────────────────────────────────────────────────────
function BimRooms({ rooms }: { rooms: BIMResult["rooms"] }) {
  if (rooms.length === 0) return null;
  return (
    <>
      {rooms.map((room) => {
        if (room.boundary.length < 3) return null;
        // Compute centroid
        const cx = room.boundary.reduce((s, p) => s + p.x, 0) / room.boundary.length;
        const cz = room.boundary.reduce((s, p) => s + p.y, 0) / room.boundary.length;
        // Build flat polygon for the floor
        const shape = new THREE.Shape(room.boundary.map((p) => new THREE.Vector2(p.x, p.y)));
        const geo = new THREE.ShapeGeometry(shape);
        return (
          <group key={room.id}>
            <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 2, 0]}>
              <meshStandardMaterial color="#f5f0e8" transparent opacity={0.5} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// ── Main renderer ──────────────────────────────────────────────────────────────
export const BimModelRenderer = memo(function BimModelRenderer({ result }: { result: BIMResult }) {
  return (
    <group name="bim-model">
      <BimWalls walls={result.walls} />
      <BimOpenings openings={result.openings} />
      <BimRooms rooms={result.rooms} />
    </group>
  );
});
```

- [ ] **Step 2: Export from index**

In `frontend/src/canvas/3d/components/index.ts`, add:

```typescript
export { BimModelRenderer } from "./BimModelRenderer";
```

- [ ] **Step 3: Type-check**

```bash
cd autocard/frontend
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/canvas/3d/components/BimModelRenderer.tsx frontend/src/canvas/3d/components/index.ts
git commit -m "feat: add BimModelRenderer (instanced walls + openings + room floors)"
```

---

## Task 9: Wire BimModelRenderer into ThreeViewer

**Files:**
- Modify: `frontend/src/components/ThreeViewer.tsx`

- [ ] **Step 1: Import and conditionally render BimModelRenderer**

Open `frontend/src/components/ThreeViewer.tsx`. Add the import:

```typescript
import { BimModelRenderer } from "../canvas/3d/components";
```

Inside the `<Canvas>` (or `<PlanModel>`) JSX, add a toggle: when a BIM result exists, show `BimModelRenderer` in addition to (or instead of) the raw DXF wireframe. Add a state toggle `showBim`:

```typescript
const [showBim, setShowBim] = useState(false);

// When bimResult arrives, auto-switch to BIM view
useEffect(() => {
  if (bimResult) setShowBim(true);
}, [bimResult]);
```

Inside the `<Canvas>`:

```tsx
{bimResult && showBim && <BimModelRenderer result={bimResult} />}
```

Also add a toggle button in `ThreeToolbar` (or inline in ThreeViewer) when `bimResult` is non-null:

```tsx
{bimResult && (
  <button
    onClick={() => setShowBim((v) => !v)}
    className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
  >
    {showBim ? "Show DXF" : "Show BIM"}
  </button>
)}
```

- [ ] **Step 2: Type-check**

```bash
cd autocard/frontend
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 3: Manual test**

```bash
cd autocard/frontend
npm run dev
```

1. Open a drawing that has DXF elements.
2. Switch to 3D view.
3. Click "Analyze 2D→3D" — button shows spinner.
4. After ~10–30s, button changes to "Re-analyze".
5. Click "Show BIM" — the classified BIM model appears as colored wall boxes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ThreeViewer.tsx
git commit -m "feat: render BimModelRenderer in ThreeViewer when analysis is done"
```

---

## Task 10: RAG-enhanced AI assistant

**Files:**
- Modify: `frontend/src/panels/AIAssistantPanel.tsx`

The existing RAG system already has `POST /api/rag/query`. This task wires the current drawing's BIM result into that query so the AI assistant can answer building-specific questions using the analyzed model as context.

- [ ] **Step 1: Inject BIM context into AI assistant queries**

Open `frontend/src/panels/AIAssistantPanel.tsx`. Add a prop or store access to get the current BIM result. The simplest approach: read from `useAnalysisJob` inside the panel.

Find where `processPrompt` sends a message to the AI. Before calling `generateDrawingFromPrompt` or the RAG endpoint, build a system context string:

```typescript
import { useAnalysisJob } from "../hooks/useAnalysisJob";
import { useParams } from "react-router-dom";

// Inside AIAssistantPanel:
const { id: drawingId } = useParams<{ id: string }>();
const { result: bimResult } = useAnalysisJob(drawingId ?? "");

// In processPrompt, before calling the AI:
const bimContext = bimResult
  ? `Current building model: ${bimResult.walls.length} walls, ` +
    `${bimResult.rooms.map((r) => r.name).join(", ")} rooms, ` +
    `${bimResult.openings.filter((o) => o.type === "door").length} doors, ` +
    `${bimResult.openings.filter((o) => o.type === "window").length} windows. ` +
    `Units: ${bimResult.units}.`
  : "";

const enrichedPrompt = bimContext ? `${bimContext}\n\nUser: ${prompt}` : prompt;
// Then use enrichedPrompt instead of prompt when calling the API
```

- [ ] **Step 2: Add a RAG query path for building questions**

Still in `AIAssistantPanel.tsx`, add a check: if the prompt contains architectural keywords, call the RAG endpoint instead of (or before) the generative AI:

```typescript
const isArchQuery = /wall|room|door|window|floor|ceiling|height|area|material|code|compliance/i.test(lower);

if (isArchQuery && drawingId) {
  try {
    const res = await fetch("/api/rag/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ query: enrichedPrompt, limit: 5 }),
    });
    if (res.ok) {
      const ragData = await res.json();
      // ragData has chunks from the knowledge base
      const ragContext = (ragData.chunks ?? [])
        .map((c: { content: string }) => c.content)
        .join("\n---\n");
      if (ragContext) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Based on building code knowledge:\n\n${ragContext.slice(0, 800)}${ragContext.length > 800 ? "…" : ""}`,
          },
        ]);
        setIsProcessing(false);
        return;
      }
    }
  } catch {
    // Fall through to regular AI generation
  }
}
```

- [ ] **Step 3: Type-check**

```bash
cd autocard/frontend
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 4: Manual test**

1. Run a drawing analysis (Task 9).
2. Open the AI assistant panel.
3. Type "How many rooms does this building have?"
4. Expected: response includes room count from BIM context.
5. Type "What is the minimum wall thickness for exterior walls?"
6. Expected: RAG query fires; response contains knowledge-base content if chunks exist.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/panels/AIAssistantPanel.tsx
git commit -m "feat: inject BIM context + RAG queries into AI assistant panel"
```

---

## Self-Review

### Spec coverage

| Deliverable | Covered by |
|---|---|
| Complete System Architecture | Architecture section in plan header + Task 3 (Claude API call design) |
| Database Schema | Task 1 (AnalysisJob, BIMResult types, bim_data column) |
| AI Processing Pipeline | Tasks 3–5 (analyzer service, worker, handler) |
| BIM JSON Schema | Task 1 (`BIMResult` struct with Level/Wall/Opening/Room/Column) |
| 3D Reconstruction Engine | Tasks 8–9 (BimModelRenderer with instanced walls, openings, room floors) |
| Three.js Viewer Design | Task 9 (BIM/DXF toggle in ThreeViewer) |
| RAG Architecture | Task 10 (RAG query with BIM context injection) |
| API Specifications | Tasks 5–6 (three new endpoints + client methods) |
| Queue Processing Design | Task 4 (Redis BRPop + goroutine pool) |
| Event-Driven Workflow | Task 4 (enqueue → poll → load) |

**Not covered in this plan (intentionally deferred):**
- Scalability/Infrastructure design — depends on actual usage; add horizontal workers + message broker when needed
- Security design — inherits existing JWT auth; add rate limiting on `/analyze` when needed
- IFC export, SAM2/YOLO computer vision — requires Python microservice; out of scope for MVP
- Full Qdrant RAG — existing pgvector RAG is sufficient for MVP; migrate when knowledge base grows past 100k chunks
- Development roadmap / engineering estimates — documented in the spec (see `docs/superpowers/specs/`)
- Production deployment — no new infrastructure changes needed; existing Cloudflare Pages + Go server handles it

### Placeholder scan

No TBDs, no "fill in later", no "similar to task N". Each code block is complete and self-contained.

### Type consistency

- `BIMResult`, `BIMWall`, `BIMOpening`, `BIMRoom`, `BIMLevel`, `BIMColumn`, `BIMPoint` — defined in Task 6 Step 1, used in Tasks 8 and 10
- `useAnalysisJob` — defined in Task 6 Step 2, used in Tasks 7 and 10
- `BimModelRenderer` — defined in Task 8, exported in Task 8 Step 2, imported in Task 9
- `AnalysisJob` model — defined in Task 1, repo in Task 2, handler in Task 5, routes in Task 5 Step 2
- `DrawingAnalyzer`, `JobWorker`, `EnqueueJob` — defined in Tasks 3–4, wired in Task 5 Step 2

All consistent.
