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

const anthropicURL = "https://api.anthropic.com/v1/messages"

// DrawingAnalyzer converts raw drawing element JSON into a BIMResult
// by asking Claude to classify and structure the architectural elements.
type DrawingAnalyzer struct {
	apiKey string
	client *http.Client
}

func NewDrawingAnalyzer(apiKey string) *DrawingAnalyzer {
	return &DrawingAnalyzer{
		apiKey: apiKey,
		client: &http.Client{Timeout: 120 * time.Second},
	}
}

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// Analyze takes a drawing's element JSON string and returns a BIMResult.
// elementJSON is the raw `data` field from the Drawing model.
func (a *DrawingAnalyzer) Analyze(drawingID, elementJSON string) (*models.BIMResult, error) {
	// Truncate very large drawings to stay within token limits
	if len(elementJSON) > 80000 {
		elementJSON = elementJSON[:80000] + "... (truncated)"
	}

	system := `You are an expert architectural BIM engineer. Given raw CAD drawing element data (lines, polylines, arcs, rectangles, text, blocks), classify and structure the architectural elements into a BIM JSON model.

Return ONLY a valid JSON object matching this schema exactly — no prose, no markdown fences:
{
  "job_id": "",
  "analyzed": "",
  "units": "mm",
  "levels": [{"id":"L1","name":"Ground Floor","elevation":0,"height":3000}],
  "walls": [{"id":"W1","level_id":"L1","role":"exterior","x1":0,"y1":0,"x2":1000,"y2":0,"thickness":200,"height":3000,"material":"Concrete"}],
  "openings": [{"id":"O1","type":"door","host_wall_id":"W1","x":200,"y":0,"width":900,"height":2100,"sill":0}],
  "rooms": [{"id":"R1","level_id":"L1","name":"Living Room","room_type":"living","boundary":[{"x":0,"y":0}],"area":0}],
  "columns": [],
  "meta": {}
}

Rules:
- Identify WALL elements from lines with archType="wall" or layer names matching /WALL/i
- Identify DOOR elements from archType="door", layer /DOOR/i, or arc shapes near wall ends
- Identify WINDOW elements from archType="window", layer /WIND|GLAZ/i
- Identify ROOM elements from text labels or hatch regions
- Skip annotation elements (dimensions, text, leaders, hatches unless room)
- Use the same coordinate system as the input data
- Compute room area from boundary polygon when possible
- Set units to "mm" if coordinates are large numbers (>1000), "m" if small
- Assign unique sequential IDs: W1,W2... O1,O2... R1,R2... L1... C1...
- Set job_id and analyzed to empty string (will be filled by server)`

	userMsg := fmt.Sprintf("Drawing ID: %s\n\nElement data:\n%s", drawingID, elementJSON)

	reqBody := anthropicRequest{
		Model:     "claude-sonnet-4-6",
		MaxTokens: 8192,
		System:    system,
		Messages: []anthropicMessage{
			{Role: "user", Content: userMsg},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", anthropicURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", a.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := a.client.Do(req)
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

	var anthropicResp anthropicResponse
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
	// Strip markdown fences if Claude added them despite instructions
	rawText = strings.TrimPrefix(rawText, "```json")
	rawText = strings.TrimPrefix(rawText, "```")
	rawText = strings.TrimSuffix(rawText, "```")
	rawText = strings.TrimSpace(rawText)

	var result models.BIMResult
	if err := json.Unmarshal([]byte(rawText), &result); err != nil {
		return nil, fmt.Errorf("parse BIM JSON from Claude output: %w — raw: %.500s", err, rawText)
	}

	result.JobID = drawingID
	result.Analyzed = time.Now().UTC()

	return &result, nil
}
