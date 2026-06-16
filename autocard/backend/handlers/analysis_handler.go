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
