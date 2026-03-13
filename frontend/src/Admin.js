import { useState, useEffect, useRef, useCallback } from "react";
import Blockeditor from "./Blockeditor";
import { useNavigate } from "react-router-dom";
import { ToastContainer, useToast } from "./Toast";
import {
  User, LogOut, Camera, Settings, Package,
  PackagePlus, Users, ChevronRight, Eye, EyeOff,
  Pencil, Check, X, Plus, Shield, AlertTriangle, LayoutGrid, Ticket,
  AlignLeft, AlignCenter, AlignRight, Image as ImageIcon,
  ShoppingBag, RefreshCw,
  RotateCcw, FileVideo, AlertCircle, FileText, Newspaper, Trash2,
  Table as TableIcon, Highlighter, Type, List, ListOrdered, Palette,
  MessageCircle, Heart, Star, Bell, Search as SearchIcon, CornerDownRight, Loader2,
  BarChart2
} from "lucide-react";

// ── A) Import RevenueDashboard ────────────────────────────────
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, Calendar, Award,
  ArrowUpRight, ArrowDownRight, Minus, ChevronDown
} from "lucide-react";

const API = "http://localhost:8000";
const DASH_API = "http://localhost:8000";

// ── Revenue Dashboard helpers ─────────────────────────────────
const ORANGE   = "#ff9500";
const PURPLE   = "#bf5af2";
const CYAN     = "#32d7d2";
const GREEN    = "#34c759";
const RED      = "#ff3b30";
const PINK     = "#ff2d78";
const BLUE     = "#0a84ff";
const BRAND_COLORS = [ORANGE, PURPLE, CYAN, GREEN, PINK, BLUE, "#ffd60a", "#30d158", "#64d2ff", "#ff9f0a"];

const fmt = (n) => {
  if (n >= 1_000_000_000) return n.toLocaleString("vi-VN");
  if (n >= 1_000_000)     return n.toLocaleString("vi-VN");
  if (n >= 1_000)         return n.toLocaleString("vi-VN");
  return n.toLocaleString("vi-VN");
};
const fmtFull = (n) => Math.round(n).toLocaleString("vi-VN") + "đ";

function useDashFetch(url) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick,    setTick]    = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!url) return;
    setLoading(true);
    fetch(`${DASH_API}${url}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [url, tick]);
  return { data, loading, refresh };
}

function DashKpiCard({ label, value, sub, pct, icon: Icon, color = ORANGE }) {
  const up   = pct > 0;
  const same = pct === null || pct === undefined;
  return (
    <div className="rounded-2xl border border-white/5 p-5 flex flex-col gap-3" style={{ background: "#111" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40 font-medium uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
      </div>
      {!same && (
        <div className="flex items-center gap-1 text-xs font-medium" style={{ color: up ? GREEN : RED }}>
          {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {Math.abs(pct)}% so với kỳ trước
        </div>
      )}
      {same && <div className="flex items-center gap-1 text-xs text-white/30"><Minus size={11} /> Chưa có dữ liệu</div>}
    </div>
  );
}

function DashSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-xl px-3 pr-7 py-1.5 text-xs border outline-none cursor-pointer"
        style={{ background: "#222", borderColor: "rgba(255,255,255,0.1)", color: "white" }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
    </div>
  );
}

function DashTabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className="px-4 py-1.5 rounded-lg text-xs font-medium transition"
          style={{ background: value === t.value ? ORANGE : "transparent", color: value === t.value ? "white" : "rgba(255,255,255,0.45)" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

const DashTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 px-4 py-3 text-xs shadow-2xl" style={{ background: "#1a1a1a", minWidth: 160 }}>
      <p className="text-white/50 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/70">{p.name}:</span>
          <span className="text-white font-semibold ml-auto pl-3">{fmtFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

function DashOverview() {
  const { data, loading, refresh } = useDashFetch("/api/admin/dashboard/overview/");
  if (loading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <div key={i} className="rounded-2xl border border-white/5 p-5 h-28 animate-pulse" style={{ background: "#111" }} />)}
    </div>
  );
  const d = data || {};
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest">Tổng quan</h2>
        <button onClick={refresh} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition">
          <RefreshCw size={11} /> Làm mới
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashKpiCard label="Hôm nay"   value={fmt(d.today?.revenue || 0) + "đ"}      sub={`${d.today?.orders || 0} đơn`}          pct={d.today?.vs_yesterday}   icon={TrendingUp}  color={ORANGE} />
        <DashKpiCard label="Tháng này" value={fmt(d.this_month?.revenue || 0) + "đ"} sub={`${d.this_month?.orders || 0} đơn`}      pct={d.this_month?.vs_last_month} icon={Calendar} color={PURPLE} />
        <DashKpiCard label="Năm nay"   value={fmt(d.this_year?.revenue || 0) + "đ"}  sub="doanh thu năm"                            pct={d.this_year?.vs_last_year}   icon={BarChart2} color={CYAN}   />
        <DashKpiCard label="Tất cả"    value={fmt(d.all_time?.revenue || 0) + "đ"}   sub={`${d.all_time?.orders || 0} đơn tổng`}   pct={null}                       icon={ShoppingBag} color={GREEN} />
      </div>
    </div>
  );
}

function DashRevenueChart() {
  const today   = new Date();
  const [mode,  setMode]  = useState("month");
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const url = mode === "day"
    ? `/api/admin/dashboard/revenue/day/?year=${year}&month=${month}`
    : mode === "month"
    ? `/api/admin/dashboard/revenue/month/?year=${year}`
    : `/api/admin/dashboard/revenue/year/`;

  const { data, loading } = useDashFetch(url);
  const rows = data?.data || [];
  const chartData = rows.map((r) => ({
    name: mode === "day" ? `${r.day}` : mode === "month" ? `T${r.month}` : `${r.year}`,
    "Kỳ này":   r.revenue,
    "Kỳ trước": r.prev_revenue ?? undefined,
  }));

  const years  = Array.from({ length: 5 }, (_, i) => ({ value: today.getFullYear() - i, label: `${today.getFullYear() - i}` }));
  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest">Biểu đồ doanh thu</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <DashTabs tabs={[{label:"Ngày",value:"day"},{label:"Tháng",value:"month"},{label:"Năm",value:"year"}]} value={mode} onChange={setMode} />
          {mode !== "year" && <DashSelect value={year} onChange={(v) => setYear(+v)} options={years.map(y => ({value: y.value, label: y.label}))} />}
          {mode === "day"  && <DashSelect value={month} onChange={(v) => setMonth(+v)} options={months} />}
        </div>
      </div>
      <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#111" }}>
        {loading
          ? <div className="h-64 flex items-center justify-center text-white/30 text-sm">Đang tải...</div>
          : chartData.length === 0
          ? <div className="h-64 flex items-center justify-center text-white/30 text-sm">Không có dữ liệu</div>
          : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gO2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={ORANGE} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={ORANGE} stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gP2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={PURPLE} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={PURPLE} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<DashTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)", paddingTop: 8 }} />
              <Area type="monotone" dataKey="Kỳ này"   stroke={ORANGE} strokeWidth={2}   fill="url(#gO2)" dot={false} activeDot={{ r: 4, fill: ORANGE }} />
              {chartData[0]?.["Kỳ trước"] !== undefined && (
                <Area type="monotone" dataKey="Kỳ trước" stroke={PURPLE} strokeWidth={1.5} fill="url(#gP2)" dot={false} strokeDasharray="4 3" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function DashCompare() {
  const [mode,  setMode]  = useState("month");
  const [input, setInput] = useState("2024-01,2024-06,2024-12");
  const [url,   setUrl]   = useState(null);
  const { data, loading } = useDashFetch(url);
  const rows = data?.data || [];
  const placeholders = { day: "2024-06-01, 2024-06-15", month: "2024-01, 2024-06", year: "2022, 2023, 2024" };

  return (
    <div>
      <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-4">So sánh khoảng thời gian</h2>
      <div className="rounded-2xl border border-white/5 p-5 flex flex-col gap-5" style={{ background: "#111" }}>
        <div className="flex flex-wrap items-center gap-3">
          <DashTabs tabs={[{label:"Ngày",value:"day"},{label:"Tháng",value:"month"},{label:"Năm",value:"year"}]} value={mode} onChange={(v) => { setMode(v); setInput(""); }} />
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`VD: ${placeholders[mode]}`}
            className="flex-1 min-w-48 rounded-xl px-4 py-1.5 text-xs border outline-none"
            style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: "white" }} />
          <button onClick={() => setUrl(`/api/admin/dashboard/revenue/compare/?mode=${mode}&values=${encodeURIComponent(input.trim())}`)}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold transition" style={{ background: ORANGE, color: "white" }}>
            So sánh
          </button>
        </div>
        {loading && <div className="h-48 flex items-center justify-center text-white/30 text-sm">Đang tải...</div>}
        {!loading && rows.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} width={55} />
                <Tooltip content={<DashTooltip />} />
                <Bar dataKey="revenue" name="Doanh thu" radius={[6,6,0,0]}>
                  {rows.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {rows.map((r, i) => (
                <div key={i} className="rounded-xl p-3 border border-white/5" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="w-2 h-2 rounded-full mb-2" style={{ background: BRAND_COLORS[i % BRAND_COLORS.length] }} />
                  <p className="text-xs text-white/50 mb-1">{r.label}</p>
                  <p className="text-sm font-bold">{fmt(r.revenue)}đ</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{r.orders} đơn</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DashTopProducts() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState("");
  const url = `/api/admin/dashboard/revenue/product/?limit=10${year ? `&year=${year}` : ""}${month ? `&month=${month}` : ""}`;
  const { data, loading } = useDashFetch(url);
  const rows = data?.data || [];
  const maxRev = rows[0]?.revenue || 1;
  const years  = [{ value: "", label: "Tất cả" }, ...Array.from({ length: 5 }, (_, i) => ({ value: today.getFullYear() - i, label: `${today.getFullYear() - i}` }))];
  const months = [{ value: "", label: "Cả năm" }, ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` }))];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest">Top sản phẩm</h2>
        <div className="flex gap-2">
          <DashSelect value={year}  onChange={setYear}  options={years}  />
          <DashSelect value={month} onChange={setMonth} options={months} />
        </div>
      </div>
      <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#111" }}>
        {loading
          ? <div className="py-10 text-center text-white/30 text-sm">Đang tải...</div>
          : rows.length === 0
          ? <div className="py-10 text-center text-white/30 text-sm">Không có dữ liệu</div>
          : (
          <div className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <div key={r.product_id} className="flex items-center gap-4">
                <span className="w-5 text-center text-xs font-bold" style={{ color: i < 3 ? ORANGE : "rgba(255,255,255,0.2)" }}>{i + 1}</span>
                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-white/5 flex items-center justify-center" style={{ background: "#222" }}>
                  {r.image ? <img src={r.image} alt="" className="w-full h-full object-contain p-0.5" /> : <Package size={14} className="text-white/20" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{r.product_name}</p>
                  <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${(r.revenue / maxRev) * 100}%`, background: i < 3 ? ORANGE : "rgba(255,255,255,0.2)" }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold" style={{ color: ORANGE }}>{fmt(r.revenue)}đ</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{r.qty_sold} sp</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DashBrandRevenue() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState("");
  const url = `/api/admin/dashboard/revenue/brand/?${year ? `year=${year}` : ""}${month ? `&month=${month}` : ""}`;
  const { data, loading } = useDashFetch(url);
  const rows = data?.data || [];
  const years  = [{ value: "", label: "Tất cả" }, ...Array.from({ length: 5 }, (_, i) => ({ value: today.getFullYear() - i, label: `${today.getFullYear() - i}` }))];
  const months = [{ value: "", label: "Cả năm" }, ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` }))];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest">Doanh thu theo hãng</h2>
        <div className="flex gap-2">
          <DashSelect value={year}  onChange={setYear}  options={years}  />
          <DashSelect value={month} onChange={setMonth} options={months} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#111" }}>
          {loading || rows.length === 0
            ? <div className="h-56 flex items-center justify-center text-white/30 text-sm">{loading ? "Đang tải..." : "Không có dữ liệu"}</div>
            : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={rows} dataKey="revenue" nameKey="brand" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2} stroke="none">
                  {rows.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtFull(v)} contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#111" }}>
          {loading
            ? <div className="py-10 text-center text-white/30 text-sm">Đang tải...</div>
            : rows.length === 0
            ? <div className="py-10 text-center text-white/30 text-sm">Không có dữ liệu</div>
            : (
            <div className="flex flex-col gap-3">
              {rows.map((r, i) => (
                <div key={r.brand} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: BRAND_COLORS[i % BRAND_COLORS.length] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold truncate">{r.brand}</span>
                      <span className="text-xs text-white/40 ml-2 shrink-0">{r.share_pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full" style={{ width: `${r.share_pct}%`, background: BRAND_COLORS[i % BRAND_COLORS.length] }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs font-bold">{fmt(r.revenue)}đ</p>
                    <p className="text-[10px] text-white/30">{r.qty_sold} sp · {r.order_count} đơn</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RevenueDashboard() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/5 text-xs text-white/40" style={{ background: "#111" }}>
          <Award size={13} className="text-orange-400" />
          Chỉ tính đơn hàng <span className="text-green-400 font-medium mx-1">Delivered</span>
        </div>
      </div>
      <DashOverview />
      <DashRevenueChart />
      <DashCompare />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <DashTopProducts />
        <DashBrandRevenue />
      </div>
    </div>
  );
}

// ============================================================
// TOOLBAR HELPERS
// ============================================================
function ToolBtn({ title, onClick, children, extra = "" }) {
  return (
    <button type="button" title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick?.(); }}
      className={`w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition ${extra}`}>
      {children}
    </button>
  );
}
function Divider() { return <div className="w-px h-5 bg-white/10 mx-0.5 shrink-0" />; }

// ============================================================
// RICH TEXT EDITOR — đầy đủ: màu chữ, nền chữ, bảng + nền ô
// ============================================================
function RichEditor({ value, onChange }) {
  const { toast } = useToast();
  const editorRef       = useRef(null);
  const [showTxtClr,  setShowTxtClr]  = useState(false);
  const [showBgClr,   setShowBgClr]   = useState(false);
  const [showTbl,     setShowTbl]     = useState(false);
  const [showCellBg,  setShowCellBg]  = useState(false);
  const txtRef  = useRef(null);
  const bgRef   = useRef(null);
  const tblRef  = useRef(null);
  const cellRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    const fn = (e) => {
      if (txtRef.current  && !txtRef.current.contains(e.target))  setShowTxtClr(false);
      if (bgRef.current   && !bgRef.current.contains(e.target))   setShowBgClr(false);
      if (tblRef.current  && !tblRef.current.contains(e.target))  setShowTbl(false);
      if (cellRef.current && !cellRef.current.contains(e.target)) setShowCellBg(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const exec = (cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    sync();
  };
  const sync = () => { if (editorRef.current) onChange(editorRef.current.innerHTML); };

  const setTxtColor  = (c) => { exec("foreColor",   c); setShowTxtClr(false); };
  const setBgColor   = (c) => { exec("hiliteColor",  c); setShowBgClr(false); };

  const insertImage = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => exec("insertImage", r.result);
      r.readAsDataURL(f);
    };
    inp.click();
  };

  const insertTable = (rows, cols) => {
    editorRef.current?.focus();
    let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0;">';
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html += `<td style="border:1px solid rgba(255,255,255,0.2);padding:8px 12px;min-width:80px;vertical-align:top;" contenteditable="true">&nbsp;</td>`;
      }
      html += "</tr>";
    }
    html += "</table><p><br></p>";
    document.execCommand("insertHTML", false, html);
    sync();
    setShowTbl(false);
  };

  const tableAction = (action) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const node = sel.getRangeAt(0).startContainer;
    const td    = (node.nodeType === 3 ? node.parentElement : node)?.closest?.("td,th");
    const tr    = td?.closest("tr");
    const table = td?.closest("table");
    if (!td || !tr || !table) { toast.info("Hãy click vào một ô trong bảng trước"); return; }

    const rows    = Array.from(table.querySelectorAll("tr"));
    const cols    = Array.from(tr.querySelectorAll("td,th"));
    const colIdx  = cols.indexOf(td);

    if (action === "add-row") {
      const newTr = tr.cloneNode(false);
      cols.forEach(() => {
        const c = document.createElement("td");
        c.setAttribute("contenteditable", "true");
        c.style.cssText = "border:1px solid rgba(255,255,255,0.2);padding:8px 12px;min-width:80px;vertical-align:top;";
        c.innerHTML = "&nbsp;";
        newTr.appendChild(c);
      });
      tr.insertAdjacentElement("afterend", newTr);
    } else if (action === "del-row") {
      if (rows.length > 1) tr.remove(); else toast.info("Bảng phải có ít nhất 1 hàng");
    } else if (action === "add-col") {
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll("td,th"));
        const newTd = document.createElement("td");
        newTd.setAttribute("contenteditable", "true");
        newTd.style.cssText = "border:1px solid rgba(255,255,255,0.2);padding:8px 12px;min-width:80px;vertical-align:top;";
        newTd.innerHTML = "&nbsp;";
        if (cells[colIdx]) cells[colIdx].insertAdjacentElement("afterend", newTd);
        else row.appendChild(newTd);
      });
    } else if (action === "del-col") {
      if (cols.length > 1) rows.forEach(row => { const c = Array.from(row.querySelectorAll("td,th")); if (c[colIdx]) c[colIdx].remove(); });
      else toast.info("Bảng phải có ít nhất 1 cột");
    }
    sync();
    setShowTbl(false);
  };

  const setCellBgColor = (color) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const node = sel.getRangeAt(0).startContainer;
    const td = (node.nodeType === 3 ? node.parentElement : node)?.closest?.("td,th");
    if (!td) { toast.info("Hãy click vào một ô trong bảng trước"); return; }
    td.style.background = color;
    sync();
    setShowCellBg(false);
  };

  const TEXT_COLORS = [
    "#ffffff","#f4f4f5","#a1a1aa","#71717a",
    "#ff3b30","#ff6b6b","#ff9500","#ffd60a",
    "#30d158","#34c759","#0a84ff","#5ac8fa",
    "#bf5af2","#ff2d55","#ac8e68","#000000",
  ];
  const BG_COLORS = [
    "transparent",
    "rgba(255,59,48,0.35)","rgba(255,149,0,0.35)","rgba(255,214,10,0.35)",
    "rgba(48,209,88,0.35)","rgba(10,132,255,0.35)","rgba(191,90,242,0.35)",
    "rgba(255,255,255,0.15)","rgba(0,0,0,0.5)",
    "#ff3b30","#ff9500","#ffd60a","#30d158","#0a84ff","#1a1a2e",
  ];
  const CELL_BG = [
    "transparent",
    "rgba(255,59,48,0.2)","rgba(255,149,0,0.2)","rgba(255,214,10,0.2)",
    "rgba(48,209,88,0.2)","rgba(10,132,255,0.2)","rgba(191,90,242,0.2)",
    "rgba(255,255,255,0.06)","rgba(0,0,0,0.35)",
    "#1c1c2e","#0d2137","#1a2e1a","#2e1a1a","#2e2a1a","#1a1a1a",
  ];
  const SIZES = [{ l:"S", v:"2" },{ l:"M", v:"3" },{ l:"L", v:"4" },{ l:"XL", v:"5" },{ l:"2XL", v:"6" }];
  const TBL_PRESETS = [{ l:"2×2",r:2,c:2 },{ l:"3×2",r:3,c:2 },{ l:"4×3",r:4,c:3 },{ l:"5×3",r:5,c:3 },{ l:"3×4",r:3,c:4 },{ l:"2×5",r:2,c:5 }];

  return (
    <div className="border border-white/10 rounded-xl overflow-visible">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-2 bg-white/[0.03] border-b border-white/10 rounded-t-xl">
        <ToolBtn title="In đậm" onClick={() => exec("bold")}><strong className="text-xs">B</strong></ToolBtn>
        <ToolBtn title="In nghiêng" onClick={() => exec("italic")}><em className="text-xs italic">I</em></ToolBtn>
        <ToolBtn title="Gạch chân" onClick={() => exec("underline")}><span className="text-xs underline">U</span></ToolBtn>
        <ToolBtn title="Gạch ngang" onClick={() => exec("strikeThrough")}><span className="text-xs line-through">S</span></ToolBtn>
        <Divider />
        <ToolBtn title="Căn trái"  onClick={() => exec("justifyLeft")}> <AlignLeft   size={13} /></ToolBtn>
        <ToolBtn title="Căn giữa"  onClick={() => exec("justifyCenter")}><AlignCenter size={13} /></ToolBtn>
        <ToolBtn title="Căn phải"  onClick={() => exec("justifyRight")}> <AlignRight  size={13} /></ToolBtn>
        <Divider />
        {SIZES.map(s => (
          <button key={s.v} type="button" onMouseDown={(e) => { e.preventDefault(); exec("fontSize", s.v); }}
            className="px-2 h-7 rounded-lg hover:bg-white/10 text-xs text-white/50 hover:text-white transition">{s.l}</button>
        ))}
        <Divider />
        <div className="relative" ref={txtRef}>
          <button type="button" title="Màu chữ"
            onMouseDown={e => { e.preventDefault(); setShowTxtClr(p => !p); setShowBgClr(false); setShowTbl(false); setShowCellBg(false); }}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex flex-col items-center justify-center gap-0.5 transition">
            <Type size={11} className="text-white/70" />
            <div className="w-4 h-1 rounded-full bg-[#ff3b30]" />
          </button>
          {showTxtClr && (
            <div className="absolute top-9 left-0 z-[60] bg-[#1e1e1e] border border-white/10 rounded-xl p-2.5 shadow-2xl w-44">
              <p className="text-[10px] text-white/30 mb-2 px-0.5">Màu chữ</p>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {TEXT_COLORS.map(c => (
                  <button key={c} type="button" onMouseDown={e => { e.preventDefault(); setTxtColor(c); }} style={{ backgroundColor: c }}
                    className="w-7 h-7 rounded-lg border border-white/15 hover:scale-110 transition hover:border-white/50" />
                ))}
              </div>
              <div className="border-t border-white/5 pt-2 flex items-center gap-2">
                <span className="text-[10px] text-white/30">Custom:</span>
                <input type="color" defaultValue="#ffffff" onChange={e => setTxtColor(e.target.value)} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0" />
              </div>
            </div>
          )}
        </div>
        <div className="relative" ref={bgRef}>
          <button type="button" title="Nền chữ (highlight)"
            onMouseDown={e => { e.preventDefault(); setShowBgClr(p => !p); setShowTxtClr(false); setShowTbl(false); setShowCellBg(false); }}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex flex-col items-center justify-center gap-0.5 transition">
            <Highlighter size={11} className="text-white/70" />
            <div className="w-4 h-1 rounded-full bg-yellow-400" />
          </button>
          {showBgClr && (
            <div className="absolute top-9 left-0 z-[60] bg-[#1e1e1e] border border-white/10 rounded-xl p-2.5 shadow-2xl w-44">
              <p className="text-[10px] text-white/30 mb-2 px-0.5">Nền chữ</p>
              <div className="grid grid-cols-5 gap-1.5 mb-2">
                {BG_COLORS.map((c, i) => (
                  <button key={i} type="button" onMouseDown={e => { e.preventDefault(); setBgColor(c); }}
                    style={{ backgroundColor: c === "transparent" ? undefined : c }}
                    className={`w-6 h-6 rounded-md border hover:scale-110 transition ${c === "transparent" ? "border-dashed border-white/30 text-[8px] text-white/30 flex items-center justify-center" : "border-white/10 hover:border-white/40"}`}>
                    {c === "transparent" ? "∅" : ""}
                  </button>
                ))}
              </div>
              <div className="border-t border-white/5 pt-2 flex items-center gap-2">
                <span className="text-[10px] text-white/30">Custom:</span>
                <input type="color" defaultValue="#ffd60a" onChange={e => setBgColor(e.target.value)} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0" />
              </div>
            </div>
          )}
        </div>
        <Divider />
        <ToolBtn title="Danh sách •" onClick={() => exec("insertUnorderedList")}><List size={13} /></ToolBtn>
        <ToolBtn title="Danh sách số" onClick={() => exec("insertOrderedList")}><ListOrdered size={13} /></ToolBtn>
        <Divider />
        <div className="relative" ref={tblRef}>
          <button type="button" title="Bảng"
            onMouseDown={e => { e.preventDefault(); setShowTbl(p => !p); setShowTxtClr(false); setShowBgClr(false); setShowCellBg(false); }}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition">
            <TableIcon size={13} />
          </button>
          {showTbl && (
            <div className="absolute top-9 left-0 z-[60] bg-[#1e1e1e] border border-white/10 rounded-xl p-3 shadow-2xl w-56">
              <p className="text-[10px] text-white/40 mb-2 font-medium uppercase tracking-wider">Tạo bảng mới</p>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {TBL_PRESETS.map(({ l, r, c }) => (
                  <button key={l} type="button" onMouseDown={e => { e.preventDefault(); insertTable(r, c); }}
                    className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-orange-500/15 hover:text-orange-400 text-xs text-white/50 border border-white/5 hover:border-orange-500/30 transition">{l}</button>
                ))}
              </div>
              <div className="border-t border-white/5 pt-2.5">
                <p className="text-[10px] text-white/40 mb-1.5 font-medium uppercase tracking-wider">Chỉnh bảng hiện tại</p>
                <div className="flex flex-col gap-1">
                  {[
                    { a:"add-row", l:"+ Thêm hàng bên dưới", pos:true },
                    { a:"del-row", l:"− Xóa hàng hiện tại",  pos:false },
                    { a:"add-col", l:"+ Thêm cột bên phải",  pos:true },
                    { a:"del-col", l:"− Xóa cột hiện tại",   pos:false },
                  ].map(({ a, l, pos }) => (
                    <button key={a} type="button" onMouseDown={e => { e.preventDefault(); tableAction(a); }}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs transition border ${pos ? "bg-green-500/5 hover:bg-green-500/15 text-green-400/70 hover:text-green-400 border-green-500/10 hover:border-green-500/30" : "bg-red-500/5 hover:bg-red-500/15 text-red-400/70 hover:text-red-400 border-red-500/10 hover:border-red-500/30"}`}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="relative" ref={cellRef}>
          <button type="button" title="Màu nền ô bảng (click vào ô trước)"
            onMouseDown={e => { e.preventDefault(); setShowCellBg(p => !p); setShowTxtClr(false); setShowBgClr(false); setShowTbl(false); }}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex flex-col items-center justify-center gap-0.5 transition">
            <Palette size={11} className="text-white/70" />
            <div className="w-4 h-1 rounded-full bg-blue-400" />
          </button>
          {showCellBg && (
            <div className="absolute top-9 left-0 z-[60] bg-[#1e1e1e] border border-white/10 rounded-xl p-2.5 shadow-2xl w-44">
              <p className="text-[10px] text-white/30 mb-1 px-0.5">Màu nền ô bảng</p>
              <p className="text-[9px] text-white/20 mb-2 px-0.5">Click vào ô trong bảng trước</p>
              <div className="grid grid-cols-5 gap-1.5 mb-2">
                {CELL_BG.map((c, i) => (
                  <button key={i} type="button" onMouseDown={e => { e.preventDefault(); setCellBgColor(c); }}
                    style={{ backgroundColor: c === "transparent" ? undefined : c }}
                    className={`w-6 h-6 rounded-md border hover:scale-110 transition ${c === "transparent" ? "border-dashed border-white/30 text-[8px] text-white/30 flex items-center justify-center" : "border-white/10 hover:border-white/40"}`}>
                    {c === "transparent" ? "∅" : ""}
                  </button>
                ))}
              </div>
              <div className="border-t border-white/5 pt-2 flex items-center gap-2">
                <span className="text-[10px] text-white/30">Custom:</span>
                <input type="color" defaultValue="#0a84ff" onChange={e => setCellBgColor(e.target.value)} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0" />
              </div>
            </div>
          )}
        </div>
        <Divider />
        <ToolBtn title="Chèn ảnh" onClick={insertImage} extra="hover:bg-orange-500/20 text-orange-400">
          <ImageIcon size={13} />
        </ToolBtn>
        <ToolBtn title="Xóa định dạng" onClick={() => exec("removeFormat")} extra="hover:bg-red-500/10 text-white/30 hover:text-red-400">
          <span className="text-xs line-through">T</span>
        </ToolBtn>
      </div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        onInput={sync} onBlur={sync}
        className="min-h-[160px] max-h-[400px] overflow-y-auto p-4 text-sm text-white/70 outline-none leading-relaxed rounded-b-xl"
        style={{ caretColor: "white" }}
        data-placeholder="Nhập nội dung... (hỗ trợ định dạng, màu chữ, nền chữ, bảng)" />
      <style>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: rgba(255,255,255,0.2); pointer-events: none; display: block; }
        [contenteditable] img { max-width:100%; border-radius:8px; margin:4px 0; }
        [contenteditable] table { border-collapse:collapse; width:100%; margin:8px 0; }
        [contenteditable] td,[contenteditable] th { border:1px solid rgba(255,255,255,0.2); padding:8px 12px; min-width:80px; vertical-align:top; }
      `}</style>
    </div>
  );
}

// ============================================================
// MAIN ADMIN
// ============================================================
export default function Admin() {
  const navigate   = useNavigate();
  const adminLocal = JSON.parse(localStorage.getItem("admin_user") || "{}");

  const [activeTab, setActiveTab]         = useState("profile");
  const [admin, setAdmin]                 = useState(null);
  const [loading, setLoading]             = useState(true);
  const { toasts, removeToast, toast }    = useToast();
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmModal, setConfirmModal]   = useState(null);
  const [saving, setSaving]               = useState(false);
  const [errors, setErrors]               = useState({});

  const [editPass, setEditPass] = useState(false);
  const [passForm, setPassForm] = useState({ current: "", newPass: "", confirm: "" });
  const [showPass, setShowPass] = useState({ current: false, newPass: false, confirm: false });

  const [staffList, setStaffList]           = useState([]);
  const [staffLoading, setStaffLoading]     = useState(false);
  const [showAddStaff, setShowAddStaff]     = useState(false);
  const [newStaff, setNewStaff]             = useState({ fullname: "", email: "", password: "", role: "Staff" });
  const [newStaffErrors, setNewStaffErrors] = useState({});

  const [catList, setCatList]               = useState([]);
  const [catLoading, setCatLoading]         = useState(false);
  const [showAddCat, setShowAddCat]         = useState(false);
  const [catSaving, setCatSaving]           = useState(false);
  const [editCatId, setEditCatId]           = useState(null);
  const [editCatName, setEditCatName]       = useState("");
  const [editCatImage, setEditCatImage]     = useState(null);
  const [editCatPreview, setEditCatPreview] = useState("");
  const [newCatName, setNewCatName]         = useState("");
  const [newCatImage, setNewCatImage]       = useState(null);
  const [newCatPreview, setNewCatPreview]   = useState("");
  const catImageRef   = useRef(null);
  const editCatImgRef = useRef(null);

  const [categories, setCategories]         = useState([]);
  const [productList, setProductList]       = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productSaving, setProductSaving]   = useState(false);
  const [productErrors, setProductErrors]   = useState({});
  const [newProduct, setNewProduct] = useState({ name: "", brand: "", description: "", categoryId: "" });

  const EMPTY_VARIANT = {
    color:"",storage:"",ram:"",price:"",stock:"",
    cpu:"",os:"",screenSize:"",screenTech:"",refreshRate:"",
    battery:"",chargingSpeed:"",frontCamera:"",rearCamera:"",
    weights:"",updates:"",imageFile:null,imagePreview:"",
  };
  const [variants, setVariants]           = useState([{ ...EMPTY_VARIANT }]);
  const [productImages, setProductImages] = useState([]);
  const productImageRef = useRef(null);

  const [addVarProductId,   setAddVarProductId]   = useState(null);
  const [addVarProductName, setAddVarProductName] = useState("");
  const [addVarList,        setAddVarList]        = useState([{ ...EMPTY_VARIANT }]);
  const [addVarErrors,      setAddVarErrors]      = useState({});
  const [addVarSaving,      setAddVarSaving]      = useState(false);
  const [editProductId,   setEditProductId]   = useState(null);
  const [editProductData, setEditProductData] = useState({});
  const [editProductSaving, setEditProductSaving] = useState(false);
  const [editVariantId,   setEditVariantId]   = useState(null);
  const [editVariantData, setEditVariantData] = useState({});
  const [editVariantSaving, setEditVariantSaving] = useState(false);
  const [productDetailMap, setProductDetailMap] = useState({});
  const [loadingDetailId,  setLoadingDetailId]  = useState(null);
  const [existingVariants,  setExistingVariants]  = useState([]);

  const [voucherList, setVoucherList]       = useState([]);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [showAddVoucher, setShowAddVoucher] = useState(false);
  const [voucherSaving, setVoucherSaving]   = useState(false);
  const [newVoucher, setNewVoucher] = useState({
    code:"",type:"percent",value:"",scope:"all",
    category_id:"",product_id:"",variant_id:"",
    min_order:"",max_discount:"",start_date:"",end_date:"",usage_limit:"",
  });
  const [voucherVariants,   setVoucherVariants]   = useState([]);
  const [voucherVarLoading, setVoucherVarLoading] = useState(false);

  const [orderList,     setOrderList]     = useState([]);
  const [orderLoading,  setOrderLoading]  = useState(false);
  const [orderDetail,   setOrderDetail]   = useState(null);
  const [updatingOrder, setUpdatingOrder] = useState(null);
  const [statusNote,    setStatusNote]    = useState("");

  const [postList,     setPostList]     = useState([]);
  const [postLoading,  setPostLoading]  = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [editingPost,  setEditingPost]  = useState(null);
  const [postForm,     setPostForm]     = useState({ title:"", category:"Mẹo vặt", blocks:[], mediaFiles:{} });
  const [postSaving,   setPostSaving]   = useState(false);

  const [pcProductId,  setPcProductId]  = useState("");
  const [pcBlocks,     setPcBlocks]     = useState([]);
  const [pcMediaFiles, setPcMediaFiles] = useState({});
  const [pcSaving,     setPcSaving]     = useState(false);
  const [pcLoaded,     setPcLoaded]     = useState(false);

  const [reviewList,        setReviewList]        = useState([]);
  const [reviewLoading,     setReviewLoading]     = useState(false);
  const [reviewFilter,      setReviewFilter]      = useState("all");
  const [reviewSearch,      setReviewSearch]      = useState("");
  const [reviewType,        setReviewType]        = useState("reviews");
  const [replyTarget,       setReplyTarget]       = useState(null);
  const [replyText,         setReplyText]         = useState("");
  const [replySaving,       setReplySaving]       = useState(false);
  const [unansweredCount,   setUnansweredCount]   = useState(0);

  const [returnList,       setReturnList]       = useState([]);
  const [returnLoading,    setReturnLoading]    = useState(false);
  const [returnDetail,     setReturnDetail]     = useState(null);
  const [returnNote,       setReturnNote]       = useState("");
  const [processingReturn, setProcessingReturn] = useState(false);

  const [importProductId, setImportProductId] = useState("");
  const [importVariants,  setImportVariants]  = useState([]);
  const [importQty,       setImportQty]       = useState({});
  const [importLoading,   setImportLoading]   = useState(false);
  const [importSaving,    setImportSaving]    = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!adminLocal.id || adminLocal.loginType !== "admin") { navigate("/admin/login"); return; }
    fetch(`${API}/api/staff/${adminLocal.id}/`).then(r=>r.json()).then(setAdmin)
      .catch(()=>setAdmin({ id:adminLocal.id,full_name:adminLocal.fullName,email:adminLocal.username,avatar:adminLocal.avatar,role:adminLocal.role }))
      .finally(()=>setLoading(false));
  },[]); // eslint-disable-line

  useEffect(()=>{ if(activeTab==="staff")           loadStaff();      },[activeTab]); // eslint-disable-line
  useEffect(()=>{ if(activeTab==="product")         loadProducts();   },[activeTab]); // eslint-disable-line
  useEffect(()=>{ if(activeTab==="orders")          loadOrders();     },[activeTab]); // eslint-disable-line
  useEffect(()=>{ if(activeTab==="category")        loadCategories(); },[activeTab]); // eslint-disable-line
  useEffect(()=>{ if(activeTab==="import")          loadProducts();   },[activeTab]); // eslint-disable-line
  useEffect(()=>{ if(activeTab==="returns")         loadReturns();    },[activeTab]); // eslint-disable-line
  useEffect(()=>{ if(activeTab==="posts")           loadPosts();      },[activeTab]); // eslint-disable-line
  useEffect(()=>{ if(activeTab==="product_content") loadProducts();   },[activeTab]); // eslint-disable-line
  useEffect(()=>{ if(activeTab==="reviews")         loadReviews();    },[activeTab]); // eslint-disable-line
  useEffect(()=>{
    if(activeTab==="voucher"){ loadVouchers(); if(categories.length===0||productList.length===0) loadProducts(); }
  },[activeTab]); // eslint-disable-line

  useEffect(()=>{
    const fetchCount = () => fetch(`${API}/api/admin/reviews/?count_only=1`).then(r=>r.json()).then(d=>setUnansweredCount(d.unanswered_count||0)).catch(()=>{});
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  },[]);

  const loadStaff = async()=>{ setStaffLoading(true); try{ const r=await fetch(`${API}/api/staff/list/`); const d=await r.json(); if(r.ok)setStaffList(d.staff||[]); }finally{ setStaffLoading(false); } };
  const loadProducts = async()=>{ setProductLoading(true); try{ const[cr,pr]=await Promise.all([fetch(`${API}/api/product/categories/`),fetch(`${API}/api/product/list/`)]); const cd=await cr.json(); const pd=await pr.json(); if(cr.ok)setCategories(cd.categories||[]); if(pr.ok)setProductList(pd.products||[]); }finally{ setProductLoading(false); } };
  const loadCategories = async()=>{ setCatLoading(true); try{ const r=await fetch(`${API}/api/product/categories/`); const d=await r.json(); if(r.ok)setCatList(d.categories||[]); }finally{ setCatLoading(false); } };
  const loadVouchers = async()=>{ setVoucherLoading(true); try{ const r=await fetch(`${API}/api/voucher/list/`); const d=await r.json(); if(r.ok)setVoucherList(d.vouchers||[]); }finally{ setVoucherLoading(false); } };
  const loadVoucherVariants = async(pid)=>{ if(!pid){ setVoucherVariants([]); return; } setVoucherVarLoading(true); try{ const r=await fetch(`${API}/api/product/${pid}/variants/`); const d=await r.json(); if(r.ok)setVoucherVariants(d.variants||[]); }finally{ setVoucherVarLoading(false); } };
  const loadOrders = async()=>{ setOrderLoading(true); try{ const r=await fetch(`${API}/api/order/admin/list/`); const d=await r.json(); setOrderList(d.orders||[]); }catch{}finally{ setOrderLoading(false); } };
  const loadPosts = async()=>{ setPostLoading(true); try{ const r=await fetch(`${API}/api/post/list/?category=all`); const d=await r.json(); setPostList(d.posts||[]); }catch{}finally{ setPostLoading(false); } };
  const loadReturns = async()=>{ setReturnLoading(true); try{ const r=await fetch(`${API}/api/order/return/list/`); const d=await r.json(); setReturnList(d.returns||[]); }catch{}finally{ setReturnLoading(false); } };
  const loadReviews = async()=>{ setReviewLoading(true); try{ const r=await fetch(`${API}/api/admin/reviews/`); const d=await r.json(); setReviewList(d.items||[]); setUnansweredCount(d.unanswered_count||0); }catch{}finally{ setReviewLoading(false); } };
  const submitAdminReply = async()=>{ if(!replyText.trim()||!replyTarget) return; setReplySaving(true); try{ const res=await fetch(`${API}/api/admin/reply/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:replyTarget.type,target_id:replyTarget.id,content:replyText})}); const d=await res.json(); if(d.ok){ setReplyTarget(null); setReplyText(""); loadReviews(); } }finally{ setReplySaving(false); } };

  const addVariant    = ()=>setVariants(v=>[...v,{...EMPTY_VARIANT}]);
  const removeVariant = (i)=>setVariants(v=>v.filter((_,idx)=>idx!==i));
  const updateVariant = (i,key,val)=>setVariants(v=>v.map((item,idx)=>idx===i?{...item,[key]:val}:item));

  const validateRam = (val)=>{ if(!val)return"Vui lòng nhập RAM"; const m=val.trim().match(/^(\d+(?:\.\d+)?)\s*GB$/i); if(!m)return"RAM phải có dạng số + GB (VD: 8GB)"; if(parseFloat(m[1])<4)return"RAM tối thiểu là 4GB"; return null; };
  const validateStorage = (val)=>{ if(!val)return null; const m=val.trim().match(/^(\d+(?:\.\d+)?)\s*(GB|TB)$/i); if(!m)return"Bộ nhớ phải có dạng số + GB/TB"; const n=parseFloat(m[1]),u=m[2].toUpperCase(); if(u==="GB"&&n<64)return"Bộ nhớ GB phải từ 64GB trở lên"; if(u==="TB"&&n<1)return"Bộ nhớ TB phải từ 1TB trở lên"; return null; };

  const handleSaveProduct = async()=>{
    const errs={};
    if(!newProduct.name.trim())errs.name="Vui lòng nhập tên sản phẩm";
    if(!newProduct.categoryId)errs.categoryId="Vui lòng chọn danh mục";
    if(variants.length===0)errs.variants="Cần ít nhất 1 biến thể";
    const ve=variants.map(v=>{ const e={}; if(!v.price||isNaN(v.price)||parseFloat(v.price)<=0)e.price="Giá phải lớn hơn 0"; if(!v.stock||isNaN(v.stock)||parseInt(v.stock)<=0)e.stock="Số lượng phải lớn hơn 0"; else if(parseInt(v.stock)>10000)e.stock="Tối đa 10.000"; const re=validateRam(v.ram);if(re)e.ram=re; const se=validateStorage(v.storage);if(se)e.storage=se; if(!v.storage)e.storage="Vui lòng nhập bộ nhớ trong"; return e; });
    if(ve.some(e=>Object.keys(e).length>0))errs.variantDetails=ve;
    setProductErrors(errs); if(Object.keys(errs).length>0)return;
    setProductSaving(true);
    try{
      const fd=new FormData();
      fd.append("product_name",newProduct.name); fd.append("brand",newProduct.brand); fd.append("description",newProduct.description); fd.append("category_id",newProduct.categoryId);
      fd.append("variants",JSON.stringify(variants.map(({imageFile,imagePreview,...r})=>r)));
      productImages.forEach(f=>fd.append("images",f)); variants.forEach((v,i)=>{ if(v.imageFile)fd.append(`variant_image_${i}`,v.imageFile); });
      const r=await fetch(`${API}/api/product/create/`,{method:"POST",body:fd}); const d=await r.json();
      if(r.ok){ setShowAddProduct(false); setNewProduct({name:"",brand:"",description:"",categoryId:""}); setVariants([{...EMPTY_VARIANT}]); setProductImages([]); loadProducts(); toast.success("Tạo sản phẩm thành công!"); }
      else setProductErrors({general:d.message});
    }finally{ setProductSaving(false); }
  };

  const openAddVariant = async(product)=>{
    setAddVarProductId(product.id); setAddVarProductName(product.name); setAddVarList([{...EMPTY_VARIANT}]); setAddVarErrors({});
    try{ const r=await fetch(`${API}/api/product/${product.id}/variants/`); const d=await r.json(); if(r.ok)setExistingVariants(d.variants||[]); }catch{ setExistingVariants([]); }
  };

  const handleSaveAddVariant = async()=>{
    const ve=addVarList.map(v=>{ const e={}; if(!v.price||isNaN(v.price)||parseFloat(v.price)<=0)e.price="Giá phải lớn hơn 0"; if(!v.stock||isNaN(v.stock)||parseInt(v.stock)<=0)e.stock="Số lượng phải lớn hơn 0"; else if(parseInt(v.stock)>10000)e.stock="Tối đa 10.000"; if(!v.ram){e.ram="Vui lòng nhập RAM";}else{const m=String(v.ram).match(/^(\d+(?:\.\d+)?)GB$/i);if(!m||parseFloat(m[1])<=4)e.ram="RAM phải > 4GB";} if(v.storage){const m=String(v.storage).match(/^(\d+(?:\.\d+)?)(GB|TB)$/i);if(!m)e.storage="Dạng số + GB/TB";else if(m[2].toUpperCase()==="GB"&&parseFloat(m[1])<64)e.storage="Tối thiểu 64GB";else if(m[2].toUpperCase()==="TB"&&parseFloat(m[1])<1)e.storage="Tối thiểu 1TB";} return e; });
    const errs={}; if(ve.some(e=>Object.keys(e).length>0))errs.variantDetails=ve; setAddVarErrors(errs); if(Object.keys(errs).length>0)return;
    setAddVarSaving(true);
    try{
      const fd=new FormData(); fd.append("product_id",addVarProductId);
      fd.append("variants",JSON.stringify(addVarList.map(({imageFile,imagePreview,...r})=>r)));
      addVarList.forEach((v,i)=>{ if(v.imageFile)fd.append(`variant_image_${i}`,v.imageFile); });
      const r=await fetch(`${API}/api/product/add-variants/`,{method:"POST",body:fd}); const d=await r.json();
      if(r.ok){ setAddVarProductId(null); loadProducts(); toast.success(`Đã thêm ${addVarList.length} biến thể thành công!`); }
      else setAddVarErrors({general:d.message});
    }finally{ setAddVarSaving(false); }
  };
  const loadProductDetail = async (productId) => {
  if (productDetailMap[productId]) return;
  setLoadingDetailId(productId);
  try {
    const r = await fetch(`${API}/api/product/${productId}/detail/`);
    const d = await r.json();
    if (r.ok) setProductDetailMap(prev => ({ ...prev, [productId]: d }));
  } finally {
    setLoadingDetailId(null);
  }
};

const handleSaveEditProduct = async (productId) => {
  setEditProductSaving(true);
  try {
    const fd = new FormData();
    fd.append("product_id", productId);
    if (editProductData.name)        fd.append("product_name", editProductData.name);
    if (editProductData.brand !== undefined) fd.append("brand", editProductData.brand);
    if (editProductData.description !== undefined) fd.append("description", editProductData.description);
    if (editProductData.categoryId)  fd.append("category_id", editProductData.categoryId);
    (editProductData.newImages || []).forEach(f => fd.append("images", f));

    const r = await fetch(`${API}/api/product/update/`, { method: "POST", body: fd });
    const d = await r.json();
    if (r.ok) {
      setEditProductId(null);
      setEditProductData({});
      setProductDetailMap(prev => { const n = { ...prev }; delete n[productId]; return n; });
      loadProducts();
      toast.success("Cập nhật sản phẩm thành công!");
    } else toast.error(d.message);
  } finally {
    setEditProductSaving(false);
  }
};

const handleSaveEditVariant = async (variantId, productId) => {
  setEditVariantSaving(true);
  try {
    const fd = new FormData();
    fd.append("variant_id", variantId);
    const fields = ["color","storage","ram","price","stock","cpu","os",
      "screenSize","screenTech","refreshRate","battery","chargingSpeed",
      "frontCamera","rearCamera","weights","updates"];
    fields.forEach(k => {
      if (editVariantData[k] !== undefined) fd.append(k, editVariantData[k]);
    });
    if (editVariantData.imageFile) fd.append("image", editVariantData.imageFile);

    const r = await fetch(`${API}/api/product/update-variant/`, { method: "POST", body: fd });
    const d = await r.json();
    if (r.ok) {
      setEditVariantId(null);
      setEditVariantData({});
      setProductDetailMap(prev => { const n = { ...prev }; delete n[productId]; return n; });
      loadProducts();
      toast.success("Cập nhật biến thể thành công!");
    } else toast.error(d.message);
  } finally {
    setEditVariantSaving(false);
  }
};

const handleDeleteVariant = (variantId, productId) => {
  setConfirmModal({ message: "Xóa biến thể này?", onConfirm: async () => {
    const r = await fetch(`${API}/api/product/delete-variant/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant_id: variantId })
    });
    const d = await r.json();
    if (r.ok) {
      setProductDetailMap(prev => { const n = { ...prev }; delete n[productId]; return n; });
      loadProducts();
    } else toast.error(d.message);
  }});
};

const handleDeleteProductImage = (imageId, productId) => {
  setConfirmModal({ message: "Xóa ảnh này?", onConfirm: async () => {
    const r = await fetch(`${API}/api/product/delete-image/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_id: imageId })
    });
    if (r.ok) {
      setProductDetailMap(prev => { const n = { ...prev }; delete n[productId]; return n; });
    } else { const d = await r.json(); toast.error(d.message); }
  }});
};

const handleSetPrimaryImage = async (imageId, productId) => {
  const r = await fetch(`${API}/api/product/set-primary-image/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: imageId, product_id: productId })
  });
  if (r.ok) {
    setProductDetailMap(prev => { const n = { ...prev }; delete n[productId]; return n; });
  }
};

const handleDeleteProduct = (productId) => {
  setConfirmModal({ message: "Xóa sản phẩm này? Hành động không thể hoàn tác.", onConfirm: async () => {
    const r = await fetch(`${API}/api/product/delete/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId })
    });
    if (r.ok) { loadProducts(); setProductDetailMap(prev => { const n={...prev}; delete n[productId]; return n; }); toast.success("Đã xóa sản phẩm!"); }
    else { const d = await r.json(); toast.error(d.message); }
  }});
};

  const handleSaveVoucher = async()=>{
    if(!newVoucher.code.trim()){toast.error("Vui lòng nhập mã voucher");return;}
    if(!newVoucher.value||parseFloat(newVoucher.value)<=0){toast.error("Vui lòng nhập giá trị voucher");return;}
    setVoucherSaving(true);
    try{
      const r=await fetch(`${API}/api/voucher/create/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...newVoucher,value:parseFloat(newVoucher.value),variant_id:newVoucher.variant_id||null})});
      const d=await r.json();
      if(r.ok){ setShowAddVoucher(false); setVoucherVariants([]); setNewVoucher({code:"",type:"percent",value:"",scope:"all",category_id:"",product_id:"",variant_id:"",min_order:"",max_discount:"",start_date:"",end_date:"",usage_limit:""}); loadVouchers(); toast.success("Tạo voucher thành công!"); }
      else toast.error(d.message);
    }finally{ setVoucherSaving(false); }
  };

  const deactivateVoucher = async(id)=>{ const r=await fetch(`${API}/api/voucher/deactivate/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})}); if(r.ok)loadVouchers(); };

  const handleUpdateOrderStatus = async(orderId,newStatus)=>{ setUpdatingOrder(orderId); try{ const r=await fetch(`${API}/api/order/update-status/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order_id:orderId,status:newStatus,note:statusNote})}); const d=await r.json(); if(r.ok){ setOrderList(p=>p.map(o=>o.id===orderId?{...o,status:newStatus,status_note:statusNote}:o)); if(orderDetail?.id===orderId)setOrderDetail(d=>({...d,status:newStatus,status_note:statusNote})); setStatusNote(""); }else toast.error(d.message); }catch{toast.error("Lỗi kết nối");}finally{setUpdatingOrder(null);} };
  const handleCancelOrder = (orderId) => { setConfirmModal({ message: "Hủy đơn hàng này?", onConfirm: async () => { setUpdatingOrder(orderId); try{ const r=await fetch(`${API}/api/order/update-status/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order_id:orderId,status:"Cancelled",note:"Admin hủy đơn"})}); if(r.ok)setOrderList(p=>p.map(o=>o.id===orderId?{...o,status:"Cancelled"}:o)); else{const d=await r.json();toast.error(d.message);} }catch{toast.error("Lỗi kết nối");}finally{setUpdatingOrder(null);} } }); };
  const handleProcessReturn = async(returnId,action)=>{ setProcessingReturn(true); try{ const r=await fetch(`${API}/api/order/return/process/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({return_id:returnId,action,note:returnNote})}); const d=await r.json(); if(r.ok){ const s={approve:"Approved",reject:"Rejected",returning:"Returning",complete:"Completed"}[action]; setReturnList(p=>p.map(rr=>rr.return_id===returnId?{...rr,status:s,admin_note:returnNote}:rr)); if(returnDetail?.return_id===returnId)setReturnDetail(dd=>({...dd,status:s,admin_note:returnNote})); setReturnNote(""); toast.success(d.message); }else toast.error(d.message); }catch{toast.error("Lỗi kết nối");}finally{setProcessingReturn(false);} };

  const loadImportVariants = async(pid)=>{ if(!pid)return; setImportLoading(true); try{ const r=await fetch(`${API}/api/product/${pid}/variants/`); const d=await r.json(); if(r.ok){setImportVariants(d.variants||[]);setImportQty({});} }finally{setImportLoading(false);} };
  const handleImport = async()=>{ const entries=Object.entries(importQty).filter(([,q])=>parseInt(q)>0); if(entries.length===0){toast.error("Chưa nhập số lượng");return;} setImportSaving(true); try{ const r=await fetch(`${API}/api/product/import/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:entries.map(([vid,qty])=>({variant_id:parseInt(vid),quantity:parseInt(qty)}))})}); const d=await r.json(); if(r.ok){toast.success("Nhập hàng thành công!");loadImportVariants(importProductId);}else toast.error(d.message); }finally{setImportSaving(false);} };

  const handleAddCategory = async()=>{ if(!newCatName.trim()){toast.error("Vui lòng nhập tên danh mục");return;} setCatSaving(true); try{ const fd=new FormData(); fd.append("name",newCatName.trim()); if(newCatImage)fd.append("image",newCatImage); const r=await fetch(`${API}/api/product/category/create/`,{method:"POST",body:fd}); const d=await r.json(); if(r.ok){setShowAddCat(false);setNewCatName("");setNewCatImage(null);setNewCatPreview("");loadCategories();setCategories(p=>[...p,{id:d.id,name:d.name}]);toast.success("Tạo danh mục thành công!");}else toast.error(d.message); }finally{setCatSaving(false);} };
  const handleSaveCatEdit = async(catId)=>{ if(!editCatName.trim()){toast.error("Vui lòng nhập tên danh mục");return;} setCatSaving(true); try{ const fd=new FormData(); fd.append("id",catId); fd.append("name",editCatName.trim()); if(editCatImage)fd.append("image",editCatImage); const r=await fetch(`${API}/api/product/category/update/`,{method:"POST",body:fd}); const d=await r.json(); if(r.ok){setEditCatId(null);setEditCatName("");setEditCatImage(null);setEditCatPreview("");loadCategories();}else toast.error(d.message); }finally{setCatSaving(false);} };

  const handleAvatarChange = async(e)=>{ const f=e.target.files[0];if(!f)return; if(!f.type.startsWith("image/")){toast.error("Vui lòng chọn file ảnh");return;} if(f.size>5*1024*1024){toast.error("Ảnh không được vượt quá 5MB");return;} setAvatarLoading(true); try{ const fd=new FormData(); fd.append("id",adminLocal.id); fd.append("avatar_file",f); const r=await fetch(`${API}/api/staff/upload-avatar/`,{method:"POST",body:fd}); const d=await r.json(); if(r.ok){ setAdmin(p=>({...p,avatar:d.avatar_url})); const s=JSON.parse(localStorage.getItem("admin_user")||"{}"); localStorage.setItem("admin_user",JSON.stringify({...s,avatar:d.avatar_url})); window.dispatchEvent(new Event("userUpdated")); }else toast.error(d.message); }catch{toast.error("Không thể kết nối server");}finally{setAvatarLoading(false);} };

  const savePassword = async()=>{ const ne={}; if(!passForm.current)ne.current="Vui lòng nhập mật khẩu hiện tại"; if(!passForm.newPass)ne.newPass="Vui lòng nhập mật khẩu mới"; else if(passForm.newPass.includes(" "))ne.newPass="Không được chứa dấu cách"; else if(passForm.newPass.length<6)ne.newPass="Ít nhất 6 ký tự"; if(!passForm.confirm)ne.confirm="Vui lòng nhập lại"; else if(passForm.newPass!==passForm.confirm)ne.confirm="Không trùng khớp"; setErrors(ne); if(Object.keys(ne).length>0)return; setSaving(true); try{ const r=await fetch(`${API}/api/staff/change-password/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:adminLocal.id,current_password:passForm.current,new_password:passForm.newPass})}); const d=await r.json(); if(r.ok){setEditPass(false);setPassForm({current:"",newPass:"",confirm:""});setErrors({});toast.success("Đổi mật khẩu thành công!");}else setErrors({current:d.message}); }finally{setSaving(false);} };
  const handleAddStaff = async()=>{ const errs={}; if(!newStaff.fullname.trim())errs.fullname="Vui lòng nhập họ tên"; if(!newStaff.email.trim())errs.email="Vui lòng nhập email"; if(!newStaff.password.trim())errs.password="Vui lòng nhập mật khẩu"; else if(newStaff.password.length<6)errs.password="Ít nhất 6 ký tự"; setNewStaffErrors(errs); if(Object.keys(errs).length>0)return; setSaving(true); try{ const r=await fetch(`${API}/api/staff/create/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({full_name:newStaff.fullname,email:newStaff.email,password:newStaff.password,role:newStaff.role})}); const d=await r.json(); if(r.ok){setShowAddStaff(false);setNewStaff({fullname:"",email:"",password:"",role:"Staff"});loadStaff();toast.success("Tạo tài khoản thành công!");}else setNewStaffErrors({general:d.message}); }finally{setSaving(false);} };
  const changeRole = async(staffId,newRole)=>{ try{const r=await fetch(`${API}/api/staff/update-role/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:staffId,role:newRole})});if(r.ok)loadStaff();}catch{toast.error("Lỗi cập nhật quyền");} };

  const savePost = async()=>{ if(!postForm.title.trim()){toast.error("Vui lòng nhập tiêu đề");return;} setPostSaving(true); try{ const fd=new FormData(); fd.append("title",postForm.title); fd.append("category",postForm.category); fd.append("author",adminLocal?.fullName||adminLocal?.full_name||"Admin"); fd.append("blocks",JSON.stringify(postForm.blocks.map(({_pendingFile,file,...r})=>r))); Object.entries(postForm.mediaFiles).forEach(([k,f])=>{if(f)fd.append(k,f);}); if(editingPost)fd.append("post_id",editingPost.id); const url=editingPost?`${API}/api/post/update/`:`${API}/api/post/create/`; const r=await fetch(url,{method:"POST",body:fd}); const d=await r.json(); if(r.ok){setShowPostForm(false);setEditingPost(null);setPostForm({title:"",category:"Mẹo vặt",blocks:[],mediaFiles:{}});loadPosts();}else toast.error(d.message); }catch{toast.error("Lỗi kết nối");}finally{setPostSaving(false);} };
  const deletePost = (postId) => { setConfirmModal({ message: "Xóa bài viết này?", onConfirm: async () => { const r=await fetch(`${API}/api/post/delete/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({post_id:postId})}); if(r.ok)setPostList(p=>p.filter(x=>x.id!==postId)); else{const d=await r.json();toast.error(d.message);} } }); };

  const loadProductContent = async(pid)=>{ if(!pid)return; setPcLoaded(false); try{const r=await fetch(`${API}/api/product/${pid}/content/`);const d=await r.json();setPcBlocks(d.content?.blocks||[]);setPcMediaFiles({});setPcLoaded(true);}catch{setPcBlocks([]);setPcLoaded(true);} };
  const saveProductContent = async()=>{ if(!pcProductId){toast.error("Vui lòng chọn sản phẩm");return;} setPcSaving(true); try{ const fd=new FormData(); fd.append("product_id",pcProductId); fd.append("blocks",JSON.stringify(pcBlocks.map(({_pendingFile,file,...r})=>r))); Object.entries(pcMediaFiles).forEach(([k,f])=>{if(f)fd.append(k,f);}); const r=await fetch(`${API}/api/product/content/save/`,{method:"POST",body:fd}); const d=await r.json(); if(r.ok)toast.success(d.message); else toast.error(d.message); }catch{toast.error("Lỗi kết nối");}finally{setPcSaving(false);} };

  const handleLogout = ()=>{ localStorage.removeItem("admin_user"); navigate("/admin/login"); };

  const ORDER_STATUS_MAP = {
    Pending:    { label:"Chờ xác nhận",   color:"#ff9500", next:"Processing", nextLabel:"Xác nhận xử lý"  },
    Processing: { label:"Đang xử lý",     color:"#0a84ff", next:"Shipping",   nextLabel:"Bắt đầu giao"    },
    Shipping:   { label:"Đang giao hàng", color:"#30d158", next:"Delivered",  nextLabel:"Xác nhận đã giao" },
    Delivered:  { label:"Đã giao hàng",   color:"#34c759", next:null,         nextLabel:null               },
    Cancelled:  { label:"Đã hủy",         color:"#ff3b30", next:null,         nextLabel:null               },
  };
  const RETURN_STATUS_MAP = {
    Pending:   { label:"Chờ xét duyệt",         color:"#ff9500" },
    Approved:  { label:"Đã chấp nhận",           color:"#34c759" },
    Rejected:  { label:"Đã từ chối",             color:"#ff3b30" },
    Returning: { label:"Đang nhận hàng hoàn về", color:"#0a84ff" },
    Completed: { label:"Hoàn tất",               color:"#34c759" },
  };
  const RETURN_ACTIONS = {
    Pending:   [{ action:"approve",   label:"✅ Chấp nhận trả hàng", color:"#34c759",bg:"rgba(52,199,89,0.1)",border:"rgba(52,199,89,0.3)" },{ action:"reject", label:"❌ Từ chối", color:"#ff3b30",bg:"rgba(255,59,48,0.1)",border:"rgba(255,59,48,0.3)" }],
    Approved:  [{ action:"returning", label:"📦 Đang nhận hàng về",  color:"#0a84ff",bg:"rgba(10,132,255,0.1)",border:"rgba(10,132,255,0.3)" }],
    Returning: [{ action:"complete",  label:"✅ Hoàn tất — cộng kho",color:"#34c759",bg:"rgba(52,199,89,0.1)",border:"rgba(52,199,89,0.3)" }],
  };
  const POST_CATEGORIES = ["Mẹo vặt","Mới nhất","Đánh giá","Tin tức"];
  const ROLE_COLOR = {
    Admin:      "bg-orange-500/20 text-orange-300 border-orange-500/30",
    Staff:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
    Unentitled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };

  // ── B) Thêm "dashboard" vào menuItems ────────────────────────
  const menuItems = [
    { key:"dashboard",       label:"Dashboard doanh thu",  icon:BarChart2   },
    { key:"profile",         label:"Thông tin cá nhân",   icon:User        },
    { key:"staff",           label:"Quản lý nhân viên",   icon:Users       },
    { key:"category",        label:"Danh mục sản phẩm",   icon:LayoutGrid  },
    { key:"product",         label:"Quản lý sản phẩm",    icon:Package     },
    { key:"import",          label:"Nhập hàng",            icon:PackagePlus },
    { key:"orders",          label:"Đơn hàng",             icon:ShoppingBag },
    { key:"returns",         label:"Trả hàng",             icon:RotateCcw   },
    { key:"voucher",         label:"Voucher",              icon:Ticket      },
    { key:"posts",           label:"Bài viết",             icon:Newspaper   },
    { key:"product_content", label:"Mô tả sản phẩm",      icon:FileText    },
    { key:"reviews",         label:"Đánh giá & Bình luận", icon:MessageCircle, badge: unansweredCount },
    { key:"settings",        label:"Cài đặt",              icon:Settings    },
  ];

  if(loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* Global fix: native <option> kế thừa màu nền tối */}
      <style>{`
        select option {
          background-color: #1e1e1e;
          color: #e5e5e5;
        }
        select option:checked,
        select option:hover {
          background-color: #2a2a2a;
          color: #ffffff;
        }
      `}</style>
      {confirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
            <p className="text-sm text-white/80 mb-5 text-center">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10 transition">Hủy</button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition">Xác nhận</button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setConfirmLogout(false)}/>
          <div className="relative bg-[#161616] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"><AlertTriangle size={18} className="text-red-400"/></div><h3 className="font-semibold">Đăng xuất</h3></div>
            <p className="text-gray-400 text-sm mb-6">Bạn có muốn đăng xuất khỏi trang quản trị không?</p>
            <div className="flex gap-3">
              <button onClick={()=>setConfirmLogout(false)} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition border border-white/10">Hủy</button>
              <button onClick={handleLogout} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-64 bg-[#111111] border-r border-white/5 flex flex-col min-h-screen sticky top-0 h-screen overflow-y-auto">
        <div className="px-6 py-6 border-b border-white/5"><p className="text-xs text-orange-400 font-medium tracking-widest uppercase mb-1">Quản trị</p><h1 className="text-lg font-bold tracking-tight">PHONEZONE</h1></div>
        <div className="flex flex-col items-center py-8 px-6 border-b border-white/5">
          <div className="relative group mb-3">
            {admin?.avatar?<img src={admin.avatar} alt="avatar" className="w-20 h-20 rounded-full object-cover ring-2 ring-orange-500/30"/>:<div className="w-20 h-20 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center"><User size={32} className="text-orange-400/60"/></div>}
            <button onClick={()=>fileInputRef.current?.click()} className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              {avatarLoading?<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Camera size={16} className="text-white"/>}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange}/>
          </div>
          <p className="font-semibold text-sm">{admin?.full_name}</p>
          <span className={`mt-1 text-xs px-2 py-0.5 rounded-full border ${ROLE_COLOR[admin?.role]||ROLE_COLOR.Staff}`}>{admin?.role}</span>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {menuItems.map(({key,label,icon:Icon,badge})=>(
            <button key={key} onClick={()=>setActiveTab(key)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition group ${activeTab===key?"bg-orange-500/15 text-orange-300 border border-orange-500/20":"text-white/40 hover:bg-white/5 hover:text-white"}`}>
              <span className="flex items-center gap-3">
                <span className="relative">
                  <Icon size={16}/>
                  {badge > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">{badge > 99 ? "99+" : badge}</span>}
                </span>
                {label}
              </span>
              <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition ${activeTab===key?"opacity-100":""}`}/>
            </button>
          ))}
        </nav>
        <div className="px-3 pb-6">
          <button onClick={()=>setConfirmLogout(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition"><LogOut size={16}/> Đăng xuất</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 px-8 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-white/80">{menuItems.find(m=>m.key===activeTab)?.label}</h2>
          <div className="flex items-center gap-2 text-xs text-white/30"><Shield size={12} className="text-orange-400"/>{admin?.role}</div>
        </div>

        <div className="p-8">

          {/* ── C) Dashboard tab render ──────────────────────────── */}
          {activeTab === "dashboard" && <RevenueDashboard />}

          {/* PROFILE */}
          {activeTab==="profile" && (
            <div className="max-w-2xl flex flex-col gap-6">
              <AdminSection title="Thông tin tài khoản">
                <InfoRow label="Mã nhân viên" value={admin?.id}/>
                <InfoRow label="Họ và tên" value={admin?.full_name}/>
                <InfoRow label="Email" value={admin?.email}/>
                <InfoRow label="Vai trò" value={<span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLOR[admin?.role]}`}>{admin?.role}</span>}/>
              </AdminSection>
              <AdminSection title="Đổi mật khẩu">
                {editPass?(
                  <div className="flex flex-col gap-3 py-2">
                    <PwInput placeholder="Mật khẩu hiện tại" value={passForm.current} show={showPass.current} onToggle={()=>setShowPass(p=>({...p,current:!p.current}))} onChange={v=>setPassForm(p=>({...p,current:v}))} error={errors.current}/>
                    <PwInput placeholder="Mật khẩu mới" value={passForm.newPass} show={showPass.newPass} onToggle={()=>setShowPass(p=>({...p,newPass:!p.newPass}))} onChange={v=>setPassForm(p=>({...p,newPass:v}))} error={errors.newPass}/>
                    <PwInput placeholder="Nhập lại mật khẩu mới" value={passForm.confirm} show={showPass.confirm} onToggle={()=>setShowPass(p=>({...p,confirm:!p.confirm}))} onChange={v=>setPassForm(p=>({...p,confirm:v}))} error={errors.confirm}/>
                    <div className="flex gap-2 mt-1">
                      <button onClick={savePassword} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-sm font-medium transition disabled:opacity-50"><Check size={14}/> Lưu</button>
                      <button onClick={()=>{setEditPass(false);setPassForm({current:"",newPass:"",confirm:""});setErrors({});}} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition"><X size={14}/> Hủy</button>
                    </div>
                  </div>
                ):(
                  <div className="flex items-center justify-between py-3">
                    <span className="text-white/30 text-sm tracking-widest">••••••••</span>
                    <button onClick={()=>setEditPass(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs transition"><Pencil size={12}/> Đổi mật khẩu</button>
                  </div>
                )}
              </AdminSection>
            </div>
          )}

          {/* STAFF */}
          {activeTab==="staff" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between"><p className="text-sm text-white/40">{staffList.length} tài khoản</p><button onClick={()=>setShowAddStaff(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition"><Plus size={16}/> Thêm nhân viên</button></div>
              {showAddStaff&&(
                <div className="bg-[#161616] border border-white/10 rounded-2xl p-6">
                  <h3 className="font-semibold mb-4 text-sm">Tạo tài khoản mới</h3>
                  {newStaffErrors.general&&<p className="text-red-400 text-xs mb-3">{newStaffErrors.general}</p>}
                  <div className="grid grid-cols-2 gap-4">
                    <div><input placeholder="Họ và tên" value={newStaff.fullname} onChange={e=>setNewStaff(p=>({...p,fullname:e.target.value}))} className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition ${newStaffErrors.fullname?"border-red-500/50":"border-white/10"}`}/>{newStaffErrors.fullname&&<p className="text-red-400 text-xs mt-1">{newStaffErrors.fullname}</p>}</div>
                    <div><input placeholder="Email" value={newStaff.email} onChange={e=>setNewStaff(p=>({...p,email:e.target.value}))} className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition ${newStaffErrors.email?"border-red-500/50":"border-white/10"}`}/>{newStaffErrors.email&&<p className="text-red-400 text-xs mt-1">{newStaffErrors.email}</p>}</div>
                    <div><input placeholder="Mật khẩu" type="password" value={newStaff.password} onChange={e=>setNewStaff(p=>({...p,password:e.target.value}))} className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition ${newStaffErrors.password?"border-red-500/50":"border-white/10"}`}/>{newStaffErrors.password&&<p className="text-red-400 text-xs mt-1">{newStaffErrors.password}</p>}</div>
                    <select value={newStaff.role} onChange={e=>setNewStaff(p=>({...p,role:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"><option value="Staff">Staff</option><option value="Admin">Admin</option><option value="Unentitled">Unentitled</option></select>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={handleAddStaff} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50"><Check size={14}/> Tạo tài khoản</button>
                    <button onClick={()=>{setShowAddStaff(false);setNewStaffErrors({});}} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition"><X size={14}/> Hủy</button>
                  </div>
                </div>
              )}
              <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-4 px-6 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider"><span>Nhân viên</span><span>Email</span><span>Vai trò</span><span>Hành động</span></div>
                {staffLoading?<div className="py-12 flex justify-center"><div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"/></div>
                  :staffList.length===0?<div className="py-12 text-center text-white/20 text-sm">Chưa có nhân viên nào</div>
                  :staffList.map(s=>(
                    <div key={s.id} className="grid grid-cols-4 px-6 py-4 border-b border-white/5 last:border-0 items-center hover:bg-white/2 transition">
                      <div className="flex items-center gap-3">{s.avatar?<img src={s.avatar} className="w-8 h-8 rounded-full object-cover" alt=""/>:<div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><User size={14} className="text-white/30"/></div>}<span className="text-sm font-medium">{s.full_name}</span></div>
                      <span className="text-sm text-white/50">{s.email}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${ROLE_COLOR[s.role]||ROLE_COLOR.Staff}`}>{s.role}</span>
                      <select value={s.role} onChange={e=>changeRole(s.id,e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-orange-500/50 w-fit"><option value="Admin">Admin</option><option value="Staff">Staff</option><option value="Unentitled">Unentitled</option></select>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* CATEGORY */}
          {activeTab==="category" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between"><p className="text-sm text-white/40">{catList.length} danh mục</p><button onClick={()=>{setShowAddCat(!showAddCat);setNewCatName("");setNewCatImage(null);setNewCatPreview("");}} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition"><Plus size={16}/> {showAddCat?"Đóng":"Thêm danh mục"}</button></div>
              {showAddCat&&(
                <div className="bg-[#161616] border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                  <p className="text-sm font-medium text-orange-400">Danh mục mới</p>
                  <div className="flex items-start gap-5">
                    <div>
                      <div onClick={()=>catImageRef.current?.click()} className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/15 hover:border-orange-500/50 flex flex-col items-center justify-center cursor-pointer transition overflow-hidden">
                        {newCatPreview?<img src={newCatPreview} alt="" className="w-full h-full object-cover"/>:<><Plus size={20} className="text-white/20 mb-1"/><span className="text-xs text-white/20">Ảnh</span></>}
                      </div>
                      <input ref={catImageRef} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files[0];if(f){setNewCatImage(f);setNewCatPreview(URL.createObjectURL(f));}}}/>
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                      <input placeholder="Tên danh mục *" value={newCatName} onChange={e=>setNewCatName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"/>
                      <div className="flex gap-2">
                        <button onClick={handleAddCategory} disabled={catSaving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50"><Check size={14}/> {catSaving?"Đang lưu...":"Lưu"}</button>
                        <button onClick={()=>{setShowAddCat(false);setNewCatName("");setNewCatImage(null);setNewCatPreview("");}} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition"><X size={14}/> Hủy</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {catLoading?<div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"/></div>
                :catList.length===0?<div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-white/20"><LayoutGrid size={40} className="mx-auto mb-3 opacity-30"/><p className="text-sm">Chưa có danh mục nào</p></div>
                :(
                  <div className="grid grid-cols-3 gap-4">
                    {catList.map(cat=>(
                      <div key={cat.id} className="bg-[#161616] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition">
                        {editCatId===cat.id?(
                          <div className="flex flex-col gap-3">
                            <div onClick={()=>editCatImgRef.current?.click()} className="w-full h-28 rounded-xl border-2 border-dashed border-white/15 hover:border-orange-500/50 flex items-center justify-center cursor-pointer overflow-hidden transition">
                              {editCatPreview?<img src={editCatPreview} alt="" className="w-full h-full object-cover"/>:cat.image?<img src={cat.image} alt="" className="w-full h-full object-cover"/>:<span className="text-xs text-white/20">Đổi ảnh</span>}
                            </div>
                            <input ref={editCatImgRef} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files[0];if(f){setEditCatImage(f);setEditCatPreview(URL.createObjectURL(f));}}}/>
                            <input value={editCatName} onChange={e=>setEditCatName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500/50"/>
                            <div className="flex gap-2">
                              <button onClick={()=>handleSaveCatEdit(cat.id)} disabled={catSaving} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-xs font-medium transition disabled:opacity-50"><Check size={12}/> Lưu</button>
                              <button onClick={()=>{setEditCatId(null);setEditCatImage(null);setEditCatPreview("");}} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs transition"><X size={12}/> Hủy</button>
                            </div>
                          </div>
                        ):(
                          <div className="flex flex-col gap-3">
                            <div className="w-full h-28 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">{cat.image?<img src={cat.image} alt={cat.name} className="w-full h-full object-cover"/>:<LayoutGrid size={32} className="text-white/10"/>}</div>
                            <div className="flex items-center justify-between"><div><p className="text-sm font-medium">{cat.name}</p><p className="text-xs text-white/30 mt-0.5">#{cat.id}</p></div><button onClick={()=>{setEditCatId(cat.id);setEditCatName(cat.name);setEditCatImage(null);setEditCatPreview("");}} className="p-2 rounded-xl hover:bg-white/5 text-white/30 hover:text-orange-400 transition"><Pencil size={14}/></button></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* PRODUCT */}
          {activeTab==="product" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between"><p className="text-sm text-white/40">{productList.length} sản phẩm</p><button onClick={()=>setShowAddProduct(!showAddProduct)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition"><Plus size={16}/> {showAddProduct?"Đóng":"Thêm sản phẩm"}</button></div>
              {showAddProduct&&(
                <div className="bg-[#161616] border border-white/10 rounded-2xl p-6 flex flex-col gap-6">
                  <h3 className="font-semibold text-sm text-orange-400">Tạo sản phẩm mới</h3>
                  {productErrors.general&&<p className="text-red-400 text-xs">{productErrors.general}</p>}
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Thông tin chung</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div><input placeholder="Tên sản phẩm *" value={newProduct.name} onChange={e=>setNewProduct(p=>({...p,name:e.target.value}))} className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition ${productErrors.name?"border-red-500/50":"border-white/10"}`}/>{productErrors.name&&<p className="text-red-400 text-xs mt-1">{productErrors.name}</p>}</div>
                      <input placeholder="Hãng sản xuất" value={newProduct.brand} onChange={e=>setNewProduct(p=>({...p,brand:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"/>
                      <div><select value={newProduct.categoryId} onChange={e=>setNewProduct(p=>({...p,categoryId:e.target.value}))} className={`w-full bg-[#1e1e1e] border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition ${productErrors.categoryId?"border-red-500/50":"border-white/10"}`}><option value="">-- Chọn danh mục *</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{productErrors.categoryId&&<p className="text-red-400 text-xs mt-1">{productErrors.categoryId}</p>}</div>
                      <div className="col-span-2"><p className="text-xs text-white/30 mb-2">Mô tả sản phẩm (hỗ trợ định dạng đầy đủ)</p><RichEditor value={newProduct.description} onChange={html=>setNewProduct(p=>({...p,description:html}))}/></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Ảnh sản phẩm</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {productImages.map((file,i)=>(
                        <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 group"><img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover"/><button onClick={()=>setProductImages(imgs=>imgs.filter((_,idx)=>idx!==i))} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"><X size={16} className="text-white"/></button></div>
                      ))}
                      <button onClick={()=>productImageRef.current?.click()} className="w-20 h-20 rounded-xl border border-dashed border-white/20 hover:border-orange-500/50 flex flex-col items-center justify-center text-white/30 hover:text-orange-400 transition text-xs gap-1"><Plus size={20}/><span>Thêm</span></button>
                      <input ref={productImageRef} type="file" accept="image/*" multiple className="hidden" onChange={e=>setProductImages(prev=>[...prev,...Array.from(e.target.files)])}/>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3"><p className="text-xs text-white/40 uppercase tracking-wider">Biến thể ({variants.length}){productErrors.variants&&<span className="text-red-400 ml-2 normal-case">{productErrors.variants}</span>}</p><button onClick={addVariant} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs transition"><Plus size={12}/> Thêm biến thể</button></div>
                    <div className="flex flex-col gap-4">
                      {variants.map((v,i)=>(
                        <div key={i} className="border border-white/10 rounded-xl p-4 bg-white/2">
                          <div className="flex items-center justify-between mb-3"><span className="text-xs font-medium text-orange-400">Biến thể #{i+1}</span>{variants.length>1&&<button onClick={()=>removeVariant(i)} className="text-red-400/60 hover:text-red-400 transition p-1 rounded-lg hover:bg-red-500/10"><X size={14}/></button>}</div>
                          <div className="mb-3"><p className="text-xs text-white/30 mb-2">Ảnh biến thể</p><div className="flex items-center gap-3"><div className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">{v.imagePreview?<img src={v.imagePreview} alt="" className="w-full h-full object-cover"/>:<Plus size={20} className="text-white/15"/>}</div><div className="flex flex-col gap-2"><label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs cursor-pointer transition"><Plus size={12} className="text-orange-400"/>{v.imagePreview?"Đổi ảnh":"Chọn ảnh"}<input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files[0];if(!f)return;updateVariant(i,"imageFile",f);updateVariant(i,"imagePreview",URL.createObjectURL(f));}}/></label>{v.imagePreview&&<button onClick={()=>{updateVariant(i,"imageFile",null);updateVariant(i,"imagePreview","");}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition"><X size={12}/> Xóa ảnh</button>}</div></div></div>
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <ComboField value={v.color} onChange={val=>updateVariant(i,"color",val)} options={["Đen","Trắng","Xanh dương","Xanh lá","Đỏ","Vàng","Hồng","Tím","Xám","Bạc","Vàng đồng","Titan tự nhiên","Titan đen","Titan trắng","Titan sa mạc"]} placeholder="Màu sắc"/>
                            <StorageField value={v.storage} onChange={val=>updateVariant(i,"storage",val)} error={productErrors.variantDetails?.[i]?.storage}/>
                            <RamField value={v.ram} onChange={val=>updateVariant(i,"ram",val)} error={productErrors.variantDetails?.[i]?.ram}/>
                            <div><input placeholder="Giá (VNĐ) *" value={v.price} onChange={e=>updateVariant(i,"price",e.target.value)} className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition ${productErrors.variantDetails?.[i]?.price?"border-red-500/50":"border-white/10"}`}/>{productErrors.variantDetails?.[i]?.price&&<p className="text-red-400 text-xs mt-1">{productErrors.variantDetails[i].price}</p>}</div>
                            <div><input placeholder="Số lượng *" value={v.stock} onChange={e=>updateVariant(i,"stock",e.target.value)} className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition ${productErrors.variantDetails?.[i]?.stock?"border-red-500/50":"border-white/10"}`}/>{productErrors.variantDetails?.[i]?.stock&&<p className="text-red-400 text-xs mt-1">{productErrors.variantDetails[i].stock}</p>}</div>
                          </div>
                          <details className="group"><summary className="text-xs text-white/30 hover:text-white/60 cursor-pointer select-none list-none flex items-center gap-1 mb-3"><ChevronRight size={12} className="group-open:rotate-90 transition-transform"/> Thông số kỹ thuật</summary><div className="grid grid-cols-3 gap-3">{[["cpu","CPU"],["os","Hệ điều hành"],["screenSize","Kích thước màn hình"],["screenTech","Công nghệ màn hình"],["refreshRate","Tần số quét"],["battery","Dung lượng pin"],["chargingSpeed","Tốc độ sạc"],["frontCamera","Camera trước"],["rearCamera","Camera sau"],["weights","Trọng lượng"],["updates","Cập nhật hệ điều hành"]].map(([key,ph])=><input key={key} placeholder={ph} value={v[key]} onChange={e=>updateVariant(i,key,e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition"/>)}</div></details>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-white/5">
                    <button onClick={handleSaveProduct} disabled={productSaving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50"><Check size={14}/> {productSaving?"Đang lưu...":"Lưu sản phẩm"}</button>
                    <button onClick={()=>{setShowAddProduct(false);setProductErrors({});}} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition"><X size={14}/> Hủy</button>
                  </div>
                </div>
              )}
              {productLoading?<div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"/></div>
                :productList.length===0?<div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-white/20"><Package size={40} className="mx-auto mb-3 opacity-30"/><p className="text-sm">Chưa có sản phẩm nào</p></div>
                :(
                  <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-5 px-6 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider"><span className="col-span-2">Sản phẩm</span><span>Hãng</span><span>Biến thể</span><span>Danh mục</span></div>
 {productList.map(p => {
  const isExpanded = editProductId === p.id || productDetailMap[p.id];
  const detail = productDetailMap[p.id];
  const isEditingProduct = editProductId === p.id;

  return (
    <div key={p.id} className="border-b border-white/5 last:border-0">
      {/* Row chính */}
      <div className="grid grid-cols-5 px-6 py-4 items-center hover:bg-white/2 transition">
        <div className="col-span-2">
          <p className="text-sm font-medium">{p.name}</p>
          <p className="text-xs text-white/30 mt-0.5">#{p.id} · {p.brand || "—"}</p>
        </div>
        <span className="text-sm text-white/50">{p.brand || "—"}</span>
        <span className="text-sm text-white/50">{p.variant_count} biến thể</span>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{p.category}</span>
          {/* Nút Sửa */}
          <button
            onClick={() => {
              if (isEditingProduct) { setEditProductId(null); setEditProductData({}); }
              else {
                setEditProductId(p.id);
                setEditProductData({ name: p.name, brand: p.brand || "", categoryId: p.category_id, description: "" });
                loadProductDetail(p.id);
              }
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition border ${isEditingProduct ? "bg-white/10 border-white/20 text-white/50" : "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"}`}>
            <Pencil size={11} /> {isEditingProduct ? "Đóng" : "Sửa"}
          </button>
          {/* Nút Thêm BT */}
          <button
            onClick={() => addVarProductId === p.id ? setAddVarProductId(null) : openAddVariant(p)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition border ${addVarProductId === p.id ? "bg-white/10 border-white/20 text-white/50" : "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20"}`}>
            <Plus size={11} /> {addVarProductId === p.id ? "Đóng" : "Thêm BT"}
          </button>
          {/* Nút Xóa SP */}
          <button
            onClick={() => handleDeleteProduct(p.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition border bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Panel Edit Product */}
      {isEditingProduct && (
        <div className="mx-4 mb-4 bg-[#1a1a1a] border border-blue-500/20 rounded-2xl p-5 flex flex-col gap-5">
          <p className="text-sm font-medium text-blue-400">Chỉnh sửa: <span className="text-white">{p.name}</span></p>

          {/* Thông tin chung */}
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Thông tin chung</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Tên sản phẩm"
                value={editProductData.name || ""}
                onChange={e => setEditProductData(d => ({ ...d, name: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500/50 transition" />
              <input
                placeholder="Hãng sản xuất"
                value={editProductData.brand || ""}
                onChange={e => setEditProductData(d => ({ ...d, brand: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500/50 transition" />
              <select
                value={editProductData.categoryId || ""}
                onChange={e => setEditProductData(d => ({ ...d, categoryId: e.target.value }))}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500/50 transition">
                <option value="">-- Danh mục --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Ảnh sản phẩm */}
          {loadingDetailId === p.id
            ? <div className="py-4 text-center text-white/20 text-sm">Đang tải...</div>
            : detail && (
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Ảnh sản phẩm</p>
                <div className="flex flex-wrap gap-2 items-start">
                  {(detail.images || []).map((img, i) => (
                    <div key={i} className="relative group w-20 h-20">
                      <img src={img.url} alt="" className="w-full h-full object-cover rounded-xl border border-white/10" />
                      {img.is_primary && (
                        <span className="absolute top-1 left-1 bg-orange-500 text-[9px] text-white px-1.5 py-0.5 rounded-full font-bold">MAIN</span>
                      )}
                      <div className="absolute inset-0 rounded-xl bg-black/70 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1">
                        {!img.is_primary && (
                          <button
                            onClick={() => handleSetPrimaryImage(img.image_id, p.id)}
                            className="text-[9px] text-orange-400 bg-orange-500/20 px-1.5 py-0.5 rounded-full hover:bg-orange-500/40 transition">
                            Đặt chính
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteProductImage(img.image_id, p.id)}
                          className="text-[9px] text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded-full hover:bg-red-500/40 transition">
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                  {/* Upload ảnh mới */}
                  <label className="w-20 h-20 rounded-xl border border-dashed border-white/20 hover:border-blue-500/50 flex flex-col items-center justify-center text-white/30 hover:text-blue-400 transition text-xs gap-1 cursor-pointer">
                    <Plus size={18} />
                    <span>Thêm</span>
                    <input type="file" accept="image/*" multiple className="hidden"
                      onChange={e => setEditProductData(d => ({ ...d, newImages: [...(d.newImages || []), ...Array.from(e.target.files)] }))} />
                  </label>
                  {(editProductData.newImages || []).map((f, i) => (
                    <div key={`new-${i}`} className="relative w-20 h-20 group">
                      <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover rounded-xl border border-blue-500/30" />
                      <span className="absolute top-1 left-1 bg-blue-500 text-[9px] text-white px-1.5 py-0.5 rounded-full">MỚI</span>
                      <button
                        onClick={() => setEditProductData(d => ({ ...d, newImages: d.newImages.filter((_, idx) => idx !== i) }))}
                        className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <X size={16} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Biến thể */}
          {detail && (
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Biến thể ({detail.variants?.length || 0})</p>
              <div className="flex flex-col gap-3">
                {(detail.variants || []).map(v => (
                  <div key={v.id} className="border border-white/10 rounded-xl overflow-hidden">
                    {/* Header biến thể */}
                    <div className="flex items-center justify-between px-4 py-3 bg-white/3">
                      <div className="flex items-center gap-3">
                        {v.image && <img src={v.image} alt="" className="w-9 h-9 rounded-lg object-cover border border-white/10" />}
                        <div>
                          <p className="text-sm font-medium">{[v.color, v.storage, v.ram].filter(Boolean).join(" / ") || `#${v.id}`}</p>
                          <p className="text-xs text-orange-400">{parseInt(v.price).toLocaleString("vi-VN")}đ · {v.stock} còn</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (editVariantId === v.id) { setEditVariantId(null); setEditVariantData({}); }
                            else {
                              setEditVariantId(v.id);
                              setEditVariantData({
                                color: v.color || "", storage: v.storage || "", ram: v.ram || "",
                                price: v.price, stock: v.stock,
                                cpu: v.cpu || "", os: v.os || "", screenSize: v.screen_size || "",
                                screenTech: v.screen_tech || "", refreshRate: v.refresh_rate || "",
                                battery: v.battery || "", chargingSpeed: v.charging_speed || "",
                                frontCamera: v.front_camera || "", rearCamera: v.rear_camera || "",
                                weights: v.weights || "", updates: v.updates || "",
                              });
                            }
                          }}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition border ${editVariantId === v.id ? "bg-white/10 border-white/15 text-white/40" : "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"}`}>
                          <Pencil size={11} /> {editVariantId === v.id ? "Đóng" : "Sửa"}
                        </button>
                        <button
                          onClick={() => handleDeleteVariant(v.id, p.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 transition">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Form edit biến thể */}
                    {editVariantId === v.id && (
                      <div className="p-4 border-t border-white/5 flex flex-col gap-4">
                        {/* Ảnh biến thể */}
                        <div>
                          <p className="text-xs text-white/30 mb-2">Ảnh biến thể</p>
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                              {editVariantData.imagePreview
                                ? <img src={editVariantData.imagePreview} alt="" className="w-full h-full object-cover" />
                                : v.image
                                  ? <img src={v.image} alt="" className="w-full h-full object-cover" />
                                  : <Plus size={16} className="text-white/15" />}
                            </div>
                            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs cursor-pointer transition">
                              <Plus size={11} className="text-blue-400" />
                              {editVariantData.imagePreview || v.image ? "Đổi ảnh" : "Chọn ảnh"}
                              <input type="file" accept="image/*" className="hidden"
                                onChange={e => {
                                  const f = e.target.files[0]; if (!f) return;
                                  setEditVariantData(d => ({ ...d, imageFile: f, imagePreview: URL.createObjectURL(f) }));
                                }} />
                            </label>
                            {(editVariantData.imagePreview) && (
                              <button
                                onClick={() => setEditVariantData(d => ({ ...d, imageFile: null, imagePreview: "" }))}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs transition hover:bg-red-500/20">
                                <X size={11} /> Huỷ
                              </button>
                            )}
                          </div>
                          {editVariantData.imageFile && (
                            <p className="text-xs text-yellow-400/70 mt-2 flex items-center gap-1">
                              <AlertTriangle size={11} /> Thay ảnh sẽ xóa dữ liệu YOLO cũ và train lại
                            </p>
                          )}
                        </div>

                        {/* Thông số */}
                        <div className="grid grid-cols-3 gap-3">
                          <ComboField value={editVariantData.color} onChange={val => setEditVariantData(d => ({ ...d, color: val }))}
                            options={["Đen","Trắng","Xanh dương","Xanh lá","Đỏ","Vàng","Hồng","Tím","Xám","Bạc","Titan tự nhiên","Titan đen","Titan trắng","Titan sa mạc"]}
                            placeholder="Màu sắc" />
                          <StorageField value={editVariantData.storage} onChange={val => setEditVariantData(d => ({ ...d, storage: val }))} />
                          <RamField value={editVariantData.ram} onChange={val => setEditVariantData(d => ({ ...d, ram: val }))} />
                          <input placeholder="Giá (VNĐ)" value={editVariantData.price || ""} onChange={e => setEditVariantData(d => ({ ...d, price: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500/50 transition" />
                          <input placeholder="Số lượng tồn" value={editVariantData.stock || ""} onChange={e => setEditVariantData(d => ({ ...d, stock: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500/50 transition" />
                        </div>
                        <details className="group">
                          <summary className="text-xs text-white/30 hover:text-white/60 cursor-pointer select-none list-none flex items-center gap-1 mb-3">
                            <ChevronRight size={12} className="group-open:rotate-90 transition-transform" /> Thông số kỹ thuật
                          </summary>
                          <div className="grid grid-cols-3 gap-3">
                            {[["cpu","CPU"],["os","Hệ điều hành"],["screenSize","Kích thước màn hình"],["screenTech","Công nghệ màn hình"],
                              ["refreshRate","Tần số quét"],["battery","Pin"],["chargingSpeed","Tốc độ sạc"],
                              ["frontCamera","Camera trước"],["rearCamera","Camera sau"],["weights","Trọng lượng"],["updates","Cập nhật OS"]
                            ].map(([key, ph]) => (
                              <input key={key} placeholder={ph} value={editVariantData[key] || ""}
                                onChange={e => setEditVariantData(d => ({ ...d, [key]: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500/50 transition" />
                            ))}
                          </div>
                        </details>
                        <div className="flex gap-2 pt-2 border-t border-white/5">
                          <button onClick={() => handleSaveEditVariant(v.id, p.id)} disabled={editVariantSaving}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-sm font-medium transition disabled:opacity-50">
                            <Check size={14} /> {editVariantSaving ? "Đang lưu..." : "Lưu biến thể"}
                          </button>
                          <button onClick={() => { setEditVariantId(null); setEditVariantData({}); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition">
                            <X size={14} /> Hủy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lưu thông tin chung */}
          <div className="flex gap-2 pt-2 border-t border-white/5">
            <button onClick={() => handleSaveEditProduct(p.id)} disabled={editProductSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-sm font-medium transition disabled:opacity-50">
              <Check size={14} /> {editProductSaving ? "Đang lưu..." : "Lưu thông tin sản phẩm"}
            </button>
            <button onClick={() => { setEditProductId(null); setEditProductData({}); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition">
              <X size={14} /> Hủy
            </button>
          </div>
        </div>
      )}

      {/* Panel Thêm biến thể (giữ nguyên code cũ) */}
      {addVarProductId === p.id && (
        <div className="mx-4 mb-4 bg-[#1a1a1a] border border-orange-500/20 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between"><p className="text-sm font-medium text-orange-400">Thêm biến thể cho: <span className="text-white">{addVarProductName}</span></p><button onClick={()=>setAddVarList(l=>[...l,{...EMPTY_VARIANT}])} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs transition"><Plus size={12}/> Thêm biến thể</button></div>
          {existingVariants.length>0&&<div><p className="text-xs text-white/30 mb-2">Biến thể hiện có ({existingVariants.length})</p><div className="flex flex-wrap gap-2">{existingVariants.map(v=><span key={v.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50">{[v.color,v.storage,v.ram].filter(Boolean).join(" / ")||`#${v.id}`}<span className="text-orange-400/60">{parseInt(v.price).toLocaleString("vi-VN")}đ</span></span>)}</div></div>}
          {addVarErrors.general&&<p className="text-red-400 text-xs">{addVarErrors.general}</p>}
          <div className="flex flex-col gap-3">
            {addVarList.map((v,vi)=>(
              <div key={vi} className="border border-white/10 rounded-xl p-4 bg-white/2">
                <div className="flex items-center justify-between mb-3"><span className="text-xs font-medium text-orange-400">Biến thể mới #{vi+1}</span>{addVarList.length>1&&<button onClick={()=>setAddVarList(l=>l.filter((_,idx)=>idx!==vi))} className="text-red-400/60 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition"><X size={13}/></button>}</div>
                <div className="mb-3 flex items-center gap-3"><div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">{v.imagePreview?<img src={v.imagePreview} alt="" className="w-full h-full object-cover"/>:<Plus size={16} className="text-white/15"/>}</div><label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs cursor-pointer transition"><Plus size={11} className="text-orange-400"/>{v.imagePreview?"Đổi ảnh":"Chọn ảnh"}<input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files[0];if(!f)return;setAddVarList(l=>l.map((item,idx)=>idx===vi?{...item,imageFile:f,imagePreview:URL.createObjectURL(f)}:item));}}/></label>{v.imagePreview&&<button onClick={()=>setAddVarList(l=>l.map((item,idx)=>idx===vi?{...item,imageFile:null,imagePreview:""}:item))} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs transition hover:bg-red-500/20"><X size={11}/> Xóa</button>}</div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <ComboField value={v.color} onChange={val=>setAddVarList(l=>l.map((item,idx)=>idx===vi?{...item,color:val}:item))} options={["Đen","Trắng","Xanh dương","Xanh lá","Đỏ","Vàng","Hồng","Tím","Xám","Bạc","Vàng đồng","Titan tự nhiên","Titan đen","Titan trắng","Titan sa mạc"]} placeholder="Màu sắc"/>
                  <StorageField value={v.storage} onChange={val=>setAddVarList(l=>l.map((item,idx)=>idx===vi?{...item,storage:val}:item))} error={addVarErrors.variantDetails?.[vi]?.storage}/>
                  <RamField value={v.ram} onChange={val=>setAddVarList(l=>l.map((item,idx)=>idx===vi?{...item,ram:val}:item))} error={addVarErrors.variantDetails?.[vi]?.ram}/>
                  <div><input placeholder="Giá (VNĐ) *" value={v.price} onChange={e=>setAddVarList(l=>l.map((item,idx)=>idx===vi?{...item,price:e.target.value}:item))} className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition ${addVarErrors.variantDetails?.[vi]?.price?"border-red-500/50":"border-white/10"}`}/>{addVarErrors.variantDetails?.[vi]?.price&&<p className="text-red-400 text-xs mt-1">{addVarErrors.variantDetails[vi].price}</p>}</div>
                  <div><input placeholder="Số lượng *" value={v.stock} onChange={e=>setAddVarList(l=>l.map((item,idx)=>idx===vi?{...item,stock:e.target.value}:item))} className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition ${addVarErrors.variantDetails?.[vi]?.stock?"border-red-500/50":"border-white/10"}`}/>{addVarErrors.variantDetails?.[vi]?.stock&&<p className="text-red-400 text-xs mt-1">{addVarErrors.variantDetails[vi].stock}</p>}</div>
                </div>
                <details className="group"><summary className="text-xs text-white/30 hover:text-white/60 cursor-pointer select-none list-none flex items-center gap-1 mb-3"><ChevronRight size={12} className="group-open:rotate-90 transition-transform"/> Thông số kỹ thuật</summary><div className="grid grid-cols-3 gap-3">{[["cpu","CPU"],["os","Hệ điều hành"],["screenSize","Kích thước MH"],["screenTech","Công nghệ MH"],["refreshRate","Tần số quét"],["battery","Pin"],["chargingSpeed","Tốc độ sạc"],["frontCamera","Camera trước"],["rearCamera","Camera sau"],["weights","Trọng lượng"],["updates","Cập nhật OS"]].map(([key,ph])=><input key={key} placeholder={ph} value={v[key]} onChange={e=>setAddVarList(l=>l.map((item,idx)=>idx===vi?{...item,[key]:e.target.value}:item))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition"/>)}</div></details>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-white/5">
            <button onClick={handleSaveAddVariant} disabled={addVarSaving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50"><Check size={14}/> {addVarSaving?"Đang lưu...":`Lưu ${addVarList.length} biến thể`}</button>
            <button onClick={()=>setAddVarProductId(null)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition"><X size={14}/> Hủy</button>
          </div>
        </div>
      )}
    </div>
  );
})}
                  </div>
                )}
            </div>
          )}

          {/* IMPORT */}
          {activeTab==="import"&&(
            <div className="flex flex-col gap-6">
              <p className="text-sm text-white/40">Chọn sản phẩm để nhập thêm hàng</p>
              <div className="bg-[#161616] border border-white/10 rounded-2xl p-5"><p className="text-xs text-white/40 uppercase tracking-wider mb-3">Chọn sản phẩm</p><select value={importProductId} onChange={e=>{setImportProductId(e.target.value);loadImportVariants(e.target.value);}} className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"><option value="">-- Chọn sản phẩm</option>{productList.map(p=><option key={p.id} value={p.id}>{p.name} {p.brand?`(${p.brand})`:""}</option>)}</select></div>
              {importLoading?<div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"/></div>
                :importVariants.length>0&&(
                  <div className="flex flex-col gap-4">
                    <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                      <div className="grid grid-cols-5 px-6 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider"><span className="col-span-2">Biến thể</span><span>Giá</span><span>Tồn kho</span><span>Nhập thêm</span></div>
                      {importVariants.map(v=>(
                        <div key={v.id} className="grid grid-cols-5 px-6 py-4 border-b border-white/5 last:border-0 items-center">
                          <div className="col-span-2"><p className="text-sm font-medium">{[v.color,v.storage,v.ram].filter(Boolean).join(" / ")||`Variant #${v.id}`}</p><p className="text-xs text-white/30 mt-0.5">#{v.id}</p></div>
                          <span className="text-sm text-orange-300">{parseInt(v.price).toLocaleString("vi-VN")}đ</span>
                          <span className={`text-sm font-medium ${v.stock<=5?"text-red-400":"text-white/60"}`}>{v.stock}</span>
                          <input type="number" min="0" placeholder="0" value={importQty[v.id]||""} onChange={e=>setImportQty(q=>({...q,[v.id]:e.target.value}))} className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-orange-500/50 transition"/>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3 items-center"><button onClick={handleImport} disabled={importSaving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50"><Check size={14}/> {importSaving?"Đang nhập...":"Xác nhận nhập hàng"}</button><p className="text-xs text-white/30">{Object.values(importQty).filter(q=>parseInt(q)>0).length} biến thể được chọn</p></div>
                  </div>
                )}
            </div>
          )}

          {/* ORDERS */}
          {activeTab==="orders"&&(
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between"><p className="text-sm text-white/40">Quản lý tất cả đơn hàng</p><button onClick={loadOrders} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs transition"><RefreshCw size={13}/> Làm mới</button></div>
              {orderDetail?(
                <div className="flex flex-col gap-4">
                  <button onClick={()=>setOrderDetail(null)} className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition w-fit">← Quay lại danh sách</button>
                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4"><div><p className="font-semibold">Đơn #{orderDetail.id}</p><p className="text-xs text-white/30 mt-0.5">{new Date(orderDetail.created_at).toLocaleString("vi-VN")}</p><p className="text-xs text-white/40 mt-1">KH: {orderDetail.customer_name} · {orderDetail.customer_phone}</p></div><span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{color:ORDER_STATUS_MAP[orderDetail.status]?.color||"#fff",background:(ORDER_STATUS_MAP[orderDetail.status]?.color||"#fff")+"22"}}>{ORDER_STATUS_MAP[orderDetail.status]?.label||orderDetail.status}</span></div>
                    <p className="text-xs text-white/40 mb-4">📍 {orderDetail.shipping_address}</p>
                    <p className="text-xs text-white/30 mb-4">{orderDetail.payment_method==="momo"?"💜 MoMo":"🚚 COD"}</p>
                    <div className="border border-white/5 rounded-xl overflow-hidden mb-4">{(orderDetail.items||[]).map((item,i)=><div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0"><div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/5 bg-[#222]">{item.image&&<img src={item.image} alt="" className="w-full h-full object-contain p-1"/>}</div><div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{item.product_name}</p><p className="text-[10px] text-white/30">{[item.color,item.storage,item.ram].filter(Boolean).join(" · ")} × {item.quantity}</p></div><p className="text-xs text-orange-400 shrink-0">{(parseFloat(item.unit_price)*item.quantity).toLocaleString("vi-VN")}đ</p></div>)}</div>
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-white/10 mb-5"><span>Tổng thanh toán</span><span className="text-orange-400">{parseFloat(orderDetail.total_amount).toLocaleString("vi-VN")}đ</span></div>
                    {ORDER_STATUS_MAP[orderDetail.status]?.next&&(
                      <div className="border border-orange-500/20 rounded-xl p-4 bg-orange-500/5">
                        <p className="text-xs text-orange-400 font-medium mb-3">Cập nhật trạng thái đơn hàng</p>
                        <input placeholder="Ghi chú cho khách hàng (tùy chọn)" value={statusNote} onChange={e=>setStatusNote(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition mb-3"/>
                        <div className="flex gap-2">
                          <button onClick={()=>handleUpdateOrderStatus(orderDetail.id,ORDER_STATUS_MAP[orderDetail.status].next)} disabled={updatingOrder===orderDetail.id} className="flex-1 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-sm font-medium transition disabled:opacity-50">{updatingOrder===orderDetail.id?"Đang cập nhật...":ORDER_STATUS_MAP[orderDetail.status].nextLabel}</button>
                          {orderDetail.status==="Pending"&&<button onClick={()=>handleCancelOrder(orderDetail.id)} className="px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition">Hủy đơn</button>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ):orderLoading?<div className="text-center py-10 text-white/20 text-sm">Đang tải...</div>
                :orderList.length===0?<div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-white/20"><ShoppingBag size={36} className="mx-auto mb-3 opacity-20"/><p className="text-sm">Chưa có đơn hàng nào</p></div>
                :(
                  <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-12 px-5 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider"><span className="col-span-1">#</span><span className="col-span-3">Khách hàng</span><span className="col-span-4">Địa chỉ</span><span className="col-span-2">Tổng tiền</span><span className="col-span-2">Trạng thái</span></div>
                    {orderList.map(order=>{ const sm=ORDER_STATUS_MAP[order.status]||{}; return(
                      <div key={order.id} onClick={()=>{setOrderDetail(order);setStatusNote("");}} className="grid grid-cols-12 px-5 py-3.5 border-b border-white/5 last:border-0 items-center hover:bg-white/3 transition cursor-pointer">
                        <span className="col-span-1 text-xs text-white/40">#{order.id}</span>
                        <div className="col-span-3"><p className="text-sm font-medium truncate">{order.customer_name}</p><p className="text-xs text-white/30">{order.customer_phone}</p></div>
                        <p className="col-span-4 text-xs text-white/40 truncate pr-3">{order.shipping_address}</p>
                        <p className="col-span-2 text-sm font-medium text-orange-400">{parseFloat(order.total_amount).toLocaleString("vi-VN")}đ</p>
                        <span className="col-span-2 text-xs px-2 py-0.5 rounded-full font-medium w-fit" style={{color:sm.color||"#fff",background:(sm.color||"#fff")+"22"}}>{sm.label||order.status}</span>
                      </div>
                    );})}
                  </div>
                )}
            </div>
          )}

          {/* RETURNS */}
          {activeTab==="returns"&&(
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between"><p className="text-sm text-white/40">Quản lý yêu cầu trả hàng từ khách</p><button onClick={loadReturns} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs transition"><RefreshCw size={13}/> Làm mới</button></div>
              {returnDetail?(
                <div className="flex flex-col gap-4">
                  <button onClick={()=>{setReturnDetail(null);setReturnNote("");}} className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition w-fit">← Quay lại danh sách</button>
                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4"><div><p className="font-semibold">Yêu cầu trả #R{returnDetail.return_id}</p><p className="text-xs text-white/30 mt-0.5">Đơn #{returnDetail.order_id} · {returnDetail.customer_name}</p><p className="text-xs text-white/20 mt-0.5">{new Date(returnDetail.created_at).toLocaleString("vi-VN")}</p></div><span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{color:RETURN_STATUS_MAP[returnDetail.status]?.color,background:(RETURN_STATUS_MAP[returnDetail.status]?.color||"#fff")+"22"}}>{RETURN_STATUS_MAP[returnDetail.status]?.label||returnDetail.status}</span></div>
                    <div className="bg-white/4 rounded-xl p-4 mb-4"><p className="text-xs text-white/40 mb-1">Lý do khách hàng:</p><p className="text-sm text-white/80">{returnDetail.reason}</p></div>
                    {returnDetail.media?.length>0&&<div className="mb-4"><p className="text-xs text-white/40 mb-2">Bằng chứng ({returnDetail.media.length} file):</p><div className="flex gap-2 flex-wrap">{returnDetail.media.map((m,i)=><a key={i} href={m.url} target="_blank" rel="noreferrer" className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center hover:border-orange-500/50 transition">{m.type==="video"?<div className="flex flex-col items-center gap-1"><FileVideo size={22} className="text-purple-400"/><span className="text-[9px] text-white/30">Video</span></div>:<img src={m.url} alt="" className="w-full h-full object-cover"/>}</a>)}</div></div>}
                    {returnDetail.admin_note&&<div className="bg-white/4 rounded-xl px-4 py-3 mb-4"><p className="text-xs text-white/30">Ghi chú admin trước đó:</p><p className="text-sm text-white/60 italic mt-1">"{returnDetail.admin_note}"</p></div>}
                    {RETURN_ACTIONS[returnDetail.status]&&(
                      <div className="border border-white/8 rounded-xl p-4" style={{background:"rgba(255,255,255,0.02)"}}>
                        <p className="text-xs text-white/40 mb-3 font-medium">Xử lý yêu cầu</p>
                        <input placeholder="Ghi chú cho khách hàng (tùy chọn)" value={returnNote} onChange={e=>setReturnNote(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition mb-3"/>
                        <div className="flex items-start gap-2 mb-3 text-xs text-white/30"><AlertCircle size={12} className="shrink-0 mt-0.5 text-orange-400/60"/><span>{returnDetail.status==="Pending"&&"Chấp nhận → khách gửi hàng về. Từ chối → kết thúc yêu cầu."}{returnDetail.status==="Approved"&&"Xác nhận khi đã nhận được hàng từ khách."}{returnDetail.status==="Returning"&&"Hoàn tất → stock sẽ được cộng lại tự động."}</span></div>
                        <div className="flex gap-2 flex-wrap">{RETURN_ACTIONS[returnDetail.status].map(btn=><button key={btn.action} onClick={()=>handleProcessReturn(returnDetail.return_id,btn.action)} disabled={processingReturn} className="flex-1 min-w-[140px] py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50 border" style={{color:btn.color,background:btn.bg,borderColor:btn.border}}>{processingReturn?"Đang xử lý...":btn.label}</button>)}</div>
                      </div>
                    )}
                    {["Completed","Rejected"].includes(returnDetail.status)&&<div className="mt-3 text-center text-sm text-white/30 py-3 border border-white/5 rounded-xl">{returnDetail.status==="Completed"?"✅ Đã hoàn tất — stock đã được cộng lại":"❌ Yêu cầu đã bị từ chối"}</div>}
                  </div>
                </div>
              ):returnLoading?<div className="text-center py-10 text-white/20 text-sm">Đang tải...</div>
                :returnList.length===0?<div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center"><RotateCcw size={36} className="mx-auto mb-3 text-white/10"/><p className="text-sm text-white/20">Chưa có yêu cầu trả hàng nào</p></div>
                :(
                  <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-12 px-5 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider"><span className="col-span-1">#</span><span className="col-span-2">Đơn</span><span className="col-span-3">Khách hàng</span><span className="col-span-3">Lý do</span><span className="col-span-2">Ngày gửi</span><span className="col-span-1">T.Thái</span></div>
                    {returnList.map(rr=>{ const sm=RETURN_STATUS_MAP[rr.status]||{}; return(
                      <div key={rr.return_id} onClick={()=>{setReturnDetail(rr);setReturnNote("");}} className="grid grid-cols-12 px-5 py-3.5 border-b border-white/5 last:border-0 items-center hover:bg-white/3 transition cursor-pointer">
                        <span className="col-span-1 text-xs text-white/40">#R{rr.return_id}</span><span className="col-span-2 text-xs text-white/60">#{rr.order_id}</span>
                        <div className="col-span-3"><p className="text-sm font-medium truncate">{rr.customer_name}</p></div>
                        <p className="col-span-3 text-xs text-white/40 truncate pr-2">{rr.reason}</p>
                        <p className="col-span-2 text-xs text-white/30">{new Date(rr.created_at).toLocaleDateString("vi-VN")}</p>
                        <span className="col-span-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{color:sm.color,background:(sm.color||"#fff")+"22"}}>{rr.status==="Pending"?"Mới":rr.status==="Completed"?"Xong":rr.status==="Rejected"?"Từ chối":"..."}</span>
                      </div>
                    );})}
                  </div>
                )}
            </div>
          )}

          {/* VOUCHER */}
          {activeTab==="voucher"&&(
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between"><p className="text-sm text-white/40">Quản lý mã giảm giá</p><button onClick={()=>setShowAddVoucher(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition"><Plus size={14}/> Tạo voucher</button></div>
              {showAddVoucher&&(
                <div className="bg-[#161616] border border-orange-500/20 rounded-2xl p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between"><p className="text-sm font-semibold text-orange-400">Tạo voucher mới</p><button onClick={()=>{setShowAddVoucher(false);setVoucherVariants([]);}} className="text-white/30 hover:text-white"><X size={16}/></button></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs text-white/40 mb-1 block">Mã voucher *</label><input placeholder="VD: SUMMER2025" value={newVoucher.code} onChange={e=>setNewVoucher(p=>({...p,code:e.target.value.toUpperCase()}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition font-mono tracking-widest"/></div>
                    <div><label className="text-xs text-white/40 mb-1 block">Loại giảm giá *</label><select value={newVoucher.type} onChange={e=>setNewVoucher(p=>({...p,type:e.target.value}))} className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"><option value="percent">Phần trăm (%)</option><option value="fixed">Số tiền cố định (đ)</option></select></div>
                    <div><label className="text-xs text-white/40 mb-1 block">Giá trị * {newVoucher.type==="percent"?"(%) tối đa 100":"(đ)"}</label><input type="number" placeholder={newVoucher.type==="percent"?"VD: 10":"VD: 500000"} value={newVoucher.value} onChange={e=>setNewVoucher(p=>({...p,value:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"/></div>
                    <div><label className="text-xs text-white/40 mb-1 block">Phạm vi áp dụng *</label><select value={newVoucher.scope} onChange={e=>{setNewVoucher(p=>({...p,scope:e.target.value,category_id:"",product_id:"",variant_id:""}));setVoucherVariants([]);}} className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"><option value="all">Toàn bộ sản phẩm</option><option value="category">Theo danh mục</option><option value="product">Theo sản phẩm</option></select></div>
                    {newVoucher.scope==="category"&&<div><label className="text-xs text-white/40 mb-1 block">Danh mục *</label><select value={newVoucher.category_id} onChange={e=>setNewVoucher(p=>({...p,category_id:e.target.value}))} className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"><option value="">-- Chọn danh mục --</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
                    {newVoucher.scope==="product"&&<><div><label className="text-xs text-white/40 mb-1 block">Sản phẩm *</label><select value={newVoucher.product_id} onChange={e=>{setNewVoucher(p=>({...p,product_id:e.target.value,variant_id:""}));loadVoucherVariants(e.target.value);}} className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"><option value="">-- Chọn sản phẩm --</option>{productList.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>{newVoucher.product_id&&<div><label className="text-xs text-white/40 mb-1 block">Cấu hình RAM/ROM <span className="text-white/20">(để trống = áp dụng tất cả)</span></label>{voucherVarLoading?<div className="text-xs text-white/30 py-2 flex items-center gap-2"><div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin"/>Đang tải...</div>:<select value={newVoucher.variant_id} onChange={e=>setNewVoucher(p=>({...p,variant_id:e.target.value}))} className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"><option value="">-- Tất cả cấu hình --</option>{(()=>{ const seen=new Set();const r=[]; [...voucherVariants].sort((a,b)=>parseFloat(a.price)-parseFloat(b.price)).forEach(v=>{const k=`${v.ram||""}|${v.storage||""}`;if(!seen.has(k)){seen.add(k);r.push(v);}}) ;return r.map(v=><option key={v.id} value={v.id}>{[v.ram,v.storage].filter(Boolean).join(" · ")||`Phiên bản #${v.id}`}{v.price?` — ${parseInt(v.price).toLocaleString("vi-VN")}đ`:""}</option>);})()}</select>}</div>}</>}
                    <div><label className="text-xs text-white/40 mb-1 block">Đơn hàng tối thiểu (đ)</label><input type="number" placeholder="VD: 1000000" value={newVoucher.min_order} onChange={e=>setNewVoucher(p=>({...p,min_order:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"/></div>
                    {newVoucher.type==="percent"&&<div><label className="text-xs text-white/40 mb-1 block">Giảm tối đa (đ)</label><input type="number" placeholder="VD: 200000" value={newVoucher.max_discount} onChange={e=>setNewVoucher(p=>({...p,max_discount:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"/></div>}
                    <div><label className="text-xs text-white/40 mb-1 block">Ngày bắt đầu</label><input type="date" value={newVoucher.start_date} onChange={e=>setNewVoucher(p=>({...p,start_date:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"/></div>
                    <div><label className="text-xs text-white/40 mb-1 block">Ngày kết thúc</label><input type="date" value={newVoucher.end_date} onChange={e=>setNewVoucher(p=>({...p,end_date:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"/></div>
                    <div><label className="text-xs text-white/40 mb-1 block">Giới hạn lượt dùng</label><input type="number" placeholder="Để trống = không giới hạn" value={newVoucher.usage_limit} onChange={e=>setNewVoucher(p=>({...p,usage_limit:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-500/50 transition"/></div>
                  </div>
                  <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4"><p className="text-xs text-white/30 mb-2">Xem trước</p><div className="flex items-center gap-3"><span className="font-mono text-orange-400 font-bold text-base tracking-widest">{newVoucher.code||"VOUCHER"}</span><span className="text-white/40">—</span><span className="text-sm text-white/70">Giảm {newVoucher.value||"??"}{newVoucher.type==="percent"?"%":"đ"}{newVoucher.type==="percent"&&newVoucher.max_discount?` (tối đa ${parseInt(newVoucher.max_discount).toLocaleString("vi-VN")}đ)`:""} {newVoucher.scope==="all"?"cho toàn bộ":newVoucher.scope==="category"?"cho danh mục":"cho sản phẩm"}</span></div></div>
                  <div className="flex gap-2 pt-2 border-t border-white/5"><button onClick={handleSaveVoucher} disabled={voucherSaving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50"><Check size={14}/> {voucherSaving?"Đang lưu...":"Tạo voucher"}</button><button onClick={()=>{setShowAddVoucher(false);setVoucherVariants([]);}} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition"><X size={14}/> Hủy</button></div>
                </div>
              )}
              {voucherLoading?<div className="text-center py-10 text-white/20 text-sm">Đang tải...</div>
                :voucherList.length===0?<div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-white/20"><Ticket size={36} className="mx-auto mb-3 opacity-20"/><p className="text-sm">Chưa có voucher nào</p></div>
                :(
                  <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-6 px-5 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider"><span className="col-span-2">Mã</span><span>Giảm giá</span><span>Phạm vi</span><span>Hạn dùng</span><span>Trạng thái</span></div>
                    {voucherList.map(v=>(
                      <div key={v.id} className="grid grid-cols-6 px-5 py-4 border-b border-white/5 last:border-0 items-center hover:bg-white/2 transition">
                        <div className="col-span-2"><p className="font-mono font-bold text-orange-400 tracking-widest">{v.code}</p>{v.min_order>0&&<p className="text-xs text-white/30 mt-0.5">Đơn tối thiểu: {parseInt(v.min_order).toLocaleString("vi-VN")}đ</p>}<p className="text-xs text-white/20 mt-0.5">Đã dùng: {v.used_count}/{v.usage_limit||"∞"}</p></div>
                        <div><p className="text-sm font-semibold text-green-400">-{v.type==="percent"?`${v.value}%`:`${parseInt(v.value).toLocaleString("vi-VN")}đ`}</p>{v.type==="percent"&&v.max_discount>0&&<p className="text-xs text-white/30">Tối đa: {parseInt(v.max_discount).toLocaleString("vi-VN")}đ</p>}</div>
                        <div>{v.scope==="all"&&<span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">Tất cả</span>}{v.scope==="category"&&<span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">Danh mục</span>}{v.scope==="product"&&<span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">Sản phẩm</span>}</div>
                        <div className="text-xs text-white/40">{v.end_date?new Date(v.end_date).toLocaleDateString("vi-VN"):"Không giới hạn"}</div>
                        <div className="flex items-center gap-2">{v.is_active?<span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">Hiệu lực</span>:<span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">Hết hạn</span>}{v.is_active&&<button onClick={()=>deactivateVoucher(v.id)} className="text-xs text-white/20 hover:text-red-400 transition px-2 py-0.5 rounded-lg hover:bg-red-500/10">Vô hiệu</button>}</div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* POSTS */}
          {activeTab==="posts"&&(
            <div className="flex flex-col gap-5">
              {showPostForm?(
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between"><p className="font-semibold">{editingPost?"Chỉnh sửa bài viết":"Bài viết mới"}</p><button onClick={()=>{setShowPostForm(false);setEditingPost(null);setPostForm({title:"",category:"Mẹo vặt",blocks:[],mediaFiles:{}}); }} className="text-white/40 hover:text-white transition"><X size={18}/></button></div>
                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                    <input value={postForm.title} onChange={e=>setPostForm(p=>({...p,title:e.target.value}))} placeholder="Tiêu đề bài viết *" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-semibold outline-none focus:border-orange-500/50 transition"/>
                    <div className="flex items-center gap-2"><span className="text-xs text-white/40 shrink-0">Danh mục:</span><div className="flex gap-2 flex-wrap">{POST_CATEGORIES.map(cat=><button key={cat} onClick={()=>setPostForm(p=>({...p,category:cat}))} className="px-3 py-1 rounded-full text-xs transition" style={{background:postForm.category===cat?"rgba(255,149,0,0.2)":"rgba(255,255,255,0.05)",color:postForm.category===cat?"#ff9500":"rgba(255,255,255,0.4)",border:postForm.category===cat?"1px solid rgba(255,149,0,0.4)":"1px solid rgba(255,255,255,0.08)"}}>{cat}</button>)}</div></div>
                    <div><p className="text-xs text-white/30 mb-3">Nội dung bài viết (Block Editor)</p><Blockeditor blocks={postForm.blocks} onChange={blocks=>setPostForm(p=>({...p,blocks}))} mediaFiles={postForm.mediaFiles} onMediaChange={mediaFiles=>setPostForm(p=>({...p,mediaFiles}))}/></div>
                  </div>
                  <button onClick={savePost} disabled={postSaving} className={`py-3 rounded-xl disabled:opacity-50 font-semibold text-sm transition ${editingPost ? "bg-blue-500 hover:bg-blue-600" : "bg-orange-500 hover:bg-orange-600"}`}>{postSaving?"Đang lưu...":editingPost?"Cập nhật bài viết":"Đăng bài viết"}</button>
                </div>
              ):(
                <>
                  <div className="flex items-center justify-between"><p className="text-sm text-white/40">{postList.length} bài viết</p><button onClick={()=>{setShowPostForm(true);setEditingPost(null);setPostForm({title:"",category:"Mẹo vặt",blocks:[],mediaFiles:{}});}} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition"><Plus size={14}/> Viết bài mới</button></div>
                  {postLoading?<div className="text-center py-10 text-white/20 text-sm">Đang tải...</div>
                    :postList.length===0?<div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center"><Newspaper size={36} className="mx-auto mb-3 text-white/10"/><p className="text-sm text-white/20">Chưa có bài viết nào</p></div>
                    :(
                      <div className="flex flex-col gap-3">
                        {postList.map(post=>(
                          <div key={post.id} className="bg-[#161616] border border-white/5 rounded-2xl flex items-center gap-4 px-5 py-4 hover:border-white/10 transition">
                            {post.thumbnail?<img src={post.thumbnail} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0"/>:<div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><Newspaper size={20} className="text-white/15"/></div>}
                            <div className="flex-1 min-w-0"><p className="font-medium truncate">{post.title}</p><div className="flex items-center gap-3 mt-1"><span className="text-xs text-orange-400/70">{post.category}</span><span className="text-xs text-white/30">{new Date(post.created_at).toLocaleDateString("vi-VN")}</span></div></div>
                            <div className="flex gap-2 shrink-0">
                              <button onClick={()=>window.open(`/blog/${post.id}`,"_blank")} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition"><Eye size={14}/></button>
                              <button onClick={()=>{ fetch(`${API}/api/post/${post.id}/`).then(r=>r.json()).then(d=>{ setEditingPost(post); setPostForm({title:d.post.title,category:d.post.category,blocks:d.post.blocks,mediaFiles:{}}); setShowPostForm(true); }); }} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-orange-400 transition"><Pencil size={14}/></button>
                              <button onClick={()=>deletePost(post.id)} className="p-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 transition"><Trash2 size={14}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </>
              )}
            </div>
          )}

          {/* PRODUCT CONTENT */}
          {activeTab==="product_content"&&(
            <div className="flex flex-col gap-5">
              <p className="text-sm text-white/40">Chọn sản phẩm và tạo mô tả chi tiết (ảnh, video, văn bản)</p>
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
                <p className="text-xs text-white/40 mb-3 uppercase tracking-wider">Chọn sản phẩm</p>
                <select value={pcProductId} onChange={e=>{setPcProductId(e.target.value);if(e.target.value)loadProductContent(e.target.value);}} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition w-full">
                  <option value="">-- Chọn sản phẩm --</option>{productList.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {pcProductId&&pcLoaded&&(
                <>
                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-5"><p className="text-xs text-white/40 mb-4 uppercase tracking-wider">Nội dung mô tả (Block Editor)</p><Blockeditor blocks={pcBlocks} onChange={setPcBlocks} mediaFiles={pcMediaFiles} onMediaChange={setPcMediaFiles}/></div>
                  <button onClick={saveProductContent} disabled={pcSaving} className="py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 font-semibold text-sm transition">{pcSaving?"Đang lưu...":"Lưu mô tả sản phẩm"}</button>
                </>
              )}
              {pcProductId&&!pcLoaded&&<div className="text-center py-10 text-white/20 text-sm">Đang tải nội dung...</div>}
            </div>
          )}

          {/* REVIEWS & COMMENTS */}
          {activeTab==="reviews"&&(
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                  {[{k:"reviews",l:"Đánh giá"},{k:"comments",l:"Bình luận"}].map(({k,l})=>(
                    <button key={k} onClick={()=>setReviewType(k)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${reviewType===k?"bg-orange-500 text-white":"text-white/40 hover:text-white"}`}>{l}</button>
                  ))}
                </div>
                <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                  {[{k:"all",l:"Tất cả"},{k:"unanswered",l:`Chưa trả lời${unansweredCount>0?` (${unansweredCount})`:""}`},{k:"answered",l:"Đã trả lời"}].map(({k,l})=>(
                    <button key={k} onClick={()=>setReviewFilter(k)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${reviewFilter===k?"bg-orange-500/20 text-orange-400 border border-orange-500/30":"text-white/40 hover:text-white"}`}>{l}</button>
                  ))}
                </div>
                <div className="flex-1 min-w-[200px] relative">
                  <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20"/>
                  <input value={reviewSearch} onChange={e=>setReviewSearch(e.target.value)} placeholder="Tìm theo tên sản phẩm..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-2 text-sm outline-none focus:border-orange-500/40 transition text-white placeholder-white/20"/>
                </div>
                <button onClick={loadReviews} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition"><RefreshCw size={14} className="text-white/40"/></button>
              </div>
              {reviewLoading ? (
                <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"/></div>
              ) : (()=>{
                const items = reviewList.filter(item => {
                  if(reviewType==="reviews" && item.type!=="review") return false;
                  if(reviewType==="comments" && item.type!=="comment") return false;
                  if(reviewFilter==="unanswered" && item.admin_reply) return false;
                  if(reviewFilter==="answered" && !item.admin_reply) return false;
                  if(reviewSearch && !item.product_name?.toLowerCase().includes(reviewSearch.toLowerCase())) return false;
                  return true;
                });
                if(items.length===0) return (
                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-white/20">
                    <MessageCircle size={36} className="mx-auto mb-3 opacity-20"/>
                    <p className="text-sm">Không có {reviewType==="reviews"?"đánh giá":"bình luận"} nào</p>
                  </div>
                );
                return (
                  <div className="flex flex-col gap-3">
                    {items.map(item=>(
                      <div key={`${item.type}-${item.id}`} className="bg-[#161616] border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-xs font-bold shrink-0">
                            {item.customer_name?.[0]?.toUpperCase()||"U"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{item.customer_name}</span>
                              <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{item.product_name}</span>
                              {item.variant&&<span className="text-xs text-white/20 bg-white/5 px-2 py-0.5 rounded-full">{item.variant}</span>}
                              {item.type==="review"&&(
                                <div className="flex gap-0.5 ml-auto">
                                  {[1,2,3,4,5].map(n=><Star key={n} size={12} fill={n<=item.rating?"#f59e0b":"none"} stroke={n<=item.rating?"#f59e0b":"#ffffff20"} strokeWidth={1.5}/>)}
                                </div>
                              )}
                              <span className="text-xs text-white/20 ml-auto">{new Date(item.created_at).toLocaleDateString("vi-VN")}</span>
                            </div>
                            <p className="mt-1.5 text-sm text-white/70 leading-relaxed">{item.content}</p>
                            {item.media?.length>0&&(
                              <div className="flex gap-2 mt-2 flex-wrap">
                                {item.media.map((m,i)=>(
                                  <a key={i} href={m.url} target="_blank" rel="noreferrer"
                                    className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center hover:border-orange-500/30 transition">
                                    {m.type==="video"?<FileVideo size={18} className="text-purple-400"/>:<img src={m.url} alt="" className="w-full h-full object-cover"/>}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {item.admin_reply && (
                          <div className="ml-12 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex gap-3">
                            <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-bold text-white">PZ</span>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-orange-400">PHONEZONE</span>
                              <p className="text-sm text-white/70 mt-0.5">{item.admin_reply.content}</p>
                            </div>
                          </div>
                        )}
                        {replyTarget?.id===item.id && replyTarget?.type===item.type ? (
                          <div className="ml-12 flex gap-2">
                            <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} rows={2} placeholder="Trả lời với tư cách PHONEZONE..."
                              className="flex-1 bg-white/5 border border-orange-500/30 rounded-xl px-3 py-2 text-sm outline-none resize-none placeholder-white/20 text-white focus:border-orange-500/60 transition"/>
                            <div className="flex flex-col gap-2">
                              <button onClick={submitAdminReply} disabled={replySaving||!replyText.trim()}
                                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-medium transition flex items-center gap-1">
                                {replySaving?<Loader2 size={12} className="animate-spin"/>:<></>}Gửi
                              </button>
                              <button onClick={()=>{setReplyTarget(null);setReplyText("");}}
                                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white/40 transition">Hủy</button>
                            </div>
                          </div>
                        ) : (
                          <div className="ml-12">
                            <button onClick={()=>{setReplyTarget({type:item.type,id:item.id});setReplyText(item.admin_reply?.content||"");}}
                              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-orange-400 transition">
                              <CornerDownRight size={12}/>
                              {item.admin_reply?"Chỉnh sửa phản hồi":"Trả lời"}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* SETTINGS */}
          {activeTab==="settings"&&(
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-white/20"><Settings size={40} className="mx-auto mb-3 opacity-30"/><p className="text-sm">Đang phát triển</p></div>
          )}

        </div>
      </main>
    </div>
  );
}

// ── HELPER COMPONENTS ──
function AdminSection({title,children}){
  return(
    <div className="bg-[#161616] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5"><h3 className="font-semibold text-sm text-white/70">{title}</h3></div>
      <div className="px-6 py-2">{children}</div>
    </div>
  );
}
function InfoRow({label,value}){
  return(
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-white/30 text-sm w-36 shrink-0">{label}</span>
      <span className="flex-1 text-sm">{value||<span className="text-white/20 italic">Chưa cập nhật</span>}</span>
    </div>
  );
}
function PwInput({placeholder,value,show,onToggle,onChange,error}){
  return(
    <div>
      <div className="relative">
        <input type={show?"text":"password"} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)} className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 pr-10 text-sm outline-none focus:border-orange-500/50 transition ${error?"border-red-500/50":"border-white/10"}`}/>
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">{show?<EyeOff size={14}/>:<Eye size={14}/>}</button>
      </div>
      {error&&<p className="text-red-400 text-xs mt-1 pl-1">{error}</p>}
    </div>
  );
}
function ComboField({value,onChange,options,placeholder}){
  const[open,setOpen]=useState(false);
  const[input,setInput]=useState(value||"");
  const ref=useRef(null);
  useEffect(()=>{setInput(value||"");},[value]);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  const filtered=options.filter(o=>o.toLowerCase().includes(input.toLowerCase()));
  return(
    <div className="relative" ref={ref}>
      <input value={input} onChange={e=>{setInput(e.target.value);onChange(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} placeholder={placeholder} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition pr-8"/>
      <button type="button" onClick={()=>setOpen(!open)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition"><svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d={open?"M2 8l4-4 4 4":"M2 4l4 4 4-4"} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></button>
      {open&&filtered.length>0&&(
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[#222] border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map(opt=><button key={opt} type="button" onClick={()=>{setInput(opt);onChange(opt);setOpen(false);}} className={`w-full text-left px-3 py-2 text-sm transition hover:bg-orange-500/10 hover:text-orange-300 ${input===opt?"bg-orange-500/15 text-orange-300":"text-white/70"}`}>{opt}</button>)}
          {input&&!options.includes(input)&&<button type="button" onClick={()=>{onChange(input);setOpen(false);}} className="w-full text-left px-3 py-2 text-sm text-white/40 hover:bg-white/5 border-t border-white/5">Dùng: <span className="text-white/70">"{input}"</span></button>}
        </div>
      )}
    </div>
  );
}
function StorageField({value,onChange,error}){
  const parse=val=>{if(!val)return{num:"",unit:"GB"};const m=String(val).trim().match(/^(\d+(?:\.\d+)?)\s*(GB|TB)$/i);if(m)return{num:m[1],unit:m[2].toUpperCase()};return{num:val,unit:"GB"};};
  const[num,setNum]=useState(()=>parse(value).num);
  const[unit,setUnit]=useState(()=>parse(value).unit);
  useEffect(()=>{const p=parse(value);setNum(p.num);setUnit(p.unit);},[value]); // eslint-disable-line
  const handleNum=e=>{const v=e.target.value.replace(/[^0-9]/g,"");setNum(v);onChange(v?`${v}${unit}`:"");};
  const handleUnit=e=>{setUnit(e.target.value);onChange(num?`${num}${e.target.value}`:"");};
  const sugg=unit==="GB"?["64","128","256","512"]:["1","2"];
  return(
    <div>
      <div className={`flex items-center border rounded-lg overflow-hidden transition ${error?"border-red-500/50":"border-white/10"} bg-white/5`}>
        <input type="text" inputMode="numeric" placeholder={unit==="GB"?"≥ 64":"≥ 1"} value={num} onChange={handleNum} list={`sl-${unit}`} className="flex-1 bg-transparent px-3 py-2 text-sm outline-none min-w-0"/>
        <datalist id={`sl-${unit}`}>{sugg.map(s=><option key={s} value={s}/>)}</datalist>
        <select value={unit} onChange={handleUnit} className="bg-[#2a2a2a] border-l border-white/10 px-2 py-2 text-sm outline-none text-white/70 cursor-pointer"><option value="GB">GB</option><option value="TB">TB</option></select>
      </div>
      {error?<p className="text-red-400 text-xs mt-1">{error}</p>:<p className="text-white/20 text-xs mt-1">{unit==="GB"?"Tối thiểu 64GB":"Tối thiểu 1TB"}</p>}
    </div>
  );
}
function RamField({value,onChange,error}){
  const parse=val=>{if(!val)return"";const m=String(val).trim().match(/^(\d+(?:\.\d+)?)\s*GB$/i);return m?m[1]:val.replace(/GB/i,"").trim();};
  const[num,setNum]=useState(()=>parse(value));
  useEffect(()=>{setNum(parse(value));},[value]); // eslint-disable-line
  const handleNum=e=>{const v=e.target.value.replace(/[^0-9]/g,"");setNum(v);onChange(v?`${v}GB`:"");};
  return(
    <div>
      <div className={`flex items-center border rounded-lg overflow-hidden transition ${error?"border-red-500/50":"border-white/10"} bg-white/5`}>
        <input type="text" inputMode="numeric" placeholder="> 4" value={num} onChange={handleNum} list="ram-list" className="flex-1 bg-transparent px-3 py-2 text-sm outline-none min-w-0"/>
        <datalist id="ram-list">{["6","8","12","16","32"].map(s=><option key={s} value={s}/>)}</datalist>
        <span className="bg-[#2a2a2a] border-l border-white/10 px-3 py-2 text-sm text-white/50 select-none">GB</span>
      </div>
      {error?<p className="text-red-400 text-xs mt-1">{error}</p>:<p className="text-white/20 text-xs mt-1">Tối thiểu lớn hơn 4GB</p>}
    </div>
  );
}