package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"autocard-backend/middleware"
	"autocard-backend/models"
	"autocard-backend/repository"

	"github.com/google/uuid"
)

type OrganizationHandler struct {
	repo *repository.OrganizationRepo
}

func NewOrganizationHandler(repo *repository.OrganizationRepo) *OrganizationHandler {
	return &OrganizationHandler{repo: repo}
}

func (h *OrganizationHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, isMember, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req models.CreateOrganizationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		http.Error(w, `{"error":"organization name is required"}`, http.StatusBadRequest)
		return
	}

	org := &models.Organization{
		ID:                  uuid.New().String(),
		Name:                req.Name,
		SubscriptionTier:    "free",
		SubscriptionExpires: nil,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	if err := h.repo.Create(org, userID, isMember); err != nil {
		http.Error(w, `{"error":"failed to create organization"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(org)
}

func (h *OrganizationHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	orgs, err := h.repo.GetUserOrganizations(userID)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch organizations"}`, http.StatusInternalServerError)
		return
	}

	if orgs == nil {
		orgs = []models.Organization{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orgs)
}

func (h *OrganizationHandler) GetMembers(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")

	res, err := h.repo.GetMembersAndInvites(orgID)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch members"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func (h *OrganizationHandler) Invite(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")
	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req models.InviteMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" {
		http.Error(w, `{"error":"email is required"}`, http.StatusBadRequest)
		return
	}

	role := strings.ToLower(req.Role)
	if role != "owner" && role != "editor" && role != "viewer" {
		http.Error(w, `{"error":"invalid role, must be owner, editor, or viewer"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.InviteMember(orgID, req.Email, role, userID); err != nil {
		http.Error(w, `{"error":"failed to store invitation in Redis"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "invitation sent successfully",
		"email":   req.Email,
		"role":    role,
	})
}

func (h *OrganizationHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")
	targetUserID := r.PathValue("userId")

	if err := h.repo.RemoveMember(orgID, targetUserID); err != nil {
		http.Error(w, `{"error":"failed to remove member"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "member removed successfully"})
}

func (h *OrganizationHandler) RemoveInvitation(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")
	email := r.URL.Query().Get("email")

	if email == "" {
		http.Error(w, `{"error":"email parameter is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.RemoveInvitation(orgID, email); err != nil {
		http.Error(w, `{"error":"failed to delete invitation"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "invitation cancelled successfully"})
}

func (h *OrganizationHandler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")
	targetUserID := r.PathValue("userId")

	var req struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	role := strings.ToLower(req.Role)
	if role != "owner" && role != "editor" && role != "viewer" {
		http.Error(w, `{"error":"invalid role, must be owner, editor, or viewer"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.UpdateMemberRole(orgID, targetUserID, role); err != nil {
		http.Error(w, `{"error":"failed to update role"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "role updated successfully"})
}

func (h *OrganizationHandler) Update(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")

	var req struct {
		Name     string `json:"name"`
		ImageOrg string `json:"image_org"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, `{"error":"organization name is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.UpdateOrganization(orgID, req.Name, req.ImageOrg); err != nil {
		http.Error(w, `{"error":"failed to update organization"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message":   "organization updated successfully",
		"name":      req.Name,
		"image_org": req.ImageOrg,
	})
}

func (h *OrganizationHandler) UploadLogo(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("id")

	// Parse multipart form (max 5MB)
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		http.Error(w, `{"error":"file too large or invalid multipart form"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("logo")
	if err != nil {
		http.Error(w, `{"error":"logo file is required"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Ensure uploads directory exists
	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		http.Error(w, `{"error":"failed to create upload directory"}`, http.StatusInternalServerError)
		return
	}

	// Generate safe unique filename
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

	filename := fmt.Sprintf("%s_logo%s", orgID, ext)
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

	// Save to DB
	logoURL := fmt.Sprintf("/uploads/%s", filename)
	if err := h.repo.UpdateLogo(orgID, logoURL); err != nil {
		http.Error(w, `{"error":"failed to save logo to database"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message":   "logo uploaded successfully",
		"image_org": logoURL,
	})
}
