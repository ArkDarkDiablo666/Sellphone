import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, Plus, Pencil, Trash2, Check, Package,
  Tag, ChevronRight, X, Smartphone, Truck, CheckCircle2,
  Search, Loader
} from "lucide-react";
import { useCart } from "./Cart";

const API      = "http://localhost:8000";
const MAPS_KEY = "YOUR_GOOGLE_MAPS_API_KEY"; // Thay bằng key thực

// ── Google Places Autocomplete hook ─────────────────────────
function useAddressAutocomplete(inputRef, onSelect) {
  useEffect(() => {
    if (!window.google || !inputRef.current) return;
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "vn" },
      fields: ["formatted_address", "geometry"],
      types: ["address"],
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (place.formatted_address) onSelect(place.formatted_address);
    });
    return () => window.google.maps.event.clearInstanceListeners(ac);
  }, [inputRef, onSelect]);
}

// ── Fallback: manual suggestion nếu chưa có Google Maps ─────
function AddressSuggest({ value, onChange, error }) {
  const inputRef  = useRef(null);
  const [suggs,   setSuggs]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const timerRef  = useRef(null);
  const googleAC  = useRef(null);
  const hasGoogle = typeof window !== "undefined" && !!window.google?.maps?.places;

  // Setup Google Autocomplete nếu có
  useEffect(() => {
    if (!hasGoogle || !inputRef.current) return;
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "vn" },
      fields: ["formatted_address"],
      types: ["address"],
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (place.formatted_address) {
        onChange(place.formatted_address);
        setOpen(false);
      }
    });
    googleAC.current = ac;
    return () => window.google.maps.event.clearInstanceListeners(ac);
  }, [hasGoogle]);

  // Fallback: nominatim nếu không có Google Maps
  const searchNominatim = async (q) => {
    if (q.length < 4) { setSuggs([]); return; }
    setLoading(true);
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + " Việt Nam")}&format=json&limit=5&countrycodes=vn`,
        { headers: { "Accept-Language": "vi" } }
      );
      const data = await res.json();
      setSuggs(data.map((d) => d.display_name));
      setOpen(true);
    } catch { setSuggs([]); }
    finally { setLoading(false); }
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    if (!hasGoogle) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => searchNominatim(e.target.value), 500);
    }
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <MapPin size={14} className="absolute left-3 text-orange-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => suggs.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/TP"
          className="w-full bg-white/5 border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition"
          style={{ borderColor: error ? "rgba(255,59,48,0.5)" : "rgba(255,255,255,0.1)" }}
          onFocus2={(e) => e.target.style.borderColor = "rgba(255,149,0,0.5)"}
        />
        {loading && <Loader size={13} className="absolute right-3 text-white/30 animate-spin" />}
      </div>

      {/* Dropdown gợi ý */}
      {open && suggs.length > 0 && !hasGoogle && (
        <div className="absolute z-50 w-full mt-1 rounded-xl border border-white/10 overflow-hidden shadow-2xl"
          style={{ background: "#1e1e1e" }}>
          {suggs.map((s, i) => (
            <button key={i} type="button"
              onMouseDown={() => { onChange(s); setSuggs([]); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/8 transition flex items-start gap-2 border-b border-white/5 last:border-0">
              <MapPin size={12} className="text-orange-400 shrink-0 mt-0.5" />
              <span className="text-white/70 line-clamp-2">{s}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ── Chèn Google Maps script ──────────────────────────────────
function useGoogleMaps() {
  const [ready, setReady] = useState(!!window.google?.maps);
  useEffect(() => {
    if (window.google?.maps) { setReady(true); return; }
    if (MAPS_KEY === "YOUR_GOOGLE_MAPS_API_KEY") return; // skip nếu chưa có key
    const script  = document.createElement("script");
    script.src    = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&language=vi`;
    script.async  = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);
  return ready;
}

// ────────────────────────────────────────────────────────────
export default function Payment() {
  const navigate = useNavigate();
  useGoogleMaps();
  const { selectedItems, subtotal, discount, total, voucher, clearCart } = useCart();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [form,         setForm]         = useState({ name: user.fullName || user.full_name || "", phone: "", address: "", note: "" });
  const [payMethod,    setPayMethod]    = useState("cod"); // "cod" | "momo"
  const [errors,       setErrors]       = useState({});
  const [addresses,    setAddresses]    = useState([]);
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [showAddAddr,  setShowAddAddr]  = useState(false);
  const [editAddr,     setEditAddr]     = useState(null);
  const [addrForm,     setAddrForm]     = useState({ name: "", phone: "", address: "" });
  const [placing,      setPlacing]      = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [orderId,      setOrderId]      = useState(null);

  useEffect(() => {
    if (!user.id) { navigate("/login"); return; }
    if (selectedItems.length === 0) { navigate("/cart"); return; }
    fetch(`${API}/api/customer/${user.id}/addresses/`)
      .then((r) => r.json()).then((d) => setAddresses(d.addresses || [])).catch(() => {});
  }, []); // eslint-disable-line

  const fillAddress = (addr) => {
    setSelectedAddr(addr.id);
    setForm((p) => ({ ...p, name: addr.name, phone: addr.phone, address: addr.address }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())    e.name    = "Vui lòng nhập tên người nhận";
    if (!form.phone.trim())   e.phone   = "Vui lòng nhập số điện thoại";
    else if (!/^(0|\+84)[0-9]{8,9}$/.test(form.phone.replace(/\s/g, ""))) e.phone = "Số điện thoại không hợp lệ";
    if (!form.address.trim()) e.address = "Vui lòng nhập địa chỉ nhận hàng";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const placeOrder = async () => {
    if (!validate()) return;
    setPlacing(true);
    try {
      const res = await fetch(`${API}/api/order/create/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: user.id,
          items: selectedItems.map((i) => ({ variant_id: i.variantId, qty: i.qty, price: i.price })),
          voucher_code:     voucher?.code || null,
          subtotal, discount, total,
          payment_method:   payMethod,
          receiver_name:    form.name,
          receiver_phone:   form.phone,
          receiver_address: form.address,
          note:             form.note,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        clearCart();
        setOrderId(data.order_id);
        setSuccess(true);
        // Redirect MoMo nếu có
        if (payMethod === "momo" && data.momo_url) window.location.href = data.momo_url;
      } else alert(data.message || "Đặt hàng thất bại");
    } catch { alert("Không thể kết nối server"); }
    finally { setPlacing(false); }
  };

  const saveAddr = async () => {
    if (!addrForm.name || !addrForm.phone || !addrForm.address) { alert("Vui lòng điền đủ thông tin"); return; }
    try {
      const url  = editAddr ? `${API}/api/customer/address/update/` : `${API}/api/customer/address/create/`;
      const body = editAddr ? { ...addrForm, id: editAddr.id, customer_id: user.id } : { ...addrForm, customer_id: user.id };
      const res  = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        if (editAddr) setAddresses((p) => p.map((a) => a.id === editAddr.id ? { ...a, ...addrForm } : a));
        else setAddresses((p) => [...p, { ...addrForm, id: data.id }]);
        setShowAddAddr(false); setEditAddr(null); setAddrForm({ name: "", phone: "", address: "" });
      } else alert(data.message);
    } catch { alert("Lỗi kết nối"); }
  };

  const deleteAddr = async (id) => {
    if (!window.confirm("Xóa địa chỉ này?")) return;
    const res = await fetch(`${API}/api/customer/address/delete/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, customer_id: user.id }),
    });
    if (res.ok) { setAddresses((p) => p.filter((a) => a.id !== id)); if (selectedAddr === id) setSelectedAddr(null); }
  };

  // ── SUCCESS ────────────────────────────────────────────────
  if (success) return (
    <div className="min-h-screen text-white flex flex-col items-center justify-center gap-6" style={{ background: "#1C1C1E" }}>
      <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: "rgba(52,199,89,0.15)" }}>
        <CheckCircle2 size={44} className="text-green-400" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Đặt hàng thành công!</h2>
        {orderId && <p className="text-white/40 text-sm">Mã đơn hàng: <span className="text-orange-400 font-mono font-bold">#{orderId}</span></p>}
        <p className="text-white/40 text-sm mt-1">
          {payMethod === "momo" ? "Đang chuyển đến trang thanh toán MoMo..." : "Đơn hàng đang được xử lý. Chúng tôi sẽ liên hệ sớm nhất."}
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => navigate("/orders")} className="px-5 py-2.5 rounded-xl text-sm transition" style={{ background: "rgba(255,255,255,0.08)" }}>
          Xem đơn hàng
        </button>
        <button onClick={() => navigate("/product")} className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition">
          Tiếp tục mua sắm
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-white" style={{ background: "#1C1C1E" }}>
      <nav className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-10 py-4 border-b border-white/10"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}>
        <div className="text-xl font-bold cursor-pointer" onClick={() => navigate("/")}>PHONEZONE</div>
        <button onClick={() => navigate("/cart")} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition">
          <ArrowLeft size={15} /> Quay lại giỏ hàng
        </button>
      </nav>

      <div className="pt-20 px-8 pb-10 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-xs text-white/30 mb-6">
          <span className="cursor-pointer hover:text-white" onClick={() => navigate("/")}>Trang chủ</span>
          <ChevronRight size={12} />
          <span className="cursor-pointer hover:text-white" onClick={() => navigate("/cart")}>Giỏ hàng</span>
          <ChevronRight size={12} />
          <span className="text-white/60">Thanh toán</span>
        </div>

        <h1 className="text-xl font-bold mb-6">Thông tin giao hàng</h1>

        <div className="flex gap-6 items-start">
          {/* LEFT */}
          <div className="flex-1 flex flex-col gap-5">

            {/* Địa chỉ đã lưu */}
            {addresses.length > 0 && (
              <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#161616" }}>
                <p className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <MapPin size={14} className="text-orange-400" /> Địa chỉ đã lưu
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {addresses.map((addr) => (
                    <div key={addr.id} onClick={() => fillAddress(addr)}
                      className="cursor-pointer p-3 rounded-xl border transition"
                      style={{ borderColor: selectedAddr === addr.id ? "#ff9500" : "rgba(255,255,255,0.1)", background: selectedAddr === addr.id ? "rgba(255,149,0,0.08)" : "transparent" }}>
                      <p className="text-sm font-medium">{addr.name} · {addr.phone}</p>
                      <p className="text-xs text-white/40 mt-1 line-clamp-2">{addr.address}</p>
                      <div className="flex gap-3 mt-2">
                        <button onClick={(e) => { e.stopPropagation(); setEditAddr(addr); setAddrForm({ name: addr.name, phone: addr.phone, address: addr.address }); setShowAddAddr(true); }}
                          className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition">
                          <Pencil size={10} /> Sửa
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteAddr(addr.id); }}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition">
                          <Trash2 size={10} /> Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form nhập */}
            <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#161616" }}>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-semibold">Địa chỉ nhận hàng</p>
                <button onClick={() => { setShowAddAddr(!showAddAddr); setEditAddr(null); setAddrForm({ name: "", phone: "", address: "" }); }}
                  className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition">
                  <Plus size={12} /> Lưu địa chỉ mới
                </button>
              </div>

              {showAddAddr && (
                <div className="mb-5 p-4 rounded-xl border border-orange-500/20 flex flex-col gap-3" style={{ background: "rgba(255,149,0,0.05)" }}>
                  <p className="text-xs text-orange-400 font-medium">{editAddr ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ mới"}</p>
                  <input placeholder="Tên người nhận *" value={addrForm.name} onChange={(e) => setAddrForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
                  <input placeholder="Số điện thoại *" value={addrForm.phone} onChange={(e) => setAddrForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
                  <AddressSuggest value={addrForm.address} onChange={(v) => setAddrForm((p) => ({ ...p, address: v }))} />
                  <div className="flex gap-2">
                    <button onClick={saveAddr} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition">
                      <Check size={13} /> Lưu
                    </button>
                    <button onClick={() => { setShowAddAddr(false); setEditAddr(null); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition">
                      <X size={13} /> Hủy
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <div>
                  <input placeholder="Tên người nhận *" value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none transition"
                    style={{ borderColor: errors.name ? "rgba(255,59,48,0.5)" : "rgba(255,255,255,0.1)" }} />
                  {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                </div>
                <div>
                  <input placeholder="Số điện thoại *" value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none transition"
                    style={{ borderColor: errors.phone ? "rgba(255,59,48,0.5)" : "rgba(255,255,255,0.1)" }} />
                  {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                </div>
                <AddressSuggest value={form.address} onChange={(v) => setForm((p) => ({ ...p, address: v }))} error={errors.address} />
                <input placeholder="Ghi chú (nếu có)" value={form.note}
                  onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
              </div>
            </div>

            {/* Phương thức thanh toán */}
            <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#161616" }}>
              <p className="text-sm font-semibold mb-4">Phương thức thanh toán</p>
              <div className="flex flex-col gap-3">
                {/* COD */}
                <label onClick={() => setPayMethod("cod")}
                  className="flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition"
                  style={{ borderColor: payMethod === "cod" ? "#ff9500" : "rgba(255,255,255,0.1)", background: payMethod === "cod" ? "rgba(255,149,0,0.08)" : "transparent" }}>
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                    <Truck size={18} className="text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Thanh toán khi nhận hàng (COD)</p>
                    <p className="text-xs text-white/40 mt-0.5">Thanh toán bằng tiền mặt khi nhận hàng</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: payMethod === "cod" ? "#ff9500" : "rgba(255,255,255,0.3)" }}>
                    {payMethod === "cod" && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                  </div>
                </label>

                {/* MoMo */}
                <label onClick={() => setPayMethod("momo")}
                  className="flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition"
                  style={{ borderColor: payMethod === "momo" ? "#ff9500" : "rgba(255,255,255,0.1)", background: payMethod === "momo" ? "rgba(255,149,0,0.08)" : "transparent" }}>
                  <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center font-bold text-white text-sm"
                    style={{ background: "linear-gradient(135deg, #ae2070, #d82d8b)" }}>
                    M
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Thanh toán qua MoMo</p>
                    <p className="text-xs text-white/40 mt-0.5">Ví điện tử MoMo — thanh toán nhanh, an toàn</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: payMethod === "momo" ? "#ff9500" : "rgba(255,255,255,0.3)" }}>
                    {payMethod === "momo" && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="w-72 shrink-0 flex flex-col gap-3 sticky top-24">
            <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#161616" }}>
              <p className="text-sm font-semibold mb-4">Sản phẩm ({selectedItems.length})</p>
              <div className="flex flex-col gap-3 max-h-52 overflow-y-auto pr-1">
                {selectedItems.map((item) => (
                  <div key={item.key} className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-white/5" style={{ background: "#222" }}>
                      {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain p-1" /> : <Package size={16} className="text-white/10 m-auto mt-2" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.productName}</p>
                      <p className="text-[10px] text-white/30">{[item.color, item.storage].filter(Boolean).join(" / ")} × {item.qty}</p>
                    </div>
                    <p className="text-xs text-orange-400 shrink-0 font-medium">{(item.price * item.qty).toLocaleString("vi-VN")}đ</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#161616" }}>
              <p className="text-sm font-semibold mb-4">Tóm tắt</p>
              <div className="flex flex-col gap-2.5 text-sm">
                <div className="flex justify-between"><span className="text-white/50">Tạm tính</span><span>{subtotal.toLocaleString("vi-VN")}đ</span></div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-white/50 flex items-center gap-1"><Tag size={11} /> Giảm giá</span>
                    <span className="text-green-400">-{discount.toLocaleString("vi-VN")}đ</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2.5 flex justify-between font-bold">
                  <span>Tổng</span>
                  <span className="text-orange-400 text-base">{total.toLocaleString("vi-VN")}đ</span>
                </div>
              </div>

              {/* Phương thức đã chọn */}
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                {payMethod === "cod"
                  ? <><Truck size={13} className="text-green-400" /><span className="text-xs text-white/50">Thanh toán khi nhận hàng</span></>
                  : <><span className="text-xs font-bold" style={{ color: "#d82d8b" }}>M</span><span className="text-xs text-white/50">Thanh toán MoMo</span></>}
              </div>

              <button onClick={placeOrder} disabled={placing}
                className="w-full mt-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-sm transition">
                {placing ? "Đang xử lý..." : "Xác nhận đơn hàng"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}