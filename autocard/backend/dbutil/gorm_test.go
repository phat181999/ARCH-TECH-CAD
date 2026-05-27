package dbutil

import (
	"bytes"
	"context"
	"errors"
	"testing"
	"time"

	"gorm.io/gorm"
)

func TestNewGormConfigIgnoresRecordNotFound(t *testing.T) {
	var buf bytes.Buffer

	cfg := NewGormConfig(&buf)

	cfg.Logger.Trace(context.Background(), time.Now(), func() (string, int64) {
		return `SELECT * FROM "users" WHERE email = 'user@example.com'`, 0
	}, gorm.ErrRecordNotFound)

	if buf.Len() != 0 {
		t.Fatalf("expected record-not-found trace to be suppressed, got log output %q", buf.String())
	}
}

func TestNewGormConfigStillLogsRealErrors(t *testing.T) {
	var buf bytes.Buffer

	cfg := NewGormConfig(&buf)

	cfg.Logger.Trace(context.Background(), time.Now(), func() (string, int64) {
		return `SELECT * FROM "users"`, 0
	}, errors.New("database offline"))

	if buf.Len() == 0 {
		t.Fatal("expected non-record-not-found errors to be logged")
	}
}
