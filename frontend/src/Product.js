import React, { useState, useRef, useEffect } from "react";
import { useCart } from "./Cart";
import { Link, useNavigate } from "react-router-dom";
import {
  User, LogOut, Settings, Search, ShoppingCart, ChevronDown,
  AlertTriangle, SlidersHorizontal, X, ChevronRight, Package, ShoppingBag
} from "lucide-react";
import bgImage from "./Image/image-177.png";

const API = "http://localhost:8000";

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
  const { totalCount, voucher, autoApplyBestVoucher } = useCart();
  const [user, setUser] = React.useState(() => JSON.parse(localStorage.getItem("user")));

  React.useEffect(() => {
    const syncUser = () => setUser(JSON.parse(localStorage.getItem("user")));
    window.addEventListener("storage",     syncUser);
    window.addEventListener("focus",       syncUser);
    window.addEventListener("userUpdated", syncUser);
    return () => {
      window.removeEventListener("storage",     syncUser);
      window.removeEventListener("focus",       syncUser);
      window.removeEventListener("userUpdated", syncUser);
    };
  }, []);

  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const dropdownRef = useRef(null);

  // Data
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);

  // Filters
  const [searchText,      setSearchText]      = useState("");
  const [selectedCat,     setSelectedCat]     = useState(null);
  const [selectedPrice,   setSelectedPrice]   = useState(null);
  const [selectedRam,     setSelectedRam]     = useState(null);
  const [selectedStorage, setSelectedStorage] = useState(null);

  useEffect(() => {
    const fn = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => { autoApplyBestVoucher(); }, []); // eslint-disable-line

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/product/list/`).then((r) => r.json()),
      fetch(`${API}/api/product/categories/`).then((r) => r.json()),
    ]).then(([prodData, catData]) => {
      setProducts(prodData.products    || []);
      setCategories(catData.categories || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = products.filter((p) => {
    if (searchText) {
      const q = searchText.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.brand || "").toLowerCase().includes(q)) return false;
    }
    if (selectedCat     && p.category_id !== selectedCat)              return false;
    if (selectedRam     && p.rams     && !p.rams.includes(selectedRam))         return false;
    if (selectedStorage && p.storages && !p.storages.includes(selectedStorage)) return false;
    if (selectedPrice) {
      const range = PRICE_RANGES.find((r) => r.label === selectedPrice);
      if (range) {
        const price = parseFloat(p.min_price || 0);
        if (!(price >= range.min && price < range.max)) return false;
      }
    }
    return true;
  });

  const activeCount = [selectedCat, selectedPrice, selectedRam, selectedStorage].filter(Boolean).length;
  const clearAll    = () => { setSelectedCat(null); setSelectedPrice(null); setSelectedRam(null); setSelectedStorage(null); };

  const handleLogout = () => { localStorage.removeItem("user"); setConfirmLogout(false); navigate("/login"); };

    // Tính giá hiển thị sau voucher cho product card
  const getDisplayPrice = (product) => {
    const originalPrice = parseFloat(product.min_price || 0);
    if (!originalPrice) return { price: 0, hasDiscount: false, originalPrice: 0 };
    if (!voucher)       return { price: originalPrice, hasDiscount: false, originalPrice };
    if (voucher.scope === "category" && voucher.category_id && String(product.category_id) !== String(voucher.category_id))
      return { price: originalPrice, hasDiscount: false, originalPrice };
    if (voucher.scope === "product" && voucher.product_id && String(product.id) !== String(voucher.product_id))
      return { price: originalPrice, hasDiscount: false, originalPrice };
    let discounted = originalPrice;
    if (voucher.type === "percent") discounted = Math.round(originalPrice * (1 - Math.min(voucher.value, 100) / 100));
    if (voucher.type === "fixed")   discounted = Math.max(0, originalPrice - voucher.value);
    return { price: discounted, hasDiscount: discounted < originalPrice, originalPrice };
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
              <button onClick={() => setConfirmLogout(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition border border-white/10">Hủy</button>
              <button onClick={handleLogout}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-4 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="text-2xl font-bold">PHONEZONE</div>
        <div className="flex gap-8 items-center text-gray-300">
          <Link to="/"        className="hover:text-white transition">Trang chủ</Link>
          <Link to="/product" className="text-white font-medium">Sản phẩm</Link>
          <Link to="/blog"    className="hover:text-white transition">Bài viết</Link>
        </div>
        <div className="flex items-center gap-5 text-gray-300">
          <div className="relative hidden md:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={searchText} onChange={(e) => setSearchText(e.target.value)}
              placeholder="Tìm sản phẩm..."
              className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-white/30 transition w-52" />
          </div>
          <button onClick={() => navigate(user ? "/cart" : "/login")} className="relative">
            <ShoppingCart size={22} className="hover:text-white transition" />
                {totalCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {totalCount > 9 ? "9+" : totalCount}
                  </span>
                )}
          </button>
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 hover:text-white transition">
                {user.avatar
                  ? <img src={user.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20" />
                  : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                    {user.avatar
                      ? <img src={user.avatar} alt="avatar" className="w-9 h-9 rounded-full object-cover" />
                      : <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{user.fullName}</p>
                      <p className="text-xs text-white/40 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button onClick={() => { setDropdownOpen(false); navigate("/orders"); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition flex items-center gap-2">
                    <ShoppingBag size={14} className="text-orange-400" /> Đơn hàng của tôi
                  </button>
                  <button onClick={() => { setDropdownOpen(false); navigate("/information"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 transition">
                    <Settings size={15} /> Tài khoản
                  </button>
                  <button onClick={() => { setDropdownOpen(false); setConfirmLogout(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition">
                    <LogOut size={15} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => navigate("/login")}><User size={22} className="hover:text-white transition" /></button>
          )}
        </div>
      </nav>

      {/* HERO */}
      <div className="h-[220px] bg-cover bg-center pt-[64px]" style={{ backgroundImage: `url(${bgImage})` }}>
        <div className="h-full bg-black/60 flex flex-col items-center justify-center gap-2">
          <h1 className="text-3xl font-bold">Sản phẩm</h1>
          <p className="text-white/40 text-sm">{filtered.length} sản phẩm</p>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex gap-6 px-10 py-8">

        {/* ===== FILTER SIDEBAR ===== */}
        <aside className="w-52 shrink-0 flex flex-col gap-3 sticky top-24 h-fit">
          {/* Tiêu đề */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal size={15} className="text-orange-400" />
              Bộ lọc
              {activeCount > 0 && (
                <span className="bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </div>
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-xs text-white/30 hover:text-red-400 transition flex items-center gap-1">
                <X size={11} /> Xóa lọc
              </button>
            )}
          </div>

          {/* Danh mục */}
          <FilterBox title="Danh mục">
            {categories.length === 0
              ? <p className="text-xs text-white/20 py-1">Đang tải...</p>
              : categories.map((c) => (
                <FilterRow key={c.id} label={c.name} image={c.image}
                  active={selectedCat === c.id}
                  onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)} />
              ))
            }
          </FilterBox>

          {/* Mức giá */}
          <FilterBox title="Mức giá">
            {PRICE_RANGES.map((r) => (
              <FilterRow key={r.label} label={r.label}
                active={selectedPrice === r.label}
                onClick={() => setSelectedPrice(selectedPrice === r.label ? null : r.label)} />
            ))}
          </FilterBox>

          {/* RAM */}
          <FilterBox title="RAM">
            <div className="flex flex-wrap gap-1.5">
              {RAM_OPTIONS.map((r) => (
                <TagChip key={r} label={r} active={selectedRam === r}
                  onClick={() => setSelectedRam(selectedRam === r ? null : r)} />
              ))}
            </div>
          </FilterBox>

          {/* Bộ nhớ trong */}
          <FilterBox title="Bộ nhớ trong">
            <div className="flex flex-wrap gap-1.5">
              {STORAGE_OPTIONS.map((s) => (
                <TagChip key={s} label={s} active={selectedStorage === s}
                  onClick={() => setSelectedStorage(selectedStorage === s ? null : s)} />
              ))}
            </div>
          </FilterBox>
        </aside>

        {/* ===== PRODUCT GRID ===== */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex justify-center py-24">
              <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/20">
              <Package size={48} className="opacity-30" />
              <p className="text-sm">Không tìm thấy sản phẩm nào</p>
              {activeCount > 0 && (
                <button onClick={clearAll} className="text-orange-400 text-xs hover:underline">Xóa bộ lọc</button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map((p) => (
                <article key={p.id}
                  onClick={() => navigate(`/product/${p.id}`)}
                  className="flex flex-col gap-3 p-3 rounded-[20px] cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1
                    bg-[#00000001] backdrop-blur-[2px]
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
                    hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.60),inset_1px_0_0_rgba(255,255,255,0.48),inset_0_-1px_1px_rgba(0,0,0,0.20),inset_-1px_0_1px_rgba(0,0,0,0.18),0_8px_32px_rgba(0,0,0,0.4)]">
                  <div className="w-full h-44 rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    {p.image
                      ? <img src={p.image} alt={p.name} className="w-full h-full object-contain p-2" />
                      : <Package size={36} className="text-white/10" />}
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2">{p.name}</h3>
                    {(() => {
                      const { price, hasDiscount, originalPrice } = getDisplayPrice(p);
                      return (
                        <div className="text-right">
                          {hasDiscount && (
                            <p className="text-white/30 text-xs line-through leading-none">
                              {originalPrice.toLocaleString("vi-VN")}đ
                            </p>
                          )}
                          <p className={`font-semibold text-base ${hasDiscount ? "text-orange-400" : "text-[#ff3b30]"}`}>
                            {price ? price.toLocaleString("vi-VN") + "đ" : "Liên hệ"}
                          </p>
                          {hasDiscount && voucher && (
                            <p className="text-[10px] text-green-400 leading-none mt-0.5">
                              -{voucher.type === "percent" ? `${voucher.value}%` : `${parseInt(voucher.value).toLocaleString("vi-VN")}đ`}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                    <button onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/product/${p.id}`);
                    }}
                      className="w-full h-9 flex items-center justify-center rounded-full text-white text-sm font-medium
                        bg-[rgba(255,149,0,0.7)] border border-[#ff9500] backdrop-blur-[2px]
                        shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
                        hover:bg-[rgba(255,149,0,0.9)] transition">
                      Mua Ngay
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== SUB COMPONENTS =====
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
        ${active
          ? "bg-orange-500/15 text-orange-300 border border-orange-500/30"
          : "text-white/50 hover:bg-white/5 hover:text-white border border-transparent"}`}>
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
        ${active
          ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
          : "bg-white/5 border-white/10 text-white/40 hover:border-white/30 hover:text-white"}`}>
      {label}
    </button>
  );
}