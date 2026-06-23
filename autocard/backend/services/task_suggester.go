package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"autocard-backend/models"
)

type TaskSuggester struct {
	apiKey string
	client *http.Client
}

func NewTaskSuggester(apiKey string) *TaskSuggester {
	return &TaskSuggester{
		apiKey: apiKey,
		client: &http.Client{Timeout: 90 * time.Second},
	}
}

type suggestRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system"`
	Messages  []suggestMessage   `json:"messages"`
}

type suggestMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type suggestResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (s *TaskSuggester) Suggest(drawingID, elementJSON, membersJSON string) ([]models.DrawingTask, error) {
	system := `You are an expert Construction Project Manager. You will be given a list of CAD drawing elements (in JSON format) and a list of available team members (with their job titles).
Your task is to analyze the elements (which determine the material quantities) and the team members, and break down the construction into specific, actionable tasks grouped by construction phase: 'Foundation', 'Structural', 'MEP', 'Finishes', 'Roofing'.

For each task:
1. "name": A concise name of the task.
2. "phase": Must be one of 'Foundation', 'Structural', 'MEP', 'Finishes', 'Roofing'.
3. "description": A short detail explaining the quantity (e.g. "Đổ 18m3 bê tông móng", "Lắp đặt 144m ống thoát nước").
4. "assignee_id": Look at the team members list. Assign this task to the member whose job title matches the task (e.g. electrical wiring to an Electrician/Kỹ sư Điện, plumbing to a Plumber/Kỹ sư Nước, concrete/masonry to a Mason/Thợ xây, supervisor to a PM/Giám sát). If no match, leave null or empty.
5. "assignee_name": The name of the chosen member.
6. "duration_days": Estimate a realistic number of days (between 1 and 30).
7. "labor_price": Estimate a reasonable daily labor rate in VND (e.g., 350,000 to 1,200,000 VND).
8. "total_labor_cost": Compute as duration_days * labor_price.

Return ONLY a valid JSON array of tasks matching this schema exactly — no prose, no markdown code blocks:
[
  {
    "name": "Xây tường gạch bao quanh",
    "phase": "Structural",
    "description": "Xây gạch tường bao tầng 1, khoảng 8.5 m3 tường",
    "assignee_id": "uuid-here",
    "assignee_name": "Nguyễn Văn A",
    "status": "todo",
    "duration_days": 5,
    "labor_price": 500000,
    "total_labor_cost": 2500000
  }
]`

	userMsg := fmt.Sprintf("Drawing ID: %s\n\nElement Data:\n%s\n\nTeam Members:\n%s", drawingID, elementJSON, membersJSON)

	reqBody := suggestRequest{
		Model:     "claude-sonnet-4-6",
		MaxTokens: 4096,
		System:    system,
		Messages: []suggestMessage{
			{Role: "user", Content: userMsg},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", s.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API call: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(respBytes))
	}

	var anthropicResp suggestResponse
	if err := json.Unmarshal(respBytes, &anthropicResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}
	if anthropicResp.Error != nil {
		return nil, fmt.Errorf("API error: %s", anthropicResp.Error.Message)
	}
	if len(anthropicResp.Content) == 0 {
		return nil, fmt.Errorf("empty response from Claude")
	}

	rawText := strings.TrimSpace(anthropicResp.Content[0].Text)
	rawText = strings.TrimPrefix(rawText, "```json")
	rawText = strings.TrimPrefix(rawText, "```")
	rawText = strings.TrimSpace(strings.TrimSuffix(rawText, "```"))

	var result []models.DrawingTask
	if err := json.Unmarshal([]byte(rawText), &result); err != nil {
		return nil, fmt.Errorf("parse task JSON: %w — raw: %.500s", err, rawText)
	}

	// Populate basic fields
	for i := range result {
		result[i].DrawingID = drawingID
		result[i].Status = "todo"
		if result[i].TotalLaborCost == 0 {
			result[i].TotalLaborCost = float64(result[i].DurationDays) * result[i].LaborPrice
		}
	}

	return result, nil
}
