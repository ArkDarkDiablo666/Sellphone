/**
 * StatsPanel.js — Bảng thống kê chi tiết cho PhoneZone Admin/Staff
 * Gồm 3 panel:
 *   <ReviewStatsPanel />  — dùng trong tab "reviews"
 *   <ProductStatsPanel /> — dùng trong tab "product"
 *   <VoucherStatsPanel /> — dùng trong tab "voucher"
 *
 * Cách dùng trong Admin.js / Staff.js:
 *   import { ReviewStatsPanel, ProductStatsPanel, VoucherStatsPanel } from "./StatsPanel";
 */

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar
} from "recharts";
import {
  Star, MessageCircle, Package, Ticket, TrendingUp, AlertTriangle,
  CheckCircle, XCircle, BarChart2, RefreshCw, ChevronDown, Award,
  ShoppingBag, ArrowUpRight, Layers
} from "lucide-react";
import { authFetch, AUTH_REDIRECTED } from "./authUtils";
import { API } from "./config";

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────
const ORANGE = "#ff9500", PURPLE = "#bf5af2", CYAN = "#32d7d2";
const GREEN = "#34c759", RED = "#ff3b30", BLUE = "#0a84ff", PINK = "#ff2d78";
const BRAND = [ORANGE, PURPLE, CYAN, GREEN, PINK, BLUE, "#ffd60a", "#30d158", "#64d2ff", "#ff9f0a"];

const fmt  = n => Number(n || 0).toLocaleString("vi-VN");
const fmtP = n => `${fmt(n)}đ`;
const pctColor = n => n >= 80 ? GREEN : n >= 50 ? ORANGE : RED;

// ─────────────────────────────────────────
// Shared UI helpers
// ─────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color = ORANGE, alert }) {
  return (
    <div className="rounded-2xl border border-white/5 p-4 flex flex-col gap-2" style={{ background: "#111" }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/40 font-medium uppercase tracking-wider">{label}</span>
        <div className="w-7 h-7 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-white/35">{sub}</p>}
      {alert && (
        <p className="text-xs font-medium flex items-center gap-1" style={{ color: RED }}>
          <AlertTriangle size={10} /> {alert}
        </p>
      )}
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest">{children}</h3>
      {action}
    </div>
  );
}

function ChartBox({ children, height = 220 }) {
  return (
    <div className="rounded-2xl border border-white/5 p-4" style={{ background: "#111", height }}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

function SelectYear({ value, onChange }) {
  const cur = new Date().getFullYear();
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none rounded-xl px-3 pr-6 py-1.5 text-xs border outline-none cursor-pointer"
        style={{ background: "#222", borderColor: "rgba(255,255,255,0.1)", color: "white" }}>
        <option value="">Tất cả</option>
        {Array.from({ length: 5 }, (_, i) => cur - i).map(y =>
          <option key={y} value={y}>{y}</option>
        )}
      </select>
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
    </div>
  );
}

function SelectMonth({ value, onChange }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none rounded-xl px-3 pr-6 py-1.5 text-xs border outline-none cursor-pointer"
        style={{ background: "#222", borderColor: "rgba(255,255,255,0.1)", color: "white" }}>
        <option value="">Cả năm</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
          <option key={m} value={m}>Tháng {m}</option>
        )}
      </select>
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 px-3 py-2 text-xs shadow-2xl" style={{ background: "#1a1a1a", minWidth: 130 }}>
      <p className="text-white/50 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/60">{p.name}:</span>
          <span className="text-white font-semibold ml-auto pl-2">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// REVIEW STATS PANEL
// ══════════════════════════════════════════════════════════════
export function ReviewStatsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (year)  params.set("year", year);
      if (month) params.set("month", month);
      const r = await authFetch(`${API}/api/stats/reviews/?${params}`, {}, "admin");
      if (!r || r === AUTH_REDIRECTED) return;
      const d = await r.json();
      setData(d);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (!data) return null;

  const answerPctRv = data.total_reviews > 0
    ? Math.round(data.answered_reviews / data.total_reviews * 100) : 0;
  const answerPctCm = data.total_comments > 0
    ? Math.round(data.answered_comments / data.total_comments * 100) : 0;

  const starData = data.stars.map(s => ({
    name: `${s.star}★`,
    count: s.count,
    fill: s.star === 5 ? GREEN : s.star === 4 ? ORANGE : s.star === 3 ? CYAN : s.star <= 2 ? RED : PURPLE,
  }));

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-white/40 font-medium uppercase tracking-widest mr-auto">📊 Thống kê</span>
        <SelectYear value={year} onChange={setYear} />
        <SelectMonth value={month} onChange={setMonth} />
        <button onClick={load}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition">
          <RefreshCw size={13} className="text-white/40" />
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Tổng đánh giá" value={fmt(data.total_reviews)} icon={Star} color={ORANGE}
          sub={`Đã trả lời: ${data.answered_reviews}`} />
        <KpiCard label="Tổng bình luận" value={fmt(data.total_comments)} icon={MessageCircle} color={PURPLE}
          sub={`Đã trả lời: ${data.answered_comments}`} />
        <KpiCard label="Chưa trả lời" value={fmt(data.unanswered)} icon={AlertTriangle}
          color={data.unanswered > 0 ? RED : GREEN}
          alert={data.unanswered > 0 ? "Cần xử lý" : undefined}
          sub={data.unanswered === 0 ? "Tất cả đã trả lời ✓" : undefined} />
        <KpiCard label="Điểm TB" value={`${data.avg_rating} ★`} icon={Award} color={ORANGE}
          sub={`Từ ${fmt(data.total_reviews)} đánh giá`} />
      </div>

      {/* Rate bars */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/5 p-4" style={{ background: "#111" }}>
          <p className="text-xs text-white/40 mb-3">Tỉ lệ trả lời đánh giá</p>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${answerPctRv}%`, background: pctColor(answerPctRv) }} />
            </div>
            <span className="text-sm font-bold tabular-nums w-10 text-right"
              style={{ color: pctColor(answerPctRv) }}>{answerPctRv}%</span>
          </div>
          <p className="text-xs text-white/30">{data.answered_reviews}/{data.total_reviews} đánh giá</p>
        </div>
        <div className="rounded-2xl border border-white/5 p-4" style={{ background: "#111" }}>
          <p className="text-xs text-white/40 mb-3">Tỉ lệ trả lời bình luận</p>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${answerPctCm}%`, background: pctColor(answerPctCm) }} />
            </div>
            <span className="text-sm font-bold tabular-nums w-10 text-right"
              style={{ color: pctColor(answerPctCm) }}>{answerPctCm}%</span>
          </div>
          <p className="text-xs text-white/30">{data.answered_comments}/{data.total_comments} bình luận</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Star distribution */}
        <div>
          <SectionTitle>Phân phối sao</SectionTitle>
          <div className="rounded-2xl border border-white/5 p-4" style={{ background: "#111" }}>
            <div className="flex flex-col gap-2">
              {[...starData].reverse().map(s => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="text-xs text-white/50 w-6 shrink-0">{s.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${data.total_reviews > 0 ? (s.count / data.total_reviews * 100) : 0}%`,
                        background: s.fill
                      }} />
                  </div>
                  <span className="text-xs text-white/40 w-8 text-right tabular-nums">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top products by review count */}
        <div>
          <SectionTitle>Top sản phẩm được đánh giá</SectionTitle>
          <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#111" }}>
            {data.top_products.length === 0
              ? <div className="py-6 text-center text-white/20 text-xs">Chưa có dữ liệu</div>
              : data.top_products.map((p, i) => (
                <div key={p.pid} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition">
                  <span className="text-xs font-bold w-4 shrink-0" style={{ color: BRAND[i] }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 truncate">{p.pname}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} size={8}
                          fill={n <= Math.round(p.avg_r) ? "#f59e0b" : "none"}
                          stroke={n <= Math.round(p.avg_r) ? "#f59e0b" : "#ffffff20"}
                          strokeWidth={1.5} />
                      ))}
                      <span className="text-[10px] text-white/30 ml-1">{Number(p.avg_r).toFixed(1)}</span>
                    </div>
                  </div>
                  <span className="text-xs text-white/40 shrink-0">{p.count} đánh giá</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Trend chart */}
      {data.trend.length > 0 && (
        <div>
          <SectionTitle>Xu hướng theo tháng</SectionTitle>
          <div className="rounded-2xl border border-white/5 p-4" style={{ background: "#111" }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} width={25} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.4)", paddingTop: 8 }} />
                <Bar dataKey="reviews" name="Đánh giá" fill={ORANGE} radius={[3, 3, 0, 0]} />
                <Bar dataKey="comments" name="Bình luận" fill={PURPLE} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ALL VARIANT STOCK TABLE — bảng tồn kho đầy đủ, có tìm kiếm
// ══════════════════════════════════════════════════════════════
function AllVariantStockTable() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [sortBy, setSortBy]     = useState("stock_desc"); // stock_desc | stock_asc | name_asc
  const [filterStock, setFilterStock] = useState("all"); // all | low | out | ok

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch(`${API}/api/product/list/`, {}, "admin");
      if (!r || r === AUTH_REDIRECTED) return;
      const d = await r.json();
      setProducts(d.products || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Flatten tất cả biến thể
  const allRows = products.flatMap(p =>
    (p.variants || []).map(v => ({
      pid:     p.id,
      pname:   p.name,
      brand:   p.brand,
      vid:     v.id,
      color:   v.color,
      storage: v.storage,
      ram:     v.ram,
      price:   v.price,
      stock:   v.stock ?? 0,
    }))
  );

  const maxStock = Math.max(...allRows.map(r => r.stock), 1);

  // Filter
  const filtered = allRows.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.pname.toLowerCase().includes(q) ||
      (r.color || "").toLowerCase().includes(q) ||
      (r.storage || "").toLowerCase().includes(q) ||
      (r.brand || "").toLowerCase().includes(q);
    const matchStock =
      filterStock === "all" ? true :
      filterStock === "out" ? r.stock === 0 :
      filterStock === "low" ? r.stock > 0 && r.stock <= 5 :
      filterStock === "ok"  ? r.stock > 5 : true;
    return matchSearch && matchStock;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) =>
    sortBy === "stock_desc" ? b.stock - a.stock :
    sortBy === "stock_asc"  ? a.stock - b.stock :
    a.pname.localeCompare(b.pname)
  );

  const totalStock  = filtered.reduce((s, r) => s + r.stock, 0);
  const outCount    = filtered.filter(r => r.stock === 0).length;
  const lowCount    = filtered.filter(r => r.stock > 0 && r.stock <= 5).length;

  return (
    <div>
      <SectionTitle>
        🗃️ Tồn kho tất cả biến thể
        <span className="text-[10px] font-normal text-white/30 normal-case ml-2">
          {filtered.length} biến thể · tổng {Number(totalStock).toLocaleString("vi-VN")} sp
        </span>
      </SectionTitle>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm sản phẩm, màu, bộ nhớ..."
            className="w-full rounded-xl px-3 py-1.5 text-xs outline-none border"
            style={{ background: "#1a1a1a", borderColor: "rgba(255,255,255,0.08)", color: "white" }}
          />
        </div>

        {/* Filter stock */}
        <div className="relative">
          <select value={filterStock} onChange={e => setFilterStock(e.target.value)}
            className="appearance-none rounded-xl px-3 pr-6 py-1.5 text-xs border outline-none cursor-pointer"
            style={{ background: "#222", borderColor: "rgba(255,255,255,0.1)", color: "white" }}>
            <option value="all">Tất cả</option>
            <option value="ok">Còn hàng (&gt;5)</option>
            <option value="low">Sắp hết (1–5)</option>
            <option value="out">Hết hàng (0)</option>
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
        </div>

        {/* Sort */}
        <div className="relative">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="appearance-none rounded-xl px-3 pr-6 py-1.5 text-xs border outline-none cursor-pointer"
            style={{ background: "#222", borderColor: "rgba(255,255,255,0.1)", color: "white" }}>
            <option value="stock_desc">Tồn kho giảm dần</option>
            <option value="stock_asc">Tồn kho tăng dần</option>
            <option value="name_asc">Tên A–Z</option>
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
        </div>

        <button onClick={load}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition shrink-0">
          <RefreshCw size={13} className="text-white/40" />
        </button>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {[
          { label: `${outCount} hết hàng`, color: RED,    show: outCount > 0 },
          { label: `${lowCount} sắp hết`,  color: ORANGE, show: lowCount > 0 },
          { label: `${filtered.length - outCount - lowCount} còn hàng`, color: CYAN, show: true },
        ].filter(b => b.show).map((b, i) => (
          <span key={i} className="text-[10px] px-2.5 py-1 rounded-full font-medium"
            style={{ background: `${b.color}18`, border: `1px solid ${b.color}30`, color: b.color }}>
            {b.label}
          </span>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#111" }}>
          {/* Header */}
          <div className="grid px-4 py-2.5 border-b border-white/5 text-[10px] text-white/30 uppercase tracking-wider"
            style={{ gridTemplateColumns: "2fr 1fr 1fr 2fr 64px" }}>
            <span>Sản phẩm</span>
            <span>Màu / RAM</span>
            <span>Bộ nhớ</span>
            <span>Tồn kho</span>
            <span className="text-right">SL</span>
          </div>

          {sorted.length === 0 ? (
            <div className="py-8 text-center text-white/20 text-xs">Không có biến thể nào</div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">
              {sorted.map((item, i) => {
                const pct      = maxStock > 0 ? Math.round((item.stock / maxStock) * 100) : 0;
                const barColor = item.stock === 0  ? RED    :
                                 item.stock <= 5   ? ORANGE :
                                 item.stock <= 20  ? PURPLE : CYAN;
                const isOut = item.stock === 0;
                const isLow = item.stock > 0 && item.stock <= 5;
                return (
                  <div key={`${item.vid}-${i}`}
                    className="grid px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition items-center gap-2"
                    style={{
                      gridTemplateColumns: "2fr 1fr 1fr 2fr 64px",
                      background: isOut ? "rgba(255,59,48,0.03)" : isLow ? "rgba(255,149,0,0.03)" : undefined,
                    }}>
                    {/* Tên SP */}
                    <div className="min-w-0">
                      <p className="text-xs text-white/75 truncate font-medium">{item.pname}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {item.brand || ""} · #{item.pid}
                      </p>
                    </div>
                    {/* Màu / RAM */}
                    <div className="min-w-0">
                      {item.color && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md"
                          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                          {item.color}
                        </span>
                      )}
                      {item.ram && (
                        <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{item.ram}</p>
                      )}
                    </div>
                    {/* Bộ nhớ */}
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {item.storage || "—"}
                    </p>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: isOut ? "100%" : `${pct}%`, background: barColor, opacity: isOut ? 0.5 : 1 }} />
                      </div>
                      {(isOut || isLow) && (
                        <AlertTriangle size={9} style={{ color: barColor, flexShrink: 0 }} />
                      )}
                    </div>
                    {/* Số lượng */}
                    <p className="text-sm font-bold tabular-nums text-right" style={{ color: barColor }}>
                      {isOut ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                          style={{ background: `${RED}18`, color: RED }}>Hết</span>
                      ) : (
                        Number(item.stock).toLocaleString("vi-VN")
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PRODUCT STATS PANEL
// ══════════════════════════════════════════════════════════════
export function ProductStatsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch(`${API}/api/stats/products/`, {}, "admin");
      if (!r || r === AUTH_REDIRECTED) return;
      const d = await r.json();
      setData(d);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (!data) return null;

  const catChartData = (data.by_category || []).map((c, i) => ({
    name: c.cat_name || "Không rõ",
    sản_phẩm: c.product_count || 0,
    tồn_kho: c.total_stock || 0,
    fill: BRAND[i % BRAND.length],
  }));

  const brandPieData = (data.by_brand || []).map((b, i) => ({
    name: b.brand || "Không rõ",
    value: b.count,
    fill: BRAND[i % BRAND.length],
  }));

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/40 font-medium uppercase tracking-widest mr-auto">📦 Thống kê kho hàng</span>
        <button onClick={load}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition">
          <RefreshCw size={13} className="text-white/40" />
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Sản phẩm" value={fmt(data.total_products)} icon={Package} color={ORANGE} />
        <KpiCard label="Biến thể" value={fmt(data.total_variants)} icon={Layers} color={PURPLE} />
        <KpiCard label="Tổng tồn kho" value={fmt(data.total_stock)} icon={ShoppingBag} color={CYAN} />
        <KpiCard label="Sắp hết hàng"
          value={fmt(data.low_stock)} icon={AlertTriangle} color={ORANGE}
          alert={data.low_stock > 0 ? `≤ 5 sản phẩm` : undefined} />
        <KpiCard label="Hết hàng"
          value={fmt(data.out_of_stock)} icon={XCircle}
          color={data.out_of_stock > 0 ? RED : GREEN}
          alert={data.out_of_stock > 0 ? "Cần nhập hàng" : undefined} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Category bar */}
        <div>
          <SectionTitle>Phân phối theo danh mục</SectionTitle>
          <div className="rounded-2xl border border-white/5 p-4" style={{ background: "#111" }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={catChartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="sản_phẩm" name="Sản phẩm" fill={ORANGE} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Brand pie */}
        <div>
          <SectionTitle>Phân phối theo hãng (Top 10)</SectionTitle>
          <div className="rounded-2xl border border-white/5 p-4 flex items-center gap-4" style={{ background: "#111", height: 232 }}>
            <ResponsiveContainer width="55%" height="100%">
              <PieChart>
                <Pie data={brandPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80}
                  paddingAngle={2} dataKey="value">
                  {brandPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-40 pr-1 w-[45%]">
              {brandPieData.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: b.fill }} />
                  <span className="text-[10px] text-white/50 truncate flex-1">{b.name}</span>
                  <span className="text-[10px] text-white/30 shrink-0">{b.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Low stock alert */}
      {data.low_stock_items.length > 0 && (
        <div>
          <SectionTitle>
            ⚠️ Sản phẩm sắp hết hàng
            <span className="text-xs font-normal text-orange-400/60 normal-case">(≤ 5 sp)</span>
          </SectionTitle>
          <div className="rounded-2xl border border-orange-500/20 overflow-hidden" style={{ background: "#111" }}>
            <div className="grid grid-cols-4 px-4 py-2.5 border-b border-white/5 text-[10px] text-white/30 uppercase tracking-wider">
              <span className="col-span-2">Biến thể</span><span>Màu / Bộ nhớ</span><span className="text-right">Tồn kho</span>
            </div>
            {data.low_stock_items.map((item, i) => (
              <div key={i} className="grid grid-cols-4 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition items-center">
                <div className="col-span-2">
                  <p className="text-xs text-white/70 truncate">{item.pname}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">#{item.pid}</p>
                </div>
                <p className="text-xs text-white/40">{[item.color, item.storage].filter(Boolean).join(" · ") || "—"}</p>
                <p className="text-xs font-bold text-right"
                  style={{ color: item.stock <= 2 ? RED : ORANGE }}>{item.stock}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Thống kê tồn kho từng sản phẩm ── */}
      {data.top_stock && data.top_stock.length > 0 && (
        <div>
          <SectionTitle>📊 Tồn kho từng sản phẩm (Top 10 cao nhất)</SectionTitle>
          <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#111" }}>
            {/* Header */}
            <div className="grid px-4 py-2.5 border-b border-white/5 text-[10px] text-white/30 uppercase tracking-wider"
              style={{ gridTemplateColumns: "2fr 1fr 1fr 2fr 60px" }}>
              <span>Sản phẩm</span>
              <span>Màu / Bộ nhớ</span>
              <span>Giá bán</span>
              <span>Tồn kho</span>
              <span className="text-right">Số lượng</span>
            </div>

            {(() => {
              const maxStock = Math.max(...data.top_stock.map(i => i.stock || 0), 1);
              return data.top_stock.map((item, i) => {
                const pct = Math.round((item.stock / maxStock) * 100);
                const barColor = item.stock > 50 ? CYAN : item.stock > 20 ? ORANGE : item.stock > 5 ? PURPLE : RED;
                return (
                  <div key={i}
                    className="grid px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition items-center gap-2"
                    style={{ gridTemplateColumns: "2fr 1fr 1fr 2fr 60px" }}>
                    {/* Tên */}
                    <div>
                      <p className="text-xs text-white/75 truncate font-medium">{item.pname}</p>
                      <p className="text-[10px] text-white/25 mt-0.5">#{item.pid}</p>
                    </div>
                    {/* Màu / Bộ nhớ */}
                    <p className="text-xs text-white/40 truncate">
                      {[item.color, item.storage].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {/* Giá */}
                    <p className="text-xs text-white/50 tabular-nums">
                      {item.price ? `${Number(item.price).toLocaleString("vi-VN")}đ` : "—"}
                    </p>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      <span className="text-[10px] tabular-nums shrink-0" style={{ color: "rgba(255,255,255,0.3)", minWidth: 28, textAlign: "right" }}>
                        {pct}%
                      </span>
                    </div>
                    {/* Số lượng */}
                    <p className="text-sm font-bold tabular-nums text-right" style={{ color: barColor }}>
                      {Number(item.stock).toLocaleString("vi-VN")}
                    </p>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ── Danh sách tất cả biến thể (có thể tìm kiếm) ── */}
      <AllVariantStockTable />

      {/* Top rated */}
      {data.top_rated.length > 0 && (
        <div>
          <SectionTitle>🏆 Sản phẩm được đánh giá cao nhất</SectionTitle>
          <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#111" }}>
            {data.top_rated.map((p, i) => (
              <div key={p.pid} className="flex items-center gap-4 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition">
                <span className="text-xs font-bold w-4 shrink-0" style={{ color: BRAND[i] }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 truncate">{p.pname}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} size={9}
                        fill={n <= Math.round(p.avg_r) ? "#f59e0b" : "none"}
                        stroke={n <= Math.round(p.avg_r) ? "#f59e0b" : "#ffffff20"}
                        strokeWidth={1.5} />
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold" style={{ color: ORANGE }}>{p.avg_r.toFixed(1)}</p>
                  <p className="text-[10px] text-white/30">{p.count} đánh giá</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VOUCHER STATS PANEL
// ══════════════════════════════════════════════════════════════
export function VoucherStatsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch(`${API}/api/stats/vouchers/`, {}, "admin");
      if (!r || r === AUTH_REDIRECTED) return;
      const d = await r.json();
      setData(d);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (!data) return null;

  const scopeLabels = { all: "Toàn cửa hàng", category: "Danh mục", product: "Sản phẩm", variant: "Biến thể" };
  const typeLabels  = { percent: "Phần trăm", fixed: "Số tiền cố định" };

  const scopePie = data.by_scope.map((s, i) => ({
    name: scopeLabels[s.Scope] || s.Scope,
    value: s.count,
    fill: BRAND[i],
  }));

  const usageRatio = data.total_limit > 0
    ? Math.round(data.total_used / data.total_limit * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/40 font-medium uppercase tracking-widest mr-auto">🎟 Thống kê Voucher</span>
        <button onClick={load}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition">
          <RefreshCw size={13} className="text-white/40" />
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Tổng voucher" value={fmt(data.total)} icon={Ticket} color={ORANGE} />
        <KpiCard label="Đang hoạt động" value={fmt(data.active)} icon={CheckCircle} color={GREEN} />
        <KpiCard label="Hết hạn / Tắt" value={fmt(data.inactive + data.expired)} icon={XCircle}
          color={RED} alert={(data.inactive + data.expired) > 0 ? undefined : undefined} />
        <KpiCard label="Đã dùng cạn" value={fmt(data.exhausted)} icon={AlertTriangle}
          color={data.exhausted > 0 ? ORANGE : GREEN} />
      </div>

      {/* Usage rate */}
      <div className="rounded-2xl border border-white/5 p-4" style={{ background: "#111" }}>
        <p className="text-xs text-white/40 mb-2">Tổng lượt dùng / Hạn mức</p>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(usageRatio, 100)}%`, background: pctColor(100 - usageRatio) }} />
          </div>
          <span className="text-sm font-bold tabular-nums w-10 text-right"
            style={{ color: ORANGE }}>{usageRatio}%</span>
        </div>
        <p className="text-xs text-white/30">{fmt(data.total_used)} / {fmt(data.total_limit)} lượt ({data.no_limit} voucher không giới hạn)</p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Scope pie */}
        <div>
          <SectionTitle>Phân loại theo phạm vi</SectionTitle>
          <div className="rounded-2xl border border-white/5 p-4 flex items-center gap-4" style={{ background: "#111", height: 200 }}>
            <ResponsiveContainer width="55%" height="100%">
              <PieChart>
                <Pie data={scopePie} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                  paddingAngle={3} dataKey="value">
                  {scopePie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2">
              {scopePie.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.fill }} />
                  <span className="text-[10px] text-white/50">{s.name}</span>
                  <span className="text-[10px] text-white/30 ml-auto pl-3">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Type breakdown */}
        <div>
          <SectionTitle>Loại giảm giá</SectionTitle>
          <div className="rounded-2xl border border-white/5 p-4 flex flex-col gap-3 justify-center" style={{ background: "#111", minHeight: 200 }}>
            {data.by_type.map((t, i) => {
              const total = data.by_type.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? Math.round(t.count / total * 100) : 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-white/50">{typeLabels[t.Type] || t.Type}</span>
                    <span className="text-xs font-semibold" style={{ color: BRAND[i] }}>{t.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: BRAND[i] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Near expiry alert */}
      {data.near_expiry.length > 0 && (
        <div>
          <SectionTitle>
            ⏰ Sắp hết hạn
            <span className="text-xs font-normal text-orange-400/60 normal-case ml-2">(trong 7 ngày)</span>
          </SectionTitle>
          <div className="rounded-2xl border border-orange-500/20 overflow-hidden" style={{ background: "#111" }}>
            {data.near_expiry.map((v, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-orange-400">{v.Code}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    {v.Type === "percent" ? `Giảm ${v.Value}%` : `Giảm ${fmtP(v.Value)}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-white/50">Hết hạn: <span className="text-orange-400">{v.EndDate}</span></p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    {v.UsedCount}/{v.UsageLimit ?? "∞"} lượt
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top used */}
      {data.top_used.length > 0 && (
        <div>
          <SectionTitle>🏆 Voucher dùng nhiều nhất</SectionTitle>
          <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#111" }}>
            <div className="grid grid-cols-4 px-4 py-2.5 border-b border-white/5 text-[10px] text-white/30 uppercase tracking-wider">
              <span>Mã</span><span>Loại / Giá trị</span><span>Lượt dùng</span><span className="text-right">Còn lại</span>
            </div>
            {data.top_used.map((v, i) => (
              <div key={i} className="grid grid-cols-4 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition items-center">
                <span className="text-xs font-mono text-orange-400 truncate">{v.Code}</span>
                <span className="text-xs text-white/50">
                  {v.Type === "percent" ? `${v.Value}%` : fmtP(v.Value)}
                </span>
                <div>
                  <span className="text-xs font-semibold">{v.UsedCount}</span>
                  {v.usage_pct !== null && (
                    <div className="mt-1 h-1 rounded-full bg-white/5 w-16 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(v.usage_pct, 100)}%`, background: ORANGE }} />
                    </div>
                  )}
                </div>
                <span className="text-xs text-white/40 text-right">
                  {v.UsageLimit ? `${v.UsageLimit - v.UsedCount} còn lại` : "∞"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}