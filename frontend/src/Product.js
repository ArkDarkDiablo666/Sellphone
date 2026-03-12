import React, { useState, useRef, useEffect } from "react";
import { useCart } from "./Cart";
import { Link, useNavigate } from "react-router-dom";
import {
  User, LogOut, Settings, Search, ShoppingCart, ChevronDown,
  AlertTriangle, SlidersHorizontal, X, ChevronRight, Package, Tag, Ticket
} from "lucide-react";
import bgImage from "./Image/image-177.png";
import { SearchModal } from "./Searchbar";
import Footer from "./Footer";

const API = "http://localhost:8000";

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
  const [user,         setUser]         = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmLogout,setConfirmLogout]= useState(false);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const dropdownRef = useRef(null);

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

  const toggleItem = (setter, val) => setter(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);

  useEffect(() => {
    const sync = () => setUser(JSON.parse(localStorage.getItem("user") || "null"));
    window.addEventListener("storage",     sync);
    window.addEventListener("focus",       sync);
    window.addEventListener("userUpdated", sync);
    return () => {
      window.removeEventListener("storage",     sync);
      window.removeEventListener("focus",       sync);
      window.removeEventListener("userUpdated", sync);
    };
  }, []);

  useEffect(() => {
    const fn = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleLogout = () => { localStorage.removeItem("user"); setConfirmLogout(false); navigate("/login"); };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/product/list/`).then(r => r.json()),
      fetch(`${API}/api/category/list/`).then(r => r.json()),
    ]).then(([prodData, catData]) => {
      setProducts(prodData.products || prodData || []);
      setCategories(catData.categories || catData || []);
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
    setFiltered(result);
  }, [products, searchQ, selectedCats, selectedRams, selectedStorages, selectedPrices, voucherList, cartVoucher]);

  const activeCount = selectedCats.length + selectedPrices.length + selectedRams.length + selectedStorages.length;
  const clearAll = () => { setSelectedCats([]); setSelectedPrices([]); setSelectedRams([]); setSelectedStorages([]); setSearchQ(""); };

  return (
    <div className="min-h-screen bg-[#1C1C1E] text-white">

      {/* LOGOUT DIALOG */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmLogout(false)} />
          <div className="relative bg-[#161616] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <h3 className="font-semibold">Đăng xuất</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">Bạn có muốn đăng xuất không?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmLogout(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10">Hủy</button>
              <button onClick={handleLogout}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      {/* VOUCHER PANEL */}
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
                        {v.scope && v.scope !== "all" && (
                          <p className="text-[10px] text-orange-400/50 mt-0.5">{v.scope === "category" ? "Theo danh mục" : "Sản phẩm cụ thể"}</p>
                        )}
                      </div>
                      <Tag size={18} className="text-orange-400/30 shrink-0" />
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      )}

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-4 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="text-2xl font-bold cursor-pointer" onClick={() => navigate("/")}>PHONEZONE</div>
        <div className="flex gap-8 items-center text-gray-300">
          <Link to="/" className="hover:text-white transition">Trang chủ</Link>
          <Link to="/product" className="hover:text-white transition">Sản phẩm</Link>
          <Link to="/blog" className="hover:text-white transition">Bài viết</Link>
        </div>
        <div className="flex gap-5 items-center text-gray-300">
          {/* SEARCH BUTTON */}
          <button onClick={() => setSearchOpen(true)}
            className="text-gray-300 hover:text-white transition">
            <Search size={20} />
          </button>

          <button onClick={() => navigate(user ? "/cart" : "/login")} className="relative">
            <ShoppingCart className="hover:text-white transition" size={22} />
            {totalCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {totalCount > 9 ? "9+" : totalCount}
              </span>
            )}
          </button>
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 hover:text-white transition">
                {user.avatar
                  ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                <ChevronDown size={14} className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                    {user.avatar
                      ? <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      : <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{user.fullName}</p>
                      <p className="text-xs text-white/40 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button onClick={() => { setDropdownOpen(false); navigate("/information"); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition">
                    <Settings size={15} /> Tài khoản
                  </button>
                  <div className="h-px bg-white/5 mx-3" />
                  <button onClick={() => { setDropdownOpen(false); setConfirmLogout(true); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition">
                    <LogOut size={15} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => navigate("/login")}><User className="hover:text-white transition" size={22} /></button>
          )}
        </div>
      </nav>

      {/* HERO BANNER */}
      <div className="relative h-52 flex items-center justify-center overflow-hidden mt-[0px]">
        <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#1C1C1E]" />
      </div>

      {/* CONTENT */}
      <div className="flex gap-6 px-10 py-8">

        {/* SIDEBAR FILTER */}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
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
                  return [<ProductCard key={p.id} product={p} comboVariant={null} voucherList={voucherList} cartVoucher={cartVoucher} navigate={navigate} />];
                }
                if (combos.length === 0) return [];
                return combos.map(comboV => (
                  <ProductCard key={`${p.id}_${comboV.ram || ""}|${comboV.storage || ""}`}
                    product={p} comboVariant={comboV} voucherList={voucherList} cartVoucher={cartVoucher} navigate={navigate} />
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
function ProductCard({ product: p, comboVariant, voucherList, cartVoucher, navigate }) {
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

  const displayImage = displayVariant?.image || p.image || null;

  return (
    <article className="flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer
      bg-[#00000001] backdrop-blur-[2px]
      shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
      hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.60),inset_1px_0_0_rgba(255,255,255,0.48),inset_0_-1px_1px_rgba(0,0,0,0.20),inset_-1px_0_1px_rgba(0,0,0,0.18),0_8px_32px_rgba(0,0,0,0.4)]">
      <div className="w-full h-32 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden"
        onClick={() => navigate(`/product/${p.id}`)}>
        {displayImage
          ? <img key={displayImage} src={displayImage} alt={p.name} className="w-full h-full object-contain p-2" />
          : <Package size={24} className="text-white/10" />}
        {hasDisc && bestVoucher && (
          <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-tight">
            {bestVoucher.type === "percent" ? `-${bestVoucher.value}%` : `-${(basePrice - finalPrice).toLocaleString("vi-VN")}đ`}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-2.5">
        <h3 className="font-semibold text-white text-xs leading-snug line-clamp-2 hover:text-orange-400 transition"
          onClick={() => navigate(`/product/${p.id}`)}>
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
              const isActive = activeColor === col;
              return (
                <button key={col} onClick={e => { e.stopPropagation(); handleColorClick(col); }} disabled={!hasStock} title={!hasStock ? `${col} - Hết hàng` : col}
                  className={`px-1.5 py-0.5 rounded text-[9px] border transition font-medium
                    ${isActive ? "bg-white text-black border-white"
                      : !hasStock ? "bg-white/[0.02] border-white/5 text-white/20 line-through cursor-not-allowed"
                      : "bg-white/5 border-white/10 text-white/50 hover:border-white/40 hover:text-white"}`}>
                  {col}
                </button>
              );
            })}
          </div>
        )}
        {bestVoucher && hasDisc && (
          <div className="flex items-center gap-1">
            <Tag size={8} className="text-orange-400 shrink-0" />
            <span className="text-[8px] text-orange-400 font-mono font-semibold">{bestVoucher.code}</span>
            <span className="text-[8px] text-white/30">
              -{bestVoucher.type === "percent" ? `${bestVoucher.value}%` : `${parseInt(bestVoucher.value).toLocaleString("vi-VN")}đ`}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between mt-auto pt-1 gap-1">
          <div className="min-w-0">
            {hasDisc && <p className="text-[#ff3b30]/40 text-[9px] line-through leading-none">{basePrice.toLocaleString("vi-VN")}đ</p>}
            <p className="font-bold text-sm leading-tight truncate text-[#ff3b30]">
              {finalPrice ? finalPrice.toLocaleString("vi-VN") + "đ" : "Liên hệ"}
            </p>
          </div>
          <button onClick={handleBuy}
            className="shrink-0 h-7 px-2.5 rounded-full text-white text-[10px] font-medium bg-[rgba(255,149,0,0.75)] border border-[#ff9500] hover:bg-[rgba(255,149,0,1)] transition">
            Mua
          </button>
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