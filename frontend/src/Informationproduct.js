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

// ── Kiểm tra voucher có áp dụng cho variant cụ thể không ──
const voucherAppliesToVariant = (voucher, product, variant) => {
  if (!voucher) return false;
  const scope = voucher.scope || "all";

  if (scope === "all") return true;

  if (scope === "category") {
    return String(product?.category_id) === String(voucher.category_id);
  }

  if (scope === "product") {
    // Phải đúng product
    if (String(product?.id) !== String(voucher.product_id)) return false;
    // Nếu voucher có variant_id → phải đúng variant
    if (voucher.variant_id) {
      return variant && String(variant.id) === String(voucher.variant_id);
    }
    // Không có variant_id → áp dụng toàn sản phẩm
    return true;
  }

  return false;
};

export default function InformationProduct() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [addToast, setAddToast] = useState(false);
  const navigate = useNavigate();
  const { addItem, setShow, voucher, fetchBestVoucherForProduct, totalCount } = useCart();

  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [productBestVoucher, setProductBestVoucher] = useState(null);
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const dropdownRef = useRef(null);

  const [product,        setProduct]        = useState(null);
  const [variants,       setVariants]       = useState([]);
  const [images,         setImages]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [notFound,       setNotFound]       = useState(false);
  const [selectedVariant,setSelectedVariant]= useState(null);
  const [activeImg,      setActiveImg]      = useState(0);
  const [activeTab,      setActiveTab]      = useState("info");
  const [productContent, setProductContent] = useState([]);
  const [qty,            setQty]            = useState(1);
  const [related,        setRelated]        = useState([]);

  const [selColor,   setSelColor]   = useState(null);
  const [selCombo,   setSelCombo]   = useState(null);

  const allColors = [...new Set(variants.map(v => v.color).filter(Boolean))];

  const allComboMap = {};
  for (const v of variants) {
    if (!v.price) continue;
    const key = `${v.ram || ""}|${v.storage || ""}`;
    if (!allComboMap[key] || parseFloat(v.price) < parseFloat(allComboMap[key].price)) {
      allComboMap[key] = v;
    }
  }
  const allCombos = Object.values(allComboMap).sort((a, b) => {
    const sd = parseGB(a.storage) - parseGB(b.storage);
    return sd !== 0 ? sd : parseGB(a.ram) - parseGB(b.ram);
  });

  const availableColors = selCombo
    ? allColors.filter(col => variants.some(v => v.color === col && `${v.ram || ""}|${v.storage || ""}` === selCombo))
    : allColors;

  const availableCombos = selColor
    ? allCombos.filter(c => variants.some(v => v.color === selColor && `${v.ram || ""}|${v.storage || ""}` === `${c.ram || ""}|${c.storage || ""}`))
    : allCombos;

  useEffect(() => {
    if (!variants.length) return;
    let match = null;
    if (selColor && selCombo) {
      match = variants.find(v => v.color === selColor && `${v.ram || ""}|${v.storage || ""}` === selCombo);
    } else if (selCombo) {
      const candidates = variants.filter(v => `${v.ram || ""}|${v.storage || ""}` === selCombo);
      match = candidates.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
    } else if (selColor) {
      const candidates = variants.filter(v => v.color === selColor);
      match = candidates.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
    } else {
      match = [...variants].sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0))[0];
    }
    if (match) {
      setSelectedVariant(match);
      if (match.image) setActiveImg(-1);
    }
  }, [selColor, selCombo, variants]);

  const handleColorClick = (col) => {
    if (selColor === col) { setSelColor(null); return; }
    setSelColor(col);
    if (selCombo) {
      const ok = variants.some(v => v.color === col && `${v.ram || ""}|${v.storage || ""}` === selCombo);
      if (!ok) setSelCombo(null);
    }
  };

  const handleComboClick = (comboKey) => {
    if (selCombo === comboKey) { setSelCombo(null); return; }
    setSelCombo(comboKey);
    if (selColor) {
      const ok = variants.some(v => v.color === selColor && `${v.ram || ""}|${v.storage || ""}` === comboKey);
      if (!ok) setSelColor(null);
    }
  };

  const currentPrice = selectedVariant ? parseInt(selectedVariant.price) : 0;
  const currentStock = selectedVariant ? selectedVariant.stock : 0;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/product/${id}/detail/`).then(r => r.json()),
      fetch(`${API}/api/product/${id}/content/`).then(r => r.json()),
    ]).then(([detail, content]) => {
      if (!detail.product) { setNotFound(true); return; }
      setProduct(detail.product);
      setVariants(detail.variants || []);
      setImages(detail.images || []);
      setRelated(detail.related || []);
      setProductContent(content?.content?.blocks || []);
    }).catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!product?.id || !currentPrice) return;
    fetchBestVoucherForProduct(product.id, product.category_id, currentPrice, 1)
      .then(data => setProductBestVoucher(data))
      .catch(() => {});
  }, [product?.id, currentPrice]);

  useEffect(() => {
    const sync = () => setUser(JSON.parse(localStorage.getItem("user") || "null"));
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("userUpdated", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("focus", sync); window.removeEventListener("userUpdated", sync); };
  }, []);

  useEffect(() => {
    const fn = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleLogout = () => { localStorage.removeItem("user"); setConfirmLogout(false); navigate("/login"); };

  useEffect(() => {
    if (!variants.length) return;
    const qColor   = searchParams.get("color")   || null;
    const qRam     = searchParams.get("ram")      || null;
    const qStorage = searchParams.get("storage")  || null;
    if (qColor) setSelColor(qColor);
    if (qRam || qStorage) setSelCombo(`${qRam || ""}|${qStorage || ""}`);
  }, [variants]);

  // ── activeVoucher: kiểm tra đúng variant ──
  const activeVoucher = (() => {
    if (!currentPrice || !selectedVariant) return null;

    // Voucher từ giỏ hàng
    if (voucher && voucherAppliesToVariant(voucher, product, selectedVariant)) {
      return voucher;
    }

    // Voucher tốt nhất riêng sản phẩm
    if (productBestVoucher?.voucher && voucherAppliesToVariant(productBestVoucher.voucher, product, selectedVariant)) {
      return productBestVoucher.voucher;
    }

    return null;
  })();

  const discountedPrice = (activeVoucher && currentPrice) ? applyVoucherDiscount(currentPrice, activeVoucher) : currentPrice;
  const hasDiscount = discountedPrice < currentPrice;

  // ── Tính giá hiển thị trong combo button (có check variant_id) ──
  const getComboDisplayPrice = (comboVariant) => {
    const price = parseFloat(comboVariant.price);
    if (!price) return { price, disc: price, hasD: false, appliedVoucher: null };

    // Thử voucher giỏ hàng
    if (voucher && voucherAppliesToVariant(voucher, product, comboVariant)) {
      const disc = applyVoucherDiscount(price, voucher);
      if (disc < price) return { price, disc, hasD: true, appliedVoucher: voucher };
    }

    // Thử voucher riêng SP
    if (productBestVoucher?.voucher && voucherAppliesToVariant(productBestVoucher.voucher, product, comboVariant)) {
      const disc = applyVoucherDiscount(price, productBestVoucher.voucher);
      if (disc < price) return { price, disc, hasD: true, appliedVoucher: productBestVoucher.voucher };
    }

    return { price, disc: price, hasD: false, appliedVoucher: null };
  };

  const handleAddToCart = (buyNow = false) => {
    if (!selectedVariant || currentStock === 0) return;
    addItem(
      { id: product.id, name: product.name, image: images[0]?.url || "", categoryId: product.category_id },
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
    { label: "Bộ xử lý",          color: "text-blue-400",   rows: [["CPU", selectedVariant.cpu], ["Hệ điều hành", selectedVariant.os]].filter(([,v]) => v) },
    { label: "Bộ nhớ & Lưu trữ", color: "text-green-400",  rows: [["RAM", selectedVariant.ram], ["Bộ nhớ", selectedVariant.storage]].filter(([,v]) => v) },
    { label: "Màn hình",           color: "text-purple-400", rows: [["Kích thước", selectedVariant.screen_size], ["Công nghệ", selectedVariant.screen_tech], ["Tần số quét", selectedVariant.refresh_rate]].filter(([,v]) => v) },
    { label: "Camera",             color: "text-yellow-400", rows: [["Camera trước", selectedVariant.front_camera], ["Camera sau", selectedVariant.rear_camera]].filter(([,v]) => v) },
    { label: "Pin & Sạc",          color: "text-orange-400", rows: [["Dung lượng pin", selectedVariant.battery], ["Tốc độ sạc", selectedVariant.charging_speed]].filter(([,v]) => v) },
    { label: "Khác",               color: "text-gray-400",   rows: [["Màu sắc", selectedVariant.color], ["Trọng lượng", selectedVariant.weights], ["Cập nhật OS", selectedVariant.updates]].filter(([,v]) => v) },
  ].filter(g => g.rows.length > 0) : [];

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

      {addToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium bg-green-500/20 border border-green-500/40 text-green-300 backdrop-blur-md">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Đã thêm vào giỏ hàng thành công!
          <button onClick={() => navigate("/cart")} className="ml-2 text-xs text-white/60 hover:text-white underline">Xem giỏ</button>
        </div>
      )}

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
              <button onClick={() => setConfirmLogout(false)} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10">Hủy</button>
              <button onClick={handleLogout} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-4 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="text-2xl font-bold cursor-pointer" onClick={() => navigate("/")}>PHONEZONE</div>
        <div className="flex gap-8 items-center text-gray-300">
          <Link to="/" className="hover:text-white transition">Trang chủ</Link>
          <Link to="/product" className="text-white font-medium">Sản phẩm</Link>
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
                  ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20" onError={e => e.currentTarget.style.display="none"} />
                  : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                    {user.avatar
                      ? <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" onError={e => e.currentTarget.style.display="none"} />
                      : <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{user.fullName}</p>
                      <p className="text-xs text-white/40 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button onClick={() => { setDropdownOpen(false); navigate("/information"); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition">
                    <ShoppingBag size={15} className="text-orange-400" /> Đơn hàng của tôi
                  </button>
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
        <div className="px-10 py-4 flex items-center gap-2 text-xs text-white/30 border-b border-white/5">
          <button onClick={() => navigate("/")} className="hover:text-white transition">Trang chủ</button>
          <ChevronRight size={12} />
          <button onClick={() => navigate("/product")} className="hover:text-white transition">Sản phẩm</button>
          <ChevronRight size={12} />
          <span className="text-white/60 truncate max-w-xs">{product.name}</span>
        </div>

        <div className="px-10 py-8 flex gap-10">

          {/* ===== ẢNH ===== */}
          <div className="w-[420px] shrink-0 flex flex-col gap-3">
            <div className="w-full h-[380px] rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden flex items-center justify-center border border-white/5 relative">
              {activeImg === -1 && selectedVariant?.image ? (
                <img src={selectedVariant.image} alt={product.name} className="w-full h-full object-contain p-6" />
              ) : images.length > 0 ? (
                <>
                  <img src={images[Math.max(0, activeImg)]?.url || images[Math.max(0, activeImg)]} alt={product.name} className="w-full h-full object-contain p-6" />
                  {images.length > 1 && (
                    <>
                      <button onClick={() => setActiveImg(i => { const x = i < 0 ? 0 : i; return (x - 1 + images.length) % images.length; })}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center transition">
                        <ChevronLeft size={16} />
                      </button>
                      <button onClick={() => setActiveImg(i => { const x = i < 0 ? 0 : i; return (x + 1) % images.length; })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center transition">
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}
                </>
              ) : <Package size={64} className="text-white/10" />}
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

          {/* ===== INFO ===== */}
          <div className="flex-1 flex flex-col gap-5">
            <div>
              {product.brand && <p className="text-xs text-orange-400 uppercase tracking-widest mb-1">{product.brand}</p>}
              <h1 className="text-2xl font-bold leading-tight">{product.name}</h1>
              {product.category && (
                <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40">{product.category}</span>
              )}
            </div>

            {/* Giá */}
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-3 flex-wrap">
                {hasDiscount && <span className="text-xl text-[#ff3b30]/40 line-through">{currentPrice.toLocaleString("vi-VN")}đ</span>}
                <span className="text-3xl font-bold text-[#ff3b30]">
                  {discountedPrice ? discountedPrice.toLocaleString("vi-VN") + "đ" : "Liên hệ"}
                </span>
                {currentStock > 0
                  ? <span className="text-xs text-green-400">Còn hàng ({currentStock})</span>
                  : <span className="text-xs text-red-400">Hết hàng</span>}
              </div>
              {hasDiscount && activeVoucher && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs bg-orange-500/15 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full font-medium">
                    🏷 {activeVoucher.code} -{activeVoucher.type === "percent" ? `${activeVoucher.value}%` : `${parseInt(activeVoucher.value).toLocaleString("vi-VN")}đ`}
                  </span>
                  <span className="text-xs text-green-400">Tiết kiệm {(currentPrice - discountedPrice).toLocaleString("vi-VN")}đ</span>
                  {activeVoucher.id !== voucher?.id && (
                    <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">Voucher riêng SP</span>
                  )}
                </div>
              )}
            </div>

            {/* Màu */}
            {allColors.length > 0 && (
              <div>
                <p className="text-xs text-white/40 mb-2">
                  Màu sắc:
                  {selColor
                    ? <span className="text-white/80 font-medium ml-1">{selColor}</span>
                    : <span className="text-white/30 ml-1 italic text-[11px]">chưa chọn</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {allColors.map(col => {
                    const isAvailable = availableColors.includes(col);
                    const isSelected  = selColor === col;
                    const hasStock    = variants.some(v => v.color === col && (v.stock ?? 1) > 0);
                    return (
                      <button key={col} onClick={() => hasStock && handleColorClick(col)} disabled={!hasStock}
                        className={`px-3 py-1.5 rounded-xl text-sm border transition font-medium
                          ${isSelected
                            ? "bg-white text-black border-white"
                            : !isAvailable || !hasStock
                              ? "bg-white/[0.02] border-white/5 text-white/20 cursor-not-allowed" + (!hasStock ? " line-through" : " opacity-40")
                              : "bg-white/5 border-white/15 text-white/60 hover:border-white/40 hover:text-white"}`}>
                        {col}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cấu hình — dùng getComboDisplayPrice để check đúng variant_id */}
            {allCombos.length > 0 && (
              <div>
                <p className="text-xs text-white/40 mb-2">
                  Cấu hình:
                  {selCombo
                    ? <span className="text-white/80 font-medium ml-1">{selCombo.replace("|", " · ").replace(/^\|/, "").replace(/\|$/, "")}</span>
                    : <span className="text-white/30 ml-1 italic text-[11px]">chưa chọn</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {allCombos.map(v => {
                    const comboKey    = `${v.ram || ""}|${v.storage || ""}`;
                    const isSelected  = selCombo === comboKey;
                    const isAvailable = availableCombos.some(c => `${c.ram || ""}|${c.storage || ""}` === comboKey);
                    const label       = [v.ram, v.storage].filter(Boolean).join(" · ");
                    const { price, disc, hasD } = getComboDisplayPrice(v);

                    return (
                      <button key={comboKey} onClick={() => isAvailable && handleComboClick(comboKey)} disabled={!isAvailable}
                        className={`flex flex-col items-start px-3 py-2 rounded-xl border transition
                          ${isSelected
                            ? "bg-orange-500/20 border-orange-500 text-orange-300"
                            : !isAvailable
                              ? "bg-white/[0.02] border-white/5 text-white/20 cursor-not-allowed opacity-40"
                              : "bg-white/5 border-white/15 text-white/60 hover:border-white/40 hover:text-white"}`}>
                        <span className="text-sm font-semibold">{label || "Mặc định"}</span>
                        <span className={`text-xs mt-0.5 ${hasD ? "text-orange-400" : "text-white/40"}`}>
                          {hasD ? (
                            <>
                              <span className="line-through text-white/25 mr-1 text-[10px]">{price.toLocaleString("vi-VN")}đ</span>
                              {disc.toLocaleString("vi-VN")}đ
                            </>
                          ) : price.toLocaleString("vi-VN") + "đ"}
                        </span>
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
                  <Icon size={14} className="text-orange-400 shrink-0" />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== TABS ===== */}
        <div className="px-10 pb-10">
          <div className="flex gap-1 border-b border-white/10 mb-6">
            {[
              { key: "info",   label: "Mô tả sản phẩm" },
              { key: "specs",  label: "Thông tin sản phẩm" },
              { key: "review", label: "Đánh giá" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`px-5 py-3 text-sm font-medium transition border-b-2 -mb-px
                  ${activeTab === key ? "text-orange-400 border-orange-500" : "text-white/40 border-transparent hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>

          {activeTab === "info" && (
            <div className="max-w-3xl">
              {productContent.length > 0
                ? <BlockRenderer blocks={productContent} />
                : product.description
                  ? <div className="text-white/70 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: product.description }} />
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
            </div>
          )}

          {activeTab === "review" && (
            <div className="max-w-3xl flex flex-col items-center py-12 text-white/20 gap-3">
              <span className="text-4xl">⭐</span>
              <p className="text-sm">Chưa có đánh giá nào</p>
            </div>
          )}
        </div>

        {/* ===== SẢN PHẨM LIÊN QUAN ===== */}
        {related.length > 0 && (
          <div className="px-10 pb-12 border-t border-white/5 pt-8">
            <h2 className="text-lg font-semibold mb-5">Sản phẩm tương tự</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {related.map(p => (
                <article key={p.id} onClick={() => navigate(`/product/${p.id}`)}
                  className="flex flex-col gap-3 p-3 rounded-[20px] cursor-pointer hover:-translate-y-1 transition-all duration-300
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]">
                  <div className="w-full h-36 rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-contain p-2" /> : <Package size={28} className="text-white/10" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm line-clamp-2 leading-snug mb-1">{p.name}</h3>
                    <p className="text-[#ff3b30] font-semibold text-sm text-right">
                      {parseFloat(p.min_price) ? parseFloat(p.min_price).toLocaleString("vi-VN") + "đ" : "Liên hệ"}
                    </p>
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