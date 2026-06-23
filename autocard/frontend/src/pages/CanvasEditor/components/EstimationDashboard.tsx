import React, { useState, useEffect, useMemo } from "react";
import { 
  TrendingUp, Coins, Calendar, Weight, FileSpreadsheet, Layers, Plus, 
  Trash2, Edit3, Check, X, ChevronDown, ChevronUp, Info, RefreshCw,
  Users, CheckCircle2, AlertCircle, Play, Sparkles
} from "lucide-react";
import { materials, drawingTasks, organizations, drawings, type Material, type DrawingTask } from "../../../api/client";
import type { DrawingElement } from "../../../types";

interface EstimationDashboardProps {
  elements: DrawingElement[];
  drawingId: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  job_title: string;
  avatar_url?: string;
}

export default function EstimationDashboard({ elements, drawingId }: EstimationDashboardProps) {
  const [activeTab, setActiveTab] = useState<"estimate" | "catalog" | "tasks">("estimate");
  const [dbMaterials, setDbMaterials] = useState<Material[]>([]);
  const [tasks, setTasks] = useState<DrawingTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for adding a new material
  const [showAddMatModal, setShowAddMatModal] = useState(false);
  const [newMatName, setNewMatName] = useState("");
  const [newMatUnit, setNewMatUnit] = useState("");
  const [newMatPrice, setNewMatPrice] = useState("");
  const [newMatCategory, setNewMatCategory] = useState("Structural");
  const [newMatDesc, setNewMatDesc] = useState("");

  // State for inline editing of materials
  const [editingMatId, setEditingMatId] = useState<string | null>(null);
  const [editMatPrice, setEditMatPrice] = useState("");

  // State for active mathematical explanation (Show Math)
  const [showMathFor, setShowMathFor] = useState<string | null>(null);

  // State for manual task creation
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskPhase, setNewTaskPhase] = useState("Foundation");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState("");
  const [newTaskDuration, setNewTaskDuration] = useState("3");
  const [newTaskPrice, setNewTaskPrice] = useState("450000");

  // State for AI task suggestions
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<DrawingTask[]>([]);
  const [selectedSuggestIds, setSelectedSuggestIds] = useState<Record<number, boolean>>({});

  // Fetch materials, tasks, and team members
  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch materials catalog
      const matData = await materials.list();
      setDbMaterials(matData);

      // 2. Fetch drawing tasks if drawingId exists
      if (drawingId) {
        const taskData = await drawingTasks.list(drawingId);
        setTasks(taskData);
      }

      // 3. Fetch team members (Organizations + Permissions)
      const uniqueMembers: Record<string, TeamMember> = {};
      
      // Fallback self assignee
      uniqueMembers["self"] = {
        id: "self",
        name: "Tôi (Self Owner)",
        email: "owner@archtech.vn",
        job_title: "Chủ trì Thiết kế (Lead Architect)"
      };

      try {
        const orgList = await organizations.list();
        if (orgList && orgList.length > 0) {
          const firstOrg = orgList[0];
          const orgMembers = await organizations.getMembers(firstOrg.id);
          if (orgMembers && orgMembers.members) {
            orgMembers.members.forEach((m: any) => {
              uniqueMembers[m.id] = {
                id: m.id,
                name: m.name || m.email,
                email: m.email,
                job_title: m.job_title || "Team Member",
                avatar_url: m.avatar_url
              };
            });
          }
        }
      } catch (e) {
        // Silent catch for org listing if fails
      }

      try {
        if (drawingId) {
          const perms = await drawings.getPermissions(drawingId);
          if (perms) {
            perms.forEach((p: any) => {
              const id = p.user_id || p.email;
              if (!uniqueMembers[id]) {
                uniqueMembers[id] = {
                  id,
                  name: p.email.split("@")[0],
                  email: p.email,
                  job_title: p.role === "editor" ? "Cộng tác viên (Editor)" : "Người xem (Viewer)"
                };
              }
            });
          }
        }
      } catch (e) {
        // Silent catch
      }

      setTeamMembers(Object.values(uniqueMembers));

    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard parameters");
      // Load fallback material list
      setDbMaterials([
        { id: "1", name: "Thép cốt bê tông (Iron/Steel Rebar)", unit: "kg", unit_price: 30000, category: "Structural", description: "Thép xây dầm cột móng" },
        { id: "2", name: "Ống nước PVC Ø90", unit: "m", unit_price: 75000, category: "Plumbing", description: "Ống thoát nước sinh hoạt" },
        { id: "3", name: "Dây cáp điện lõi đồng 2.5mm²", unit: "m", unit_price: 20000, category: "Electrical", description: "Dây cấp điện thiết bị" },
        { id: "4", name: "Xi măng trắng", unit: "kg", unit_price: 6000, category: "Finishes", description: "Xi măng trắng trét khe mạch gạch" },
        { id: "5", name: "Xi măng Portland đen", unit: "kg", unit_price: 3500, category: "Structural", description: "Xi măng xây trát" },
        { id: "6", name: "Cát xây dựng", unit: "m³", unit_price: 350000, category: "Structural", description: "Cát xây tô" },
        { id: "7", name: "Gạch đỏ xây tường 8x8x18", unit: "pcs", unit_price: 1800, category: "Structural", description: "Gạch xây tường bao" },
        { id: "8", name: "Bê tông tươi Mác 250", unit: "m³", unit_price: 1400000, category: "Structural", description: "Bê tông tươi đổ dầm sàn" }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [drawingId]);

  // --- Dynamic Takeoff Engine (Math calculations based on CAD drawings) ---
  const takeoff = useMemo(() => {
    let grossWallVolume = 0; // m³
    let netWallVolume = 0;   // m³
    let columnVolume = 0;    // m³
    let doorCount = 0;
    let windowCount = 0;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let hasWalls = false;

    // Calculate wall volume and track bounding box
    elements.forEach((el) => {
      if (el.archType === "wall") {
        hasWalls = true;
        const x1 = el.x1 ?? el.startPoint?.x ?? 0;
        const y1 = el.y1 ?? el.startPoint?.y ?? 0;
        const x2 = el.x2 ?? el.endPoint?.x ?? 0;
        const y2 = el.y2 ?? el.endPoint?.y ?? 0;
        
        minX = Math.min(minX, x1, x2);
        maxX = Math.max(maxX, x1, x2);
        minY = Math.min(minY, y1, y2);
        maxY = Math.max(maxY, y1, y2);

        const lengthMm = Math.hypot(x2 - x1, y2 - y1);
        const thicknessMm = el.wallThickness || 200;
        const heightMm = el.height || 3000;

        const lengthM = lengthMm * 0.001;
        const thicknessM = thicknessMm * 0.001;
        const heightM = heightMm * 0.001;

        grossWallVolume += lengthM * thicknessM * heightM;
      } else if (el.archType === "door") {
        doorCount++;
      } else if (el.archType === "window") {
        windowCount++;
      } else if (el.type === "circle" && el.semanticRole?.toLowerCase().includes("column")) {
        const radiusM = (el.radius || 200) * 0.001;
        const heightM = (el.height || 3000) * 0.001;
        columnVolume += Math.PI * radiusM * radiusM * heightM;
      } else if (el.type === "rectangle" && el.semanticRole?.toLowerCase().includes("column")) {
        const wM = (el.width || 400) * 0.001;
        const dM = (el.height || 400) * 0.001;
        const hM = 3.0; // default column height
        columnVolume += wM * dM * hM;
      }
    });

    // Subtract opening volumes from walls
    let openingVolume = 0;
    elements.forEach((el) => {
      if (el.archType === "door" || el.archType === "window") {
        const opWidth = (el.width || 900) * 0.001;
        const opHeight = (el.height || 2100) * 0.001;
        
        let wallThickM = 0.2;
        if (el.hostWall) {
          const host = elements.find(w => w.id === el.hostWall);
          if (host) {
            wallThickM = (host.wallThickness || 200) * 0.001;
          }
        }
        openingVolume += opWidth * opHeight * wallThickM;
      }
    });

    netWallVolume = Math.max(0, grossWallVolume - openingVolume);

    // Floor Footprint Area calculation
    let floorArea = 0;
    const roomElements = elements.filter(el => el.archType === "room");
    if (roomElements.length > 0) {
      roomElements.forEach(r => {
        floorArea += typeof r.area === "number" ? r.area : 0;
      });
    }

    // Fallback if no room elements
    if (floorArea === 0 && hasWalls && minX !== Infinity) {
      const wM = (maxX - minX) * 0.001;
      const hM = (maxY - minY) * 0.001;
      floorArea = Math.min(1000, wM * hM * 0.85);
    }
    
    if (floorArea === 0) floorArea = 120; // Default Standard

    const roofArea = floorArea * 1.15;

    return {
      floorArea,
      roofArea,
      grossWallVolume,
      netWallVolume,
      columnVolume,
      doorCount,
      windowCount
    };
  }, [elements]);

  // Find unit price from catalog helper
  const getPrice = (nameKeyword: string, defaultPrice: number) => {
    const mat = dbMaterials.find(m => m.name.toLowerCase().includes(nameKeyword.toLowerCase()));
    return mat ? mat.unit_price : defaultPrice;
  };

  const getMatName = (nameKeyword: string, defaultName: string) => {
    const mat = dbMaterials.find(m => m.name.toLowerCase().includes(nameKeyword.toLowerCase()));
    return mat ? mat.name : defaultName;
  };

  const getMatUnit = (nameKeyword: string, defaultUnit: string) => {
    const mat = dbMaterials.find(m => m.name.toLowerCase().includes(nameKeyword.toLowerCase()));
    return mat ? mat.unit : defaultUnit;
  };

  // --- Phase Divisions & Detail Formulas ---
  const phasesData = useMemo(() => {
    const fdConcreteQty = takeoff.floorArea * 0.15;
    const fdConcretePrice = getPrice("bê tông", 1400000);
    const fdSteelQty = fdConcreteQty * 80;
    const fdSteelPrice = getPrice("thép", 30000);
    const fdPipesQty = takeoff.floorArea * 1.2;
    const fdPipesPrice = getPrice("pvc", 75000);

    const foundationPhase = {
      id: "foundation",
      title: "Giai đoạn 1: Thi công Móng & Bê tông nền",
      icon: "🏗️",
      items: [
        {
          id: "fd_concrete",
          name: getMatName("bê tông", "Bê tông tươi Mác 250 (nền móng)"),
          qty: fdConcreteQty,
          unit: getMatUnit("bê tông", "m³"),
          price: fdConcretePrice,
          formula: `${takeoff.floorArea.toFixed(1)}m² (Diện tích) * 0.15m (Độ dày sàn móng)`
        },
        {
          id: "fd_steel",
          name: getMatName("thép", "Thép cốt bê tông móng"),
          qty: fdSteelQty,
          unit: getMatUnit("thép", "kg"),
          price: fdSteelPrice,
          formula: `${fdConcreteQty.toFixed(1)}m³ (Thể tích bê tông móng) * 80 kg/m³ (Định mức thép)`
        },
        {
          id: "fd_pipes",
          name: getMatName("pvc", "Ống PVC Ø90 thoát ngầm"),
          qty: fdPipesQty,
          unit: getMatUnit("pvc", "m"),
          price: fdPipesPrice,
          formula: `${takeoff.floorArea.toFixed(1)}m² (Diện tích sàn) * 1.2m/m² (Mật độ thoát nước)`
        }
      ]
    };

    const stConcreteQty = takeoff.columnVolume;
    const stConcretePrice = getPrice("bê tông", 1400000);
    const stSteelQty = stConcreteQty * 120;
    const stSteelPrice = getPrice("thép", 30000);
    const stBricksQty = takeoff.netWallVolume * 550;
    const stBricksPrice = getPrice("gạch", 1800);
    const stCementQty = takeoff.netWallVolume * 7.5;
    const stCementPrice = getPrice("portland", 3500);
    const stSandQty = takeoff.netWallVolume * 0.3;
    const stSandPrice = getPrice("cát", 350000);

    const structuralPhase = {
      id: "structural",
      title: "Giai đoạn 2: Xây dựng Thô & Khung xương",
      icon: "🧱",
      items: [
        {
          id: "st_concrete",
          name: getMatName("bê tông", "Bê tông tươi dầm cột"),
          qty: stConcreteQty || (takeoff.floorArea * 0.05),
          unit: getMatUnit("bê tông", "m³"),
          price: stConcretePrice,
          formula: stConcreteQty > 0 
            ? `Thể tích cột dầm vẽ trên bản vẽ: ${stConcreteQty.toFixed(2)}m³`
            : `${takeoff.floorArea.toFixed(1)}m² (Diện tích sàn) * 0.05m (Ước lượng dầm cột)`
        },
        {
          id: "st_steel",
          name: getMatName("thép", "Thép cốt dầm cột"),
          qty: stSteelQty || ((stConcreteQty || (takeoff.floorArea * 0.05)) * 120),
          unit: getMatUnit("thép", "kg"),
          price: stSteelPrice,
          formula: `${(stConcreteQty || (takeoff.floorArea * 0.05)).toFixed(1)}m³ (Thể tích cột) * 120 kg/m³`
        },
        {
          id: "st_bricks",
          name: getMatName("gạch", "Gạch đỏ xây tường 8x8x18"),
          qty: stBricksQty,
          unit: getMatUnit("gạch", "pcs"),
          price: stBricksPrice,
          formula: `${takeoff.netWallVolume.toFixed(2)}m³ (Thể tích xây tường thực tế) * 550 viên/m³`
        },
        {
          id: "st_cement",
          name: getMatName("portland", "Xi măng Portland xây trát"),
          qty: stCementQty * 50, 
          unit: "kg",
          price: stCementPrice / 50,
          formula: `${takeoff.netWallVolume.toFixed(2)}m³ (Thể tích tường) * 7.5 bao/m³ * 50kg/bao`
        },
        {
          id: "st_sand",
          name: getMatName("cát", "Cát mịn xây trát trộn vữa"),
          qty: stSandQty,
          unit: getMatUnit("cát", "m³"),
          price: stSandPrice,
          formula: `${takeoff.netWallVolume.toFixed(2)}m³ (Thể tích tường) * 0.3 m³/m³`
        }
      ]
    };

    const mepPipesQty = takeoff.floorArea * 1.5;
    const mepPipesPrice = getPrice("pvc", 75000);
    const mepWiresQty = takeoff.floorArea * 6.0;
    const mepWiresPrice = getPrice("dây", 20000);

    const mepPhase = {
      id: "mep",
      title: "Giai đoạn 3: Hệ thống Điện & Nước âm tường",
      icon: "⚡",
      items: [
        {
          id: "mep_pipes",
          name: getMatName("pvc", "Ống nước PVC thoát sinh hoạt"),
          qty: mepPipesQty,
          unit: getMatUnit("pvc", "m"),
          price: mepPipesPrice,
          formula: `${takeoff.floorArea.toFixed(1)}m² (Diện tích sàn) * 1.5m/m² (Mật độ đường ống)`
        },
        {
          id: "mep_wires",
          name: getMatName("dây", "Dây cáp điện lõi đồng 2.5mm²"),
          qty: mepWiresQty,
          unit: getMatUnit("dây", "m"),
          price: mepWiresPrice,
          formula: `${takeoff.floorArea.toFixed(1)}m² (Diện tích sàn) * 6m/m² (Hệ số cấp nguồn)`
        }
      ]
    };

    const fnWhiteCementQty = takeoff.netWallVolume * 2 * 2.5 * 10;
    const fnWhiteCementPrice = getPrice("trắng", 6000);
    const fnDoorsQty = Math.max(1, takeoff.doorCount);
    const fnDoorsPrice = 3500000;
    const fnWindowsQty = Math.max(2, takeoff.windowCount);
    const fnWindowsPrice = 2800000;

    const finishesPhase = {
      id: "finishes",
      title: "Giai đoạn 4: Trát trét, Hoàn thiện sơn & Cửa",
      icon: "🎨",
      items: [
        {
          id: "fn_cement",
          name: getMatName("trắng", "Xi măng trắng trét tường"),
          qty: fnWhiteCementQty,
          unit: getMatUnit("trắng", "kg"),
          price: fnWhiteCementPrice,
          formula: `${(takeoff.netWallVolume * 2).toFixed(1)}m² (Diện tích trát bả 2 mặt tường) * 2.5 kg/m²`
        },
        {
          id: "fn_doors",
          name: "Bộ cửa đi thông phòng & cửa chính",
          qty: fnDoorsQty,
          unit: "set",
          price: fnDoorsPrice,
          formula: `Số lượng cửa đi phát hiện: ${takeoff.doorCount} bộ (Mặc định tối thiểu 1)`
        },
        {
          id: "fn_windows",
          name: "Bộ cửa sổ nhôm kính Xingfa",
          qty: fnWindowsQty,
          unit: "set",
          price: fnWindowsPrice,
          formula: `Số lượng cửa sổ phát hiện: ${takeoff.windowCount} bộ (Mặc định tối thiểu 2)`
        }
      ]
    };

    const rfSteelQty = takeoff.roofArea * 15;
    const rfSteelPrice = getPrice("thép", 30000);
    const rfTilesQty = takeoff.roofArea * 10;
    const rfTilesPrice = 25000;

    const roofingPhase = {
      id: "roofing",
      title: "Giai đoạn 5: Thi công Mái & Khung kèo xà gồ",
      icon: "🏠",
      items: [
        {
          id: "rf_steel",
          name: "Thép hộp mạ kẽm kèo lợp mái",
          qty: rfSteelQty,
          unit: "kg",
          price: rfSteelPrice,
          formula: `${takeoff.roofArea.toFixed(1)}m² (Diện tích mái) * 15 kg/m²`
        },
        {
          id: "rf_tiles",
          name: "Ngói lợp mái màu Prime",
          qty: rfTilesQty,
          unit: "pcs",
          price: rfTilesPrice,
          formula: `${takeoff.roofArea.toFixed(1)}m² (Diện tích mái) * 10 viên/m²`
        }
      ]
    };

    return [foundationPhase, structuralPhase, mepPhase, finishesPhase, roofingPhase];
  }, [takeoff, dbMaterials]);

  const togglePhase = (id: string) => {
    setExpandedPhases(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({
    foundation: true,
    structural: true,
    mep: false,
    finishes: false,
    roofing: false
  });

  // Calculate Materials + Labor Costs
  const totals = useMemo(() => {
    let materialSum = 0;
    let laborSum = 0;
    let weightSteelKg = 0;
    let weightCementKg = 0;

    phasesData.forEach(p => {
      p.items.forEach(item => {
        materialSum += item.qty * item.price;
        if (item.name.toLowerCase().includes("thép")) {
          weightSteelKg += item.qty;
        } else if (item.name.toLowerCase().includes("xi măng")) {
          weightCementKg += item.qty;
        }
      });
    });

    // Sum from tasks
    tasks.forEach(t => {
      laborSum += t.total_labor_cost;
    });

    const durationDays = Math.ceil(30 + (takeoff.floorArea * 0.4) + (takeoff.columnVolume * 2) + (takeoff.netWallVolume * 0.2));

    return {
      materialCost: materialSum,
      laborCost: laborSum,
      totalCost: materialSum + laborSum,
      durationDays,
      steelTons: weightSteelKg / 1000,
      cementBags: weightCementKg / 50 
    };
  }, [phasesData, takeoff, tasks]);

  const formatCost = (val: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
  };

  // --- Inline material price edit ---
  const handleStartEditMat = (mat: Material) => {
    setEditingMatId(mat.id);
    setEditMatPrice(String(mat.unit_price));
  };

  const handleSaveMatPrice = async (mat: Material) => {
    const parsedPrice = parseFloat(editMatPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      alert("Đơn giá không hợp lệ");
      return;
    }

    try {
      await materials.update(mat.id, { unit_price: parsedPrice });
      setDbMaterials(prev => prev.map(m => m.id === mat.id ? { ...m, unit_price: parsedPrice } : m));
      setEditingMatId(null);
    } catch (err) {
      setDbMaterials(prev => prev.map(m => m.id === mat.id ? { ...m, unit_price: parsedPrice } : m));
      setEditingMatId(null);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa vật tư này?")) return;
    try {
      await materials.delete(id);
      setDbMaterials(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      setDbMaterials(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(newMatPrice);
    if (!newMatName || !newMatUnit || isNaN(priceNum) || priceNum < 0) {
      alert("Thông tin không hợp lệ");
      return;
    }

    const payload = {
      name: newMatName,
      unit: newMatUnit,
      unit_price: priceNum,
      category: newMatCategory,
      description: newMatDesc
    };

    try {
      const added = await materials.create(payload);
      setDbMaterials(prev => [...prev, added]);
      setShowAddMatModal(false);
      resetAddMatForm();
    } catch (err) {
      const localAdded = {
        id: String(Date.now()),
        ...payload
      } as Material;
      setDbMaterials(prev => [...prev, localAdded]);
      setShowAddMatModal(false);
      resetAddMatForm();
    }
  };

  const resetAddMatForm = () => {
    setNewMatName("");
    setNewMatUnit("");
    setNewMatPrice("");
    setNewMatCategory("Structural");
    setNewMatDesc("");
  };

  // --- Task Board Operations ---
  const handleTaskStatusChange = async (taskId: string, status: "todo" | "in_progress" | "done") => {
    if (!drawingId) return;
    try {
      await drawingTasks.update(drawingId, taskId, { status });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    }
  };

  const handleTaskAssigneeChange = async (taskId: string, assigneeId: string) => {
    if (!drawingId) return;
    const member = teamMembers.find(m => m.id === assigneeId);
    const assigneeName = member ? member.name : "";
    try {
      await drawingTasks.update(drawingId, taskId, { 
        assignee_id: assigneeId === "" ? undefined : assigneeId,
        assignee_name: assigneeName
      });
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        assignee_id: assigneeId === "" ? undefined : assigneeId,
        assignee_name: assigneeName
      } : t));
    } catch (err) {
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        assignee_id: assigneeId === "" ? undefined : assigneeId,
        assignee_name: assigneeName
      } : t));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!drawingId || !confirm("Bạn có chắc muốn xóa nhiệm vụ này?")) return;
    try {
      await drawingTasks.delete(drawingId, taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawingId || !newTaskName) return;

    const daysNum = parseInt(newTaskDuration) || 1;
    const priceNum = parseFloat(newTaskPrice) || 0;
    const member = teamMembers.find(m => m.id === newTaskAssigneeId);

    const payload = {
      name: newTaskName,
      phase: newTaskPhase,
      description: newTaskDesc,
      assignee_id: newTaskAssigneeId === "" ? undefined : newTaskAssigneeId,
      assignee_name: member ? member.name : "",
      duration_days: daysNum,
      labor_price: priceNum,
      total_labor_cost: float64(daysNum) * priceNum
    };

    function float64(val: number) { return val; }

    try {
      const created = await drawingTasks.create(drawingId, payload);
      setTasks(prev => [...prev, created]);
      setShowAddTaskModal(false);
      resetTaskForm();
    } catch (err) {
      const localTask = {
        id: String(Date.now()),
        drawing_id: drawingId,
        ...payload,
        status: "todo" as const
      } as DrawingTask;
      setTasks(prev => [...prev, localTask]);
      setShowAddTaskModal(false);
      resetTaskForm();
    }
  };

  const resetTaskForm = () => {
    setNewTaskName("");
    setNewTaskPhase("Foundation");
    setNewTaskDesc("");
    setNewTaskAssigneeId("");
    setNewTaskDuration("3");
    setNewTaskPrice("450000");
  };

  // --- AI suggestion logic ---
  const handleAiSuggest = async () => {
    if (!drawingId) return;
    setAiLoading(true);
    setShowAiModal(true);
    try {
      const payload = {
        elements: JSON.stringify(elements),
        members: JSON.stringify(teamMembers)
      };
      const suggested = await drawingTasks.suggest(drawingId, payload);
      setSuggestedTasks(suggested);
      // Select all suggested tasks by default
      const defaultSelected: Record<number, boolean> = {};
      suggested.forEach((_, idx) => {
        defaultSelected[idx] = true;
      });
      setSelectedSuggestIds(defaultSelected);
    } catch (err: any) {
      alert("Trợ lý AI đang bận hoặc offline. Tải dữ liệu gợi ý dự toán xây dựng mặc định.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAiSuggestions = async () => {
    if (!drawingId) return;
    const checkedTasks = suggestedTasks.filter((_, idx) => selectedSuggestIds[idx]);
    if (checkedTasks.length === 0) {
      setShowAiModal(false);
      return;
    }

    try {
      await drawingTasks.bulkCreate(drawingId, checkedTasks);
      // Reload tasks list
      const updatedList = await drawingTasks.list(drawingId);
      setTasks(updatedList);
      setShowAiModal(false);
    } catch (err) {
      // Local fallback append
      const mapped = checkedTasks.map((t, idx) => ({
        ...t,
        id: String(Date.now() + idx),
        drawing_id: drawingId,
        status: "todo" as const
      }));
      setTasks(prev => [...prev, ...mapped]);
      setShowAiModal(false);
    }
  };

  const handleExportCSV = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "ARCH-TECH CAD - BÁO CÁO DỰ TOÁN CHI TIẾT & NHIỆM VỤ NHÂN CÔNG\n";
    csvContent += `Thời điểm xuất: ${new Date().toLocaleString()}\n`;
    csvContent += `Tổng diện tích nền móng: ${takeoff.floorArea.toFixed(1)} m2\n`;
    csvContent += `Dự toán vật tư: ${formatCost(totals.materialCost)}\n`;
    csvContent += `Dự toán nhân công: ${formatCost(totals.laborCost)}\n`;
    csvContent += `Tổng dự toán công trình: ${formatCost(totals.totalCost)}\n`;
    csvContent += `Thời gian thi công: ${totals.durationDays} ngày\n\n`;
    
    csvContent += "1. BẢNG CHI TIẾT VẬT TƯ\n";
    csvContent += "Giai đoạn,Vật tư,Khối lượng,Đơn vị,Đơn giá (VND),Thành tiền (VND),Công thức tính toán\n";
    phasesData.forEach(p => {
      p.items.forEach(item => {
        csvContent += `"${p.title}","${item.name}",${item.qty.toFixed(2)},"${item.unit}",${item.price},${(item.qty * item.price).toFixed(0)},"${item.formula}"\n`;
      });
    });

    csvContent += "\n2. BẢNG PHÂN CÔNG NHÂN CÔNG & TIẾN ĐỘ\n";
    csvContent += "Nhiệm vụ,Phần việc,Mô tả,Người thực hiện,Thời gian (ngày),Đơn giá ngày,Tổng lương (VND),Trạng thái\n";
    tasks.forEach(t => {
      csvContent += `"${t.name}","${t.phase}","${t.description}","${t.assignee_name || ""}",${t.duration_days},${t.labor_price},${t.total_labor_cost},"${t.status}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ARCH_TECH_BaoCaoDuToanNhanCong.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="absolute inset-0 bg-slate-50 dark:bg-[#0B0E14] text-slate-800 dark:text-gray-200 flex flex-col z-35 overflow-y-auto pb-12 transition-colors duration-300 select-text">
      {/* Navigation Top Header */}
      <div className="bg-white dark:bg-[#151D2A] border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 transition-colors duration-300">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-cyan-400 flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-500" />
            Dự toán Xây dựng & Quản lý Phân công
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Takeoff tự động dựa trên cấu trúc hình học kết hợp phân chia nhân sự & gợi ý phân tích từ AI.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 dark:bg-[#0B0E14] p-1 rounded-lg border border-slate-200 dark:border-slate-700/60 flex">
            <button 
              onClick={() => setActiveTab("estimate")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${activeTab === "estimate" ? "bg-blue-600 text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              Bảng Dự toán
            </button>
            <button 
              onClick={() => setActiveTab("catalog")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${activeTab === "catalog" ? "bg-blue-600 text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              Vật tư ({dbMaterials.length})
            </button>
            {drawingId && (
              <button 
                onClick={() => setActiveTab("tasks")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${activeTab === "tasks" ? "bg-blue-600 text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
              >
                Nhiệm vụ & Nhân sự ({tasks.length})
              </button>
            )}
          </div>
          
          <button
            onClick={loadDashboardData}
            className="p-2 bg-slate-100 dark:bg-[#1A2536] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Làm mới bảng"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Xuất file Báo cáo
          </button>
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto px-6 py-6 flex-1 flex flex-col gap-6">
        
        {/* Visual KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 hover:border-slate-300 dark:hover:border-slate-750 transition-colors shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Tổng Dự toán Cost</span>
              <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400 mt-1 block">{formatCost(totals.totalCost)}</span>
              {totals.laborCost > 0 && (
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  ({formatCost(totals.materialCost)} VT + {formatCost(totals.laborCost)} NC)
                </span>
              )}
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 hover:border-slate-300 dark:hover:border-slate-750 transition-colors shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-500 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Thời gian thi công</span>
              <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400 mt-1 block">~ {totals.durationDays} Ngày</span>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 hover:border-slate-300 dark:hover:border-slate-750 transition-colors shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
              <Weight className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Tổng khối lượng sắt</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1 block">{totals.steelTons.toFixed(2)} Tấn</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-4 hover:border-slate-300 dark:hover:border-slate-750 transition-colors shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Xi măng cần dùng</span>
              <span className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-1 block">~ {Math.ceil(totals.cementBags)} Bao</span>
            </div>
          </div>
        </div>

        {/* Tab 1: Detailed Material Cost Estimate */}
        {activeTab === "estimate" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-[#151D2A] px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
              <span className="text-xs text-slate-600 dark:text-slate-300 font-bold">Các Giai đoạn & Vật tư lấy theo hình học</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setExpandedPhases({ foundation: true, structural: true, mep: true, finishes: true, roofing: true })}
                  className="text-[10px] bg-slate-100 dark:bg-[#1E293B] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded font-bold cursor-pointer transition-colors"
                >
                  Mở hết
                </button>
                <button 
                  onClick={() => setExpandedPhases({ foundation: false, structural: false, mep: false, finishes: false, roofing: false })}
                  className="text-[10px] bg-slate-100 dark:bg-[#1E293B] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded font-bold cursor-pointer transition-colors"
                >
                  Thu hết
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {phasesData.map((phase) => {
                const isExpanded = expandedPhases[phase.id];
                const phaseSubtotal = phase.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
                
                return (
                  <div key={phase.id} className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all shadow-sm">
                    {/* Header */}
                    <div 
                      onClick={() => togglePhase(phase.id)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/20 select-none"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{phase.icon}</span>
                        <div>
                          <h4 className="text-sm font-bold text-slate-950 dark:text-slate-200">{phase.title}</h4>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">Chi phí phụ thuộc kích thước CAD</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-emerald-600 dark:text-yellow-500">Tạm tính: {formatCost(phaseSubtotal)}</span>
                        <span className="text-slate-400 text-xs">{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
                      </div>
                    </div>

                    {/* Table */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 dark:border-slate-800 overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-[#0B0E14] text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                              <th className="px-4 py-2.5">Vật tư / Thiết bị</th>
                              <th className="px-4 py-2.5">Khối lượng</th>
                              <th className="px-4 py-2.5">Đơn vị</th>
                              <th className="px-4 py-2.5">Đơn giá</th>
                              <th className="px-4 py-2.5">Thành tiền</th>
                              <th className="px-4 py-2.5 text-center">Giải thích</th>
                            </tr>
                          </thead>
                          <tbody>
                            {phase.items.map((item) => {
                              const subtotal = item.qty * item.price;
                              const isMathOpen = showMathFor === item.id;
                              
                              return (
                                <React.Fragment key={item.id}>
                                  <tr className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-200">{item.name}</td>
                                    <td className="px-4 py-3 font-mono text-blue-600 dark:text-cyan-400">{item.qty.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.unit}</td>
                                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">{item.price.toLocaleString("vi-VN")} đ</td>
                                    <td className="px-4 py-3 font-bold text-emerald-600 dark:text-yellow-500">{formatCost(subtotal)}</td>
                                    <td className="px-4 py-3 text-center">
                                      <button 
                                        onClick={() => setShowMathFor(isMathOpen ? null : item.id)}
                                        className="p-1 hover:text-blue-600 dark:hover:text-cyan-400 text-slate-400 dark:text-slate-500 rounded transition-colors inline-block cursor-pointer"
                                        title="Xem chi tiết công thức tính toán"
                                      >
                                        <Info className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                  {isMathOpen && (
                                    <tr>
                                      <td colSpan={6} className="px-4 py-3 bg-slate-50 dark:bg-[#0D1117] border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-mono">
                                        <div className="flex items-start gap-2">
                                          <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                          <div>
                                            <div className="text-blue-600 dark:text-cyan-400 font-bold mb-1">Cách tính khối lượng dự toán:</div>
                                            <div>{item.formula}</div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Material Catalog Management */}
        {activeTab === "catalog" && (
          <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">Bảng Quản lý Danh mục Vật tư Xây dựng</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Đơn giá ở đây sẽ được áp dụng trực tiếp để tính toán Thành tiền trong bảng dự toán.
                </p>
              </div>
              
              <button 
                onClick={() => setShowAddMatModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Thêm Vật tư mới
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-[#0B0E14] text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-3">Tên vật tư</th>
                    <th className="px-4 py-3">Đơn vị</th>
                    <th className="px-4 py-3">Đơn giá (VND)</th>
                    <th className="px-4 py-3">Phân loại</th>
                    <th className="px-4 py-3">Mô tả</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {dbMaterials.map((mat) => {
                    const isEditing = editingMatId === mat.id;
                    
                    return (
                      <tr key={mat.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/10">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-200">{mat.name}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">{mat.unit}</td>
                        <td className="px-4 py-3 font-mono">
                          {isEditing ? (
                            <input 
                              type="number"
                              value={editMatPrice}
                              onChange={(e) => setEditMatPrice(e.target.value)}
                              className="bg-white dark:bg-slate-850 border border-slate-350 dark:border-slate-700 rounded px-2 py-1 w-28 text-xs text-yellow-600 dark:text-yellow-400 outline-none focus:border-blue-500 font-mono"
                              min="0"
                            />
                          ) : (
                            <span className="text-yellow-600 dark:text-yellow-500 font-bold">{mat.unit_price.toLocaleString("vi-VN")} đ</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            mat.category === "Structural" ? "bg-blue-600/15 text-blue-500" :
                            mat.category === "Plumbing" ? "bg-cyan-600/15 text-cyan-500" :
                            mat.category === "Electrical" ? "bg-orange-600/15 text-orange-500" :
                            mat.category === "Finishes" ? "bg-purple-600/15 text-purple-500" :
                            "bg-slate-600/15 text-slate-400"
                          }`}>
                            {mat.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{mat.description || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button 
                                  onClick={() => handleSaveMatPrice(mat)}
                                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors cursor-pointer"
                                  title="Lưu lại"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => setEditingMatId(null)}
                                  className="p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded transition-colors cursor-pointer"
                                  title="Hủy bỏ"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => handleStartEditMat(mat)}
                                  className="p-1.5 bg-slate-100 dark:bg-[#1F2937] hover:bg-slate-200 dark:hover:bg-slate-755 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                                  title="Sửa đơn giá"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteMaterial(mat.id)}
                                  className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors cursor-pointer"
                                  title="Xóa vật tư"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Construction Task Board & Assignee Management */}
        {activeTab === "tasks" && drawingId && (
          <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                  <Users className="w-4.5 h-4.5 text-blue-500" />
                  Bảng Phân công & Tiến độ Công việc Nhân công
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  AI có thể phân tích cấu trúc bản vẽ để chia nhỏ đầu việc và tự động gán cho các thành viên phù hợp.
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleAiSuggest}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer animate-pulse"
                >
                  <Sparkles className="w-4 h-4" />
                  🤖 Trợ lý AI: Gợi ý công việc
                </button>
                <button 
                  onClick={() => setShowAddTaskModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Thêm việc Thủ công
                </button>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có nhiệm vụ nào được phân công. Hãy dùng Trợ lý AI để tự động tạo công việc nhanh chóng!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-[#0B0E14] text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                      <th className="px-4 py-3">Tên Công việc</th>
                      <th className="px-4 py-3">Phần việc / Mô tả</th>
                      <th className="px-4 py-3">Người thực hiện</th>
                      <th className="px-4 py-3">Tiến độ</th>
                      <th className="px-4 py-3">Số ngày</th>
                      <th className="px-4 py-3">Lương ngày</th>
                      <th className="px-4 py-3">Tổng lương</th>
                      <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/10">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-200">{task.name}</td>
                        <td className="px-4 py-3">
                          <span className="text-slate-500 dark:text-slate-400 block max-w-[180px] truncate" title={task.description}>
                            {task.description || "Không có mô tả"}
                          </span>
                          <span className="text-[9px] text-blue-500 font-bold uppercase mt-0.5 block">{task.phase}</span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={task.assignee_id || ""}
                            onChange={(e) => handleTaskAssigneeChange(task.id, e.target.value)}
                            className="bg-white dark:bg-slate-850 border border-slate-250 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:border-blue-500 w-36"
                          >
                            <option value="">— Chưa gán —</option>
                            {teamMembers.map(m => (
                              <option key={m.id} value={m.id}>{m.name} ({m.job_title})</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={task.status}
                            onChange={(e) => handleTaskStatusChange(task.id, e.target.value as any)}
                            className={`px-2 py-1 rounded text-[10px] font-bold outline-none border transition-all ${
                              task.status === "todo" ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700" :
                              task.status === "in_progress" ? "bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20" :
                              "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20"
                            }`}
                          >
                            <option value="todo" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Chưa bắt đầu</option>
                            <option value="in_progress" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Đang làm</option>
                            <option value="done" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold">Hoàn thành</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">{task.duration_days} ngày</td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">{task.labor_price.toLocaleString()} đ</td>
                        <td className="px-4 py-3 font-bold text-yellow-600 dark:text-yellow-500">{formatCost(task.total_labor_cost)}</td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer inline-block"
                            title="Xóa công việc"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal manually add task */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">Tạo Nhiệm vụ Thi công mới</h3>
              <button onClick={() => setShowAddTaskModal(false)} className="text-slate-400 hover:text-slate-250 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateTask} className="p-5 space-y-4 text-xs">
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1">Tên công việc <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  className="w-full bg-white dark:bg-[#0B0E14] border border-slate-250 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                  placeholder="Ví dụ: Lắp đặt thiết bị vệ sinh tầng 1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 dark:text-slate-400 block mb-1">Hạng mục chính</label>
                  <select 
                    value={newTaskPhase}
                    onChange={(e) => setNewTaskPhase(e.target.value)}
                    className="w-full bg-white dark:bg-[#0B0E14] border border-slate-250 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="Foundation">Foundation (Móng)</option>
                    <option value="Structural">Structural (Khung thô)</option>
                    <option value="MEP">MEP (Điện nước)</option>
                    <option value="Finishes">Finishes (Hoàn thiện)</option>
                    <option value="Roofing">Roofing (Mái)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-400 block mb-1">Giao việc cho</label>
                  <select 
                    value={newTaskAssigneeId}
                    onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                    className="w-full bg-white dark:bg-[#0B0E14] border border-slate-250 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="">— Chưa gán —</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.job_title})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 dark:text-slate-400 block mb-1">Số ngày thi công</label>
                  <input 
                    type="number" 
                    value={newTaskDuration}
                    onChange={(e) => setNewTaskDuration(e.target.value)}
                    className="w-full bg-white dark:bg-[#0B0E14] border border-slate-250 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-mono"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-400 block mb-1">Lương công/ngày (VND)</label>
                  <input 
                    type="number" 
                    value={newTaskPrice}
                    onChange={(e) => setNewTaskPrice(e.target.value)}
                    className="w-full bg-white dark:bg-[#0B0E14] border border-slate-250 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-mono"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1">Mô tả công việc</label>
                <textarea 
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-white dark:bg-[#0B0E14] border border-slate-250 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 resize-none"
                  placeholder="Mô tả kỹ thuật thi công nếu có..."
                />
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold cursor-pointer transition-colors"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold cursor-pointer transition-colors"
                >
                  Tạo nhiệm vụ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal AI task suggestion */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-500 animate-spin" />
                Đề xuất Nhiệm vụ thi công từ Trợ lý AI
              </h3>
              <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-slate-250 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
              {aiLoading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-slate-500 dark:text-slate-400 animate-pulse font-medium">Trợ lý AI đang phân tích bản vẽ & tối ưu hóa phân phối nhân sự...</p>
                </div>
              ) : suggestedTasks.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  Không thể lấy đề xuất từ AI. Vui lòng kiểm tra API key hoặc thử lại sau.
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-slate-500 dark:text-slate-400">
                    AI đã phân tích khối lượng vật tư và danh sách thành viên để gán việc phù hợp:
                  </p>
                  
                  <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    {suggestedTasks.map((t, idx) => {
                      const isChecked = selectedSuggestIds[idx] || false;
                      
                      return (
                        <div 
                          key={idx} 
                          onClick={() => setSelectedSuggestIds(prev => ({ ...prev, [idx]: !isChecked }))}
                          className={`p-3 border-b border-slate-100 dark:border-slate-850 last:border-0 flex items-start gap-3 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/20 ${isChecked ? "bg-blue-600/5" : ""}`}
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-0.5 w-4 h-4 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{t.name}</span>
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase">{t.phase}</span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">{t.description}</p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[10px] text-slate-400 font-mono">
                              <span className="text-cyan-600 dark:text-cyan-400">👤 Gợi ý gán: {t.assignee_name || "Chưa gán"}</span>
                              <span>📅 Thời gian: {t.duration_days} ngày</span>
                              <span>💰 Dự kiến: {t.labor_price.toLocaleString()} đ/ngày</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {!aiLoading && suggestedTasks.length > 0 && (
              <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-[#0B0E14] text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Đã chọn {Object.values(selectedSuggestIds).filter(Boolean).length} / {suggestedTasks.length} việc đề xuất.
                </span>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowAiModal(false)}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold cursor-pointer transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    onClick={handleApplyAiSuggestions}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold cursor-pointer transition-colors"
                  >
                    Áp dụng Nhiệm vụ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Modal Add Material */}
      {showAddMatModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-850 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">Thêm Vật tư mới vào Danh mục</h3>
              <button 
                onClick={() => setShowAddMatModal(false)}
                className="text-slate-400 hover:text-slate-250 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddMaterial} className="p-5 space-y-4 text-xs">
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1">Tên vật tư <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newMatName}
                  onChange={(e) => setNewMatName(e.target.value)}
                  className="w-full bg-white dark:bg-[#0B0E14] border border-slate-250 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                  placeholder="Ví dụ: Ống nhựa PPR Hàn Nhiệt Ø25"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 dark:text-slate-400 block mb-1">Đơn vị tính <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={newMatUnit}
                    onChange={(e) => setNewMatUnit(e.target.value)}
                    className="w-full bg-white dark:bg-[#0B0E14] border border-slate-250 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                    placeholder="m, kg, m3, chiếc..."
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-400 block mb-1">Đơn giá (VND) <span className="text-red-500">*</span></label>
                  <input 
                    type="number" 
                    value={newMatPrice}
                    onChange={(e) => setNewMatPrice(e.target.value)}
                    className="w-full bg-white dark:bg-[#0B0E14] border border-slate-250 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                    placeholder="Đơn giá"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1">Phân loại Giai đoạn</label>
                <select 
                  value={newMatCategory}
                  onChange={(e) => setNewMatCategory(e.target.value)}
                  className="w-full bg-white dark:bg-[#0B0E14] border border-slate-250 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="Structural">Structural (Kết cấu / Thô)</option>
                  <option value="Plumbing">Plumbing (Hệ cấp thoát nước)</option>
                  <option value="Electrical">Electrical (Hệ điện nguồn)</option>
                  <option value="Finishes">Finishes (Hoàn thiện / Sơn trát)</option>
                  <option value="Roofing">Roofing (Phần mái)</option>
                  <option value="General">General (Vật tư chung)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1">Mô tả vật tư</label>
                <textarea 
                  value={newMatDesc}
                  onChange={(e) => setNewMatDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-white dark:bg-[#0B0E14] border border-slate-250 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 resize-none"
                  placeholder="Mô tả công dụng hoặc định mức..."
                />
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setShowAddMatModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold cursor-pointer transition-colors"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold cursor-pointer transition-colors"
                >
                  Thêm vật tư
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
