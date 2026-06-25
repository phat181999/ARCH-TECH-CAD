package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type AiInteractRequest struct {
	Prompt   string                   `json:"prompt"`
	Elements []map[string]interface{} `json:"elements"`
}

type AiEditCommand struct {
	Action      string                 `json:"action"` // "add", "update", "delete"
	ElementID   string                 `json:"elementId,omitempty"`
	ElementType string                 `json:"elementType,omitempty"`
	Properties  map[string]interface{} `json:"properties,omitempty"`
}

type AiInteractResponse struct {
	Category string          `json:"category"`
	Commands []AiEditCommand `json:"commands,omitempty"`
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

const classifierRouterSystemPrompt = `You are a prompt routing agent for an architectural CAD application.
Classify the user's query into exactly one category:

1. "cad_drawing" — drawing, creating, editing, modifying, deleting, coloring shapes, walls, doors, windows, lines, circles on the CAD canvas
2. "permit_and_licensing" — building codes, construction permits, legal rules, compliance, egress, TCVN guidelines, fire safety regulations
3. "construction_materials" — physical materials (concrete, bricks, steel, wood, finishes), pricing, unit cost, material specifications
4. "general_knowledge" — greetings, general chat, explanations, questions not covered by other categories

Respond ONLY with a JSON object:
{"category":"<one_of_the_four>","confidence":0.95}`

const permitSystemPrompt = `You are a building permits and code compliance assistant for AutoCard.
The user is asking about building codes, construction permits, or legal compliance.
Reference Vietnamese building standards (TCVN) when applicable.
Provide specific code references and requirements when possible.
Common standards: TCVN 4319 (doors), TCVN 2622 (fire safety), TCVN 4513 (plumbing), TCVN 5687 (ventilation).`

const materialsSystemPrompt = `You are a building materials specialist for AutoCard.
The user is asking about construction materials, specifications, or pricing.
Provide information about common Vietnamese construction materials.
Include typical unit prices in VND when relevant.
Reference common materials: concrete (bê tông), brick (gạch), steel (thép), wood (gỗ), cement (xi măng), sand (cát), gravel (đá).`

const generalSystemPrompt = `You are an expert AI assistant for AutoCard, an architectural CAD application.
Answer general questions or greetings. Be helpful, professional, and concise. Respond in the same language the user uses.`

func pruneElements(elements []map[string]interface{}) []map[string]interface{} {
	if len(elements) <= 400 {
		return elements
	}

	// 1. Separate architectural elements and generic elements
	var archElements []map[string]interface{}
	var otherElements []map[string]interface{}

	for _, el := range elements {
		archType, _ := el["archType"].(string)
		elType, _ := el["type"].(string)

		// Keep structural/architectural items
		if archType == "wall" || archType == "door" || archType == "window" || archType == "room" || archType == "floor" || archType == "grid" ||
			elType == "wall" || elType == "door" || elType == "window" || elType == "opening" || elType == "room" {
			archElements = append(archElements, el)
		} else {
			otherElements = append(otherElements, el)
		}
	}

	// Limit architectural elements to 800
	if len(archElements) > 800 {
		return archElements[:800]
	}

	// Fill remaining budget up to 800 elements with other elements
	remainingBudget := 800 - len(archElements)
	if remainingBudget > 0 && len(otherElements) > 0 {
		if len(otherElements) > remainingBudget {
			archElements = append(archElements, otherElements[:remainingBudget]...)
		} else {
			archElements = append(archElements, otherElements...)
		}
	}

	return archElements
}

func (h *AIHandler) Interact(w http.ResponseWriter, r *http.Request) {
	var req AiInteractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Prompt == "" {
		writeError(w, http.StatusBadRequest, "Invalid request: 'prompt' field is required")
		return
	}

	// 1. Classify the user prompt
	category := h.classifyPrompt(req.Prompt)

	var respBody AiInteractResponse
	respBody.Category = category

	// 2. Route based on category
	switch category {
	case "cad_drawing":
		// Run CAD drawing generator/editor
		prunedElements := pruneElements(req.Elements)
		elementsJSON, _ := json.Marshal(prunedElements)
		fullPrompt := fmt.Sprintf("Current Elements:\n%s\n\nUser Request: %s", string(elementsJSON), req.Prompt)

		rawText, err := h.callLLMWithSystemPrompt(aiEditSystemPrompt, fullPrompt)
		if err != nil {
			fmt.Printf("AI Edit API error: %v\n", err)
			writeError(w, http.StatusBadGateway, "AI service failed to process drawing request. Please try again.")
			return
		}

		cleaned := stripMarkdown(rawText)
		var editResp struct {
			Commands []AiEditCommand `json:"commands"`
			Summary  string          `json:"summary"`
		}
		if err := json.Unmarshal([]byte(cleaned), &editResp); err != nil {
			fmt.Printf("AI Edit JSON Parse Error: %v\nRaw Text: %s\nCleaned: %s\n", err, rawText, cleaned)
			writeError(w, http.StatusUnprocessableEntity, "AI service returned invalid data format for CAD commands. Please try again.")
			return
		}

		respBody.Commands = editResp.Commands
		respBody.Summary = editResp.Summary

	case "permit_and_licensing":
		// RAG routing: User will hook up actual Qdrant RAG store here if needed.
		// For now, call LLM with permit guidelines prompt
		answer, err := h.callLLMWithSystemPrompt(permitSystemPrompt, req.Prompt)
		if err != nil {
			writeError(w, http.StatusBadGateway, "AI service failed: "+err.Error())
			return
		}
		respBody.Summary = answer

	case "construction_materials":
		// RAG routing: User will hook up actual Qdrant RAG store here if needed.
		// For now, call LLM with materials prompt
		answer, err := h.callLLMWithSystemPrompt(materialsSystemPrompt, req.Prompt)
		if err != nil {
			writeError(w, http.StatusBadGateway, "AI service failed: "+err.Error())
			return
		}
		respBody.Summary = answer

	default: // general_knowledge
		answer, err := h.callLLMWithSystemPrompt(generalSystemPrompt, req.Prompt)
		if err != nil {
			writeError(w, http.StatusBadGateway, "AI service failed: "+err.Error())
			return
		}
		respBody.Summary = answer
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(respBody)
}

func (h *AIHandler) classifyPrompt(prompt string) string {
	rawText, err := h.callLLMWithSystemPrompt(classifierRouterSystemPrompt, prompt)
	if err != nil {
		return h.fallbackClassify(prompt)
	}

	cleaned := stripMarkdown(rawText)
	var result struct {
		Category   string  `json:"category"`
		Confidence float64 `json:"confidence"`
	}
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		return h.fallbackClassify(prompt)
	}

	switch result.Category {
	case "cad_drawing", "permit_and_licensing", "construction_materials", "general_knowledge":
		return result.Category
	default:
		return "general_knowledge"
	}
}

func (h *AIHandler) fallbackClassify(prompt string) string {
	lower := strings.ToLower(prompt)

	cadKeywords := []string{"draw", "vẽ", "add", "delete", "remove", "wall", "door", "window", "line", "circle", "rectangle", "move", "resize", "extend", "trim", "color"}
	for _, kw := range cadKeywords {
		if strings.Contains(lower, kw) {
			return "cad_drawing"
		}
	}

	permitKeywords := []string{"permit", "giấy phép", "tcvn", "compliance", "quy chuẩn", "building code", "egress", "fire", "cháy", "stair", "ramp", "thoát hiểm"}
	for _, kw := range permitKeywords {
		if strings.Contains(lower, kw) {
			return "permit_and_licensing"
		}
	}

	materialKeywords := []string{"material", "vật liệu", "concrete", "bê tông", "brick", "gạch", "steel", "thép", "wood", "gỗ", "price", "giá", "cost", "chi phí"}
	for _, kw := range materialKeywords {
		if strings.Contains(lower, kw) {
			return "construction_materials"
		}
	}

	return "general_knowledge"
}

func (h *AIHandler) callLLMWithSystemPrompt(systemPrompt, userPrompt string) (string, error) {
	if h.cfg.OpenAIAPIKey != "" {
		return h.callOpenAIWithSystemPrompt(systemPrompt, userPrompt)
	} else if h.cfg.DeepSeekAPIKey != "" {
		return h.callDeepSeekWithSystemPrompt(systemPrompt, userPrompt)
	} else if h.cfg.GeminiAPIKey != "" {
		return h.callGeminiWithSystemPrompt(systemPrompt, userPrompt)
	}
	return "", fmt.Errorf("no AI service configured")
}

func (h *AIHandler) callGeminiWithSystemPrompt(systemPrompt, userPrompt string) (string, error) {
	geminiBody := geminiRequest{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{Text: systemPrompt},
					{Text: userPrompt},
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

func (h *AIHandler) callOpenAIWithSystemPrompt(systemPrompt, userPrompt string) (string, error) {
	openAIBody := map[string]interface{}{
		"model": "gpt-4o-mini",
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
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

func (h *AIHandler) callDeepSeekWithSystemPrompt(systemPrompt, userPrompt string) (string, error) {
	deepSeekBody := map[string]interface{}{
		"model": "deepseek-chat",
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
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
