import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp, Coins, Calendar, Weight, FileSpreadsheet, Layers, Plus,
  Trash2, Edit3, Check, X, ChevronDown, ChevronUp, Info, RefreshCw,
  Users, CheckCircle2, AlertCircle, Play, Sparkles, Building2, Store,
  Download, CloudRain, ShieldAlert, Wrench
} from "lucide-react";
import * as XLSX from "xlsx";
import { materials, drawingTasks, organizations, drawings, materialPresets, type Material, type DrawingTask, type MaterialPreset } from "../../../api/client";
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

// Brand Store Recommendations Directory
const storeDirectory: Record<string, {
  badge: string;
  title: string;
  rate: string;
  desc: string;
  stores: { name: string; phone: string; addr: string }[];
}> = {
  steel: {
    badge: "Thép Hòa Phát / Việt Nhật",
    title: "Tập đoàn Thép Hòa Phát & Vina Kyoei (Việt Nhật)",
    rate: "Thương hiệu Quốc gia - Đạt chuẩn JIS",
    desc: "Thép xây dựng cốt móng Hòa Phát (mác thép CB300/CB400) hoặc thép cuộn Việt Nhật bền dẻo cao.",
    stores: [
      { name: "Tổng kho VLXD Cát Tường - Q.7", phone: "0903.882.112", addr: "Đường Nguyễn Hữu Thọ, Quận 7, TP.HCM" },
      { name: "VLXD Thế Giới Thép Miền Nam", phone: "1900.636.022", addr: "Đại lộ Võ Văn Kiệt, Quận Bình Tân, TP.HCM" }
    ]
  },
  cement: {
    badge: "Xi măng INSEE / Nghi Sơn",
    title: "Xi măng INSEE Đa Dụng & Xi măng Nghi Sơn PCB40",
    rate: "Chống xâm thực - Cường độ cao",
    desc: "Chuyên dụng cho đổ bê tông móng dầm và vữa trát tường chống rạn nứt chân chim cực kỳ tốt.",
    stores: [
      { name: "NPP Xi măng Hoàng Gia - Thủ Đức", phone: "0912.445.667", addr: "Quốc lộ 13, Hiệp Bình Phước, Thủ Đức" },
      { name: "Đại lý VLXD Trường Sơn - Bình Tân", phone: "0934.556.778", addr: "Kinh Dương Vương, Quận Bình Tân" }
    ]
  },
  brick: {
    badge: "Gạch Tuynel Bình Dương",
    title: "Nhà máy Gạch Tuynel Bình Dương & Đồng Nai",
    rate: "Chịu lực tốt - Đất sét nung chín đều",
    desc: "Gạch đỏ 4 lỗ tiêu chuẩn kích thước 8x8x18cm chịu lực tốt, màu đỏ cam tươi nung kỹ không bị giòn.",
    stores: [
      { name: "Tổng đại lý Gạch ngói Đất Việt - Q.9", phone: "0988.990.112", addr: "Đường Nguyễn Duy Trinh, Quận 9" },
      { name: "Nhà phân phối Gạch Thành Tâm", phone: "0909.112.334", addr: "Tỉnh lộ 10, Quận Bình Tân, TP.HCM" }
    ]
  },
  sand: {
    badge: "Cát Vàng Đồng Nai & Đá Hóa An",
    title: "Cát vàng hạt to Đồng Nai & Đá xanh Hóa An 1x2",
    rate: "Cát sạch không lẫn bùn sét",
    desc: "Cát vàng hạt to lọc rửa chuyên đổ bê tông cột sàn. Đá dăm 1x2 mỏ đá Hóa An cường độ chịu nén cao.",
    stores: [
      { name: "Vựa cát đá xây dựng Minh Hạnh", phone: "0977.345.123", addr: "Cầu Rạch Chiếc, Quận 2, TP.HCM" },
      { name: "Hệ thống Kho Bãi Cát Cát - Nhà Bè", phone: "0918.223.445", addr: "Đường Huỳnh Tấn Phát, Huyện Nhà Bè" }
    ]
  },
  pipe: {
    badge: "Nhựa Bình Minh (uPVC/PPR)",
    title: "Công ty Cổ phần Nhựa Bình Minh",
    rate: "uPVC Class 2 & PPR chịu nhiệt",
    desc: "Dòng ống nước uPVC Bình Minh cấp nước sinh hoạt và ống chịu nhiệt PPR cho đường ống nước nóng năng lượng mặt trời.",
    stores: [
      { name: "Showroom Điện nước Gia Vỹ - Quận 1", phone: "028.3821.445", addr: "Đường Trần Hưng Đạo, Quận 1, TP.HCM" },
      { name: "Nhà phân phối Thuận Phong", phone: "0868.123.556", addr: "Khu dân cư Trung Sơn, Bình Chánh, TP.HCM" }
    ]
  },
  wire: {
    badge: "Cáp điện CADIVI Việt Nam",
    title: "Công ty Cổ phần Cáp điện Việt Nam (CADIVI)",
    rate: "Đồng tinh chất 99.9% - Chống cháy",
    desc: "Cáp lõi đồng đôi tròn vỏ bọc nhựa chống cháy bọc luồn ống nhựa chịu lực âm tường chống rò rỉ điện.",
    stores: [
      { name: "Đại lý cáp điện Huỳnh Gia - Q.10", phone: "0903.112.990", addr: "Đường Lý Thường Kiệt, Quận 10, TP.HCM" },
      { name: "Tổng kho Thiết bị điện An Lộc", phone: "0906.997.788", addr: "Đường Cộng Hòa, Quận Tân Bình, TP.HCM" }
    ]
  },
  septic: {
    badge: "Bồn tự hoại Đại Thành / Sơn Hà",
    title: "Bể tự hoại thông minh Đại Thành nhựa LLDPE",
    rate: "Lắp đặt 1 ngày - Chống thấm nứt",
    desc: "Giải pháp thay thế hầm tự hoại xây gạch truyền thống. Nhựa LLDPE siêu bền 3 lớp, chống nứt rò rỉ rác thải sinh hoạt.",
    stores: [
      { name: "Trung tâm Phân phối Tân Á Đại Thành", phone: "1800.6668", addr: "Đường Lý Thường Kiệt, Quận 10, TP.HCM" },
      { name: "Showroom Sơn Hà Composite - Bình Thạnh", phone: "0944.223.112", addr: "Đường Bạch Đằng, Quận Bình Thạnh" }
    ]
  },
  tile: {
    badge: "Ngói màu SCG / Nakamura Nhật Bản",
    title: "Ngói màu SCG Thái Lan & Nakamura-HP Nhật",
    rate: "Phủ màu Acrylic chịu thời tiết",
    desc: "Vật liệu lợp mái ngói màu cao cấp chống nóng cách âm tốt, dán lên vỉ kèo thép hộp mạ kẽm siêu nhẹ.",
    stores: [
      { name: "Tổng đại lý Mái Nhà Đẹp - Thủ Đức", phone: "0902.556.778", addr: "Phường Linh Đông, Thành phố Thủ Đức" },
      { name: "Showroom Ngói màu Việt Nhật - Q.7", phone: "0911.234.556", addr: "Đường Nguyễn Thị Thập, Quận 7, TP.HCM" }
    ]
  }
};

export default function EstimationDashboard({ elements, drawingId }: EstimationDashboardProps) {
  const [activeTab, setActiveTab] = useState<"estimate" | "blueprint" | "license" | "catalog" | "tasks">("estimate");
  const [region, setRegion] = useState<"HN" | "HCM" | "DN">("HCM");
  const [regionPresets, setRegionPresets] = useState<MaterialPreset[]>([]);
  const [regionFactor, setRegionFactor] = useState(1.0);
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

  // Building configuration inputs
  const [floors, setFloors] = useState(3);
  const [structureType, setStructureType] = useState<"brick" | "concrete" | "steel">("concrete");

  // Crew & Weather configurations
  const [skilledWorkers, setSkilledWorkers] = useState(6);
  const [helperWorkers, setHelperWorkers] = useState(6);
  const [weatherFactor, setWeatherFactor] = useState(1.0);
  const [weatherName, setWeatherName] = useState("Mùa khô (Nắng ráo)");

  // Foundation & Roof choices
  const [foundationCoeff, setFoundationCoeff] = useState(0.50);
  const [foundationName, setFoundationName] = useState("Móng cọc");
  const [roofCoeff, setRoofCoeff] = useState(0.60);
  const [roofName, setRoofName] = useState("Mái ngói kèo sắt");

  // Collapse triggers
  const [isBoqCollapsed, setIsBoqCollapsed] = useState(false);
  const [isStoreCollapsed, setIsStoreCollapsed] = useState(false);

  // Store Proposer active tab
  const [activeStoreTab, setActiveStoreTab] = useState("steel");
  const [highlightedRow, setHighlightedRow] = useState<string | null>(null);

  // Blueprint view states
  const [activeDrawingView, setActiveDrawingView] = useState<"arch" | "struct" | "me" | "3d">("arch");
  const [blueprintLayers, setBlueprintLayers] = useState({
    walls: true,
    columns: true,
    mep: true,
    septic: true
  });

  // Licensing paperwork states
  const [checkedLicenseItems, setCheckedLicenseItems] = useState([false, false, false, false]);
  const [permitOwnerName, setPermitOwnerName] = useState("Nguyễn Văn A");
  const [permitAddress, setPermitAddress] = useState("Số 123 Đường Lê Lợi");
  const [permitDist, setPermitDist] = useState("Bến Thành, Quận 1, TP. Hồ Chí Minh");
  const [permitRedbookId, setPermitRedbookId] = useState("CH-987654");

  // State for AI task suggestions
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<DrawingTask[]>([]);
  const [selectedSuggestIds, setSelectedSuggestIds] = useState<Record<number, boolean>>({});

  // AI chat advisor response state
  const [aiAdviceText, setAiAdviceText] = useState("Nhấp nút phía dưới để trợ lý AI phân tích khối lượng thiết kế từ bản vẽ kết hợp thợ thi công và thời tiết.");
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);

  // Fetch materials, tasks, and team members
  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const matData = await materials.list();
      setDbMaterials(matData);

      if (drawingId) {
        const taskData = await drawingTasks.list(drawingId);
        setTasks(taskData);
      }

      const uniqueMembers: Record<string, TeamMember> = {};
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
      } catch (e) {}

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
      } catch (e) {}

      setTeamMembers(Object.values(uniqueMembers));

    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard parameters");
      setDbMaterials([
        { id: "1", name: "Thép cốt bê tông (Iron/Steel Rebar)", unit: "kg", unit_price: 30000, category: "Structural", description: "Thép xây dầm cột móng" },
        { id: "2", name: "Ống nước PVC Ø90", unit: "m", unit_price: 75000, category: "Plumbing", description: "Ống thoát nước sinh hoạt" },
        { id: "3", name: "Dây cáp điện lõi đồng 2.5mm²", unit: "m", unit_price: 20000, category: "Electrical", description: "Dây cấp điện thiết bị" },
        { id: "4", name: "Xi măng trắng", unit: "kg", unit_price: 6000, category: "Finishes", description: "Xi măng trắng trét khe mạch gạch" },
        { id: "5", name: "Xi măng Portland đen", unit: "kg", unit_price: 3500, category: "Structural", description: "Xi măng xây trát" },
        { id: "6", name: "Cát xây dựng", unit: "m³", unit_price: 380000, category: "Structural", description: "Cát xây tô" },
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

  useEffect(() => {
    materialPresets.list(region).then(res => {
      setRegionPresets(res.presets);
      setRegionFactor(res.factor);
    }).catch(() => {});
  }, [region]);

  // --- Dynamic Takeoff Engine (Math calculations based on CAD drawings) ---
  const takeoff = useMemo(() => {
    let grossWallVolume = 0;
    let netWallVolume = 0;
    let columnVolume = 0;
    let doorCount = 0;
    let windowCount = 0;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let hasWalls = false;

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
        const hM = 3.0;
        columnVolume += wM * dM * hM;
      }
    });

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

    let floorArea = 0;
    const roomElements = elements.filter(el => el.archType === "room");
    if (roomElements.length > 0) {
      roomElements.forEach(r => {
        floorArea += typeof r.area === "number" ? r.area : 0;
      });
    }

    if (floorArea === 0 && hasWalls && minX !== Infinity) {
      const wM = (maxX - minX) * 0.001;
      const hM = (maxY - minY) * 0.001;
      floorArea = Math.min(1000, wM * hM * 0.85);
    }
    
    if (floorArea === 0) floorArea = 120;
    const roofArea = floorArea * 1.15;
    const floorMultiplier = Math.max(1, floors);

    return {
      floorArea,
      roofArea,
      grossWallVolume: grossWallVolume * floorMultiplier,
      netWallVolume: netWallVolume * floorMultiplier,
      columnVolume: columnVolume * floorMultiplier,
      doorCount: doorCount * floorMultiplier,
      windowCount: windowCount * floorMultiplier,
      floors: floorMultiplier,
      widthM: minX !== Infinity ? (maxX - minX) * 0.001 : 6.0,
      lengthM: minY !== Infinity ? (maxY - minY) * 0.001 : 20.0
    };
  }, [elements, floors]);

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
    const fdConcreteQty = takeoff.floorArea * foundationCoeff * 0.15;
    const fdConcretePrice = getPrice("bê tông", 1400000);
    const fdSteelQty = fdConcreteQty * 85;
    const fdSteelPrice = getPrice("thép", 28500);
    const fdPipesQty = takeoff.floorArea * 1.2;
    const fdPipesPrice = getPrice("pvc", 75000);

    const foundationPhase = {
      id: "foundation",
      title: "Giai đoạn 1: Thi công Móng & Bê tông nền",
      icon: "🏗️",
      items: [
        {
          id: "fd_concrete",
          name: getMatName("bê tông", `Bê tông tươi (${foundationName})`),
          qty: fdConcreteQty,
          unit: getMatUnit("bê tông", "m³"),
          price: fdConcretePrice,
          formula: `${takeoff.floorArea.toFixed(1)}m² (Diện tích) * ${foundationCoeff * 100}% (Hệ số móng) * 0.15m (Độ dày)`
        },
        {
          id: "fd_steel",
          name: getMatName("thép", "Thép cốt bê tông móng"),
          qty: fdSteelQty,
          unit: getMatUnit("thép", "kg"),
          price: fdSteelPrice,
          formula: `${fdConcreteQty.toFixed(1)}m³ (Thể tích móng) * 85 kg/m³ (Định mức cốt thép)`
        },
        {
          id: "fd_pipes",
          name: getMatName("pvc", "Ống PVC Ø90 thoát ngầm"),
          qty: fdPipesQty,
          unit: getMatUnit("pvc", "m"),
          price: fdPipesPrice,
          formula: `${takeoff.floorArea.toFixed(1)}m² (Diện tích sàn) * 1.2m/m² (Mật độ thoát ngầm)`
        }
      ]
    };

    const stConcreteQty = takeoff.columnVolume || (takeoff.floorArea * 0.05);
    const stConcretePrice = getPrice("bê tông", 1400000);
    const stSteelQty = stConcreteQty * 115;
    const stSteelPrice = getPrice("thép", 28500);
    const stBricksQty = takeoff.netWallVolume * 550 || (takeoff.floorArea * 0.2 * 3.1 * 550);
    const stBricksPrice = getPrice("gạch", 1800);
    const stCementQty = (takeoff.netWallVolume || (takeoff.floorArea * 0.2 * 3.1)) * 65;
    const stCementPrice = getPrice("portland", 3500);
    const stSandQty = (takeoff.netWallVolume || (takeoff.floorArea * 0.2 * 3.1)) * 0.28;
    const stSandPrice = getPrice("cát", 380000);

    const structuralPhase = {
      id: "structural",
      title: "Giai đoạn 2: Xây dựng Thô & Khung xương",
      icon: "🧱",
      items: [
        {
          id: "st_concrete",
          name: getMatName("bê tông", "Bê tông tươi dầm cột chính"),
          qty: stConcreteQty,
          unit: getMatUnit("bê tông", "m³"),
          price: stConcretePrice,
          formula: `Khối lượng dầm cột dầm: ${stConcreteQty.toFixed(1)} m³ (Bản vẽ CAD + Số tầng)`
        },
        {
          id: "st_steel",
          name: getMatName("thép", "Thép cốt kết cấu chịu lực"),
          qty: stSteelQty,
          unit: getMatUnit("thép", "kg"),
          price: stSteelPrice,
          formula: `${stConcreteQty.toFixed(1)} m³ (Thể tích cột dầm) * 115 kg/m³`
        },
        {
          id: "st_bricks",
          name: getMatName("gạch", "Gạch đỏ Tuynel xây tường"),
          qty: stBricksQty,
          unit: getMatUnit("gạch", "pcs"),
          price: stBricksPrice,
          formula: `${(stBricksQty / 550).toFixed(1)} m³ (Thể tích tường) * 550 viên/m³`
        },
        {
          id: "st_cement",
          name: getMatName("portland", "Xi măng trát tô đen"),
          qty: stCementQty,
          unit: "kg",
          price: stCementPrice,
          formula: `${(stCementQty / 65).toFixed(1)} m³ (Thể tích xây tô) * 65 kg/m³`
        },
        {
          id: "st_sand",
          name: getMatName("cát", "Cát mịn xây tô vữa"),
          qty: stSandQty,
          unit: getMatUnit("cát", "m³"),
          price: stSandPrice,
          formula: `${(stSandQty / 0.28).toFixed(1)} m³ (Thể tích xây tô) * 0.28 m³/m³`
        }
      ]
    };

    const mepPipesQty = elements.filter(el => el.archType === "pipe").length * 5 || takeoff.floorArea * 1.5;
    const mepPipesPrice = getPrice("pvc", 75000);
    const mepWiresQty = elements.filter(el => el.semanticRole?.includes("wire")).length * 20 || takeoff.floorArea * 6.0;
    const mepWiresPrice = getPrice("dây", 20000);
    const septicQty = elements.filter(el => el.semanticRole?.toLowerCase().includes("septic")).length || 1;
    const septicPrice = 12500000;

    const mepPhase = {
      id: "mep",
      title: "Giai đoạn 3: Hệ thống Điện & Nước âm tường",
      icon: "⚡",
      items: [
        {
          id: "mep_pipes",
          name: getMatName("pvc", "Ống thoát nước uPVC Bình Minh"),
          qty: mepPipesQty,
          unit: getMatUnit("pvc", "m"),
          price: mepPipesPrice,
          formula: `Tổng chiều dài phát hiện: ${mepPipesQty.toFixed(1)}m`
        },
        {
          id: "mep_wires",
          name: getMatName("dây", "Cáp luồn đôi đồng CADIVI 2.5mm²"),
          qty: mepWiresQty,
          unit: getMatUnit("dây", "m"),
          price: mepWiresPrice,
          formula: `Tổng dây cáp điện CADIVI phát hiện: ${mepWiresQty.toFixed(0)}m`
        },
        {
          id: "mep_septic",
          name: "Bồn tự hoại composite nhựa Đại Thành",
          qty: septicQty,
          unit: "hầm",
          price: septicPrice,
          formula: `Hầm cầu tự hoại sinh học: ${septicQty} ngăn`
        }
      ]
    };

    const fnWhiteCementQty = (takeoff.netWallVolume || 15) * 2 * 2.5 * 10;
    const fnWhiteCementPrice = getPrice("trắng", 6000);
    const fnDoorsQty = Math.max(1, takeoff.doorCount);
    const fnWindowsQty = Math.max(2, takeoff.windowCount);

    const finishesPhase = {
      id: "finishes",
      title: "Giai đoạn 4: Trát hoàn thiện sơn & Cửa",
      icon: "🎨",
      items: [
        {
          id: "fn_cement",
          name: getMatName("trắng", "Xi măng trắng trét tường"),
          qty: fnWhiteCementQty,
          unit: "kg",
          price: fnWhiteCementPrice,
          formula: `Trát bả 2 mặt trong ngoài: ${fnWhiteCementQty.toLocaleString()} kg`
        },
        {
          id: "fn_doors",
          name: "Cửa đi phòng & Cửa chính trọn bộ",
          qty: fnDoorsQty,
          unit: "set",
          price: 3500000,
          formula: `Phát hiện: ${takeoff.doorCount} bộ cửa trên bản vẽ`
        },
        {
          id: "fn_windows",
          name: "Cửa sổ khung nhôm Xingfa kính cường lực",
          qty: fnWindowsQty,
          unit: "set",
          price: 2600000,
          formula: `Phát hiện: ${takeoff.windowCount} cửa sổ trên bản vẽ`
        }
      ]
    };

    const rfSteelQty = takeoff.floorArea * roofCoeff * 12;
    const rfSteelPrice = getPrice("thép", 28500);
    const rfTilesQty = takeoff.floorArea * roofCoeff * 10;

    const roofingPhase = {
      id: "roofing",
      title: "Giai đoạn 5: Thi công Mái & Khung kèo xà gồ",
      icon: "🏠",
      items: [
        {
          id: "rf_steel",
          name: "Thép hộp vì kèo lợp mái ngói",
          qty: rfSteelQty,
          unit: "kg",
          price: rfSteelPrice,
          formula: `${(takeoff.floorArea * roofCoeff).toFixed(1)} m² (Diện tích mái lợp) * 12 kg/m³`
        },
        {
          id: "rf_tiles",
          name: "Ngói lợp màu Nakamura-HP Nhật",
          qty: rfTilesQty,
          unit: "pcs",
          price: 28000,
          formula: `${(takeoff.floorArea * roofCoeff).toFixed(1)} m² * 10 viên/m²`
        }
      ]
    };

    return [foundationPhase, structuralPhase, mepPhase, finishesPhase, roofingPhase];
  }, [takeoff, dbMaterials, foundationCoeff, foundationName, roofCoeff, roofName]);

  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({
    foundation: true,
    structural: true,
    mep: false,
    finishes: false,
    roofing: false
  });

  const togglePhase = (id: string) => {
    setExpandedPhases(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Calculate Materials + Labor Costs
  const totals = useMemo(() => {
    let materialSum = 0;
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

    const totalWorkers = skilledWorkers + helperWorkers;
    const structureFactor = structureType === "steel" ? 0.8 : structureType === "concrete" ? 1.0 : 1.15;
    
    // Duration math accounting for weather season factor (+30% during rain) and workers count
    const baseDuration = Math.ceil((35 + (takeoff.floorArea * 0.35) + (takeoff.columnVolume * 1.5) + (takeoff.netWallVolume * 0.18)) * structureFactor * (12 / Math.max(1, totalWorkers)));
    const durationDays = Math.ceil(baseDuration * weatherFactor);

    // Calculate labor wages from Vietnamese daily crew wages (500k thợ chính, 350k thợ phụ)
    const crewDailyWages = (skilledWorkers * 500000) + (helperWorkers * 350000);
    const laborCost = durationDays * crewDailyWages;

    const rawTotal = materialSum + laborCost;
    const contingencyCost = rawTotal * 0.10; // 10% contingency
    const totalCost = rawTotal + contingencyCost;

    return {
      materialCost: materialSum,
      laborCost,
      contingencyCost,
      totalCost,
      durationDays,
      steelTons: weightSteelKg / 1000,
      cementBags: weightCementKg / 50 
    };
  }, [phasesData, takeoff, structureType, skilledWorkers, helperWorkers, weatherFactor]);

  // --- Room-level material takeoff ---
  const roomTakeoff = useMemo(() => {
    const roomEls = elements.filter(el => el.archType === "room");
    if (roomEls.length === 0) return [];

    type RoomRole = "wc" | "kitchen" | "bedroom" | "living" | "other";

    const detectRole = (el: typeof roomEls[number]): RoomRole => {
      const text = [el.roomType, el.roomName, el.semanticRole, el.text]
        .filter(Boolean).join(" ").toLowerCase();
      if (/wc|toilet|vệ sinh|phòng tắm|bathroom/.test(text)) return "wc";
      if (/bếp|nhà bếp|kitchen/.test(text)) return "kitchen";
      if (/ngủ|bedroom/.test(text)) return "bedroom";
      if (/khách|living|sinh hoạt/.test(text)) return "living";
      return "other";
    };

    const ROLE_CFG: Record<RoomRole, {
      label: string;
      tileLabel: string; tilePrice: number;
      paintLabel: string; paintPrice: number;
      getTileArea: (a: number) => number;
      getPaintArea: (a: number) => number;
    }> = {
      wc:      { label: "Nhà vệ sinh / WC",  tileLabel: "Gạch ceramic WC",       tilePrice: 350000,
                 paintLabel: "Sơn chống thấm trần", paintPrice: 120000,
                 getTileArea: a => a + 4 * Math.sqrt(a) * 2.4,
                 getPaintArea: a => a },
      kitchen: { label: "Bếp / Nhà bếp",     tileLabel: "Gạch ceramic bếp",      tilePrice: 280000,
                 paintLabel: "Sơn nội thất bếp",   paintPrice: 110000,
                 getTileArea: a => a + Math.sqrt(a) * 2.0,
                 getPaintArea: a => 3 * Math.sqrt(a) * 2.7 },
      bedroom: { label: "Phòng ngủ",          tileLabel: "Sàn gỗ laminate",       tilePrice: 450000,
                 paintLabel: "Sơn nội thất",        paintPrice: 90000,
                 getTileArea: a => a,
                 getPaintArea: a => 4 * Math.sqrt(a) * 2.7 },
      living:  { label: "Phòng khách",        tileLabel: "Gạch marble / đá mài",  tilePrice: 550000,
                 paintLabel: "Sơn nội thất",        paintPrice: 90000,
                 getTileArea: a => a,
                 getPaintArea: a => 4 * Math.sqrt(a) * 2.7 },
      other:   { label: "Phòng khác",         tileLabel: "Gạch lát tiêu chuẩn",   tilePrice: 220000,
                 paintLabel: "Sơn nội thất",        paintPrice: 90000,
                 getTileArea: a => a,
                 getPaintArea: a => 4 * Math.sqrt(a) * 2.7 },
    };

    return roomEls.map(el => {
      const areaM2: number =
        typeof (el.area as unknown) === "number" ? (el.area as number)
        : typeof el.width === "number" && typeof el.height === "number"
          ? (el.width as number) * (el.height as number) * 1e-6
          : 12;

      const role = detectRole(el);
      const cfg = ROLE_CFG[role];
      const tileArea = cfg.getTileArea(areaM2);
      const paintArea = cfg.getPaintArea(areaM2);
      const tileCost = tileArea * cfg.tilePrice;
      const paintCost = paintArea * cfg.paintPrice;

      return {
        id: el.id,
        name: (el.roomName as string | undefined) || (el.text as string | undefined) || cfg.label,
        role,
        label: cfg.label,
        areaM2,
        tileLabel: cfg.tileLabel, tileArea, tilePrice: cfg.tilePrice, tileCost,
        paintLabel: cfg.paintLabel, paintArea, paintPrice: cfg.paintPrice, paintCost,
        totalCost: tileCost + paintCost,
      };
    });
  }, [elements]);

  const formatCost = (val: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);
  };

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
      total_labor_cost: daysNum * priceNum
    };

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

  // --- AI task board suggestion ---
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
      const updatedList = await drawingTasks.list(drawingId);
      setTasks(updatedList);
      setShowAiModal(false);
    } catch (err) {
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

  // --- Click row handler to switch material stores proposer ---
  const handleRowClick = (itemKey: string) => {
    const tabMap: Record<string, string> = {
      'fd_concrete': 'steel',
      'fd_steel': 'steel',
      'fd_pipes': 'pipe',
      'st_concrete': 'steel',
      'st_steel': 'steel',
      'st_bricks': 'brick',
      'st_cement': 'cement',
      'st_sand': 'sand',
      'mep_pipes': 'pipe',
      'mep_wires': 'wire',
      'mep_septic': 'septic',
      'fn_cement': 'cement',
      'rf_steel': 'steel',
      'rf_tiles': 'tile'
    };

    const targetTab = tabMap[itemKey];
    if (targetTab) {
      setActiveStoreTab(targetTab);
      setIsStoreCollapsed(false);
      setHighlightedRow(itemKey);
    }
  };

  // --- AI cost advisor simulator ---
  const handleAiAdvice = () => {
    setAiAdviceLoading(true);
    setAiAdviceText("Trợ lý AI đang phân tích dữ liệu đội thợ và thời tiết...");

    setTimeout(() => {
      let advice = "";
      if (weatherFactor > 1.0) {
        advice += `🌧️ PHÂN TÍCH THỜI TIẾT (MÙA MƯA): Lựa chọn thi công trong mùa mưa khiến thời gian thi công kéo dài thêm 30% (+${totals.durationDays - Math.round(totals.durationDays / 1.3)} ngày). Điều này làm tăng chi phí nhân công lên khoảng ${formatCost(totals.laborCost * 0.23)} do đội ngày công thợ phụ & chính. Khuyên nên đổi sang thi công móng và xây thô vào mùa khô.\n\n`;
      } else {
        advice += `☀️ THỜI TIẾT: Tiến độ tối ưu trong mùa khô. Giúp rút ngắn thời gian đông kết bê tông nền móng và giảm thiểu sạt lở hố móng giằng.\n\n`;
      }

      const ratio = skilledWorkers / (helperWorkers || 1);
      if (ratio > 1.5) {
        advice += `👥 TỈ LỆ THỢ LỆCH (Thợ chính quá nhiều): Tỉ lệ thợ chính / thợ phụ là ${ratio.toFixed(1)} (khuyên dùng tỉ lệ lý tưởng 1:1 hoặc 1:1.2). Có nguy cơ thợ chính phải xách hồ, bưng gạch làm tăng đơn giá nhân sự trung bình vô ích.\n\n`;
      } else if (ratio < 0.7) {
        advice += `⚠️ CẢNH BÁO TIẾN ĐỘ: Thợ phụ quá đông so với thợ chính (${ratio.toFixed(1)}). Việc xây trát tường ngoài và đan sắt sàn dầm chính sẽ bị tắc nghẽn tiến độ do thiếu tay nghề kỹ thuật chính.\n\n`;
      }

      const compositeSeptic = elements.some(el => el.semanticRole?.toLowerCase().includes("composite"));
      if (!compositeSeptic) {
        advice += `🚽 HẦM CẦU: Bản vẽ sử dụng hầm tự hoại xây gạch thủ công. Bạn có thể chuyển đổi sang bồn tự hoại nhựa LLDPE/composite Đại Thành đúc sẵn để rút ngắn 4 ngày xây dựng thô và chống thấm nứt hầm nước thải sau 5 năm sử dụng.\n\n`;
      }

      advice += `⚙️ KHUYẾN NGHỊ: Quỹ dự phòng phát sinh 10% (${formatCost(totals.contingencyCost)}) là bắt buộc đối với biến động giá vật liệu thép xây dựng Hòa Phát/Việt Nhật tại thị trường miền Nam Việt Nam.`;

      setAiAdviceText(advice);
      setAiAdviceLoading(false);
    }, 800);
  };

  // --- Licensing system logic ---
  const toggleLicenseCheck = (idx: number) => {
    const updated = [...checkedLicenseItems];
    updated[idx] = !updated[idx];
    setCheckedLicenseItems(updated);
  };

  const licenseProgressPercent = useMemo(() => {
    const completed = checkedLicenseItems.filter(Boolean).length;
    return (completed / 4) * 100;
  }, [checkedLicenseItems]);

  const administrativeFee = useMemo(() => {
    // 150k base + 15k per m2 of floor area
    return 150000 + (takeoff.floorArea * takeoff.floors * 15000);
  }, [takeoff]);

  // --- Word Export generator ---
  const handleExportWord = () => {
    const content = document.getElementById("permit-printable-area")?.innerHTML;
    if (!content) return;
    
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' 
      xmlns:w='urn:schemas-microsoft-com:office:word' 
      xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>Don De Nghi Cap Phep Xay Dung</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; }
          h2 { font-size: 14pt; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 5px; }
          h3 { font-size: 12pt; font-weight: bold; text-align: center; margin-bottom: 20px; }
          .doc-line { margin-bottom: 10px; }
          .doc-dotted { border-bottom: 1px dotted #000; font-weight: bold; }
        </style>
      </head>
      <body>`;
      
    const footer = "</body></html>";
    const sourceHTML = header + content + footer;
    
    const blob = new Blob(['\ufeff' + sourceHTML], {
      type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Don_xin_phep_xaydung_${permitOwnerName.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportPDF = () => {
    window.print();
  };

  // --- Rendering blueprint layer layout ---
  const renderSvgElements = () => {
    if (elements.length === 0) return null;
    
    // Auto center-scale boundaries based on dimensions
    const maxL = 360;
    const maxW = 200;
    const scaleX = maxL / 30;
    const scaleY = maxW / 15;
    
    const startX = 40;
    const startY = 50;

    return elements.map((el, index) => {
      const x1 = (el.x1 ?? el.startPoint?.x ?? 0) * 0.05 + startX;
      const y1 = (el.y1 ?? el.startPoint?.y ?? 0) * 0.05 + startY;
      const x2 = (el.x2 ?? el.endPoint?.x ?? 0) * 0.05 + startX;
      const y2 = (el.y2 ?? el.endPoint?.y ?? 0) * 0.05 + startY;
      
      const cx = (el.x ?? 0) * 0.05 + startX;
      const cy = (el.y ?? 0) * 0.05 + startY;
      const r = (el.radius ?? 10) * 0.05;

      const isWall = el.archType === "wall";
      const isCol = el.semanticRole?.toLowerCase().includes("column") || el.type === "circle";
      const isDoor = el.archType === "door";
      const isWin = el.archType === "window";

      // 1. ARCHITECTURE LAYER
      if (activeDrawingView === "arch") {
        if (isWall && blueprintLayers.walls) {
          return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#06b6d4" strokeWidth={3.5} />;
        }
        if (isDoor && blueprintLayers.walls) {
          return (
            <g key={index}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth={2} />
              <path d={`M ${x1} ${y1} A 15 15 0 0 1 ${x2} ${y2}`} fill="none" stroke="#cbd5e1" strokeWidth={1} strokeDasharray="2 2" />
            </g>
          );
        }
        if (isWin && blueprintLayers.walls) {
          return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#38bdf8" strokeWidth={5} />;
        }
      }

      // 2. STRUCTURAL LAYER
      if (activeDrawingView === "struct") {
        if (isCol && blueprintLayers.columns) {
          return <rect key={index} x={cx - 4} y={cy - 4} width={8} height={8} fill="#a78bfa" stroke="#fff" strokeWidth={0.8} />;
        }
        if (isWall && blueprintLayers.walls) {
          return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(6, 182, 212, 0.2)" strokeWidth={1.5} strokeDasharray="3 3" />;
        }
      }

      // 3. MEP ELECTRICAL & PLUMBING LAYER
      if (activeDrawingView === "me") {
        if (el.archType === "pipe" && blueprintLayers.mep) {
          return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3b82f6" strokeWidth={2.5} />;
        }
        if (el.semanticRole?.toLowerCase().includes("wire") && blueprintLayers.mep) {
          return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#eab308" strokeWidth={1.5} strokeDasharray="3 2" />;
        }
        if (el.semanticRole?.toLowerCase().includes("septic") && blueprintLayers.septic) {
          return <rect key={index} x={cx - 15} y={cy - 10} width={30} height={20} fill="rgba(234, 88, 12, 0.15)" stroke="#ea580c" strokeWidth={1.5} />;
        }
      }

      return null;
    });
  };

  const handleExportCSV = () => {
    let csvContent = "\uFEFF";
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

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ARCH_TECH_BaoCaoDuToanNhanCong.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportXLSX = () => {
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      ["ARCH-TECH CAD — BÁO CÁO DỰ TOÁN XÂY DỰNG"],
      ["Thời điểm xuất", new Date().toLocaleString("vi-VN")],
      ["Số tầng", takeoff.floors],
      ["Loại kết cấu", structureType === "brick" ? "Tường gạch chịu lực" : structureType === "steel" ? "Khung thép" : "Khung bê tông cốt thép"],
      ["Diện tích sàn (1 tầng)", `${takeoff.floorArea.toFixed(1)} m²`],
      ["Thời gian thi công", `${totals.durationDays} ngày (~${Math.ceil(totals.durationDays / 30)} tháng)`],
      [],
      ["TỔNG DỰ TOÁN", ""],
      ["Chi phí vật tư", totals.materialCost],
      ["Chi phí nhân công", totals.laborCost],
      ["TỔNG CỘNG (Có dự phòng 10%)", totals.totalCost],
      [],
      ["VẬT LIỆU CHÍNH", ""],
      ["Thép cốt bê tông", `${totals.steelTons.toFixed(2)} tấn`],
      ["Xi măng", `${Math.ceil(totals.cementBags)} bao 50kg`],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws1["!cols"] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Tổng hợp");

    const matHeader = ["Giai đoạn", "Vật tư", "Khối lượng", "Đơn vị", "Đơn giá (VND)", "Thành tiền (VND)", "Công thức"];
    const matRows: any[][] = [matHeader];
    phasesData.forEach(p => {
      p.items.forEach(item => {
        matRows.push([p.title, item.name, +item.qty.toFixed(2), item.unit, item.price, +(item.qty * item.price).toFixed(0), item.formula]);
      });
    });
    const ws2 = XLSX.utils.aoa_to_sheet(matRows);
    ws2["!cols"] = [{ wch: 36 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Chi tiết vật tư");

    XLSX.writeFile(wb, `ARCH_TECH_DuToan_${takeoff.floors}Tang_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="absolute inset-0 bg-slate-50 dark:bg-[#0B0E14] text-slate-800 dark:text-gray-200 flex flex-col z-35 overflow-y-auto pb-12 transition-colors duration-300 select-text">
      
      {/* Dynamic Keyframes for 3D Viewport in local style tags */}
      <style>{`
        @keyframes spin3DScene {
          0% { transform: rotateX(-22deg) rotateY(0deg); }
          100% { transform: rotateX(-22deg) rotateY(360deg); }
        }
        .animate-spin-3d {
          animation: spin3DScene 14s infinite linear;
        }
      `}</style>

      {/* Navigation Top Header */}
      <div className="bg-white dark:bg-[#151D2A] border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shrink-0 transition-colors duration-300">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-cyan-400 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-500" />
            Hồ sơ dự án: ARCH-TECH Construction Suite
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Tự động bóc tách bản vẽ CAD • Đồng bộ thiết kế 2D/3D • Tối ưu hóa dự toán đội thợ & Thương hiệu VLXD Việt Nam.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-100 dark:bg-[#0B0E14] p-1 rounded-lg border border-slate-200 dark:border-slate-700/60 flex flex-wrap gap-0.5">
            <button 
              onClick={() => setActiveTab("estimate")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${activeTab === "estimate" ? "bg-blue-600 text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              💰 Dự toán BOQ
            </button>
            <button 
              onClick={() => { setActiveTab("blueprint"); switchDrawingView("arch"); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${activeTab === "blueprint" ? "bg-blue-600 text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              📐 Bản vẽ 2D/3D
            </button>
            <button 
              onClick={() => setActiveTab("license")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${activeTab === "license" ? "bg-blue-600 text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              🏛️ Giấy phép XD
            </button>
            <button 
              onClick={() => setActiveTab("catalog")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${activeTab === "catalog" ? "bg-blue-600 text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              📦 Thư viện Vật tư
            </button>
            {drawingId && (
              <button 
                onClick={() => setActiveTab("tasks")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${activeTab === "tasks" ? "bg-blue-600 text-white shadow-md" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
              >
                👷 Phân công ({tasks.length})
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0B0E14] p-1 rounded-lg border border-slate-200 dark:border-slate-700/60">
            {(["HN", "HCM", "DN"] as const).map(r => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`px-2 py-1 text-[10px] font-bold rounded transition-all cursor-pointer ${region === r ? "bg-emerald-600 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                title={r === "HN" ? "Hà Nội (Hệ số ×1.05)" : r === "HCM" ? "TP.HCM (Hệ số ×1.00)" : "Đà Nẵng (Hệ số ×0.92)"}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            onClick={loadDashboardData}
            className="p-2 bg-slate-100 dark:bg-[#1A2536] hover:bg-slate-250 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Làm mới"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportXLSX}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
        </div>
      </div>

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col gap-6">
        
        {/* KPI Pricing Summary Card */}
        <div className="bg-gradient-to-r from-blue-900/40 via-cyan-950/20 to-purple-900/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                Tổng mức đầu tư BOQ ước tính
              </span>
              <span className="text-[10px] text-emerald-500 font-bold">Vùng: {region} (×{regionFactor})</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {formatCost(totals.totalCost * regionFactor)}
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Vật tư: <strong className="text-cyan-400">{formatCost(totals.materialCost * regionFactor)}</strong> • Nhân công: <strong className="text-violet-400">{formatCost(totals.laborCost)}</strong> • Phát sinh (10%): <strong className="text-amber-500">{formatCost(totals.contingencyCost * regionFactor)}</strong>
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
            <div className="bg-[#0B0E14]/60 border border-slate-800 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 block font-bold uppercase">Diện tích sàn</span>
              <span className="text-sm font-bold text-cyan-400 block mt-1">{(takeoff.floorArea * takeoff.floors).toFixed(0)} m²</span>
              <span className="text-[8px] text-slate-500">({takeoff.floors} Tầng × {takeoff.floorArea.toFixed(0)}m²)</span>
            </div>
            
            <div className="bg-[#0B0E14]/60 border border-slate-800 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 block font-bold uppercase">Tiến độ</span>
              <span className="text-sm font-bold text-amber-400 block mt-1">~ {totals.durationDays} Ngày</span>
              <span className="text-[8px] text-slate-500">({weatherFactor > 1.0 ? "Có mưa dầm +30%" : "Mùa nắng tối ưu"})</span>
            </div>

            <div className="bg-[#0B0E14]/60 border border-slate-800 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 block font-bold uppercase">Cốt thép thô</span>
              <span className="text-sm font-bold text-blue-400 block mt-1">{totals.steelTons.toFixed(1)} Tấn</span>
              <span className="text-[8px] text-slate-500">Móng & dầm cột</span>
            </div>

            <div className="bg-[#0B0E14]/60 border border-slate-800 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 block font-bold uppercase">Lực lượng thợ</span>
              <span className="text-sm font-bold text-purple-400 block mt-1">{skilledWorkers + helperWorkers} Thợ</span>
              <span className="text-[8px] text-slate-500">({skilledWorkers} Chính - {helperWorkers} Phụ)</span>
            </div>
          </div>
        </div>

        {/* TAB 1: BOQ BUDGET ESTIMATOR */}
        {activeTab === "estimate" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Configuration Panel (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              
              <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 shadow-sm">
                <div className="panel-title flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <span className="text-xs font-black text-cyan-500 tracking-wider uppercase">⚙️ Thiết lập quy mô & đội thợ</span>
                </div>

                {/* Floors stepper */}
                <div className="form-control">
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block mb-1">1. Quy mô số tầng & kết cấu</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 rounded-lg p-2 flex items-center justify-between">
                      <button 
                        onClick={() => setFloors(prev => Math.max(1, prev - 1))}
                        className="w-8 h-8 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        −
                      </button>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">{floors} Tầng</span>
                      <button 
                        onClick={() => setFloors(prev => Math.min(20, prev + 1))}
                        className="w-8 h-8 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <select
                      value={structureType}
                      onChange={e => setStructureType(e.target.value as any)}
                      className="bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-bold text-slate-700 dark:text-slate-250 outline-none"
                    >
                      <option value="concrete">Khung BTCT</option>
                      <option value="brick">Tường gạch</option>
                      <option value="steel">Khung thép</option>
                    </select>
                  </div>
                </div>

                {/* Skilled & Helper Crew */}
                <div className="form-control">
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block mb-1">2. Đội ngũ thợ thi công</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-400 font-medium">Thợ chính (500k/ngày)</span>
                      <div className="bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 flex items-center justify-between">
                        <button onClick={() => setSkilledWorkers(prev => Math.max(1, prev - 1))} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-850 text-xs font-bold hover:bg-slate-300 cursor-pointer">−</button>
                        <span className="font-mono font-bold text-xs">{skilledWorkers}</span>
                        <button onClick={() => setSkilledWorkers(prev => Math.min(30, prev + 1))} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-850 text-xs font-bold hover:bg-slate-300 cursor-pointer">+</button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-400 font-medium">Thợ phụ (350k/ngày)</span>
                      <div className="bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 flex items-center justify-between">
                        <button onClick={() => setHelperWorkers(prev => Math.max(1, prev - 1))} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-850 text-xs font-bold hover:bg-slate-300 cursor-pointer">−</button>
                        <span className="font-mono font-bold text-xs">{helperWorkers}</span>
                        <button onClick={() => setHelperWorkers(prev => Math.min(30, prev + 1))} className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-850 text-xs font-bold hover:bg-slate-300 cursor-pointer">+</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Weather season */}
                <div className="form-control">
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block mb-1">3. Mùa thi công & thời tiết</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setWeatherFactor(1.0); setWeatherName("Mùa khô (Nắng ráo)"); }}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${weatherFactor === 1.0 ? "bg-cyan-500/10 border-cyan-500 text-cyan-400" : "bg-slate-50 dark:bg-[#0B0E14] border-slate-200 dark:border-slate-800 hover:border-slate-700"}`}
                    >
                      <div className="text-xs font-bold">Mùa khô</div>
                      <div className="text-[8px] text-slate-400 mt-0.5">Tiến độ tối ưu (x1.0)</div>
                    </button>
                    <button
                      onClick={() => { setWeatherFactor(1.3); setWeatherName("Mùa mưa (Trễ hạn)"); }}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${weatherFactor === 1.3 ? "bg-amber-500/10 border-amber-500 text-amber-400" : "bg-slate-50 dark:bg-[#0B0E14] border-slate-200 dark:border-slate-800 hover:border-slate-700"}`}
                    >
                      <div className="text-xs font-bold">Mùa mưa</div>
                      <div className="text-[8px] text-slate-400 mt-0.5">Mưa ẩm trễ hạn (+30%)</div>
                    </button>
                  </div>
                </div>

                {/* Foundation choice */}
                <div className="form-control">
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block mb-1">4. Giải pháp kết cấu móng</label>
                  <div className="grid grid-cols-2 gap-2 text-left">
                    {[
                      { name: "Móng Đơn", coeff: 0.30 },
                      { name: "Móng Cọc", coeff: 0.50 },
                      { name: "Móng Băng", coeff: 0.50 },
                      { name: "Móng Bè", coeff: 0.90 }
                    ].map(fd => (
                      <button
                        key={fd.name}
                        onClick={() => { setFoundationCoeff(fd.coeff); setFoundationName(fd.name); }}
                        className={`p-2 rounded-xl border cursor-pointer text-left transition-all ${foundationName === fd.name ? "bg-cyan-500/10 border-cyan-500 text-cyan-400" : "bg-slate-50 dark:bg-[#0B0E14] border-slate-200 dark:border-slate-800 hover:border-slate-700"}`}
                      >
                        <div className="text-xs font-bold">{fd.name}</div>
                        <div className="text-[8px] text-slate-400 mt-0.5">Bù nền móng: {fd.coeff * 100}%</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Roof choice */}
                <div className="form-control">
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block mb-1">5. Giải pháp kết cấu mái</label>
                  <div className="grid grid-cols-2 gap-2 text-left">
                    {[
                      { name: "Mái Tôn", coeff: 0.30 },
                      { name: "Ngói Kèo Sắt", coeff: 0.60 },
                      { name: "Mái phẳng BTCT", coeff: 0.50 },
                      { name: "Ngói đổ BT", coeff: 1.00 }
                    ].map(rf => (
                      <button
                        key={rf.name}
                        onClick={() => { setRoofCoeff(rf.coeff); setRoofName(rf.name); }}
                        className={`p-2 rounded-xl border cursor-pointer text-left transition-all ${roofName === rf.name ? "bg-cyan-500/10 border-cyan-500 text-cyan-400" : "bg-slate-50 dark:bg-[#0B0E14] border-slate-200 dark:border-slate-800 hover:border-slate-700"}`}
                      >
                        <div className="text-xs font-bold">{rf.name}</div>
                        <div className="text-[8px] text-slate-400 mt-0.5">Diện tích mái: {rf.coeff * 100}%</div>
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Right Outputs Panel (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* BOQ Table Card (Collapsible) */}
              <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                    <FileSpreadsheet className="w-4.5 h-4.5 text-cyan-500" />
                    Bảng Tiên lượng Khối lượng & Vật tư chi tiết (BOQ)
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-400 tracking-wide">💡 Click dòng xem đề xuất đại lý</span>
                    <button 
                      onClick={() => setIsBoqCollapsed(!isBoqCollapsed)}
                      className="px-2.5 py-1 text-[10px] font-bold rounded border border-slate-700 hover:bg-slate-800 cursor-pointer"
                    >
                      {isBoqCollapsed ? "Mở rộng ▼" : "Thu gọn ▲"}
                    </button>
                  </div>
                </div>

                {!isBoqCollapsed && (
                  <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-[#0B0E14] sticky top-0 z-10">
                        <tr className="text-slate-400 font-bold border-b border-slate-800">
                          <th className="px-4 py-2.5">Hạng mục xây dựng</th>
                          <th className="px-4 py-2.5">Khối lượng</th>
                          <th className="px-4 py-2.5">Đơn vị</th>
                          <th className="px-4 py-2.5">Đơn giá</th>
                          <th className="px-4 py-2.5">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {phasesData.map((p, idx1) => (
                          <React.Fragment key={idx1}>
                            <tr className="bg-slate-100/50 dark:bg-[#0B0E14]/40 font-black text-cyan-500 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider">
                              <td colSpan={5} className="px-4 py-2">{p.title}</td>
                            </tr>
                            {p.items.map((item, idx2) => (
                              <tr 
                                key={idx2} 
                                onClick={() => handleRowClick(item.id)}
                                className={`border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800/10 cursor-pointer transition-colors ${highlightedRow === item.id ? "bg-blue-600/5 border-l-4 border-l-cyan-500 pl-3" : ""}`}
                              >
                                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{item.name}</td>
                                <td className="px-4 py-3 font-mono text-cyan-600 dark:text-cyan-400">{item.qty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                                <td className="px-4 py-3 text-slate-500">{item.unit}</td>
                                <td className="px-4 py-3 font-mono text-slate-500">{item.price.toLocaleString("vi-VN")} đ</td>
                                <td className="px-4 py-3 font-bold text-emerald-600 dark:text-yellow-500">{formatCost(item.qty * item.price)}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                        
                        <tr className="bg-amber-600/5 text-amber-500 border-t border-slate-800 font-bold">
                          <td className="px-4 py-3" colSpan={2}>Quỹ dự trù phát sinh (10%)</td>
                          <td colSpan={2} className="text-slate-500 text-[9px] font-normal italic">Dự phòng trượt giá & hao hụt thời tiết</td>
                          <td className="px-4 py-3 font-mono">{formatCost(totals.contingencyCost)}</td>
                        </tr>

                        <tr className="bg-cyan-500/10 text-white border-t-2 border-cyan-500 font-black text-sm">
                          <td className="px-4 py-3" colSpan={2}>Tổng hợp đồng xây dựng</td>
                          <td colSpan={2} className="text-slate-400 text-[10px] font-normal italic">Bao gồm trọn gói nhân công + vật tư xây dựng</td>
                          <td className="px-4 py-3 font-mono text-cyan-400">{formatCost(totals.totalCost)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Material Brand & Store Proposer Card (Collapsible) */}
              <div className="bg-white dark:bg-[#151D2A] border border-cyan-500/15 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-cyan-950/5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                    <Store className="w-4.5 h-4.5 text-cyan-400" />
                    🏪 Đề xuất đại lý & Thương hiệu Vật liệu uy tín (Vietnam)
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                      {storeDirectory[activeStoreTab]?.badge}
                    </span>
                    <button 
                      onClick={() => setIsStoreCollapsed(!isStoreCollapsed)}
                      className="px-2.5 py-1 text-[10px] font-bold rounded border border-slate-700 hover:bg-slate-800 cursor-pointer"
                    >
                      {isStoreCollapsed ? "Mở rộng ▼" : "Thu gọn ▲"}
                    </button>
                  </div>
                </div>

                {!isStoreCollapsed && storeDirectory[activeStoreTab] && (
                  <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5 text-xs">
                    
                    {/* Left Swapping Tabs */}
                    <div className="md:col-span-3 flex flex-col gap-1 border-r border-slate-200 dark:border-slate-800 pr-4">
                      {Object.keys(storeDirectory).map((key) => (
                        <button
                          key={key}
                          onClick={() => { setActiveStoreTab(key); setHighlightedRow(null); }}
                          className={`p-2 text-left font-bold rounded-lg transition-all text-[10px] uppercase cursor-pointer ${activeStoreTab === key ? "bg-cyan-500/10 text-cyan-400" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
                        >
                          {key === "steel" ? "Sắt thép thô" :
                           key === "cement" ? "Xi măng bao" :
                           key === "brick" ? "Gạch Tuynel" :
                           key === "sand" ? "Cát đá 1x2" :
                           key === "pipe" ? "Nhựa Bình Minh" :
                           key === "wire" ? "Cáp CADIVI" :
                           key === "septic" ? "Bể tự hoại" :
                           "Ngói lợp SCG"}
                        </button>
                      ))}
                    </div>

                    {/* Right brand profile */}
                    <div className="md:col-span-9 space-y-4">
                      <div className="bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-extrabold text-sm text-white">{storeDirectory[activeStoreTab].title}</h4>
                          <span className="text-[9px] bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-2 py-0.5 rounded font-bold">
                            {storeDirectory[activeStoreTab].rate}
                          </span>
                        </div>
                        <p className="text-slate-400 leading-relaxed text-[11px]">{storeDirectory[activeStoreTab].desc}</p>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Đại lý phân phối & Tổng kho đề nghị:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {storeDirectory[activeStoreTab].stores.map((st, idx) => (
                            <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-col justify-between gap-2">
                              <div className="flex justify-between items-start">
                                <span className="font-bold text-cyan-400">{st.name}</span>
                                <span className="text-xs text-violet-400 font-bold shrink-0 cursor-pointer">☎️ Gọi mua</span>
                              </div>
                              <div className="text-[10px] text-slate-400">Điện thoại: <strong>{st.phone}</strong></div>
                              <div className="text-[10px] text-slate-500">Địa chỉ: {st.addr}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>

              {/* Room-level takeoffs */}
              {roomTakeoff.length > 0 && (
                <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-950 dark:text-slate-200 flex items-center gap-2">
                      <span>🏠</span>
                      Hệ thống Phòng & Gạch ốp lát hoàn thiện
                    </h3>
                    <span className="text-xs font-bold text-emerald-600 dark:text-yellow-500">
                      Tạm tính: {formatCost(roomTakeoff.reduce((s, r) => s + r.totalCost, 0))}
                    </span>
                  </div>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0B0E14] text-slate-400 font-bold border-b border-slate-850">
                        <th className="px-4 py-2.5">Tên phòng</th>
                        <th className="px-4 py-2.5">Phân loại</th>
                        <th className="px-4 py-2.5">Diện tích</th>
                        <th className="px-4 py-2.5">Vật liệu sàn</th>
                        <th className="px-4 py-2.5">Sơn phủ trần tường</th>
                        <th className="px-4 py-2.5">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roomTakeoff.map(room => (
                        <tr key={room.id} className="border-b border-slate-850 hover:bg-slate-800/10">
                          <td className="px-4 py-3 font-semibold text-white">{room.name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              room.role === "wc"      ? "bg-cyan-500/15 text-cyan-500" :
                              room.role === "kitchen" ? "bg-orange-500/15 text-orange-500" :
                              room.role === "bedroom" ? "bg-purple-500/15 text-purple-500" :
                              room.role === "living"  ? "bg-blue-500/15 text-blue-500" :
                              "bg-slate-500/15 text-slate-400"
                            }`}>
                              {room.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-cyan-400">{room.areaM2.toFixed(1)} m²</td>
                          <td className="px-4 py-3 text-slate-400">
                            <div>{room.tileLabel}</div>
                            <div className="text-[9px] text-slate-500 mt-0.5">
                              {room.tileArea.toFixed(1)} m² × {room.tilePrice.toLocaleString()} đ
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            <div>{room.paintLabel}</div>
                            <div className="text-[9px] text-slate-500 mt-0.5">
                              {room.paintArea.toFixed(1)} m² × {room.paintPrice.toLocaleString()} đ
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-500">
                            {formatCost(room.totalCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3 options optimizer */}
              <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">AI Cost Optimizer — 3 Phân loại giải pháp vật liệu</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
                  {[
                    { tier: "Tiết kiệm", icon: "🟢", matFactor: 0.72, timeFactor: 0.85, matNote: "Gạch ceramic trung bình, sơn nước nội địa, cửa nhôm thường" },
                    { tier: "Tiêu chuẩn", icon: "🔵", matFactor: 1.00, timeFactor: 1.00, matNote: "Gạch Granite Đồng Tâm, sơn nước Dulux, cửa nhôm hệ Xingfa" },
                    { tier: "Cao cấp",   icon: "🟣", matFactor: 1.45, timeFactor: 1.20, matNote: "Đá Marble nhập khẩu, sơn Nippon cao cấp, cửa nhôm cầu cách nhiệt" }
                  ].map(({ tier, icon, matFactor, timeFactor, matNote }) => {
                    const colorCls =
                      tier === "Tiết kiệm" ? "text-emerald-500" :
                      tier === "Cao cấp"   ? "text-purple-500"   :
                                             "text-blue-500";
                    return (
                      <div key={tier} className="p-5 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{icon}</span>
                          <span className={`text-xs font-black uppercase ${colorCls}`}>{tier}</span>
                        </div>
                        <div className={`text-lg font-extrabold ${colorCls}`}>
                          {formatCost(totals.materialCost * matFactor * regionFactor)}
                        </div>
                        <div className="text-[10px] text-slate-400 space-y-1">
                          <div className="leading-relaxed">📦 {matNote}</div>
                          <div className="font-semibold text-slate-200">
                            ⏱ Khoảng ~{Math.round(totals.durationDays * timeFactor)} ngày hoàn thiện
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI Cost Advisor Widget */}
              <div className="bg-slate-900 border border-purple-500/15 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span className="text-sm font-bold text-white">Chẩn đoán thông minh từ Trợ lý ảo (AI Advisor)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">Active</span>
                </div>
                
                <div className="bg-[#0B0E14] border border-slate-800 rounded-xl p-4 text-[11px] text-slate-400 leading-relaxed font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {aiAdviceText}
                </div>

                <button 
                  onClick={handleAiAdvice}
                  disabled={aiAdviceLoading}
                  className="w-full py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  {aiAdviceLoading ? "Đang phân tích..." : "✨ Khởi chạy phân tích AI tối ưu vật tư & thợ"}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: DETAILED CAD BLUEPRINTS (2D / 3D SCENES) */}
        {activeTab === "blueprint" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Viewport card (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <span className="text-xs font-black text-cyan-500 tracking-wider uppercase">📐 Bản vẽ mặt bằng thi công (CAD Viewport)</span>
                  <span className="text-xs font-bold text-slate-400 font-mono">
                    {takeoff.widthM.toFixed(1)}m × {takeoff.lengthM.toFixed(1)}m (Sàn)
                  </span>
                </div>

                {/* Sub drawings selection tabs */}
                <div className="bg-slate-100 dark:bg-[#0B0E14] p-1 rounded-lg border border-slate-200 dark:border-slate-800/80 flex gap-0.5">
                  <button 
                    onClick={() => switchDrawingView("arch")}
                    className={`flex-1 py-1 text-xs font-bold rounded cursor-pointer ${activeDrawingView === "arch" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    🖼️ Kiến trúc
                  </button>
                  <button 
                    onClick={() => switchDrawingView("struct")}
                    className={`flex-1 py-1 text-xs font-bold rounded cursor-pointer ${activeDrawingView === "struct" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    ⛓️ Kết cấu
                  </button>
                  <button 
                    onClick={() => switchDrawingView("me")}
                    className={`flex-1 py-1 text-xs font-bold rounded cursor-pointer ${activeDrawingView === "me" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    ⚡ Điện nước
                  </button>
                  <button 
                    onClick={() => switchDrawingView("3d")}
                    className={`flex-1 py-1 text-xs font-bold rounded cursor-pointer ${activeDrawingView === "3d" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    🧊 Phối cảnh 3D
                  </button>
                </div>

                {/* Viewport content */}
                <div className="w-full min-h-[340px] bg-[#03060f] border border-slate-850 rounded-xl flex flex-col justify-center items-center p-4 relative">
                  
                  {/* SVG drawing viewport */}
                  {activeDrawingView !== "3d" ? (
                    <svg 
                      className="w-full max-w-[440px] h-[300px] border border-slate-800/40 rounded-lg bg-grid-cyan"
                      style={{
                        backgroundImage: "radial-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px)",
                        backgroundSize: "20px 20px"
                      }}
                      viewBox="0 0 440 300"
                    >
                      {/* Grid background markers */}
                      <rect x="0" y="0" width="440" height="300" fill="none" stroke="rgba(255,255,255,0.01)" />
                      
                      {/* Render CAD drawing elements dynamically */}
                      {renderSvgElements()}
                      
                      {/* Scale labels */}
                      <line x1="25" y1="50" x2="25" y2="250" stroke="rgba(255,255,255,0.2)" strokeWidth={0.8} />
                      <text x="18" y="150" fill="rgba(255,255,255,0.4)" fontSize="7" transform="rotate(-90 18 150)">
                        {takeoff.widthM.toFixed(1)}m (Mặt rộng)
                      </text>

                      <line x1="40" y1="265" x2="400" y2="265" stroke="rgba(255,255,255,0.2)" strokeWidth={0.8} />
                      <text x="210" y="275" fill="rgba(255,255,255,0.4)" fontSize="7" textAnchor="middle">
                        {takeoff.lengthM.toFixed(1)}m (Chiều dài nhà)
                      </text>
                    </svg>
                  ) : (
                    
                    /* Rotating 3D CSS viewport */
                    <div className="w-full h-[300px] flex items-center justify-center relative" style={{ perspective: "800px" }}>
                      <div 
                        className="relative w-40 h-40 transform-style-3d animate-spin-3d"
                        style={{ transformStyle: "preserve-3d" }}
                      >
                        {/* Stacked floor plates */}
                        {Array.from({ length: floors }).map((_, i) => {
                          const translateZ = -20 + i * 45;
                          return (
                            <div
                              key={i}
                              className="absolute w-40 h-30 bg-cyan-500/5 border border-cyan-500/30 transform-style-3d flex items-center justify-center"
                              style={{
                                transform: `rotateX(90deg) translateZ(${translateZ}px)`,
                                left: 0,
                                top: 20,
                                transformStyle: "preserve-3d"
                              }}
                            >
                              <span className="absolute left-2 top-2 text-[6px] text-cyan-400/60 font-mono">SÀN TẦNG {i + 1}</span>
                              <div className="w-full h-full border-t border-b border-cyan-500/10 border-dashed" />
                            </div>
                          );
                        })}

                        {/* Concrete columns */}
                        {[
                          { x: 0, y: 20 }, { x: 156, y: 20 }, { x: 0, y: 136 }, { x: 156, y: 136 },
                          { x: 52, y: 20 }, { x: 104, y: 20 }, { x: 52, y: 136 }, { x: 104, y: 136 }
                        ].map((pos, idx) => {
                          const colHeight = (floors - 1) * 45 + 30;
                          return (
                            <div
                              key={idx}
                              className="absolute w-1 bg-gradient-to-t from-violet-500 to-cyan-500 border-[0.5px] border-white/60 transform-style-3d"
                              style={{
                                left: pos.x,
                                top: pos.y,
                                height: `${colHeight}px`,
                                transform: "translate3d(0, 0, -20px) rotateX(0deg)",
                                transformStyle: "preserve-3d"
                              }}
                            />
                          );
                        })}

                        {/* Pitched Roof wireframe */}
                        <div
                          className="absolute w-40 h-30 border border-purple-500/40 bg-purple-500/5 transform-style-3d"
                          style={{
                            transform: `rotateX(90deg) translateZ(${-20 + floors * 45 - 15}px)`,
                            left: 0,
                            top: 20,
                            transformStyle: "preserve-3d"
                          }}
                        >
                          <div 
                            className="absolute left-0 top-15 w-40 h-0.5 bg-white"
                            style={{ transform: "translateZ(20px)" }}
                          />
                        </div>

                      </div>
                    </div>
                  )}

                  {/* Layers Filter check boxes (only for 2D plans) */}
                  {activeDrawingView !== "3d" && (
                    <div className="flex gap-4 font-bold text-[10px] text-slate-400 mt-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={blueprintLayers.walls} onChange={() => setBlueprintLayers(prev => ({...prev, walls: !prev.walls}))} /> Tường
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={blueprintLayers.columns} onChange={() => setBlueprintLayers(prev => ({...prev, columns: !prev.columns}))} /> Cột
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={blueprintLayers.mep} onChange={() => setBlueprintLayers(prev => ({...prev, mep: !prev.mep}))} /> Cáp & Ống
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={blueprintLayers.septic} onChange={() => setBlueprintLayers(prev => ({...prev, septic: !prev.septic}))} /> Hầm cầu
                      </label>
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Specifications list (5 cols) */}
            <div className="lg:col-span-5">
              <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="panel-title flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <span className="text-xs font-black text-cyan-500 tracking-wider uppercase flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-cyan-500" />
                    Chỉ dẫn kỹ thuật Nhà thầu (CAD Specs)
                  </span>
                </div>

                <div className="space-y-3">
                  {activeDrawingView === "arch" && (
                    <>
                      <div className="bg-slate-50 dark:bg-[#0B0E14] border-l-4 border-l-cyan-500 rounded-r-xl p-3 text-xs space-y-1">
                        <h4 className="font-bold text-white text-[11px]">Chiều cao thông thủy sàn tầng</h4>
                        <p className="text-slate-400 leading-relaxed">Khống chế chiều cao trệt từ 3.6m - 3.8m để đảm bảo thông gió tự nhiên tốt nhất tại Việt Nam. Các sàn lầu khống chế 3.3m - 3.4m.</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#0B0E14] border-l-4 border-l-purple-500 rounded-r-xl p-3 text-xs space-y-1">
                        <h4 className="font-bold text-white text-[11px]">Độ dày tường bao</h4>
                        <p className="text-slate-400 leading-relaxed">Tường ngoài biên sử dụng xây gạch đôi 200mm chống ẩm thấm ngược và cách nhiệt. Tường phân phòng ngủ dày 100mm.</p>
                      </div>
                    </>
                  )}

                  {activeDrawingView === "struct" && (
                    <>
                      <div className="bg-slate-50 dark:bg-[#0B0E14] border-l-4 border-l-cyan-500 rounded-r-xl p-3 text-xs space-y-1">
                        <h4 className="font-bold text-white text-[11px]">Quy cách dầm sàn BTCT</h4>
                        <p className="text-slate-400 leading-relaxed">Bê tông đổ dầm sàn sử dụng mác m300 có phụ gia chống nứt. Thép cốt chủ sử dụng sắt phi 16 hoặc phi 18 Hòa Phát/Việt Nhật.</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#0B0E14] border-l-4 border-l-purple-500 rounded-r-xl p-3 text-xs space-y-1">
                        <h4 className="font-bold text-white text-[11px]">Tiêu chuẩn cốt thép đai cột</h4>
                        <p className="text-slate-400 leading-relaxed">Sử dụng thép đai phi 6 bẻ móc vuông đan khoảng cách đai a150 ở giữa cột chính và đan a100 tại các đầu giằng dầm giao nhau.</p>
                      </div>
                    </>
                  )}

                  {activeDrawingView === "me" && (
                    <>
                      <div className="bg-slate-50 dark:bg-[#0B0E14] border-l-4 border-l-cyan-500 rounded-r-xl p-3 text-xs space-y-1">
                        <h4 className="font-bold text-white text-[11px]">Đường ống thoát nước uPVC Bình Minh</h4>
                        <p className="text-slate-400 leading-relaxed">Ống thoát phân bồn cầu dùng đường kính D110 kết nối thẳng bể tự hoại. Ống thoát lavabo dùng phi 49 hoặc phi 60.</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#0B0E14] border-l-4 border-l-purple-500 rounded-r-xl p-3 text-xs space-y-1">
                        <h4 className="font-bold text-white text-[11px]">Thông số cáp điện CADIVI</h4>
                        <p className="text-slate-400 leading-relaxed">Dây điện âm tường đi trong ống ruột gà PVC chống cháy chống chuột cắn. Trục nguồn chính dây 6mm² hoặc 10mm², ổ cắm phụ tải dây 4mm².</p>
                      </div>
                    </>
                  )}

                  {activeDrawingView === "3d" && (
                    <div className="bg-slate-50 dark:bg-[#0B0E14] border-l-4 border-l-purple-500 rounded-r-xl p-3 text-xs space-y-1">
                      <h4 className="font-bold text-white text-[11px]">Đồ họa lưới dầm chịu lực dầm sàn</h4>
                      <p className="text-slate-400 leading-relaxed">Mô hình biểu diễn trực quan các sàn xếp lớp bê tông. Các cột chịu đứng được bố trí chéo để triệt tiêu lực nén giằng móng hiệu quả.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: LICENSING PERMIT SYSTEM */}
        {activeTab === "license" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">
            
            {/* Checklist paperwork (6 cols) */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 shadow-sm">
                <div className="panel-title flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <span className="text-xs font-black text-cyan-500 tracking-wider uppercase">🏛️ Thành phần hồ sơ xin cấp phép</span>
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-black uppercase">
                    {checkedLicenseItems.filter(Boolean).length}/4 hoàn tất
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {[
                    { label: "Chứng nhận quyền sử dụng đất (Sổ hồng / Sổ đỏ)", desc: "Bản sao công chứng có thời hạn trong vòng 6 tháng đính kèm bản gốc." },
                    { label: "Bản vẽ thiết kế cấp phép xây dựng (2 bộ chính thức)", desc: "Có dấu mộc và chữ ký của kiến trúc sư có chứng chỉ hành nghề chủ trì." },
                    { label: "Đơn đề nghị cấp phép xây dựng theo mẫu chính thức", desc: "Tự động điền dữ liệu theo form nghị định 15/2021/NĐ-CP bên phải." },
                    { label: "Giấy cam kết an toàn kết cấu đối với hộ liền kề", desc: "Cam kết trách nhiệm đền bù chống lún nứt khi đào hố móng giáp vách tường." }
                  ].map((item, idx) => (
                    <div 
                      key={idx}
                      onClick={() => toggleLicenseCheck(idx)}
                      className={`p-3.5 border rounded-xl flex items-start gap-3.5 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/10 ${checkedLicenseItems[idx] ? "border-emerald-500 bg-emerald-500/5" : "border-slate-200 dark:border-slate-800 bg-[#0B0E14]/40"}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center font-extrabold text-[10px] ${checkedLicenseItems[idx] ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-700 text-transparent"}`}>
                        ✓
                      </div>
                      <div className="space-y-1">
                        <span className="font-bold text-white block">{item.label}</span>
                        <span className="text-[10px] text-slate-400 block">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                    <span>TIẾN ĐỘ THỦ TỤC HỒ SƠ</span>
                    <span>{licenseProgressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full transition-all duration-300" style={{ width: `${licenseProgressPercent}%` }} />
                  </div>
                </div>

                <div className="bg-[#0B0E14] border border-slate-800 rounded-xl p-3.5 text-xs space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-400">
                    <span>Lệ phí cấp phép nhà nước ước tính:</span>
                    <span className="text-yellow-500">{formatCost(administrativeFee)}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 leading-normal">
                    (Tính theo biểu phí nhà nước Việt Nam 2026: <strong>150,000 VND lệ phí cơ bản</strong> + <strong>15,000 VND / m²</strong> tổng diện tích sàn xây dựng)
                  </div>
                </div>

              </div>
            </div>

            {/* Document preview & Form inputs (6 cols) */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="panel-title border-b border-slate-200 dark:border-slate-800 pb-3">
                  <span className="text-xs font-black text-cyan-500 tracking-wider uppercase">📝 Điền thông tin Đơn đề nghị</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-400 block text-[9px] font-bold uppercase">Họ và tên Chủ hộ</span>
                    <input 
                      type="text" 
                      value={permitOwnerName}
                      onChange={e => setPermitOwnerName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-blue-500" 
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 block text-[9px] font-bold uppercase">Số Sổ Hồng/Sổ Đỏ đất</span>
                    <input 
                      type="text" 
                      value={permitRedbookId}
                      onChange={e => setPermitRedbookId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-blue-500" 
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 block text-[9px] font-bold uppercase">Địa chỉ thi công xây dựng</span>
                    <input 
                      type="text" 
                      value={permitAddress}
                      onChange={e => setPermitAddress(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-blue-500" 
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 block text-[9px] font-bold uppercase">Phường/Quận/Thành phố</span>
                    <input 
                      type="text" 
                      value={permitDist}
                      onChange={e => setPermitDist(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-blue-500" 
                    />
                  </div>
                </div>

                <div className="bg-[#0B0E14] border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
                    <span>Xem trước đơn cấp phép xây dựng (A4)</span>
                    <span className="text-cyan-400 font-normal lowercase italic">tự động điền mẫu đơn</span>
                  </div>
                  
                  <div className="max-h-[220px] overflow-y-auto border border-slate-850 rounded-lg p-5 bg-[#090b10]">
                    <div className="text-[10px] leading-relaxed text-slate-300 font-serif" id="permit-printable-area">
                      <div className="text-center font-bold mb-3">
                        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br />
                        Độc lập - Tự do - Hạnh phúc<br />
                        ------------------------
                      </div>
                      <h3 className="text-center font-black text-xs uppercase tracking-wide my-2">ĐƠN ĐỀ NGHỊ CẤP GIẤY PHÉP XÂY DỰNG</h3>
                      <h4 className="text-center font-bold text-[10px] mb-3">(Đối với nhà ở riêng lẻ đô thị)</h4>
                      
                      <div className="mb-1">Kính gửi: <strong>Ủy ban nhân dân Quận/Huyện:</strong> <span className="underline font-bold text-cyan-400">{permitDist.split(',')[1] || '.......'}</span></div>
                      <div className="mb-1">1. Tên chủ đầu tư: <span className="underline font-bold text-cyan-400">{permitOwnerName}</span></div>
                      <div className="mb-1">Địa chỉ thường trú: <span className="underline font-bold text-cyan-400">{permitAddress}, {permitDist}</span></div>
                      <div className="mb-1">2. Thông tin thửa đất: Sổ đỏ số <span className="underline font-bold text-cyan-400">{permitRedbookId}</span> tại địa bàn <span className="underline font-bold text-cyan-400">{permitDist}</span>.</div>
                      <div className="mb-1">3. Thông số thiết kế công trình:</div>
                      <div className="mb-1">- Diện tích xây dựng tầng trệt: <span className="underline font-bold text-cyan-400">{takeoff.floorArea.toFixed(1)} m²</span> (Rộng: {takeoff.widthM.toFixed(1)}m, Dài: {takeoff.lengthM.toFixed(1)}m).</div>
                      <div className="mb-1">- Quy mô tầng cao: <span className="underline font-bold text-cyan-400">{takeoff.floors} Tầng</span>.</div>
                      <div className="mb-1">- Tổng diện tích sàn sử dụng: <span className="underline font-bold text-cyan-400">{(takeoff.floorArea * takeoff.floors).toFixed(1)} m²</span>.</div>
                      <div className="mb-1">- Kết cấu móng chủ lực: <span className="underline font-bold text-cyan-400">{foundationName}</span>. Loại kết cấu mái lợp: <span className="underline font-bold text-cyan-400">{roofName}</span>.</div>
                      
                      <div className="mt-4 leading-normal">
                        Tôi cam kết xây dựng đúng giấy phép xây dựng được cấp và tuân thủ các quy định an toàn đô thị của luật pháp Việt Nam.
                      </div>
                      
                      <div className="flex justify-between mt-5 font-serif text-[9px]">
                        <div />
                        <div className="text-center">
                          <em>Ngày ..... Tháng ..... Năm 2026</em><br />
                          <strong>Người làm đơn kí tên</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 shrink-0">
                    <button 
                      onClick={handleExportWord}
                      className="py-2.5 bg-blue-600/10 border border-blue-500/25 hover:bg-blue-600/25 text-blue-400 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Download className="w-4 h-4" /> Tải file Word (.doc)
                    </button>
                    <button 
                      onClick={handleExportPDF}
                      className="py-2.5 bg-red-600/10 border border-red-500/25 hover:bg-red-600/25 text-red-400 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" /> In đơn xin phép / PDF
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* Tab 4: Material Catalog Management */}
        {activeTab === "catalog" && (
          <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
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

        {/* Tab 5: Construction Task Board & Assignee Management */}
        {activeTab === "tasks" && drawingId && (
          <div className="bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
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
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
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
                <Sparkles className="w-4 h-4 text-cyan-500" />
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

  function switchDrawingView(view: "arch" | "struct" | "me" | "3d") {
    setActiveDrawingView(view);
  }
}
