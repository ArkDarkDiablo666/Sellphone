import { useState, useEffect, useRef, useCallback } from "react";
import "./animations.css";
import Navbar from "./Navbar";
import Orders from "./Orders";
import { useNavigate } from "react-router-dom";
import { useCart } from "./Cart";
import {
  User, ShoppingBag, Pencil, X, Check, Eye, EyeOff, LogOut,
  Camera, AlertTriangle, MapPin, Phone, Mail, Lock, Plus,
  Trash2, ChevronDown, Loader
} from "lucide-react";
import Footer from "./Footer";
import { useToast, ToastContainer } from "./Toast";
import { getUser, authFetch, AUTH_REDIRECTED, checkAndHandleExpiry, clearSession } from "./authUtils";
import { API } from "./config";

const PROVINCES_API = "https://provinces.open-api.vn/api";
function useProvinces() {
  const [d, setD] = useState([]);
  useEffect(() => { fetch(`${PROVINCES_API}/?depth=1`).then(r => r.json()).then(setD).catch(() => {}); }, []);
  return d;
}
function useDistricts(code) {
  const [d, setD] = useState([]);
  useEffect(() => {
    if (!code) { setD([]); return; }
    fetch(`${PROVINCES_API}/p/${code}?depth=2`).then(r => r.json()).then(x => setD(x.districts || [])).catch(() => {});
  }, [code]);
  return d;
}
function useWards(code) {
  const [d, setD] = useState([]);
  useEffect(() => {
    if (!code) { setD([]); return; }
    fetch(`${PROVINCES_API}/d/${code}?depth=2`).then(r => r.json()).then(x => setD(x.wards || [])).catch(() => {});
  }, [code]);
  return d;
}

function SelectDropdown({ placeholder, value, options, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => String(o.code) === String(value));
  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} onClick={() => !disabled && setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-sm border transition text-left"
        style={{ background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)", borderColor: open ? "rgba(255,149,0,0.5)" : "rgba(255,255,255,0.1)", color: selected ? "white" : "rgba(255,255,255,0.3)", cursor: disabled ? "not-allowed" : "pointer" }}>
        <span className="truncate">{selected ? selected.name : placeholder}</span>
        <ChevronDown size={14} className={`shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "rgba(255,255,255,0.3)" }} />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-xl border border-white/10 shadow-2xl overflow-auto" style={{ background: "#1e1e1e", maxHeight: 220 }}>
          {options.length === 0 ? <div className="px-4 py-3 text-sm text-white/30">Đang tải...</div>
            : options.map(o => (
              <button key={o.code} type="button" onMouseDown={() => { onChange(String(o.code), o.name); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm border-b border-white/5 last:border-0 transition"
                style={{ background: String(value) === String(o.code) ? "rgba(255,149,0,0.1)" : "transparent", color: String(value) === String(o.code) ? "#ff9500" : "rgba(255,255,255,0.7)" }}>
                {o.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function DetailInput({ value, onChange, error, provinceName, districtName, wardName }) {
  const [suggs, setSuggs] = useState([]);
  const [busy, setBusy]   = useState(false);
  const [open, setOpen]   = useState(false);
  const timerRef          = useRef(null);
  const search = useCallback(async (q) => {
    if (q.length < 3) { setSuggs([]); setOpen(false); return; }
    setBusy(true);
    try {
      const ctx   = [wardName, districtName, provinceName].filter(Boolean).join(", ");
      const query = ctx ? `${q}, ${ctx}, Việt Nam` : `${q}, Việt Nam`;
      const res   = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=vn`, { headers: { "Accept-Language": "vi" } });
      const data  = await res.json();
      const cleaned = data.map(d => d.display_name.split(",").slice(0, 3).join(",").trim());
      setSuggs([...new Set(cleaned)].slice(0, 5)); setOpen(true);
    } catch { setSuggs([]); } finally { setBusy(false); }
  }, [provinceName, districtName, wardName]);
  const handleChange = e => { onChange(e.target.value); clearTimeout(timerRef.current); timerRef.current = setTimeout(() => search(e.target.value), 500); };
  return (
    <div className="relative">
      <div className="relative flex items-center">
        <MapPin size={14} className="absolute left-3 pointer-events-none text-orange-400" />
        <input type="text" value={value} onChange={handleChange} onFocus={() => suggs.length > 0 && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Số nhà, tên đường... *"
          className="w-full rounded-xl pl-9 pr-8 py-2.5 text-sm outline-none transition"
          style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${error ? "rgba(255,59,48,0.5)" : open ? "rgba(255,149,0,0.5)" : "rgba(255,255,255,0.1)"}`, color: "white" }} />
        {busy && <Loader size={13} className="absolute right-3 animate-spin text-white/30" />}
      </div>
      {open && suggs.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-xl border border-white/10 overflow-hidden shadow-2xl" style={{ background: "#1e1e1e" }}>
          {suggs.map((s, i) => (
            <button key={i} type="button" onMouseDown={() => { onChange(s); setSuggs([]); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm flex items-start gap-2 border-b border-white/5 last:border-0 hover:bg-white/5 transition" style={{ color: "rgba(255,255,255,0.7)" }}>
              <MapPin size={12} className="shrink-0 mt-0.5 text-orange-400" /><span className="line-clamp-2">{s}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

const emptyAddr = () => ({ provinceCode: "", provinceName: "", districtCode: "", districtName: "", wardCode: "", wardName: "", detail: "" });
const buildFull = a => [a.detail, a.wardName, a.districtName, a.provinceName].filter(Boolean).join(", ");

function AddressForm({ value, onChange, errors = {} }) {
  const provinces = useProvinces();
  const districts = useDistricts(value.provinceCode);
  const wards     = useWards(value.districtCode);
  const pick = field => (code, name) => {
    if (field === "province") onChange({ ...value, provinceCode: code, provinceName: name, districtCode: "", districtName: "", wardCode: "", wardName: "" });
    else if (field === "district") onChange({ ...value, districtCode: code, districtName: name, wardCode: "", wardName: "" });
    else onChange({ ...value, wardCode: code, wardName: name });
  };
  return (
    <div className="flex flex-col gap-3">
      <div><SelectDropdown placeholder="Tỉnh / Thành phố *" options={provinces} value={value.provinceCode} onChange={pick("province")} />{errors.province && <p className="text-red-400 text-xs mt-1">{errors.province}</p>}</div>
      <div><SelectDropdown placeholder="Quận / Huyện *" options={districts} value={value.districtCode} onChange={pick("district")} disabled={!value.provinceCode} />{errors.district && <p className="text-red-400 text-xs mt-1">{errors.district}</p>}</div>
      <div><SelectDropdown placeholder="Phường / Xã *" options={wards} value={value.wardCode} onChange={pick("ward")} disabled={!value.districtCode} />{errors.ward && <p className="text-red-400 text-xs mt-1">{errors.ward}</p>}</div>
      <DetailInput value={value.detail} onChange={v => onChange({ ...value, detail: v })} error={errors.detail} provinceName={value.provinceName} districtName={value.districtName} wardName={value.wardName} />
    </div>
  );
}

export default function Information() {
  const navigate  = useNavigate();
  const userLocal = getUser() || {};
  const { totalCount } = useCart();
  const { toast, toasts, removeToast } = useToast();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState("profile");

  const [editPhone, setEditPhone] = useState(false);
  const [editPass, setEditPass]   = useState(false);
  const [phone, setPhone]         = useState("");
  const [passForm, setPassForm]   = useState({ current: "", newPass: "", confirm: "" });
  const [showPass, setShowPass]   = useState({ current: false, newPass: false, confirm: false });
  const [errors, setErrors]       = useState({});
  const [saving, setSaving]       = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef(null);

  const [addresses, setAddresses]     = useState([]);
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [editAddr, setEditAddr]       = useState(null);
  const [addrForm, setAddrForm]       = useState({ isDefault: false, addrObj: emptyAddr() });
  const [addrErrors, setAddrErrors]   = useState({});
  const [addrSaving, setAddrSaving]   = useState(false);

  useEffect(() => {
    if (checkAndHandleExpiry("user")) return;
    if (!userLocal.id) { navigate("/login"); return; }
    Promise.all([
      authFetch(`${API}/api/customer/${userLocal.id}/`),
      authFetch(`${API}/api/customer/${userLocal.id}/addresses/`),
    ]).then(async ([r1, r2]) => {
      if (r1 && r1 !== AUTH_REDIRECTED) { const d = await r1.json(); if (d) { setCustomer(d); setPhone(d.phone_number || ""); } }
      if (r2 && r2 !== AUTH_REDIRECTED) { const d2 = await r2.json(); setAddresses(d2.addresses || []); }
    }).catch(() => {
      setCustomer({ id: userLocal.id, full_name: userLocal.fullName, email: userLocal.email, avatar: userLocal.avatar, phone_number: "", login_type: userLocal.loginType });
    }).finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const handleAvatarChange = async e => {
    const file = e.target.files[0]; if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Vui lòng chọn file ảnh"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Ảnh không được vượt quá 5MB"); return; }
    setAvatarLoading(true);
    try {
      const fd = new FormData(); fd.append("id", userLocal.id); fd.append("avatar_file", file);
      const res = await authFetch(`${API}/api/customer/upload-avatar/`, { method: "POST", body: fd });
      if (!res || res === AUTH_REDIRECTED) return;
      const d = await res.json();
      if (res.ok) {
        const updated = { ...getUser(), avatar: d.avatar_url };
        localStorage.setItem("user", JSON.stringify(updated));
        setCustomer(p => ({ ...p, avatar: d.avatar_url }));
        window.dispatchEvent(new Event("userUpdated"));
        toast.success("Cập nhật ảnh đại diện thành công!");
      } else toast.error(d.message || "Lỗi upload ảnh");
    } catch { toast.error("Không thể kết nối server"); } finally { setAvatarLoading(false); }
  };

  const savePhone = async () => {
    if (!phone.trim()) { setErrors({ phone: "Vui lòng nhập số điện thoại" }); return; }
    setSaving(true);
    try {
      const res = await authFetch(`${API}/api/customer/update/`, { method: "POST", body: JSON.stringify({ id: userLocal.id, phone_number: phone }) });
      if (!res || res === AUTH_REDIRECTED) return;
      if (res.ok) { setCustomer(p => ({ ...p, phone_number: phone })); setEditPhone(false); setErrors({}); toast.success("Cập nhật số điện thoại thành công!"); }
      else { const d = await res.json(); toast.error(d.message || "Loi"); }
    } finally { setSaving(false); }
  };

  const savePassword = async () => {
    const e = {};
    if (!passForm.current) e.current = "Vui lòng nhập mật khẩu hiện tại";
    if (!passForm.newPass) e.newPass = "Vui lòng nhập mật khẩu mới";
    else if (passForm.newPass.includes(" ")) e.newPass = "Không được chứa dấu cách";
    else if (passForm.newPass.length < 6) e.newPass = "Tối thiểu 6 ký tự";
    if (passForm.newPass !== passForm.confirm) e.confirm = "Mật khẩu không trùng khớp";
    setErrors(e); if (Object.keys(e).length > 0) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API}/api/customer/change-password/`, { method: "POST", body: JSON.stringify({ id: userLocal.id, current_password: passForm.current, new_password: passForm.newPass }) });
      if (!res || res === AUTH_REDIRECTED) return;
      const d = await res.json();
      if (res.ok) { setEditPass(false); setPassForm({ current: "", newPass: "", confirm: "" }); setErrors({}); toast.success("Đổi mật khẩu thành công!"); }
      else setErrors({ current: d.message });
    } finally { setSaving(false); }
  };

  const validateAddr = () => {
    const e = {};
    if (!addrForm.addrObj.provinceCode)  e.province = "Chọn tỉnh / thành phố";
    if (!addrForm.addrObj.districtCode)  e.district = "Chọn quận / huyện";
    if (!addrForm.addrObj.wardCode)      e.ward     = "Chọn phường / xã";
    if (!addrForm.addrObj.detail.trim()) e.detail   = "Nhập số nhà, đường";
    setAddrErrors(e); return Object.keys(e).length === 0;
  };

  const saveAddr = async () => {
    if (!validateAddr()) return;
    setAddrSaving(true);
    const { isDefault, addrObj: ao } = addrForm;
    const name = customer.full_name || ""; const aPhone = customer.phone_number || "";
    const payload = { customer_id: userLocal.id, name, phone: aPhone, address: buildFull(ao), province_code: ao.provinceCode, province_name: ao.provinceName, district_code: ao.districtCode, district_name: ao.districtName, ward_code: ao.wardCode, ward_name: ao.wardName, is_default: isDefault };
    try {
      const url = editAddr ? `${API}/api/customer/address/update/` : `${API}/api/customer/address/create/`;
      const res = await authFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editAddr ? { ...payload, id: editAddr.id } : payload) });
      if (!res || res === AUTH_REDIRECTED) return;
      const d = await res.json();
      if (res.ok) {
        const saved = { name: customer.full_name || "", phone: customer.phone_number || "", address: buildFull(ao), province_code: ao.provinceCode, province_name: ao.provinceName, district_code: ao.districtCode, district_name: ao.districtName, ward_code: ao.wardCode, ward_name: ao.wardName, is_default: isDefault };
        if (editAddr) setAddresses(p => p.map(a => a.id === editAddr.id ? { ...a, ...saved } : isDefault ? { ...a, is_default: false } : a));
        else setAddresses(p => isDefault ? [...p.map(a => ({ ...a, is_default: false })), { ...saved, id: d.id }] : [...p, { ...saved, id: d.id }]);
        setShowAddAddr(false); setEditAddr(null); setAddrForm({ isDefault: false, addrObj: emptyAddr() }); setAddrErrors({});
        toast.success(editAddr ? "Đã cập nhật địa chỉ!" : "Đã lưu địa chỉ mới!");
      } else toast.error(d.message || "Lỗi lưu địa chỉ");
    } catch { toast.error("Không thể kết nối server"); } finally { setAddrSaving(false); }
  };

  const deleteAddr = async id => {
    const res = await authFetch(`${API}/api/customer/address/delete/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, customer_id: userLocal.id }) });
    if (!res || res === AUTH_REDIRECTED) return;
    if (res.ok) { setAddresses(p => p.filter(a => a.id !== id)); toast.success("Đã xóa địa chỉ!"); }
    else toast.error("Xóa địa chỉ thất bại");
  };

  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = () => {
    clearSession("user");
    setConfirmLogout(false);
    sessionStorage.setItem("logout_toast", "Đã đăng xuất thành công!");
    window.dispatchEvent(new Event("userUpdated"));
    navigate("/login");
  };

  if (loading) return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"/>
        <p className="text-sm text-white/30">Đang tải...</p>
      </div>
    </div>
  );

  if (!customer) return (
    <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center gap-4">
      <AlertTriangle size={40} className="text-orange-400"/>
      <p className="text-white/50">Khong tai duoc thong tin tai khoan.</p>
      <button onClick={() => navigate("/login")} className="px-5 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition">Đăng nhập lại</button>
    </div>
  );

  const isNormal = customer.login_type === "normal";
  const loginLabel = { normal: "Email", google: "Google", facebook: "Facebook" };
  const I = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-orange-500/50 transition";
  const BO = "flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium transition disabled:opacity-60";
  const BG = "flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 text-xs transition";

  return (
    <div className="min-h-screen bg-[#111] flex flex-col">
      <Navbar cartCount={totalCount}/>
      <ToastContainer toasts={toasts} removeToast={removeToast}/>

      {/* Confirm Logout */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmLogout(false)}/>
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl z-10">
            <h3 className="font-semibold text-white mb-2 flex items-center gap-2"><LogOut size={16} className="text-red-400"/> Đăng xuất</h3>
            <p className="text-sm text-white/50 mb-5">Bạn có chắc muốn đăng xuất khỏi tài khoản không?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmLogout(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/60 transition">Hủy</button>
              <button onClick={handleLogout} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium text-white transition">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 pt-24 pb-10 flex flex-col gap-5">

        {/* Header */}
        <div className="bg-[#161616] border border-white/8 rounded-2xl p-6 flex items-center gap-5">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/5 border-2 border-orange-500/20">
              {customer.avatar ? <img src={customer.avatar} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><User size={32} className="text-white/20"/></div>}
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={avatarLoading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow transition disabled:opacity-60">
              {avatarLoading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Camera size={13}/>}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange}/>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">{customer.full_name}</h1>
            <p className="text-sm text-white/40 mt-0.5 flex items-center gap-1.5"><Mail size={12}/> {customer.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">{loginLabel[customer.login_type] || "Email"}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/10 font-mono">{customer.id}</span>
            </div>
          </div>
          <button onClick={() => setConfirmLogout(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-sm font-medium transition shrink-0">
            <LogOut size={14}/> Đăng xuất
          </button>
        </div>

        {/* ── Body: sidebar dọc + content ── */}
        <div className="flex gap-5 items-start">

          {/* Sidebar dọc */}
          <div className="w-52 shrink-0 bg-[#161616] border border-white/8 rounded-2xl overflow-hidden sticky top-24">
            {[
              { key: "profile", label: "Thông tin cá nhân", icon: <User size={15}/> },
              { key: "orders",  label: "Đơn hàng của tôi",  icon: <ShoppingBag size={15}/> },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={"w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition text-left border-b border-white/5 last:border-0 " + (
                  activeTab === t.key
                    ? "bg-orange-500/10 text-orange-400"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}>
                <span className={activeTab === t.key ? "text-orange-400" : "text-white/25"}>{t.icon}</span>
                <span className="flex-1">{t.label}</span>
                {activeTab === t.key && <div className="w-1 h-4 rounded-full bg-orange-500 shrink-0"/>}
              </button>
            ))}
            <button onClick={() => setConfirmLogout(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition text-left text-red-400/60 hover:text-red-400 hover:bg-red-500/8">
              <LogOut size={15} className="text-red-400/60"/> Đăng xuất
            </button>
          </div>

          {/* Content bên phải */}
          <div className="flex-1 min-w-0">

        {/* Tab: Profile */}
        {activeTab === "profile" && (
          <div className="flex flex-col gap-4">
            <div className="bg-[#161616] border border-white/8 rounded-2xl divide-y divide-white/5">
              <div className="flex items-center gap-4 px-6 py-4">
                <User size={15} className="text-white/20 shrink-0"/>
                <div><p className="text-[11px] text-white/30 mb-0.5">Họ và tên</p><p className="text-sm font-medium text-white">{customer.full_name}</p></div>
              </div>
              <div className="flex items-center gap-4 px-6 py-4">
                <Mail size={15} className="text-white/20 shrink-0"/>
                <div><p className="text-[11px] text-white/30 mb-0.5">Email</p><p className="text-sm text-white">{customer.email}</p></div>
              </div>
              <div className="flex items-start gap-4 px-6 py-4">
                <Phone size={15} className="text-white/20 shrink-0 mt-1"/>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white/30 mb-1">Số điện thoại</p>
                  {editPhone ? (
                    <div className="flex flex-col gap-2">
                      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Nhập số điện thoại" className={I + (errors.phone ? " border-red-500/50" : "")}/>
                      {errors.phone && <p className="text-red-400 text-xs">{errors.phone}</p>}
                      <div className="flex gap-2"><button onClick={savePhone} disabled={saving} className={BO}><Check size={12}/> Lưu</button><button onClick={() => { setEditPhone(false); setPhone(customer.phone_number || ""); setErrors({}); }} className={BG}><X size={12}/> Hủy</button></div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white">{customer.phone_number || <span className="text-white/25 italic text-xs">Chưa cập nhật</span>}</p>
                      <button onClick={() => setEditPhone(true)} className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition"><Pencil size={11}/> Sửa</button>
                    </div>
                  )}
                </div>
              </div>
              {isNormal && (
                <div className="flex items-start gap-4 px-6 py-4">
                  <Lock size={15} className="text-white/20 shrink-0 mt-1"/>
                  <div className="flex-1">
                    <p className="text-[11px] text-white/30 mb-1">Mật khẩu</p>
                    {editPass ? (
                      <div className="flex flex-col gap-2 max-w-sm">
                        {[{ key: "current", label: "Mật khẩu hiện tại" }, { key: "newPass", label: "Mật khẩu mới" }, { key: "confirm", label: "Xác nhận mật khẩu mới" }].map(({ key, label }) => (
                          <div key={key}>
                            <div className="relative">
                              <input type={showPass[key] ? "text" : "password"} value={passForm[key]} onChange={e => setPassForm(p => ({ ...p, [key]: e.target.value }))} placeholder={label} className={I + " pr-9" + (errors[key] ? " border-red-500/50" : "")}/>
                              <button type="button" onClick={() => setShowPass(p => ({ ...p, [key]: !p[key] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60">
                                {showPass[key] ? <EyeOff size={14}/> : <Eye size={14}/>}
                              </button>
                            </div>
                            {errors[key] && <p className="text-red-400 text-xs mt-0.5">{errors[key]}</p>}
                          </div>
                        ))}
                        <div className="flex gap-2 mt-1"><button onClick={savePassword} disabled={saving} className={BO}><Check size={12}/> Luu mat khau</button><button onClick={() => { setEditPass(false); setPassForm({ current: "", newPass: "", confirm: "" }); setErrors({}); }} className={BG}><X size={12}/> Hủy</button></div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-white/40">••••••••</p>
                        <button onClick={() => setEditPass(true)} className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition"><Pencil size={11}/> Doi mat khau</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Addresses */}
            <div className="bg-[#161616] border border-white/8 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-white flex items-center gap-2"><MapPin size={14} className="text-orange-400"/> Địa chỉ giao hàng</p>
                <button onClick={() => { setShowAddAddr(true); setEditAddr(null); setAddrForm({ isDefault: false, addrObj: emptyAddr() }); setAddrErrors({}); }} className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition"><Plus size={12}/> Thêm địa chỉ</button>
              </div>
              {showAddAddr && (
                <div className="mb-4 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 flex flex-col gap-3">
                  <p className="text-xs text-orange-400 font-semibold">{editAddr ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ mới"}</p>
                  <AddressForm value={addrForm.addrObj} onChange={v => setAddrForm(p => ({ ...p, addrObj: v }))} errors={addrErrors}/>
                  <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer select-none">
                    <input type="checkbox" checked={addrForm.isDefault} onChange={e => setAddrForm(p => ({ ...p, isDefault: e.target.checked }))} className="accent-orange-500 w-3.5 h-3.5"/>
                    Đặt làm địa chỉ mặc định
                  </label>
                  <div className="flex gap-2"><button onClick={saveAddr} disabled={addrSaving} className={BO}><Check size={12}/> {addrSaving ? "Đang lưu..." : "Lưu"}</button><button onClick={() => { setShowAddAddr(false); setEditAddr(null); setAddrErrors({}); }} className={BG}><X size={12}/> Hủy</button></div>
                </div>
              )}
              {addresses.length === 0 && !showAddAddr && (
                <div className="text-center py-8 text-white/20"><MapPin size={28} className="mx-auto mb-2 opacity-30"/><p className="text-xs">Chưa có địa chỉ nào</p></div>
              )}
              <div className="flex flex-col gap-3">
                {addresses.map(addr => (
                  <div key={addr.id} className={`rounded-xl border p-4 transition ${addr.is_default ? "border-orange-500/30 bg-orange-500/5" : "border-white/8 bg-white/2"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-white">{addr.name}</p>
                          {addr.is_default && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 font-medium">Mặc định</span>}
                        </div>
                        <p className="text-xs text-white/30 mt-1 leading-relaxed">{[addr.address, addr.ward_name, addr.district_name, addr.province_name].filter(Boolean).join(", ")}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => { setEditAddr(addr); setAddrForm({ isDefault: addr.is_default || false, addrObj: { detail: addr.address || "", provinceCode: addr.province_code || "", provinceName: addr.province_name || "", districtCode: addr.district_code || "", districtName: addr.district_name || "", wardCode: addr.ward_code || "", wardName: addr.ward_name || "" } }); setAddrErrors({}); setShowAddAddr(true); }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-orange-400 transition"><Pencil size={13}/></button>
                        <button onClick={() => deleteAddr(addr.id)} className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/15 text-white/40 hover:text-red-400 transition"><Trash2 size={13}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Orders */}
        {activeTab === "orders" && (
          <div className="bg-[#161616] border border-white/8 rounded-2xl p-6">
            <Orders customerId={customer.id}/>
          </div>
        )}
          </div>{/* /content */}
        </div>{/* /body flex */}
      </div>
      <Footer/>
    </div>
  );
}