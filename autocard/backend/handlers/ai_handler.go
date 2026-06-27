package handlers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"autocard-backend/config"
	"autocard-backend/middleware"
	"autocard-backend/models"
	"autocard-backend/repository"
)

// ─── Request / Response types ─────────────────────────────────────────────────

type AiGenerateRequest struct {
	Prompt    string `json:"prompt"`
	Stream    bool   `json:"stream"`
	SessionID string `json:"session_id,omitempty"`
}

type AiGenerateResponse struct {
	Elements []map[string]interface{} `json:"elements"`
	Plan     *ArchitecturalPlan       `json:"plan,omitempty"`
	Error    string                   `json:"error,omitempty"`
}

type ArchitecturalPlan struct {
	Units      string                 `json:"units"`
	Footprint  PlanFootprint          `json:"footprint"`
	Walls      []PlanWall             `json:"walls"`
	Openings   []PlanOpening          `json:"openings"`
	Rooms      []PlanRoom             `json:"rooms"`
	GridAxes   []PlanGridAxis         `json:"gridAxes"`
	Dimensions []PlanDimension        `json:"dimensions"`
	Meta       map[string]interface{} `json:"meta,omitempty"`
}

type PlanFootprint struct {
	WidthMeters  float64 `json:"widthMeters"`
	HeightMeters float64 `json:"heightMeters"`
}

type PlanWall struct {
	ID           string  `json:"id"`
	Role         string  `json:"role"`
	X1           float64 `json:"x1"`
	Y1           float64 `json:"y1"`
	X2           float64 `json:"x2"`
	Y2           float64 `json:"y2"`
	Thickness    float64 `json:"thickness"`
	HostBoundary string  `json:"hostBoundary,omitempty"`
}

type PlanOpening struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"`
	HostWallID  string  `json:"hostWallId"`
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
	Width       float64 `json:"width"`
	Swing       string  `json:"swing,omitempty"`
	Orientation string  `json:"orientation,omitempty"`
}

type PlanRoom struct {
	ID       string    `json:"id"`
	Name     string    `json:"name"`
	RoomType string    `json:"roomType"`
	Boundary []Point2D `json:"boundary"`
	LabelX   float64   `json:"labelX"`
	LabelY   float64   `json:"labelY"`
}

type PlanGridAxis struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Orientation string  `json:"orientation"`
	Value       float64 `json:"value"`
}

type PlanDimension struct {
	ID    string  `json:"id"`
	Role  string  `json:"role"`
	X1    float64 `json:"x1"`
	Y1    float64 `json:"y1"`
	X2    float64 `json:"x2"`
	Y2    float64 `json:"y2"`
	Label string  `json:"label"`
}

type Point2D struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// ─── Gemini API shapes ────────────────────────────────────────────────────────

type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiGenerationConfig struct {
	Temperature     float64 `json:"temperature"`
	MaxOutputTokens int     `json:"maxOutputTokens"`
}

type geminiRequest struct {
	Contents         []geminiContent        `json:"contents"`
	GenerationConfig geminiGenerationConfig `json:"generationConfig"`
}

const systemPrompt = `You are an expert CAD drawing assistant.
When given a natural language description, respond ONLY with a valid JSON array of drawing elements.
Each element must be one of:

Rectangle: {"type":"rectangle","x":number,"y":number,"width":number,"height":number,"strokeColor":"#hex","lineWidth":number,"label":"optional"}
Circle:    {"type":"circle","cx":number,"cy":number,"radius":number,"strokeColor":"#hex","lineWidth":number,"label":"optional"}
Line:      {"type":"line","x1":number,"y1":number,"x2":number,"y2":number,"strokeColor":"#hex","lineWidth":number}
Text:      {"type":"text","x":number,"y":number,"text":string,"fontSize":number,"color":"#hex"}

Rules:
- Canvas is 1200x800 pixels. Fit the drawing inside the canvas with margins and center it around (500, 350).
- Preserve real-world proportions exactly. If the request includes dimensions, all generated elements must keep those ratios.
- Walls: strokeColor "#1E40AF", lineWidth 3.
- Furniture: strokeColor "#64748B", lineWidth 1.5.
- Doors/Windows: strokeColor "#0F766E", lineWidth 2.
- Labels: use Text elements near shapes.
- ONLY return the raw JSON array. No markdown, no explanation.`

type planRequest struct {
	IsRectangularHouse bool
	WidthMeters        float64
	HeightMeters       float64
	DoorWidthMeters    float64
	BedroomCount       int
	HasLivingRoom      bool
}

type roomSpec struct {
	Label  string
	X      float64
	Y      float64
	Width  float64
	Height float64
	Hatch  string
}

var (
	houseDimensionPattern = regexp.MustCompile(`(?i)(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*m`)
	doorWidthPattern      = regexp.MustCompile(`(?i)(\d+(?:\.\d+)?)\s*m(?:\s+\w+){0,2}\s+door`)
	twoBedroomsPattern    = regexp.MustCompile(`(?i)\btwo\s+bedrooms\b|\b2\s+bedrooms\b`)
)

// ─── Handler ──────────────────────────────────────────────────────────────────

type AIHandler struct {
	cfg      *config.Config
	chatRepo *repository.ChatRepo
}

func NewAIHandler(cfg *config.Config, chatRepo *repository.ChatRepo) *AIHandler {
	return &AIHandler{cfg: cfg, chatRepo: chatRepo}
}

func (h *AIHandler) Generate(w http.ResponseWriter, r *http.Request) {
	// Decode request body
	var req AiGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Prompt == "" {
		writeError(w, http.StatusBadRequest, "Invalid request: 'prompt' field is required")
		return
	}

	// Save user message to database if session_id is provided
	if req.SessionID != "" && h.chatRepo != nil {
		userMsg := &models.ChatMessage{
			SessionID: req.SessionID,
			Role:      "user",
			Content:   req.Prompt,
			Category:  "cad_drawing",
		}
		_ = h.chatRepo.CreateMessage(userMsg)
	}

	planReq := parsePlanRequest(req.Prompt)
	if planReq.IsRectangularHouse {
		elements, err := generateHousePlan(planReq)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, err.Error())
			return
		}
		assignElementIDs(elements, r)
		plan := buildArchitecturalPlan(planReq, elements)

		// Save assistant message to database if session_id is provided
		if req.SessionID != "" && h.chatRepo != nil {
			type AiEditCommand struct {
				Action      string                 `json:"action"`
				ElementType string                 `json:"elementType"`
				Properties  map[string]interface{} `json:"properties"`
			}
			var commands []AiEditCommand
			for _, el := range elements {
				elType, _ := el["type"].(string)
				commands = append(commands, AiEditCommand{
					Action:      "add",
					ElementType: elType,
					Properties:  el,
				})
			}
			var commandsStr string
			if len(commands) > 0 {
				cmdBytes, _ := json.Marshal(commands)
				commandsStr = string(cmdBytes)
			}

			assistantMsg := &models.ChatMessage{
				SessionID: req.SessionID,
				Role:      "assistant",
				Content:   fmt.Sprintf("Successfully generated rectangular house plan (%.1f x %.1f m).", planReq.WidthMeters, planReq.HeightMeters),
				Category:  "cad_drawing",
				Commands:  commandsStr,
			}
			_ = h.chatRepo.CreateMessage(assistantMsg)
			_ = h.chatRepo.TouchSession(req.SessionID)
		}

		json.NewEncoder(w).Encode(AiGenerateResponse{Elements: elements, Plan: plan})
		return
	}

	var rawText string
	var err error

	// ── HANDLE STREAMING REQUESTS ──
	if req.Stream {
		if h.cfg.OpenAIAPIKey != "" {
			h.streamOpenAI(req.Prompt, w, req.SessionID)
		} else if h.cfg.DeepSeekAPIKey != "" {
			h.streamDeepSeek(req.Prompt, w, req.SessionID)
		} else if h.cfg.GeminiAPIKey != "" {
			h.streamGemini(req.Prompt, w, req.SessionID)
		} else {
			writeError(w, http.StatusServiceUnavailable, "No AI service configured for streaming")
		}
		return
	}

	// ── USE OPENAI IF OPENAI KEY PROVIDED ──
	if h.cfg.OpenAIAPIKey != "" {
		rawText, err = h.callOpenAI(req.Prompt)
		if err != nil {
			fmt.Printf("OpenAI API error: %v\n", err)
			writeError(w, http.StatusBadGateway, "AI service failed to process the request. Please try again.")
			return
		}
	} else if h.cfg.DeepSeekAPIKey != "" {
		// ── FALLBACK TO DEEPSEEK ──
		rawText, err = h.callDeepSeek(req.Prompt)
		if err != nil {
			fmt.Printf("DeepSeek API error: %v\n", err)
			writeError(w, http.StatusBadGateway, "AI service failed to process the request. Please try again.")
			return
		}
	} else if h.cfg.GeminiAPIKey != "" {
		// ── FALLBACK TO GEMINI ──
		rawText, err = h.callGemini(req.Prompt)
		if err != nil {
			fmt.Printf("Gemini API error: %v\n", err)
			writeError(w, http.StatusBadGateway, "AI service failed to process the request. Please try again.")
			return
		}
	} else {
		writeError(w, http.StatusServiceUnavailable, "No AI service configured. Please check the server configuration.")
		return
	}

	// Strip markdown fences if present
	cleaned := stripMarkdown(rawText)

	// Parse the JSON array of elements
	var elements []map[string]interface{}
	if err := json.Unmarshal([]byte(cleaned), &elements); err != nil {
		fmt.Printf("AI JSON Parse Error: %v\nRaw Text: %s\nCleaned: %s\n", err, rawText, cleaned)
		writeError(w, http.StatusUnprocessableEntity, "AI service returned invalid data format. Please try again.")
		return
	}

	// Assign IDs server-side
	assignElementIDs(elements, r)

	// Save assistant message to database if session_id is provided
	if req.SessionID != "" && h.chatRepo != nil {
		type AiEditCommand struct {
			Action      string                 `json:"action"`
			ElementType string                 `json:"elementType"`
			Properties  map[string]interface{} `json:"properties"`
		}
		var commands []AiEditCommand
		for _, el := range elements {
			elType, _ := el["type"].(string)
			commands = append(commands, AiEditCommand{
				Action:      "add",
				ElementType: elType,
				Properties:  el,
			})
		}
		var commandsStr string
		if len(commands) > 0 {
			cmdBytes, _ := json.Marshal(commands)
			commandsStr = string(cmdBytes)
		}

		assistantMsg := &models.ChatMessage{
			SessionID: req.SessionID,
			Role:      "assistant",
			Content:   "Successfully generated drawing elements on the canvas.",
			Category:  "cad_drawing",
			Commands:  commandsStr,
		}
		_ = h.chatRepo.CreateMessage(assistantMsg)
		_ = h.chatRepo.TouchSession(req.SessionID)
	}

	json.NewEncoder(w).Encode(AiGenerateResponse{Elements: elements})
}

func (h *AIHandler) callGemini(prompt string) (string, error) {
	geminiBody := geminiRequest{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{Text: systemPrompt},
					{Text: "User request: " + prompt},
				},
			},
		},
		GenerationConfig: geminiGenerationConfig{
			Temperature:     0.2,
			MaxOutputTokens: 4096,
		},
	}

	bodyBytes, _ := json.Marshal(geminiBody)
	geminiURL := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=%s",
		h.cfg.GeminiAPIKey,
	)

	req, _ := http.NewRequest("POST", geminiURL, bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to reach Gemini API: %w", err)
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini returned %d: %s", resp.StatusCode, string(respBytes))
	}

	var geminiResp map[string]interface{}
	if err := json.Unmarshal(respBytes, &geminiResp); err != nil {
		return "", fmt.Errorf("failed to parse Gemini response")
	}

	return extractGeminiText(geminiResp)
}

func (h *AIHandler) streamGemini(prompt string, w http.ResponseWriter, sessionID string) {
	geminiBody := geminiRequest{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{Text: systemPrompt},
					{Text: "User request: " + prompt},
				},
			},
		},
		GenerationConfig: geminiGenerationConfig{
			Temperature:     0.2,
			MaxOutputTokens: 4096,
		},
	}

	bodyBytes, _ := json.Marshal(geminiBody)
	geminiURL := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=%s",
		h.cfg.GeminiAPIKey,
	)

	req, _ := http.NewRequest("POST", geminiURL, bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Failed to reach Gemini API: %v\n", err)
		writeError(w, http.StatusBadGateway, "AI service failed to process the request. Please try again.")
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "Streaming unsupported")
		return
	}

	var fullContent strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				continue
			}
			var gResp struct {
				Candidates []struct {
					Content struct {
						Parts []struct {
							Text string `json:"text"`
						} `json:"parts"`
					} `json:"content"`
				} `json:"candidates"`
			}
			if err := json.Unmarshal([]byte(data), &gResp); err == nil {
				if len(gResp.Candidates) > 0 && len(gResp.Candidates[0].Content.Parts) > 0 {
					textChunk := gResp.Candidates[0].Content.Parts[0].Text
					fullContent.WriteString(textChunk)
					// Send a unified format to the frontend
					chunkResp, _ := json.Marshal(map[string]string{"text": textChunk})
					fmt.Fprintf(w, "data: %s\n\n", chunkResp)
					flusher.Flush()
				}
			}
		}
	}

	if sessionID != "" {
		h.saveAssistantMessage(sessionID, fullContent.String())
	}
}

func (h *AIHandler) streamOpenAI(prompt string, w http.ResponseWriter, sessionID string) {
	openAIBody := map[string]interface{}{
		"model": "gpt-4o-mini",
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": prompt},
		},
		"temperature": 0.2,
		"stream":      true,
	}

	bodyBytes, _ := json.Marshal(openAIBody)
	req, _ := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.cfg.OpenAIAPIKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Failed to reach OpenAI API: %v\n", err)
		writeError(w, http.StatusBadGateway, "AI service failed to process the request. Please try again.")
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "Streaming unsupported")
		return
	}

	var fullContent strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				continue
			}
			var oResp struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
				} `json:"choices"`
			}
			if err := json.Unmarshal([]byte(data), &oResp); err == nil {
				if len(oResp.Choices) > 0 && oResp.Choices[0].Delta.Content != "" {
					textChunk := oResp.Choices[0].Delta.Content
					fullContent.WriteString(textChunk)
					// Send a unified format to the frontend
					chunkResp, _ := json.Marshal(map[string]string{"text": textChunk})
					fmt.Fprintf(w, "data: %s\n\n", chunkResp)
					flusher.Flush()
				}
			}
		}
	}

	if sessionID != "" {
		h.saveAssistantMessage(sessionID, fullContent.String())
	}
}

func (h *AIHandler) callOpenAI(prompt string) (string, error) {
	openAIBody := map[string]interface{}{
		"model": "gpt-4o-mini", // fast and cheap model, you can use gpt-4o as well
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": prompt},
		},
		"temperature": 0.2,
	}

	bodyBytes, _ := json.Marshal(openAIBody)
	req, _ := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.cfg.OpenAIAPIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to reach OpenAI API: %w", err)
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openai returned %d: %s", resp.StatusCode, string(respBytes))
	}

	var oaiResp map[string]interface{}
	if err := json.Unmarshal(respBytes, &oaiResp); err != nil {
		return "", fmt.Errorf("failed to parse OpenAI response")
	}

	choices, ok := oaiResp["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}
	choice, ok := choices[0].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid choice format")
	}
	message, ok := choice["message"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("no message in choice")
	}
	content, ok := message["content"].(string)
	if !ok {
		return "", fmt.Errorf("no content in message")
	}

	return content, nil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func extractGeminiText(resp map[string]interface{}) (string, error) {
	candidates, ok := resp["candidates"].([]interface{})
	if !ok || len(candidates) == 0 {
		return "", fmt.Errorf("no candidates in response")
	}
	candidate, ok := candidates[0].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid candidate format")
	}
	content, ok := candidate["content"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("no content in candidate")
	}
	parts, ok := content["parts"].([]interface{})
	if !ok || len(parts) == 0 {
		return "", fmt.Errorf("no parts in content")
	}
	part, ok := parts[0].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid part format")
	}
	text, ok := part["text"].(string)
	if !ok {
		return "", fmt.Errorf("no text in part")
	}
	return text, nil
}

func stripMarkdown(s string) string {
	// Remove ```json ... ``` or ``` ... ```
	result := s
	for _, prefix := range []string{"```json", "```"} {
		if idx := indexOf(result, prefix); idx >= 0 {
			result = result[idx+len(prefix):]
		}
	}
	if idx := indexOf(result, "```"); idx >= 0 {
		result = result[:idx]
	}
	return trimSpace(result)
}

func parsePlanRequest(prompt string) planRequest {
	req := planRequest{
		DoorWidthMeters: 0.9,
		BedroomCount:    0,
		HasLivingRoom:   strings.Contains(strings.ToLower(prompt), "living room"),
	}

	lower := strings.ToLower(prompt)
	isDetailed := strings.Contains(lower, "kitchen") || strings.Contains(lower, "bathroom") || strings.Contains(lower, "restroom") || strings.Contains(lower, "office") || strings.Contains(lower, "detailed") || len(prompt) > 80

	if !isDetailed && strings.Contains(lower, "house") {
		req.IsRectangularHouse = true
	}
	if strings.Contains(lower, "bedroom") {
		req.BedroomCount = 1
	}
	if twoBedroomsPattern.MatchString(prompt) {
		req.BedroomCount = 2
	}

	if matches := houseDimensionPattern.FindStringSubmatch(prompt); len(matches) == 3 {
		if width, err := strconv.ParseFloat(matches[1], 64); err == nil {
			req.WidthMeters = width
		}
		if height, err := strconv.ParseFloat(matches[2], 64); err == nil {
			req.HeightMeters = height
		}
		if !isDetailed {
			req.IsRectangularHouse = req.IsRectangularHouse || req.WidthMeters > 0 && req.HeightMeters > 0
		}
	}

	if matches := doorWidthPattern.FindStringSubmatch(prompt); len(matches) == 2 {
		if width, err := strconv.ParseFloat(matches[1], 64); err == nil {
			req.DoorWidthMeters = width
		}
	}

	return req
}

func generateHousePlan(req planRequest) ([]map[string]interface{}, error) {
	if req.WidthMeters <= 0 || req.HeightMeters <= 0 {
		return nil, fmt.Errorf("house prompts must include positive footprint dimensions like 10x12m")
	}
	if req.DoorWidthMeters <= 0 {
		return nil, fmt.Errorf("door width must be positive")
	}
	if req.DoorWidthMeters >= req.WidthMeters {
		return nil, fmt.Errorf("door width must be smaller than the house width")
	}

	const (
		canvasWidth  = 1200.0
		canvasHeight = 800.0
		margin       = 120.0
		centerX      = 500.0
		centerY      = 350.0
	)

	scale := math.Min((canvasWidth-2*margin)/req.WidthMeters, (canvasHeight-2*margin)/req.HeightMeters)
	if scale <= 0 {
		return nil, fmt.Errorf("unable to fit requested house on canvas")
	}

	houseWidthPx := req.WidthMeters * scale
	houseHeightPx := req.HeightMeters * scale
	startX := centerX - houseWidthPx/2
	startY := centerY - houseHeightPx/2
	doorWidthPx := req.DoorWidthMeters * scale
	wallThicknessPx := math.Max(12, scale*0.18)
	innerX := startX + wallThicknessPx
	innerY := startY + wallThicknessPx
	innerWidth := houseWidthPx - wallThicknessPx*2
	innerHeight := houseHeightPx - wallThicknessPx*2
	bedroomHeight := innerHeight * 0.38
	bedroomWidth := (innerWidth - wallThicknessPx) / 2
	partitionY := innerY + bedroomHeight

	elements := []map[string]interface{}{
		{
			"type":         "rectangle",
			"x":            round2(startX),
			"y":            round2(startY),
			"width":        round2(houseWidthPx),
			"height":       round2(houseHeightPx),
			"strokeColor":  "transparent",
			"fillColor":    "transparent",
			"lineWidth":    0.0,
			"label":        fmt.Sprintf("House %.1fm x %.1fm", req.WidthMeters, req.HeightMeters),
			"layerId":      "A-META",
			"archType":     "meta",
			"semanticRole": "building-shell",
		},
	}

	addSiteHatch(&elements, startX, startY, houseWidthPx, houseHeightPx)
	addWallRect(&elements, startX, startY, houseWidthPx, houseHeightPx, wallThicknessPx)

	if req.BedroomCount >= 1 {
		addRoom(&elements, roomSpec{Label: "Bedroom 1", X: innerX, Y: innerY, Width: bedroomWidth, Height: bedroomHeight, Hatch: "cross"})
	}
	if req.BedroomCount >= 2 {
		addRoom(&elements, roomSpec{Label: "Bedroom 2", X: innerX + bedroomWidth + wallThicknessPx, Y: innerY, Width: bedroomWidth, Height: bedroomHeight, Hatch: "cross"})
		addWallLine(&elements, innerX+bedroomWidth, innerY, innerX+bedroomWidth, partitionY, "A-WALL", "bedroom-divider", wallThicknessPx)
	}
	if req.BedroomCount >= 1 || req.HasLivingRoom {
		addWallLine(&elements, innerX, partitionY, innerX+innerWidth, partitionY, "A-WALL", "room-divider", wallThicknessPx)
	}
	if req.HasLivingRoom {
		addRoom(&elements, roomSpec{Label: "Living Room", X: innerX, Y: partitionY + wallThicknessPx, Width: innerWidth, Height: innerHeight - bedroomHeight - wallThicknessPx, Hatch: "diagonal"})
	}

	doorX := centerX - doorWidthPx/2
	doorY := startY + houseHeightPx
	addDoor(&elements, doorX, doorY, doorWidthPx, fmt.Sprintf("Door %.1fm", req.DoorWidthMeters))
	windowWidth := math.Min(120, innerWidth*0.18)
	addWindow(&elements, startX, innerY+bedroomHeight*0.2, wallThicknessPx, windowWidth, true)
	addWindow(&elements, startX+houseWidthPx, innerY+bedroomHeight*0.2, wallThicknessPx, windowWidth, true)
	addWindow(&elements, innerX+innerWidth*0.22, startY, wallThicknessPx, windowWidth, false)
	addWindow(&elements, innerX+innerWidth*0.62, startY, wallThicknessPx, windowWidth, false)
	addGridAxes(&elements, startX, startY, houseWidthPx, houseHeightPx)
	addDimensions(&elements, startX, startY, houseWidthPx, houseHeightPx, req)
	elements = append(elements, map[string]interface{}{
		"type":        "text",
		"x":           round2(startX),
		"y":           round2(startY - 28),
		"text":        fmt.Sprintf("FLOOR PLAN  %.1fm x %.1fm", req.WidthMeters, req.HeightMeters),
		"fontSize":    18.0,
		"fontWeight":  "bold",
		"strokeColor": "#0F172A",
		"layerId":     "A-TEXT",
	})

	return elements, nil
}

func assignElementIDs(elements []map[string]interface{}, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		userID = "anon"
	}

	for i, el := range elements {
		el["id"] = fmt.Sprintf("ai-%s-%d", userID, i)
		elements[i] = el
	}
}

func addSiteHatch(elements *[]map[string]interface{}, x, y, width, height float64) {
	*elements = append(*elements, map[string]interface{}{
		"type":         "hatch",
		"points":       []map[string]float64{{"x": round2(x - 40), "y": round2(y - 40)}, {"x": round2(x + width + 40), "y": round2(y - 40)}, {"x": round2(x + width + 40), "y": round2(y + height + 40)}, {"x": round2(x - 40), "y": round2(y + height + 40)}},
		"pattern":      "diagonal",
		"strokeColor":  "#E5E7EB",
		"fillColor":    "rgba(245,245,245,0.85)",
		"strokeWidth":  0.6,
		"layerId":      "A-FLR",
		"archType":     "floor",
		"semanticRole": "site-slab",
	})
}

func addWallRect(elements *[]map[string]interface{}, x, y, width, height, wallThickness float64) {
	*elements = append(*elements, map[string]interface{}{
		"type":          "hatch",
		"points":        []map[string]float64{{"x": round2(x), "y": round2(y)}, {"x": round2(x + width), "y": round2(y)}, {"x": round2(x + width), "y": round2(y + height)}, {"x": round2(x), "y": round2(y + height)}},
		"pattern":       "cross",
		"strokeColor":   "#CBD5E1",
		"fillColor":     "rgba(226,232,240,0.45)",
		"strokeWidth":   0.7,
		"layerId":       "A-WALL",
		"archType":      "wall",
		"semanticRole":  "wall-fill",
		"wallThickness": round2(wallThickness),
	})
	addWallLine(elements, x, y, x+width, y, "A-WALL", "outer-top", wallThickness)
	addWallLine(elements, x+width, y, x+width, y+height, "A-WALL", "outer-right", wallThickness)
	addWallLine(elements, x+width, y+height, x, y+height, "A-WALL", "outer-bottom", wallThickness)
	addWallLine(elements, x, y+height, x, y, "A-WALL", "outer-left", wallThickness)
	addWallLine(elements, x+wallThickness, y+wallThickness, x+width-wallThickness, y+wallThickness, "A-WALL", "inner-top", wallThickness)
	addWallLine(elements, x+width-wallThickness, y+wallThickness, x+width-wallThickness, y+height-wallThickness, "A-WALL", "inner-right", wallThickness)
	addWallLine(elements, x+width-wallThickness, y+height-wallThickness, x+wallThickness, y+height-wallThickness, "A-WALL", "inner-bottom", wallThickness)
	addWallLine(elements, x+wallThickness, y+height-wallThickness, x+wallThickness, y+wallThickness, "A-WALL", "inner-left", wallThickness)
}

func addWallLine(elements *[]map[string]interface{}, x1, y1, x2, y2 float64, layer, role string, wallThickness float64) {
	*elements = append(*elements, map[string]interface{}{
		"type":          "line",
		"x1":            round2(x1),
		"y1":            round2(y1),
		"x2":            round2(x2),
		"y2":            round2(y2),
		"strokeColor":   "#111827",
		"lineWidth":     2.0,
		"layerId":       layer,
		"archType":      "wall",
		"semanticRole":  role,
		"wallThickness": round2(wallThickness),
	})
}

func addRoom(elements *[]map[string]interface{}, room roomSpec) {
	*elements = append(*elements,
		map[string]interface{}{
			"type":        "hatch",
			"points":      []map[string]float64{{"x": round2(room.X), "y": round2(room.Y)}, {"x": round2(room.X + room.Width), "y": round2(room.Y)}, {"x": round2(room.X + room.Width), "y": round2(room.Y + room.Height)}, {"x": round2(room.X), "y": round2(room.Y + room.Height)}},
			"pattern":     room.Hatch,
			"strokeColor": "#E2E8F0",
			"fillColor":   "rgba(255,255,255,0.7)",
			"strokeWidth": 0.5,
			"layerId":     "A-HATCH",
			"archType":    "room",
			"roomName":    room.Label,
		},
		map[string]interface{}{
			"type":        "text",
			"x":           round2(room.X + room.Width/2),
			"y":           round2(room.Y + room.Height/2),
			"text":        room.Label,
			"fontSize":    15.0,
			"fontWeight":  "bold",
			"textAlign":   "center",
			"strokeColor": "#334155",
			"layerId":     "A-ROOM",
			"archType":    "room",
			"roomName":    room.Label,
			"roomType":    strings.ToLower(strings.ReplaceAll(room.Label, " ", "-")),
		},
	)
}

func addDoor(elements *[]map[string]interface{}, x, y, width float64, label string) {
	*elements = append(*elements,
		map[string]interface{}{"type": "line", "x1": round2(x), "y1": round2(y), "x2": round2(x), "y2": round2(y - width), "strokeColor": "#0F766E", "lineWidth": 1.3, "layerId": "A-DOOR", "archType": "door", "semanticRole": "door-leaf", "openingWidth": round2(width), "swing": "left-in", "hostWall": "outer-bottom"},
		map[string]interface{}{"type": "arc", "cx": round2(x), "cy": round2(y), "radius": round2(width), "startAngle": -90.0, "endAngle": 0.0, "strokeColor": "#0F766E", "lineWidth": 1.0, "lineType": "dashed", "layerId": "A-DOOR", "label": label, "archType": "door", "semanticRole": "door-swing", "openingWidth": round2(width), "swing": "left-in", "hostWall": "outer-bottom"},
	)
}

func addWindow(elements *[]map[string]interface{}, anchorX, anchorY, wallThickness, span float64, vertical bool) {
	if vertical {
		*elements = append(*elements,
			map[string]interface{}{"type": "line", "x1": round2(anchorX), "y1": round2(anchorY), "x2": round2(anchorX + wallThickness), "y2": round2(anchorY), "strokeColor": "#2563EB", "lineWidth": 1.0, "layerId": "A-WIND", "archType": "window", "semanticRole": "window-head", "openingWidth": round2(span)},
			map[string]interface{}{"type": "line", "x1": round2(anchorX), "y1": round2(anchorY + span), "x2": round2(anchorX + wallThickness), "y2": round2(anchorY + span), "strokeColor": "#2563EB", "lineWidth": 1.0, "layerId": "A-WIND", "archType": "window", "semanticRole": "window-sill", "openingWidth": round2(span)},
			map[string]interface{}{"type": "line", "x1": round2(anchorX + wallThickness/2), "y1": round2(anchorY), "x2": round2(anchorX + wallThickness/2), "y2": round2(anchorY + span), "strokeColor": "#2563EB", "lineWidth": 0.9, "layerId": "A-WIND", "archType": "window", "semanticRole": "window-center", "openingWidth": round2(span)},
		)
		return
	}
	*elements = append(*elements,
		map[string]interface{}{"type": "line", "x1": round2(anchorX), "y1": round2(anchorY), "x2": round2(anchorX + span), "y2": round2(anchorY), "strokeColor": "#2563EB", "lineWidth": 1.0, "layerId": "A-WIND", "archType": "window", "semanticRole": "window-head", "openingWidth": round2(span)},
		map[string]interface{}{"type": "line", "x1": round2(anchorX), "y1": round2(anchorY + wallThickness), "x2": round2(anchorX + span), "y2": round2(anchorY + wallThickness), "strokeColor": "#2563EB", "lineWidth": 1.0, "layerId": "A-WIND", "archType": "window", "semanticRole": "window-sill", "openingWidth": round2(span)},
		map[string]interface{}{"type": "line", "x1": round2(anchorX), "y1": round2(anchorY + wallThickness/2), "x2": round2(anchorX + span), "y2": round2(anchorY + wallThickness/2), "strokeColor": "#2563EB", "lineWidth": 0.9, "layerId": "A-WIND", "archType": "window", "semanticRole": "window-center", "openingWidth": round2(span)},
	)
}

func addGridAxes(elements *[]map[string]interface{}, x, y, width, height float64) {
	xs := []float64{x - 36, x + width/2, x + width + 36}
	ys := []float64{y - 36, y + height/2, y + height + 36}
	labelsX := []string{"A", "B", "C"}
	labelsY := []string{"1", "2", "3"}
	for i, ax := range xs {
		*elements = append(*elements,
			map[string]interface{}{"type": "line", "x1": round2(ax), "y1": round2(y - 60), "x2": round2(ax), "y2": round2(y + height + 60), "strokeColor": "#94A3B8", "lineWidth": 0.8, "lineType": "dashed", "layerId": "A-GRID"},
			map[string]interface{}{"type": "circle", "cx": round2(ax), "cy": round2(y - 72), "radius": 10.0, "strokeColor": "#475569", "lineWidth": 1.0, "fillColor": "#FFFFFF", "layerId": "A-GRID", "archType": "grid", "axisName": labelsX[i]},
			map[string]interface{}{"type": "text", "x": round2(ax), "y": round2(y - 68), "text": labelsX[i], "fontSize": 12.0, "fontWeight": "bold", "textAlign": "center", "strokeColor": "#334155", "layerId": "A-GRID", "archType": "grid", "axisName": labelsX[i]},
		)
	}
	for i, ay := range ys {
		*elements = append(*elements,
			map[string]interface{}{"type": "line", "x1": round2(x - 60), "y1": round2(ay), "x2": round2(x + width + 60), "y2": round2(ay), "strokeColor": "#94A3B8", "lineWidth": 0.8, "lineType": "dashed", "layerId": "A-GRID", "archType": "grid", "axisName": labelsY[i]},
			map[string]interface{}{"type": "circle", "cx": round2(x - 72), "cy": round2(ay), "radius": 10.0, "strokeColor": "#475569", "lineWidth": 1.0, "fillColor": "#FFFFFF", "layerId": "A-GRID", "archType": "grid", "axisName": labelsY[i]},
			map[string]interface{}{"type": "text", "x": round2(x - 72), "y": round2(ay + 4), "text": labelsY[i], "fontSize": 12.0, "fontWeight": "bold", "textAlign": "center", "strokeColor": "#334155", "layerId": "A-GRID", "archType": "grid", "axisName": labelsY[i]},
		)
	}
}

func addDimensions(elements *[]map[string]interface{}, x, y, width, height float64, req planRequest) {
	*elements = append(*elements,
		map[string]interface{}{"type": "dimension", "x1": round2(x), "y1": round2(y + height + 70), "x2": round2(x + width), "y2": round2(y + height + 70), "strokeColor": "#DC2626", "strokeWidth": 1.0, "layerId": "A-DIMS", "label": fmt.Sprintf("%.0f mm", req.WidthMeters*1000), "archType": "dimension", "semanticRole": "overall-width"},
		map[string]interface{}{"type": "dimension", "x1": round2(x - 70), "y1": round2(y), "x2": round2(x - 70), "y2": round2(y + height), "strokeColor": "#DC2626", "strokeWidth": 1.0, "layerId": "A-DIMS", "label": fmt.Sprintf("%.0f mm", req.HeightMeters*1000), "archType": "dimension", "semanticRole": "overall-height"},
	)
}

func buildArchitecturalPlan(req planRequest, elements []map[string]interface{}) *ArchitecturalPlan {
	plan := &ArchitecturalPlan{
		Units: "mm",
		Footprint: PlanFootprint{
			WidthMeters:  req.WidthMeters,
			HeightMeters: req.HeightMeters,
		},
		Meta: map[string]interface{}{
			"generator": "deterministic-house-plan-v2",
		},
	}

	for _, el := range elements {
		archType, _ := el["archType"].(string)
		switch archType {
		case "wall":
			if el["type"] == "line" {
				plan.Walls = append(plan.Walls, PlanWall{
					ID:           stringValue(el["id"]),
					Role:         stringValue(el["semanticRole"]),
					X1:           floatValue(el["x1"]),
					Y1:           floatValue(el["y1"]),
					X2:           floatValue(el["x2"]),
					Y2:           floatValue(el["y2"]),
					Thickness:    floatValue(el["wallThickness"]),
					HostBoundary: stringValue(el["semanticRole"]),
				})
			}
		case "door", "window":
			plan.Openings = append(plan.Openings, PlanOpening{
				ID:          stringValue(el["id"]),
				Type:        archType,
				HostWallID:  stringValue(el["hostWall"]),
				X:           chooseOpeningX(el),
				Y:           chooseOpeningY(el),
				Width:       chooseOpeningWidth(el),
				Swing:       stringValue(el["swing"]),
				Orientation: stringValue(el["semanticRole"]),
			})
		case "room":
			if el["type"] == "text" {
				plan.Rooms = append(plan.Rooms, PlanRoom{
					ID:       stringValue(el["id"]),
					Name:     stringValue(el["roomName"]),
					RoomType: stringValue(el["roomType"]),
					LabelX:   floatValue(el["x"]),
					LabelY:   floatValue(el["y"]),
				})
			}
		case "grid":
			orientation := "vertical"
			if y1, ok := el["y1"]; ok {
				if y2, ok2 := el["y2"]; ok2 && floatValue(y1) == floatValue(y2) {
					orientation = "horizontal"
				}
			}
			if el["type"] == "line" {
				value := floatValue(el["x1"])
				if orientation == "horizontal" {
					value = floatValue(el["y1"])
				}
				plan.GridAxes = append(plan.GridAxes, PlanGridAxis{
					ID:          stringValue(el["id"]),
					Name:        stringValue(el["axisName"]),
					Orientation: orientation,
					Value:       value,
				})
			}
		case "dimension":
			plan.Dimensions = append(plan.Dimensions, PlanDimension{
				ID:    stringValue(el["id"]),
				Role:  stringValue(el["semanticRole"]),
				X1:    floatValue(el["x1"]),
				Y1:    floatValue(el["y1"]),
				X2:    floatValue(el["x2"]),
				Y2:    floatValue(el["y2"]),
				Label: stringValue(el["label"]),
			})
		}
	}

	for i := range plan.Rooms {
		roomName := plan.Rooms[i].Name
		if roomName == "" {
			continue
		}
		for _, el := range elements {
			if stringValue(el["archType"]) == "room" && el["type"] == "hatch" && stringValue(el["roomName"]) == roomName {
				plan.Rooms[i].Boundary = pointsFrom(el["points"])
				break
			}
		}
	}

	return plan
}

func pointsFrom(raw interface{}) []Point2D {
	items, ok := raw.([]map[string]float64)
	if ok {
		out := make([]Point2D, 0, len(items))
		for _, item := range items {
			out = append(out, Point2D{X: item["x"], Y: item["y"]})
		}
		return out
	}
	generic, ok := raw.([]interface{})
	if !ok {
		return nil
	}
	out := make([]Point2D, 0, len(generic))
	for _, item := range generic {
		point, ok := item.(map[string]float64)
		if ok {
			out = append(out, Point2D{X: point["x"], Y: point["y"]})
		}
	}
	return out
}

func chooseOpeningX(el map[string]interface{}) float64 {
	if v, ok := el["cx"]; ok {
		return floatValue(v)
	}
	if v, ok := el["x1"]; ok {
		return floatValue(v)
	}
	return floatValue(el["x"])
}

func chooseOpeningY(el map[string]interface{}) float64 {
	if v, ok := el["cy"]; ok {
		return floatValue(v)
	}
	if v, ok := el["y1"]; ok {
		return floatValue(v)
	}
	return floatValue(el["y"])
}

func chooseOpeningWidth(el map[string]interface{}) float64 {
	if v, ok := el["openingWidth"]; ok {
		return floatValue(v)
	}
	if v, ok := el["radius"]; ok {
		return floatValue(v)
	}
	return floatValue(el["width"])
}

func stringValue(v interface{}) string {
	s, _ := v.(string)
	return s
}

func floatValue(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case float32:
		return float64(n)
	case int:
		return float64(n)
	case int64:
		return float64(n)
	default:
		return 0
	}
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func indexOf(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func trimSpace(s string) string {
	start, end := 0, len(s)-1
	for start <= end && (s[start] == ' ' || s[start] == '\n' || s[start] == '\r' || s[start] == '\t') {
		start++
	}
	for end >= start && (s[end] == ' ' || s[end] == '\n' || s[end] == '\r' || s[end] == '\t') {
		end--
	}
	if start > end {
		return ""
	}
	return s[start : end+1]
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(AiGenerateResponse{Error: msg})
}

func (h *AIHandler) callDeepSeek(prompt string) (string, error) {
	deepSeekBody := map[string]interface{}{
		"model": "deepseek-chat",
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": prompt},
		},
		"temperature": 0.2,
	}

	bodyBytes, _ := json.Marshal(deepSeekBody)
	req, _ := http.NewRequest("POST", "https://api.deepseek.com/chat/completions", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.cfg.DeepSeekAPIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to reach DeepSeek API: %w", err)
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("deepseek returned %d: %s", resp.StatusCode, string(respBytes))
	}

	var dsResp map[string]interface{}
	if err := json.Unmarshal(respBytes, &dsResp); err != nil {
		return "", fmt.Errorf("failed to parse DeepSeek response")
	}

	choices, ok := dsResp["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}
	choice, ok := choices[0].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid choice format")
	}
	message, ok := choice["message"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("no message in choice")
	}
	content, ok := message["content"].(string)
	if !ok {
		return "", fmt.Errorf("no content in message")
	}

	return content, nil
}

func (h *AIHandler) streamDeepSeek(prompt string, w http.ResponseWriter, sessionID string) {
	deepSeekBody := map[string]interface{}{
		"model": "deepseek-chat",
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": prompt},
		},
		"temperature": 0.2,
		"stream":      true,
	}

	bodyBytes, _ := json.Marshal(deepSeekBody)
	req, _ := http.NewRequest("POST", "https://api.deepseek.com/chat/completions", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.cfg.DeepSeekAPIKey)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Failed to reach DeepSeek API: %v\n", err)
		writeError(w, http.StatusBadGateway, "AI service failed to process the request. Please try again.")
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "Streaming unsupported")
		return
	}

	var fullContent strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data: ") {
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				continue
			}
			var dsResp struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
				} `json:"choices"`
			}
			if err := json.Unmarshal([]byte(data), &dsResp); err == nil {
				if len(dsResp.Choices) > 0 && dsResp.Choices[0].Delta.Content != "" {
					textChunk := dsResp.Choices[0].Delta.Content
					fullContent.WriteString(textChunk)
					chunkResp, _ := json.Marshal(map[string]string{"text": textChunk})
					fmt.Fprintf(w, "data: %s\n\n", chunkResp)
					flusher.Flush()
				}
			}
		}
	}

	if sessionID != "" {
		h.saveAssistantMessage(sessionID, fullContent.String())
	}
}

// POST /api/ai/smart-dimensions
// Analyzes wall elements and returns auto-generated dimension annotations.
// Pure geometry computation — no AI API call required.
func (h *AIHandler) SmartDimensions(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Elements []map[string]interface{} `json:"elements"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	type DimResult struct {
		ID           string  `json:"id"`
		Type         string  `json:"type"`
		X1           float64 `json:"x1"`
		Y1           float64 `json:"y1"`
		X2           float64 `json:"x2"`
		Y2           float64 `json:"y2"`
		Label        string  `json:"label"`
		ArchType     string  `json:"archType"`
		SemanticRole string  `json:"semanticRole"`
		StrokeColor  string  `json:"strokeColor"`
		StrokeWidth  float64 `json:"strokeWidth"`
		LayerID      string  `json:"layerId"`
	}

	dims := make([]DimResult, 0)
	const offsetPx = 80.0

	for i, el := range req.Elements {
		if at, _ := el["archType"].(string); at != "wall" {
			continue
		}
		if t, _ := el["type"].(string); t != "line" {
			continue
		}
		x1, y1 := floatValue(el["x1"]), floatValue(el["y1"])
		x2, y2 := floatValue(el["x2"]), floatValue(el["y2"])
		length := math.Hypot(x2-x1, y2-y1)
		if length < 30 {
			continue
		}

		var label string
		if length >= 1000 {
			label = fmt.Sprintf("%.2f m", length/1000)
		} else {
			label = fmt.Sprintf("%.0f mm", length)
		}

		norm := length
		perpX := -(y2 - y1) / norm
		perpY := (x2 - x1) / norm

		dims = append(dims, DimResult{
			ID: fmt.Sprintf("smart-dim-%d", i), Type: "dimension",
			X1: round2(x1 + perpX*offsetPx), Y1: round2(y1 + perpY*offsetPx),
			X2: round2(x2 + perpX*offsetPx), Y2: round2(y2 + perpY*offsetPx),
			Label: label, ArchType: "dimension", SemanticRole: "smart-auto",
			StrokeColor: "#DC2626", StrokeWidth: 1.0, LayerID: "A-DIMS",
		})
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"dimensions": dims, "count": len(dims)})
}

func (h *AIHandler) saveAssistantMessage(sessionID string, rawJSON string) {
	if sessionID == "" || h.chatRepo == nil {
		return
	}
	cleaned := stripMarkdown(rawJSON)
	var elements []map[string]interface{}
	if err := json.Unmarshal([]byte(cleaned), &elements); err != nil {
		fmt.Printf("[AI Generate] Failed to unmarshal elements for DB logging: %v\n", err)
		return
	}

	type AiEditCommand struct {
		Action      string                 `json:"action"`
		ElementType string                 `json:"elementType"`
		Properties  map[string]interface{} `json:"properties"`
	}
	var commands []AiEditCommand
	for _, el := range elements {
		elType, _ := el["type"].(string)
		commands = append(commands, AiEditCommand{
			Action:      "add",
			ElementType: elType,
			Properties:  el,
		})
	}
	var commandsStr string
	if len(commands) > 0 {
		cmdBytes, _ := json.Marshal(commands)
		commandsStr = string(cmdBytes)
	}

	assistantMsg := &models.ChatMessage{
		SessionID: sessionID,
		Role:      "assistant",
		Content:   "Successfully generated drawing elements on the canvas.",
		Category:  "cad_drawing",
		Commands:  commandsStr,
	}
	if err := h.chatRepo.CreateMessage(assistantMsg); err != nil {
		fmt.Printf("[AI Generate] Failed to save assistant message: %v\n", err)
	}
	_ = h.chatRepo.TouchSession(sessionID)
}
