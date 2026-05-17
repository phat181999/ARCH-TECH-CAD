package repository

import (
	"database/sql"
	"autocard-backend/models"
)

type UserRepo struct {
	db *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) Create(user *models.User) error {
	query := `INSERT INTO users (id, email, password_hash, name, email_verified, verification_token)
	           VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING created_at, updated_at`
	err := r.db.QueryRow(query, user.ID, user.Email, user.PasswordHash, user.Name, user.EmailVerified, user.VerificationToken).Scan(&user.CreatedAt, &user.UpdatedAt)
	return err
}

func (r *UserRepo) FindByEmail(email string) (*models.User, error) {
	user := &models.User{}
	query := `SELECT id, email, password_hash, name, email_verified, verification_token, created_at, updated_at
	           FROM users WHERE email = $1`
	err := r.db.QueryRow(query, email).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.Name,
		&user.EmailVerified, &user.VerificationToken, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepo) FindByVerificationToken(token string) (*models.User, error) {
	user := &models.User{}
	query := `SELECT id, email, password_hash, name, email_verified, verification_token, created_at, updated_at
	           FROM users WHERE verification_token = $1`
	err := r.db.QueryRow(query, token).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.Name,
		&user.EmailVerified, &user.VerificationToken, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepo) VerifyEmail(userID string) error {
	query := `UPDATE users SET email_verified = TRUE, verification_token = NULL, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(query, userID)
	return err
}

func (r *UserRepo) FindByID(id string) (*models.User, error) {
	user := &models.User{}
	query := `SELECT id, email, password_hash, name, email_verified, verification_token, created_at, updated_at
	           FROM users WHERE id = $1`
	err := r.db.QueryRow(query, id).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.Name,
		&user.EmailVerified, &user.VerificationToken, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}
