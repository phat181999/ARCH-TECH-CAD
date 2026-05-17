package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/google/uuid"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// CollaborationMessage represents a message sent over WebSocket
type CollaborationMessage struct {
	Type      string          `json:"type"`
	DrawingID string          `json:"drawingId"`
	UserID    string          `json:"userId"`
	Username  string          `json:"username"`
	Payload   json.RawMessage `json:"payload"`
	Timestamp int64           `json:"timestamp"`
}

// CursorPayload for cursor position sharing
type CursorPayload struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// ElementOperation for CRDT-like element sync
type ElementOperation struct {
	Op    string          `json:"op"` // "add", "update", "delete"
	ID    string          `json:"id"`
	Data  json.RawMessage `json:"data,omitempty"`
	Layer string          `json:"layer,omitempty"`
}

// DrawingSession manages WebSocket connections for a drawing
type DrawingSession struct {
	ID      string
	Clients map[string]*Client
	mu      sync.RWMutex
}

// Client represents a single WebSocket connection
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

// HandleWebSocket handles WebSocket upgrade and communication
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	drawingID := r.URL.Query().Get("drawingId")
	userID := r.URL.Query().Get("userId")
	username := r.URL.Query().Get("username")

	if drawingID == "" || userID == "" {
		http.Error(w, "drawingId and userId required", http.StatusBadRequest)
		return
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

	// Send user list to new client
	users := session.getUsers()
	userListMsg, _ := json.Marshal(CollaborationMessage{
		Type:      "users",
		DrawingID: drawingID,
		Payload:   mustMarshal(users),
		Timestamp: time.Now().UnixMilli(),
	})
	client.Send <- userListMsg

	// Broadcast join
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
		session.mu.Lock()
		delete(session.Clients, c.ID)
		session.mu.Unlock()

		// Broadcast leave
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

		// Broadcast to all other clients
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