import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart, X, Trash2, Plus, Minus, Tag,
  ChevronRight, Package, ArrowLeft, Check, ShoppingBag,
  User, LogOut, Settings, ChevronDown, AlertTriangle,
  Ticket, Info, Sparkles, ChevronUp, BadgePercent, Zap, Search
} from "lucide-react";
import { Link } from "react-router-dom";
import { SearchModal } from "./Searchbar";
import Footer from "./Footer";

const API = "http://localhost:8000";

// ============================================================
// HELPERS
// ============================================================
function calcVoucherDiscount(v, itemList) {
  if (!v || !itemList.length) return 0;
  let eligible = itemList;
  if (v.scope === "category" && v.category_id)
    eligible = itemList.filter(i => String(i.categoryId) === String(v.category_id));
  if (v.scope === "product" && v.product_id) {
    eligible = itemList.filter(i => String(i.productId) === String(v.product_id));
    if (v.variant_id)
      eligible = eligible.filter(i => String(i.variantId) === String(v.variant_id));
  }
  const base = eligible.reduce((s, i) => s + i.price * i.qty, 0);
  if (base < (v.min_order || 0)) return 0;
  let disc = v.type === "percent"
    ? Math.round(base * Math.min(v.value, 100) / 100)
    : Math.min(v.value, base);
  if (v.max_discount) disc = Math.min(disc, v.max_discount);
  return disc;
}

function voucherAppliesToItem(v, item) {
  if (v.scope === "all") return true;
  if (v.scope === "category" && v.category_id)
    return String(item.categoryId) === String(v.category_id);
  if (v.scope === "product" && v.product_id) {
    if (String(item.productId) !== String(v.product_id)) return false;
    if (v.variant_id) return String(item.variantId) === String(v.variant_id);
    return true;
  }
  return false;
}

// ============================================================
// CART CONTEXT
// ============================================================
export const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("cart_items") || "[]");
      return raw.filter((i) => {
        const p = parseFloat(i.price);
        const q = parseInt(i.qty);
        const vid = parseInt(i.variantId);
        return !isNaN(p) && p > 0 && !isNaN(q) && q >= 1 && !isNaN(vid) && String(vid) === String(i.variantId);
      }).map((i) => ({ ...i, price: parseFloat(i.price), qty: parseInt(i.qty) || 1, variantId: parseInt(i.variantId) }));
    } catch { return []; }
  });
  const [show, setShow] = useState(false);
  const [voucher, setVoucher] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cart_voucher") || "null"); } catch { return null; }
  });

  useEffect(() => { localStorage.setItem("cart_items", JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem("cart_voucher", JSON.stringify(voucher)); }, [voucher]);

  const autoApplyBestVoucher = useCallback(async (itemsOverride) => {
    if (voucher) return;
    const targetItems = itemsOverride || items;
    if (!targetItems.length) return;
    try {
      const payload = targetItems.map(i => ({
        product_id: i.productId, category_id: i.categoryId, price: i.price, qty: i.qty,
      }));
      const res = await fetch(`${API}/api/voucher/best-for-cart/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      const data = await res.json();
      if (res.ok && data.voucher) setVoucher(data.voucher);
    } catch { }
  }, [voucher, items]);

  const fetchBestVoucherForProduct = useCallback(async (productId, categoryId, price, qty = 1) => {
    if (!price) return null;
    try {
      const params = new URLSearchParams({ product_id: productId, category_id: categoryId || "", price, qty });
      const res = await fetch(`${API}/api/voucher/best-for-product/?${params}`);
      const data = await res.json();
      return res.ok ? data : null;
    } catch { return null; }
  }, []);

  const addItem = (product, variant, qty = 1) => {
    const parsedPrice = parseFloat(variant.price);
    const parsedStock = parseInt(variant.stock) || 9999;
    const parsedQty = parseInt(qty) || 1;
    if (!parsedPrice || isNaN(parsedPrice)) return;
    const key = `${product.id}_${variant.id}`;
    setItems((prev) => {
      const exist = prev.find((i) => i.key === key);
      if (exist) return prev.map((i) => i.key === key ? { ...i, qty: Math.min(i.qty + parsedQty, parsedStock), selected: true } : i);
      return [...prev, {
        key, selected: true,
        productId: product.id, productName: product.name,
        variantId: variant.id, color: variant.color || "",
        storage: variant.storage || "", ram: variant.ram || "",
        price: parsedPrice, stock: parsedStock, qty: parsedQty,
        image: variant.image || product.image || "",
        categoryId: product.categoryId || null,
      }];
    });
    setShow(true);
    autoApplyBestVoucher();
  };

  const buyNow = (product, variant, qty = 1) => {
    const parsedPrice = parseFloat(variant.price);
    const parsedStock = parseInt(variant.stock) || 9999;
    const parsedQty = parseInt(qty) || 1;
    if (!parsedPrice || isNaN(parsedPrice)) return;
    const key = `${product.id}_${variant.id}`;
    setItems((prev) => {
      const deselected = prev.map((i) => ({ ...i, selected: false }));
      const exist = deselected.find((i) => i.key === key);
      if (exist) return deselected.map((i) => i.key === key ? { ...i, qty: Math.min(i.qty + parsedQty, parsedStock), selected: true } : i);
      return [...deselected, {
        key, selected: true,
        productId: product.id, productName: product.name,
        variantId: variant.id, color: variant.color || "",
        storage: variant.storage || "", ram: variant.ram || "",
        price: parsedPrice, stock: parsedStock, qty: parsedQty,
        image: variant.image || product.image || "",
        categoryId: product.categoryId || null,
      }];
    });
  };

  const removeItem = (key) => setItems((p) => p.filter((i) => i.key !== key));
  const updateQty = (key, qty) => setItems((p) => p.map((i) => i.key === key ? { ...i, qty: Math.max(1, Math.min(qty, i.stock)) } : i));
  const toggleSelect = (key) => setItems((p) => p.map((i) => i.key === key ? { ...i, selected: !i.selected } : i));
  const toggleAll = (val) => setItems((p) => p.map((i) => ({ ...i, selected: val })));
  const clearCart = () => { setItems([]); setVoucher(null); localStorage.removeItem("cart_items"); localStorage.removeItem("cart_voucher"); };

  const selectedItems = items.filter((i) => i.selected);
  const subtotal = selectedItems.reduce((s, i) => s + i.price * i.qty, 0);

  const calcDiscount = useCallback((itemList, v = voucher) => {
    return calcVoucherDiscount(v, itemList);
  }, [voucher]);

  const getDiscountedPrice = useCallback((item, v = voucher) => {
    if (!v) return item.price;
    if (!voucherAppliesToItem(v, item)) return item.price;
    if (v.type === "percent") {
      const discPct = Math.min(v.value, 100) / 100;
      return Math.round(item.price * (1 - discPct));
    }
    return item.price;
  }, [voucher]);

  const discount = calcDiscount(selectedItems);
  const total = Math.max(0, subtotal - discount);
  const totalCount = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{
      items, addItem, buyNow, removeItem, updateQty, toggleSelect, toggleAll, clearCart,
      show, setShow, voucher, setVoucher, selectedItems, subtotal, discount, total, totalCount,
      calcDiscount, getDiscountedPrice, autoApplyBestVoucher, fetchBestVoucherForProduct
    }}>
      {children}
      {show && <CartPopup />}
    </CartContext.Provider>
  );
}

export function useCart() { return useContext(CartContext); }

// ============================================================
// CART POPUP (mini)
// ============================================================
function CartPopup() {
  const navigate = useNavigate();
  const { items, removeItem, updateQty, toggleSelect, toggleAll, setShow,
    voucher, setVoucher, selectedItems, subtotal, discount, total, getDiscountedPrice
  } = useCart();
  const [vInput, setVInput] = useState(voucher?.code || "");
  const [vErr, setVErr] = useState("");
  const [vLoad, setVLoad] = useState(false);
  const [vToast, setVToast] = useState(null);
  const [voucherList, setVoucherList] = useState([]);
  const [showVList, setShowVList] = useState(false);
  const allSelected = items.length > 0 && items.every((i) => i.selected);

  useEffect(() => {
    if (selectedItems.length === 0) { setVoucherList([]); return; }
    fetch(`${API}/api/voucher/active/`)
      .then(r => r.json())
      .then(d => {
        const withDisc = (d.vouchers || [])
          .map(v => ({ ...v, discountAmt: calcVoucherDiscount(v, selectedItems) }))
          .sort((a, b) => b.discountAmt - a.discountAmt);
        setVoucherList(withDisc);
      }).catch(() => {});
  }, [selectedItems.length, voucher]);

  const showToast = (type, msg) => {
    setVToast({ type, msg });
    setTimeout(() => setVToast(null), 3000);
  };

  const applyVoucherObj = (v) => {
    const disc = calcVoucherDiscount(v, selectedItems);
    if (disc <= 0) { showToast("error", "Voucher không áp dụng được cho sản phẩm đã chọn"); return; }
    setVoucher(v); setVInput(v.code); setShowVList(false);
    showToast("success", `✓ Áp dụng "${v.code}" — Giảm ${disc.toLocaleString("vi-VN")}đ`);
  };

  const applyVoucher = async () => {
    if (!vInput.trim()) return;
    setVLoad(true); setVErr("");
    try {
      const res = await fetch(`${API}/api/voucher/apply/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: vInput.trim() }) });
      const data = await res.json();
      if (res.ok) {
        const disc = calcVoucherDiscount(data.voucher, selectedItems);
        if (disc <= 0) {
          setVErr("Voucher không áp dụng cho sản phẩm đã chọn"); setVoucher(null);
          showToast("error", "Voucher không áp dụng được cho sản phẩm đã chọn");
        } else {
          setVoucher(data.voucher); setVErr("");
          showToast("success", `✓ "${data.voucher.code}" — Giảm ${disc.toLocaleString("vi-VN")}đ`);
        }
      } else {
        setVErr(data.message || "Voucher không hợp lệ"); setVoucher(null);
        showToast("error", data.message || "Voucher không hợp lệ hoặc đã hết hạn");
      }
    } catch { setVErr("Không thể kết nối server"); showToast("error", "Không thể kết nối server"); }
    finally { setVLoad(false); }
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
            <button onClick={() => setShow(false)} className="w-7 h-7 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition"><X size={15} /></button>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-4">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center"><ShoppingCart size={28} className="text-white/20" /></div>
            <div className="text-center">
              <p className="text-sm text-white/40 font-medium">Chưa có sản phẩm nào trong giỏ</p>
              <p className="text-xs text-white/20 mt-1">Khám phá ngay những bộ sưu tập mới nhất</p>
            </div>
            <button onClick={() => { setShow(false); navigate("/product"); }} className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition">Về trang chủ</button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-5 py-2 border-b border-white/5 bg-white/2">
              <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} className="accent-orange-500 w-3.5 h-3.5 cursor-pointer" />
              <span className="text-xs text-white/30">Chọn tất cả ({items.length})</span>
            </div>
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
                          <p className="font-semibold text-xs mt-0.5 text-[#ff3b30]">{(dp * item.qty).toLocaleString("vi-VN")}đ</p>
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
            <div className="px-4 py-3 border-t border-white/5">
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                  <Tag size={12} className="text-orange-400 shrink-0" />
                  <input value={vInput} onChange={(e) => setVInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyVoucher()}
                    placeholder="Nhập mã voucher..." className="bg-transparent text-xs outline-none flex-1 text-white placeholder:text-white/20" />
                  {voucher && <Check size={12} className="text-green-400 shrink-0" />}
                </div>
                <button onClick={applyVoucher} disabled={vLoad} className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-medium transition disabled:opacity-50">
                  {vLoad ? "..." : "Áp"}
                </button>
                {voucherList.length > 0 && (
                  <button onClick={() => setShowVList(!showVList)} className="px-2 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white/50 transition border border-white/10">
                    {showVList ? "Ẩn" : `${voucherList.filter(v => v.discountAmt > 0).length} mã`}
                  </button>
                )}
              </div>
              {vErr && <p className="text-red-400 text-[10px] mt-1">{vErr}</p>}
              {voucher && !vErr && <p className="text-green-400 text-[10px] mt-1">✓ "{voucher.code}" — giảm {discount.toLocaleString("vi-VN")}đ</p>}
              {showVList && (
                <div className="mt-2 flex flex-col gap-1 max-h-44 overflow-y-auto">
                  {voucherList.map(v => (
                    <button key={v.id}
                      onClick={() => v.discountAmt > 0 ? applyVoucherObj(v) : null}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-left transition text-[11px]
                        ${v.discountAmt > 0 ? "bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/30 cursor-pointer" : "bg-white/[0.02] border border-white/5 opacity-40 cursor-not-allowed"}`}>
                      <div>
                        <span className="font-mono font-bold text-orange-400">{v.code}</span>
                        <span className="text-white/40 ml-2">
                          {v.type === "percent" ? `-${v.value}%` : `-${parseInt(v.value).toLocaleString("vi-VN")}đ`}
                          {v.max_discount ? ` (tối đa ${parseInt(v.max_discount).toLocaleString("vi-VN")}đ)` : ""}
                        </span>
                      </div>
                      {v.discountAmt > 0
                        ? <span className="text-green-400 font-semibold shrink-0">-{v.discountAmt.toLocaleString("vi-VN")}đ</span>
                        : <span className="text-white/20 text-[10px] shrink-0">Không áp dụng</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-4 border-t border-white/10 bg-white/2">
              <div className="flex justify-between text-xs text-white/50 mb-1"><span>Tạm tính</span><span>{subtotal.toLocaleString("vi-VN")}đ</span></div>
              {discount > 0 && (
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/50">Giảm giá</span><span className="text-green-400">-{discount.toLocaleString("vi-VN")}đ</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-white/5">
                <span>Tổng thanh toán</span><span className="text-orange-400">{total.toLocaleString("vi-VN")}đ</span>
              </div>
              <button onClick={() => { setShow(false); navigate("/cart"); }} className="w-full mt-3 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition">
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
// VOUCHER NOT APPLICABLE POPUP
// ============================================================
function VoucherNotApplicablePopup({ voucher, applicableItems, allSelectedItems, onClose, onApplyAnyway }) {
  const notApplicable = allSelectedItems.filter(i => !voucherAppliesToItem(voucher, i));
  const applicable = allSelectedItems.filter(i => voucherAppliesToItem(voucher, i));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#161616] border border-white/10 rounded-2xl p-6 w-[420px] shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={18} className="text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Voucher không khả dụng</h3>
            <p className="text-sm text-white/50 mt-0.5">
              Mã <span className="font-mono font-bold text-orange-400">{voucher.code}</span> không áp dụng cho một số sản phẩm
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-white/30 hover:text-white shrink-0"><X size={16} /></button>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-500/5 border border-orange-500/20 mb-4">
          <BadgePercent size={16} className="text-orange-400 shrink-0" />
          <div>
            <p className="text-sm font-mono font-bold text-orange-400">{voucher.code}</p>
            <p className="text-xs text-white/40">
              {voucher.type === "percent" ? `Giảm ${voucher.value}%` : `Giảm ${parseInt(voucher.value).toLocaleString("vi-VN")}đ`}
              {voucher.scope === "category" ? " · Theo danh mục" : voucher.scope === "product" ? " · Sản phẩm cụ thể" : " · Tất cả sản phẩm"}
            </p>
          </div>
        </div>
        {notApplicable.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-red-400/80 mb-2 flex items-center gap-1.5">
              <X size={11} /> Không áp dụng được ({notApplicable.length} sản phẩm)
            </p>
            <div className="flex flex-col gap-1.5">
              {notApplicable.map(item => (
                <div key={item.key} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-red-500/5 border border-red-500/10">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 shrink-0 overflow-hidden">
                    {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain p-0.5" /> : <Package size={14} className="text-white/10 m-auto mt-1.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-white/70">{item.productName}</p>
                    {(item.color || item.storage) && <p className="text-[10px] text-white/30">{[item.color, item.storage].filter(Boolean).join(" · ")}</p>}
                  </div>
                  <p className="text-xs text-white/40 shrink-0">{(item.price * item.qty).toLocaleString("vi-VN")}đ</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {applicable.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-green-400/80 mb-2 flex items-center gap-1.5">
              <Check size={11} /> Được áp dụng ({applicable.length} sản phẩm)
            </p>
            <div className="flex flex-col gap-1.5">
              {applicable.map(item => {
                const disc = calcVoucherDiscount(voucher, [item]);
                return (
                  <div key={item.key} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-green-500/5 border border-green-500/10">
                    <div className="w-8 h-8 rounded-lg bg-gray-800 shrink-0 overflow-hidden">
                      {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain p-0.5" /> : <Package size={14} className="text-white/10 m-auto mt-1.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-white/80">{item.productName}</p>
                      {(item.color || item.storage) && <p className="text-[10px] text-white/30">{[item.color, item.storage].filter(Boolean).join(" · ")}</p>}
                    </div>
                    {disc > 0 && <p className="text-xs text-green-400 font-semibold shrink-0">-{disc.toLocaleString("vi-VN")}đ</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10 transition">
            Chọn voucher khác
          </button>
          {applicable.length > 0 && (
            <button onClick={onApplyAnyway} className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition text-white">
              Áp dụng cho {applicable.length} sp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// VOUCHER PANEL - per item vouchers
// ============================================================
function ItemVoucherPanel({ item, voucherList, activeVoucher, onSelectVoucher, onClose }) {
  const applicable = voucherList.filter(v => voucherAppliesToItem(v, item));
  const notApplicable = voucherList.filter(v => !voucherAppliesToItem(v, item));

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#161616] border border-white/10 rounded-2xl w-[380px] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Ticket size={15} className="text-orange-400" />
              <h3 className="font-semibold text-sm">Voucher cho sản phẩm</h3>
            </div>
            <p className="text-xs text-white/40 mt-1 truncate max-w-[260px]">{item.productName}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X size={16} /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4 flex flex-col gap-2">
          {applicable.length === 0 && (
            <div className="text-center py-8">
              <Ticket size={32} className="text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/30">Không có voucher nào khả dụng</p>
              <p className="text-xs text-white/20 mt-1">cho sản phẩm này</p>
            </div>
          )}
          {applicable.length > 0 && (
            <div className="mb-1">
              <p className="text-[10px] font-semibold text-green-400/70 uppercase tracking-wider mb-2">Khả dụng</p>
              {applicable.map(v => {
                const disc = calcVoucherDiscount(v, [item]);
                const isActive = activeVoucher?.id === v.id;
                return (
                  <button key={v.id} onClick={() => onSelectVoucher(isActive ? null : v)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition mb-1.5
                      ${isActive
                        ? "bg-orange-500/15 border border-orange-500/40"
                        : "bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20"}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-orange-500/20" : "bg-white/5"}`}>
                      {v.type === "percent" ? <BadgePercent size={15} className={isActive ? "text-orange-400" : "text-white/40"} /> : <Zap size={15} className={isActive ? "text-orange-400" : "text-white/40"} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold text-sm ${isActive ? "text-orange-400" : "text-white/80"}`}>{v.code}</span>
                        {isActive && <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-semibold">Đang dùng</span>}
                      </div>
                      <p className="text-[11px] text-white/40 mt-0.5">
                        {v.type === "percent" ? `Giảm ${v.value}%` : `Giảm ${parseInt(v.value).toLocaleString("vi-VN")}đ`}
                        {v.max_discount ? ` · Tối đa ${parseInt(v.max_discount).toLocaleString("vi-VN")}đ` : ""}
                        {v.min_order > 0 ? ` · Đơn từ ${parseInt(v.min_order).toLocaleString("vi-VN")}đ` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-green-400">-{disc.toLocaleString("vi-VN")}đ</p>
                      <p className="text-[10px] text-white/30">{(item.price - Math.round(disc / item.qty)).toLocaleString("vi-VN")}đ/sp</p>
                    </div>
                    {isActive && <Check size={14} className="text-orange-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
          {notApplicable.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider mb-2">Không khả dụng</p>
              {notApplicable.map(v => (
                <div key={v.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 opacity-40 mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    {v.type === "percent" ? <BadgePercent size={15} className="text-white/20" /> : <Zap size={15} className="text-white/20" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono font-bold text-sm text-white/40">{v.code}</span>
                    <p className="text-[11px] text-white/25 mt-0.5">
                      {v.type === "percent" ? `Giảm ${v.value}%` : `Giảm ${parseInt(v.value).toLocaleString("vi-VN")}đ`}
                      {v.scope !== "all" && ` · ${v.scope === "category" ? "Danh mục khác" : "Sản phẩm khác"}`}
                    </p>
                  </div>
                  <span className="text-[10px] text-white/20 shrink-0">Không áp dụng</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CART PAGE - /cart
// ============================================================
export default function CartPage() {
  const navigate = useNavigate();
  const {
    items, removeItem, updateQty, toggleSelect, toggleAll,
    voucher, setVoucher, selectedItems, subtotal, discount, total,
    getDiscountedPrice, totalCount, calcDiscount
  } = useCart();

  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Voucher states
  const [vInput, setVInput] = useState(voucher?.code || "");
  const [vErr, setVErr] = useState("");
  const [vLoad, setVLoad] = useState(false);
  const [vToast, setVToast] = useState(null);
  const [voucherList, setVoucherList] = useState([]);
  const [showVList, setShowVList] = useState(false);

  // Not applicable popup
  const [notApplicablePopup, setNotApplicablePopup] = useState(null);

  // Per-item voucher panel
  const [itemVoucherPanel, setItemVoucherPanel] = useState(null);

  // Best voucher suggestion
  const [bestSuggestion, setBestSuggestion] = useState(null);

  const allSelected = items.length > 0 && items.every((i) => i.selected);

  // Sync user
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

  useEffect(() => {
    if (selectedItems.length === 0) { setVoucherList([]); setBestSuggestion(null); return; }
    fetch(`${API}/api/voucher/active/`)
      .then(r => r.json())
      .then(d => {
        const withDisc = (d.vouchers || [])
          .map(v => ({ ...v, discountAmt: calcVoucherDiscount(v, selectedItems) }))
          .sort((a, b) => b.discountAmt - a.discountAmt);
        setVoucherList(withDisc);
        const best = withDisc.find(v => v.discountAmt > 0 && (!voucher || v.id !== voucher?.id));
        if (best && (!voucher || best.discountAmt > calcVoucherDiscount(voucher, selectedItems))) {
          setBestSuggestion(best);
        } else {
          setBestSuggestion(null);
        }
      }).catch(() => {});
  }, [selectedItems.length, voucher]);

  useEffect(() => { setVInput(voucher?.code || ""); }, [voucher]);

  const showToast = (type, msg) => {
    setVToast({ type, msg });
    setTimeout(() => setVToast(null), 3500);
  };

  const handleLogout = () => { localStorage.removeItem("user"); setConfirmLogout(false); navigate("/login"); };

  const applyVoucherObj = (v, force = false) => {
    if (!force) {
      const notApplicable = selectedItems.filter(i => !voucherAppliesToItem(v, i));
      if (notApplicable.length > 0 && selectedItems.filter(i => voucherAppliesToItem(v, i)).length > 0) {
        setNotApplicablePopup({ voucher: v });
        return;
      }
      if (notApplicable.length === selectedItems.length) {
        showToast("error", `Voucher "${v.code}" không áp dụng cho sản phẩm đã chọn`);
        return;
      }
    }
    const disc = calcVoucherDiscount(v, selectedItems);
    if (disc <= 0 && !force) {
      showToast("error", `Voucher "${v.code}" không áp dụng được`);
      return;
    }
    setVoucher(v); setVInput(v.code); setVErr("");
    setShowVList(false); setNotApplicablePopup(null); setBestSuggestion(null);
    showToast("success", `✓ Áp dụng "${v.code}" — Giảm ${disc.toLocaleString("vi-VN")}đ`);
  };

  const applyVoucher = async () => {
    if (!vInput.trim()) return;
    setVLoad(true); setVErr("");
    try {
      const res = await fetch(`${API}/api/voucher/apply/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: vInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        const v = data.voucher;
        const notApplicable = selectedItems.filter(i => !voucherAppliesToItem(v, i));
        const applicable = selectedItems.filter(i => voucherAppliesToItem(v, i));
        if (applicable.length === 0) {
          setVErr("Voucher không áp dụng cho bất kỳ sản phẩm nào đã chọn");
          setNotApplicablePopup({ voucher: v });
        } else if (notApplicable.length > 0) {
          setNotApplicablePopup({ voucher: v });
        } else {
          applyVoucherObj(v, true);
        }
      } else {
        setVErr(data.message || "Voucher không hợp lệ");
        showToast("error", data.message || "Voucher không hợp lệ hoặc đã hết hạn");
      }
    } catch { setVErr("Không thể kết nối server"); showToast("error", "Không thể kết nối server"); }
    finally { setVLoad(false); }
  };

  const removeVoucher = () => { setVoucher(null); setVInput(""); setVErr(""); };

  return (
    <div className="min-h-screen text-white" style={{ background: "#1C1C1E" }}>

      {/* TOAST */}
      {vToast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium
          ${vToast.type === "success" ? "bg-green-500/20 border border-green-500/40 text-green-300" : "bg-red-500/20 border border-red-500/40 text-red-300"}`}>
          {vToast.type === "success" ? <Check size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
          {vToast.msg}
        </div>
      )}

      {/* NOT APPLICABLE POPUP */}
      {notApplicablePopup && (
        <VoucherNotApplicablePopup
          voucher={notApplicablePopup.voucher}
          allSelectedItems={selectedItems}
          onClose={() => setNotApplicablePopup(null)}
          onApplyAnyway={() => applyVoucherObj(notApplicablePopup.voucher, true)}
        />
      )}

      {/* ITEM VOUCHER PANEL */}
      {itemVoucherPanel && (
        <ItemVoucherPanel
          item={itemVoucherPanel}
          voucherList={voucherList}
          activeVoucher={voucher}
          onSelectVoucher={(v) => {
            if (v) { applyVoucherObj(v, false); } else { removeVoucher(); }
            setItemVoucherPanel(null);
          }}
          onClose={() => setItemVoucherPanel(null)}
        />
      )}

      {/* LOGOUT DIALOG */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmLogout(false)} />
          <div className="relative bg-[#161616] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"><AlertTriangle size={18} className="text-red-400" /></div>
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
          <button onClick={() => setSearchOpen(true)} className="text-gray-300 hover:text-white transition">
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

      {/* PAGE CONTENT */}
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
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center"><ShoppingCart size={40} className="text-white/15" /></div>
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

              <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#161616" }}>
                {items.map((item, idx) => {
                  const dp = getDiscountedPrice(item);
                  const hasDis = dp < item.price;
                  const itemApplicableVouchers = voucherList.filter(v => {
                    const d = calcVoucherDiscount(v, [item]);
                    return d > 0;
                  });
                  const isVoucherAppliedToItem = voucher && voucherAppliesToItem(voucher, item);

                  return (
                    <div key={item.key} className={`px-5 py-4 hover:bg-white/[0.02] transition ${idx < items.length - 1 ? "border-b border-white/5" : ""}`}>
                      <div className="flex items-center gap-4">
                        <input type="checkbox" checked={item.selected} onChange={() => toggleSelect(item.key)} className="accent-orange-500 w-4 h-4 cursor-pointer shrink-0" />
                        <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/5 shrink-0" style={{ background: "#222" }}>
                          {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain p-2" /> : <Package size={28} className="text-white/10 m-auto mt-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{item.productName}</p>
                          {(item.color || item.storage || item.ram) && (
                            <p className="text-xs text-white/40 mt-1">{[item.color && `Màu: ${item.color}`, item.storage, item.ram].filter(Boolean).join(" · ")}</p>
                          )}
                          <div className="mt-2">
                            {hasDis && <p className="text-[#ff3b30]/40 text-xs line-through leading-none">{item.price.toLocaleString("vi-VN")}đ</p>}
                            <p className="text-[#ff3b30] font-bold text-sm">{dp.toLocaleString("vi-VN")}đ</p>
                          </div>
                          {isVoucherAppliedToItem && voucher && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-500/10 border border-green-500/20">
                                <Tag size={9} className="text-green-400" />
                                <span className="text-[10px] font-mono font-bold text-green-400">{voucher.code}</span>
                                <span className="text-[10px] text-green-400/60">
                                  -{(() => {
                                    const d = calcVoucherDiscount(voucher, [item]);
                                    return d.toLocaleString("vi-VN");
                                  })()}đ
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center border border-white/10 rounded-xl overflow-hidden shrink-0">
                          <button onClick={() => updateQty(item.key, item.qty - 1)} className="w-9 h-9 flex items-center justify-center hover:bg-white/10 transition"><Minus size={13} /></button>
                          <span className="w-10 text-center text-sm font-medium">{parseInt(item.qty) || 1}</span>
                          <button onClick={() => updateQty(item.key, item.qty + 1)} disabled={item.qty >= item.stock} className="w-9 h-9 flex items-center justify-center hover:bg-white/10 transition disabled:opacity-30"><Plus size={13} /></button>
                        </div>

                        <div className="w-32 text-right shrink-0">
                          {hasDis && <p className="text-[#ff3b30]/40 text-xs line-through">{(item.price * item.qty).toLocaleString("vi-VN")}đ</p>}
                          <p className="text-[#ff3b30] font-bold text-sm">{(dp * item.qty).toLocaleString("vi-VN")}đ</p>
                        </div>

                        <button onClick={() => removeItem(item.key)} className="w-9 h-9 rounded-xl hover:bg-red-500/10 text-white/20 hover:text-red-400 flex items-center justify-center transition shrink-0"><Trash2 size={15} /></button>
                      </div>

                      {itemApplicableVouchers.length > 0 && (
                        <div className="ml-[68px] mt-2.5 flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setItemVoucherPanel(item)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/8 border border-orange-500/15 hover:bg-orange-500/15 hover:border-orange-500/30 transition text-[11px] text-orange-400/70 hover:text-orange-400"
                          >
                            <Ticket size={10} />
                            <span>{itemApplicableVouchers.length} voucher khả dụng</span>
                            <ChevronRight size={9} />
                          </button>
                          {itemApplicableVouchers[0] && !isVoucherAppliedToItem && (
                            <span className="text-[10px] text-white/25">
                              Tốt nhất: <span className="font-mono text-orange-400/50">{itemApplicableVouchers[0].code}</span>
                              {" "}giảm <span className="text-green-400/50">{itemApplicableVouchers[0].discountAmt.toLocaleString("vi-VN")}đ</span>
                            </span>
                          )}
                        </div>
                      )}
                      {itemApplicableVouchers.length === 0 && voucherList.length > 0 && item.selected && (
                        <div className="ml-[68px] mt-2">
                          <span className="text-[10px] text-white/20 flex items-center gap-1">
                            <Info size={9} /> Không có voucher nào khả dụng cho sản phẩm này
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="w-80 shrink-0 flex flex-col gap-3 sticky top-24">
              {bestSuggestion && !voucher && (
                <div className="rounded-2xl border border-orange-500/20 p-4 bg-orange-500/5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                      <Sparkles size={14} className="text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-orange-400">Gợi ý voucher tốt nhất</p>
                      <p className="text-[11px] text-white/50 mt-0.5">
                        <span className="font-mono font-bold text-orange-300">{bestSuggestion.code}</span>
                        {" — "}tiết kiệm{" "}
                        <span className="text-green-400 font-semibold">{bestSuggestion.discountAmt.toLocaleString("vi-VN")}đ</span>
                      </p>
                    </div>
                    <button
                      onClick={() => applyVoucherObj(bestSuggestion)}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-[11px] font-semibold text-white transition"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#161616" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Tag size={14} className="text-orange-400" /> Voucher giảm giá
                  </p>
                  {voucherList.filter(v => v.discountAmt > 0).length > 0 && (
                    <button onClick={() => setShowVList(!showVList)} className="text-xs text-orange-400 hover:text-orange-300 transition flex items-center gap-1">
                      {showVList ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {showVList ? "Ẩn" : `${voucherList.filter(v => v.discountAmt > 0).length} mã khả dụng`}
                    </button>
                  )}
                </div>

                {voucher ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-green-500/20" style={{ background: "rgba(52,199,89,0.08)" }}>
                    <Check size={13} className="text-green-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-green-300 text-sm font-mono font-bold tracking-widest">{voucher.code}</span>
                      <span className="text-green-400/60 text-xs ml-2">-{discount.toLocaleString("vi-VN")}đ</span>
                    </div>
                    <button onClick={removeVoucher} className="text-white/30 hover:text-red-400 transition"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={vInput} onChange={(e) => setVInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && applyVoucher()}
                      placeholder="Nhập mã voucher"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition placeholder:text-white/20"
                    />
                    <button onClick={applyVoucher} disabled={vLoad} className="px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                      {vLoad ? "..." : "Áp"}
                    </button>
                  </div>
                )}
                {vErr && <p className="text-red-400 text-xs mt-1.5">{vErr}</p>}

                {showVList && (
                  <div className="mt-3 flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                    <p className="text-xs text-white/30 mb-1">Chọn voucher phù hợp nhất:</p>
                    {voucherList.map(v => {
                      const isActive = voucher?.id === v.id;
                      return (
                        <button key={v.id}
                          onClick={() => v.discountAmt > 0 ? applyVoucherObj(v) : null}
                          disabled={v.discountAmt <= 0}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition text-sm
                            ${isActive ? "bg-orange-500/15 border border-orange-500/40" :
                              v.discountAmt > 0 ? "bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/30 cursor-pointer" :
                                "bg-white/[0.02] border border-white/5 opacity-35 cursor-not-allowed"}`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-orange-400 text-xs">{v.code}</span>
                              {isActive && <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1 rounded">Đang dùng</span>}
                              {v.discountAmt <= 0 && <span className="text-[10px] text-white/20 bg-white/5 px-1.5 rounded">Không khả dụng</span>}
                            </div>
                            <p className="text-white/40 text-xs mt-0.5">
                              {v.type === "percent" ? `Giảm ${v.value}%` : `Giảm ${parseInt(v.value).toLocaleString("vi-VN")}đ`}
                              {v.max_discount ? ` · Tối đa ${parseInt(v.max_discount).toLocaleString("vi-VN")}đ` : ""}
                              {v.min_order > 0 ? ` · Đơn từ ${parseInt(v.min_order).toLocaleString("vi-VN")}đ` : ""}
                            </p>
                          </div>
                          {v.discountAmt > 0 && (
                            <span className={`font-bold text-sm shrink-0 ml-2 ${isActive ? "text-orange-400" : "text-green-400"}`}>
                              -{v.discountAmt.toLocaleString("vi-VN")}đ
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#161616" }}>
                <p className="text-sm font-semibold mb-4">Thông tin đơn hàng</p>
                <div className="flex flex-col gap-2.5 text-sm">
                  <div className="flex justify-between"><span className="text-white/50">Tổng tiền</span><span>{subtotal.toLocaleString("vi-VN")}đ</span></div>
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
                    <span className="text-[#ff3b30] text-base">{total.toLocaleString("vi-VN")}đ</span>
                  </div>
                </div>
                <button
                  onClick={() => { if (selectedItems.length > 0) navigate("/payment"); }}
                  disabled={selectedItems.length === 0}
                  className="w-full mt-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition"
                >
                  Xác nhận đơn ({selectedItems.length} sản phẩm)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <FeaturedProductsSection navigate={navigate} />
      <Footer />
    </div>
  );
}
// ── Featured Products Section for Cart ─────────────────────────
function FeaturedCard({ p, variants, dv, comboLabel, colors, basePrice, finalPrice, hasDisc, bestVoucher, navigate }) {
  const { addItem } = useCart();
  const [cartAnim, setCartAnim] = useState(false);
  const handleAddToCart = (e) => {
    e.stopPropagation();
    if (!dv) return;
    addItem(p, dv, 1);
    setCartAnim(true);
    setTimeout(() => setCartAnim(false), 600);
  };
  return (
    <article
      key={p.id}
      onClick={() => navigate(`/product/${p.id}`)}
      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-300
        hover:-translate-y-0.5 cursor-pointer
        bg-[#00000001] backdrop-blur-[2px]
        shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
        hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.60),inset_1px_0_0_rgba(255,255,255,0.48),inset_0_-1px_1px_rgba(0,0,0,0.20),inset_-1px_0_1px_rgba(0,0,0,0.18),0_8px_32px_rgba(0,0,0,0.4)]"
    >
      <div className="w-full h-28 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden">
        {(dv?.image || p.image)
          ? <img src={dv?.image || p.image} alt={p.name} className="w-full h-full object-contain p-2" />
          : <Package size={24} className="text-white/10" />}
        {hasDisc && bestVoucher && (
          <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-tight">
            {bestVoucher.type === "percent" ? `-${bestVoucher.value}%` : `-${(basePrice - finalPrice).toLocaleString("vi-VN")}đ`}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-2.5">
        <h3 className="font-semibold text-white text-xs leading-snug line-clamp-2 hover:text-orange-400 transition">
          {p.name}
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
              return (
                <span key={col} title={!hasStock ? `${col} - Hết hàng` : col}
                  className={`px-1.5 py-0.5 rounded text-[9px] border font-medium
                    ${!hasStock ? "bg-white/[0.02] border-white/5 text-white/20 line-through" : "bg-white/5 border-white/10 text-white/50"}`}>
                  {col}
                </span>
              );
            })}
          </div>
        )}
        <div className="flex items-end justify-between mt-auto pt-1 gap-1">
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
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleAddToCart}
              title="Thêm vào giỏ hàng"
              className={`w-7 h-7 rounded-full flex items-center justify-center border border-[#ff9500] text-white transition
                ${cartAnim ? "bg-orange-500 scale-110" : "bg-[rgba(255,149,0,0.75)] hover:bg-[rgba(255,149,0,1)]"}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </button>
            <button
              onClick={e => { e.stopPropagation(); navigate(`/product/${p.id}`); }}
              className="shrink-0 h-7 px-2.5 rounded-full text-white text-[10px] font-medium
                bg-[rgba(255,149,0,0.75)] border border-[#ff9500] hover:bg-[rgba(255,149,0,1)] transition">
              Mua
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function FeaturedProductsSection({ navigate }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voucherList, setVoucherList] = useState([]);
  const { voucher: cartVoucher, addItem } = useCart();

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/home/featured/?limit=8`)
      .then(r => r.json())
      .then(async (featuredData) => {
        const featured = featuredData.products || [];
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

  if (loading || products.length === 0) return null;

  return (
    <section className="px-8 py-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-white">Sản phẩm gợi ý</h2>
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
      <div className="grid grid-cols-4 gap-4">
        {products.slice(0, 8).map(p => {
          const variants = p.variants || [];
          const colors = [...new Set(variants.map(v => v.color).filter(Boolean))];
          const dv = variants.length > 0
            ? [...variants].sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0))[0]
            : null;
          const basePrice = dv ? parseFloat(dv.price) : parseFloat(p.min_price || 0);
          const comboLabel = dv ? [dv.ram, dv.storage].filter(Boolean).join(" · ") : null;

          let finalPrice = basePrice;
          let bestVoucher = null;
          if (dv && basePrice) {
            const allVouchers = cartVoucher ? [cartVoucher, ...voucherList] : voucherList;
            let bestDisc = 0;
            for (const v of allVouchers) {
              if (!v) continue;
              if (v.scope === "category" && v.category_id && String(p.category_id) !== String(v.category_id)) continue;
              if (v.scope === "product" && v.product_id && String(p.id) !== String(v.product_id)) continue;
              if (basePrice < (v.min_order || 0)) continue;
              let d = v.type === "percent"
                ? Math.round(basePrice * Math.min(v.value, 100) / 100)
                : Math.min(v.value, basePrice);
              if (v.max_discount) d = Math.min(d, v.max_discount);
              if (d > bestDisc) { bestDisc = d; bestVoucher = v; }
            }
            if (bestDisc > 0) finalPrice = Math.max(0, basePrice - bestDisc);
          }
          const hasDisc = finalPrice < basePrice;

          return (
            <article
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              className="flex flex-col rounded-2xl overflow-hidden transition-all duration-300
                hover:-translate-y-0.5 cursor-pointer
                bg-[#00000001] backdrop-blur-[2px]
                shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
                hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.60),inset_1px_0_0_rgba(255,255,255,0.48),inset_0_-1px_1px_rgba(0,0,0,0.20),inset_-1px_0_1px_rgba(0,0,0,0.18),0_8px_32px_rgba(0,0,0,0.4)]"
            >
              <div className="w-full h-28 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden">
                {(dv?.image || p.image)
                  ? <img src={dv?.image || p.image} alt={p.name} className="w-full h-full object-contain p-2" />
                  : <Package size={24} className="text-white/10" />}
                {hasDisc && bestVoucher && (
                  <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-tight">
                    {bestVoucher.type === "percent" ? `-${bestVoucher.value}%` : `-${(basePrice - finalPrice).toLocaleString("vi-VN")}đ`}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 p-2.5">
                <h3 className="font-semibold text-white text-xs leading-snug line-clamp-2 hover:text-orange-400 transition">
                  {p.name}
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
                      return (
                        <span key={col} title={!hasStock ? `${col} - Hết hàng` : col}
                          className={`px-1.5 py-0.5 rounded text-[9px] border font-medium
                            ${!hasStock ? "bg-white/[0.02] border-white/5 text-white/20 line-through" : "bg-white/5 border-white/10 text-white/50"}`}>
                          {col}
                        </span>
                      );
                    })}
                  </div>
                )}
                {/* Rating — chiều cao cố định */}
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
                <div className="flex items-end justify-between mt-auto pt-1 gap-1">
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
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={e => { e.stopPropagation(); if (dv) { addItem(p, dv, 1); } }} className="shrink-0 h-7 w-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                      </svg>
                    </button>
                    <button onClick={e => { e.stopPropagation(); navigate(`/product/${p.id}`); }} className="shrink-0 h-7 w-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-medium transition flex items-center justify-center">
                      Mua
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}