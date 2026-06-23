package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"autocard-backend/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type CollaborationMessage struct {
	Type      string          `json:"type"`
	DrawingID string          `json:"drawingId"`
	UserID    string          `json:"userId"`
	Username  string          `json:"username"`
	Payload   json.RawMessage `json:"payload"`
	Version   int             `json:"version,omitempty"`
	Timestamp int64           `json:"timestamp"`
}

type CursorPayload struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type ElementOperation struct {
	Op    string          `json:"op"`
	ID    string          `json:"id"`
	Data  json.RawMessage `json:"data,omitempty"`
	Layer string          `json:"layer,omitempty"`
}

type ObjectLockPayload struct {
	ObjectID string `json:"objectId"`
	Action   string `json:"action"` // "lock", "unlock"
}

type DrawingSession struct {
	ID      string
	Clients map[string]*Client
	Locks   map[string]string // objectID -> clientID
	mu      sync.RWMutex
}

type Client struct {
	ID       string
	UserID   string
	Username string
	Conn     *websocket.Conn
	Send     chan []byte
	Drawing  string
}

var (
	sessions = make(map[string]*DrawingSession)
	sMu      sync.RWMutex
)

func getOrCreateSession(drawingID string) *DrawingSession {
	sMu.RLock()
	s, ok := sessions[drawingID]
	sMu.RUnlock()
	if ok {
		return s
	}
	sMu.Lock()
	defer sMu.Unlock()
	if s, ok := sessions[drawingID]; ok {
		return s
	}
	s = &DrawingSession{
		ID:      drawingID,
		Clients: make(map[string]*Client),
		Locks:   make(map[string]string),
	}
	sessions[drawingID] = s
	return s
}

func (s *DrawingSession) broadcast(msg []byte, senderID string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for id, client := range s.Clients {
		if id == senderID {
			continue
		}
		select {
		case client.Send <- msg:
		default:
			close(client.Send)
			delete(s.Clients, id)
		}
	}
}

func (s *DrawingSession) getUsers() []map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	users := make([]map[string]string, 0, len(s.Clients))
	for _, c := range s.Clients {
		users = append(users, map[string]string{
			"id":       c.UserID,
			"username": c.Username,
		})
	}
	return users
}

type CollaborationHandler struct {
	drawingRepo *repository.DrawingRepo
	userRepo    *repository.UserRepo
	memberRepo  *repository.MemberRepo
	jwtSecret   string
}

func NewCollaborationHandler(
	drawingRepo *repository.DrawingRepo,
	userRepo *repository.UserRepo,
	memberRepo *repository.MemberRepo,
	jwtSecret string,
) *CollaborationHandler {
	return &CollaborationHandler{
		drawingRepo: drawingRepo,
		userRepo:    userRepo,
		memberRepo:  memberRepo,
		jwtSecret:   jwtSecret,
	}
}

func (h *CollaborationHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	drawingID := r.URL.Query().Get("drawingId")
	tokenStr := r.URL.Query().Get("token")

	if drawingID == "" || tokenStr == "" {
		http.Error(w, "drawingId and token are required", http.StatusBadRequest)
		return
	}

	// Validate JWT Token
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(h.jwtSecret), nil
	})
	if err != nil || !token.Valid {
		http.Error(w, "invalid or expired token", http.StatusUnauthorized)
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		http.Error(w, "invalid token claims", http.StatusUnauthorized)
		return
	}

	userID, ok := claims["user_id"].(string)
	if !ok {
		http.Error(w, "invalid user_id in token", http.StatusUnauthorized)
		return
	}

	roleType, _ := claims["role_type"].(string)

	// Enforce drawing level permissions (IDOR/BOLA check)
	role, err := h.drawingRepo.GetUserRole(drawingID, userID)
	if err != nil || role == "" {
		http.Error(w, "forbidden: no access to this drawing", http.StatusForbidden)
		return
	}

	// Fetch database-backed username to prevent spoofing
	username := "Anonymous"
	if roleType == "member" {
		member, err := h.memberRepo.FindByID(userID)
		if err == nil && member != nil {
			username = member.Name
		}
	} else {
		user, err := h.userRepo.FindByID(userID)
		if err == nil && user != nil {
			username = user.Name
		}
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	clientID := uuid.New().String()
	client := &Client{
		ID:       clientID,
		UserID:   userID,
		Username: username,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		Drawing:  drawingID,
	}

	session := getOrCreateSession(drawingID)
	session.mu.Lock()
	session.Clients[clientID] = client
	session.mu.Unlock()

	users := session.getUsers()
	userListMsg, _ := json.Marshal(CollaborationMessage{
		Type:      "users",
		DrawingID: drawingID,
		Payload:   mustMarshal(users),
		Timestamp: time.Now().UnixMilli(),
	})
	client.Send <- userListMsg

	// Send current locks to new client
	session.mu.RLock()
	locksCopy := make(map[string]string)
	for k, v := range session.Locks {
		locksCopy[k] = v
	}
	session.mu.RUnlock()
	if len(locksCopy) > 0 {
		locksMsg, _ := json.Marshal(CollaborationMessage{
			Type:      "locks",
			DrawingID: drawingID,
			Payload:   mustMarshal(locksCopy),
			Timestamp: time.Now().UnixMilli(),
		})
		client.Send <- locksMsg
	}

	joinMsg, _ := json.Marshal(CollaborationMessage{
		Type:      "join",
		DrawingID: drawingID,
		UserID:    userID,
		Username:  username,
		Timestamp: time.Now().UnixMilli(),
	})
	session.broadcast(joinMsg, clientID)

	go client.writePump()
	go client.readPump(session)
}

func (c *Client) readPump(session *DrawingSession) {
	defer func() {
		// Release all locks held by this client
		session.mu.Lock()
		for objID, clID := range session.Locks {
			if clID == c.ID {
				delete(session.Locks, objID)
				unlockMsg, _ := json.Marshal(CollaborationMessage{
					Type:      "objectUnlock",
					DrawingID: c.Drawing,
					Payload:   mustMarshal(ObjectLockPayload{ObjectID: objID, Action: "unlock"}),
					Timestamp: time.Now().UnixMilli(),
				})
				session.mu.Unlock()
				session.broadcast(unlockMsg, c.ID)
				session.mu.Lock()
			}
		}
		delete(session.Clients, c.ID)
		session.mu.Unlock()

		leaveMsg, _ := json.Marshal(CollaborationMessage{
			Type:      "leave",
			DrawingID: c.Drawing,
			UserID:    c.UserID,
			Username:  c.Username,
			Timestamp: time.Now().UnixMilli(),
		})
		session.broadcast(leaveMsg, c.ID)

		c.Conn.Close()
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var msg CollaborationMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Invalid message: %v", err)
			continue
		}

		msg.UserID = c.UserID
		msg.Username = c.Username
		msg.Timestamp = time.Now().UnixMilli()

		// Handle object locking
		if msg.Type == "objectLock" {
			var lockPayload ObjectLockPayload
			json.Unmarshal(msg.Payload, &lockPayload)

			session.mu.Lock()
			if lockPayload.Action == "lock" {
				if _, exists := session.Locks[lockPayload.ObjectID]; !exists {
					session.Locks[lockPayload.ObjectID] = c.ID
				}
			} else if lockPayload.Action == "unlock" {
				delete(session.Locks, lockPayload.ObjectID)
			}
			session.mu.Unlock()
		}

		session.broadcast(message, c.ID)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func mustMarshal(v interface{}) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}
