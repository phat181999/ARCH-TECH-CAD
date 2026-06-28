# Implementation Tasks

## Frontend
- [x] Create shared Zustand `chatStore.ts` (in-memory only, no localStorage/sessionStorage)
- [x] Refactor `AiCommandBox.tsx` — fix Enter key duplication with `isGeneratingRef` guard + `e.preventDefault()`
- [x] Refactor `AiCommandBox.tsx` — consume shared `useChatStore` for messages & session
- [x] Refactor `AIAssistantPanel.tsx` — consume shared `useChatStore` for messages & session
- [x] Remove any `localStorage`/`sessionStorage` chat references

## Backend
- [x] Add `callLLMWithHistory` method to `AIHandler`
- [x] Add `callGeminiWithHistory`, `callOpenAIWithHistory`, `callDeepSeekWithHistory`
- [x] Update `HandleInteract` to load chat history from DB when `session_id` is provided
- [x] Update classify + RAG routes to pass history context

## Verification
- [x] `go build ./...` passes
- [x] `npx tsc --noEmit` passes
