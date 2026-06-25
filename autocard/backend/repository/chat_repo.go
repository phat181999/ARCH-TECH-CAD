package repository

import (
	"autocard-backend/models"

	"gorm.io/gorm"
)

type ChatRepo struct {
	db *gorm.DB
}

func NewChatRepo(db *gorm.DB) *ChatRepo {
	return &ChatRepo{db: db}
}

// ── Sessions ──────────────────────────────────────────────────────────────────

// ListSessions returns all sessions for a user, ordered by most recently updated.
func (r *ChatRepo) ListSessions(userID string) ([]models.ChatSession, error) {
	var sessions []models.ChatSession
	err := r.db.Where("user_id = ?", userID).Order("updated_at DESC").Find(&sessions).Error
	return sessions, err
}

// CreateSession creates a new chat session.
func (r *ChatRepo) CreateSession(session *models.ChatSession) error {
	return r.db.Create(session).Error
}

// GetSession returns a single session by ID, scoped to a user.
func (r *ChatRepo) GetSession(sessionID, userID string) (*models.ChatSession, error) {
	var session models.ChatSession
	err := r.db.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// DeleteSession deletes a session and its messages (cascade via FK).
func (r *ChatRepo) DeleteSession(sessionID, userID string) error {
	return r.db.Where("id = ? AND user_id = ?", sessionID, userID).Delete(&models.ChatSession{}).Error
}

// UpdateSessionTitle updates the title of a session.
func (r *ChatRepo) UpdateSessionTitle(sessionID, userID, title string) error {
	return r.db.Model(&models.ChatSession{}).Where("id = ? AND user_id = ?", sessionID, userID).
		Update("title", title).Error
}

// TouchSession bumps the updated_at timestamp for a session.
func (r *ChatRepo) TouchSession(sessionID string) error {
	return r.db.Model(&models.ChatSession{}).Where("id = ?", sessionID).
		UpdateColumn("updated_at", gorm.Expr("NOW()")).Error
}

// ── Messages ──────────────────────────────────────────────────────────────────

// ListMessages returns all messages for a session, ordered by creation time.
func (r *ChatRepo) ListMessages(sessionID string) ([]models.ChatMessage, error) {
	var messages []models.ChatMessage
	err := r.db.Where("session_id = ?", sessionID).Order("created_at ASC").Find(&messages).Error
	return messages, err
}

// CreateMessage inserts a new message into the database.
func (r *ChatRepo) CreateMessage(msg *models.ChatMessage) error {
	return r.db.Create(msg).Error
}
