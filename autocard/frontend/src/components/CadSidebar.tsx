import { useState } from "react";
import { SectionHeader } from "./ui/SectionHeader";
import { Divider } from "./ui/Divider";
import { DrawSection, ModifySection, AnnotateSection } from "./CadSidebar/ToolsSections";
import { LayersSection } from "./CadSidebar/LayersSection";
import { PropertiesSection } from "./CadSidebar/PropertiesSection";
import { AiSection } from "./CadSidebar/AiSection";
import { BlocksSection } from "./CadSidebar/BlocksSection";

// ─── Props ────────────────────────────────────────────────────────────────────
interface CadSidebarProps {
  tool: string;
  setTool: (t: string) => void;
  layers: any[];
  activeLayerId: string;
  setActiveLayer: (id: string) => void;
  addLayer: () => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  deleteLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  duplicateLayer?: (id: string) => void;
  gridVisible: boolean;
  setGridVisible: (v: boolean) => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  orthoEnabled: boolean;
  setOrthoEnabled: (v: boolean) => void;
  zoom: number;
  setZoom: (z: number) => void;
  panOffset: { x: number; y: number };
  setPanOffset: (p: { x: number; y: number }) => void;
  onImportDxf?: () => void;
  onImportJson?: () => void;
  onExportSvg?: () => void;
  onExportDxf?: () => void;
  onExportPng?: () => void;
  onExportJson?: () => void;
  insertBlock: (id: string, x: number, y: number) => void;
  selectedElement?: any;
  aiPrompt?: string;
  setAiPrompt?: (s: string) => void;
  onAiGenerate?: () => void;
  addElements?: (els: any[]) => void;
  authToken?: string;
  onMirrorH?: () => void;
  onMirrorV?: () => void;
  onRotate90?: () => void;
  orgId?: string | null;
  onOpenBlockStore?: () => void;
  show3D?: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CadSidebar({
  tool,
  setTool,
  layers,
  activeLayerId,
  setActiveLayer,
  addLayer,
  toggleLayerVisibility,
  toggleLayerLock,
  deleteLayer,
  renameLayer,
  duplicateLayer,
  zoom,
  panOffset,
  insertBlock,
  selectedElement,
  addElements,
  authToken,
  onMirrorH,
  onMirrorV,
  onRotate90,
  orgId,
  onOpenBlockStore,
  show3D,
}: CadSidebarProps) {

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    draw: false,
    modify: false,
    annotate: true,
    blocks: false,
    layers: false,
    properties: true,
    ai: true,
  });

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  return (
    <aside className="w-[220px] bg-slate-50 dark:bg-[#0D1117] border-r border-slate-200 dark:border-[#1E293B] flex flex-col h-full overflow-y-auto text-slate-700 dark:text-gray-300 transition-colors duration-300 select-none">

      {/* ─── 1. DRAW ──────────────────────────────────────────────────────── */}
      <SectionHeader
        label="Draw"
        color="bg-blue-500"
        isCollapsible
        isCollapsed={collapsedSections.draw}
        onToggle={() => toggleSection("draw")}
      />
      {!collapsedSections.draw && <DrawSection tool={tool} setTool={setTool} />}

      <Divider />

      {/* ─── 2. MODIFY ────────────────────────────────────────────────────── */}
      <SectionHeader
        label="Modify"
        color="bg-yellow-500"
        isCollapsible
        isCollapsed={collapsedSections.modify}
        onToggle={() => toggleSection("modify")}
      />
      {!collapsedSections.modify && (
        <ModifySection
          tool={tool}
          setTool={setTool}
          onMirrorH={onMirrorH}
          onMirrorV={onMirrorV}
          onRotate90={onRotate90}
        />
      )}

      <Divider />

      {/* ─── 3. ANNOTATE ──────────────────────────────────────────────────── */}
      <SectionHeader
        label="Annotate"
        color="bg-green-500"
        isCollapsible
        isCollapsed={collapsedSections.annotate}
        onToggle={() => toggleSection("annotate")}
      />
      {!collapsedSections.annotate && <AnnotateSection tool={tool} setTool={setTool} />}

      <Divider />

      {/* ─── 4. BLOCKS ────────────────────────────────────────────────────── */}
      <SectionHeader
        label="Blocks & Furniture"
        color="bg-purple-500"
        isCollapsible
        isCollapsed={collapsedSections.blocks}
        onToggle={() => toggleSection("blocks")}
      />
      {!collapsedSections.blocks && (
        <BlocksSection
          tool={tool}
          setTool={setTool}
          zoom={zoom}
          panOffset={panOffset}
          insertBlock={insertBlock}
          authToken={authToken}
          orgId={orgId}
          onOpenBlockStore={onOpenBlockStore}
          show3D={show3D}
        />
      )}

      <Divider />

      {/* ─── 5. LAYERS ────────────────────────────────────────────────────── */}
      <Divider />
      <SectionHeader
        label="Layers"
        color="bg-amber-700"
        isCollapsible
        isCollapsed={collapsedSections.layers}
        onToggle={() => toggleSection("layers")}
      />
      {!collapsedSections.layers && (
        <LayersSection
          layers={layers}
          activeLayerId={activeLayerId}
          setActiveLayer={setActiveLayer}
          addLayer={addLayer}
          toggleLayerVisibility={toggleLayerVisibility}
          toggleLayerLock={toggleLayerLock}
          deleteLayer={deleteLayer}
          renameLayer={renameLayer}
          duplicateLayer={duplicateLayer}
        />
      )}

      <Divider />

      {/* ─── 6. PROPERTIES ────────────────────────────────────────────────── */}
      <SectionHeader
        label="Properties"
        color="bg-red-500"
        isCollapsible
        isCollapsed={collapsedSections.properties}
        onToggle={() => toggleSection("properties")}
      />
      {!collapsedSections.properties && (
        <PropertiesSection selectedElement={selectedElement} activeLayer={activeLayer} />
      )}

      <Divider />

      {/* ─── 7. AI ASSISTANT ──────────────────────────────────────────────── */}
      <SectionHeader
        label="AI Assistant"
        color="bg-cyan-500"
        isCollapsible
        isCollapsed={collapsedSections.ai}
        onToggle={() => toggleSection("ai")}
      />
      {!collapsedSections.ai && (
        <AiSection addElements={addElements} authToken={authToken} />
      )}
    </aside>
  );
}
