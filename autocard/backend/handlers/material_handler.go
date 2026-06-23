package handlers

import (
	"encoding/json"
	"net/http"

	"autocard-backend/middleware"
	"autocard-backend/models"
	"autocard-backend/repository"
)

type MaterialHandler struct {
	materialRepo *repository.MaterialRepo
}

func NewMaterialHandler(materialRepo *repository.MaterialRepo) *MaterialHandler {
	return &MaterialHandler{materialRepo: materialRepo}
}

func writeMaterialError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func writeMaterialJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

// GET /api/materials
func (h *MaterialHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeMaterialError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	materials, err := h.materialRepo.ListByUser(userID)
	if err != nil {
		writeMaterialError(w, http.StatusInternalServerError, "failed to list materials: "+err.Error())
		return
	}
	writeMaterialJSON(w, materials)
}

// POST /api/materials
func (h *MaterialHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeMaterialError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var payload struct {
		Name        string  `json:"name"`
		Unit        string  `json:"unit"`
		UnitPrice   float64 `json:"unit_price"`
		Category    string  `json:"category"`
		Description string  `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeMaterialError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if payload.Name == "" || payload.Unit == "" {
		writeMaterialError(w, http.StatusBadRequest, "name and unit are required")
		return
	}

	material := &models.Material{
		UserID:      userID,
		Name:        payload.Name,
		Unit:        payload.Unit,
		UnitPrice:   payload.UnitPrice,
		Category:    payload.Category,
		Description: payload.Description,
	}

	if err := h.materialRepo.Create(material); err != nil {
		writeMaterialError(w, http.StatusInternalServerError, "failed to create material: "+err.Error())
		return
	}

	writeMaterialJSON(w, material)
}

// PUT /api/materials/{id}
func (h *MaterialHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeMaterialError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := r.PathValue("id")
	if id == "" {
		writeMaterialError(w, http.StatusBadRequest, "missing material id")
		return
	}

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		writeMaterialError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Remove fields that should not be updated directly
	delete(updates, "id")
	delete(updates, "user_id")
	delete(updates, "created_at")
	delete(updates, "updated_at")

	if err := h.materialRepo.Update(id, userID, updates); err != nil {
		writeMaterialError(w, http.StatusInternalServerError, "failed to update material: "+err.Error())
		return
	}

	writeMaterialJSON(w, map[string]string{"status": "updated"})
}

// DELETE /api/materials/{id}
func (h *MaterialHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeMaterialError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := r.PathValue("id")
	if id == "" {
		writeMaterialError(w, http.StatusBadRequest, "missing material id")
		return
	}

	if err := h.materialRepo.Delete(id, userID); err != nil {
		writeMaterialError(w, http.StatusInternalServerError, "failed to delete material: "+err.Error())
		return
	}

	writeMaterialJSON(w, map[string]string{"status": "deleted"})
}
