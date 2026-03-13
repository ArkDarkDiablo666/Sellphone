import { useState, useEffect, useRef } from "react";
import Orders from "./Orders";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "./Cart";
import { Search, ShoppingCart, User, ShoppingBag, Settings, Pencil, X, Check, Eye, EyeOff, LogOut, Camera, ChevronDown, AlertTriangle } from "lucide-react";
import bgImage from "./Image/image-177.png";
import { SearchModal } from "./Searchbar";
import Footer from "./Footer";

const API = "http://localhost:8000";

export default function Information() {
  const navigate  = useNavigate();
  const userLocal = JSON.parse(localStorage.getItem("user") || "{}");
  const { totalCount } = useCart();

  const [customer, setCustomer]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("profile");

  // Search
  const [searchOpen, setSearchOpen] = useState(false);

  // Edit states
  const [editPhone, setEditPhone]     = useState(false);
  const [editAddress, setEditAddress] = useState(false);
  const [editPass, setEditPass]       = useState(false);

  const [phone, setPhone]       = useState("");
  const [address, setAddress]   = useState("");
  const [passForm, setPassForm] = useState({ current: "", newPass: "", confirm: "" });
  const [showPass, setShowPass] = useState({ current: false, newPass: false, confirm: false });
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Navbar dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ===== LẤY THÔNG TIN CUSTOMER =====
  useEffect(() => {
    if (!userLocal.id) { navigate("/login"); return; }
    fetch(`${API}/api/customer/${userLocal.id}/`)
      .then((r) => r.json())
      .then((data) => {
        setCustomer(data);
        setPhone(data.phone_number || "");
        setAddress(data.address || "");
      })
      .catch(() => {
        setCustomer({
          id:           userLocal.id,
          full_name:    userLocal.fullName,
          email:        userLocal.email,
          avatar:       userLocal.avatar,
          phone_number: "",
          address:      "",
          login_type:   userLocal.loginType,
        });
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== ĐỔI AVATAR =====
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Vui lòng chọn file ảnh"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Ảnh không được vượt quá 5MB"); return; }

    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append("id", userLocal.id);
      formData.append("avatar_file", file);
      const res  = await fetch(`${API}/api/customer/upload-avatar/`, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        const stored  = JSON.parse(localStorage.getItem("user") || "{}");
        const updated = { ...stored, avatar: data.avatar_url };
        localStorage.setItem("user", JSON.stringify(updated));
        setCustomer((prev) => ({ ...prev, avatar: data.avatar_url }));
        window.dispatchEvent(new Event("userUpdated"));
      } else {
        toast.error(data.message || "Lỗi upload ảnh");
      }
    } catch { toast.error("Không thể kết nối server"); }
    finally { setAvatarLoading(false); }
  };

  // ===== LƯU SỐ ĐIỆN THOẠI =====
  const savePhone = async () => {
    if (!phone.trim()) { setErrors({ phone: "Vui lòng nhập số điện thoại" }); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/customer/update/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userLocal.id, phone_number: phone }),
      });
      if (res.ok) { setCustomer((prev) => ({ ...prev, phone_number: phone })); setEditPhone(false); setErrors({}); }
    } finally { setSaving(false); }
  };

  // ===== LƯU ĐỊA CHỈ =====
  const saveAddress = async () => {
    if (!address.trim()) { setErrors({ address: "Vui lòng nhập địa chỉ" }); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/customer/update/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userLocal.id, address }),
      });
      if (res.ok) { setCustomer((prev) => ({ ...prev, address })); setEditAddress(false); setErrors({}); }
    } finally { setSaving(false); }
  };

  // ===== ĐỔI MẬT KHẨU =====
  const savePassword = async () => {
    const newErr = {};
    if (!passForm.current)                         newErr.current = "Vui lòng nhập mật khẩu hiện tại";
    if (!passForm.newPass)                         newErr.newPass = "Vui lòng nhập mật khẩu mới";
    else if (passForm.newPass.includes(" "))       newErr.newPass = "Mật khẩu không được chứa dấu cách";
    else if (passForm.newPass.length < 6)          newErr.newPass = "Mật khẩu phải có ít nhất 6 ký tự";
    if (!passForm.confirm)                         newErr.confirm = "Vui lòng nhập lại mật khẩu";
    else if (passForm.newPass !== passForm.confirm) newErr.confirm = "Mật khẩu không trùng khớp";
    setErrors(newErr);
    if (Object.keys(newErr).length > 0) return;

    setSaving(true);
    try {
      const res  = await fetch(`${API}/api/customer/change-password/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userLocal.id, current_password: passForm.current, new_password: passForm.newPass }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditPass(false);
        setPassForm({ current: "", newPass: "", confirm: "" });
        setErrors({});
        toast.success("Đổi mật khẩu thành công!");
      } else {
        setErrors({ current: data.message });
      }
    } finally { setSaving(false); }
  };

  const handleLogout = () => { localStorage.removeItem("user"); setConfirmLogout(false); navigate("/login"); };

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
    </div>
  );

  const loginTypeLabel = { google: "Đăng nhập qua Google", facebook: "Đăng nhập qua Facebook", normal: null };

  return (
    <div className="relative min-h-screen text-white overflow-hidden bg-[#0f0f0f]">

      {/* HỘP THOẠI XÁC NHẬN ĐĂNG XUẤT */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmLogout(false)} />
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">Đăng xuất</h3>
            <p className="text-gray-400 text-sm mb-6">Bạn có muốn đăng xuất không?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmLogout(false)} className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm transition">Hủy</button>
              <button onClick={handleLogout} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-cover bg-center scale-105 opacity-20" style={{ backgroundImage: `url(${bgImage})` }}></div>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="relative z-10 flex flex-col min-h-screen pt-[65px]">

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

            <button onClick={() => navigate(userLocal.id ? "/cart" : "/login")} className="relative">
              <ShoppingCart className="hover:text-white transition" size={22} />
              {totalCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {totalCount > 9 ? "9+" : totalCount}
                </span>
              )}
            </button>
            {customer ? (
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 hover:text-white transition">
                  {customer.avatar
                    ? <img src={customer.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20" onError={(e)=>{e.currentTarget.style.display="none"}} />
                    : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>
                  }
                  <ChevronDown size={14} className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                      {customer.avatar
                        ? <img src={customer.avatar} alt="" className="w-9 h-9 rounded-full object-cover" onError={(e)=>{e.currentTarget.style.display="none"}} />
                        : <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>
                      }
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium truncate">{customer.full_name}</p>
                        <p className="text-xs text-white/40 truncate">{customer.email}</p>
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

        {/* CONTENT */}
        <div className="flex flex-1">

          {/* SIDEBAR */}
          <aside className="w-60 bg-black/30 border-r border-white/5 flex flex-col py-8 px-4 shrink-0">
            <div className="flex flex-col items-center mb-8">
              <div className="relative group">
                {customer?.avatar ? (
                  <img src={customer.avatar} alt="" className="w-20 h-20 rounded-full object-cover ring-2 ring-white/10" onError={(e)=>{e.currentTarget.style.display="none"}} />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center"><User size={32} className="text-white/40" /></div>
                )}
                {customer?.login_type === "normal" && (
                  <>
                    <button onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      {avatarLoading
                        ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <Camera size={18} className="text-white" />}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </>
                )}
              </div>
              <p className="font-semibold text-sm text-center mt-3">{customer?.full_name}</p>
              <p className="text-xs text-white/40 text-center mt-1">{customer?.id}</p>
            </div>

            <nav className="flex flex-col gap-1 flex-1">
              {[
                { key: "profile",  label: "Hồ sơ cá nhân", icon: User },
                { key: "orders",   label: "Đơn hàng",       icon: ShoppingBag },
                { key: "settings", label: "Cài đặt",         icon: Settings },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition ${activeTab === key ? "bg-white text-black font-semibold" : "text-white/50 hover:bg-white/5 hover:text-white"}`}>
                  <Icon size={16} />{label}
                </button>
              ))}
            </nav>

            <button onClick={() => setConfirmLogout(true)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition mt-4">
              <LogOut size={16} />Đăng xuất
            </button>
          </aside>

          {/* MAIN */}
          <main className="flex-1 overflow-y-auto p-8">

            {activeTab === "profile" && (
              <div className="max-w-2xl mx-auto flex flex-col gap-6">

                <Section title="Thông tin cá nhân">
                  <InfoRow label="Mã khách hàng" value={customer?.id} />
                  <InfoRow label="Họ và tên"     value={customer?.full_name} />
                  <InfoRow label="Email"          value={customer?.email} />
                  <EditableRow
                    label="Số điện thoại" value={customer?.phone_number} isEditing={editPhone}
                    inputValue={phone} onInputChange={(v) => { setPhone(v); setErrors({}); }}
                    onEdit={() => setEditPhone(true)} onSave={savePhone}
                    onCancel={() => { setEditPhone(false); setPhone(customer?.phone_number || ""); setErrors({}); }}
                    saving={saving} error={errors.phone}
                  />
                  <EditableRow
                    label="Địa chỉ" value={customer?.address} isEditing={editAddress}
                    inputValue={address} onInputChange={(v) => { setAddress(v); setErrors({}); }}
                    onEdit={() => setEditAddress(true)} onSave={saveAddress}
                    onCancel={() => { setEditAddress(false); setAddress(customer?.address || ""); setErrors({}); }}
                    saving={saving} error={errors.address}
                  />
                </Section>

                <Section title="Thông tin tài khoản">
                  <InfoRow
                    label="Phương thức"
                    value={
                      loginTypeLabel[customer?.login_type] ? (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${customer.login_type === "google" ? "bg-blue-500/20 text-blue-300" : "bg-indigo-500/20 text-indigo-300"}`}>
                          {loginTypeLabel[customer?.login_type]}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/50">Email & Mật khẩu</span>
                      )
                    }
                  />
                  {customer?.login_type === "normal" && (
                    <div className="flex items-start justify-between py-3 border-b border-white/5">
                      <span className="text-white/40 text-sm w-36 shrink-0 pt-1">Mật khẩu</span>
                      {editPass ? (
                        <div className="flex-1 flex flex-col gap-2">
                          <PasswordInput placeholder="Mật khẩu hiện tại"     value={passForm.current} show={showPass.current} onToggle={() => setShowPass(p => ({ ...p, current: !p.current }))} onChange={(v) => setPassForm(p => ({ ...p, current: v }))} error={errors.current} />
                          <PasswordInput placeholder="Mật khẩu mới"          value={passForm.newPass} show={showPass.newPass} onToggle={() => setShowPass(p => ({ ...p, newPass: !p.newPass }))} onChange={(v) => setPassForm(p => ({ ...p, newPass: v }))} error={errors.newPass} />
                          <PasswordInput placeholder="Nhập lại mật khẩu mới" value={passForm.confirm} show={showPass.confirm} onToggle={() => setShowPass(p => ({ ...p, confirm: !p.confirm }))} onChange={(v) => setPassForm(p => ({ ...p, confirm: v }))} error={errors.confirm} />
                          <div className="flex gap-2 mt-1">
                            <button onClick={savePassword} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:opacity-80 transition"><Check size={12} /> Lưu</button>
                            <button onClick={() => { setEditPass(false); setPassForm({ current: "", newPass: "", confirm: "" }); setErrors({}); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-xs hover:bg-white/20 transition"><X size={12} /> Hủy</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-between">
                          <span className="text-sm tracking-widest text-white/30">••••••••</span>
                          <button onClick={() => setEditPass(true)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition"><Pencil size={14} /></button>
                        </div>
                      )}
                    </div>
                  )}
                </Section>

              </div>
            )}

            {activeTab === "orders" && (
              <div className="max-w-2xl mx-auto">
                <Orders embedded={true} />
              </div>
            )}

            {activeTab === "settings" && (
              <div className="max-w-2xl mx-auto">
                <h2 className="text-xl font-semibold mb-6">Cài đặt</h2>
                <div className="bg-white/5 rounded-2xl p-12 text-center text-white/30">
                  <Settings size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Đang phát triển</p>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}function Section({ title, children }) {
  return (
    <div className="bg-black/30 rounded-2xl border border-white/5 overflow-hidden backdrop-blur-sm">
      <div className="px-6 py-4 border-b border-white/5"><h3 className="font-semibold text-sm">{title}</h3></div>
      <div className="px-6 py-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-white/40 text-sm w-36 shrink-0">{label}</span>
      <span className="flex-1 text-sm">{value || <span className="text-white/20 italic">Chưa cập nhật</span>}</span>
    </div>
  );
}

function EditableRow({ label, value, isEditing, inputValue, onInputChange, onEdit, onSave, onCancel, saving, error }) {
  return (
    <>
      <div className="flex items-center justify-between py-3 border-b border-white/5">
        <span className="text-white/40 text-sm w-36 shrink-0">{label}</span>
        {isEditing ? (
          <div className="flex-1 flex items-center gap-2">
            <input value={inputValue} onChange={(e) => onInputChange(e.target.value)}
              className={`flex-1 bg-white/5 border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-white/30 transition ${error ? "border-red-500/50" : "border-white/10"}`} />
            <button onClick={onSave} disabled={saving} className="p-1.5 rounded-lg bg-white text-black hover:opacity-80 transition"><Check size={14} /></button>
            <button onClick={onCancel} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"><X size={14} /></button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-between">
            <span className="text-sm">{value || <span className="text-white/20 italic">Chưa cập nhật</span>}</span>
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition"><Pencil size={14} /></button>
          </div>
        )}
      </div>
      {error && <p className="text-red-400 text-xs pl-36 -mt-1 mb-1">{error}</p>}
    </>
  );
}

function PasswordInput({ placeholder, value, show, onToggle, onChange, error }) {
  return (
    <div>
      <div className="relative">
        <input type={show ? "text" : "password"} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-white/5 border rounded-lg px-3 py-1.5 pr-9 text-sm outline-none focus:border-white/30 transition ${error ? "border-red-500/50" : "border-white/10"}`} />
        <button type="button" onClick={onToggle} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-0.5 pl-1">{error}</p>}
    </div>
  );
}