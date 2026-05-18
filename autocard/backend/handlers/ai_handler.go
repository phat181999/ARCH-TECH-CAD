package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"autocard-backend/config"
)

// ─── Request / Response types ─────────────────────────────────────────────────

type AiGenerateRequest struct {
	Prompt string `json:"prompt"`
}

type AiGenerateResponse struct {
	Elements []map[string]interface{} `json:"elements"`
	Error    string                   `json:"error,omitempty"`
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
- Canvas is 1200x800 pixels. Center drawings around (500, 350).
- Scale: 1 pixel = 10mm. A 5m wall = 500px wide.
- Walls: strokeColor "#1E40AF", lineWidth 3.
- Furniture: strokeColor "#64748B", lineWidth 1.5.
- Doors/Windows: strokeColor "#0F766E", lineWidth 2.
- Labels: use Text elements near shapes.
- ONLY return the raw JSON array. No markdown, no explanation.`

// ─── Handler ──────────────────────────────────────────────────────────────────

type AIHandler struct {
	cfg *config.Config
}

func NewAIHandler(cfg *config.Config) *AIHandler {
	return &AIHandler{cfg: cfg}
}

func (h *AIHandler) Generate(w http.ResponseWriter, r *http.Request) {
	// Decode request body
	var req AiGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Prompt == "" {
		writeError(w, http.StatusBadRequest, "Invalid request: 'prompt' field is required")
		return
	}

	var rawText string
	var err error

	// ── USE OPENAI IF OPENAI KEY PROVIDED (starts with sk-) ──
	if h.cfg.OpenAIAPIKey != "" {
		rawText, err = h.callOpenAI(req.Prompt)
		if err != nil {
			writeError(w, http.StatusBadGateway, "OpenAI API error: "+err.Error())
			return
		}
	} else if h.cfg.GeminiAPIKey != "" {
		// ── FALLBACK TO GEMINI ──
		rawText, err = h.callGemini(req.Prompt)
		if err != nil {
			writeError(w, http.StatusBadGateway, "Gemini API error: "+err.Error())
			return
		}
	} else {
		writeError(w, http.StatusServiceUnavailable, "No AI service configured. Add OPENAI_API_KEY or GEMINI_API_KEY to backend/.env")
		return
	}

	// Strip markdown fences if present
	cleaned := stripMarkdown(rawText)

	// Parse the JSON array of elements
	var elements []map[string]interface{}
	if err := json.Unmarshal([]byte(cleaned), &elements); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "AI returned invalid JSON: "+err.Error())
		return
	}

	// Assign IDs server-side
	for i, el := range elements {
		userId := r.Context().Value("userId")
		if userId == nil {
			userId = "anon"
		}
		el["id"] = fmt.Sprintf("ai-%v-%d", userId, i)
		elements[i] = el
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

	resp, err := http.Post(geminiURL, "application/json", bytes.NewReader(bodyBytes))
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

	client := &http.Client{}
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
