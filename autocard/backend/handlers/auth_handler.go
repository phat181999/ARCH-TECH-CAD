package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"time"

	"autocard-backend/config"
	"autocard-backend/middleware"
	"autocard-backend/models"
	"autocard-backend/repository"

	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	userRepo *repository.UserRepo
	orgRepo  *repository.OrganizationRepo
	cfg      *config.Config
}

func NewAuthHandler(userRepo *repository.UserRepo, orgRepo *repository.OrganizationRepo, cfg *config.Config) *AuthHandler {
	return &AuthHandler{userRepo: userRepo, orgRepo: orgRepo, cfg: cfg}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, `{"error":"email and password are required"}`, http.StatusBadRequest)
		return
	}

	if len(req.Password) < 6 {
		http.Error(w, `{"error":"password must be at least 6 characters"}`, http.StatusBadRequest)
		return
	}

	existing, _ := h.userRepo.FindByEmail(req.Email)
	if existing != nil {
		http.Error(w, `{"error":"email already registered"}`, http.StatusConflict)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"failed to hash password"}`, http.StatusInternalServerError)
		return
	}

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		http.Error(w, `{"error":"failed to generate verification token"}`, http.StatusInternalServerError)
		return
	}
	verificationToken := hex.EncodeToString(tokenBytes)

	user := &models.User{
		ID:                generateUUID(),
		Email:             req.Email,
		PasswordHash:      string(hash),
		Name:              req.Name,
		EmailVerified:     false,
		VerificationToken: verificationToken,
	}

	if err := h.userRepo.Create(user); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"failed to create user: %s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	// 1. Claim any pending invites for this email
	if err := h.orgRepo.ClaimPendingInvites(user.Email, user.ID); err != nil {
		fmt.Printf("[CLAIM ERROR] Failed to claim pending invites on register: %v\n", err)
	}

	// 2. If organization name is provided, create the organization
	if req.Org != "" {
		org := &models.Organization{
			ID:                  generateUUID(),
			Name:                req.Org,
			SubscriptionTier:    "free",
			SubscriptionExpires: nil,
			CreatedAt:           time.Now(),
			UpdatedAt:           time.Now(),
		}
		if err := h.orgRepo.Create(org, user.ID); err != nil {
			fmt.Printf("[ORG CREATE ERROR] Failed to create organization on register: %v\n", err)
		}
	}

	go h.sendVerificationEmail(user.Email, verificationToken)

	jwtToken, err := middleware.GenerateToken(user.ID, h.cfg.JWTSecret)
	if err != nil {
		http.Error(w, `{"error":"failed to generate token"}`, http.StatusInternalServerError)
		return
	}

	resp := models.AuthResponse{
		Token: jwtToken,
		User:  *user,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	user, err := h.userRepo.FindByEmail(req.Email)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
			return
		}
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
		return
	}

	// Claim any pending invites on login in case they were invited after signup
	if err := h.orgRepo.ClaimPendingInvites(user.Email, user.ID); err != nil {
		fmt.Printf("[CLAIM ERROR] Failed to claim pending invites on login: %v\n", err)
	}

	jwtToken, err := middleware.GenerateToken(user.ID, h.cfg.JWTSecret)
	if err != nil {
		http.Error(w, `{"error":"failed to generate token"}`, http.StatusInternalServerError)
		return
	}

	resp := models.AuthResponse{
		Token: jwtToken,
		User:  *user,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *AuthHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req models.VerifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	user, err := h.userRepo.FindByVerificationToken(req.Token)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"invalid or expired verification token"}`, http.StatusBadRequest)
			return
		}
		http.Error(w, `{"error":"database error"}`, http.StatusInternalServerError)
		return
	}

	if err := h.userRepo.VerifyEmail(user.ID); err != nil {
		http.Error(w, `{"error":"failed to verify email"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "email verified successfully"})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(string)

	user, err := h.userRepo.FindByID(userID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (h *AuthHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.UserIDKey).(string)

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	prefsBytes, err := json.Marshal(body)
	if err != nil {
		http.Error(w, `{"error":"failed to encode preferences"}`, http.StatusInternalServerError)
		return
	}

	if err := h.userRepo.UpdatePreferences(userID, string(prefsBytes)); err != nil {
		http.Error(w, `{"error":"failed to update preferences"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "preferences updated"})
}

func (h *AuthHandler) sendVerificationEmail(to, token string) {
	if h.cfg.SMTPUser == "" || h.cfg.SMTPPass == "" {
		fmt.Printf("[DEV] Verification email to %s: token=%s\n", to, token)
		return
	}

	auth := smtp.PlainAuth("", h.cfg.SMTPUser, h.cfg.SMTPPass, h.cfg.SMTPHost)
	verifyURL := h.cfg.AppURL + "/verify-email?token=" + token

	subject := "Subject: Verify your AutoCard account\n"
	mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
	body := fmt.Sprintf("<h1>Welcome to AutoCard!</h1>\n<p>Click the link below to verify your email address:</p>\n<p><a href=\"%s\">%s</a></p>\n<p>If you did not create an account, please ignore this email.</p>", verifyURL, verifyURL)

	msg := []byte(subject + mime + body)
	err := smtp.SendMail(h.cfg.SMTPHost+":"+h.cfg.SMTPPort, auth, h.cfg.FromEmail, []string{to}, msg)
	if err != nil {
		fmt.Printf("[EMAIL ERROR] Failed to send verification email to %s: %v\n", to, err)
	}
}

func generateUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
