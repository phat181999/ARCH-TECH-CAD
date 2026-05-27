# AutoCard — Agent Instructions

AutoCard is a browser-based architectural CAD application: 2D/3D drawing, AI-assisted floor plan generation, real-time collaboration, and a modular block library.

## Repo shape

| Path | Purpose |
|---|---|
| `frontend/` | React 19 + TypeScript + Vite + Zustand + Three.js — the drawing editor |
| `backend/` | Go 1.22 + net/http + GORM + PostgreSQL — REST API + WebSocket |

## Skills (read these before writing code)

| Skill | When to use |
|---|---|
| `.claude/skills/frontend/SKILL.md` | Any change in `frontend/` — tools, canvas, stores, blocks, UI |
| `.claude/skills/backend/SKILL.md` | Any change in `backend/` — endpoints, models, migrations, auth, AI |

## Ports

- Frontend dev server: **51530**
- Backend HTTP + WebSocket: **8080**
- Vite proxies `/api/*` → backend automatically

## Key boundaries

- Frontend tools only call store methods — never direct API calls from tool classes.
- Backend handlers only call repository methods — never raw GORM outside `repository/`.
- `backend/cad/schema/` must stay in sync with `frontend/src/cad/contracts/`.
- Old drawing system (`src/types.ts` + `drawingStore.ts`) and new CAD system (`src/cad/`) are parallel — do not mix them.
- Type-check after every frontend change: `cd frontend && npx tsc --noEmit`.
- The pre-existing error in `frontend/src/pages/StoreOrderPage.tsx:493` can be ignored.

---

## Behavioral Guidelines (Karpathy)

Bias toward caution over speed. Trivial tasks: use judgment.

### 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.
- State assumptions explicitly. If uncertain, ask.
- Multiple interpretations → present them, don't pick silently.
- Simpler approach exists → say so. Push back when warranted.
- Unclear → stop. Name what's confusing. Ask.

### 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility"/"configurability" not requested.
- No error handling for impossible scenarios.
- 200 lines that could be 50 → rewrite.
- Test: "Would a senior engineer call this overcomplicated?" If yes, simplify.

### 3. Surgical Changes
Touch only what you must. Clean up only your own mess.
- Don't "improve" adjacent code, comments, formatting.
- Don't refactor things that aren't broken.
- Match existing style even if you'd do it differently.
- Unrelated dead code → mention, don't delete.
- Remove imports/vars/fns that YOUR changes orphaned. Don't remove pre-existing dead code unless asked.
- Test: every changed line traces directly to user request.

### 4. Goal-Driven Execution
Define success criteria. Loop until verified.
- "Add validation" → write tests for invalid inputs, make them pass.
- "Fix bug" → write reproducing test, make it pass.
- "Refactor X" → tests pass before and after.

Multi-step tasks: state brief plan with per-step verify check.

Working if: fewer unnecessary diff changes, fewer rewrites from overcomplication, clarifying questions come before implementation.
