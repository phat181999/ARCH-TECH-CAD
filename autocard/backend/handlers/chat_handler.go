package handlers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"autocard-backend/config"
	"autocard-backend/middleware"
	"autocard-backend/models"
	"autocard-backend/repository"
)

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatHandler struct {
	chatRepo *repository.ChatRepo
	cfg      *config.Config
}

func NewChatHandler(chatRepo *repository.ChatRepo, cfg *config.Config) *ChatHandler {
	return &ChatHandler{chatRepo: chatRepo, cfg: cfg}
}

type createSessionRequest struct {
	Title     string `json:"title"`
	DrawingID string `json:"drawing_id"`
}

type sendMessageRequest struct {
	Content  string                   `json:"content"`
	Elements []map[string]interface{} `json:"elements,omitempty"` // current canvas elements for CAD context
}

type classificationResult struct {
	Category   string  `json:"category"`
	Confidence float64 `json:"confidence"`
}

func writeChatError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func writeChatJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

// ── GET /api/chat/sessions ────────────────────────────────────────────────────

func (h *ChatHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeChatError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	drawingID := r.URL.Query().Get("drawing_id")
	sessions, err := h.chatRepo.ListSessions(userID, drawingID)
	if err != nil {
		writeChatError(w, http.StatusInternalServerError, "failed to list sessions")
		return
	}
	if sessions == nil {
		sessions = []models.ChatSession{}
	}

	writeChatJSON(w, sessions)
}

// ── POST /api/chat/sessions ───────────────────────────────────────────────────

func (h *ChatHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeChatError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req createSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Title = "New Chat"
	}
	if req.Title == "" {
		req.Title = "New Chat"
	}

	session := &models.ChatSession{
		UserID:    userID,
		TenantID:  userID, // simplified: use userID as tenantID for now
		Title:     req.Title,
		DrawingID: req.DrawingID,
	}

	if err := h.chatRepo.CreateSession(session); err != nil {
		writeChatError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	w.WriteHeader(http.StatusCreated)
	writeChatJSON(w, session)
}

// ── GET /api/chat/sessions/{id}/messages ──────────────────────────────────────

func (h *ChatHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeChatError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	sessionID := r.PathValue("id")
	if sessionID == "" {
		writeChatError(w, http.StatusBadRequest, "missing session id")
		return
	}

	// Verify ownership
	if _, err := h.chatRepo.GetSession(sessionID, userID); err != nil {
		writeChatError(w, http.StatusNotFound, "session not found")
		return
	}

	messages, err := h.chatRepo.ListMessages(sessionID)
	if err != nil {
		writeChatError(w, http.StatusInternalServerError, "failed to list messages")
		return
	}
	if messages == nil {
		messages = []models.ChatMessage{}
	}

	writeChatJSON(w, messages)
}

// ── DELETE /api/chat/sessions/{id} ────────────────────────────────────────────

func (h *ChatHandler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeChatError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	sessionID := r.PathValue("id")
	if sessionID == "" {
		writeChatError(w, http.StatusBadRequest, "missing session id")
		return
	}

	if err := h.chatRepo.DeleteSession(sessionID, userID); err != nil {
		writeChatError(w, http.StatusInternalServerError, "failed to delete session")
		return
	}

	writeChatJSON(w, map[string]string{"status": "deleted"})
}

// ── POST /api/chat/sessions/{id}/messages ─────────────────────────────────────
// This is the main entry point. It:
// 1. Persists the user message
// 2. Classifies the prompt
// 3. Streams the AI response via SSE
// 4. Persists the full AI response when complete

func (h *ChatHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	if userID == "" {
		writeChatError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	sessionID := r.PathValue("id")
	if sessionID == "" {
		writeChatError(w, http.StatusBadRequest, "missing session id")
		return
	}

	// Verify ownership
	if _, err := h.chatRepo.GetSession(sessionID, userID); err != nil {
		writeChatError(w, http.StatusNotFound, "session not found")
		return
	}

	var req sendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Content == "" {
		writeChatError(w, http.StatusBadRequest, "'content' field is required")
		return
	}

	// 1. Persist user message
	userMsg := &models.ChatMessage{
		SessionID: sessionID,
		Role:      "user",
		Content:   req.Content,
	}
	if err := h.chatRepo.CreateMessage(userMsg); err != nil {
		writeChatError(w, http.StatusInternalServerError, "failed to save message")
		return
	}

	// 2. Classify the prompt
	category := h.classifyPrompt(req.Content)

	// 3. Build conversation history for context (last 20 messages)
	history, _ := h.chatRepo.ListMessages(sessionID)
	conversationMessages := h.buildConversationMessages(history, category)

	// 4. Stream AI response via SSE
	h.streamChatResponse(w, conversationMessages, sessionID, category)

	// 5. Touch session updated_at
	_ = h.chatRepo.TouchSession(sessionID)

	// Auto-title: if this is the first user message, update the session title
	if len(history) <= 1 { // only the message we just created
		title := req.Content
		if len(title) > 60 {
			title = title[:60] + "..."
		}
		_ = h.chatRepo.UpdateSessionTitle(sessionID, userID, title)
	}
}

// ── Classification ────────────────────────────────────────────────────────────

const classifierSystemPrompt = `You are a prompt routing agent for an architectural CAD application.
Classify the user's query into exactly one category:

1. "cad_drawing" — drawing, creating, editing, modifying, deleting, coloring shapes, walls, doors, windows, lines, circles on the CAD canvas
2. "permit_and_licensing" — building codes, construction permits, legal rules, compliance, egress, TCVN guidelines, fire safety regulations
3. "construction_materials" — physical materials (concrete, bricks, steel, wood, finishes), pricing, unit cost, material specifications
4. "general_knowledge" — greetings, general chat, explanations, questions not covered by other categories

Respond ONLY with a JSON object:
{"category":"<one_of_the_four>","confidence":0.95}`

func (h *ChatHandler) classifyPrompt(prompt string) string {
	apiKey, apiURL, model := h.resolveProvider()
	if apiKey == "" {
		return h.fallbackClassify(prompt)
	}

	body := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": classifierSystemPrompt},
			{"role": "user", "content": prompt},
		},
		"temperature": 0.1,
		"max_tokens":  100,
	}

	bodyBytes, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", apiURL, bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return h.fallbackClassify(prompt)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return h.fallbackClassify(prompt)
	}

	rawText, err := extractChatContent(resp.Body)
	if err != nil {
		return h.fallbackClassify(prompt)
	}

	cleaned := stripMarkdown(rawText)
	var result classificationResult
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

// fallbackClassify uses simple keyword matching when the LLM is unavailable.
func (h *ChatHandler) fallbackClassify(prompt string) string {
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

// ── SSE Streaming ─────────────────────────────────────────────────────────────

func (h *ChatHandler) buildConversationMessages(history []models.ChatMessage, category string) []map[string]string {
	systemContent := h.buildSystemPrompt(category)

	messages := []map[string]string{
		{"role": "system", "content": systemContent},
	}

	// Include last 20 messages for context
	start := 0
	if len(history) > 20 {
		start = len(history) - 20
	}
	for _, msg := range history[start:] {
		messages = append(messages, map[string]string{
			"role":    msg.Role,
			"content": msg.Content,
		})
	}

	return messages
}

func (h *ChatHandler) buildSystemPrompt(category string) string {
	base := `You are an expert AI assistant for AutoCard, an architectural CAD application used in Vietnam.
You are helpful, concise, and professional. Answer in the same language the user uses.`

	switch category {
	case "cad_drawing":
		return base + `

The user wants to perform CAD drawing operations. Help them with creating, editing, or modifying elements on the canvas.
If they describe a shape or layout, explain how to achieve it step by step.
You can reference common architectural elements: walls, doors, windows, rooms, dimensions, and annotations.`

	case "permit_and_licensing":
		return base + `

The user is asking about building codes, construction permits, or legal compliance.
Reference Vietnamese building standards (TCVN) when applicable.
Provide specific code references and requirements when possible.
Common standards: TCVN 4319 (doors), TCVN 2622 (fire safety), TCVN 4513 (plumbing), TCVN 5687 (ventilation).`

	case "construction_materials":
		return base + `

The user is asking about construction materials, specifications, or pricing.
Provide information about common Vietnamese construction materials.
Include typical unit prices in VND when relevant.
Reference common materials: concrete (bê tông), brick (gạch), steel (thép), wood (gỗ), cement (xi măng), sand (cát), gravel (đá).`

	default:
		return base + `

Answer the user's question helpfully. If they greet you, respond warmly.
If the question relates to architecture or CAD, provide relevant guidance.`
	}
}

func (h *ChatHandler) streamChatResponse(w http.ResponseWriter, messages []map[string]string, sessionID, category string) {
	apiKey, apiURL, model := h.resolveProvider()
	if apiKey == "" {
		writeChatError(w, http.StatusServiceUnavailable, "No AI service configured. Please check the server configuration.")
		return
	}

	body := map[string]interface{}{
		"model":       model,
		"messages":    messages,
		"temperature": 0.7,
		"stream":      true,
	}

	bodyBytes, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", apiURL, bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Chat stream error: %v\n", err)
		writeChatError(w, http.StatusBadGateway, "AI service failed. Please try again.")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		fmt.Printf("Chat stream API error %d: %s\n", resp.StatusCode, string(respBytes))
		writeChatError(w, http.StatusBadGateway, "AI service failed. Please try again.")
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeChatError(w, http.StatusInternalServerError, "Streaming unsupported")
		return
	}

	// Send the classification result as the first event
	classEvent, _ := json.Marshal(map[string]interface{}{
		"type":     "classification",
		"category": category,
	})
	fmt.Fprintf(w, "data: %s\n\n", classEvent)
	flusher.Flush()

	// Stream the LLM response
	var fullContent strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var streamResp struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &streamResp); err != nil {
			continue
		}
		if len(streamResp.Choices) == 0 || streamResp.Choices[0].Delta.Content == "" {
			continue
		}

		chunk := streamResp.Choices[0].Delta.Content
		fullContent.WriteString(chunk)

		chunkEvent, _ := json.Marshal(map[string]interface{}{
			"type":          "content_chunk",
			"content_chunk": chunk,
			"is_done":       false,
		})
		fmt.Fprintf(w, "data: %s\n\n", chunkEvent)
		flusher.Flush()
	}

	// Send done event
	doneEvent, _ := json.Marshal(map[string]interface{}{
		"type":    "content_chunk",
		"is_done": true,
	})
	fmt.Fprintf(w, "data: %s\n\n", doneEvent)
	flusher.Flush()

	// Persist assistant message to database
	assistantMsg := &models.ChatMessage{
		SessionID: sessionID,
		Role:      "assistant",
		Content:   fullContent.String(),
		Category:  category,
	}
	if err := h.chatRepo.CreateMessage(assistantMsg); err != nil {
		fmt.Printf("Failed to persist assistant message: %v\n", err)
	}
}

// ── Provider Resolution ───────────────────────────────────────────────────────

// resolveProvider returns (apiKey, apiURL, model) for the first available provider.
func (h *ChatHandler) resolveProvider() (string, string, string) {
	if h.cfg.OpenAIAPIKey != "" {
		return h.cfg.OpenAIAPIKey, "https://api.openai.com/v1/chat/completions", "gpt-4o-mini"
	}
	if h.cfg.DeepSeekAPIKey != "" {
		return h.cfg.DeepSeekAPIKey, "https://api.deepseek.com/chat/completions", "deepseek-chat"
	}
	if h.cfg.GeminiAPIKey != "" {
		// Gemini uses a different API format; for chat streaming we'll use the OpenAI-compatible endpoint
		return h.cfg.GeminiAPIKey, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "gemini-2.0-flash"
	}
	return "", "", ""
}

// extractChatContent reads a standard OpenAI-compatible response body and returns the text content.
func extractChatContent(body io.Reader) (string, error) {
	respBytes, err := io.ReadAll(body)
	if err != nil {
		return "", err
	}

	var resp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBytes, &resp); err != nil {
		return "", err
	}
	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}
	return resp.Choices[0].Message.Content, nil
}
