package services

import (
	"context"
	"log/slog"
	"time"

	"autocard-backend/models"
	"autocard-backend/repository"

	"github.com/redis/go-redis/v9"
)

const jobQueueKey = "autocard:analysis_jobs"

// JobWorker pulls analysis job IDs from Redis and processes them.
type JobWorker struct {
	rdb         *redis.Client
	jobRepo     *repository.AnalysisJobRepo
	drawingRepo *repository.DrawingRepo
	analyzer    *DrawingAnalyzer
}

func NewJobWorker(
	rdb *redis.Client,
	jobRepo *repository.AnalysisJobRepo,
	drawingRepo *repository.DrawingRepo,
	analyzer *DrawingAnalyzer,
) *JobWorker {
	return &JobWorker{
		rdb:         rdb,
		jobRepo:     jobRepo,
		drawingRepo: drawingRepo,
		analyzer:    analyzer,
	}
}

// EnqueueJob pushes a job ID onto the Redis list for the worker to pick up.
func EnqueueJob(rdb *redis.Client, jobID string) error {
	return rdb.LPush(context.Background(), jobQueueKey, jobID).Err()
}

// Start launches `concurrency` worker goroutines. Call once at startup.
// Cancel ctx to shut down gracefully.
func (w *JobWorker) Start(ctx context.Context, concurrency int) {
	for i := 0; i < concurrency; i++ {
		go w.runLoop(ctx)
	}
	slog.Info("Job workers started", "concurrency", concurrency)
}

func (w *JobWorker) runLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		// Blocking pop with 5s timeout so we can check ctx cancellation
		result, err := w.rdb.BRPop(ctx, 5*time.Second, jobQueueKey).Result()
		if err != nil {
			continue
		}
		if len(result) < 2 {
			continue
		}
		w.process(ctx, result[1])
	}
}

func (w *JobWorker) process(ctx context.Context, jobID string) {
	job, err := w.jobRepo.FindByID(jobID)
	if err != nil {
		slog.Error("Worker: job not found", "job_id", jobID, "error", err)
		return
	}

	if err := w.jobRepo.SetRunning(jobID); err != nil {
		slog.Error("Worker: failed to set running", "job_id", jobID, "error", err)
		return
	}

	drawing, err := w.drawingRepo.FindByID(job.DrawingID)
	if err != nil {
		_ = w.jobRepo.SetError(jobID, "drawing not found: "+err.Error())
		return
	}

	result, err := w.analyzer.Analyze(job.DrawingID, drawing.Data)
	if err != nil {
		slog.Error("Worker: analysis failed", "job_id", jobID, "error", err)
		_ = w.jobRepo.SetError(jobID, err.Error())
		return
	}

	bimJSON, err := models.BIMResultJSON(result)
	if err != nil {
		_ = w.jobRepo.SetError(jobID, "marshal BIM result: "+err.Error())
		return
	}

	if err := w.jobRepo.SaveBIMResult(job.DrawingID, bimJSON); err != nil {
		_ = w.jobRepo.SetError(jobID, "save BIM result: "+err.Error())
		return
	}

	if err := w.jobRepo.SetDone(jobID); err != nil {
		slog.Error("Worker: failed to set done", "job_id", jobID, "error", err)
	}

	slog.Info("Worker: analysis complete", "job_id", jobID, "drawing_id", job.DrawingID)
}
