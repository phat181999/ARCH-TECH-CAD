ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS drawing_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_drawing_id ON chat_sessions(drawing_id);
