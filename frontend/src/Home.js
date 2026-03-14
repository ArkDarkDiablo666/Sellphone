import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "./Cart";
import bgImage from "./Image/image-177.png";
import {
  User, LogOut, Settings, AlertTriangle,
  ShoppingCart, ChevronDown, Search, ChevronRight, Package
} from "lucide-react";
import { SearchModal } from "./Searchbar";
import { isLoggedIn, clearSession } from "./authUtils";
import Footer from "./Footer";
import { ToastContainer, useToast } from "./Toast";

const API = "http://localhost:8000";

const fmt = (n) => n != null ? n.toLocaleString("vi-VN") + "đ" : null;

// ── helpers for discount calc (mirrors Product.jsx) ──────────
function calcDiscHome(v, price, productId, categoryId, variantId) {
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

function getBestHome(variant, productId, categoryId, voucherList, cartVoucher) {
  const price = parseFloat(variant?.price || 0);
  if (!price) return { finalPrice: 0, discount: 0, voucher: null };
  if (cartVoucher) {
    const d = calcDiscHome(cartVoucher, price, productId, categoryId, variant?.id);
    if (d > 0) return { finalPrice: Math.max(0, price - d), discount: d, voucher: cartVoucher };
  }
  let bestVoucher = null, bestDisc = 0;
  for (const vou of (voucherList || [])) {
    const d = calcDiscHome(vou, price, productId, categoryId, variant?.id);
    if (d > bestDisc) { bestDisc = d; bestVoucher = vou; }
  }
  return {
    finalPrice: bestDisc > 0 ? Math.max(0, price - bestDisc) : price,
    discount: bestDisc,
    voucher: bestVoucher,
  };
}

// ── Product card — giống hệt Product.jsx ─────────────────────
function ProductCard({ product, badge, onClick, voucherList, cartVoucher, toast }) {
  const navigate = useNavigate();
  const variants = product.variants || [];
  const [activeColor, setActiveColor] = useState(null);
  const { addItem } = useCart();

  const handleAddToCart = (e) => {
    e.stopPropagation();
    const target = activeColor
      ? variants.find(v => v.color === activeColor)
      : variants.length > 0 ? [...variants].sort((a, b) => parseFloat(a.price||0) - parseFloat(b.price||0))[0] : null;
    if (!target) return;
    addItem(product, target, 1);
    toast.success("Đã thêm vào giỏ hàng!");
  };

  // unique colors
  const colors = [...new Set(variants.map(v => v.color).filter(Boolean))];

  // pick display variant based on active color or cheapest
  const displayVariant = (() => {
    if (activeColor) return variants.find(v => v.color === activeColor) || null;
    return variants.length > 0
      ? [...variants].sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0))[0]
      : null;
  })();

  const basePrice = displayVariant ? parseFloat(displayVariant.price) : parseFloat(product.min_price || 0);
  const { finalPrice, voucher: bestVoucher } = displayVariant
    ? getBestHome(displayVariant, product.id, product.category_id, voucherList, cartVoucher)
    : { finalPrice: basePrice, voucher: null };
  const hasDisc = finalPrice > 0 && finalPrice < basePrice;

  const comboLabel = displayVariant
    ? [displayVariant.ram, displayVariant.storage].filter(Boolean).join(" · ")
    : null;

  return (
    <article
      onClick={onClick}
      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-300
        hover:-translate-y-0.5 cursor-pointer
        bg-[#00000001] backdrop-blur-[2px]
        shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
        hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.60),inset_1px_0_0_rgba(255,255,255,0.48),inset_0_-1px_1px_rgba(0,0,0,0.20),inset_-1px_0_1px_rgba(0,0,0,0.18),0_8px_32px_rgba(0,0,0,0.4)]"
    >
      <div className="w-full h-32 bg-gradient-to-br from-gray-800 to-gray-900
        flex items-center justify-center relative overflow-hidden">
        {(displayVariant?.image || product.image)
          ? <img src={displayVariant?.image || product.image} alt={product.name}
              className="w-full h-full object-contain p-2" />
          : <Package size={24} className="text-white/10" />}
        {hasDisc && bestVoucher ? (
          <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white
            text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-tight">
            {bestVoucher.type === "percent" ? `-${bestVoucher.value}%` : `-${(basePrice - finalPrice).toLocaleString("vi-VN")}đ`}
          </div>
        ) : badge ? (
          <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white
            text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-tight">
            {badge}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5 p-2.5">
        <h3 className="font-semibold text-white text-xs leading-snug line-clamp-2
          hover:text-orange-400 transition">
          {product.name}
        </h3>

        {comboLabel && (
          <span className="inline-block px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[9px] font-semibold text-white/50 w-fit">
            {comboLabel}
          </span>
        )}

        {colors.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {colors.map(col => {
              const hasStock = variants.some(v => v.color === col && (v.stock ?? 1) > 0);
              const isActive = activeColor === col;
              return (
                <button key={col}
                  onClick={e => { e.stopPropagation(); if (hasStock) setActiveColor(prev => prev === col ? null : col); }}
                  disabled={!hasStock} title={!hasStock ? `${col} - Hết hàng` : col}
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

        {/* Rating — luôn chiếm chiều cao cố định để nút Mua thẳng hàng */}
        <div className="h-5 flex items-center">
          {product.rating_avg > 0 && (
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(n => (
                <svg key={n} width="9" height="9" viewBox="0 0 24 24"
                  fill={n <= Math.round(product.rating_avg) ? "#f59e0b" : "none"}
                  stroke="#f59e0b" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
              <span className="text-[9px] text-white/30 ml-0.5">({product.rating_count})</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto pt-1 gap-1">
          <div className="min-w-0">
            {hasDisc && (
              <p className="text-[#ff3b30]/40 text-[9px] line-through leading-none">
                {basePrice.toLocaleString("vi-VN")}đ
              </p>
            )}
            <p className="font-bold text-sm leading-tight truncate text-[#ff3b30]">
              {finalPrice ? finalPrice.toLocaleString("vi-VN") + "đ" : "Liên hệ"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0 mt-auto">
            <button onClick={handleAddToCart} className="shrink-0 h-7 w-14 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition focus:outline-none">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </button>
            <button onClick={e => { e.stopPropagation(); navigate(`/product/${product.id}`); }} className="shrink-0 h-7 w-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-medium transition flex items-center justify-center focus:outline-none">
              Mua
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Featured Products Section ─────────────────────────────────
function FeaturedProducts({ navigate }) {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [voucherList, setVoucherList] = useState([]);
  const { voucher: cartVoucher } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/home/featured/?limit=8`)
      .then(r => r.json())
      .then(async (featuredData) => {
        const featured = featuredData.products || [];
        // Fetch detail for each product to get variants
        const detailed = await Promise.all(
          featured.map(fp =>
            fetch(`${API}/api/product/${fp.id}/detail/`)
              .then(r => r.json())
              .then(d => ({ ...fp, variants: d.variants || [] }))
              .catch(() => fp)
          )
        );
        setProducts(detailed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${API}/api/voucher/active/`)
      .then(r => r.json())
      .then(d => setVoucherList(d.vouchers || []))
      .catch(() => {});
  }, []);

  const BADGES = ["Bán chạy nhất", "Đánh giá cao", null, null, null, null, null, null];

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  if (products.length === 0) return null;

  return (
    <section className="relative z-10 px-10 pb-16">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Sản phẩm gợi ý</h2>
            <p className="text-xs text-white/30 mt-0.5">Những sản phẩm nổi bật tại PHONEZONE</p>
          </div>
          <button
            onClick={() => navigate("/product")}
            className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition
              px-3 py-1.5 rounded-xl border border-orange-500/20 hover:border-orange-500/40 bg-orange-500/5"
          >
            Xem tất cả <ChevronRight size={12} />
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {products.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              badge={BADGES[i] || null}
              onClick={() => navigate(`/product/${p.id}`)}
              voucherList={voucherList}
              cartVoucher={cartVoucher}
              toast={toast}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Main Home ─────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const { totalCount } = useCart();
  const { toast, toasts, removeToast } = useToast();
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmLogout,setConfirmLogout]= useState(false);
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
    const fn = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleLogout = () => {
    clearSession("user");
    setConfirmLogout(false);
    sessionStorage.setItem("logout_toast", "Đã đăng xuất thành công!");
    navigate("/login");
  };

  // Hiển thị toast sau khi đăng nhập / đăng ký thành công
  useEffect(() => {
    const msg = sessionStorage.getItem("login_toast");
    if (msg) {
      sessionStorage.removeItem("login_toast");
      setTimeout(() => toast.success(msg), 100);
    }
  }, []); // eslint-disable-line

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center scale-105"
        style={{ backgroundImage: `url(${bgImage})` }} />
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Gradient fade — hero → products */}
      <div className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, #1C1C1E)" }} />

      {/* LOGOUT DIALOG */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmLogout(false)} />
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
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition border border-white/10">
                Hủy
              </button>
              <button onClick={handleLogout}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition focus:outline-none">
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-4 bg-[#0a0a0a] border-b border-white/[0.06]">
        <div className="text-2xl font-bold cursor-pointer" onClick={() => navigate("/")}>PHONEZONE</div>

        <div className="flex gap-8 text-gray-300">
          <Link to="/"        className="text-white font-medium transition">Trang chủ</Link>
          <Link to="/product" className="hover:text-white transition">Sản phẩm</Link>
          <Link to="/blog"    className="hover:text-white transition">Bài viết</Link>
        </div>

        <div className="flex gap-5 items-center text-gray-300">
          <button onClick={() => setSearchOpen(true)} className="text-gray-300 hover:text-white transition focus:outline-none">
            <Search size={20} />
          </button>
          <button onClick={() => navigate(isLoggedIn() ? "/cart" : "/login")} className="relative focus:outline-none">
            <ShoppingCart className="hover:text-white transition" size={22} />
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
                  ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20"
                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                <ChevronDown size={14} className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                    {user.avatar
                      ? <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      : <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{user.fullName}</p>
                      <p className="text-xs text-white/40 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button onClick={() => { setDropdownOpen(false); navigate("/information"); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition">
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
            <button onClick={() => navigate("/login")}>
              <User className="hover:text-white transition" size={22} />
            </button>
          )}
        </div>
      </nav>

      {/* HERO */}
      <div className="relative z-10 pt-24">
        <section className="flex flex-col items-center justify-center text-center py-32 px-6">
          <p className="text-orange-400 text-sm tracking-widest uppercase mb-4 font-medium">
            Chào mừng đến với PHONEZONE
          </p>
          <h1 className="text-5xl font-bold mb-6 drop-shadow-lg
            bg-gradient-to-r from-gray-200 to-gray-400 bg-clip-text text-transparent leading-tight">
            Công nghệ trong tầm tay bạn
          </h1>
          <p className="text-gray-400 max-w-xl mb-10 text-base leading-relaxed">
            Khám phá các dòng điện thoại mới nhất với hiệu năng mạnh mẽ, camera sắc nét và thiết kế tuyệt vời nhất.
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <Link to="/product"
              className="px-8 py-3 rounded-full bg-orange-500 hover:bg-orange-600
                text-white font-semibold text-sm transition duration-300 shadow-lg shadow-orange-500/30">
              Khám phá ngay
            </Link>
            <Link to="/blog"
              className="px-8 py-3 rounded-full bg-white/10 border border-white/20
                backdrop-blur-md hover:bg-white/20 text-sm transition duration-300">
              Đọc bài viết
            </Link>
          </div>
        </section>
      </div>

      {/* FEATURED PRODUCTS */}
      <div className="relative" style={{ background: "#1C1C1E" }}>
        {/* Separator gradient */}
        <div className="h-16 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent, #1C1C1E)" }} />
        <FeaturedProducts navigate={navigate} />
        <Footer />
      </div>
    </div>
  );
}