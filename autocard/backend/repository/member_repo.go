package repository

import (
	"autocard-backend/models"
	"database/sql"
	"gorm.io/gorm"
)

type MemberRepo struct {
	db *gorm.DB
}

func NewMemberRepo(db *gorm.DB) *MemberRepo {
	return &MemberRepo{db: db}
}

func (r *MemberRepo) Create(member *models.Member) error {
	return r.db.Create(member).Error
}

func (r *MemberRepo) FindByEmail(email string) (*models.Member, error) {
	var member models.Member
	err := r.db.Where("email = ?", email).First(&member).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, sql.ErrNoRows
		}
		return nil, err
	}
	return &member, nil
}

func (r *MemberRepo) FindByID(id string) (*models.Member, error) {
	var member models.Member
	err := r.db.Where("id = ?", id).First(&member).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, sql.ErrNoRows
		}
		return nil, err
	}
	return &member, nil
}

func (r *MemberRepo) Update(id string, fields map[string]interface{}) error {
	return r.db.Model(&models.Member{}).Where("id = ?", id).Updates(fields).Error
}
