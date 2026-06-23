package handlers

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"autocard-backend/config"
	"autocard-backend/middleware"
	"autocard-backend/models"
	"autocard-backend/repository"

	pgvector "github.com/pgvector/pgvector-go"
	"github.com/redis/go-redis/v9"
)

// ── Handler struct ────────────────────────────────────────────────────────────

type RAGHandler struct {
	ragRepo  *repository.RAGRepo
	userRepo *repository.UserRepo
	orgRepo  *repository.OrganizationRepo
	cfg      *config.Config
	rdb      *redis.Client
}

func NewRAGHandler(
	ragRepo *repository.RAGRepo,
	userRepo *repository.UserRepo,
	orgRepo *repository.OrganizationRepo,
	cfg *config.Config,
	rdb *redis.Client,
) *RAGHandler {
	return &RAGHandler{
		ragRepo:  ragRepo,
		userRepo: userRepo,
		orgRepo:  orgRepo,
		cfg:      cfg,
		rdb:      rdb,
	}
}

// ── Request / response types ──────────────────────────────────────────────────

type RAGQueryRequest struct {
	Prompt   string                   `json:"prompt"`
	Elements []map[string]interface{} `json:"elements"`
}

type RAGQueryResponse struct {
	Context    string                    `json:"context"`
	Projects   []models.HistoricalProject `json:"projects"`
	Rules      []models.BuildingRule      `json:"rules"`
	Compliance []ComplianceResult         `json:"compliance"`
}

type upsertKnowledgeChunkRequest struct {
	DocumentTitle     string          `json:"document_title"`
	SectionIdentifier string          `json:"section_identifier"`
	Content           string          `json:"content"`
	Metadata          json.RawMessage `json:"metadata"`
}

type upsertCADComponentRequest struct {
	ComponentName     string          `json:"component_name"`
	Category          string          `json:"category"`
	SVGRepresentation string          `json:"svg_representation"`
	GeometryData      json.RawMessage `json:"geometry_data"`
	Tags              []string        `json:"tags"`
}

type upsertBuildingRuleRequest struct {
	Jurisdiction  string          `json:"jurisdiction"`
	RuleCategory  string          `json:"rule_category"`
	TargetElement string          `json:"target_element"`
	RuleType      string          `json:"rule_type"`
	Parameters    json.RawMessage `json:"parameters"`
	Description   string          `json:"description"`
	Severity      string          `json:"severity"`
}

type saveProjectRequest struct {
	ProjectName     string                   `json:"project_name"`
	FootprintWidth  float64                  `json:"footprint_width"`
	FootprintLength float64                  `json:"footprint_length"`
	RoomCount       int                      `json:"room_count"`
	StyleTag        string                   `json:"style_tag"`
	Elements        []map[string]interface{} `json:"elements"`
}

type recordEditsRequest struct {
	SessionID       string            `json:"session_id"`
	Actions         []json.RawMessage `json:"actions"`
	InitialElements []interface{}     `json:"initial_elements"`
}

type markExportRequest struct {
	SessionID string `json:"session_id"`
	Rating    *int   `json:"rating"`
}

type promoteGoldenRequest struct {
	ProjectID              string   `json:"project_id"`
	ReviewComments         string   `json:"review_comments"`
	VerifiedComplianceRules []string `json:"verified_compliance_rules"`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// resolveTenant returns the user's primary org ID, or userID if no org exists.
func (h *RAGHandler) resolveTenant(userID string) (string, error) {
	orgs, err := h.orgRepo.GetUserOrganizations(userID)
	if err != nil || len(orgs) == 0 {
		return userID, nil
	}
	return orgs[0].ID, nil
}

// cacheKey computes the Redis key for a RAG query prompt.
func cacheKey(prompt string) string {
	sum := sha256.Sum256([]byte(prompt))
	return fmt.Sprintf("rag:cache:%x", sum)
}

// queryCacheKeysSet is the Redis set that tracks all active cache keys for flush.
const queryCacheKeysSet = "rag:cache:keys"

// ── POST /api/rag/query ───────────────────────────────────────────────────────

func (h *RAGHandler) RAGQuery(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeRAGError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req RAGQueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Prompt == "" {
		writeRAGError(w, http.StatusBadRequest, "prompt is required")
		return
	}

	// 1. Resolve tenant
	tenantID, _ := h.resolveTenant(userID)

	// 2. Check Redis cache
	ctx := context.Background()
	key := cacheKey(req.Prompt)
	if cached, err := h.rdb.Get(ctx, key).Bytes(); err == nil {
		var resp RAGQueryResponse
		if json.Unmarshal(cached, &resp) == nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}
	}

	if h.cfg.OpenAIAPIKey == "" {
		writeRAGError(w, http.StatusServiceUnavailable, "OPENAI_API_KEY not configured")
		return
	}

	// 3. Extract structured query fields via OpenAI
	queryMeta := h.extractQueryMeta(req.Prompt)

	// 4. Build expanded query text
	expandedQuery := expandQuery(req.Prompt, queryMeta)

	// 5. Get query embedding
	embVec, err := GetEmbedding(h.cfg.OpenAIAPIKey, expandedQuery)
	if err != nil {
		writeRAGError(w, http.StatusBadGateway, "embedding failed: "+err.Error())
		return
	}
	embedding := pgvector.NewVector(embVec)

	// 6. Parallel vector + BM25 search
	type chunkResult struct {
		vector []models.KnowledgeChunk
		bm25   []models.KnowledgeChunk
		err    error
	}
	chunkCh := make(chan chunkResult, 1)

	type projectResult struct {
		items []models.HistoricalProject
		err   error
	}
	projCh := make(chan projectResult, 1)

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		vec, e1 := h.ragRepo.VectorSearchChunks(tenantID, embedding, 10)
		bm25, e2 := h.ragRepo.BM25SearchChunks(tenantID, expandedQuery, 10)
		if e1 != nil {
			chunkCh <- chunkResult{err: e1}
			return
		}
		if e2 != nil {
			bm25 = nil
		}
		chunkCh <- chunkResult{vector: vec, bm25: bm25}
	}()

	go func() {
		defer wg.Done()
		wMin := math.Max(0, queryMeta.Width*0.7)
		wMax := queryMeta.Width * 1.3
		lMin := math.Max(0, queryMeta.Length*0.7)
		lMax := queryMeta.Length * 1.3
		if queryMeta.Width == 0 {
			wMin, wMax = 0, 1e9
		}
		if queryMeta.Length == 0 {
			lMin, lMax = 0, 1e9
		}
		items, e := h.ragRepo.VectorSearchProjects(tenantID, embedding, wMin, wMax, lMin, lMax, queryMeta.Style, 20)
		projCh <- projectResult{items: items, err: e}
	}()

	wg.Wait()
	close(chunkCh)
	close(projCh)

	chunkRes := <-chunkCh
	projRes := <-projCh

	// 7. RRF fusion on chunks
	topChunks := rrfFuseChunks(chunkRes.vector, chunkRes.bm25, 5)

	// 8. Rerank projects by compound similarity
	var topProjects []models.HistoricalProject
	if projRes.err == nil {
		topProjects = rerankProjects(projRes.items, queryMeta, 3)
	}

	// 9. Get compliance rules — normalize jurisdiction aliases to DB codes
	jurisdiction := normalizeJurisdiction(queryMeta.Jurisdiction)
	rules, _ := h.ragRepo.GetBuildingRules(tenantID, jurisdiction)

	// 10. Build context string
	contextStr := buildContext(topChunks, topProjects, rules)

	// 11. Run compliance on provided elements
	var compliance []ComplianceResult
	if len(req.Elements) > 0 && len(rules) > 0 {
		compliance = EvaluateRules(req.Elements, rules)
	}

	resp := RAGQueryResponse{
		Context:    contextStr,
		Projects:   topProjects,
		Rules:      rules,
		Compliance: compliance,
	}

	// 12. Cache result
	if respBytes, err := json.Marshal(resp); err == nil {
		h.rdb.Set(ctx, key, respBytes, time.Hour)
		h.rdb.SAdd(ctx, queryCacheKeysSet, key)
		h.rdb.Expire(ctx, queryCacheKeysSet, 25*time.Hour)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// ── POST /api/rag/knowledge-chunks ───────────────────────────────────────────

func (h *RAGHandler) UpsertKnowledgeChunk(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeRAGError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req upsertKnowledgeChunkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Content == "" {
		writeRAGError(w, http.StatusBadRequest, "content is required")
		return
	}

	if h.cfg.OpenAIAPIKey == "" {
		writeRAGError(w, http.StatusServiceUnavailable, "OPENAI_API_KEY not configured")
		return
	}

	tenantID, _ := h.resolveTenant(userID)

	embVec, err := GetEmbedding(h.cfg.OpenAIAPIKey, req.Content)
	if err != nil {
		writeRAGError(w, http.StatusBadGateway, "embedding failed: "+err.Error())
		return
	}

	metadata := req.Metadata
	if len(metadata) == 0 {
		metadata = json.RawMessage("{}")
	}

	chunk := &models.KnowledgeChunk{
		TenantID:          tenantID,
		DocumentTitle:     req.DocumentTitle,
		SectionIdentifier: req.SectionIdentifier,
		Content:           req.Content,
		Embedding:         pgvector.NewVector(embVec),
		Metadata:          metadata,
	}

	if err := h.ragRepo.CreateKnowledgeChunk(chunk); err != nil {
		writeRAGError(w, http.StatusInternalServerError, "failed to save chunk: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(chunk)
}

// ── POST /api/rag/components ──────────────────────────────────────────────────

func (h *RAGHandler) UpsertCADComponent(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeRAGError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req upsertCADComponentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ComponentName == "" {
		writeRAGError(w, http.StatusBadRequest, "component_name is required")
		return
	}

	if h.cfg.OpenAIAPIKey == "" {
		writeRAGError(w, http.StatusServiceUnavailable, "OPENAI_API_KEY not configured")
		return
	}

	tenantID, _ := h.resolveTenant(userID)

	embText := req.ComponentName + " " + req.Category + " " + strings.Join(req.Tags, " ")
	embVec, err := GetEmbedding(h.cfg.OpenAIAPIKey, embText)
	if err != nil {
		writeRAGError(w, http.StatusBadGateway, "embedding failed: "+err.Error())
		return
	}

	geometryData := req.GeometryData
	if len(geometryData) == 0 {
		geometryData = json.RawMessage("{}")
	}

	tagsJSON, _ := json.Marshal(req.Tags)
	comp := &models.CADComponent{
		TenantID:          tenantID,
		ComponentName:     req.ComponentName,
		Category:          req.Category,
		SVGRepresentation: req.SVGRepresentation,
		GeometryData:      geometryData,
		Tags:              tagsJSON,
		Embedding:         pgvector.NewVector(embVec),
	}

	if err := h.ragRepo.CreateCADComponent(comp); err != nil {
		writeRAGError(w, http.StatusInternalServerError, "failed to save component: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(comp)
}

// ── POST /api/rag/building-rules ──────────────────────────────────────────────

func (h *RAGHandler) UpsertBuildingRule(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeRAGError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req upsertBuildingRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Description == "" {
		writeRAGError(w, http.StatusBadRequest, "description is required")
		return
	}

	tenantID, _ := h.resolveTenant(userID)

	severity := req.Severity
	if severity == "" {
		severity = "warning"
	}
	jurisdiction := req.Jurisdiction
	if jurisdiction == "" {
		jurisdiction = "global"
	}

	rule := &models.BuildingRule{
		TenantID:      tenantID,
		Jurisdiction:  jurisdiction,
		RuleCategory:  req.RuleCategory,
		TargetElement: req.TargetElement,
		RuleType:      req.RuleType,
		Parameters:    req.Parameters,
		Description:   req.Description,
		Severity:      severity,
	}

	if err := h.ragRepo.CreateBuildingRule(rule); err != nil {
		writeRAGError(w, http.StatusInternalServerError, "failed to save rule: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(rule)
}

// ── POST /api/rag/projects ────────────────────────────────────────────────────

func (h *RAGHandler) SaveProject(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeRAGError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req saveProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ProjectName == "" {
		writeRAGError(w, http.StatusBadRequest, "project_name is required")
		return
	}

	if h.cfg.OpenAIAPIKey == "" {
		writeRAGError(w, http.StatusServiceUnavailable, "OPENAI_API_KEY not configured")
		return
	}

	tenantID, _ := h.resolveTenant(userID)

	layoutText := LinearizeLayout(req.Elements)
	embVec, err := GetEmbedding(h.cfg.OpenAIAPIKey, layoutText)
	if err != nil {
		writeRAGError(w, http.StatusBadGateway, "embedding failed: "+err.Error())
		return
	}

	geomJSON, _ := json.Marshal(req.Elements)

	styleTag := req.StyleTag
	if styleTag == "" {
		styleTag = "modern"
	}

	project := &models.HistoricalProject{
		TenantID:         tenantID,
		ProjectName:      req.ProjectName,
		FootprintWidth:   req.FootprintWidth,
		FootprintLength:  req.FootprintLength,
		RoomCount:        req.RoomCount,
		StyleTag:         styleTag,
		GeometryJSON:     geomJSON,
		ProjectEmbedding: pgvector.NewVector(embVec),
		QualityScore:     0.0,
	}

	if err := h.ragRepo.CreateHistoricalProject(project); err != nil {
		writeRAGError(w, http.StatusInternalServerError, "failed to save project: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(project)
}

// ── POST /api/rag/projects/{id}/edits ────────────────────────────────────────

func (h *RAGHandler) RecordEdits(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeRAGError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	projectID := r.PathValue("id")
	if projectID == "" {
		writeRAGError(w, http.StatusBadRequest, "project id is required")
		return
	}

	var req recordEditsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeRAGError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	tenantID, _ := h.resolveTenant(userID)

	// Create session if no session_id provided, otherwise append
	if req.SessionID == "" {
		initialElems, _ := json.Marshal(req.InitialElements)
		actionsJSON, _ := json.Marshal(req.Actions)
		// The route id is often a drawing id with no matching RAG project row.
		// Only set project_id when the project actually exists; otherwise leave it
		// NULL (the column is nullable) to avoid violating the FK constraint.
		var projectRef *string
		var existing models.HistoricalProject
		if err := h.ragRepo.GetProjectByID(projectID, &existing); err == nil {
			pid := projectID
			projectRef = &pid
		}
		session := &models.UserEdits{
			ProjectID:         projectRef,
			TenantID:          tenantID,
			UserID:            userID,
			InitialAIElements: initialElems,
			OperationsLog:     actionsJSON,
			NumberOfEdits:     len(req.Actions),
		}
		if err := h.ragRepo.CreateUserEditSession(session); err != nil {
			writeRAGError(w, http.StatusInternalServerError, "failed to create session: "+err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"session_id": session.ID})
		return
	}

	if err := h.ragRepo.AppendEditActions(req.SessionID, req.Actions, len(req.Actions)); err != nil {
		writeRAGError(w, http.StatusInternalServerError, "failed to append edits: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"session_id": req.SessionID})
}

// ── POST /api/rag/projects/{id}/export ───────────────────────────────────────

func (h *RAGHandler) MarkExport(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeRAGError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	projectID := r.PathValue("id")
	if projectID == "" {
		writeRAGError(w, http.StatusBadRequest, "project id is required")
		return
	}

	var req markExportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeRAGError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.SessionID != "" {
		if err := h.ragRepo.MarkExported(req.SessionID, req.Rating); err != nil {
			writeRAGError(w, http.StatusInternalServerError, "failed to mark export: "+err.Error())
			return
		}

		// Compute quality score from the specific session, not a blind user lookup
		session, err := h.ragRepo.GetEditSessionByID(req.SessionID)
		if err == nil {
			score := computeQualityScore(*session, req.Rating)
			_ = h.ragRepo.UpdateProjectQuality(projectID, score)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "exported"})
}

// ── POST /api/rag/golden ──────────────────────────────────────────────────────

func (h *RAGHandler) PromoteToGolden(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeRAGError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	// Only architects can promote
	user, err := h.userRepo.FindByID(userID)
	if err != nil || (user.SystemRole != "architect" && user.SystemRole != "admin") {
		writeRAGError(w, http.StatusForbidden, "architect or admin role required")
		return
	}

	var req promoteGoldenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ProjectID == "" {
		writeRAGError(w, http.StatusBadRequest, "project_id is required")
		return
	}

	if h.cfg.OpenAIAPIKey == "" {
		writeRAGError(w, http.StatusServiceUnavailable, "OPENAI_API_KEY not configured")
		return
	}

	tenantID, _ := h.resolveTenant(userID)

	// Copy the embedding from the source project's geometry — not from review text.
	// This keeps the golden design in the same spatial similarity space as layout queries.
	sourceProject := &models.HistoricalProject{}
	if err := h.ragRepo.GetProjectByID(req.ProjectID, sourceProject); err != nil {
		writeRAGError(w, http.StatusNotFound, "source project not found: "+err.Error())
		return
	}
	embVec := sourceProject.ProjectEmbedding.Slice()

	rulesJSON, _ := json.Marshal(req.VerifiedComplianceRules)
	projectID := req.ProjectID
	golden := &models.GoldenDesign{
		TenantID:                tenantID,
		SourceProjectID:         &projectID,
		ArchitectReviewerID:     userID,
		ReviewComments:          req.ReviewComments,
		VerifiedComplianceRules: rulesJSON,
		Embedding:               pgvector.NewVector(embVec),
	}

	if err := h.ragRepo.CreateGoldenDesign(golden); err != nil {
		writeRAGError(w, http.StatusInternalServerError, "failed to create golden design: "+err.Error())
		return
	}

	// Flush the entire cache on golden promotion
	ctx := context.Background()
	keys, err := h.rdb.SMembers(ctx, queryCacheKeysSet).Result()
	if err == nil && len(keys) > 0 {
		h.rdb.Del(ctx, keys...)
	}
	h.rdb.Del(ctx, queryCacheKeysSet)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(golden)
}

// ── GET /api/rag/components/search?q=... ─────────────────────────────────────

func (h *RAGHandler) SearchComponents(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeRAGError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	q := r.URL.Query().Get("q")
	if q == "" {
		writeRAGError(w, http.StatusBadRequest, "q parameter is required")
		return
	}

	if h.cfg.OpenAIAPIKey == "" {
		writeRAGError(w, http.StatusServiceUnavailable, "OPENAI_API_KEY not configured")
		return
	}

	tenantID, _ := h.resolveTenant(userID)

	embVec, err := GetEmbedding(h.cfg.OpenAIAPIKey, q)
	if err != nil {
		writeRAGError(w, http.StatusBadGateway, "embedding failed: "+err.Error())
		return
	}

	results, err := h.ragRepo.VectorSearchComponents(tenantID, pgvector.NewVector(embVec), 10)
	if err != nil {
		writeRAGError(w, http.StatusInternalServerError, "search failed: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// ── GET /api/rag/compliance ───────────────────────────────────────────────────

func (h *RAGHandler) CheckCompliance(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeRAGError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req struct {
		Elements     []map[string]interface{} `json:"elements"`
		Jurisdiction string                   `json:"jurisdiction"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeRAGError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	tenantID, _ := h.resolveTenant(userID)

	jurisdiction := req.Jurisdiction
	if jurisdiction == "" {
		jurisdiction = "global"
	}

	// 1. Try calling the n8n webhook RAG pipeline
	n8nURL := os.Getenv("N8N_URL")
	if n8nURL == "" {
		n8nURL = "http://localhost:5678" // fallback local
	}
	webhookURL := n8nURL + "/webhook/rag-compliance"

	client := &http.Client{Timeout: 15 * time.Second}
	reqBody, _ := json.Marshal(map[string]interface{}{
		"elements":     req.Elements,
		"jurisdiction": jurisdiction,
	})

	n8nReq, err := http.NewRequestWithContext(r.Context(), "POST", webhookURL, bytes.NewBuffer(reqBody))
	if err == nil {
		n8nReq.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(n8nReq)
		if err == nil && resp.StatusCode == http.StatusOK {
			defer resp.Body.Close()
			var n8nResponse map[string]interface{}
			if err := json.NewDecoder(resp.Body).Decode(&n8nResponse); err == nil {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(n8nResponse)
				return
			}
		}
	}

	// 2. Fallback to local rule evaluation if n8n is unavailable or errors
	rules, err := h.ragRepo.GetBuildingRules(tenantID, jurisdiction)
	if err != nil {
		writeRAGError(w, http.StatusInternalServerError, "failed to load rules: "+err.Error())
		return
	}

	results := EvaluateRules(req.Elements, rules)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"results": results,
		"total":   len(results),
		"passed":  countPassed(results),
	})
}

// ── Pipeline helpers ──────────────────────────────────────────────────────────

type queryMeta struct {
	Width        float64
	Length       float64
	Style        string
	Bedrooms     int
	Bathrooms    int
	Keywords     []string
	Jurisdiction string
}

func (h *RAGHandler) extractQueryMeta(prompt string) queryMeta {
	// Call OpenAI to extract structured metadata
	systemMsg := `Extract the following fields from the architectural prompt as JSON (use 0/empty if not present):
{"width_m": number, "length_m": number, "style": string, "bedrooms": number, "bathrooms": number, "keywords": [string], "jurisdiction": string}`

	body := map[string]interface{}{
		"model": "gpt-4o-mini",
		"messages": []map[string]string{
			{"role": "system", "content": systemMsg},
			{"role": "user", "content": prompt},
		},
		"temperature":     0,
		"response_format": map[string]string{"type": "json_object"},
	}

	bodyBytes, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", strings.NewReader(string(bodyBytes)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.cfg.OpenAIAPIKey)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return queryMeta{}
	}
	defer resp.Body.Close()

	var oaiResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&oaiResp); err != nil || len(oaiResp.Choices) == 0 {
		return queryMeta{}
	}

	var meta struct {
		WidthM       float64  `json:"width_m"`
		LengthM      float64  `json:"length_m"`
		Style        string   `json:"style"`
		Bedrooms     int      `json:"bedrooms"`
		Bathrooms    int      `json:"bathrooms"`
		Keywords     []string `json:"keywords"`
		Jurisdiction string   `json:"jurisdiction"`
	}
	json.Unmarshal([]byte(oaiResp.Choices[0].Message.Content), &meta)

	return queryMeta{
		Width:        meta.WidthM * 100,   // convert m to px (100px/m)
		Length:       meta.LengthM * 100,
		Style:        meta.Style,
		Bedrooms:     meta.Bedrooms,
		Bathrooms:    meta.Bathrooms,
		Keywords:     meta.Keywords,
		Jurisdiction: meta.Jurisdiction,
	}
}

var styleSynonyms = map[string][]string{
	"modern":       {"contemporary", "minimalist", "clean"},
	"traditional":  {"classic", "heritage", "colonial"},
	"industrial":   {"loft", "warehouse", "exposed"},
	"scandinavian": {"nordic", "hygge", "minimal"},
	"mediterranean": {"villa", "terracotta", "arch"},
}

func expandQuery(prompt string, meta queryMeta) string {
	expanded := prompt
	if synonyms, ok := styleSynonyms[strings.ToLower(meta.Style)]; ok {
		expanded += " " + strings.Join(synonyms, " ")
	}
	if len(meta.Keywords) > 0 {
		expanded += " " + strings.Join(meta.Keywords, " ")
	}
	return expanded
}

// rrfFuseChunks merges vector and BM25 results using Reciprocal Rank Fusion.
func rrfFuseChunks(vec, bm25 []models.KnowledgeChunk, topK int) []models.KnowledgeChunk {
	const k = 60.0
	scores := make(map[string]float64)
	byID := make(map[string]models.KnowledgeChunk)

	for i, c := range vec {
		scores[c.ID] += 1.0 / (k + float64(i+1))
		byID[c.ID] = c
	}
	for i, c := range bm25 {
		scores[c.ID] += 1.0 / (k + float64(i+1))
		byID[c.ID] = c
	}

	type scored struct {
		id    string
		score float64
	}
	ranked := make([]scored, 0, len(scores))
	for id, s := range scores {
		ranked = append(ranked, scored{id: id, score: s})
	}
	sort.Slice(ranked, func(i, j int) bool { return ranked[i].score > ranked[j].score })

	if topK > len(ranked) {
		topK = len(ranked)
	}
	result := make([]models.KnowledgeChunk, 0, topK)
	for _, s := range ranked[:topK] {
		result = append(result, byID[s.id])
	}
	return result
}

// rerankProjects scores projects by dimensional + style match and returns top-k.
func rerankProjects(projects []models.HistoricalProject, meta queryMeta, topK int) []models.HistoricalProject {
	type scored struct {
		p     models.HistoricalProject
		score float64
	}
	items := make([]scored, 0, len(projects))

	for _, p := range projects {
		score := 0.0

		// Dimensional similarity (width)
		if meta.Width > 0 && p.FootprintWidth > 0 {
			ratio := p.FootprintWidth / meta.Width
			if ratio > 1 {
				ratio = 1 / ratio
			}
			score += ratio * 0.4
		} else {
			score += 0.4
		}

		// Room count match
		expectedRooms := meta.Bedrooms + meta.Bathrooms + 2 // +2 for living/kitchen
		if expectedRooms > 0 && p.RoomCount > 0 {
			roomRatio := float64(p.RoomCount) / float64(expectedRooms)
			if roomRatio > 1 {
				roomRatio = 1 / roomRatio
			}
			score += roomRatio * 0.3
		} else {
			score += 0.3
		}

		// Style match
		if meta.Style != "" && strings.EqualFold(p.StyleTag, meta.Style) {
			score += 0.3
		} else if meta.Style == "" {
			score += 0.15
		}

		score += p.QualityScore * 0.1

		items = append(items, scored{p: p, score: score})
	}

	sort.Slice(items, func(i, j int) bool { return items[i].score > items[j].score })

	if topK > len(items) {
		topK = len(items)
	}
	result := make([]models.HistoricalProject, 0, topK)
	for _, s := range items[:topK] {
		result = append(result, s.p)
	}
	return result
}

// buildContext assembles the context string for the LLM.
func buildContext(chunks []models.KnowledgeChunk, projects []models.HistoricalProject, rules []models.BuildingRule) string {
	var sb strings.Builder

	if len(chunks) > 0 {
		sb.WriteString("## Relevant Building Code References\n")
		for _, c := range chunks {
			sb.WriteString(fmt.Sprintf("### %s — %s\n%s\n\n", c.DocumentTitle, c.SectionIdentifier, c.Content))
		}
	}

	if len(projects) > 0 {
		sb.WriteString("## Similar Historical Projects\n")
		for _, p := range projects {
			sb.WriteString(fmt.Sprintf("- %s: %.0fm × %.0fm, %d rooms, style=%s, quality=%.2f\n",
				p.ProjectName, p.FootprintWidth/100, p.FootprintLength/100, p.RoomCount, p.StyleTag, p.QualityScore))
		}
		sb.WriteString("\n")
	}

	if len(rules) > 0 {
		sb.WriteString("## Applicable Building Rules\n")
		for _, rule := range rules {
			sb.WriteString(fmt.Sprintf("- [%s] %s (%s)\n", rule.Severity, rule.Description, rule.RuleCategory))
		}
	}

	return sb.String()
}

// computeQualityScore calculates a project quality score from edit session data.
// score = 0.30*(rating/5) + 0.40*compliance_ratio + 0.20*export_flag - 0.10*(ln(1+edits)/ln(1+200))
func computeQualityScore(session models.UserEdits, rating *int) float64 {
	var score float64

	if rating != nil && *rating >= 1 && *rating <= 5 {
		score += 0.30 * (float64(*rating) / 5.0)
	}

	// compliance_ratio: assume 1.0 since we don't re-run compliance here
	score += 0.40

	if session.ExportTriggered {
		score += 0.20
	}

	edits := float64(session.NumberOfEdits)
	score -= 0.10 * (math.Log(1+edits) / math.Log(1+200))

	if score < 0 {
		score = 0
	}
	if score > 1 {
		score = 1
	}
	return score
}

func countPassed(results []ComplianceResult) int {
	n := 0
	for _, r := range results {
		if r.Passed {
			n++
		}
	}
	return n
}

// writeRAGError writes a JSON error using the same envelope shape as writeError.
func writeRAGError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// normalizeJurisdiction maps natural-language country names and aliases to
// the short codes stored in the building_rules table (VN, US, etc.).
func normalizeJurisdiction(raw string) string {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "VN", "VIETNAM", "VIET NAM", "VIETNAMESE":
		return "VN"
	case "US", "USA", "UNITED STATES", "AMERICA", "IBC", "IRC":
		return "US"
	case "UK", "GB", "UNITED KINGDOM", "BRITAIN":
		return "UK"
	case "AU", "AUSTRALIA", "AUSTRALIAN":
		return "AU"
	case "EU", "EUROPE", "EUROPEAN":
		return "EU"
	case "INTL", "INTERNATIONAL", "NEUFERT", "ISO":
		return "INTL"
	case "":
		return "global"
	default:
		return raw
	}
}
