package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type AiEditRequest struct {
	Prompt   string                   `json:"prompt"`
	Elements []map[string]interface{} `json:"elements"`
}

type AiEditCommand struct {
	Action      string                 `json:"action"` // "add", "update", "delete"
	ElementID   string                 `json:"elementId,omitempty"`
	ElementType string                 `json:"elementType,omitempty"`
	Properties  map[string]interface{} `json:"properties,omitempty"`
}

type AiEditResponse struct {
	Commands []AiEditCommand `json:"commands"`
	Summary  string          `json:"summary"`
	Error    string          `json:"error,omitempty"`
}

const aiEditSystemPrompt = `You are an expert CAD drawing assistant.
When given a user's natural language edit command along with the current array of drawing elements, respond ONLY with a valid JSON object.
The JSON object must contain two fields:
1. "commands": a JSON array of commands to execute.
2. "summary": a short user-friendly string describing what changes were made.

Each item in the "commands" array must match one of the following schemas exactly:

Add element:
{"action":"add","elementType":"wall"|"door"|"window"|"line"|"rectangle"|"circle"|"text","properties":{...}}
- If adding a wall: properties should contain start: {x: number, y: number}, end: {x: number, y: number}, thickness: number, height: number.
- If adding a door/window (opening): properties should contain hostWallId: string, position: {x: number, y: number}, width: number, height: number, sill: number, swing: string.

Update element:
{"action":"update","elementId":string,"properties":{...}}
- properties contains fields to update on the target element (e.g. thickness, width, sill, start, end, etc.)

Delete element:
{"action":"delete","elementId":string}

Rules:
- Spatial Reasoning: Carefully analyze the coordinates of existing walls and openings in the drawing.
- When placing a door/window, find the closest wall in the elements array, snap to it, set hostWallId, and place it at the correct projected coordinate along the wall segment.
- Alignments: Make sure new elements snap to existing wall junctions or midpoints.
- ONLY return raw JSON. No markdown backticks, no explanations.`

func (h *AIHandler) Edit(w http.ResponseWriter, r *http.Request) {
	var req AiEditRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Prompt == "" {
		writeError(w, http.StatusBadRequest, "Invalid request: 'prompt' field is required")
		return
	}

	// Format elements list for the LLM context
	elementsJSON, _ := json.Marshal(req.Elements)
	fullPrompt := fmt.Sprintf("Current Elements:\n%s\n\nUser Request: %s", string(elementsJSON), req.Prompt)

	var rawText string
	var err error

	if h.cfg.OpenAIAPIKey != "" {
		rawText, err = h.callOpenAIForEdit(fullPrompt)
	} else if h.cfg.DeepSeekAPIKey != "" {
		rawText, err = h.callDeepSeekForEdit(fullPrompt)
	} else if h.cfg.GeminiAPIKey != "" {
		rawText, err = h.callGeminiForEdit(fullPrompt)
	} else {
		writeError(w, http.StatusServiceUnavailable, "No AI service configured. Please check the server configuration.")
		return
	}

	if err != nil {
		writeError(w, http.StatusBadGateway, "AI API error: "+err.Error())
		return
	}

	cleaned := stripMarkdown(rawText)

	var editResp AiEditResponse
	if err := json.Unmarshal([]byte(cleaned), &editResp); err != nil {
		fmt.Printf("AI Edit JSON Parse Error: %v\nRaw Text: %s\nCleaned: %s\n", err, rawText, cleaned)
		writeError(w, http.StatusUnprocessableEntity, "AI returned invalid JSON: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(editResp)
}

func (h *AIHandler) callGeminiForEdit(prompt string) (string, error) {
	geminiBody := geminiRequest{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{Text: aiEditSystemPrompt},
					{Text: prompt},
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

	client := &http.Client{Timeout: 35 * time.Second}
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

func (h *AIHandler) callOpenAIForEdit(prompt string) (string, error) {
	openAIBody := map[string]interface{}{
		"model": "gpt-4o-mini",
		"messages": []map[string]string{
			{"role": "system", "content": aiEditSystemPrompt},
			{"role": "user", "content": prompt},
		},
		"temperature": 0.2,
	}

	bodyBytes, _ := json.Marshal(openAIBody)
	req, _ := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.cfg.OpenAIAPIKey)

	client := &http.Client{Timeout: 35 * time.Second}
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

func (h *AIHandler) callDeepSeekForEdit(prompt string) (string, error) {
	deepSeekBody := map[string]interface{}{
		"model": "deepseek-chat",
		"messages": []map[string]string{
			{"role": "system", "content": aiEditSystemPrompt},
			{"role": "user", "content": prompt},
		},
		"temperature": 0.2,
	}

	bodyBytes, _ := json.Marshal(deepSeekBody)
	req, _ := http.NewRequest("POST", "https://api.deepseek.com/chat/completions", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.cfg.DeepSeekAPIKey)

	client := &http.Client{Timeout: 35 * time.Second}
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
