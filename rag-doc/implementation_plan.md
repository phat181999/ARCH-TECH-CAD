# Plan to Fix Chat Message Duplication & Add History to AI Interact Flow

This plan addresses two main issues in the CAD editor's chat interface:
1. **Message Duplication on Enter**: Hitting Enter inside the COMMAND AI box causes duplicate requests and duplicate chat bubbles in the UI.
2. **Context Memory for AI Interact Flow**: The `/api/ai/interact` endpoint is stateless with respect to chat history (RAG code compliance checks, materials estimation, and drawing modifications are currently processed without the context of prior messages in the active session).

> [!IMPORTANT]
> **Client-Side Storage Constraints**: Under no circumstances will chat messages, histories, or active session IDs be stored in browser client-side storage (`localStorage` or `sessionStorage`). The frontend will maintain all state dynamically in-memory using React/Zustand store variables and retrieve historical content purely through database API queries.

---

## 🛠️ Proposed Changes

### 1. Unified Shared Chat Store
To ensure the sidebar (`AIAssistantPanel.tsx`) and the floating box (`AiCommandBox.tsx`) are always in sync and sharing the same active chat session, we will introduce a new Zustand store.

#### [NEW] [chatStore.ts](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/stores/chatStore.ts)
- A shared store managing:
  - `activeSessionId` (string | null)
  - `sessions` (ChatSessionInfo[])
  - `messages` (ChatMessage[])
  - `isProcessing` (boolean)
- Exports actions to load sessions on mount, select a session, start a new chat, and append messages.
- **This store resides strictly in-memory** and does not write to `localStorage` or `sessionStorage`.

---

### 2. Frontend Changes

#### [MODIFY] [AiCommandBox.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/pages/CanvasEditor/components/AiCommandBox.tsx)
- Refactor state variables (`activeSessionId`, `messages`, `sessions`) to consume the shared Zustand store `useChatStore`.
- Update `handleKeyDown` to call `e.preventDefault()` when `Enter` is pressed.
- Implement an execution guard using a React Ref (`isGeneratingRef.current`) to block duplicate submissions in the same keypress tick:
  ```typescript
  const isGeneratingRef = useRef(false);
  
  const handleGenerate = async () => {
    const prompt = commandInput.trim();
    if (!prompt || isGeneratingRef.current) return;
    
    isGeneratingRef.current = true;
    setIsAiLoading(true);
    // execute API call...
    isGeneratingRef.current = false;
  };
  ```

#### [MODIFY] [AIAssistantPanel.tsx](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/frontend/src/panels/AIAssistantPanel.tsx)
- Refactor to consume the shared Zustand store `useChatStore` for seamless real-time message sync between the sidebar and the COMMAND AI box.

---

### 3. Backend Changes

#### [MODIFY] [ai_edit_handler.go](file:///Users/phatho/Projects/Personal/ARCH-TECH-CAD/autocard/backend/handlers/ai_edit_handler.go)
- Retrieve chat history list from `chatRepo` at the start of the `Interact` handler if `SessionID` is provided.
- Introduce `callLLMWithHistory` method to format the conversation history and route request payloads to OpenAI, DeepSeek, or Gemini history handlers.
- Add `callGeminiWithHistory` to format history using the native Gemini API format (setting `systemInstruction` and a multi-turn `contents` array with `model` and `user` roles).
- Add `callOpenAIWithHistory` and `callDeepSeekWithHistory` to send messages using the standard list format.
- Feed the retrieved history to all switches of the classified category (permit compliance, material catalogs, drawing commands, and general queries).

---

## 🧪 Verification Plan

### Automated Tests
1. Verify Go backend compilation:
   ```bash
   cd autocard/backend && go build ./...
   ```
2. Run backend handler unit tests:
   ```bash
   cd autocard/backend && go test ./...
   ```
3. Verify TypeScript check:
   ```bash
   cd autocard/frontend && npx tsc --noEmit
   ```

### Manual Verification
1. **Duplicate Test**:
   - Open the COMMAND AI canvas box, type a message, hit Enter rapidly, and verify that only a single request is sent and only one chat bubble appears.
2. **Context Memory Test**:
   - Ask a question (e.g. "What is TCVN 4319?").
   - Follow up with a contextual prompt (e.g. "What is its fire rating requirement?").
   - Verify that the assistant responds with context of the previous query.
