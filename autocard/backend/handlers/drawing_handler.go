package handlers

import (
	"encoding/json"
	"net/http"

	"autocard-backend/middleware"
	"autocard-backend/models"
	"autocard-backend/repository"
)

type DrawingHandler struct {
	drawingRepo *repository.DrawingRepo
}

func NewDrawingHandler(drawingRepo *repository.DrawingRepo) *DrawingHandler {
	return &DrawingHandler{drawingRepo: drawingRepo}
}

func (h *DrawingHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(string)

	drawings, err := h.drawingRepo.FindByUserID(userID)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch drawings"}`, http.StatusInternalServerError)
		return
	}

	if drawings == nil {
		drawings = []models.Drawing{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(drawings)
}

func (h *DrawingHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(string)

	var req models.SaveDrawingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	drawing := &models.Drawing{
		ID:     generateUUID(),
		UserID: userID,
		Name:   req.Name,
		Data:   req.Data,
	}

	if err := h.drawingRepo.Create(drawing); err != nil {
		http.Error(w, `{"error":"failed to create drawing"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(drawing)
}

func (h *DrawingHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	drawing, err := h.drawingRepo.FindByID(id)
	if err != nil {
		http.Error(w, `{"error":"drawing not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(drawing)
}

func (h *DrawingHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req models.SaveDrawingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if err := h.drawingRepo.Update(id, &req); err != nil {
		http.Error(w, `{"error":"failed to update drawing"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "drawing updated"})
}

func (h *DrawingHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if err := h.drawingRepo.Delete(id); err != nil {
		http.Error(w, `{"error":"failed to delete drawing"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "drawing deleted"})
}
