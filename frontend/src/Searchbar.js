import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8000";

const fmt = (n) =>
  n != null ? n.toLocaleString("vi-VN") + "đ" : null;

// ─── Stars mini ───────────────────────────────────────────────────────────────
function Stars({ value }) {
  const v = Math.round(value || 0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill={n <= v ? "#f59e0b" : "none"}
          stroke="#f59e0b"
          strokeWidth="2"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 16 }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="border-2 border-white/10 border-t-orange-400 rounded-full animate-spin shrink-0"
    />
  );
}

// ─── Product card dùng trong kết quả / fallback ───────────────────────────────
function ResultCard({ product, badge, onClick }) {
  return (
    <div
      onClick={onClick}
      className="group flex flex-col rounded-2xl overflow-hidden border border-white/[0.07] cursor-pointer
        bg-white/[0.03] hover:border-orange-500/40 hover:bg-white/[0.06]
        transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative h-[130px] bg-white/[0.03] overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-white/10">
            📱
          </div>
        )}
        {badge && (
          <span className="absolute top-2 left-2 text-[9px] font-bold tracking-wider
            px-2 py-0.5 rounded-full bg-orange-500 text-white leading-tight">
            {badge}
          </span>
        )}
      </div>
      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        {product.brand && (
          <span className="text-[10px] text-orange-400/70 font-semibold uppercase tracking-wider">
            {product.brand}
          </span>
        )}
        <p className="text-xs font-semibold text-white/90 leading-snug line-clamp-2">
          {product.name}
        </p>
        {product.rating_avg > 0 && (
          <div className="flex items-center gap-1.5">
            <Stars value={product.rating_avg} />
            <span className="text-[10px] text-white/30">({product.rating_count})</span>
          </div>
        )}
        {product.min_price != null && (
          <p className="text-xs font-bold text-[#ff3b30] mt-auto pt-1">
            {fmt(product.min_price)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Autocomplete item ────────────────────────────────────────────────────────
function SuggestionItem({ text, query, onClick }) {
  // Bold phần match
  const parts = text.split(new RegExp(`(${query})`, "gi"));
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer
        hover:bg-white/[0.05] transition text-sm text-white/60 hover:text-white/90"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" className="text-white/20 shrink-0">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <span>
        {parts.map((p, i) =>
          p.toLowerCase() === query.toLowerCase()
            ? <mark key={i} className="bg-orange-500/20 text-orange-400 rounded-sm not-italic">{p}</mark>
            : <span key={i}>{p}</span>
        )}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SearchBar
// ═══════════════════════════════════════════════════════════════════════════════

export default function SearchBar({ embedded = false, onClose }) {
  const navigate = useNavigate();

  const [query,    setQuery]    = useState("");
  const [suggests, setSuggests] = useState([]);
  const [results,  setResults]  = useState(null);   // null = chưa search
  const [fallback, setFallback] = useState(false);
  const [suggest4, setSuggest4] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [imgLoad,  setImgLoad]  = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [imgPreview, setImgPreview] = useState(null);

  const inputRef  = useRef(null);
  const wrapRef   = useRef(null);
  const fileRef   = useRef(null);
  const debounce  = useRef(null);

  useEffect(() => {
    if (embedded) setTimeout(() => inputRef.current?.focus(), 50);
  }, [embedded]);

  // Close dropdown khi click ngoài
  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setDropOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Autocomplete ──────────────────────────────────────────────────────────
  const fetchSuggests = useCallback(async (q) => {
    if (q.length < 2) { setSuggests([]); return; }
    try {
      const r = await fetch(`${API}/api/search/suggestions/?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      setSuggests(d.suggestions || []);
    } catch { setSuggests([]); }
  }, []);

  const onInput = (e) => {
    const q = e.target.value;
    setQuery(q);
    setDropOpen(true);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchSuggests(q), 280);
    if (!q.trim()) { setResults(null); setImgPreview(null); }
  };

  // ── Text search ───────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setDropOpen(false);
    setImgPreview(null);
    try {
      const r = await fetch(`${API}/api/search/text/?q=${encodeURIComponent(q)}&limit=24`);
      const d = await r.json();
      setResults(d.results || []);
      setFallback(d.fallback || false);
      setSuggest4(d.suggestions || []);
    } catch { setResults([]); }
    finally   { setLoading(false); }
  }, [query]);

  const onKeyDown = (e) => {
    if (e.key === "Enter") doSearch();
    if (e.key === "Escape") { setDropOpen(false); onClose?.(); }
  };

  const onSuggestClick = (item) => {
    setQuery(item.name);
    setSuggests([]);
    setDropOpen(false);
    doSearch(item.name);
  };

  // ── Image search ──────────────────────────────────────────────────────────
  const handleImage = async (file) => {
    if (!file) return;
    setImgPreview(URL.createObjectURL(file));
    setQuery("");
    setImgLoad(true);
    setResults(null);
    setDropOpen(false);

    const form = new FormData();
    form.append("file", file);
    try {
      const r = await fetch(`${API}/api/search/image/`, { method: "POST", body: form });
      const d = await r.json();
      setResults(d.results || []);
      setFallback(d.fallback || false);
      setSuggest4(d.suggestions || []);
    } catch { setResults([]); }
    finally   { setImgLoad(false); }
  };

  const clear = () => {
    setQuery(""); setResults(null); setImgPreview(null);
    setSuggests([]); setSuggest4([]); setFallback(false);
    inputRef.current?.focus();
    if (fileRef.current) fileRef.current.value = "";
  };

  const goProduct = (id) => {
    navigate(`/product/${id}`);
    onClose?.();
  };

  const BADGES = ["Bán chạy nhất", "Đánh giá cao nhất", "Giảm giá nhiều nhất", "Xem nhiều nhất"];

  const isLoading = loading || imgLoad;

  return (
    <div className="w-full relative" ref={wrapRef}>

      {/* ── Input bar ── */}
      <div className={`flex items-center bg-white/[0.06] border rounded-2xl overflow-hidden
        transition-all duration-200
        ${dropOpen && suggests.length > 0
          ? "border-orange-500/50 shadow-[0_0_0_3px_rgba(249,115,22,.12)]"
          : "border-white/10 hover:border-white/20"
        }`}
      >
        {/* Icon kính lúp / spinner */}
        <div className="pl-4 pr-2 flex items-center text-white/30">
          {isLoading
            ? <Spinner size={16} />
            : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            )}
        </div>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onFocus={() => query.length >= 2 && setDropOpen(true)}
          placeholder="Tìm điện thoại, thương hiệu, model..."
          className="flex-1 bg-transparent outline-none text-sm text-white/90
            placeholder:text-white/25 py-3 caret-orange-400"
        />

        {/* Clear */}
        {(query || imgPreview) && !isLoading && (
          <button onClick={clear}
            className="p-2 text-white/20 hover:text-white/60 transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Camera */}
        <input
          ref={fileRef} type="file" accept="image/*"
          className="hidden"
          onChange={(e) => handleImage(e.target.files[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          title="Tìm kiếm bằng ảnh"
          className="h-full px-3 border-l border-white/[0.08] text-orange-400/60
            hover:text-orange-400 hover:bg-orange-500/10 transition flex items-center"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>

        {/* Search button */}
        <button
          onClick={() => doSearch()}
          className="h-full px-5 bg-orange-500 hover:bg-orange-600
            text-white text-sm font-semibold transition shrink-0"
        >
          Tìm kiếm
        </button>
      </div>

      {/* ── Autocomplete dropdown ── */}
      {dropOpen && suggests.length > 0 && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-[1000]
          bg-[#161616] border border-white/[0.09] rounded-2xl overflow-hidden
          shadow-[0_8px_32px_rgba(0,0,0,.5)]">
          {suggests.map((s) => (
            <SuggestionItem
              key={s.id}
              text={s.name}
              query={query}
              onClick={() => onSuggestClick(s)}
            />
          ))}
        </div>
      )}

      {/* ── Image preview bar ── */}
      {imgPreview && (
        <div className="mt-2.5 flex items-center gap-3 px-4 py-2.5
          bg-white/[0.04] border border-white/[0.07] rounded-xl">
          <img src={imgPreview} alt=""
            className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0" />
          <p className="text-xs text-white/40 flex-1">
            {imgLoad ? "Đang phân tích ảnh..." : "Tìm kiếm theo ảnh"}
          </p>
          {!imgLoad && (
            <button onClick={clear}
              className="text-white/20 hover:text-white/60 transition">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* ── Results ── */}
      {results !== null && !isLoading && (
        <div className="mt-4">
          {results.length > 0 ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <p className="text-xs text-white/40 flex-1">
                  Tìm thấy{" "}
                  <span className="text-white/80 font-semibold">{results.length}</span>{" "}
                  sản phẩm
                  {query && (
                    <> cho <span className="text-orange-400">"{query}"</span></>
                  )}
                </p>
                <button
                  onClick={() => navigate(`/search?q=${encodeURIComponent(query)}`)}
                  className="text-xs text-orange-400 hover:text-orange-300 transition
                    flex items-center gap-1"
                >
                  Xem tất cả
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>
              {/* Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {results.slice(0, 12).map((p) => (
                  <ResultCard key={p.id} product={p} onClick={() => goProduct(p.id)} />
                ))}
              </div>
            </>
          ) : (
            /* ── Fallback ── */
            <div>
              <div className="text-center py-6">
                <p className="text-2xl mb-2">🔍</p>
                <p className="text-sm text-white/50">
                  Không tìm thấy kết quả{query && <> cho <span className="text-white/80 font-medium">"{query}"</span></>}
                </p>
                <p className="text-xs text-white/25 mt-1">
                  Có thể bạn sẽ thích những sản phẩm này
                </p>
              </div>

              {suggest4.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                  {suggest4.map((p, i) => (
                    <ResultCard
                      key={p.id}
                      product={p}
                      badge={BADGES[i]}
                      onClick={() => goProduct(p.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH MODAL — full-screen overlay
// ═══════════════════════════════════════════════════════════════════════════════

export function SearchModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center
        bg-black/70 backdrop-blur-md"
      style={{ paddingTop: 72 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Panel */}
      <div
        className="w-full max-w-3xl mx-4 bg-[#111115] border border-white/[0.09]
          rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,.7)]
          max-h-[calc(100vh-88px)] overflow-y-auto"
        style={{ animation: "searchModalIn .18s ease" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.07]">
          <div className="flex-1">
            <SearchBar embedded onClose={onClose} />
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.09]
              hover:bg-white/[0.10] flex items-center justify-center text-white/40
              hover:text-white/80 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="p-5" />
      </div>

      <style>{`
        @keyframes searchModalIn {
          from { opacity: 0; transform: translateY(-10px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}