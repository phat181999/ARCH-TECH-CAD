package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"autocard-backend/config"
	"autocard-backend/middleware"
	"autocard-backend/models"
	"autocard-backend/repository"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type MemberHandler struct {
	memberRepo *repository.MemberRepo
	orgRepo    *repository.OrganizationRepo
	cfg        *config.Config
}

func NewMemberHandler(memberRepo *repository.MemberRepo, orgRepo *repository.OrganizationRepo, cfg *config.Config) *MemberHandler {
	return &MemberHandler{
		memberRepo: memberRepo,
		orgRepo:    orgRepo,
		cfg:        cfg,
	}
}

func (h *MemberHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.MemberRegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	if req.Email == "" || req.Password == "" || req.Name == "" {
		http.Error(w, `{"error":"email, password, and name are required"}`, http.StatusBadRequest)
		return
	}

	// Password hashing
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"failed to hash password"}`, http.StatusInternalServerError)
		return
	}

	member := &models.Member{
		ID:            uuid.New().String(),
		Email:         req.Email,
		PasswordHash:  string(hash),
		Name:          req.Name,
		EmailVerified: true, // Auto-verify members for simple onboarding/invitation flow
		Provider:      "email",
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	// Check for duplicate email before hitting the DB constraint
	if existing, _ := h.memberRepo.FindByEmail(member.Email); existing != nil {
		http.Error(w, `{"error":"email already exists"}`, http.StatusConflict)
		return
	}

	if err := h.memberRepo.Create(member); err != nil {
		http.Error(w, `{"error":"failed to create account"}`, http.StatusInternalServerError)
		return
	}

	// Claim any pending invites
	if err := h.orgRepo.ClaimPendingInvites(member.Email, member.ID, true); err != nil {
		fmt.Printf("[CLAIM ERROR] Failed to claim pending invites for member: %v\n", err)
	}

	// If organization name is provided, create the organization
	if req.Org != "" {
		org := &models.Organization{
			ID:                  uuid.New().String(),
			Name:                req.Org,
			SubscriptionTier:    "free",
			SubscriptionExpires: nil,
			CreatedAt:           time.Now(),
			UpdatedAt:           time.Now(),
		}
		if err := h.orgRepo.Create(org, member.ID, true); err != nil {
			fmt.Printf("[ORG CREATE ERROR] Failed to create organization for member on register: %v\n", err)
		}
	}

	// Generate JWT session token
	jwtToken, err := middleware.GenerateToken(member.ID, "member", h.cfg.JWTSecret)
	if err != nil {
		http.Error(w, `{"error":"failed to generate token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"token":     jwtToken,
		"member":    member,
		"role_type": "member",
	})
}

func (h *MemberHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.MemberLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	member, err := h.memberRepo.FindByEmail(req.Email)
	if err != nil {
		http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
		return
	}

	// OAuth members have no password — direct them to their provider's login flow
	if member.Provider != "email" {
		http.Error(w, `{"error":"this account uses Google sign-in, please use the Google login button"}`, http.StatusUnauthorized)
		return
	}

	// Password check
	if err := bcrypt.CompareHashAndPassword([]byte(member.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
		return
	}

	// Claim any pending invites on login in case they were invited after signup
	if err := h.orgRepo.ClaimPendingInvites(member.Email, member.ID, true); err != nil {
		fmt.Printf("[CLAIM ERROR] Failed to claim pending invites for member on login: %v\n", err)
	}

	// Generate JWT session token
	jwtToken, err := middleware.GenerateToken(member.ID, "member", h.cfg.JWTSecret)
	if err != nil {
		http.Error(w, `{"error":"failed to generate token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"token":     jwtToken,
		"member":    member,
		"role_type": "member",
	})
}

func (h *MemberHandler) Me(w http.ResponseWriter, r *http.Request) {
	memberID, ok := r.Context().Value(middleware.MemberIDKey).(string)
	if !ok || memberID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	member, err := h.memberRepo.FindByID(memberID)
	if err != nil {
		http.Error(w, `{"error":"member not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(member)
}

func (h *MemberHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	memberID, ok := r.Context().Value(middleware.MemberIDKey).(string)
	if !ok || memberID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
		JobTitle  string `json:"job_title"`
		Phone     string `json:"phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	fields := make(map[string]interface{})
	if req.Name != "" {
		fields["name"] = strings.TrimSpace(req.Name)
	}
	if req.AvatarURL != "" {
		fields["avatar_url"] = req.AvatarURL
	}
	if req.JobTitle != "" {
		fields["job_title"] = req.JobTitle
	}
	if req.Phone != "" {
		fields["phone"] = req.Phone
	}
	fields["updated_at"] = time.Now()

	if err := h.memberRepo.Update(memberID, fields); err != nil {
		http.Error(w, `{"error":"failed to update profile"}`, http.StatusInternalServerError)
		return
	}

	member, err := h.memberRepo.FindByID(memberID)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch updated member profile"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(member)
}
