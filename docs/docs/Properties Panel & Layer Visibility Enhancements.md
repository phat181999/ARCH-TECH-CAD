# Properties Panel & Layer Visibility Enhancements

> **Last updated:** 2026-05-29 — Full implementation complete. All items verified against live code.

---

## Implementation Status

| Feature | Spec | Live Status |
|---|---|---|
| `NumField` local state (no keystroke flicker) | ✅ Required | ✅ **Done** |
| Text element: content / fontSize / textAlign editors | ✅ Required | ✅ **Done** |
| Ellipse element: Cx, Cy, Rx, Ry editors | ✅ Required | ✅ **Done** |
| Dimension element: X1/Y1/X2/Y2 + label override | ✅ Required | ✅ **Done** |
| Polyline: point count display + closed toggle | ✅ Required | ✅ **Done** |
| Layer visibility → hide from 2D click selection | ✅ Required | ✅ **Done** |
| Layer visibility → hide from 3D viewer | ✅ Required | ✅ **Done** |
| Layer row opacity-40 when hidden | ✅ Required | ✅ **Done** |
| Lucide Eye / EyeOff icons | ✅ Required | ✅ **Done** |
| Lucide Lock / Unlock icons | ✅ Required | ✅ **Done** |

---

## Technical Design

### 1. Properties Panel Interactive Enhancements

Previously, modifying values in the properties panel caused direct updates to the drawing store on every keystroke, triggering full-canvas re-renders. This resulted in:
- Serious input lag.
- Format truncation (e.g. typing a decimal `.` gets stripped by immediate `toFixed(1)` formatting).
- Input fields losing focus or the cursor jumping to the end.
- Missing editors for text values, fonts, dimension properties, ellipses, etc.

### 2. Layer Visibility (Show/Hide)

Layer visibility (`layer.visible`) is now fully enforced across both 2D and 3D:
- **2D Element Selection**: `getShapeAtPoint` in `CanvasEditor.tsx` is called with only elements belonging to visible layers — hidden-layer elements cannot be selected or dragged.
- **Trim/Extend tools**: also use the visible-layer-filtered element list, so you cannot trim/extend lines on hidden layers.
- **3D Viewer Integration**: `ThreeViewer` receives a pre-filtered element list.
- **Sidebar UI**: layer rows show `opacity-40` when hidden; eye/lock icons use Lucide React components.

---

## Changes Made

### `PropertyPanel.tsx`

#### `NumField` — local state prevents keystroke flicker
```tsx
function NumField({ label, value, onChange, disabled }) {
  const fmt = (v) => (v !== undefined ? String(+v.toFixed(2)) : "");
  const [local, setLocal] = useState(fmt(value));
  useEffect(() => { setLocal(fmt(value)); }, [value]);  // sync on drag/external update

  const commit = () => {
    const v = parseFloat(local);
    if (!isNaN(v)) onChange(v);
    else setLocal(fmt(value));
  };

  return <input ... value={local} onChange={e => setLocal(e.target.value)}
                   onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()} />;
}
```

**Behaviour:**
- Local string state buffers keystrokes — no store update until `blur` or `Enter`.
- `useEffect` syncs when external value changes (e.g. dragging element on canvas).
- `key={firstEl.id}` on `SingleSelectionPanel` forces full remount on element switch, resetting all field local state.

#### Added geometry sections in `SingleSelectionPanel`

| Element type | Fields added |
|---|---|
| `text` | `fontSize` (NumField), `text` content (text input, blur/Enter commit), `textAlign` (select) |
| `ellipse` | `Cx`, `Cy`, `Rx`, `Ry` (NumFields) |
| `dimension` | `X1`, `Y1`, `X2`, `Y2` (NumFields), `label` override (text input) |
| `polyline` | Point count info row, `closed` checkbox |
| `hatch` | Point count info row |

---

### `CadSidebar.tsx`

```tsx
import { Eye, EyeOff, Lock, Unlock } from "lucide-react";
```

Layer row changes:
- `{layer.visible ? "👁" : "○"}` → `<Eye className="w-3.5 h-3.5" />` / `<EyeOff className="w-3.5 h-3.5" />`
- `{layer.locked ? "🔒" : "🔓"}` → `<Lock className="w-3.5 h-3.5" />` / `<Unlock className="w-3.5 h-3.5" />`
- Row container gains `${!layer.visible ? "opacity-40" : ""}` class.

---

### `CanvasEditor.tsx`

#### Select / Move tool — visibility filter
```tsx
const visibleLayerSet = new Set(layers.filter(l => l.visible).map(l => l.id));
const pickable = elements.filter(el => visibleLayerSet.has(el.layerId));
const hit = getShapeAtPoint(pickable, pt.x, pt.y);
```

#### Trim / Extend tools — same filter applied
Both tools use their own `visibleLayerSet` / `pickable` filter so hidden-layer lines are excluded from the target and boundary sets.

#### ThreeViewer — visibility filter
```tsx
<ThreeViewer
  elements={elements.filter(el => {
    const l = layers.find(l => l.id === el.layerId);
    return l ? l.visible : true;
  })}
  ...
/>
```

---

## Verification Checklist

### Properties Panel
- [ ] Select a circle → type `12.` in R field → decimal is preserved, no cursor jump
- [ ] Press Enter or click away → canvas updates to new radius
- [ ] Select a text element → edit text content field → canvas updates on blur
- [ ] Change font size → canvas updates on blur/Enter
- [ ] Change textAlign → select dropdown → immediate canvas update
- [ ] Select an ellipse → Rx and Ry fields appear and edit correctly
- [ ] Select a dimension → X1/Y1/X2/Y2 and label override appear
- [ ] Select a polyline → point count shown, closed checkbox toggles path closure
- [ ] Switch element selection → all fields reset to new element's values

### Layer Visibility
- [ ] Click Eye icon next to a layer → row fades (opacity-40), EyeOff icon shows
- [ ] Elements on that layer disappear from 2D canvas
- [ ] Elements on that layer disappear from 3D viewer
- [ ] Clicking where hidden elements are does NOT select them
- [ ] Trim/Extend tools ignore lines on hidden layers
- [ ] Lock icon → Unlock icon swap works correctly with Lucide icons
