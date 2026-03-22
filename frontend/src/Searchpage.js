import { useState, useEffect, useRef, useCallback } from "react";
import "./animations.css";
import Navbar from "./Navbar";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useCart } from "./Cart";
import Footer from "./Footer";
import {
  ShoppingCart, User, LogOut, Settings, ChevronDown,
  AlertTriangle, ShoppingBag, ArrowLeft, SlidersHorizontal,
  X, Star, Camera, Search as SearchIcon, ChevronRight,
  Package, TrendingUp, Award, Percent, Eye,
} from "lucide-react";

const API = "http://localhost:8000";
const fmt = (n) => n != null ? n.toLocaleString("vi-VN") + "đ" : null;

// ─── StarRow ──────────────────────────────────────────────────────────────────
function StarRow({ value, count }) {
  const v = Math.round(value || 0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={11}
          fill={n <= v ? "#f59e0b" : "none"}
          stroke="#f59e0b" strokeWidth={1.5} />
      ))}
      {count > 0 && <span className="text-[10px] text-white/30 ml-0.5">({count})</span>}
    </div>
  );
}

// ─── Product card ─────────────────────────────────────────────────────────────
function ProductCard({ product, badge, badgeIcon: BadgeIcon }) {
  const navigate = useNavigate();
  return (
    <article
      onClick={() => navigate(`/product/${product.id}`)}
      className="group flex flex-col rounded-2xl overflow-hidden cursor-pointer
        border border-white/[0.07] bg-white/[0.03]
        hover:border-orange-500/35 hover:bg-white/[0.055]
        transition-all duration-200 hover:-translate-y-0.5
        shadow-[inset_0_1px_0_rgba(255,255,255,.06)]"
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-white/[0.03]">
        {product.image ? (
          <img src={product.image} alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={40} className="text-white/10" />
          </div>
        )}
        {badge && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1
            bg-orange-500 text-white text-[9px] font-bold tracking-wide
            px-2 py-0.5 rounded-full">
            {BadgeIcon && <BadgeIcon size={8} />}
            {badge}
          </div>
        )}
      </div>
      {/* Body */}
      <div className="p-3.5 flex flex-col gap-1.5 flex-1">
        {product.brand && (
          <span className="text-[10px] font-semibold text-orange-400/70 uppercase tracking-wider">
            {product.brand}
          </span>
        )}
        <h3 className="text-sm font-semibold text-white/90 leading-snug line-clamp-2">
          {product.name}
        </h3>
        {product.rating_avg > 0 && (
          <StarRow value={product.rating_avg} count={product.rating_count} />
        )}
        {product.min_price != null && (
          <p className="mt-auto pt-2 text-sm font-bold text-[#ff3b30]">
            {fmt(product.min_price)}
            {product.max_price && product.max_price !== product.min_price && (
              <span className="text-xs font-normal text-white/25 ml-1">
                – {fmt(product.max_price)}
              </span>
            )}
          </p>
        )}
      </div>
    </article>
  );
}

// ─── Loading skeletons ────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/[0.06] animate-pulse">
      <div className="h-44 bg-white/[0.05]" />
      <div className="p-3.5 flex flex-col gap-2">
        <div className="h-2.5 bg-white/[0.05] rounded-full w-16" />
        <div className="h-3 bg-white/[0.05] rounded-full" />
        <div className="h-3 bg-white/[0.05] rounded-full w-3/4" />
        <div className="h-4 bg-white/[0.05] rounded-full w-1/2 mt-1" />
      </div>
    </div>
  );
}

const FALLBACK_BADGES = [
  { label: "Bán chạy nhất",      icon: TrendingUp },
  { label: "Đánh giá cao nhất",  icon: Award      },
  { label: "Giảm giá nhiều nhất",icon: Percent    },
  { label: "Xem nhiều nhất",     icon: Eye        },
];

const PRICE_RANGES = [
  { label: "Dưới 5 triệu",  min: 0,          max: 5_000_000  },
  { label: "5 – 10 triệu",  min: 5_000_000,  max: 10_000_000 },
  { label: "10 – 20 triệu", min: 10_000_000, max: 20_000_000 },
  { label: "Trên 20 triệu", min: 20_000_000, max: Infinity   },
];
const RAM_OPTIONS     = ["4GB","6GB","8GB","12GB","16GB","32GB"];
const STORAGE_OPTIONS = ["64GB","128GB","256GB","512GB","1TB","2TB"];

// ═══════════════════════════════════════════════════════════════════════════════
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate                        = useNavigate();
  const { totalCount }                  = useCart();

  const q = searchParams.get("q") || "";

  // ── Search state ────────────────────────────────────────────────────────
  const [inputQ,   setInputQ]   = useState(q);
  const [results,  setResults]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [fallback, setFallback] = useState(false);
  const [suggest4, setSuggest4] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [imgMode,  setImgMode]  = useState(false);
  const [imgPrev,  setImgPrev]  = useState(null);
  const fileRef = useRef(null);

  // ── Suggests ────────────────────────────────────────────────────────────
  const [suggests,  setSuggests]  = useState([]);
  const [dropSug,   setDropSug]   = useState(false);
  const debounceRef = useRef(null);
  const inputRef    = useRef(null);
  const inputWrapRef= useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (inputWrapRef.current && !inputWrapRef.current.contains(e.target))
        setDropSug(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Filter / sort ────────────────────────────────────────────────────────
  const [sort,        setSort]        = useState("relevance");
  const [priceRange,  setPriceRange]  = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [brands,      setBrands]      = useState([]);
  const [selectedRams,     setSelectedRams]     = useState([]);
  const [selectedStorages, setSelectedStorages] = useState([]);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const doSearch = useCallback(async (query) => {
    if (!query.trim()) return;
    setLoading(true);
    setImgMode(false);
    setImgPrev(null);
    setSort("relevance");
    setBrandFilter("");
    setPriceRange("");
    setSelectedRams([]);
    setSelectedStorages([]);
    try {
      const r = await fetch(`${API}/api/search/text/?q=${encodeURIComponent(query)}&limit=60`);
      const d = await r.json();
      const raw = d.results || [];
      // dedup by product id — API đôi khi trả về nhiều variant cùng 1 sản phẩm
      const seen = new Set();
      const rs = raw.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      setResults(rs);
      setTotal(d.total || rs.length);
      setFallback(d.fallback || false);
      setSuggest4(d.suggestions || []);
      setBrands([...new Set(rs.map(p => p.brand).filter(Boolean))]);
    } catch { setResults([]); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => {
    if (q) { setInputQ(q); doSearch(q); }
  }, [q]);

  // ── Autocomplete ─────────────────────────────────────────────────────────
  const fetchSuggests = async (v) => {
    if (v.length < 2) { setSuggests([]); return; }
    try {
      const r = await fetch(`${API}/api/search/suggestions/?q=${encodeURIComponent(v)}`);
      const d = await r.json();
      setSuggests(d.suggestions || []);
    } catch { setSuggests([]); }
  };

  const onInputChange = (e) => {
    const v = e.target.value;
    setInputQ(v);
    setDropSug(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggests(v), 280);
  };

  const submitSearch = (val = inputQ) => {
    if (!val.trim()) return;
    setDropSug(false);
    setSuggests([]);
    setSearchParams({ q: val });
  };

  // ── Image search ──────────────────────────────────────────────────────────
  const handleImageFile = async (file) => {
    if (!file) return;
    setImgPrev(URL.createObjectURL(file));
    setImgMode(true);
    setLoading(true);
    setResults([]);
    setSearchParams({});
    setInputQ("");
    setSelectedRams([]);
    setSelectedStorages([]);

    const form = new FormData();
    form.append("file", file);
    try {
      const r = await fetch(`${API}/api/search/image/`, { method: "POST", body: form });
      const d = await r.json();
      const raw2 = d.results || [];
      const seen2 = new Set();
      const rs = raw2.filter(p => { if (seen2.has(p.id)) return false; seen2.add(p.id); return true; });
      setResults(rs);
      setTotal(rs.length);
      setFallback(d.fallback || false);
      setSuggest4(d.suggestions || []);
      setBrands([...new Set(rs.map(p => p.brand).filter(Boolean))]);
    } catch { setResults([]); }
    finally   { setLoading(false); }
  };

  // ── Apply filter / sort ───────────────────────────────────────────────────
  let displayed = [...results];

  if (brandFilter) displayed = displayed.filter(p => p.brand === brandFilter);

  if (priceRange) {
    const range = PRICE_RANGES.find(r => r.label === priceRange);
    if (range) displayed = displayed.filter(p =>
      p.min_price != null &&
      p.min_price >= range.min && p.min_price < range.max
    );
  }

  if (selectedRams.length)
    displayed = displayed.filter(p => (p.variants || []).some(v => selectedRams.includes(v.ram)));

  if (selectedStorages.length)
    displayed = displayed.filter(p => (p.variants || []).some(v => selectedStorages.includes(v.storage)));

  if (sort === "price_asc")  displayed.sort((a, b) => (a.min_price||0) - (b.min_price||0));
  if (sort === "price_desc") displayed.sort((a, b) => (b.min_price||0) - (a.min_price||0));
  if (sort === "rating")     displayed.sort((a, b) => b.rating_avg - a.rating_avg);
  if (sort === "sold")       displayed.sort((a, b) => b.sold - a.sold);

  const toggleItem = (setter, val) => setter(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  const filterActive = brandFilter || priceRange || sort !== "relevance" || selectedRams.length > 0 || selectedStorages.length > 0;

  return (
    <div className="min-h-screen bg-[#1C1C1E] text-white">

      {/* ── Navbar ── */}
      <Navbar />

      {/* ── Page content ── */}
      <div className="pt-[64px]">

        {/* ── Search header ── */}
        <div className="border-b border-white/[0.07] bg-black/30 backdrop-blur-sm sticky top-[64px] z-40 px-10 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">

            {/* Back */}
            <button onClick={() => navigate(-1)}
              className="shrink-0 w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10
                flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.10] transition">
              <ArrowLeft size={15} />
            </button>

            {/* Input with autocomplete */}
            <div className="flex-1 relative" ref={inputWrapRef}>
              <div className="flex items-center bg-white/[0.06] border border-white/10 rounded-xl overflow-hidden
                focus-within:border-orange-500/50 focus-within:shadow-[0_0_0_3px_rgba(249,115,22,.10)] transition-all">
                <div className="pl-3.5 pr-2 text-white/25">
                  <SearchIcon size={15} />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputQ}
                  onChange={onInputChange}
                  onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                  onFocus={() => inputQ.length >= 2 && setDropSug(true)}
                  placeholder="Tìm điện thoại, thương hiệu, model..."
                  className="flex-1 bg-transparent outline-none text-sm text-white/90
                    placeholder:text-white/25 py-2.5 caret-orange-400"
                />
                {inputQ && (
                  <button onClick={() => { setInputQ(""); inputRef.current?.focus(); }}
                    className="p-2 text-white/20 hover:text-white/60 transition">
                    <X size={13} />
                  </button>
                )}
                {/* Camera */}
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => handleImageFile(e.target.files[0])} />
                <button onClick={() => fileRef.current?.click()}
                  title="Tìm bằng ảnh"
                  className="h-full px-3 border-l border-white/[0.07] text-orange-400/50
                    hover:text-orange-400 hover:bg-orange-500/10 transition flex items-center gap-1.5 text-xs">
                  <Camera size={14} />
                </button>
                <button onClick={() => submitSearch()}
                  className="h-full px-4 bg-orange-500 hover:bg-orange-600
                    text-white text-sm font-semibold transition shrink-0">
                  Tìm
                </button>
              </div>

              {/* Autocomplete */}
              {dropSug && suggests.length > 0 && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50
                  bg-[#161616] border border-white/[0.09] rounded-xl overflow-hidden
                  shadow-[0_8px_24px_rgba(0,0,0,.5)]">
                  {suggests.map((s) => (
                    <button key={s.id}
                      onClick={() => { setInputQ(s.name); setDropSug(false); submitSearch(s.name); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm
                        text-white/60 hover:text-white hover:bg-white/[0.05] transition text-left">
                      <SearchIcon size={12} className="text-white/20 shrink-0" />
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Image preview pill */}
            {imgPrev && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                bg-orange-500/10 border border-orange-500/20 shrink-0">
                <img src={imgPrev} alt=""
                  className="w-6 h-6 rounded object-cover" />
                <span className="text-xs text-orange-400">Tìm theo ảnh</span>
                <button onClick={() => { setImgPrev(null); setImgMode(false); }}
                  className="text-orange-400/50 hover:text-orange-400 transition">
                  <X size={11} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Main area ── */}
        <div className="max-w-7xl mx-auto px-10 py-8">

          {loading ? (
            /* Skeleton */
            <div>
              <div className="h-4 bg-white/[0.05] rounded-full w-48 mb-6 animate-pulse" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </div>
          ) : fallback || results.length === 0 ? (
            /* ── No results + fallback ── */
            <div>
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🔍</div>
                <h2 className="text-xl font-bold text-white/80 mb-2">
                  {imgMode
                    ? "Không nhận ra sản phẩm trong ảnh"
                    : `Không tìm thấy "${q}"`}
                </h2>
                <p className="text-white/30 text-sm">
                  Hãy thử từ khóa khác hoặc xem gợi ý bên dưới
                </p>
              </div>

              {suggest4.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">
                    Có thể bạn quan tâm
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {suggest4.map((p, i) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        badge={FALLBACK_BADGES[i]?.label}
                        badgeIcon={FALLBACK_BADGES[i]?.icon}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ── Results ── */
            <div className="flex gap-6 items-start">

              {/* ── Sidebar filter ── */}
              <aside className="w-52 shrink-0 sticky top-[130px]">
                <div className="bg-black/30 border border-white/[0.07] rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <SlidersHorizontal size={14} className="text-orange-400" />
                      Bộ lọc
                      {filterActive && (
                        <span className="bg-orange-500 text-white text-[9px] w-4 h-4
                          rounded-full flex items-center justify-center font-bold">•</span>
                      )}
                    </div>
                    {filterActive && (
                      <button
                        onClick={() => { setSort("relevance"); setBrandFilter(""); setPriceRange(""); setSelectedRams([]); setSelectedStorages([]); }}
                        className="text-[10px] text-white/30 hover:text-red-400 transition flex items-center gap-0.5">
                        <X size={10} /> Xóa
                      </button>
                    )}
                  </div>

                  <div className="p-3 flex flex-col gap-4">
                    {/* Sort */}
                    <div>
                      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">
                        Sắp xếp
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {[
                          { val: "relevance",  label: "Liên quan nhất" },
                          { val: "price_asc",  label: "Giá thấp → cao" },
                          { val: "price_desc", label: "Giá cao → thấp" },
                          { val: "rating",     label: "Đánh giá cao nhất" },
                          { val: "sold",       label: "Bán chạy nhất" },
                        ].map(({ val, label }) => (
                          <button key={val} onClick={() => setSort(val)}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition text-left
                              ${sort === val
                                ? "bg-orange-500/15 text-orange-300 border border-orange-500/30"
                                : "text-white/50 hover:bg-white/[0.05] hover:text-white border border-transparent"
                              }`}>
                            {sort === val && (
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                            )}
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Price */}
                    <div>
                      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">
                        Mức giá
                      </p>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => setPriceRange("")}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition text-left
                            ${priceRange === ""
                              ? "bg-orange-500/15 text-orange-300 border border-orange-500/30"
                              : "text-white/50 hover:bg-white/[0.05] hover:text-white border border-transparent"
                            }`}>
                          Tất cả
                        </button>
                        {PRICE_RANGES.map((r) => (
                          <button key={r.label} onClick={() => setPriceRange(r.label)}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition text-left
                              ${priceRange === r.label
                                ? "bg-orange-500/15 text-orange-300 border border-orange-500/30"
                                : "text-white/50 hover:bg-white/[0.05] hover:text-white border border-transparent"
                              }`}>
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Brand */}
                    {brands.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">
                          Thương hiệu
                        </p>
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => setBrandFilter("")}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition text-left
                              ${brandFilter === ""
                                ? "bg-orange-500/15 text-orange-300 border border-orange-500/30"
                                : "text-white/50 hover:bg-white/[0.05] hover:text-white border border-transparent"
                              }`}>
                            Tất cả
                          </button>
                          {brands.map((b) => (
                            <button key={b} onClick={() => setBrandFilter(b)}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition text-left
                                ${brandFilter === b
                                  ? "bg-orange-500/15 text-orange-300 border border-orange-500/30"
                                  : "text-white/50 hover:bg-white/[0.05] hover:text-white border border-transparent"
                                }`}>
                              {b}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* RAM */}
                    <div>
                      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">
                        RAM
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {RAM_OPTIONS.map((r) => (
                          <button key={r} onClick={() => toggleItem(setSelectedRams, r)}
                            className={`px-2.5 py-1 rounded-lg text-xs border transition
                              ${selectedRams.includes(r)
                                ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                                : "bg-white/5 border-white/10 text-white/40 hover:border-white/30 hover:text-white"}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Storage */}
                    <div>
                      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">
                        Bộ nhớ trong
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {STORAGE_OPTIONS.map((s) => (
                          <button key={s} onClick={() => toggleItem(setSelectedStorages, s)}
                            className={`px-2.5 py-1 rounded-lg text-xs border transition
                              ${selectedStorages.includes(s)
                                ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                                : "bg-white/5 border-white/10 text-white/40 hover:border-white/30 hover:text-white"}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </aside>

              {/* ── Results grid ── */}
              <div className="flex-1 min-w-0">
                {/* Meta bar */}
                <div className="flex items-center gap-3 mb-5 flex-wrap">
                  <p className="text-sm text-white/40">
                    {imgMode
                      ? <span>Tìm kiếm theo ảnh —</span>
                      : <span>Kết quả cho <span className="text-white/70 font-medium">"{q}"</span> —</span>
                    }
                    <span className="text-white/70 font-semibold ml-1">{displayed.length}</span>
                    {displayed.length < total &&
                      <span className="text-white/25"> / {total}</span>
                    } sản phẩm
                  </p>
                </div>

                {displayed.length === 0 ? (
                  <div className="text-center py-16 text-white/20">
                    <Package size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Không có sản phẩm phù hợp với bộ lọc</p>
                    <button
                      onClick={() => { setBrandFilter(""); setPriceRange(""); setSort("relevance"); setSelectedRams([]); setSelectedStorages([]); }}
                      className="mt-3 text-xs text-orange-400 hover:underline">
                      Xóa bộ lọc
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                    {displayed.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}