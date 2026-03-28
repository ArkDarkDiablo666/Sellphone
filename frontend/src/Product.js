import "./animations.css";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useCart } from "./Cart";
import { useNavigate } from "react-router-dom";
import {
  SlidersHorizontal, Search, X, ChevronRight, Package, Tag, Ticket
} from "lucide-react";
import Footer from "./Footer";
import { ToastContainer, useToast } from "./Toast";
import BannerSlider from "./BannerSlider";
import Navbar from "./Navbar";
import { API } from "./config";

function calcDisc(v, price, productId, categoryId, variantId) {
  if (!v || !price) return 0;
  if (v.scope === "category" && v.category_id && String(categoryId) !== String(v.category_id)) return 0;
  if (v.scope === "product") {
    if (v.product_id && String(productId) !== String(v.product_id)) return 0;
    if (v.variant_id && String(variantId) !== String(v.variant_id)) return 0;
  }
  if (price < (v.min_order || 0)) return 0;
  let d = v.type === "percent"
    ? Math.round(price * Math.min(v.value, 100) / 100)
    : Math.min(v.value, price);
  if (v.max_discount) d = Math.min(d, v.max_discount);
  return d;
}

function getBestForVariant(variant, productId, categoryId, voucherList, cartVoucher) {
  const price     = parseFloat(variant.price || 0);
  const variantId = variant.id;
  if (!price) return { finalPrice: 0, discount: 0, voucher: null };
  if (cartVoucher) {
    const d = calcDisc(cartVoucher, price, productId, categoryId, variantId);
    if (d > 0) return { finalPrice: Math.max(0, price - d), discount: d, voucher: cartVoucher };
  }
  let bestVoucher = null, bestDisc = 0;
  for (const vou of voucherList) {
    const d = calcDisc(vou, price, productId, categoryId, variantId);
    if (d > bestDisc) { bestDisc = d; bestVoucher = vou; }
  }
  return {
    finalPrice: bestDisc > 0 ? Math.max(0, price - bestDisc) : price,
    discount:   bestDisc,
    voucher:    bestVoucher,
  };
}

const parseGB = (s) => {
  if (!s) return 0;
  const m = String(s).match(/([\d.]+)\s*(TB|GB|MB)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = (m[2] || "GB").toUpperCase();
  if (u === "TB") return n * 1024;
  if (u === "MB") return n / 1024;
  return n;
};

const PRICE_RANGES = [
  { label: "Dưới 5 triệu",  min: 0,          max: 5_000_000  },
  { label: "5 - 10 triệu",  min: 5_000_000,  max: 10_000_000 },
  { label: "10 - 20 triệu", min: 10_000_000, max: 20_000_000 },
  { label: "Trên 20 triệu", min: 20_000_000, max: Infinity   },
];
const RAM_OPTIONS     = ["4GB","6GB","8GB","12GB","16GB","32GB"];
const STORAGE_OPTIONS = ["64GB","128GB","256GB","512GB","1TB","2TB"];

export default function Product() {
  const navigate = useNavigate();
  const { totalCount, voucher: cartVoucher } = useCart();
  const { toast, toasts, removeToast } = useToast();

  const [products,    setProducts]    = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [voucherList, setVoucherList] = useState([]);

  const [selectedCats,     setSelectedCats]     = useState([]);
  const [selectedPrices,   setSelectedPrices]   = useState([]);
  const [selectedRams,     setSelectedRams]     = useState([]);
  const [selectedStorages, setSelectedStorages] = useState([]);
  const [searchQ,          setSearchQ]          = useState("");
  const [filtered,         setFiltered]         = useState([]);
  const [showVoucherPanel, setShowVoucherPanel] = useState(false);
  const [sortBy, setSortBy] = useState("default");

  const toggleItem = (setter, val) => setter(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);




  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/product/list/`).then(r => r.json()),
      fetch(`${API}/api/category/list/`).then(r => r.json()),
    ]).then(([prodData, catData]) => {
      const prods = prodData.products || prodData || [];
      setProducts(prods);
      setCategories(catData.categories || catData || []);
      Promise.all(
        prods.map(p =>
          fetch(`${API}/api/review/list/?product_id=${p.id}`)
            .then(r => r.json())
            .then(d => ({ id: p.id, avg: d.stats?.average || 0, count: d.stats?.total || 0 }))
            .catch(() => ({ id: p.id, avg: 0, count: 0 }))
        )
      ).then(stats => {
        const map = Object.fromEntries(stats.map(s => [s.id, s]));
        setProducts(prev => prev.map(p => ({
          ...p,
          rating_avg: map[p.id]?.avg || 0,
          rating_count: map[p.id]?.count || 0,
        })));
      });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${API}/api/voucher/active/`)
      .then(r => r.json())
      .then(d => { setVoucherList(d.vouchers || []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let result = [...products];
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      result = result.filter(p => p.name?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q));
    }
    if (selectedCats.length)     result = result.filter(p => selectedCats.some(c => String(p.category_id) === String(c)));
    if (selectedRams.length)     result = result.filter(p => (p.variants || []).some(v => selectedRams.includes(v.ram)));
    if (selectedStorages.length) result = result.filter(p => (p.variants || []).some(v => selectedStorages.includes(v.storage)));
    if (selectedPrices.length) {
      const ranges = PRICE_RANGES.filter(r => selectedPrices.includes(r.label));
      if (ranges.length) {
        result = result.filter(p => {
          const vars = p.variants || [];
          const inRange = (fp) => ranges.some(range => fp >= range.min && fp < range.max);
          if (!vars.length) {
            const { finalPrice } = getBestForVariant({ price: parseFloat(p.min_price || 0) }, p.id, p.category_id, voucherList, cartVoucher);
            return inRange(finalPrice);
          }
          return vars.some(v => {
            const { finalPrice } = getBestForVariant(v, p.id, p.category_id, voucherList, cartVoucher);
            return inRange(finalPrice);
          });
        });
      }
    }
    if (sortBy === "price_asc")   result.sort((a, b) => parseFloat(a.min_price || 0) - parseFloat(b.min_price || 0));
    else if (sortBy === "price_desc") result.sort((a, b) => parseFloat(b.min_price || 0) - parseFloat(a.min_price || 0));
    else if (sortBy === "name_asc")  result.sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"));
    else if (sortBy === "name_desc") result.sort((a, b) => (b.name || "").localeCompare(a.name || "", "vi"));
    else if (sortBy === "rating_asc")  result.sort((a, b) => (a.rating_avg || 0) - (b.rating_avg || 0));
    else if (sortBy === "rating_desc") result.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
    setFiltered(result);
  }, [products, searchQ, selectedCats, selectedRams, selectedStorages, selectedPrices, voucherList, cartVoucher, sortBy]);

  const activeCount = selectedCats.length + selectedPrices.length + selectedRams.length + selectedStorages.length;
  const clearAll = () => { setSelectedCats([]); setSelectedPrices([]); setSelectedRams([]); setSelectedStorages([]); setSearchQ(""); setSortBy("default"); };

  return (
    <div className="min-h-screen bg-[#1C1C1E] text-white">
      <ToastContainer toasts={toasts} removeToast={removeToast} />


      {showVoucherPanel && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowVoucherPanel(false)} />
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 w-96 shadow-2xl max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Ticket size={16} className="text-orange-400" />
                <h3 className="font-semibold text-sm">Mã giảm giá đang có</h3>
              </div>
              <button onClick={() => setShowVoucherPanel(false)} className="text-white/30 hover:text-white"><X size={16} /></button>
            </div>
            {voucherList.length === 0
              ? <p className="text-white/30 text-sm text-center py-6">Không có mã giảm giá nào</p>
              : <div className="flex flex-col gap-2">
                  {voucherList.map(v => (
                    <div key={v.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                      <div>
                        <p className="font-mono font-bold text-orange-400 text-sm tracking-wider">{v.code}</p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {v.type === "percent" ? `Giảm ${v.value}%` : `Giảm ${parseInt(v.value).toLocaleString("vi-VN")}đ`}
                          {v.max_discount ? ` · Tối đa ${parseInt(v.max_discount).toLocaleString("vi-VN")}đ` : ""}
                        </p>
                        {v.min_order > 0 && <p className="text-[10px] text-white/25 mt-0.5">Đơn từ {parseInt(v.min_order).toLocaleString("vi-VN")}đ</p>}
                      </div>
                      <Tag size={18} className="text-orange-400/30 shrink-0" />
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      )}


      {/* NAVBAR */}
      <Navbar />

      {/* BANNER */}
      <div className="pt-20 px-10 pb-4 max-w-7xl mx-auto">
        <BannerSlider height="h-[340px]" className="w-full" page="product" />
      </div>

      {/* CONTENT */}
      <div className="flex gap-6 px-10 py-8">

        {/* SIDEBAR */}
        <aside className="w-52 shrink-0 flex flex-col gap-3 sticky top-24 h-fit">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal size={15} className="text-orange-400" />
              Bộ lọc
              {activeCount > 0 && <span className="bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{activeCount}</span>}
            </div>
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-xs text-white/30 hover:text-red-400 transition flex items-center gap-1">
                <X size={11} /> Xóa lọc
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <Search size={13} className="text-white/30 shrink-0" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Tìm sản phẩm..." className="bg-transparent text-xs outline-none flex-1 text-white placeholder:text-white/20" />
            {searchQ && <button onClick={() => setSearchQ("")}><X size={11} className="text-white/30 hover:text-white" /></button>}
          </div>

          {voucherList.length > 0 && (
            <button onClick={() => setShowVoucherPanel(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium hover:bg-orange-500/15 transition">
              <Ticket size={12} />
              {voucherList.length} mã giảm giá đang có
              <ChevronRight size={11} className="ml-auto" />
            </button>
          )}

          <FilterBox title="Danh mục">
            {categories.length === 0
              ? <p className="text-xs text-white/20 py-1">Đang tải...</p>
              : categories.map(c => (
                <FilterRow key={c.id} label={c.name} image={c.image}
                  active={selectedCats.includes(c.id)}
                  onClick={() => toggleItem(setSelectedCats, c.id)} />
              ))}
          </FilterBox>

          <FilterBox title="Mức giá">
            {PRICE_RANGES.map(r => (
              <FilterRow key={r.label} label={r.label}
                active={selectedPrices.includes(r.label)}
                onClick={() => toggleItem(setSelectedPrices, r.label)} />
            ))}
          </FilterBox>

          <FilterBox title="RAM">
            <div className="flex flex-wrap gap-1.5">
              {RAM_OPTIONS.map(r => (
                <TagChip key={r} label={r} active={selectedRams.includes(r)}
                  onClick={() => toggleItem(setSelectedRams, r)} />
              ))}
            </div>
          </FilterBox>

          <FilterBox title="Bộ nhớ trong">
            <div className="flex flex-wrap gap-1.5">
              {STORAGE_OPTIONS.map(s => (
                <TagChip key={s} label={s} active={selectedStorages.includes(s)}
                  onClick={() => toggleItem(setSelectedStorages, s)} />
              ))}
            </div>
          </FilterBox>
        </aside>

        {/* PRODUCT GRID */}
        <div className="flex-1 min-w-0">
          {!loading && filtered.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-[11px] text-white/30 shrink-0">Sắp xếp:</span>
              {[
                { key: "price",  label: "Giá",  asc: "price_asc",  desc: "price_desc"  },
                { key: "rating", label: "Sao",  asc: "rating_asc", desc: "rating_desc" },
                { key: "name",   label: "Tên",  asc: "name_asc",   desc: "name_desc"   },
              ].map(opt => {
                const isAsc  = sortBy === opt.asc;
                const isDesc = sortBy === opt.desc;
                const active = isAsc || isDesc;
                return (
                  <button key={opt.key}
                    onClick={() => { if (!active) setSortBy(opt.asc); else if (isAsc) setSortBy(opt.desc); else setSortBy("default"); }}
                    className={`w-24 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium border transition select-none
                      ${active ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "bg-white/[0.04] border-white/10 text-white/40 hover:border-white/25 hover:text-white/70"}`}>
                    {opt.label}
                    <span className="text-[10px] w-3 text-center">{isAsc ? "↑" : isDesc ? "↓" : "⇅"}</span>
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-24">
              <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/20">
              <Package size={48} className="opacity-30" />
              <p className="text-sm">Không tìm thấy sản phẩm nào</p>
              {activeCount > 0 && <button onClick={clearAll} className="text-orange-400 text-xs hover:underline">Xóa bộ lọc</button>}
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
              {filtered.flatMap(p => {
                const variants = p.variants || [];
                const comboMap = {};
                for (const v of variants) {
                  if (!v.price) continue;
                  const key = `${v.ram || ""}|${v.storage || ""}`;
                  if (!comboMap[key] || parseFloat(v.price) < parseFloat(comboMap[key].price)) comboMap[key] = v;
                }
                let combos = Object.values(comboMap).sort((a, b) => {
                  const sd = parseGB(a.storage) - parseGB(b.storage);
                  return sd !== 0 ? sd : parseGB(a.ram) - parseGB(b.ram);
                });
                if (selectedRams.length)     combos = combos.filter(v => selectedRams.includes(v.ram));
                if (selectedStorages.length) combos = combos.filter(v => selectedStorages.includes(v.storage));
                if (selectedPrices.length) {
                  const ranges = PRICE_RANGES.filter(r => selectedPrices.includes(r.label));
                  combos = combos.filter(v => {
                    const { finalPrice } = getBestForVariant(v, p.id, p.category_id, voucherList, cartVoucher);
                    return ranges.some(range => finalPrice >= range.min && finalPrice < range.max);
                  });
                }
                if (combos.length === 0 && !variants.length) {
                  return [<ProductCard key={p.id} product={p} comboVariant={null} voucherList={voucherList} cartVoucher={cartVoucher} navigate={navigate} toast={toast} />];
                }
                if (combos.length === 0) return [];
                return combos.map(comboV => (
                  <ProductCard key={`${p.id}_${comboV.ram || ""}|${comboV.storage || ""}`}
                    product={p} comboVariant={comboV} voucherList={voucherList} cartVoucher={cartVoucher} navigate={navigate} toast={toast} />
                ));
              })}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

// ── ProductCard — [FIX] chỉ dùng ảnh biến thể, có animation slide ──
function ProductCard({ product: p, comboVariant, voucherList, cartVoucher, navigate, toast }) {
  const variants   = p.variants || [];
  const comboKey   = comboVariant ? `${comboVariant.ram || ""}|${comboVariant.storage || ""}` : null;
  const comboLabel = comboVariant ? [comboVariant.ram, comboVariant.storage].filter(Boolean).join(" · ") : null;

  const colorsOfCombo = comboKey
    ? [...new Set(variants.filter(v => `${v.ram || ""}|${v.storage || ""}` === comboKey && v.color).map(v => v.color))]
    : [...new Set(variants.map(v => v.color).filter(Boolean))];

  const [activeColor, setActiveColor] = useState(null);

  const displayVariant = (() => {
    if (activeColor && comboKey) return variants.find(v => v.color === activeColor && `${v.ram || ""}|${v.storage || ""}` === comboKey) || null;
    if (comboKey) {
      const candidates = variants.filter(v => `${v.ram || ""}|${v.storage || ""}` === comboKey);
      return candidates.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0] || null;
    }
    return [...variants].sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0))[0] || null;
  })();

  const basePrice = displayVariant ? parseFloat(displayVariant.price) : parseFloat(p.min_price || 0);
  const { finalPrice, voucher: bestVoucher } = displayVariant
    ? getBestForVariant(displayVariant, p.id, p.category_id, voucherList, cartVoucher)
    : { finalPrice: basePrice, voucher: null };
  const hasDisc = finalPrice < basePrice;

  // ── [FIX] Chỉ dùng ảnh BIẾN THỂ, không dùng p.image ──────────────────────
  const variantImages = (() => {
    const imgs = [];
    // Ưu tiên ảnh variant đang chọn (activeColor)
    if (displayVariant?.image) imgs.push(displayVariant.image);
    // Thêm ảnh các variant khác cùng combo (không trùng)
    if (comboKey) {
      variants
        .filter(v => `${v.ram || ""}|${v.storage || ""}` === comboKey && v.image && !imgs.includes(v.image))
        .forEach(v => imgs.push(v.image));
    } else {
      variants
        .filter(v => v.image && !imgs.includes(v.image))
        .forEach(v => imgs.push(v.image));
    }
    return imgs;
  })();

  const [slideIdx, setSlideIdx] = useState(0);
  const slideRef = useRef(null);
  const [fading, setFading] = useState(false);

  // Reset về ảnh variant khi activeColor/comboKey thay đổi
  useEffect(() => { setSlideIdx(0); }, [displayVariant?.image]);

  // Auto-slide: chỉ khi có nhiều ảnh và chưa chọn màu cụ thể
  const frozen = !!(activeColor && comboKey);
  useEffect(() => {
    clearInterval(slideRef.current);
    if (frozen || variantImages.length <= 1) return;
    slideRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setSlideIdx(i => (i + 1) % variantImages.length);
        setFading(false);
      }, 150);
    }, 2500);
    return () => clearInterval(slideRef.current);
  }, [frozen, variantImages.length]);

  const currentImg = variantImages.length > 0 ? variantImages[slideIdx % variantImages.length] : null;

  const handleColorClick = (col) => {
    const hasStock = variants.some(v => v.color === col && (!comboKey || `${v.ram || ""}|${v.storage || ""}` === comboKey) && (v.stock ?? 1) > 0);
    if (!hasStock) return;
    setActiveColor(prev => prev === col ? null : col);
  };

  const handleBuy = (e) => {
    e.stopPropagation();
    const target = displayVariant || variants[0];
    const params = new URLSearchParams();
    if (target?.color)   params.set("color",   target.color);
    if (target?.ram)     params.set("ram",     target.ram);
    if (target?.storage) params.set("storage", target.storage);
    navigate(`/product/${p.id}${params.toString() ? "?" + params.toString() : ""}`);
  };

  const { addItem } = useCart();
  const handleAddToCart = (e) => {
    e.stopPropagation();
    const target = displayVariant || variants[0];
    if (!target) return;
    addItem(p, target, 1);
    toast.success("Đã thêm vào giỏ hàng!");
  };

  return (
    <article onClick={() => navigate(`/product/${p.id}`)} className="flex flex-col h-full rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer
      bg-[#00000001] backdrop-blur-[2px]
      shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
      hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.60),inset_1px_0_0_rgba(255,255,255,0.48),inset_0_-1px_1px_rgba(0,0,0,0.20),inset_-1px_0_1px_rgba(0,0,0,0.18),0_8px_32px_rgba(0,0,0,0.4)]">
      <div className="w-full h-32 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden">
        {currentImg ? (
          <img
            key={currentImg}
            src={currentImg}
            alt={p.name}
            className="w-full h-full object-contain p-2 transition-opacity duration-300"
            style={{ opacity: fading ? 0 : 1 }}
          />
        ) : (
          <Package size={24} className="text-white/10" />
        )}
        {hasDisc && bestVoucher && (
          <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-tight">
            {bestVoucher.type === "percent" ? `-${bestVoucher.value}%` : `-${(basePrice - finalPrice).toLocaleString("vi-VN")}đ`}
          </div>
        )}
        {/* Dot indicators — chỉ hiện khi có nhiều ảnh biến thể */}
        {variantImages.length > 1 && !frozen && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {variantImages.map((_, i) => (
              <span key={i} className={`rounded-full transition-all ${i === slideIdx % variantImages.length ? "w-3 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30"}`} />
            ))}
          </div>
        )}
        {/* Badge số lượng màu sắc */}
        {variantImages.length > 1 && (
          <div className="absolute top-1.5 right-1.5 bg-black/50 text-white/60 text-[8px] px-1.5 py-0.5 rounded-full pointer-events-none">
            {variantImages.length} màu
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-2.5 flex-1">
        <h3 className="font-semibold text-white text-xs leading-snug line-clamp-2 hover:text-orange-400 transition">
          {p.name}
        </h3>
        {comboLabel && (
          <span className="inline-block px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[9px] font-semibold text-white/50 w-fit">
            {comboLabel}
          </span>
        )}
        {colorsOfCombo.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {colorsOfCombo.map(col => {
              const hasStock = variants.some(v => v.color === col && (!comboKey || `${v.ram || ""}|${v.storage || ""}` === comboKey) && (v.stock ?? 1) > 0);
              return (
                <span key={col} title={!hasStock ? `${col} - Hết hàng` : col}
                  className={`px-1.5 py-0.5 rounded text-[9px] border font-medium cursor-pointer transition
                    ${activeColor === col ? "bg-orange-500/20 border-orange-500/40 text-orange-300"
                      : !hasStock ? "bg-white/[0.02] border-white/5 text-white/20 line-through cursor-not-allowed"
                      : "bg-white/5 border-white/10 text-white/50 hover:border-white/30"}`}
                  onClick={e => { e.stopPropagation(); handleColorClick(col); }}>
                  {col}
                </span>
              );
            })}
          </div>
        )}
        {bestVoucher && hasDisc && (
          <div className="flex items-center gap-1">
            <Tag size={8} className="text-orange-400 shrink-0" />
            <span className="text-[8px] text-orange-400 font-mono font-semibold">{bestVoucher.code}</span>
          </div>
        )}
        <div className="h-5 flex items-center">
          {p.rating_avg > 0 && (
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(n => (
                <svg key={n} width="9" height="9" viewBox="0 0 24 24"
                  fill={n <= Math.round(p.rating_avg) ? "#f59e0b" : "none"}
                  stroke="#f59e0b" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
              <span className="text-[9px] text-white/30 ml-0.5">({p.rating_count})</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end justify-between mt-auto pt-1 gap-1">
          <div className="shrink-0">
            {hasDisc && <p className="text-[#ff3b30]/40 text-[9px] line-through leading-none">{basePrice.toLocaleString("vi-VN")}đ</p>}
            <p className="font-bold text-sm leading-tight text-[#ff3b30] whitespace-nowrap">
              {finalPrice ? finalPrice.toLocaleString("vi-VN") + "đ" : "Liên hệ"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handleAddToCart} className="shrink-0 h-7 w-14 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition focus:outline-none">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </button>
            <button onClick={handleBuy} className="shrink-0 h-7 w-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-medium transition flex items-center justify-center focus:outline-none">
              Mua
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function FilterBox({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/50 hover:text-white transition">
        {title}
        <ChevronRight size={13} className={`transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3 flex flex-col gap-1">{children}</div>}
    </div>
  );
}

function FilterRow({ label, image, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-sm transition text-left
        ${active ? "bg-orange-500/15 text-orange-300 border border-orange-500/30" : "text-white/50 hover:bg-white/5 hover:text-white border border-transparent"}`}>
      {image && <img src={image} alt={label} className="w-5 h-5 rounded object-cover shrink-0" />}
      <span className="truncate text-xs">{label}</span>
      {active && <X size={11} className="ml-auto shrink-0 text-orange-400" />}
    </button>
  );
}

function TagChip({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs border transition
        ${active ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "bg-white/5 border-white/10 text-white/40 hover:border-white/30 hover:text-white"}`}>
      {label}
    </button>
  );
}