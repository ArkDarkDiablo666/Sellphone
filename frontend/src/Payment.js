import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, useToast } from "./Toast";
import {
  ArrowLeft, MapPin, Plus, Pencil, Trash2, Check, Package,
  Tag, ChevronRight, X, Truck, CheckCircle2, ChevronDown, Loader,
  Building2, CreditCard, Copy, CheckCheck
} from "lucide-react";
import { useCart } from "./Cart";
import { getUser, authFetch, AUTH_REDIRECTED, checkAndHandleExpiry } from "./authUtils";

const API           = "http://localhost:8000";
const PROVINCES_API = "https://provinces.open-api.vn/api";

// ── Thông tin ngân hàng (chỉnh theo shop) ──
const BANK_INFO = {
  bankName:    "Vietcombank",
  accountNo:   "1234567890",
  accountName: "CONG TY TNHH PHONEZONE",
  branch:      "Chi nhánh TP.HCM",
  logo:        "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Vietcombank_logo.svg/200px-Vietcombank_logo.svg.png",
};

// ════════════════════════════════════════════════════════════════
// HOOKS — tỉnh / quận / phường
// ════════════════════════════════════════════════════════════════

function useProvinces() {
  const [data, setData] = useState([]);
  useEffect(() => {
    fetch(`${PROVINCES_API}/?depth=1`)
      .then((r) => r.json()).then(setData).catch(() => {});
  }, []);
  return data;
}

function useDistricts(provinceCode) {
  const [data, setData] = useState([]);
  useEffect(() => {
    if (!provinceCode) { setData([]); return; }
    fetch(`${PROVINCES_API}/p/${provinceCode}?depth=2`)
      .then((r) => r.json()).then((d) => setData(d.districts || [])).catch(() => {});
  }, [provinceCode]);
  return data;
}

function useWards(districtCode) {
  const [data, setData] = useState([]);
  useEffect(() => {
    if (!districtCode) { setData([]); return; }
    fetch(`${PROVINCES_API}/d/${districtCode}?depth=2`)
      .then((r) => r.json()).then((d) => setData(d.wards || [])).catch(() => {});
  }, [districtCode]);
  return data;
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — Dropdown chọn tỉnh / quận / phường
// ════════════════════════════════════════════════════════════════

function SelectDropdown({ placeholder, value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((o) => o.code === value);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-sm border transition text-left"
        style={{
          background:  disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
          borderColor: open ? "rgba(255,149,0,0.5)" : "rgba(255,255,255,0.1)",
          color:       selected ? "white" : "rgba(255,255,255,0.3)",
          cursor:      disabled ? "not-allowed" : "pointer",
        }}
      >
        <span className="truncate">{selected ? selected.name : placeholder}</span>
        <ChevronDown size={14} className={`shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "rgba(255,255,255,0.3)" }} />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-xl border border-white/10 shadow-2xl overflow-hidden"
          style={{ background: "#1e1e1e", maxHeight: 220, overflowY: "auto" }}>
          {options.length === 0
            ? <div className="px-4 py-3 text-sm text-white/30">Đang tải...</div>
            : options.map((o) => (
              <button key={o.code} type="button"
                onMouseDown={() => { onChange(o.code, o.name); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm border-b border-white/5 last:border-0 transition"
                style={{
                  background: value === o.code ? "rgba(255,149,0,0.1)" : "transparent",
                  color:      value === o.code ? "#ff9500" : "rgba(255,255,255,0.7)",
                }}>
                {o.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — Ô địa chỉ chi tiết + OpenStreetMap autocomplete
// ════════════════════════════════════════════════════════════════

function DetailInput({ value, onChange, error, provinceName, districtName, wardName }) {
  const [suggs,   setSuggs]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const timerRef = useRef(null);

  const search = useCallback(async (q) => {
    if (q.length < 3) { setSuggs([]); setOpen(false); return; }
    setLoading(true);
    try {
      const context = [wardName, districtName, provinceName].filter(Boolean).join(", ");
      const query   = context ? `${q}, ${context}, Việt Nam` : `${q}, Việt Nam`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=vn`,
        { headers: { "Accept-Language": "vi" } }
      );
      const data = await res.json();
      const cleaned = data.map((d) => d.display_name.split(",").slice(0, 3).join(",").trim());
      setSuggs([...new Set(cleaned)].slice(0, 5));
      setOpen(true);
    } catch { setSuggs([]); }
    finally { setLoading(false); }
  }, [provinceName, districtName, wardName]);

  const handleChange = (e) => {
    onChange(e.target.value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(e.target.value), 500);
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <MapPin size={14} className="absolute left-3 pointer-events-none text-orange-400" />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => suggs.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Số nhà, tên đường... *"
          className="w-full rounded-xl pl-9 pr-8 py-2.5 text-sm outline-none transition"
          style={{
            background:  "rgba(255,255,255,0.05)",
            border:      `1px solid ${error ? "rgba(255,59,48,0.5)" : open ? "rgba(255,149,0,0.5)" : "rgba(255,255,255,0.1)"}`,
            color:       "white",
          }}
        />
        {loading && <Loader size={13} className="absolute right-3 animate-spin text-white/30" />}
      </div>

      {open && suggs.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-xl border border-white/10 overflow-hidden shadow-2xl"
          style={{ background: "#1e1e1e" }}>
          {suggs.map((s, i) => (
            <button key={i} type="button"
              onMouseDown={() => { onChange(s); setSuggs([]); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm flex items-start gap-2 border-b border-white/5 last:border-0 transition hover:bg-white/5"
              style={{ color: "rgba(255,255,255,0.7)" }}>
              <MapPin size={12} className="shrink-0 mt-0.5 text-orange-400" />
              <span className="line-clamp-2">{s}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// HELPER — object địa chỉ → chuỗi đầy đủ gửi backend
// ════════════════════════════════════════════════════════════════

const emptyAddr = () => ({
  provinceCode: "", provinceName: "",
  districtCode: "", districtName: "",
  wardCode:     "", wardName:     "",
  detail: "",
});

function buildFullAddress(a) {
  return [a.detail, a.wardName, a.districtName, a.provinceName].filter(Boolean).join(", ");
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — Form địa chỉ phân cấp
// ════════════════════════════════════════════════════════════════

function AddressForm({ value, onChange, errors = {} }) {
  const provinces = useProvinces();
  const districts = useDistricts(value.provinceCode);
  const wards     = useWards(value.districtCode);

  const pick = (field) => (code, name) => {
    if (field === "province")
      onChange({ ...value, provinceCode: code, provinceName: name, districtCode: "", districtName: "", wardCode: "", wardName: "" });
    else if (field === "district")
      onChange({ ...value, districtCode: code, districtName: name, wardCode: "", wardName: "" });
    else
      onChange({ ...value, wardCode: code, wardName: name });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <SelectDropdown placeholder="Tỉnh / Thành phố *" options={provinces}
          value={value.provinceCode} onChange={pick("province")} />
        {errors.province && <p className="text-red-400 text-xs mt-1">{errors.province}</p>}
      </div>
      <div>
        <SelectDropdown placeholder="Quận / Huyện *" options={districts}
          value={value.districtCode} onChange={pick("district")} disabled={!value.provinceCode} />
        {errors.district && <p className="text-red-400 text-xs mt-1">{errors.district}</p>}
      </div>
      <div>
        <SelectDropdown placeholder="Phường / Xã *" options={wards}
          value={value.wardCode} onChange={pick("ward")} disabled={!value.districtCode} />
        {errors.ward && <p className="text-red-400 text-xs mt-1">{errors.ward}</p>}
      </div>
      <DetailInput
        value={value.detail}
        onChange={(v) => onChange({ ...value, detail: v })}
        error={errors.detail}
        provinceName={value.provinceName}
        districtName={value.districtName}
        wardName={value.wardName}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENT — Bank Transfer Info Card
// ════════════════════════════════════════════════════════════════

function BankInfoCard({ total, orderId }) {
  const [copied, setCopied] = useState(null);

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const transferContent = orderId ? `PHONEZONE ${orderId}` : `PHONEZONE THANHTOAN`;

  const CopyBtn = ({ text, field }) => (
    <button
      onClick={() => copyText(text, field)}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition"
      style={{
        background: copied === field ? "rgba(52,199,89,0.15)" : "rgba(255,255,255,0.05)",
        color:      copied === field ? "#34c759" : "rgba(255,255,255,0.4)",
        border:     `1px solid ${copied === field ? "rgba(52,199,89,0.3)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      {copied === field ? <CheckCheck size={11} /> : <Copy size={11} />}
      {copied === field ? "Đã sao chép" : "Sao chép"}
    </button>
  );

  return (
    <div className="mt-3 rounded-xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <div className="w-9 h-9 rounded-xl overflow-hidden bg-white flex items-center justify-center shrink-0">
          <img src={BANK_INFO.logo} alt={BANK_INFO.bankName} className="w-7 h-7 object-contain"
            onError={e => { e.target.style.display = "none"; }} />
        </div>
        <div>
          <p className="text-xs font-semibold text-white">{BANK_INFO.bankName}</p>
          <p className="text-[10px] text-white/40">{BANK_INFO.branch}</p>
        </div>
      </div>

      {/* Bank details */}
      <div className="px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-white/30 mb-0.5">Số tài khoản</p>
            <p className="text-sm font-mono font-bold text-white tracking-wider">{BANK_INFO.accountNo}</p>
          </div>
          <CopyBtn text={BANK_INFO.accountNo} field="accountNo" />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-white/30 mb-0.5">Chủ tài khoản</p>
            <p className="text-sm font-semibold text-white">{BANK_INFO.accountName}</p>
          </div>
          <CopyBtn text={BANK_INFO.accountName} field="accountName" />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-white/30 mb-0.5">Số tiền</p>
            <p className="text-sm font-bold text-orange-400">{total?.toLocaleString("vi-VN")}đ</p>
          </div>
          <CopyBtn text={String(total)} field="amount" />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-white/30 mb-0.5">Nội dung chuyển khoản</p>
            <p className="text-sm font-mono text-green-400 font-semibold">{transferContent}</p>
          </div>
          <CopyBtn text={transferContent} field="content" />
        </div>
      </div>

      {/* Note */}
      <div className="px-4 py-2.5 border-t border-white/5 flex items-start gap-2" style={{ background: "rgba(255,149,0,0.04)" }}>
        <span className="text-orange-400 text-xs mt-0.5">⚠️</span>
        <p className="text-[11px] text-white/40 leading-relaxed">
          Đơn hàng sẽ được xử lý sau khi chúng tôi xác nhận thanh toán (trong vòng 1–2 giờ).
          Vui lòng nhập <span className="text-white/60 font-medium">đúng nội dung</span> chuyển khoản.
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PAGE — Payment
// ════════════════════════════════════════════════════════════════

const PAYMENT_METHODS = [
  {
    key: "cod",
    label: "Thanh toán khi nhận hàng (COD)",
    sub: "Thanh toán bằng tiền mặt khi nhận hàng",
    icon: <Truck size={18} className="text-green-400" />,
    iconBg: "bg-green-500/10 border-green-500/20",
  },
  {
    key: "bank",
    label: "Chuyển khoản ngân hàng",
    sub: "Chuyển khoản trực tiếp đến tài khoản shop",
    icon: <Building2 size={18} className="text-blue-400" />,
    iconBg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    key: "vnpay",
    label: "Thanh toán qua VNPay",
    sub: "ATM nội địa, thẻ quốc tế, QR Code",
    icon: (
      <div className="w-full h-full flex items-center justify-center font-extrabold text-[10px] text-white"
        style={{ background: "linear-gradient(135deg,#005BAA,#00AEEF)", borderRadius: 6 }}>
        VN<span style={{ color: "#FFD700" }}>Pay</span>
      </div>
    ),
    iconBg: "overflow-hidden",
    iconFull: true,
  },
  {
    key: "momo",
    label: "Thanh toán qua MoMo",
    sub: "Ví điện tử MoMo — thanh toán nhanh, an toàn",
    icon: (
      <div className="w-full h-full flex items-center justify-center font-bold text-white text-sm"
        style={{ background: "linear-gradient(135deg,#ae2070,#d82d8b)", borderRadius: 8 }}>
        M
      </div>
    ),
    iconBg: "overflow-hidden",
    iconFull: true,
  },
];

export default function Payment() {
  const navigate = useNavigate();
  const { selectedItems, subtotal, discount, total, voucher, clearCart } = useCart();
  const user = getUser();
  const { toast, toasts, removeToast } = useToast();

  const [form,         setForm]         = useState({ name: user?.fullName || user?.full_name || "", phone: "", note: "" });
  const [addrObj,      setAddrObj]      = useState(emptyAddr());
  const [addrErrors,   setAddrErrors]   = useState({});
  const [payMethod,    setPayMethod]    = useState("cod");
  const [errors,       setErrors]       = useState({});
  const [addresses,    setAddresses]    = useState([]);
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [showAddAddr,  setShowAddAddr]  = useState(false);
  const [editAddr,     setEditAddr]     = useState(null);
  const [addrForm,     setAddrForm]     = useState({ name: "", phone: "", addrObj: emptyAddr() });
  const [placing,      setPlacing]      = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [orderId,      setOrderId]      = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => {
    if (checkAndHandleExpiry("user")) return;
    if (!user?.id) { navigate("/login"); return; }
    if (selectedItems.length === 0) { navigate("/cart"); return; }
    authFetch(`${API}/api/customer/${user.id}/addresses/`)
      .then((r) => { if (!r || r === AUTH_REDIRECTED) return; return r.json(); })
      .then((d) => { if (d) setAddresses(d.addresses || []); }).catch(() => {});
  }, []); // eslint-disable-line

  const fillAddress = (addr) => {
    setSelectedAddr(addr.id);
    setForm((p) => ({ ...p, name: addr.name, phone: addr.phone }));
    setAddrObj({ ...emptyAddr(), detail: addr.address });
  };

  const validate = () => {
    const e  = {};
    const ae = {};
    if (!form.name.trim())  e.name  = "Vui lòng nhập tên người nhận";
    if (!form.phone.trim()) e.phone = "Vui lòng nhập số điện thoại";
    else if (!/^(0|\+84)[0-9]{8,9}$/.test(form.phone.replace(/\s/g, "")))
      e.phone = "Số điện thoại không hợp lệ";
    if (!addrObj.provinceCode) ae.province = "Vui lòng chọn tỉnh / thành phố";
    if (!addrObj.districtCode) ae.district = "Vui lòng chọn quận / huyện";
    if (!addrObj.wardCode)     ae.ward     = "Vui lòng chọn phường / xã";
    if (!addrObj.detail.trim()) ae.detail  = "Vui lòng nhập địa chỉ chi tiết";
    setErrors(e);
    setAddrErrors(ae);
    return Object.keys(e).length === 0 && Object.keys(ae).length === 0;
  };

  const placeOrder = async () => {
    if (!validate()) return;
    setPlacing(true);
    try {
      const res = await authFetch(`${API}/api/order/create/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id:      user.id,
          items:            selectedItems.map((i) => ({ variant_id: i.variantId, qty: i.qty, price: i.price })),
          voucher_code:     voucher?.code || null,
          subtotal, discount, total,
          payment_method:   payMethod,
          receiver_name:    form.name,
          receiver_phone:   form.phone,
          receiver_address: buildFullAddress(addrObj),
          note:             form.note,
        }),
      });
      if (!res || res === AUTH_REDIRECTED) return;
      const data = await res.json();
      if (res.ok) {
        clearCart();
        setOrderId(data.order_id);
        setSuccess(true);

        if (payMethod === "momo" && data.momo_url) {
          window.location.href = data.momo_url;
          return;
        }
        if (payMethod === "vnpay") {
          try {
            const vnRes = await authFetch(`${API}/api/payment/vnpay/create/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ order_id: data.order_id, amount: total }),
            });
            if (!vnRes || vnRes === AUTH_REDIRECTED) return;
            const vnData = await vnRes.json();
            if (vnRes.ok && vnData.pay_url) {
              window.location.href = vnData.pay_url;
              return;
            }
          } catch { /* fallback to success screen */ }
        }
      } else {
        toast.error(data.message || "Đặt hàng thất bại");
      }
    } catch (err) {
      toast.error("Không thể kết nối server");
    } finally { setPlacing(false); }
  };

  const saveAddr = async () => {
    const { name, phone, addrObj: ao } = addrForm;
    if (!name || !phone || !ao.detail) { toast.error("Vui lòng điền đủ thông tin địa chỉ"); return; }
    const fullAddress = buildFullAddress(ao);
    try {
      const url  = editAddr ? `${API}/api/customer/address/update/` : `${API}/api/customer/address/create/`;
      const body = editAddr
        ? { name, phone, address: fullAddress, id: editAddr.id, customer_id: user.id }
        : { name, phone, address: fullAddress, customer_id: user.id };
      const res  = await authFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res || res === AUTH_REDIRECTED) return;
      const data = await res.json();
      if (res.ok) {
        if (editAddr) setAddresses((p) => p.map((a) => a.id === editAddr.id ? { ...a, name, phone, address: fullAddress } : a));
        else setAddresses((p) => [...p, { name, phone, address: fullAddress, id: data.id }]);
        setShowAddAddr(false); setEditAddr(null);
        setAddrForm({ name: "", phone: "", addrObj: emptyAddr() });
        toast.success("Đã lưu địa chỉ!");
      } else toast.error(data.message);
    } catch { toast.error("Lỗi kết nối"); }
  };

  const deleteAddr = (id) => {
    setConfirmModal({
      message: "Xóa địa chỉ này?",
      onConfirm: async () => {
        const res = await authFetch(`${API}/api/customer/address/delete/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, customer_id: user.id }),
        });
        if (!res || res === AUTH_REDIRECTED) return;
        if (res.ok) {
          setAddresses((p) => p.filter((a) => a.id !== id));
          if (selectedAddr === id) setSelectedAddr(null);
          toast.success("Đã xóa địa chỉ!");
        } else toast.error("Xóa địa chỉ thất bại");
      },
    });
  };

  // ── SUCCESS ──────────────────────────────────────────────────
  if (success) return (
    <div className="min-h-screen text-white flex flex-col items-center justify-center gap-6 px-4" style={{ background: "#1C1C1E" }}>
      <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: "rgba(52,199,89,0.15)" }}>
        <CheckCircle2 size={44} className="text-green-400" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Đặt hàng thành công!</h2>
        {orderId && <p className="text-white/40 text-sm">Mã đơn hàng: <span className="text-orange-400 font-mono font-bold">#{orderId}</span></p>}
        <p className="text-white/40 text-sm mt-1">
          {payMethod === "momo"  && "Đang chuyển đến trang thanh toán MoMo..."}
          {payMethod === "vnpay" && "Đang chuyển đến trang thanh toán VNPay..."}
          {payMethod === "cod"   && "Đơn hàng đang được xử lý. Chúng tôi sẽ liên hệ sớm nhất."}
          {payMethod === "bank"  && "Vui lòng chuyển khoản theo thông tin bên dưới để hoàn tất đơn hàng."}
        </p>
      </div>

      {payMethod === "bank" && (
        <div className="w-full max-w-sm">
          <BankInfoCard total={total} orderId={orderId} />
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => navigate("/orders")} className="px-5 py-2.5 rounded-xl text-sm transition focus:outline-none" style={{ background: "rgba(255,255,255,0.08)" }}>
          Xem đơn hàng
        </button>
        <button onClick={() => navigate("/product")} className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition focus:outline-none">
          Tiếp tục mua sắm
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-white" style={{ background: "#1C1C1E" }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* CONFIRM MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
            <p className="text-sm text-white/80 mb-5 text-center">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10 transition focus:outline-none">Hủy</button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition focus:outline-none">Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-10 py-4 border-b border-white/10"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}>
        <div className="text-xl font-bold cursor-pointer focus:outline-none" onClick={() => navigate("/")}>PHONEZONE</div>
        <button onClick={() => navigate("/cart")} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition focus:outline-none">
          <ArrowLeft size={15} /> Quay lại giỏ hàng
        </button>
      </nav>

      <div className="pt-20 px-8 pb-10 max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-white/30 mb-6">
          <span className="cursor-pointer hover:text-white transition" onClick={() => navigate("/")}>Trang chủ</span>
          <ChevronRight size={12} />
          <span className="cursor-pointer hover:text-white transition" onClick={() => navigate("/cart")}>Giỏ hàng</span>
          <ChevronRight size={12} />
          <span className="text-white/60">Thanh toán</span>
        </div>

        <h1 className="text-xl font-bold mb-6">Thông tin giao hàng</h1>

        <div className="flex gap-6 items-start">
          {/* ── LEFT ── */}
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
                      style={{
                        borderColor: selectedAddr === addr.id ? "#ff9500" : "rgba(255,255,255,0.1)",
                        background:  selectedAddr === addr.id ? "rgba(255,149,0,0.08)" : "transparent",
                      }}>
                      <p className="text-sm font-medium">{addr.name} · {addr.phone}</p>
                      <p className="text-xs text-white/40 mt-1 line-clamp-2">{addr.address}</p>
                      <div className="flex gap-3 mt-2">
                        <button onClick={(e) => {
                          e.stopPropagation();
                          setEditAddr(addr);
                          setAddrForm({ name: addr.name, phone: addr.phone, addrObj: { ...emptyAddr(), detail: addr.address } });
                          setShowAddAddr(true);
                        }} className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition focus:outline-none">
                          <Pencil size={10} /> Sửa
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteAddr(addr.id); }}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition focus:outline-none">
                          <Trash2 size={10} /> Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form nhập địa chỉ */}
            <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#161616" }}>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-semibold">Địa chỉ nhận hàng</p>
                <button onClick={() => {
                  setShowAddAddr(!showAddAddr); setEditAddr(null);
                  setAddrForm({ name: "", phone: "", addrObj: emptyAddr() });
                }} className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition focus:outline-none">
                  <Plus size={12} /> Lưu địa chỉ mới
                </button>
              </div>

              {/* Popup lưu địa chỉ mới */}
              {showAddAddr && (
                <div className="mb-5 p-4 rounded-xl border border-orange-500/20 flex flex-col gap-3"
                  style={{ background: "rgba(255,149,0,0.05)" }}>
                  <p className="text-xs text-orange-400 font-medium">{editAddr ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ mới"}</p>
                  <input placeholder="Tên người nhận *" value={addrForm.name}
                    onChange={(e) => setAddrForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
                  <input placeholder="Số điện thoại *" value={addrForm.phone}
                    onChange={(e) => setAddrForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
                  <AddressForm value={addrForm.addrObj} onChange={(v) => setAddrForm((p) => ({ ...p, addrObj: v }))} />
                  <div className="flex gap-2">
                    <button onClick={saveAddr}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition focus:outline-none">
                      <Check size={13} /> Lưu
                    </button>
                    <button onClick={() => { setShowAddAddr(false); setEditAddr(null); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition focus:outline-none">
                      <X size={13} /> Hủy
                    </button>
                  </div>
                </div>
              )}

              {/* Form đặt hàng chính */}
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

                <AddressForm value={addrObj} onChange={setAddrObj} errors={addrErrors} />

                <input placeholder="Ghi chú (nếu có)" value={form.note}
                  onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
              </div>
            </div>

            {/* Phương thức thanh toán */}
            <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#161616" }}>
              <p className="text-sm font-semibold mb-4 flex items-center gap-2">
                <CreditCard size={14} className="text-orange-400" />
                Phương thức thanh toán
              </p>
              <div className="flex flex-col gap-3">
                {PAYMENT_METHODS.map((method) => (
                  <label key={method.key} onClick={() => setPayMethod(method.key)}
                    className="flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition"
                    style={{
                      borderColor: payMethod === method.key ? "#ff9500" : "rgba(255,255,255,0.1)",
                      background:  payMethod === method.key ? "rgba(255,149,0,0.08)" : "transparent",
                    }}>
                    <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border ${method.iconBg}`}>
                      {method.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{method.label}</p>
                      <p className="text-xs text-white/40 mt-0.5">{method.sub}</p>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: payMethod === method.key ? "#ff9500" : "rgba(255,255,255,0.3)" }}>
                      {payMethod === method.key && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                    </div>
                  </label>
                ))}
              </div>

              {payMethod === "bank" && <BankInfoCard total={total} orderId={null} />}
            </div>
          </div>

          {/* ── RIGHT sidebar ── */}
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
              <p className="text-sm font-semibold mb-4">Tóm tắt đơn hàng</p>
              <div className="flex flex-col gap-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/50">Tạm tính</span>
                  <span>{subtotal.toLocaleString("vi-VN")}đ</span>
                </div>
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

              {/* Preview địa chỉ realtime */}
              {buildFullAddress(addrObj) && (
                <div className="mt-3 px-3 py-2 rounded-xl flex items-start gap-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <MapPin size={12} className="shrink-0 mt-0.5 text-orange-400" />
                  <p className="text-xs text-white/50 leading-relaxed">{buildFullAddress(addrObj)}</p>
                </div>
              )}

              <button onClick={placeOrder} disabled={placing}
                className="w-full mt-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-sm transition focus:outline-none">
                {placing
                  ? "Đang xử lý..."
                  : payMethod === "vnpay"
                  ? "Thanh toán qua VNPay →"
                  : payMethod === "momo"
                  ? "Thanh toán qua MoMo →"
                  : "Xác nhận đơn hàng"}
              </button>

              {(payMethod === "vnpay" || payMethod === "momo") && (
                <p className="text-[10px] text-white/20 text-center mt-2">
                  Bạn sẽ được chuyển sang trang thanh toán sau khi xác nhận
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}