import { useState, useEffect, useRef } from "react";
import { BlockRenderer } from "./Blockeditor";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCart } from "./Cart";
import {
  User, LogOut, Settings, ShoppingCart, ChevronDown,
  AlertTriangle, ShoppingBag, ChevronLeft, ChevronRight, Package,
  Shield, Truck, RotateCcw, ZapIcon
} from "lucide-react";

const API = "http://localhost:8000";

const applyVoucherDiscount = (price, voucher) => {
  if (!price || !voucher) return price;
  let disc = 0;
  if (voucher.type === "percent") disc = Math.round(price * Math.min(voucher.value, 100) / 100);
  if (voucher.type === "fixed")   disc = voucher.value;
  if (voucher.max_discount && disc > voucher.max_discount) disc = voucher.max_discount;
  return Math.max(0, price - disc);
};

export default function InformationProduct() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addItem, setShow, voucher, totalCount } = useCart();

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
  const [product,         setProduct]         = useState(null);
  const [variants,        setVariants]         = useState([]);
  const [images,          setImages]           = useState([]);
  const [related,         setRelated]          = useState([]);
  const [productContent,  setProductContent]   = useState([]);
  const [loading,         setLoading]          = useState(true);
  const [notFound,        setNotFound]         = useState(false);

  // ── UI state ───────────────────────────────────────────────
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeImg,       setActiveImg]       = useState(0);
  const [activeTab,       setActiveTab]       = useState("info");
  const [qty,             setQty]             = useState(1);
  const [addToast,        setAddToast]        = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/product/${id}/detail/`)
      .then(r => { if (!r.ok) { setNotFound(true); return null; } return r.json(); })
      .then(data => {
        if (!data) return;
        setProduct(data.product || data);
        setVariants(data.variants || []);
        setImages(data.images || []);
        setRelated(data.related || []);
        setProductContent(data.blocks || []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Variant helpers ────────────────────────────────────────
  const parseSize = (s) => {
    if (!s) return 0;
    const m = String(s).match(/([\d.]+)\s*(GB|TB|MB)?/i);
    if (!m) return 0;
    const n = parseFloat(m[1]);
    const u = (m[2] || "GB").toUpperCase();
    if (u === "TB") return n * 1024;
    if (u === "MB") return n / 1024;
    return n;
  };
  const parseRam = parseSize;

  const colors   = [...new Set(variants.map(v => v.color).filter(Boolean))];
  const storages = [...new Set(variants.map(v => v.storage).filter(Boolean))].sort((a, b) => parseSize(a) - parseSize(b));
  const rams     = [...new Set(variants.map(v => v.ram).filter(Boolean))].sort((a, b) => parseRam(a) - parseRam(b));

  const [selColor,   setSelColor]   = useState(null);
  const [selStorage, setSelStorage] = useState(null);
  const [selRam,     setSelRam]     = useState(null);

  // ── Init selections: từ URL param ram/storage hoặc mặc định ──
  useEffect(() => {
    if (variants.length === 0) return;

    const paramRam     = searchParams.get("ram");
    const paramStorage = searchParams.get("storage");

    if (paramRam || paramStorage) {
      // Tìm biến thể khớp với ram/storage từ URL
      const target = variants.find(v =>
        (!paramRam     || v.ram     === paramRam) &&
        (!paramStorage || v.storage === paramStorage)
      ) || variants.find(v =>
        (!paramStorage || v.storage === paramStorage)
      );

      if (target) {
        setSelColor(target.color   || null);
        setSelStorage(target.storage || null);
        setSelRam(target.ram || null);
        return;
      }
    }
    // Mặc định: biến thể đầu tiên
    setSelColor(variants[0].color   || null);
    setSelStorage(variants[0].storage || null);
    setSelRam(variants[0].ram || null);
  }, [variants, searchParams]);

  // ── Sync selectedVariant từ selColor/selStorage/selRam ────
  useEffect(() => {
    if (variants.length === 0) return;
    const match =
      variants.find(v =>
        (!selColor   || v.color   === selColor) &&
        (!selStorage || v.storage === selStorage) &&
        (!selRam     || v.ram     === selRam)
      ) ||
      variants.find(v =>
        (!selColor   || v.color   === selColor) &&
        (!selStorage || v.storage === selStorage)
      ) ||
      variants.find(v =>
        (!selColor || v.color === selColor)
      ) ||
      variants[0];

    if (match) {
      setSelectedVariant(match);
      if (match.image) setActiveImg(-1);
    }
  }, [selColor, selStorage, selRam, variants]);

  // ── Kiểm tra biến thể khả dụng với combo hiện tại ─────────
  // Trả về true nếu có biến thể thoả mãn field=value + các field khác đang chọn
  const hasVariantWith = (field, value) => variants.some(v => {
    if (v[field] !== value) return false;
    // Không ràng buộc field đang xét
    if (field !== "color"   && selColor   && v.color   !== selColor)   return false;
    if (field !== "storage" && selStorage && v.storage !== selStorage) return false;
    if (field !== "ram"     && selRam     && v.ram     !== selRam)     return false;
    return true;
  });

  // ── Xử lý chọn màu: reset storage/ram nếu combo không tồn tại ──
  const handleSelectColor = (col) => {
    setSelColor(col);
    // Kiểm tra xem combo hiện tại (col + selStorage + selRam) có tồn tại không
    const comboExists = variants.some(v =>
      v.color === col &&
      (!selStorage || v.storage === selStorage) &&
      (!selRam     || v.ram     === selRam)
    );
    if (!comboExists) {
      // Tìm biến thể đầu tiên có màu này và lấy storage/ram của nó
      const firstOfColor = variants.find(v => v.color === col);
      if (firstOfColor) {
        setSelStorage(firstOfColor.storage || null);
        setSelRam(firstOfColor.ram || null);
      }
    }
  };

  const handleSelectStorage = (s) => {
    setSelStorage(s);
    const comboExists = variants.some(v =>
      (!selColor || v.color === selColor) &&
      v.storage === s &&
      (!selRam || v.ram === selRam)
    );
    if (!comboExists) {
      const fm = variants.find(v => (!selColor || v.color === selColor) && v.storage === s);
      if (fm) setSelRam(fm.ram || null);
    }
  };

  const handleSelectRam = (r) => {
    setSelRam(r);
    const comboExists = variants.some(v =>
      (!selColor   || v.color   === selColor) &&
      (!selStorage || v.storage === selStorage) &&
      v.ram === r
    );
    if (!comboExists) {
      const fm = variants.find(v => (!selColor || v.color === selColor) && v.ram === r);
      if (fm) setSelStorage(fm.storage || null);
    }
  };

  const currentPrice = selectedVariant ? parseInt(selectedVariant.price) : 0;

  const discountedPrice = (() => {
    if (!currentPrice || !voucher || !selectedVariant) return currentPrice;
    const vApply =
      !voucher.scope || voucher.scope === "all" ||
      (voucher.scope === "category" && String(product?.category_id) === String(voucher.category_id)) ||
      (voucher.scope === "product"  && String(product?.id)          === String(voucher.product_id));
    if (!vApply) return currentPrice;
    return applyVoucherDiscount(currentPrice, voucher);
  })();

  const hasDiscount  = discountedPrice < currentPrice;
  const currentStock = selectedVariant ? selectedVariant.stock : 0;

  const handleAddToCart = (buyNow = false) => {
    if (!selectedVariant || currentStock === 0) return;
    addItem(
      { id: product.id, name: product.name, image: images[0]?.url || images[0] || "", categoryId: product.category_id },
      {
        id:      selectedVariant.id,
        color:   selectedVariant.color,
        storage: selectedVariant.storage,
        ram:     selectedVariant.ram,
        price:   parseFloat(selectedVariant.price) || 0,
        image:   selectedVariant.image,
        stock:   parseInt(selectedVariant.stock) || 0,
      },
      qty
    );
    if (buyNow) { setShow(false); navigate("/cart"); }
    else { setAddToast(true); setTimeout(() => setAddToast(false), 2500); }
  };

  const specsGroups = selectedVariant ? [
    { label: "Bộ xử lý",          color: "text-blue-400",   rows: [["CPU", selectedVariant.cpu], ["Hệ điều hành", selectedVariant.os]].filter(([, v]) => v) },
    { label: "Bộ nhớ & Lưu trữ",  color: "text-green-400",  rows: [["RAM", selectedVariant.ram], ["Bộ nhớ", selectedVariant.storage]].filter(([, v]) => v) },
    { label: "Màn hình",           color: "text-purple-400", rows: [["Kích thước", selectedVariant.screen_size], ["Công nghệ", selectedVariant.screen_tech], ["Tần số quét", selectedVariant.refresh_rate]].filter(([, v]) => v) },
    { label: "Camera",             color: "text-yellow-400", rows: [["Camera trước", selectedVariant.front_camera], ["Camera sau", selectedVariant.rear_camera]].filter(([, v]) => v) },
    { label: "Pin & Sạc",          color: "text-orange-400", rows: [["Dung lượng pin", selectedVariant.battery], ["Tốc độ sạc", selectedVariant.charging_speed]].filter(([, v]) => v) },
    { label: "Khác",               color: "text-gray-400",   rows: [["Màu sắc", selectedVariant.color], ["Trọng lượng", selectedVariant.weights], ["Cập nhật OS", selectedVariant.updates]].filter(([, v]) => v) },
  ].filter(g => g.rows.length > 0) : [];

  // ── Render guards ──────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#1C1C1E] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  if (notFound || !product) return (
    <div className="min-h-screen bg-[#1C1C1E] flex flex-col items-center justify-center gap-4 text-white/40">
      <Package size={48} className="opacity-30" />
      <p>Không tìm thấy sản phẩm</p>
      <button onClick={() => navigate("/product")} className="text-orange-400 text-sm hover:underline">← Quay lại</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1C1C1E] text-white">

      {/* TOAST */}
      {addToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium bg-green-500/20 border border-green-500/40 text-green-300 backdrop-blur-md">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Đã thêm vào giỏ hàng thành công!
          <button onClick={() => navigate("/cart")} className="ml-2 text-xs text-white/60 hover:text-white underline transition">Xem giỏ</button>
        </div>
      )}

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

      <div className="pt-[64px]">
        {/* BREADCRUMB */}
        <div className="px-10 py-4 flex items-center gap-2 text-xs text-white/30 border-b border-white/5">
          <button onClick={() => navigate("/")} className="hover:text-white transition">Trang chủ</button>
          <ChevronRight size={12} />
          <button onClick={() => navigate("/product")} className="hover:text-white transition">Sản phẩm</button>
          <ChevronRight size={12} />
          <span className="text-white/60 truncate max-w-xs">{product.name}</span>
        </div>

        {/* PRODUCT DETAIL */}
        <div className="px-10 py-8 flex gap-10">

          {/* LEFT: ẢNH */}
          <div className="w-[420px] shrink-0 flex flex-col gap-3">
            <div className="w-full h-[380px] rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden flex items-center justify-center border border-white/5 relative">
              {activeImg === -1 && selectedVariant?.image ? (
                <img src={selectedVariant.image} alt={product.name} className="w-full h-full object-contain p-6" />
              ) : images.length > 0 ? (
                <>
                  <img src={images[Math.max(0, activeImg)]?.url || images[Math.max(0, activeImg)]} alt={product.name} className="w-full h-full object-contain p-6" />
                  {images.length > 1 && (
                    <>
                      <button onClick={() => setActiveImg(i => { const idx = i < 0 ? 0 : i; return (idx - 1 + images.length) % images.length; })}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center transition">
                        <ChevronLeft size={16} />
                      </button>
                      <button onClick={() => setActiveImg(i => { const idx = i < 0 ? 0 : i; return (idx + 1) % images.length; })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center transition">
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <Package size={64} className="text-white/10" />
              )}
            </div>
            {(images.length > 0 || selectedVariant?.image) && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedVariant?.image && (
                  <button onClick={() => setActiveImg(-1)}
                    className={`w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition relative ${activeImg === -1 ? "border-orange-500" : "border-white/10 hover:border-white/30"}`}>
                    <img src={selectedVariant.image} alt="" className="w-full h-full object-contain p-1 bg-gray-900" />
                    <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-orange-500 text-white px-1 rounded">BT</span>
                  </button>
                )}
                {images.map((img, i) => (
                  <button key={i} onClick={() => setActiveImg(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition ${activeImg === i ? "border-orange-500" : "border-white/10 hover:border-white/30"}`}>
                    <img src={img?.url || img} alt="" className="w-full h-full object-contain p-1 bg-gray-900" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: INFO */}
          <div className="flex-1 flex flex-col gap-5">
            <div>
              {product.brand && <p className="text-xs text-orange-400 uppercase tracking-widest mb-1">{product.brand}</p>}
              <h1 className="text-2xl font-bold leading-tight">{product.name}</h1>
              {product.category && (
                <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40">{product.category}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-3 flex-wrap">
                {hasDiscount && <span className="text-xl text-white/30 line-through">{currentPrice.toLocaleString("vi-VN")}đ</span>}
                <span className={`text-3xl font-bold ${hasDiscount ? "text-orange-400" : "text-[#ff3b30]"}`}>
                  {discountedPrice ? discountedPrice.toLocaleString("vi-VN") + "đ" : "Liên hệ"}
                </span>
                {currentStock > 0
                  ? <span className="text-xs text-green-400">Còn hàng ({currentStock})</span>
                  : <span className="text-xs text-red-400">Hết hàng</span>}
              </div>
              {hasDiscount && voucher && (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-orange-500/15 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full font-medium">
                    🏷 {voucher.code} -{voucher.type === "percent" ? `${voucher.value}%` : `${parseInt(voucher.value).toLocaleString("vi-VN")}đ`}
                  </span>
                  <span className="text-xs text-green-400">Tiết kiệm {(currentPrice - discountedPrice).toLocaleString("vi-VN")}đ</span>
                </div>
              )}
            </div>

            {/* Màu sắc */}
            {colors.length > 0 && (
              <div>
                <p className="text-xs text-white/40 mb-2">Màu sắc: <span className="text-white/70">{selColor || "—"}</span></p>
                <div className="flex flex-wrap gap-2">
                  {colors.map(col => {
                    // Kiểm tra màu này có biến thể khả dụng không (không ràng buộc storage/ram)
                    const avail = variants.some(v => v.color === col);
                    return (
                      <button key={col}
                        onClick={() => avail && handleSelectColor(col)}
                        disabled={!avail}
                        className={`px-3 py-1.5 rounded-xl text-sm border transition
                          ${selColor === col
                            ? "bg-white text-black border-white font-medium"
                            : avail
                              ? "bg-white/5 border-white/15 text-white/60 hover:border-white/40"
                              : "bg-white/[0.02] border-white/5 text-white/20 cursor-not-allowed line-through"}`}>
                        {col}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RAM */}
            {rams.length > 0 && (
              <div>
                <p className="text-xs text-white/40 mb-2">RAM: <span className="text-white/70">{selRam || "—"}</span></p>
                <div className="flex flex-wrap gap-2">
                  {rams.map(r => {
                    const avail = variants.some(v => (!selColor || v.color === selColor) && v.ram === r);
                    return (
                      <button key={r}
                        onClick={() => avail && handleSelectRam(r)}
                        disabled={!avail}
                        className={`px-3 py-1.5 rounded-xl text-sm border transition
                          ${selRam === r
                            ? "bg-blue-500/20 border-blue-500 text-blue-300 font-medium"
                            : avail
                              ? "bg-white/5 border-white/15 text-white/60 hover:border-white/40"
                              : "bg-white/[0.02] border-white/5 text-white/20 cursor-not-allowed line-through"}`}>
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bộ nhớ */}
            {storages.length > 0 && (
              <div>
                <p className="text-xs text-white/40 mb-2">Bộ nhớ: <span className="text-white/70">{selStorage || "—"}</span></p>
                <div className="flex flex-wrap gap-2">
                  {storages.map(s => {
                    const avail = variants.some(v =>
                      (!selColor || v.color === selColor) &&
                      (!selRam   || v.ram   === selRam) &&
                      v.storage === s
                    );
                    return (
                      <button key={s}
                        onClick={() => avail && handleSelectStorage(s)}
                        disabled={!avail}
                        className={`px-3 py-1.5 rounded-xl text-sm border transition
                          ${selStorage === s
                            ? "bg-orange-500/20 border-orange-500 text-orange-300 font-medium"
                            : avail
                              ? "bg-white/5 border-white/15 text-white/60 hover:border-white/40"
                              : "bg-white/[0.02] border-white/5 text-white/20 cursor-not-allowed line-through"}`}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Số lượng + Nút mua */}
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-white/10 rounded-xl overflow-hidden">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition text-lg">−</button>
                <span className="w-10 text-center text-sm">{qty}</span>
                <button onClick={() => setQty(q => Math.min(currentStock, q + 1))} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition text-lg">+</button>
              </div>
              <button onClick={() => handleAddToCart(false)} disabled={currentStock === 0}
                className="flex-1 h-11 rounded-xl bg-[rgba(255,149,0,0.8)] hover:bg-[rgba(255,149,0,1)] disabled:opacity-40 disabled:cursor-not-allowed border border-[#ff9500] text-white font-semibold text-sm transition">
                Thêm vào giỏ hàng
              </button>
              <button onClick={() => handleAddToCart(true)} disabled={currentStock === 0}
                className="flex-1 h-11 rounded-xl bg-[#ff3b30] hover:bg-[#e0352a] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition">
                Mua ngay
              </button>
            </div>

            {/* Cam kết */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
              {[
                { icon: Shield,    text: "Bảo hành 12 tháng" },
                { icon: Truck,     text: "Giao hàng toàn quốc" },
                { icon: RotateCcw, text: "Đổi trả trong 7 ngày" },
                { icon: ZapIcon,   text: "Hỗ trợ 24/7" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-white/40">
                  <Icon size={14} className="text-orange-400 shrink-0" />{text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="px-10 pb-10">
          <div className="flex gap-1 border-b border-white/10 mb-6">
            {[{ key: "info", label: "Mô tả sản phẩm" }, { key: "specs", label: "Thông tin sản phẩm" }, { key: "review", label: "Đánh giá" }].map(({ key, label }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`px-5 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === key ? "text-orange-400 border-orange-500" : "text-white/40 border-transparent hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>

          {activeTab === "info" && (
            <div className="max-w-3xl">
              {productContent.length > 0
                ? <BlockRenderer blocks={productContent} />
                : product.description
                  ? <div className="prose-custom text-white/70 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: product.description }} />
                  : <p className="text-white/20 text-sm italic">Chưa có mô tả sản phẩm</p>}
            </div>
          )}

          {activeTab === "specs" && (
            <div className="max-w-3xl flex flex-col gap-4">
              {specsGroups.length === 0
                ? <p className="text-white/20 text-sm italic">Chưa có thông số kỹ thuật</p>
                : specsGroups.map(group => (
                  <div key={group.label} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5">
                      <h3 className={`text-xs font-semibold uppercase tracking-wider ${group.color}`}>{group.label}</h3>
                    </div>
                    {group.rows.map(([label, value], i) => (
                      <div key={label} className={`flex px-5 py-3 text-sm ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
                        <span className="w-44 shrink-0 text-white/40">{label}</span>
                        <span className="text-white/80">{value}</span>
                      </div>
                    ))}
                  </div>
                ))
              }
              {specsGroups.length > 0 && variants.length > 1 && (
                <p className="text-xs text-white/20 italic">* Thông số hiển thị cho biến thể: {[selColor, selStorage].filter(Boolean).join(" / ")}</p>
              )}
            </div>
          )}

          {activeTab === "review" && (
            <div className="max-w-3xl flex flex-col items-center py-12 text-white/20 gap-3">
              <span className="text-4xl">⭐</span>
              <p className="text-sm">Chưa có đánh giá nào</p>
            </div>
          )}
        </div>

        {/* SẢN PHẨM LIÊN QUAN */}
        {related.length > 0 && (
          <div className="px-10 pb-12 border-t border-white/5 pt-8">
            <h2 className="text-lg font-semibold mb-5">Sản phẩm tương tự</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {related.map(p => (
                <article key={p.id} onClick={() => navigate(`/product/${p.id}`)}
                  className="flex flex-col gap-3 p-3 rounded-[20px] cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1 bg-[#00000001] backdrop-blur-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.60),inset_1px_0_0_rgba(255,255,255,0.48),inset_0_-1px_1px_rgba(0,0,0,0.20),inset_-1px_0_1px_rgba(0,0,0,0.18),0_8px_32px_rgba(0,0,0,0.4)]">
                  <div className="w-full h-36 rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-contain p-2" /> : <Package size={28} className="text-white/10" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm line-clamp-2 leading-snug mb-1">{p.name}</h3>
                    {(() => {
                      const op = parseFloat(p.min_price || 0);
                      let dp = op, hasDis = false;
                      if (voucher && op && voucher.scope === "all") {
                        dp = voucher.type === "percent" ? Math.round(op * (1 - Math.min(voucher.value,100)/100)) : Math.max(0, op - voucher.value);
                        hasDis = dp < op;
                      }
                      return (
                        <div className="text-right">
                          {hasDis && <p className="text-white/30 text-xs line-through leading-none">{op.toLocaleString("vi-VN")}đ</p>}
                          <p className={`font-semibold text-sm ${hasDis ? "text-orange-400" : "text-[#ff3b30]"}`}>{dp ? dp.toLocaleString("vi-VN") + "đ" : "Liên hệ"}</p>
                        </div>
                      );
                    })()}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}