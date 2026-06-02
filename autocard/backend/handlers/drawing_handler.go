package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"autocard-backend/middleware"
	"autocard-backend/models"
	"autocard-backend/repository"

	"github.com/google/uuid"
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
		ID:       uuid.New().String(),
		UserID:   userID,
		Name:     req.Name,
		Data:     req.Data,
		ImageUrl: req.ImageUrl,
	}

	if err := h.drawingRepo.Create(drawing); err != nil {
		http.Error(w, `{"error":"failed to create drawing"}`, http.StatusInternalServerError)
		return
	}

	// Set owner permission
	perm := &models.Permission{
		ID:        uuid.New().String(),
		DrawingID: drawing.ID,
		UserID:    userID,
		Role:      "owner",
	}
	h.drawingRepo.SetPermission(perm)

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
	userID := r.Context().Value(middleware.UserIDKey).(string)

	// Check permission
	role, _ := h.drawingRepo.GetUserRole(id, userID)
	if role != "owner" && role != "editor" {
		http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
		return
	}

	var req models.SaveDrawingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if err := h.drawingRepo.Update(id, &req); err != nil {
		if err.Error() == "sql: no rows in result set" {
			http.Error(w, `{"error":"version conflict, please refresh"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"failed to update drawing"}`, http.StatusInternalServerError)
		return
	}

	// Save version history
	version := &models.VersionHistory{
		ID:        uuid.New().String(),
		DrawingID: id,
		Version:   req.Version + 1,
		Data:      req.Data,
		CreatedBy: userID,
	}
	h.drawingRepo.SaveVersion(version)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "drawing updated"})
}

func (h *DrawingHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := r.Context().Value(middleware.UserIDKey).(string)

	role, _ := h.drawingRepo.GetUserRole(id, userID)
	if role != "owner" {
		http.Error(w, `{"error":"only owner can delete"}`, http.StatusForbidden)
		return
	}

	if err := h.drawingRepo.Delete(id); err != nil {
		http.Error(w, `{"error":"failed to delete drawing"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "drawing deleted"})
}

func (h *DrawingHandler) Rename(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := r.Context().Value(middleware.UserIDKey).(string)

	role, _ := h.drawingRepo.GetUserRole(id, userID)
	if role != "owner" && role != "editor" {
		http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, `{"error":"drawing name is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.drawingRepo.UpdateName(id, req.Name); err != nil {
		http.Error(w, `{"error":"failed to rename drawing"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "drawing renamed successfully",
		"name":    req.Name,
	})
}

func (h *DrawingHandler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := r.Context().Value(middleware.UserIDKey).(string)

	role, _ := h.drawingRepo.GetUserRole(id, userID)
	if role != "owner" && role != "editor" {
		http.Error(w, `{"error":"permission denied"}`, http.StatusForbidden)
		return
	}

	// Parse multipart form (max 5MB)
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		http.Error(w, `{"error":"file too large or invalid multipart form"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("avatar")
	if err != nil {
		http.Error(w, `{"error":"avatar file is required"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		http.Error(w, `{"error":"failed to create upload directory"}`, http.StatusInternalServerError)
		return
	}

	ext := ""
	if idx := strings.LastIndex(header.Filename, "."); idx != -1 {
		ext = header.Filename[idx:]
	}
	validExt := false
	for _, e := range []string{".png", ".jpg", ".jpeg", ".svg", ".gif"} {
		if strings.ToLower(ext) == e {
			validExt = true
			break
		}
	}
	if !validExt {
		http.Error(w, `{"error":"invalid file extension, only PNG, JPG, JPEG, SVG, GIF allowed"}`, http.StatusBadRequest)
		return
	}

	filename := fmt.Sprintf("%s_avatar%s", id, ext)
	filePath := filepath.Join(uploadDir, filename)

	out, err := os.Create(filePath)
	if err != nil {
		http.Error(w, `{"error":"failed to save file"}`, http.StatusInternalServerError)
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		http.Error(w, `{"error":"failed to write file"}`, http.StatusInternalServerError)
		return
	}

	avatarURL := fmt.Sprintf("/uploads/%s", filename)
	if err := h.drawingRepo.UpdateAvatar(id, avatarURL); err != nil {
		http.Error(w, `{"error":"failed to save avatar to database"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message":   "avatar uploaded successfully",
		"image_url": avatarURL,
	})
}

// Version History endpoints
func (h *DrawingHandler) GetVersions(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	versions, err := h.drawingRepo.GetVersions(id)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch versions"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(versions)
}

func (h *DrawingHandler) GetVersion(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	versionStr := r.PathValue("version")
	version, err := strconv.Atoi(versionStr)
	if err != nil {
		http.Error(w, `{"error":"invalid version"}`, http.StatusBadRequest)
		return
	}

	v, err := h.drawingRepo.GetVersion(id, version)
	if err != nil {
		http.Error(w, `{"error":"version not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

// Comment endpoints
func (h *DrawingHandler) CreateComment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := r.Context().Value(middleware.UserIDKey).(string)

	var req struct {
		Message  string  `json:"message"`
		X        float64 `json:"x"`
		Y        float64 `json:"y"`
		ParentID *string `json:"parent_id,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Get username
	username := userID // fallback

	comment := &models.Comment{
		ID:        uuid.New().String(),
		DrawingID: id,
		UserID:    userID,
		Username:  username,
		X:         req.X,
		Y:         req.Y,
		Message:   req.Message,
		ParentID:  req.ParentID,
	}

	if err := h.drawingRepo.CreateComment(comment); err != nil {
		http.Error(w, `{"error":"failed to create comment"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(comment)
}

func (h *DrawingHandler) GetComments(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	comments, err := h.drawingRepo.GetComments(id)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch comments"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comments)
}

// Permission endpoints
func (h *DrawingHandler) Share(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := r.Context().Value(middleware.UserIDKey).(string)

	// Only owner can share
	role, _ := h.drawingRepo.GetUserRole(id, userID)
	if role != "owner" {
		http.Error(w, `{"error":"only owner can share"}`, http.StatusForbidden)
		return
	}

	var req struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Role != "editor" && req.Role != "viewer" {
		http.Error(w, `{"error":"role must be editor or viewer"}`, http.StatusBadRequest)
		return
	}

	perm := &models.Permission{
		ID:        uuid.New().String(),
		DrawingID: id,
		Email:     req.Email,
		Role:      req.Role,
	}

	if err := h.drawingRepo.SetPermission(perm); err != nil {
		http.Error(w, `{"error":"failed to set permission"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(perm)
}

func (h *DrawingHandler) GetPermissions(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	perms, err := h.drawingRepo.GetPermissions(id)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch permissions"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(perms)
}

func (h *DrawingHandler) RemovePermission(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := r.Context().Value(middleware.UserIDKey).(string)
	targetUserID := r.PathValue("userId")

	role, _ := h.drawingRepo.GetUserRole(id, userID)
	if role != "owner" {
		http.Error(w, `{"error":"only owner can remove permissions"}`, http.StatusForbidden)
		return
	}

	if err := h.drawingRepo.RemovePermission(id, targetUserID); err != nil {
		http.Error(w, `{"error":"failed to remove permission"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "permission removed"})
}
