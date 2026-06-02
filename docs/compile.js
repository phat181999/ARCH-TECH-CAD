const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, 'docs');
const OUTPUT_FILE = path.join(__dirname, 'guide.html');

// Define custom metadata (Mermaid diagrams, source files, context briefs) for each document
const METADATA_MAP = {
  "3D Modeling.md": {
    context: "Handles SketchUp-style vertical toolbars, camera interactions (orbit, pan, zoom), interactive 3D tape measure, dynamic wall extrusions, and click-to-delete eraser highlighting.",
    sourceFiles: [
      "frontend/src/components/ThreeViewer.tsx"
    ],
    mermaid: `graph TD
    UI[ThreeViewer Vertical Toolbar] -->|Select Tool| Controller[Camera & OrbitControls Binding]
    UI -->|Tape Measure| Measurement[Raycast Plane / measurementPoints]
    UI -->|Push/Pull| Extruder[Dynamic Wall Extrusion / wallHeight State]
    UI -->|Eraser| Highlight[Hover Highlight / Delete Elements Action]`
  },
  "Properties Panel & Layer Visibility Enhancements.md": {
    context: "Standalone AutoCAD-style collapsible Properties Palette, direct layer visibility (show/hide) toggles, and coordinate mapping validations.",
    sourceFiles: [
      "frontend/src/pages/CanvasEditor/components/PropertyPanel.tsx",
      "frontend/src/components/CadSidebar.tsx",
      "frontend/src/pages/CanvasEditor.tsx"
    ],
    mermaid: `graph TD
    Store[drawingStore / layers & elements] -->|Select Element| PropPanel[PropertyPanel / Local State]
    PropPanel -->|On Blur / Enter| Update[updateElement Store Action]
    Update -->|Re-render| Canvas[CanvasEditor 2D Canvas]
    Sidebar[CadSidebar Layer List] -->|Toggle Eye Icon| ToggleVis[toggleLayerVisibility Action]
    ToggleVis -->|Filter out elements| Canvas`
  },
  "autocad_concept_scan_report.md": {
    context: "Complete audit scanning of AutoCAD concepts in the codebase including coordinate precision, entity relationships, snapping, and BIM rules.",
    sourceFiles: [
      "docs/docs/autocad_concept_scan_report.md"
    ],
    mermaid: `graph LR
    Audit[AutoCAD Concept Scan] --> Elements[Entity Data Models]
    Audit --> Operations[CAD Operations: Trim/Offset]
    Audit --> Precision[Precision: Snapping & Coordinates]
    Audit --> UIUX[UX: Properties Panel / CLI / Status Bar]`
  },
  "cad_rag_architecture.md": {
    context: "RAG Architecture design for layout generation. Integrates PostgreSQL pgvector, Entity-Adjacency graphs, Reciprocal Rank Fusion, similarity formulas, and human review.",
    sourceFiles: [
      "docs/docs/cad_rag_architecture.md",
      "backend/main.go"
    ],
    mermaid: `graph TD
    Prompt[User Prompt] -->|Semantic Parsing| RAG[RAG Retrieval Engine]
    RAG -->|Vector Search pgvector| HNSW[HNSW Cosine Index]
    RAG -->|FTS Search GIN| GIN[Full Text Search]
    RAG -->|Combine RRF| Context[Context Builder]
    Context -->|JSON Program Template| LLM[LLM Generator]
    User[User Edits] -->|Score > 0.8| Promotion[Golden Designs Promotion]`
  },
  "implementation_plan_OSNAP.md": {
    context: "AutoCAD-style Object Snapping (OSNAP) implementing midpoint, center, quadrant, perpendicular, tangent, apparent intersection, and extension snapping.",
    sourceFiles: [
      "frontend/src/canvas/snap.ts",
      "frontend/src/pages/CanvasEditor.tsx",
      "frontend/src/components/CadSidebar.tsx"
    ],
    mermaid: `graph TD
    Mouse[Canvas Mouse Move] -->|pt & startPoint| SnapEngine[snap.ts / findNearestSnap]
    SnapEngine -->|Check Enabled| OSNAP[osnapEnabled flag]
    OSNAP -->|Midpoint/Center/Tangent| SnapResult[SnapResult Coordinate & Label]
    SnapResult -->|Visual Indicator| Draw[drawSnapIndicator / CadEngine]`
  },
  "organization_flow.md": {
    context: "System console workspace organization flow, managing multi-tenant organization creation, user invitations, system roles, and subscriptions.",
    sourceFiles: [
      "frontend/src/pages/AdminConsolePage.tsx",
      "frontend/src/pages/DrawingDashboard.tsx"
    ],
    mermaid: `graph TD
    Admin[AdminConsolePage] -->|Manage Organizations| Tenant[Multi-Tenant Workspace]
    Tenant -->|Invite User| Member[Membership Roles: Owner/Admin/Viewer]
    Tenant -->|Select Plan| Subscription[Subscription Tiers & Limits]`
  },
  "package.md": {
    context: "System packages, pricing tables, subscription levels, and billing logic restricting layout creation limits.",
    sourceFiles: [
      "frontend/src/pages/SettingsPage.tsx",
      "frontend/src/pages/LoginPage.tsx"
    ],
    mermaid: `graph LR
    User[User Registration] --> Plan[Select Plan Tier: Free / Pro / Enterprise]
    Plan --> Check[Verify Subscription Limits]
    Check --> Create[Allow Drawing Creation]`
  },
  "properties_palete.md": {
    context: "Properties palette implementation and coordinate updates for circles, lines, rectangles, text, blocks, and architectural walls.",
    sourceFiles: [
      "frontend/src/pages/CanvasEditor/components/PropertyPanel.tsx"
    ],
    mermaid: `graph TD
    Select[Selection State] -->|None| Defaults[Drawing Defaults: stroke/fill/lineType]
    Select -->|Single| Geometry[Geometry Inputs: Cx/Cy/Radius/Width/Height]
    Select -->|Multi| Batch[Batch Style updates]
    Defaults -->|Update| Store[drawingStore / currentStyle]`
  }
};

const DEFAULT_METADATA = {
  context: "Architectural CAD System Design Documentation",
  sourceFiles: [],
  mermaid: `graph TD
  System[ARCH-TECH-CAD] --> Editor[CanvasEditor]
  System --> Backend[Go Server]
  System --> Database[PostgreSQL]`
};

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`Docs directory not found: ${DOCS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(DOCS_DIR).filter(file => file.endsWith('.md'));
  const modules = [];

  files.forEach(file => {
    const filePath = path.join(DOCS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Extract Title
    let title = file.replace('.md', '');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1];
    }

    const meta = METADATA_MAP[file] || DEFAULT_METADATA;

    modules.push({
      fileName: file,
      title: title,
      content: content,
      context: meta.context,
      sourceFiles: meta.sourceFiles,
      mermaid: meta.mermaid
    });
  });

  // Sort modules for cleaner navigation
  modules.sort((a, b) => a.title.localeCompare(b.title));

  // Load guide template
  const templatePath = path.join(__dirname, 'guide_template.html');
  if (!fs.existsSync(templatePath)) {
    console.error(`Template not found at: ${templatePath}`);
    process.exit(1);
  }

  let templateHtml = fs.readFileSync(templatePath, 'utf-8');
  
  // Inject JSON data
  const dataString = JSON.stringify(modules).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const finalHtml = templateHtml.replace('{{MODULES_JSON}}', dataString);

  fs.writeFileSync(OUTPUT_FILE, finalHtml, 'utf-8');
  console.log(`Successfully generated interactive guide at: ${OUTPUT_FILE}`);
}

main();
