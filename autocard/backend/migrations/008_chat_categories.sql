-- Migration 008: Add categories column to chat_messages for multi-intent routing
-- Backward compatible: existing rows get NULL, Category (varchar) is kept as primary display field.

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS categories TEXT;
