package models

import "time"

type Drawing struct {
ID        string    `json:"id"`
UserID    string    `json:"user_id"`
Name      string    `json:"name"`
Data      string    `json:"data"`
CreatedAt time.Time `json:"created_at"`
UpdatedAt time.Time `json:"updated_at"`
}

type SaveDrawingRequest struct {
Name string `json:"name"`
Data string `json:"data"`
}
