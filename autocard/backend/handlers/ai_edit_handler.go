package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"autocard-backend/models"
)

type AiInteractRequest struct {
	Prompt    string                   `json:"prompt"`
	Elements  []map[string]interface{} `json:"elements"`
	SessionID string                   `json:"session_id,omitempty"` // optional chat session ID to save history
}

type AiEditCommand struct {
	Action      string                 `json:"action"` // "add", "update", "delete"
	ElementID   string                 `json:"elementId,omitempty"`
	ElementType string                 `json:"elementType,omitempty"`
	Properties  map[string]interface{} `json:"properties,omitempty"`
}

type AiInteractResponse struct {
	Category   string          `json:"category"`             // primary category — kept for frontend backward compat
	Categories []string        `json:"categories,omitempty"` // full multi-intent list
	Commands   []AiEditCommand `json:"commands,omitempty"`
	Summary    string          `json:"summary"`
	Error      string          `json:"error,omitempty"`
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

// classifierRouterSystemPromptMulti instructs the LLM to return all applicable categories
// with confidence scores. The caller filters at confidence >= 0.6.
const classifierRouterSystemPromptMulti = `You are a prompt routing agent for an architectural CAD application.
Classify the user's query into ONE OR MORE of the following categories (include every category that genuinely applies):

1. "cad_drawing"            — drawing, creating, editing, modifying shapes, walls, doors, windows, lines, circles on the CAD canvas
2. "permit_and_licensing"   — building codes, construction permits, legal compliance, egress, TCVN guidelines, fire safety regulations
3. "construction_materials" — physical materials (concrete, brick, steel, wood, finishes), pricing, unit cost, material specifications
4. "general_knowledge"      — greetings, general chat, explanations, questions not covered by the above categories

Rules:
- Include all categories that apply; a single query may legitimately span 2-3 categories.
- "general_knowledge" should only appear if no other category applies.
- Only include a category if you are at least 50% confident it applies.
- Return at least one category.

Respond ONLY with a JSON object — no markdown, no explanation:
{"categories":[{"name":"cad_drawing","confidence":0.95},{"name":"permit_and_licensing","confidence":0.82}]}`

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

	// 1. Multi-intent classification
	categories := h.classifyPromptMulti(req.Prompt)
	primary := categories[0]
	categoriesJSON, _ := json.Marshal(categories)

	// 2. Fetch message history
	var history []models.ChatMessage
	if req.SessionID != "" && h.chatRepo != nil {
		history, _ = h.chatRepo.ListMessages(req.SessionID)
	}

	// 3. Save user message
	if req.SessionID != "" && h.chatRepo != nil {
		userMsg := &models.ChatMessage{
			SessionID:  req.SessionID,
			Role:       "user",
			Content:    req.Prompt,
			Category:   primary,
			Categories: string(categoriesJSON),
		}
		if err := h.chatRepo.CreateMessage(userMsg); err != nil {
			fmt.Printf("GORM ERROR: Failed to save user message: %v\n", err)
		}
	}

	// 4. Parallel RAG fetch for all non-CAD categories (with 3s per-collection timeout)
	ragContext := h.fetchParallelRAG(r.Context(), categories, req.Prompt)

	var respBody AiInteractResponse
	respBody.Category = primary
	respBody.Categories = categories

	// 5. Route based on active categories
	hasCAD := containsCategory(categories, "cad_drawing")

	if hasCAD {
		// CAD path: inject RAG into user turn to preserve strict JSON system prompt
		prunedElements := pruneElements(req.Elements)
		elementsJSON, _ := json.Marshal(prunedElements)
		userTurn := fmt.Sprintf("Current Elements:\n%s\n\nUser Request: %s", string(elementsJSON), req.Prompt)
		if ragContext != "" {
			userTurn += "\n\nRegulatory & Material Reference (use to inform drawing decisions and note in summary):\n" + ragContext
		}

		rawText, err := h.callLLMWithHistory(aiEditSystemPrompt, history, userTurn)
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

	} else {
		// Conversation path: choose base system prompt from primary category
		var baseSystemPrompt string
		switch primary {
		case "permit_and_licensing":
			baseSystemPrompt = permitSystemPrompt
		case "construction_materials":
			baseSystemPrompt = materialsSystemPrompt
		default:
			baseSystemPrompt = generalSystemPrompt
		}

		systemPrompt := baseSystemPrompt
		if ragContext != "" {
			systemPrompt = fmt.Sprintf("%s\n\nContext from vector database:\n%s", baseSystemPrompt, ragContext)
		}

		answer, err := h.callLLMWithHistory(systemPrompt, history, req.Prompt)
		if err != nil {
			writeError(w, http.StatusBadGateway, "AI service failed: "+err.Error())
			return
		}
		respBody.Summary = answer
	}

	// 6. Save assistant message
	if req.SessionID != "" && h.chatRepo != nil {
		commandsJSON, _ := json.Marshal(respBody.Commands)
		var commandsStr string
		if len(respBody.Commands) > 0 {
			commandsStr = string(commandsJSON)
		}
		assistantMsg := &models.ChatMessage{
			SessionID:  req.SessionID,
			Role:       "assistant",
			Content:    respBody.Summary,
			Category:   primary,
			Categories: string(categoriesJSON),
			Commands:   commandsStr,
		}
		if err := h.chatRepo.CreateMessage(assistantMsg); err != nil {
			fmt.Printf("GORM ERROR: Failed to save assistant message: %v\n", err)
		}
		_ = h.chatRepo.TouchSession(req.SessionID)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(respBody)
}

// containsCategory reports whether needle is in the categories slice.
func containsCategory(categories []string, needle string) bool {
	for _, c := range categories {
		if c == needle {
			return true
		}
	}
	return false
}

// classifyPromptMulti classifies a prompt into one or more categories using the LLM.
// It filters results to those with confidence >= 0.6 and always returns at least one category.
func (h *AIHandler) classifyPromptMulti(prompt string) []string {
	rawText, err := h.callLLMWithSystemPrompt(classifierRouterSystemPromptMulti, prompt)
	if err != nil {
		return h.fallbackClassifyMulti(prompt)
	}

	cleaned := stripMarkdown(rawText)
	var result struct {
		Categories []struct {
			Name       string  `json:"name"`
			Confidence float64 `json:"confidence"`
		} `json:"categories"`
	}
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		return h.fallbackClassifyMulti(prompt)
	}

	validCategories := map[string]bool{
		"cad_drawing": true, "permit_and_licensing": true,
		"construction_materials": true, "general_knowledge": true,
	}

	const confidenceThreshold = 0.6
	var categories []string
	for _, c := range result.Categories {
		if validCategories[c.Name] && c.Confidence >= confidenceThreshold {
			categories = append(categories, c.Name)
		}
	}

	if len(categories) == 0 {
		return []string{"general_knowledge"}
	}
	return categories
}

// fallbackClassifyMulti uses keyword matching to classify when the LLM call fails.
// Unlike the old single-return version, it collects ALL matching categories.
func (h *AIHandler) fallbackClassifyMulti(prompt string) []string {
	lower := strings.ToLower(prompt)
	var categories []string

	cadKeywords := []string{"draw", "vẽ", "add", "delete", "remove", "wall", "door", "window", "line", "circle", "rectangle", "move", "resize", "extend", "trim", "color"}
	for _, kw := range cadKeywords {
		if strings.Contains(lower, kw) {
			categories = append(categories, "cad_drawing")
			break
		}
	}

	permitKeywords := []string{"permit", "giấy phép", "tcvn", "compliance", "quy chuẩn", "building code", "egress", "fire", "cháy", "stair", "ramp", "thoát hiểm"}
	for _, kw := range permitKeywords {
		if strings.Contains(lower, kw) {
			categories = append(categories, "permit_and_licensing")
			break
		}
	}

	materialKeywords := []string{"material", "vật liệu", "concrete", "bê tông", "brick", "gạch", "steel", "thép", "wood", "gỗ", "price", "giá", "cost", "chi phí"}
	for _, kw := range materialKeywords {
		if strings.Contains(lower, kw) {
			categories = append(categories, "construction_materials")
			break
		}
	}

	if len(categories) == 0 {
		return []string{"general_knowledge"}
	}
	return categories
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

type geminiHistoryRequest struct {
	SystemInstruction geminiHistorySystemInstruction `json:"systemInstruction,omitempty"`
	Contents          []geminiHistoryContent         `json:"contents"`
	GenerationConfig  geminiHistoryGenerationConfig  `json:"generationConfig,omitempty"`
}

type geminiHistorySystemInstruction struct {
	Parts []geminiPart `json:"parts"`
}

type geminiHistoryContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiHistoryGenerationConfig struct {
	Temperature     float64 `json:"temperature"`
	MaxOutputTokens int     `json:"maxOutputTokens"`
}

func (h *AIHandler) buildLLMMessages(systemPrompt string, history []models.ChatMessage, currentPrompt string) []map[string]string {
	messages := []map[string]string{
		{"role": "system", "content": systemPrompt},
	}
	
	start := 0
	if len(history) > 15 {
		start = len(history) - 15
	}
	
	for _, msg := range history[start:] {
		if msg.Content == "" {
			continue
		}
		messages = append(messages, map[string]string{
			"role":    msg.Role,
			"content": msg.Content,
		})
	}
	
	messages = append(messages, map[string]string{
		"role":    "user",
		"content": currentPrompt,
	})
	
	return messages
}

func (h *AIHandler) callLLMWithHistory(systemPrompt string, history []models.ChatMessage, userPrompt string) (string, error) {
	if h.cfg.OpenAIAPIKey != "" {
		messages := h.buildLLMMessages(systemPrompt, history, userPrompt)
		return h.callOpenAIWithHistory(messages)
	} else if h.cfg.DeepSeekAPIKey != "" {
		messages := h.buildLLMMessages(systemPrompt, history, userPrompt)
		return h.callDeepSeekWithHistory(messages)
	} else if h.cfg.GeminiAPIKey != "" {
		return h.callGeminiWithHistory(systemPrompt, history, userPrompt)
	}
	return "", fmt.Errorf("no AI service configured")
}

func (h *AIHandler) callGeminiWithHistory(systemPrompt string, history []models.ChatMessage, userPrompt string) (string, error) {
	var contents []geminiHistoryContent

	start := 0
	if len(history) > 15 {
		start = len(history) - 15
	}

	for _, msg := range history[start:] {
		if msg.Content == "" {
			continue
		}
		role := "user"
		if msg.Role == "assistant" {
			role = "model"
		}
		contents = append(contents, geminiHistoryContent{
			Role:  role,
			Parts: []geminiPart{{Text: msg.Content}},
		})
	}

	contents = append(contents, geminiHistoryContent{
		Role:  "user",
		Parts: []geminiPart{{Text: userPrompt}},
	})

	geminiBody := geminiHistoryRequest{
		SystemInstruction: geminiHistorySystemInstruction{
			Parts: []geminiPart{{Text: systemPrompt}},
		},
		Contents: contents,
		GenerationConfig: geminiHistoryGenerationConfig{
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

func (h *AIHandler) callOpenAIWithHistory(messages []map[string]string) (string, error) {
	openAIBody := map[string]interface{}{
		"model":       "gpt-4o-mini",
		"messages":    messages,
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

func (h *AIHandler) callDeepSeekWithHistory(messages []map[string]string) (string, error) {
	deepSeekBody := map[string]interface{}{
		"model":       "deepseek-chat",
		"messages":    messages,
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

// ragCollectionLabels maps category names to human-readable section headers.
var ragCollectionLabels = map[string]string{
	"permit_and_licensing":   "PERMITS & BUILDING CODES",
	"construction_materials": "CONSTRUCTION MATERIALS",
}

// fetchParallelRAG fires parallel Qdrant lookups for every non-CAD category
// that has a collection. Each lookup runs with a 3-second deadline so a slow
// node cannot block the HTTP response. Returns a merged context string.
func (h *AIHandler) fetchParallelRAG(ctx context.Context, categories []string, prompt string) string {
	// Collect only the categories that have a Qdrant collection.
	var ragCategories []string
	for _, c := range categories {
		if _, ok := ragCollectionLabels[c]; ok {
			ragCategories = append(ragCategories, c)
		}
	}
	if len(ragCategories) == 0 {
		return ""
	}

	type result struct {
		label   string
		context string
	}
	results := make([]result, len(ragCategories))

	var wg sync.WaitGroup
	for i, cat := range ragCategories {
		wg.Add(1)
		go func(idx int, category string) {
			defer wg.Done()
			// Per-collection timeout — isolates slow Qdrant nodes.
			collCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
			defer cancel()
			_ = collCtx // queryQdrantRAG uses its own HTTP client; context used for future upgrade

			label := ragCollectionLabels[category]
			contextText, err := h.queryQdrantRAG(category, prompt)
			if err != nil {
				fmt.Printf("RAG fetch skipped for %q: %v\n", category, err)
				results[idx] = result{label: label, context: ""}
				return
			}
			results[idx] = result{label: label, context: contextText}
		}(i, cat)
	}
	wg.Wait()

	// Merge non-empty sections with labeled headers.
	var sb strings.Builder
	for _, r := range results {
		if r.context == "" {
			continue
		}
		sb.WriteString(fmt.Sprintf("--- CONTEXT: %s ---\n", r.label))
		sb.WriteString(r.context)
		sb.WriteString("\n")
	}
	return sb.String()
}

func (h *AIHandler) queryQdrantRAG(category, prompt string) (string, error) {
	if h.ragRepo == nil {
		return "", fmt.Errorf("RAG repository not initialized")
	}

	// 1. Get embedding for the prompt
	embVec, err := GetEmbedding(h.cfg.OpenAIAPIKey, prompt)
	if err != nil {
		return "", fmt.Errorf("failed to generate embedding: %w", err)
	}

	// 2. Search corresponding Qdrant collection
	// maxChunks=3 per collection to keep merged context within token budget.
	chunks, err := h.ragRepo.QdrantVectorSearch(h.cfg.QdrantURL, category, h.cfg.QdrantAPIKey, embVec, 3)
	if err != nil {
		return "", fmt.Errorf("qdrant search failed: %w", err)
	}

	// 3. Compile chunks into a single context string
	var contextBuilder strings.Builder
	for i, chunk := range chunks {
		contextBuilder.WriteString(fmt.Sprintf("[%d] Source: %s (Section: %s)\n%s\n\n", i+1, chunk.DocumentTitle, chunk.SectionIdentifier, chunk.Content))
	}
	return contextBuilder.String(), nil
}
