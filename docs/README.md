# ARCH-TECH-CAD Documentation

This folder contains technical specifications and workflow documentation for the ARCH-TECH-CAD system.

---

## 📁 Documents

| File | Description |
|---|---|
| [`workflow/SYSTEM_WORKFLOW.md`](./workflow/SYSTEM_WORKFLOW.md) | Full system architecture, diagrams, and workflow for all major features |
| [`BLOCK_STORE_SPEC.md`](./BLOCK_STORE_SPEC.md) | Technical specification for the Organization Block Store & Furniture Import System |

---

## 🗺 Quick Architecture Reference

```
autocard/
├── backend/          → Go REST API (port 8080)
│   ├── handlers/     → HTTP request handlers
│   ├── models/       → DB model structs (GORM)
│   ├── repository/   → DB query layer
│   ├── middleware/   → JWT auth, CORS, logging, role guards
│   ├── migrations/   → SQL migration files
│   └── main.go       → Server setup + route registration
│
└── frontend/         → React + TypeScript SPA (Vite, port 5173)
    └── src/
        ├── pages/        → Full-page components (CanvasEditor, Dashboard, etc.)
        ├── components/   → Shared UI components (CadSidebar, ThreeViewer, etc.)
        ├── canvas/       → 2D rendering engine (CadEngine.ts)
        ├── stores/       → Zustand state (drawingStore.ts)
        ├── services/     → API client functions
        ├── data/         → Static data (blockLibrary.ts)
        └── types.ts      → Shared TypeScript types
```

---

*Last updated: 2026-05-31*
