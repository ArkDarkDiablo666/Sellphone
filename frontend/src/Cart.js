import { useState, useEffect, createContext, useContext, useCallback, useRef  } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart, X, Trash2, Plus, Minus, Tag,
  ChevronRight, Package, ArrowLeft, Check, ShoppingBag,
  User, LogOut, Settings, ChevronDown, AlertTriangle
} from "lucide-react";
import { Link } from "react-router-dom";

const API = "http://localhost:8000";

// ============================================================
// CART CONTEXT
// ============================================================
export const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items,    setItems]    = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("cart_items") || "[]");
      return raw.filter((i) => {
        const p   = parseFloat(i.price);
        const q   = parseInt(i.qty);
        const vid = parseInt(i.variantId);
        return !isNaN(p) && p > 0 && !isNaN(q) && q >= 1 && !isNaN(vid) && String(vid) === String(i.variantId);
      }).map((i) => ({ ...i, price: parseFloat(i.price), qty: parseInt(i.qty) || 1, variantId: parseInt(i.variantId) }));
    } catch { return []; }
  });
  const [show,     setShow]     = useState(false);
  const [voucher,  setVoucher]  = useState(() => { try { return JSON.parse(localStorage.getItem("cart_voucher") || "null"); } catch { return null; } });

  useEffect(() => { localStorage.setItem("cart_items",   JSON.stringify(items));   }, [items]);
  useEffect(() => { localStorage.setItem("cart_voucher", JSON.stringify(voucher)); }, [voucher]);

  const autoApplyBestVoucher = useCallback(async () => {
    if (voucher) return;
    try {
      const res  = await fetch(`${API}/api/voucher/best/`);
      const data = await res.json();
      if (res.ok && data.voucher) setVoucher(data.voucher);
    } catch { /* silent */ }
  }, [voucher]);

  const addItem = (product, variant, qty = 1) => {
    const parsedPrice = parseFloat(variant.price);
    const parsedStock = parseInt(variant.stock) || 9999;
    const parsedQty   = parseInt(qty) || 1;
    if (!parsedPrice || isNaN(parsedPrice)) {
      console.warn("[Cart] addItem: invalid price", variant.price, variant);
      return;
    }
    const key = `${product.id}_${variant.id}`;
    setItems((prev) => {
      const exist = prev.find((i) => i.key === key);
      if (exist) return prev.map((i) => i.key === key ? { ...i, qty: Math.min(i.qty + parsedQty, parsedStock), selected: true } : i);
      return [...prev, {
        key, selected: true,
        productId:   product.id,
        productName: product.name,
        variantId:   variant.id,
        color:       variant.color   || "",
        storage:     variant.storage || "",
        ram:         variant.ram     || "",
        price:       parsedPrice,
        stock:       parsedStock,
        qty:         parsedQty,
        image:       variant.image || product.image || "",
        categoryId:  product.categoryId || null,
      }];
    });
    setShow(true);
    autoApplyBestVoucher();
  };

  const buyNow = (product, variant, qty = 1) => {
    const parsedPrice = parseFloat(variant.price);
    const parsedStock = parseInt(variant.stock) || 9999;
    const parsedQty   = parseInt(qty) || 1;
    if (!parsedPrice || isNaN(parsedPrice)) {
      console.warn("[Cart] buyNow: invalid price", variant.price);
      return;
    }
    const key = `${product.id}_${variant.id}`;
    setItems((prev) => {
      const deselected = prev.map((i) => ({ ...i, selected: false }));
      const exist = deselected.find((i) => i.key === key);
      if (exist) return deselected.map((i) => i.key === key ? { ...i, qty: Math.min(i.qty + parsedQty, parsedStock), selected: true } : i);
      return [...deselected, {
        key, selected: true,
        productId:   product.id,
        productName: product.name,
        variantId:   variant.id,
        color:       variant.color   || "",
        storage:     variant.storage || "",
        ram:         variant.ram     || "",
        price:       parsedPrice,
        stock:       parsedStock,
        qty:         parsedQty,
        image:       variant.image || product.image || "",
        categoryId:  product.categoryId || null,
      }];
    });
  };

  const removeItem   = (key) => setItems((p) => p.filter((i) => i.key !== key));
  const updateQty    = (key, qty) => setItems((p) => p.map((i) => i.key === key ? { ...i, qty: Math.max(1, Math.min(qty, i.stock)) } : i));
  const toggleSelect = (key) => setItems((p) => p.map((i) => i.key === key ? { ...i, selected: !i.selected } : i));
  const toggleAll    = (val) => setItems((p) => p.map((i) => ({ ...i, selected: val })));
  const clearCart    = ()    => { setItems([]); setVoucher(null); localStorage.removeItem("cart_items"); localStorage.removeItem("cart_voucher"); };

  const selectedItems = items.filter((i) => i.selected);
  const subtotal      = selectedItems.reduce((s, i) => s + i.price * i.qty, 0);

  // Tính tổng discount (có cap max_discount)
  const calcDiscount = useCallback((itemList, v = voucher) => {
    if (!v || itemList.length === 0) return 0;
    let eligible = itemList;
    if (v.scope === "category" && v.category_id) eligible = itemList.filter((i) => String(i.categoryId) === String(v.category_id));
    if (v.scope === "product"  && v.product_id)  eligible = itemList.filter((i) => String(i.productId)  === String(v.product_id));
    const base = eligible.reduce((s, i) => s + i.price * i.qty, 0);
    let disc = v.type === "percent" ? Math.round(base * v.value / 100) : Math.min(v.value, base);
    if (v.max_discount) disc = Math.min(disc, v.max_discount);
    return disc;
  }, [voucher]);

  // Tính giá hiển thị của 1 item sau khi áp voucher (có tính max_discount)
  const getDiscountedPrice = useCallback((item, v = voucher) => {
    if (!v) return item.price;
    // Kiểm tra item có thuộc scope voucher không
    if (v.scope === "category" && v.category_id && String(item.categoryId) !== String(v.category_id)) return item.price;
    if (v.scope === "product"  && v.product_id  && String(item.productId)  !== String(v.product_id))  return item.price;

    if (v.type === "percent") {
      // Lấy tổng discount thực tế (đã cap theo max_discount) từ calcDiscount
      const totalDisc = calcDiscount(selectedItems, v);
      // Tính tổng base của các item eligible
      let eligible = selectedItems;
      if (v.scope === "category" && v.category_id) eligible = selectedItems.filter((i) => String(i.categoryId) === String(v.category_id));
      if (v.scope === "product"  && v.product_id)  eligible = selectedItems.filter((i) => String(i.productId)  === String(v.product_id));
      const totalBase = eligible.reduce((s, i) => s + i.price * i.qty, 0);
      if (totalBase === 0) return item.price;
      // Chia tỷ lệ discount cho item này (theo giá trị item / tổng)
      const itemBase = item.price * item.qty;
      const itemDisc = Math.round(totalDisc * (itemBase / totalBase) / item.qty);
      return Math.max(0, item.price - itemDisc);
    }

    // fixed: không tính per-item vì discount trừ vào tổng đơn
    return item.price;
  }, [voucher, selectedItems, calcDiscount]);

  const discount   = calcDiscount(selectedItems);
  const total      = Math.max(0, subtotal - discount);
  const totalCount = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{ items, addItem, buyNow, removeItem, updateQty, toggleSelect, toggleAll, clearCart, show, setShow, voucher, setVoucher, selectedItems, subtotal, discount, total, totalCount, calcDiscount, getDiscountedPrice, autoApplyBestVoucher }}>
      {children}
      {show && <CartPopup />}
    </CartContext.Provider>
  );
}

export function useCart() { return useContext(CartContext); }

// ============================================================
// CART POPUP
// ============================================================
function CartPopup() {
  const navigate = useNavigate();
  const { items, removeItem, updateQty, toggleSelect, toggleAll, setShow, voucher, setVoucher, selectedItems, subtotal, discount, total, getDiscountedPrice, calcDiscount } = useCart();
  const [vInput, setVInput] = useState(voucher?.code || "");
  const [vErr,   setVErr]   = useState("");
  const [vLoad,  setVLoad]  = useState(false);
  const [vToast, setVToast] = useState(null);
  const allSelected = items.length > 0 && items.every((i) => i.selected);

  const showToast = (type, msg) => {
    setVToast({ type, msg });
    setTimeout(() => setVToast(null), 3000);
  };

  const applyVoucher = async () => {
  if (!vInput.trim()) return;

  setVLoad(true);
  setVErr("");

  try {
    const res = await fetch(`${API}/api/voucher/apply/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: vInput.trim() }),
    });

    const data = await res.json();

    if (res.ok) {
      const testVoucher = data.voucher;

      // kiểm tra voucher có áp dụng được không
      const testDiscount = calcDiscount(selectedItems, testVoucher);

      if (testDiscount <= 0) {
        setVErr("Voucher không áp dụng cho sản phẩm trong giỏ");
        setVoucher(null);
        showToast("error", "Voucher không áp dụng cho sản phẩm trong giỏ");
        return;
      }

      setVoucher(testVoucher);
      setVErr("");

      showToast(
        "success",
        `Áp dụng voucher "${testVoucher.code}" thành công!`
      );

    } else {
      setVErr(data.message || "Voucher không hợp lệ");
      setVoucher(null);
      showToast("error", data.message || "Voucher không hợp lệ hoặc đã hết hạn");
    }

  } catch {
    setVErr("Không thể kết nối server");
    showToast("error", "Không thể kết nối server");
  } finally {
    setVLoad(false);
  }
};

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-end" style={{ paddingTop: "72px", paddingRight: "16px" }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShow(false)} />

      {vToast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium transition-all
          ${vToast.type === "success" ? "bg-green-500/20 border border-green-500/40 text-green-300" : "bg-red-500/20 border border-red-500/40 text-red-300"}`}>
          {vToast.type === "success" ? <Check size={16} className="shrink-0" /> : <X size={16} className="shrink-0" />}
          {vToast.msg}
        </div>
      )}

      <div className="relative z-10 w-[400px] max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShoppingBag size={17} className="text-orange-400" />
            <span className="font-semibold text-sm">Sản phẩm</span>
            {items.length > 0 && <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{items.length}</span>}
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button onClick={() => { setShow(false); navigate("/cart"); }} className="text-xs text-white/40 hover:text-orange-400 transition flex items-center gap-1">
                Xem chi tiết <ChevronRight size={11} />
              </button>
            )}
            <button onClick={() => setShow(false)} className="w-7 h-7 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition">
              <X size={15} />
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-4">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <ShoppingCart size={28} className="text-white/20" />
            </div>
            <div className="text-center">
              <p className="text-sm text-white/40 font-medium">Chưa có sản phẩm nào trong giỏ</p>
              <p className="text-xs text-white/20 mt-1">Khám phá ngay những bộ sưu tập mới nhất</p>
            </div>
            <button onClick={() => { setShow(false); navigate("/product"); }} className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition">
              Về trang chủ
            </button>
          </div>
        ) : (
          <>
            {/* Select all */}
            <div className="flex items-center gap-2 px-5 py-2 border-b border-white/5 bg-white/2">
              <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} className="accent-orange-500 w-3.5 h-3.5 cursor-pointer" />
              <span className="text-xs text-white/30">Chọn tất cả ({items.length})</span>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {items.map((item) => (
                <div key={item.key} className="flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition">
                  <input type="checkbox" checked={item.selected} onChange={() => toggleSelect(item.key)} className="accent-orange-500 w-3.5 h-3.5 cursor-pointer shrink-0" />
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-800 shrink-0 border border-white/5">
                    {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain p-1" /> : <Package size={20} className="text-white/10 m-auto mt-2" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.productName}</p>
                    {(item.color || item.storage || item.ram) && (
                      <p className="text-[10px] text-white/30 mt-0.5">{[item.color && `Màu: ${item.color}`, item.storage, item.ram].filter(Boolean).join(" · ")}</p>
                    )}
                    {(() => {
                      const dp = getDiscountedPrice(item);
                      const hasDis = dp < item.price;
                      return (
                        <div>
                          {hasDis && <p className="text-white/30 text-[10px] line-through leading-none">{(item.price * item.qty).toLocaleString("vi-VN")}đ</p>}
                          <p className="font-semibold text-xs mt-0.5 text-orange-400">{(dp * item.qty).toLocaleString("vi-VN")}đ</p>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateQty(item.key, item.qty - 1)} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition"><Minus size={10} /></button>
                    <span className="w-5 text-center text-xs">{parseInt(item.qty) || 1}</span>
                    <button onClick={() => updateQty(item.key, item.qty + 1)} disabled={item.qty >= item.stock} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition disabled:opacity-30"><Plus size={10} /></button>
                  </div>
                  <button onClick={() => removeItem(item.key)} className="w-6 h-6 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 flex items-center justify-center transition shrink-0"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>

            {/* Voucher */}
            <div className="px-4 py-3 border-t border-white/5">
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                  <Tag size={12} className="text-orange-400 shrink-0" />
                  <input value={vInput} onChange={(e) => setVInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyVoucher()}
                    placeholder="Nhập mã voucher..." className="bg-transparent text-xs outline-none flex-1 text-white placeholder:text-white/20" />
                  {voucher && <Check size={12} className="text-green-400 shrink-0" />}
                </div>
                <button onClick={applyVoucher} disabled={vLoad} className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-medium transition disabled:opacity-50">
                  {vLoad ? "..." : "Áp dụng"}
                </button>
              </div>
              {vErr    && <p className="text-red-400 text-[10px] mt-1">{vErr}</p>}
              {voucher && <p className="text-green-400 text-[10px] mt-1">✓ Áp dụng "{voucher.code}" thành công</p>}
            </div>

            {/* Summary */}
            <div className="px-4 py-4 border-t border-white/10 bg-white/2">
              <div className="flex justify-between text-xs text-white/50 mb-1">
                <span>Tạm tính</span><span>{subtotal.toLocaleString("vi-VN")}đ</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/50">Giảm giá</span>
                  <span className="text-green-400">-{discount.toLocaleString("vi-VN")}đ</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-white/5">
                <span>Tổng thanh toán</span>
                <span className="text-orange-400">{total.toLocaleString("vi-VN")}đ</span>
              </div>
              <button onClick={() => { setShow(false); navigate("/cart"); }}
                className="w-full mt-3 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition">
                Thanh toán ({selectedItems.length} sản phẩm)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CART PAGE - /cart
// ============================================================
export default function CartPage() {
  const navigate = useNavigate();
  const { items, removeItem, updateQty, toggleSelect, toggleAll, voucher, setVoucher, selectedItems, subtotal, discount, total, getDiscountedPrice, totalCount } = useCart();
  const [user,          setUser]          = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
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

  const [vInput, setVInput] = useState(voucher?.code || "");
  const [vErr,   setVErr]   = useState("");
  const [vLoad,  setVLoad]  = useState(false);
  const [vToast, setVToast] = useState(null);
  const allSelected = items.length > 0 && items.every((i) => i.selected);

  const showToast = (type, msg) => {
    setVToast({ type, msg });
    setTimeout(() => setVToast(null), 3000);
  };

  const applyVoucher = async () => {
    if (!vInput.trim()) return;
    setVLoad(true); setVErr("");
    try {
      const res  = await fetch(`${API}/api/voucher/apply/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: vInput.trim() }) });
      const data = await res.json();
      if (res.ok) {
        setVoucher(data.voucher);
        setVErr("");
        showToast("success", `Áp dụng voucher "${data.voucher.code}" thành công! Giảm ${data.voucher.type === "percent" ? data.voucher.value + "%" : parseInt(data.voucher.value).toLocaleString("vi-VN") + "đ"}`);
      } else {
        setVErr(data.message || "Voucher không hợp lệ");
        setVoucher(null);
        showToast("error", data.message || "Voucher không hợp lệ hoặc đã hết hạn");
      }
    } catch {
      setVErr("Không thể kết nối server");
      showToast("error", "Không thể kết nối server");
    } finally { setVLoad(false); }
  };

  return (
    <div className="min-h-screen text-white" style={{ background: "#1C1C1E" }}>

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

      {/* TOAST */}
      {vToast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium transition-all
          ${vToast.type === "success" ? "bg-green-500/20 border border-green-500/40 text-green-300" : "bg-red-500/20 border border-red-500/40 text-red-300"}`}>
          {vToast.type === "success" ? <Check size={16} className="shrink-0" /> : <X size={16} className="shrink-0" />}
          {vToast.msg}
        </div>
      )}

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-4 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="text-2xl font-bold cursor-pointer" onClick={() => navigate("/")}>PHONEZONE</div>
        <div className="flex gap-8 items-center text-gray-300">
          <Link to="/" className="hover:text-white transition">Trang chủ</Link>
          <Link to="/product" className="hover:text-white transition">Sản phẩm</Link>
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
                  ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>
                }
                <ChevronDown size={14} className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                    {user.avatar
                      ? <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      : <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>
                    }
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

      <div className="pt-20 px-8 pb-10 max-w-6xl mx-auto">
        <button onClick={() => navigate("/product")} className="flex items-center gap-2 text-sm text-white/40 hover:text-orange-400 transition mb-4 mt-2">
          <ArrowLeft size={14} /> Tiếp tục mua sắm
        </button>
        <div className="flex items-center gap-2 text-xs text-white/30 mb-6">
          <span className="cursor-pointer hover:text-white" onClick={() => navigate("/")}>Trang chủ</span>
          <ChevronRight size={12} /><span className="text-white/60">Giỏ hàng</span>
        </div>

        <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <ShoppingCart size={22} className="text-orange-400" />
          Giỏ hàng
          <span className="text-base font-normal text-white/30">({items.length} sản phẩm)</span>
        </h1>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
              <ShoppingCart size={40} className="text-white/15" />
            </div>
            <div className="text-center">
              <p className="text-white/40 font-medium">Giỏ hàng trống</p>
              <p className="text-white/20 text-sm mt-1">Bạn chưa thêm sản phẩm nào vào giỏ hàng</p>
            </div>
            <button onClick={() => navigate("/product")} className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition">
              Khám phá sản phẩm
            </button>
          </div>
        ) : (
          <div className="flex gap-6 items-start">

            {/* LEFT */}
            <div className="flex-1 flex flex-col gap-3">
              {/* Select all */}
              <div className="flex items-center justify-between px-5 py-3 rounded-2xl border border-white/5" style={{ background: "#161616" }}>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} className="accent-orange-500 w-4 h-4" />
                  <span className="text-sm text-white/60">Chọn tất cả ({items.length} sản phẩm)</span>
                </label>
                <button onClick={() => { if (window.confirm("Xóa tất cả sản phẩm khỏi giỏ hàng?")) { localStorage.removeItem("cart_items"); window.location.reload(); } }}
                  className="text-xs text-white/30 hover:text-red-400 transition flex items-center gap-1">
                  <Trash2 size={12} /> Xóa tất cả
                </button>
              </div>

              {/* Item list */}
              <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#161616" }}>
                {items.map((item, idx) => (
                  <div key={item.key} className={`flex items-center gap-4 px-5 py-4 hover:bg-white/2 transition ${idx < items.length - 1 ? "border-b border-white/5" : ""}`}>
                    <input type="checkbox" checked={item.selected} onChange={() => toggleSelect(item.key)} className="accent-orange-500 w-4 h-4 cursor-pointer shrink-0" />
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/5 shrink-0" style={{ background: "#222" }}>
                      {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain p-2" /> : <Package size={28} className="text-white/10 m-auto mt-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.productName}</p>
                      {(item.color || item.storage || item.ram) && (
                        <p className="text-xs text-white/40 mt-1">{[item.color && `Màu: ${item.color}`, item.storage, item.ram].filter(Boolean).join(" · ")}</p>
                      )}
                      {(() => {
                        const dp = getDiscountedPrice(item);
                        const hasDis = dp < item.price;
                        return (
                          <div className="mt-2">
                            {hasDis && <p className="text-white/30 text-xs line-through leading-none">{item.price.toLocaleString("vi-VN")}đ</p>}
                            <p className="text-orange-400 font-bold text-sm">{dp.toLocaleString("vi-VN")}đ</p>
                          </div>
                        );
                      })()}
                    </div>
                    {/* Qty */}
                    <div className="flex items-center border border-white/10 rounded-xl overflow-hidden shrink-0">
                      <button onClick={() => updateQty(item.key, item.qty - 1)} className="w-9 h-9 flex items-center justify-center hover:bg-white/10 transition"><Minus size={13} /></button>
                      <span className="w-10 text-center text-sm font-medium">{parseInt(item.qty) || 1}</span>
                      <button onClick={() => updateQty(item.key, item.qty + 1)} disabled={item.qty >= item.stock} className="w-9 h-9 flex items-center justify-center hover:bg-white/10 transition disabled:opacity-30"><Plus size={13} /></button>
                    </div>
                    {/* Total price per item */}
                    <div className="w-28 text-right shrink-0">
                      {(() => {
                        const dp = getDiscountedPrice(item);
                        const hasDis = dp < item.price;
                        return (
                          <div>
                            {hasDis && <p className="text-white/30 text-xs line-through">{(item.price * item.qty).toLocaleString("vi-VN")}đ</p>}
                            <p className="text-orange-400 font-bold text-sm">{(dp * item.qty).toLocaleString("vi-VN")}đ</p>
                          </div>
                        );
                      })()}
                    </div>
                    <button onClick={() => removeItem(item.key)} className="w-9 h-9 rounded-xl hover:bg-red-500/10 text-white/20 hover:text-red-400 flex items-center justify-center transition shrink-0"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT */}
            <div className="w-80 shrink-0 flex flex-col gap-3 sticky top-24">
              {/* Voucher */}
              <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#161616" }}>
                <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Tag size={14} className="text-orange-400" /> Voucher giảm giá</p>
                {voucher ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-green-500/20" style={{ background: "rgba(52,199,89,0.08)" }}>
                    <Check size={13} className="text-green-400 shrink-0" />
                    <span className="text-green-300 text-sm font-mono font-bold flex-1 tracking-widest">{voucher.code}</span>
                    <button onClick={() => { setVoucher(null); setVInput(""); }} className="text-white/30 hover:text-red-400 transition"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input value={vInput} onChange={(e) => setVInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyVoucher()}
                      placeholder="Nhập mã voucher" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition" />
                    <button onClick={applyVoucher} disabled={vLoad} className="px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                      {vLoad ? "..." : "Áp"}
                    </button>
                  </div>
                )}
                {vErr && <p className="text-red-400 text-xs mt-1.5">{vErr}</p>}
              </div>

              {/* Summary */}
              <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#161616" }}>
                <p className="text-sm font-semibold mb-4">Thông tin đơn hàng</p>
                <div className="flex flex-col gap-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Tổng tiền</span>
                    <span>{subtotal.toLocaleString("vi-VN")}đ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Tổng khuyến mãi</span>
                    <span className={discount > 0 ? "text-green-400" : "text-white/50"}>{discount > 0 ? `-${discount.toLocaleString("vi-VN")}đ` : "0đ"}</span>
                  </div>
                  {discount > 0 && voucher && (
                    <div className="flex justify-between text-xs text-white/30 pl-2">
                      <span>· Voucher {voucher.code}</span>
                      <span className="text-green-400/60">-{discount.toLocaleString("vi-VN")}đ</span>
                    </div>
                  )}
                  <div className="border-t border-white/10 pt-2.5 flex justify-between font-bold">
                    <span>Cần thanh toán</span>
                    <span className="text-orange-400 text-base">{total.toLocaleString("vi-VN")}đ</span>
                  </div>
                </div>
                <button onClick={() => { if (selectedItems.length > 0) navigate("/payment"); }}
                  disabled={selectedItems.length === 0}
                  className="w-full mt-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition">
                  Xác nhận đơn ({selectedItems.length} sản phẩm)
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}