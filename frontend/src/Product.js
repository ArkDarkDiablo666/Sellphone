import React, { useState, useRef, useEffect } from "react";
import { useCart } from "./Cart";
import { Link, useNavigate } from "react-router-dom";
import {
  User, LogOut, Settings, ShoppingCart, ChevronDown,
  AlertTriangle, SlidersHorizontal, X, ChevronRight, Package, ShoppingBag
} from "lucide-react";
import bgImage from "./Image/image-177.png";

const API = "http://localhost:8000";

const applyVoucherDiscount = (price, voucher) => {
  if (!price || !voucher) return price;
  let disc = 0;
  if (voucher.type === "percent") disc = Math.round(price * Math.min(voucher.value, 100) / 100);
  if (voucher.type === "fixed")   disc = voucher.value;
  if (voucher.max_discount && disc > voucher.max_discount) disc = voucher.max_discount;
  return Math.max(0, price - disc);
};

const PRICE_RANGES = [
  { label: "Dưới 5 triệu",   min: 0,          max: 5_000_000  },
  { label: "5 - 10 triệu",   min: 5_000_000,  max: 10_000_000 },
  { label: "10 - 20 triệu",  min: 10_000_000, max: 20_000_000 },
  { label: "Trên 20 triệu",  min: 20_000_000, max: Infinity   },
];
const RAM_OPTIONS     = ["4GB","6GB","8GB","12GB","16GB","32GB"];
const STORAGE_OPTIONS = ["64GB","128GB","256GB","512GB","1TB","2TB"];

export default function Product() {
  const navigate = useNavigate();
  const { totalCount, voucher } = useCart();

  // ── Auth / navbar ──────────────────────────────────────────
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const syncUser = () => setUser(JSON.parse(localStorage.getItem("user") || "null"));
    window.addEventListener("storage",     syncUser);
    window.addEventListener("focus",       syncUser);
    window.addEventListener("userUpdated", syncUser);
    return () => {
      window.removeEventListener("storage",     syncUser);
      window.removeEventListener("focus",       syncUser);
      window.removeEventListener("userUpdated", syncUser);
    };
  }, []);

  useEffect(() => {
    const fn = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleLogout = () => { localStorage.removeItem("user"); setConfirmLogout(false); navigate("/login"); };

  // ── Product data ───────────────────────────────────────────
  const [products,    setProducts]    = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [loading,     setLoading]     = useState(true);

  // ── Filters ────────────────────────────────────────────────
  const [selectedCat,     setSelectedCat]     = useState(null);
  const [selectedPrice,   setSelectedPrice]   = useState(null);
  const [selectedRam,     setSelectedRam]     = useState(null);
  const [selectedStorage, setSelectedStorage] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/category/list/`)
      .then(r => r.json())
      .then(d => setCategories(d.categories || d || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCat) params.set("category_id", selectedCat);
    fetch(`${API}/api/product/list/?${params}`)
      .then(r => r.json())
      .then(d => {
        // API list_products đã trả về đầy đủ variants trong mỗi sản phẩm
        setProducts(d.products || d || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedCat]);

  // ── Voucher scope check ────────────────────────────────────
  const voucherApplies = (product) => {
    if (!voucher) return false;
    return (
      !voucher.scope || voucher.scope === "all" ||
      (voucher.scope === "category" && String(product.category_id) === String(voucher.category_id)) ||
      (voucher.scope === "product"  && String(product.id)          === String(voucher.product_id))
    );
  };

  const getDiscountedPrice = (originalPrice, product) => {
    if (!originalPrice) return originalPrice;
    if (!voucherApplies(product)) return originalPrice;
    return applyVoucherDiscount(originalPrice, voucher);
  };

  // ── Core: lấy các biến thể unique theo RAM+Storage (bỏ qua màu sắc) ──
  // Mỗi combo RAM+Storage chỉ xuất hiện 1 lần, lấy giá thấp nhất trong các màu
  // Áp dụng filter RAM / Storage nếu người dùng đã chọn
  const getMatchingVariants = (product) => {
    const variants = product.variants || [];

    // ── Không có variants → fallback min_price ──────────────
    if (variants.length === 0) {
      const originalPrice = parseFloat(product.min_price || 0);
      const discounted    = getDiscountedPrice(originalPrice, product);

      // Nếu filter RAM/Storage mà sản phẩm không có variants data → bỏ qua filter
      // (không thể xác nhận → cho hiện luôn)
      return [{
        variantKey: "default",
        originalPrice,
        discountedPrice: discounted,
        hasDiscount: discounted < originalPrice,
        ram: null,
        storage: null,
      }];
    }

    // ── Group variants theo RAM + Storage (bỏ màu sắc) ──────
    // Key = "ram|storage", value = giá thấp nhất trong các màu
    const comboMap = new Map();

    variants.forEach(v => {
      const ram = v.ram || v.RAM || v.ram_size || v.ramSize || v.Ram || null;
      const storage = v.storage || v.Storage || v.rom || v.ROM
                    || v.memory || v.Memory || v.internal_storage || null;
      const price = parseFloat(v.price || v.Price || v.sale_price || 0);
      const key = `${ram || ""}|${storage || ""}`;

      if (!comboMap.has(key) || price < comboMap.get(key).originalPrice) {
        comboMap.set(key, { ram, storage, originalPrice: price, variantKey: key });
      }
    });

    // ── Áp dụng filter RAM + Storage ──────────────────────────
    let combos = Array.from(comboMap.values());

    if (selectedRam) {
      combos = combos.filter(c => c.ram === selectedRam);
    }
    if (selectedStorage) {
      combos = combos.filter(c => c.storage === selectedStorage);
    }

    if (combos.length === 0) return [];

    // ── Tính giá sau giảm ────────────────────────────────────
    return combos.map(c => {
      const discounted = getDiscountedPrice(c.originalPrice, product);
      return {
        ...c,
        discountedPrice: discounted,
        hasDiscount: discounted < c.originalPrice,
      };
    });
  };

  // ── Derived: filtered list với variant matching ─────────────
  const filteredProducts = products.reduce((acc, p) => {
    const matchingVariants = getMatchingVariants(p);
    if (matchingVariants.length === 0) return acc;

    // Filter theo giá (dùng giá đã giảm)
    if (selectedPrice) {
      const range = PRICE_RANGES.find(r => r.label === selectedPrice);
      if (range) {
        const validVariants = matchingVariants.filter(v =>
          v.discountedPrice >= range.min && v.discountedPrice <= range.max
        );
        if (validVariants.length === 0) return acc;
        acc.push({ product: p, variants: validVariants });
        return acc;
      }
    }

    acc.push({ product: p, variants: matchingVariants });
    return acc;
  }, []);

  const activeCount = [selectedCat, selectedPrice, selectedRam, selectedStorage].filter(Boolean).length;
  const clearAll    = () => { setSelectedCat(null); setSelectedPrice(null); setSelectedRam(null); setSelectedStorage(null); };

  // ── Navigate với variant context ─────────────────────────
  const navigateToProduct = (product, variant) => {
    if (variant && (variant.ram || variant.storage)) {
      navigate(`/product/${product.id}?ram=${encodeURIComponent(variant.ram || "")}&storage=${encodeURIComponent(variant.storage || "")}`);
    } else {
      navigate(`/product/${product.id}`);
    }
  };

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
              <button onClick={() => setConfirmLogout(false)} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition border border-white/10">Hủy</button>
              <button onClick={handleLogout} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-4 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="text-2xl font-bold cursor-pointer" onClick={() => navigate("/")}>PHONEZONE</div>
        <div className="flex gap-8 items-center text-gray-300">
          <Link to="/" className="hover:text-white transition">Trang chủ</Link>
          <Link to="/product" className="text-white font-medium transition">Sản phẩm</Link>
          <Link to="/blog" className="hover:text-white transition">Bài viết</Link>
        </div>
        <div className="flex gap-5 items-center text-gray-300">
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
                  ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20" onError={(e)=>{e.currentTarget.style.display="none"}} />
                  : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>
                }
                <ChevronDown size={14} className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                    {user.avatar
                      ? <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" onError={(e)=>{e.currentTarget.style.display="none"}} />
                      : <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>
                    }
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{user.fullName}</p>
                      <p className="text-xs text-white/40 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button onClick={() => { setDropdownOpen(false); navigate("/information"); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition">
                    <Settings size={15} /> Tài khoản
                  </button>
                  <div className="h-px bg-white/5 mx-3" />
                  <button onClick={() => { setDropdownOpen(false); setConfirmLogout(true); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition">
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

      {/* HERO */}
      <div className="h-[220px] bg-cover bg-center pt-[64px]" style={{ backgroundImage: `url(${bgImage})` }}>
        <div className="h-full bg-black/60 flex flex-col items-center justify-center gap-2">
          <h1 className="text-3xl font-bold">Sản phẩm</h1>
          <p className="text-white/40 text-sm">{filteredProducts.length} sản phẩm</p>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex gap-6 px-10 py-8">

        {/* FILTER SIDEBAR */}
        <aside className="w-52 shrink-0 flex flex-col gap-3 sticky top-24 h-fit">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal size={15} className="text-orange-400" />
              Bộ lọc
              {activeCount > 0 && (
                <span className="bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{activeCount}</span>
              )}
            </div>
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-xs text-white/30 hover:text-red-400 transition flex items-center gap-1">
                <X size={11} /> Xóa lọc
              </button>
            )}
          </div>

          <FilterBox title="Danh mục">
            {categories.length === 0
              ? <p className="text-xs text-white/20 py-1">Đang tải...</p>
              : categories.map(c => (
                <FilterRow key={c.id} label={c.name} image={c.image}
                  active={selectedCat === c.id}
                  onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)} />
              ))
            }
          </FilterBox>

          <FilterBox title="Mức giá">
            <p className="text-[10px] text-white/25 px-1 pb-1">Áp dụng theo giá đã giảm</p>
            {PRICE_RANGES.map(r => (
              <FilterRow key={r.label} label={r.label}
                active={selectedPrice === r.label}
                onClick={() => setSelectedPrice(selectedPrice === r.label ? null : r.label)} />
            ))}
          </FilterBox>

          <FilterBox title="RAM">
            <div className="flex flex-wrap gap-1.5">
              {RAM_OPTIONS.map(r => (
                <TagChip key={r} label={r} active={selectedRam === r} onClick={() => setSelectedRam(selectedRam === r ? null : r)} />
              ))}
            </div>
          </FilterBox>

          <FilterBox title="Bộ nhớ trong">
            <div className="flex flex-wrap gap-1.5">
              {STORAGE_OPTIONS.map(s => (
                <TagChip key={s} label={s} active={selectedStorage === s} onClick={() => setSelectedStorage(selectedStorage === s ? null : s)} />
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
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/20">
              <Package size={48} className="opacity-30" />
              <p className="text-sm">Không tìm thấy sản phẩm nào</p>
              {activeCount > 0 && <button onClick={clearAll} className="text-orange-400 text-xs hover:underline">Xóa bộ lọc</button>}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.flatMap(({ product: p, variants: matchedVariants }) =>
                matchedVariants.map((mv, idx) => (
                  <ProductCard
                    key={`${p.id}-${mv.variantKey || idx}`}
                    product={p}
                    variant={mv}
                    voucher={voucher}
                    onNavigate={() => navigateToProduct(p, mv)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Product Card Component ────────────────────────────────────
function ProductCard({ product: p, variant, voucher, onNavigate }) {
  const { discountedPrice, hasDiscount, originalPrice, ram, storage } = variant;

  return (
    <article
      onClick={onNavigate}
      className="flex flex-col gap-3 p-3 rounded-[20px] cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1 bg-[#00000001] backdrop-blur-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.60),inset_1px_0_0_rgba(255,255,255,0.48),inset_0_-1px_1px_rgba(0,0,0,0.20),inset_-1px_0_1px_rgba(0,0,0,0.18),0_8px_32px_rgba(0,0,0,0.4)]">

      {/* Ảnh */}
      <div className="w-full h-44 rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
        {p.image
          ? <img src={p.image} alt={p.name} className="w-full h-full object-contain p-2" />
          : <Package size={36} className="text-white/10" />}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2">{p.name}</h3>

        {/* Badge RAM / Storage */}
        {(ram || storage) && (
          <div className="flex flex-wrap gap-1">
            {ram     && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/25 text-blue-400">{ram}</span>}
            {storage && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/25 text-orange-400">{storage}</span>}
          </div>
        )}

        {/* Giá */}
        <div className="text-right">
          {hasDiscount && (
            <p className="text-white/30 text-xs line-through leading-none">
              {originalPrice.toLocaleString("vi-VN")}đ
            </p>
          )}
          <p className={`font-semibold text-base ${hasDiscount ? "text-orange-400" : "text-[#ff3b30]"}`}>
            {discountedPrice ? discountedPrice.toLocaleString("vi-VN") + "đ" : "Liên hệ"}
          </p>
          {hasDiscount && voucher && (
            <p className="text-[10px] text-green-400 leading-none mt-0.5">
              -{voucher.type === "percent" ? `${voucher.value}%` : `${parseInt(voucher.value).toLocaleString("vi-VN")}đ`}
            </p>
          )}
        </div>

        {/* Nút Mua Ngay */}
        <button
          onClick={e => { e.stopPropagation(); onNavigate(); }}
          className="w-full h-9 flex items-center justify-center rounded-full text-white text-sm font-medium bg-[rgba(255,149,0,0.7)] border border-[#ff9500] backdrop-blur-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)] hover:bg-[rgba(255,149,0,0.9)] transition">
          Mua Ngay
        </button>
      </div>
    </article>
  );
}

function FilterBox({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/50 hover:text-white transition">
        {title}
        <ChevronRight size={13} className={`transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3 flex flex-col gap-1">{children}</div>}
    </div>
  );
}

function FilterRow({ label, image, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-sm transition text-left ${active ? "bg-orange-500/15 text-orange-300 border border-orange-500/30" : "text-white/50 hover:bg-white/5 hover:text-white border border-transparent"}`}>
      {image && <img src={image} alt={label} className="w-5 h-5 rounded object-cover shrink-0" />}
      <span className="truncate text-xs">{label}</span>
      {active && <X size={11} className="ml-auto shrink-0 text-orange-400" />}
    </button>
  );
}

function TagChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} className={`px-2.5 py-1 rounded-lg text-xs border transition ${active ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "bg-white/5 border-white/10 text-white/40 hover:border-white/30 hover:text-white"}`}>
      {label}
    </button>
  );
}