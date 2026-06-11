# AutoCard UI Overhaul — Design Spec
**Date:** 2026-06-11  
**Status:** Approved  

## Summary

Full UI overhaul of the AutoCard frontend. Replace the current dark industrial aesthetic with a clean SaaS design (Figma/Linear style). Supports both light and dark mode.

## Design System

| Token | Light | Dark |
|---|---|---|
| Background | `#F8FAFC` (slate-50) | `#0F172A` (slate-900) |
| Surface | `#FFFFFF` | `#1E293B` (slate-800) |
| Surface raised | `#F8FAFC` | `#243447` |
| Border | `#E2E8F0` (slate-200) | `#334155` (slate-700) |
| Text primary | `#0F172A` (slate-900) | `#F1F5F9` (slate-100) |
| Text secondary | `#64748B` (slate-500) | `#64748B` (slate-500) |
| Text muted | `#94A3B8` (slate-400) | `#475569` (slate-600) |
| Accent | `#2563EB` (blue-600) | `#3B82F6` (blue-500) |
| Accent bg | `#EFF6FF` (blue-50) | `rgba(37,99,235,0.15)` |
| Accent border | `#BFDBFE` (blue-200) | `rgba(59,130,246,0.3)` |
| Danger | `#EF4444` | `#EF4444` |
| Success | `#10B981` | `#10B981` |

**Typography:** No more `text-[8px]`/`text-[9px]`/`text-[10px]`. Minimum `text-xs` (12px). Labels use `text-xs font-semibold`. Body uses `text-sm`.

**Border radius:** Buttons/inputs `rounded-lg` (8px). Cards `rounded-xl` (12px). Modals `rounded-2xl` (16px).

**Icons:** All lucide-react SVG icons. No emojis anywhere.

## Pages to Redesign

### 1. Auth Pages (`LoginPage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx`)
- Split layout: left brand panel (blue gradient) + right form panel
- Brand panel: logo, tagline, feature list, footer
- Form: proper input sizing, password strength bar on register, tip box on forgot-password
- OAuth buttons (Google / GitHub) centered at top of register
- Dark mode: navy slate surfaces, same blue accent

### 2. Dashboard (`DrawingDashboard.tsx`)
- TopNav: logo icon + wordmark, notification/settings icon buttons, `+ New Project` CTA, avatar
- Sidebar: org section with logo+name+member count, nav items with active left-border, footer with Invite+Logout
- Main: page title + subtitle, search bar, grid/list toggle
- Cards: gradient thumbnail bg, DWG badge, title, action buttons (duplicate/delete), modified time + owner avatar
- New card: dashed border, centered `+` icon
- Dark mode: `#1E293B` surface, `#334155` borders

### 3. CAD Editor (`CanvasEditor.tsx` + sub-components)

#### EditorHeader
- Left: back button (arrow icon), project name + meta (version, save status)
- Center: tool group (SVG icons for Select/Line/Rect/Circle/Wall/Text/Dim/Pan), `2D|Layout|3D` view switch
- Right: scale select, unit select, Import dropdown, Export dropdown, Save button, theme toggle, avatar

#### Left Tool Strip (new: 48px icon strip, labels)
- Sections: Draw / Modify / Dim / View — each with icon buttons + hover tooltips
- Active tool: blue background, white icon

#### Left Panel (CadSidebar)
- Collapsible sections: Layers, AI Assist
- Layer rows: color dot, name, visibility + lock icons
- AI section: description card, text input, Generate button

#### Canvas
- Dot grid pattern (replaces line grid)
- Blue selection handles (`#2563EB`)
- Collaborator avatars top-right with online dot
- Zoom HUD bottom-right: `−` / `100%` / `+` / `FIT`

#### Right Panel (PropertyPanel)
- Collapsible sections: Properties (X/Y/W/H/Rotation), Appearance (color swatch, line weight, line style, layer)
- Selected element header with type + count

#### StatusBar
- Toggle pills: SNAP / OSNAP / GRID / ORTHO — blue when active, muted when off
- OSNAP chevron opens snap mode dropdown
- Snap type indicator (e.g. `⊙ endpoint`)
- Coordinates right-aligned `text-xs font-mono`

## Dark Mode Approach

Use Tailwind `dark:` variants throughout. No new CSS variables — just apply the dark tokens table above consistently using existing Tailwind classes (`dark:bg-slate-900`, `dark:bg-slate-800`, `dark:border-slate-700`, `dark:text-slate-100`, `dark:text-blue-400`, etc.).

Replace all existing hardcoded hex `dark:bg-[#...]` overrides with semantic Tailwind classes.

## Out of Scope
- Canvas rendering engine changes
- Backend changes
- New features
- Settings page, Admin page, Team page, Block Store page (not included in this sprint)
