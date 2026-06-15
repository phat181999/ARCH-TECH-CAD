package handlers

import (
	"encoding/json"
	"net/http"

	"autocard-backend/middleware"
	"autocard-backend/models"
	"autocard-backend/repository"
)

type BlockHandler struct {
	blockRepo *repository.BlockRepo
}

func NewBlockHandler(blockRepo *repository.BlockRepo) *BlockHandler {
	return &BlockHandler{blockRepo: blockRepo}
}

func writeBlockError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func writeBlockJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

// ── GET /api/my-blocks ────────────────────────────────────────────────────────

func (h *BlockHandler) ListMyBlocks(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeBlockError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	blocks, err := h.blockRepo.ListByUser(userID)
	if err != nil {
		writeBlockError(w, http.StatusInternalServerError, "failed to fetch blocks: "+err.Error())
		return
	}
	writeBlockJSON(w, blocks)
}

// ── POST /api/my-blocks ───────────────────────────────────────────────────────

func (h *BlockHandler) CreateMyBlock(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeBlockError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var payload struct {
		Name        string              `json:"name"`
		Description string              `json:"description"`
		Category    string              `json:"category"`
		Tags        models.StringSlice  `json:"tags"`
		BlockDef    models.BlockDefJSON `json:"block_def"`
		PreviewSVG  string              `json:"preview_svg"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeBlockError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if payload.Name == "" {
		writeBlockError(w, http.StatusBadRequest, "name is required")
		return
	}
	if payload.Category == "" {
		payload.Category = "general"
	}
	if payload.Tags == nil {
		payload.Tags = models.StringSlice{}
	}

	block := &models.Block{
		UserID:      userID,
		Name:        payload.Name,
		Description: payload.Description,
		Category:    payload.Category,
		Tags:        payload.Tags,
		BlockDef:    payload.BlockDef,
		PreviewSVG:  payload.PreviewSVG,
	}
	if err := h.blockRepo.CreateForUser(block); err != nil {
		writeBlockError(w, http.StatusInternalServerError, "failed to save block: "+err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeBlockJSON(w, block)
}

// ── DELETE /api/my-blocks/{id} ───────────────────────────────────────────────

func (h *BlockHandler) DeleteMyBlock(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeBlockError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id := r.PathValue("id")
	if err := h.blockRepo.DeleteForUser(id, userID); err != nil {
		writeBlockError(w, http.StatusInternalServerError, "failed to delete block")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── GET /api/organizations/{id}/blocks ────────────────────────────────────────

func (h *BlockHandler) ListOrgBlocks(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")
	q := r.URL.Query().Get("q")
	blocks, err := h.blockRepo.ListByOrg(orgID, q)
	if err != nil {
		writeBlockError(w, http.StatusInternalServerError, "failed to fetch org blocks: "+err.Error())
		return
	}
	writeBlockJSON(w, blocks)
}

// ── POST /api/organizations/{id}/blocks ──────────────────────────────────────

func (h *BlockHandler) CreateOrgBlock(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeBlockError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	orgID := r.PathValue("id")
	var payload struct {
		Name        string              `json:"name"`
		Description string              `json:"description"`
		Category    string              `json:"category"`
		Tags        models.StringSlice  `json:"tags"`
		BlockDef    models.BlockDefJSON `json:"block_def"`
		PreviewSVG  string              `json:"preview_svg"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeBlockError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if payload.Name == "" {
		writeBlockError(w, http.StatusBadRequest, "name is required")
		return
	}
	if payload.Category == "" {
		payload.Category = "general"
	}
	if payload.Tags == nil {
		payload.Tags = models.StringSlice{}
	}

	block := &models.Block{
		UserID:         userID,
		OrganizationID: &orgID,
		Name:           payload.Name,
		Description:    payload.Description,
		Category:       payload.Category,
		Tags:           payload.Tags,
		BlockDef:       payload.BlockDef,
		PreviewSVG:     payload.PreviewSVG,
	}
	if err := h.blockRepo.CreateForOrg(block); err != nil {
		writeBlockError(w, http.StatusInternalServerError, "failed to save org block: "+err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeBlockJSON(w, block)
}

// ── PUT /api/organizations/{id}/blocks/{blockId}/publish ─────────────────────

func (h *BlockHandler) PublishOrgBlock(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")
	blockID := r.PathValue("blockId")
	var payload struct {
		IsPublished bool `json:"is_published"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeBlockError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if err := h.blockRepo.UpdateOrgBlock(blockID, orgID, map[string]interface{}{"is_published": payload.IsPublished}); err != nil {
		writeBlockError(w, http.StatusInternalServerError, "failed to update block")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── DELETE /api/organizations/{id}/blocks/{blockId} ───────────────────────────

func (h *BlockHandler) DeleteOrgBlock(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")
	blockID := r.PathValue("blockId")
	if err := h.blockRepo.DeleteOrgBlock(blockID, orgID); err != nil {
		writeBlockError(w, http.StatusInternalServerError, "failed to delete org block")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
