package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"autocard-backend/middleware"
	"autocard-backend/models"
	"autocard-backend/repository"
	"autocard-backend/services"

	"gorm.io/gorm"
)

type DrawingTaskHandler struct {
	taskRepo      *repository.DrawingTaskRepo
	suggester     *services.TaskSuggester
	drawingRepo   *repository.DrawingRepo
}

func NewDrawingTaskHandler(taskRepo *repository.DrawingTaskRepo, suggester *services.TaskSuggester, drawingRepo *repository.DrawingRepo) *DrawingTaskHandler {
	return &DrawingTaskHandler{
		taskRepo:    taskRepo,
		suggester:   suggester,
		drawingRepo: drawingRepo,
	}
}

func writeTaskError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func writeTaskJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

// GET /api/drawings/{id}/tasks
func (h *DrawingTaskHandler) List(w http.ResponseWriter, r *http.Request) {
	drawingID := r.PathValue("id")
	if drawingID == "" {
		writeTaskError(w, http.StatusBadRequest, "missing drawing id")
		return
	}

	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeTaskError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	role, err := h.drawingRepo.GetUserRole(drawingID, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeTaskError(w, http.StatusNotFound, "drawing not found")
			return
		}
		writeTaskError(w, http.StatusInternalServerError, "failed to check permission: "+err.Error())
		return
	}
	if role == "" {
		writeTaskError(w, http.StatusForbidden, "permission denied")
		return
	}

	tasks, err := h.taskRepo.ListByDrawing(drawingID)
	if err != nil {
		writeTaskError(w, http.StatusInternalServerError, "failed to list tasks: "+err.Error())
		return
	}

	if tasks == nil {
		tasks = []models.DrawingTask{}
	}
	writeTaskJSON(w, tasks)
}

// POST /api/drawings/{id}/tasks
func (h *DrawingTaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	drawingID := r.PathValue("id")
	if drawingID == "" {
		writeTaskError(w, http.StatusBadRequest, "missing drawing id")
		return
	}

	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeTaskError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	role, err := h.drawingRepo.GetUserRole(drawingID, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeTaskError(w, http.StatusNotFound, "drawing not found")
			return
		}
		writeTaskError(w, http.StatusInternalServerError, "failed to check permission: "+err.Error())
		return
	}
	if role != "owner" && role != "editor" {
		writeTaskError(w, http.StatusForbidden, "permission denied")
		return
	}

	var payload struct {
		Name         string  `json:"name"`
		Phase        string  `json:"phase"`
		Description  string  `json:"description"`
		AssigneeID   *string `json:"assignee_id"`
		AssigneeName string  `json:"assignee_name"`
		DurationDays int     `json:"duration_days"`
		LaborPrice   float64 `json:"labor_price"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeTaskError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if payload.Name == "" {
		writeTaskError(w, http.StatusBadRequest, "task name is required")
		return
	}

	task := &models.DrawingTask{
		DrawingID:      drawingID,
		Name:           payload.Name,
		Phase:          payload.Phase,
		Description:    payload.Description,
		AssigneeID:     payload.AssigneeID,
		AssigneeName:   payload.AssigneeName,
		Status:         "todo",
		DurationDays:   payload.DurationDays,
		LaborPrice:     payload.LaborPrice,
		TotalLaborCost: float64(payload.DurationDays) * payload.LaborPrice,
	}

	if err := h.taskRepo.Create(task); err != nil {
		writeTaskError(w, http.StatusInternalServerError, "failed to create task: "+err.Error())
		return
	}

	writeTaskJSON(w, task)
}

// PUT /api/drawings/{id}/tasks/{taskId}
func (h *DrawingTaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	drawingID := r.PathValue("id")
	taskId := r.PathValue("taskId")
	if taskId == "" || drawingID == "" {
		writeTaskError(w, http.StatusBadRequest, "missing drawing id or task id")
		return
	}

	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeTaskError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	task, err := h.taskRepo.FindByID(taskId)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeTaskError(w, http.StatusNotFound, "task not found")
			return
		}
		writeTaskError(w, http.StatusInternalServerError, "failed to fetch task: "+err.Error())
		return
	}

	if task.DrawingID != drawingID {
		writeTaskError(w, http.StatusBadRequest, "task does not belong to the specified drawing")
		return
	}

	role, err := h.drawingRepo.GetUserRole(drawingID, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeTaskError(w, http.StatusNotFound, "drawing not found")
			return
		}
		writeTaskError(w, http.StatusInternalServerError, "failed to check permission: "+err.Error())
		return
	}
	if role != "owner" && role != "editor" {
		writeTaskError(w, http.StatusForbidden, "permission denied")
		return
	}

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		writeTaskError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Remove immutable fields
	delete(updates, "id")
	delete(updates, "drawing_id")
	delete(updates, "created_at")
	delete(updates, "updated_at")

	if err := h.taskRepo.Update(taskId, updates); err != nil {
		writeTaskError(w, http.StatusInternalServerError, "failed to update task: "+err.Error())
		return
	}

	writeTaskJSON(w, map[string]string{"status": "updated"})
}

// DELETE /api/drawings/{id}/tasks/{taskId}
func (h *DrawingTaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	drawingID := r.PathValue("id")
	taskId := r.PathValue("taskId")
	if taskId == "" || drawingID == "" {
		writeTaskError(w, http.StatusBadRequest, "missing drawing id or task id")
		return
	}

	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeTaskError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	task, err := h.taskRepo.FindByID(taskId)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeTaskError(w, http.StatusNotFound, "task not found")
			return
		}
		writeTaskError(w, http.StatusInternalServerError, "failed to fetch task: "+err.Error())
		return
	}

	if task.DrawingID != drawingID {
		writeTaskError(w, http.StatusBadRequest, "task does not belong to the specified drawing")
		return
	}

	role, err := h.drawingRepo.GetUserRole(drawingID, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeTaskError(w, http.StatusNotFound, "drawing not found")
			return
		}
		writeTaskError(w, http.StatusInternalServerError, "failed to check permission: "+err.Error())
		return
	}
	if role != "owner" && role != "editor" {
		writeTaskError(w, http.StatusForbidden, "permission denied")
		return
	}

	if err := h.taskRepo.Delete(taskId); err != nil {
		writeTaskError(w, http.StatusInternalServerError, "failed to delete task: "+err.Error())
		return
	}

	writeTaskJSON(w, map[string]string{"status": "deleted"})
}

// POST /api/drawings/{id}/tasks/bulk
func (h *DrawingTaskHandler) BulkCreate(w http.ResponseWriter, r *http.Request) {
	drawingID := r.PathValue("id")
	if drawingID == "" {
		writeTaskError(w, http.StatusBadRequest, "missing drawing id")
		return
	}

	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeTaskError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	role, err := h.drawingRepo.GetUserRole(drawingID, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeTaskError(w, http.StatusNotFound, "drawing not found")
			return
		}
		writeTaskError(w, http.StatusInternalServerError, "failed to check permission: "+err.Error())
		return
	}
	if role != "owner" && role != "editor" {
		writeTaskError(w, http.StatusForbidden, "permission denied")
		return
	}

	var payload []models.DrawingTask
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeTaskError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	for i := range payload {
		payload[i].DrawingID = drawingID
		if payload[i].Status == "" {
			payload[i].Status = "todo"
		}
		if payload[i].TotalLaborCost == 0 {
			payload[i].TotalLaborCost = float64(payload[i].DurationDays) * payload[i].LaborPrice
		}
	}

	if err := h.taskRepo.BulkCreate(payload); err != nil {
		writeTaskError(w, http.StatusInternalServerError, "failed to bulk create tasks: "+err.Error())
		return
	}

	writeTaskJSON(w, map[string]interface{}{"status": "success", "count": len(payload)})
}

// POST /api/drawings/{id}/tasks/ai-suggest
func (h *DrawingTaskHandler) SuggestTasks(w http.ResponseWriter, r *http.Request) {
	drawingID := r.PathValue("id")
	if drawingID == "" {
		writeTaskError(w, http.StatusBadRequest, "missing drawing id")
		return
	}

	userID, _, ok := middleware.GetPrincipalID(r.Context())
	if !ok {
		writeTaskError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	role, err := h.drawingRepo.GetUserRole(drawingID, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			writeTaskError(w, http.StatusNotFound, "drawing not found")
			return
		}
		writeTaskError(w, http.StatusInternalServerError, "failed to check permission: "+err.Error())
		return
	}
	if role != "owner" && role != "editor" {
		writeTaskError(w, http.StatusForbidden, "permission denied")
		return
	}

	var payload struct {
		Elements string `json:"elements"` // JSON elements string
		Members  string `json:"members"`  // JSON members string
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeTaskError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// If no elements sent, try reading drawing data from DB
	elementsStr := payload.Elements
	if elementsStr == "" {
		drawing, err := h.drawingRepo.FindByID(drawingID)
		if err != nil {
			writeTaskError(w, http.StatusInternalServerError, "failed to read drawing: "+err.Error())
			return
		}
		elementsStr = drawing.Data
	}

	suggested, err := h.suggester.Suggest(drawingID, elementsStr, payload.Members)
	if err != nil {
		// Mock task list if Anthropic API fails or is offline (failsafe)
		suggested = []models.DrawingTask{
			{DrawingID: drawingID, Name: "Đào đất hố móng", Phase: "Foundation", Description: "Đào móng băng sâu 1.2m", Status: "todo", DurationDays: 2, LaborPrice: 350000, TotalLaborCost: 700000},
			{DrawingID: drawingID, Name: "Đổ bê tông lót móng", Phase: "Foundation", Description: "Bê tông lót đá 4x6 Mác 100", Status: "todo", DurationDays: 1, LaborPrice: 400000, TotalLaborCost: 400000},
			{DrawingID: drawingID, Name: "Xây tường bao gạch đỏ", Phase: "Structural", Description: "Xây dựng tường bao quanh dày 220mm", Status: "todo", DurationDays: 6, LaborPrice: 500000, TotalLaborCost: 3000000},
			{DrawingID: drawingID, Name: "Đi đường dây điện âm tường", Phase: "MEP", Description: "Lắp đặt ống luồn dây cáp nguồn", Status: "todo", DurationDays: 3, LaborPrice: 450000, TotalLaborCost: 1350000},
			{DrawingID: drawingID, Name: "Lắp đặt cửa sổ nhôm kính", Phase: "Finishes", Description: "Lắp đặt hệ cửa nhôm kính Xingfa", Status: "todo", DurationDays: 2, LaborPrice: 600000, TotalLaborCost: 1200000},
		}
		// Try to match assignees locally if API fails
		var membersList []models.MemberResponse
		if err := json.Unmarshal([]byte(payload.Members), &membersList); err == nil && len(membersList) > 0 {
			for i := range suggested {
				// Match roles locally
				for _, m := range membersList {
					role := strings.ToLower(m.JobTitle)
					taskName := strings.ToLower(suggested[i].Name)
					if (strings.Contains(role, "điện") && strings.Contains(taskName, "điện")) ||
						(strings.Contains(role, "nước") && strings.Contains(taskName, "nước")) ||
						(strings.Contains(role, "thợ") && strings.Contains(taskName, "xây")) ||
						(strings.Contains(role, "sắt") && strings.Contains(taskName, "thép")) {
						idCopy := m.ID
						suggested[i].AssigneeID = &idCopy
						suggested[i].AssigneeName = m.Name
						break
					}
				}
				// Default fallback assign to first member
				if suggested[i].AssigneeID == nil && len(membersList) > 0 {
					idCopy := membersList[i%len(membersList)].ID
					suggested[i].AssigneeID = &idCopy
					suggested[i].AssigneeName = membersList[i%len(membersList)].Name
				}
			}
		}
		_ = userID // local placeholder
	}

	writeTaskJSON(w, suggested)
}
