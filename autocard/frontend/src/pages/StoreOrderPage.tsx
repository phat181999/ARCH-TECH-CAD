import { useState, useMemo } from "react";
import {
  ShoppingCart,
  Filter,
  Search,
  Plus,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  X,
} from "lucide-react";
import { useThemeStore } from "../stores/themeStore";
import AppShell from "../components/layout/AppShell";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = "Pending" | "Processing" | "Delivered" | "Cancelled";

interface StoreOrder {
  id: string;
  orderName: string;
  store: string;
  items: string;
  quantity: number;
  unit: string;
  totalCost: number;
  currency: string;
  status: OrderStatus;
  orderedBy: string;
  orderedAt: string;
  estimatedDelivery: string;
  notes?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_ORDERS: StoreOrder[] = [
  {
    id: "ORD-20240101",
    orderName: "Structural Steel Beams",
    store: "BuildMart",
    items: "IPE 300 Steel Beams",
    quantity: 24,
    unit: "pcs",
    totalCost: 18400,
    currency: "USD",
    status: "Delivered",
    orderedBy: "A. Nguyen",
    orderedAt: "2024-04-02T08:30:00Z",
    estimatedDelivery: "2024-04-10T00:00:00Z",
    notes: "For Level 3 floor framing — Lot A",
  },
  {
    id: "ORD-20240102",
    orderName: "Structural Timber Package",
    store: "WoodCo",
    items: "Laminated Veneer Lumber (LVL) 240x45mm",
    quantity: 80,
    unit: "m",
    totalCost: 6200,
    currency: "USD",
    status: "Processing",
    orderedBy: "M. Tran",
    orderedAt: "2024-04-08T11:15:00Z",
    estimatedDelivery: "2024-04-18T00:00:00Z",
  },
  {
    id: "ORD-20240103",
    orderName: "Anchor Bolts & Fasteners",
    store: "IronHouse Supply",
    items: "M20 Anchor Bolts, Grade 8.8",
    quantity: 500,
    unit: "pcs",
    totalCost: 1750,
    currency: "USD",
    status: "Delivered",
    orderedBy: "A. Nguyen",
    orderedAt: "2024-04-01T09:00:00Z",
    estimatedDelivery: "2024-04-05T00:00:00Z",
    notes: "Urgently needed for column base plates",
  },
  {
    id: "ORD-20240104",
    orderName: "Concrete Reinforcement Mesh",
    store: "BuildMart",
    items: "SL82 Reinforcing Mesh 6x2.4m",
    quantity: 60,
    unit: "sheets",
    totalCost: 4320,
    currency: "USD",
    status: "Pending",
    orderedBy: "L. Pham",
    orderedAt: "2024-04-12T14:00:00Z",
    estimatedDelivery: "2024-04-22T00:00:00Z",
  },
  {
    id: "ORD-20240105",
    orderName: "Glazing & Curtain Wall Units",
    store: "GlassPro",
    items: "DGU 6+12+6 Low-E Panels 1200x2400mm",
    quantity: 36,
    unit: "panels",
    totalCost: 29800,
    currency: "USD",
    status: "Processing",
    orderedBy: "M. Tran",
    orderedAt: "2024-04-09T10:30:00Z",
    estimatedDelivery: "2024-04-28T00:00:00Z",
    notes: "Tinted bronze — match facade spec sheet Rev.C",
  },
  {
    id: "ORD-20240106",
    orderName: "Plywood Sheeting (Formwork)",
    store: "WoodCo",
    items: "F14 Structural Plywood 17mm",
    quantity: 120,
    unit: "sheets",
    totalCost: 3960,
    currency: "USD",
    status: "Delivered",
    orderedBy: "L. Pham",
    orderedAt: "2024-03-28T08:00:00Z",
    estimatedDelivery: "2024-04-02T00:00:00Z",
  },
  {
    id: "ORD-20240107",
    orderName: "HVAC Ductwork Set",
    store: "MechDirect",
    items: "Rectangular Galvanised Duct — Various Sizes",
    quantity: 1,
    unit: "lot",
    totalCost: 11200,
    currency: "USD",
    status: "Pending",
    orderedBy: "A. Nguyen",
    orderedAt: "2024-04-14T15:45:00Z",
    estimatedDelivery: "2024-04-30T00:00:00Z",
    notes: "As per M&E drawing set Rev.04",
  },
  {
    id: "ORD-20240108",
    orderName: "Ceramic Floor Tiles",
    store: "TileMaster",
    items: "600×600 Porcelain Matt Dark Slate",
    quantity: 380,
    unit: "m²",
    totalCost: 9120,
    currency: "USD",
    status: "Cancelled",
    orderedBy: "M. Tran",
    orderedAt: "2024-03-20T12:00:00Z",
    estimatedDelivery: "2024-04-01T00:00:00Z",
    notes: "Cancelled — client changed finish spec to polished concrete",
  },
  {
    id: "ORD-20240109",
    orderName: "Waterproofing Membrane",
    store: "BuildMart",
    items: "HDPE Waterproof Membrane 1.5mm",
    quantity: 800,
    unit: "m²",
    totalCost: 5600,
    currency: "USD",
    status: "Processing",
    orderedBy: "L. Pham",
    orderedAt: "2024-04-11T09:30:00Z",
    estimatedDelivery: "2024-04-20T00:00:00Z",
  },
  {
    id: "ORD-20240110",
    orderName: "Rebar Bundle — D16",
    store: "IronHouse Supply",
    items: "Deformed Reinforcing Bar D16 Grade 500N",
    quantity: 12,
    unit: "tonnes",
    totalCost: 14400,
    currency: "USD",
    status: "Delivered",
    orderedBy: "A. Nguyen",
    orderedAt: "2024-03-25T07:00:00Z",
    estimatedDelivery: "2024-03-30T00:00:00Z",
  },
];

const ALL_STORES = ["All Stores", ...Array.from(new Set(MOCK_ORDERS.map((o) => o.store)))];

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; Icon: React.ComponentType<any>; classes: string; dot: string }
> = {
  Pending: {
    label: "Pending",
    Icon: Clock,
    classes:
      "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  Processing: {
    label: "Processing",
    Icon: Truck,
    classes:
      "bg-blue-500/10 text-blue-400 border border-blue-500/30",
    dot: "bg-blue-400",
  },
  Delivered: {
    label: "Delivered",
    Icon: CheckCircle,
    classes:
      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  Cancelled: {
    label: "Cancelled",
    Icon: XCircle,
    classes:
      "bg-red-500/10 text-red-400 border border-red-500/30",
    dot: "bg-red-400",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Hoist to module scope — Intl constructors are expensive to create per call
const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(amount: number, currency: string) {
  if (currency === "USD") return USD_FORMATTER.format(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface StoreOrderPageProps {
  onNavigate: (page: string) => void;
}

export default function StoreOrderPage({ onNavigate }: StoreOrderPageProps) {
  const { isDark } = useThemeStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState("All Stores");
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "All">("All");
  const [toast, setToast] = useState<string | null>(null);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return MOCK_ORDERS.filter((order) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        order.orderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.store.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.items.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStore =
        selectedStore === "All Stores" || order.store === selectedStore;

      const matchStatus =
        selectedStatus === "All" || order.status === selectedStatus;

      return matchSearch && matchStore && matchStatus;
    });
  }, [searchQuery, selectedStore, selectedStatus]);

  // ── Toast helper ───────────────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = MOCK_ORDERS.length;
    const pending = MOCK_ORDERS.filter((o) => o.status === "Pending").length;
    const processing = MOCK_ORDERS.filter((o) => o.status === "Processing").length;
    const delivered = MOCK_ORDERS.filter((o) => o.status === "Delivered").length;
    const totalValue = MOCK_ORDERS.reduce((acc, o) => acc + o.totalCost, 0);
    return { total, pending, processing, delivered, totalValue };
  }, []);

  return (
    <AppShell onNavigate={onNavigate} activeNavTab="Dashboard" activeSidebarItem="Store Orders">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate("dashboard")}
              className="p-1.5 rounded-lg text-slate-500 dark:text-[#94A3B8] hover:text-cyan-400 hover:bg-slate-200 dark:hover:bg-[#1E293B] transition-colors"
              title="Back to Dashboard"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-cyan-400" />
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Store Orders
                </h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Track material &amp; hardware orders for your projects
              </p>
            </div>
          </div>

          <button
            id="new-order-btn"
            onClick={() => showToast("New Order form coming soon — stay tuned!")}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-[#0B0E14] font-semibold text-sm rounded-lg transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            New Order
          </button>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Orders", value: stats.total, color: "text-slate-900 dark:text-white" },
            { label: "Pending", value: stats.pending, color: "text-amber-400" },
            { label: "In Transit", value: stats.processing, color: "text-blue-400" },
            { label: "Delivered", value: stats.delivered, color: "text-emerald-400" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="bg-white dark:bg-[#141921] border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-1 hover:border-cyan-500/40 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#475569]">
                {kpi.label}
              </span>
              <span className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</span>
            </div>
          ))}
        </div>

        {/* ── Total Value Banner ─────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-cyan-900/30 via-slate-800/20 to-transparent border border-cyan-500/20 rounded-xl px-5 py-4 mb-8 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/70 mb-0.5">
              Total Procurement Value
            </p>
            <p className="text-2xl font-bold text-cyan-300">
              {formatCurrency(stats.totalValue, "USD")}
            </p>
          </div>
          <Package className="w-8 h-8 text-cyan-500/40" />
        </div>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#475569]" />
            <input
              id="order-search"
              type="text"
              placeholder="Search by order name, store, or ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#141921] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-[#475569] focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Store Dropdown */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-[#475569] pointer-events-none" />
            <select
              id="store-filter"
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="pl-9 pr-8 py-2 text-sm bg-white dark:bg-[#141921] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors appearance-none cursor-pointer"
            >
              {ALL_STORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Status Chips ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(["All", "Pending", "Processing", "Delivered", "Cancelled"] as const).map((s) => {
            const isActive = selectedStatus === s;
            const cfg = s !== "All" ? STATUS_CONFIG[s] : null;
            return (
              <button
                key={s}
                id={`status-chip-${s.toLowerCase()}`}
                onClick={() => setSelectedStatus(s)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                  isActive
                    ? "bg-cyan-500 text-[#0B0E14] border-cyan-500 shadow-lg shadow-cyan-500/20"
                    : "bg-white dark:bg-[#141921] text-slate-500 dark:text-[#94A3B8] border-slate-200 dark:border-slate-700 hover:border-cyan-500/50 hover:text-cyan-400"
                }`}
              >
                {cfg && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isActive ? "bg-[#0B0E14]" : cfg.dot
                    }`}
                  />
                )}
                {s === "All" ? "All Orders" : s}
              </button>
            );
          })}
          <span className="ml-auto text-xs text-slate-400 dark:text-[#475569] self-center">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── Order Cards ─────────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-[#141921] border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-slate-300 dark:text-[#475569]" />
            </div>
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">
              No orders found
            </h3>
            <p className="text-sm text-slate-400 dark:text-[#475569] max-w-xs">
              Try adjusting your search query or filters to find what you're looking for.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedStore("All Stores");
                setSelectedStatus("All");
              }}
              className="mt-5 px-4 py-2 text-xs font-semibold text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/10 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((order) => {
              const cfg = STATUS_CONFIG[order.status];
              const StatusIcon = cfg.Icon;
              return (
                <div
                  key={order.id}
                  className="group bg-white dark:bg-[#141921] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-200"
                >
                  {/* Card top accent line */}
                  <div
                    className={`h-0.5 w-full ${
                      order.status === "Delivered"
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                        : order.status === "Processing"
                        ? "bg-gradient-to-r from-blue-500 to-blue-400"
                        : order.status === "Cancelled"
                        ? "bg-gradient-to-r from-red-500 to-red-400"
                        : "bg-gradient-to-r from-amber-500 to-amber-400"
                    }`}
                  />

                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-cyan-400 transition-colors truncate">
                          {order.orderName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5 truncate">
                          {order.items}
                        </p>
                      </div>
                      <span
                        className={`flex items-center gap-1.5 ml-3 shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.classes}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Meta grid */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-[#475569] mb-0.5">
                          Store
                        </p>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {order.store}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-[#475569] mb-0.5">
                          Qty
                        </p>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {order.quantity} {order.unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-[#475569] mb-0.5">
                          Total
                        </p>
                        <p className="text-xs font-bold text-cyan-400">
                          {formatCurrency(order.totalCost, order.currency)}
                        </p>
                      </div>
                    </div>

                    {/* Notes */}
                    {order.notes && (
                      <div className="bg-slate-50 dark:bg-[#0B0E14] border border-slate-100 dark:border-[#1E293B] rounded-lg px-3 py-2 mb-4">
                        <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] leading-relaxed italic line-clamp-2">
                          {order.notes}
                        </p>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-[#1E293B] pt-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-cyan-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                          {order.orderedBy.charAt(0)}
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-[#94A3B8]">
                          {order.orderedBy}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[9px] text-slate-400 dark:text-[#475569]">
                          {order.id}
                        </p>
                        <p className="font-mono text-[9px] text-slate-400 dark:text-[#475569]">
                          {formatDate(order.orderedAt)} · ETA {formatDate(order.estimatedDelivery)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-[#141921] border border-cyan-500/40 text-slate-100 text-sm font-medium px-4 py-3 rounded-xl shadow-2xl shadow-black/40 animate-fade-in z-50">
          <ShoppingCart className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toast}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Minimal keyframe for toast — injected inline to avoid extra deps */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out both; }
      `}</style>
    </AppShell>
  );
}
