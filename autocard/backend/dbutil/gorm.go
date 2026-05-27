package dbutil

import (
	"io"
	"log"
	"time"

	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func NewGormConfig(writer io.Writer) *gorm.Config {
	return &gorm.Config{
		Logger: gormlogger.New(log.New(writer, "", log.LstdFlags), gormlogger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  gormlogger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		}),
	}
}
