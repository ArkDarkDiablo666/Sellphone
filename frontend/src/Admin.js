import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, LogOut, Camera, Settings, Package,
  PackagePlus, Users, ChevronRight, Eye, EyeOff,
  Pencil, Check, X, Plus, Shield, AlertTriangle
} from "lucide-react";

const API = "http://localhost:8000";

export default function Admin() {
  const navigate  = useNavigate();
  const adminLocal = JSON.parse(localStorage.getItem("user") || "{}");

  const [activeTab, setActiveTab]         = useState("profile");
  const [admin, setAdmin]                 = useState(null);
  const [loading, setLoading]             = useState(true);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [errors, setErrors]               = useState({});

  // Profile edit
  const [editPass, setEditPass] = useState(false);
  const [passForm, setPassForm] = useState({ current: "", newPass: "", confirm: "" });
  const [showPass, setShowPass] = useState({ current: false, newPass: false, confirm: false });

  // Staff management
  const [staffList, setStaffList]         = useState([]);
  const [staffLoading, setStaffLoading]   = useState(false);
  const [showAddStaff, setShowAddStaff]   = useState(false);
  const [newStaff, setNewStaff]           = useState({ fullname: "", email: "", password: "", role: "Staff" });
  const [newStaffErrors, setNewStaffErrors] = useState({});

  // Product
  const [categories, setCategories]         = useState([]);
  const [productList, setProductList]       = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productSaving, setProductSaving]   = useState(false);
  const [productErrors, setProductErrors]   = useState({});
  const [newProduct, setNewProduct] = useState({
    name: "", brand: "", description: "", categoryId: "",
  });
  const EMPTY_VARIANT = {
    color: "", storage: "", ram: "", price: "", stock: "",
    cpu: "", os: "", screenSize: "", screenTech: "", refreshRate: "",
    battery: "", chargingSpeed: "", frontCamera: "", rearCamera: "",
    weights: "", updates: "",
  };
  const [variants, setVariants] = useState([{ ...EMPTY_VARIANT }]);
  const [productImages, setProductImages] = useState([]);
  const productImageRef = useRef(null);

  // Import
  const [importProductId, setImportProductId]     = useState("");
  const [importVariants, setImportVariants]        = useState([]);
  const [importQty, setImportQty]                  = useState({});
  const [importLoading, setImportLoading]           = useState(false);
  const [importSaving, setImportSaving]             = useState(false);

  const fileInputRef = useRef(null);

  // ===== LOAD ADMIN INFO =====
  useEffect(() => {
    if (!adminLocal.id || adminLocal.loginType !== "admin") { navigate("/admin/login"); return; }
    fetch(`${API}/api/staff/${adminLocal.id}/`)
      .then((r) => r.json())
      .then((data) => setAdmin(data))
      .catch(() => setAdmin({
        id: adminLocal.id, full_name: adminLocal.fullName,
        email: adminLocal.username, avatar: adminLocal.avatar, role: adminLocal.role,
      }))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== LOAD STAFF LIST =====
  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      const res  = await fetch(`${API}/api/staff/list/`);
      const data = await res.json();
      if (res.ok) setStaffList(data.staff || []);
    } finally { setStaffLoading(false); }
  };

  useEffect(() => { if (activeTab === "staff")   loadStaff();    }, [activeTab]); // eslint-disable-line
  useEffect(() => { if (activeTab === "product") loadProducts();  }, [activeTab]); // eslint-disable-line
  useEffect(() => { if (activeTab === "import")  loadProducts();  }, [activeTab]); // eslint-disable-line

  const loadProducts = async () => {
    setProductLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch(`${API}/api/product/categories/`),
        fetch(`${API}/api/product/list/`),
      ]);
      const catData  = await catRes.json();
      const prodData = await prodRes.json();
      if (catRes.ok)  setCategories(catData.categories || []);
      if (prodRes.ok) setProductList(prodData.products  || []);
    } finally { setProductLoading(false); }
  };

  const addVariant    = () => setVariants((v) => [...v, { color: "", storage: "", ram: "", price: "", stock: "", cpu: "", os: "", screenSize: "", screenTech: "", refreshRate: "", battery: "", chargingSpeed: "", frontCamera: "", rearCamera: "", weights: "", updates: "" }]);
  const removeVariant = (i) => setVariants((v) => v.filter((_, idx) => idx !== i));
  const updateVariant = (i, key, val) => setVariants((v) => v.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const handleSaveProduct = async () => {
    const errs = {};
    if (!newProduct.name.trim())       errs.name       = "Vui lòng nhập tên sản phẩm";
    if (!newProduct.categoryId)        errs.categoryId = "Vui lòng chọn danh mục";
    if (variants.some((v) => !v.price || !v.stock)) errs.variants = "Mỗi biến thể cần có giá và số lượng";
    setProductErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setProductSaving(true);
    try {
      const formData = new FormData();
      formData.append("product_name",  newProduct.name);
      formData.append("brand",         newProduct.brand);
      formData.append("description",   newProduct.description);
      formData.append("category_id",   newProduct.categoryId);
      formData.append("variants",      JSON.stringify(variants));
      productImages.forEach((f) => formData.append("images", f));
      const res  = await fetch(`${API}/api/product/create/`, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setShowAddProduct(false);
        setNewProduct({ name: "", brand: "", description: "", categoryId: "" });
        setVariants([{ color: "", storage: "", ram: "", price: "", stock: "", cpu: "", os: "", screenSize: "", screenTech: "", refreshRate: "", battery: "", chargingSpeed: "", frontCamera: "", rearCamera: "", weights: "", updates: "" }]);
        setProductImages([]);
        loadProducts();
        alert("Tạo sản phẩm thành công!");
      } else { setProductErrors({ general: data.message }); }
    } finally { setProductSaving(false); }
  };

  const loadImportVariants = async (productId) => {
    if (!productId) return;
    setImportLoading(true);
    try {
      const res  = await fetch(`${API}/api/product/${productId}/variants/`);
      const data = await res.json();
      if (res.ok) { setImportVariants(data.variants || []); setImportQty({}); }
    } finally { setImportLoading(false); }
  };

  const handleImport = async () => {
    const entries = Object.entries(importQty).filter(([, q]) => parseInt(q) > 0);
    if (entries.length === 0) { alert("Chưa nhập số lượng cho biến thể nào"); return; }
    setImportSaving(true);
    try {
      const res  = await fetch(`${API}/api/product/import/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: entries.map(([variantId, qty]) => ({ variant_id: parseInt(variantId), quantity: parseInt(qty) })) }),
      });
      const data = await res.json();
      if (res.ok) { alert("Nhập hàng thành công!"); loadImportVariants(importProductId); }
      else        { alert(data.message); }
    } finally { setImportSaving(false); }
  };

  // ===== ĐỔI AVATAR =====
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Vui lòng chọn file ảnh"); return; }
    if (file.size > 5 * 1024 * 1024)    { alert("Ảnh không được vượt quá 5MB"); return; }

    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append("id", adminLocal.id);
      formData.append("avatar_file", file);
      const res  = await fetch(`${API}/api/staff/upload-avatar/`, { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setAdmin((prev) => ({ ...prev, avatar: data.avatar_url }));
        const stored  = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem("user", JSON.stringify({ ...stored, avatar: data.avatar_url }));
        window.dispatchEvent(new Event("userUpdated"));
      } else { alert(data.message); }
    } catch { alert("Không thể kết nối server"); }
    finally  { setAvatarLoading(false); }
  };

  // ===== ĐỔI MẬT KHẨU =====
  const savePassword = async () => {
    const newErr = {};
    if (!passForm.current)                   newErr.current = "Vui lòng nhập mật khẩu hiện tại";
    if (!passForm.newPass)                   newErr.newPass = "Vui lòng nhập mật khẩu mới";
    else if (passForm.newPass.includes(" ")) newErr.newPass = "Không được chứa dấu cách";
    else if (passForm.newPass.length < 6)    newErr.newPass = "Ít nhất 6 ký tự";
    if (!passForm.confirm)                   newErr.confirm = "Vui lòng nhập lại";
    else if (passForm.newPass !== passForm.confirm) newErr.confirm = "Không trùng khớp";
    setErrors(newErr);
    if (Object.keys(newErr).length > 0) return;

    setSaving(true);
    try {
      const res  = await fetch(`${API}/api/staff/change-password/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: adminLocal.id, current_password: passForm.current, new_password: passForm.newPass }),
      });
      const data = await res.json();
      if (res.ok) { setEditPass(false); setPassForm({ current: "", newPass: "", confirm: "" }); setErrors({}); alert("Đổi mật khẩu thành công!"); }
      else setErrors({ current: data.message });
    } finally { setSaving(false); }
  };

  // ===== THÊM NHÂN VIÊN =====
  const handleAddStaff = async () => {
    const errs = {};
    if (!newStaff.fullname.trim()) errs.fullname = "Vui lòng nhập họ tên";
    if (!newStaff.email.trim())    errs.email    = "Vui lòng nhập email";
    if (!newStaff.password.trim()) errs.password = "Vui lòng nhập mật khẩu";
    else if (newStaff.password.length < 6) errs.password = "Ít nhất 6 ký tự";
    setNewStaffErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const res  = await fetch(`${API}/api/staff/create/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: newStaff.fullname, email: newStaff.email, password: newStaff.password, role: newStaff.role }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddStaff(false);
        setNewStaff({ fullname: "", email: "", password: "", role: "Staff" });
        loadStaff();
        alert("Tạo tài khoản thành công!");
      } else { setNewStaffErrors({ general: data.message }); }
    } finally { setSaving(false); }
  };

  // ===== ĐỔI QUYỀN NHÂN VIÊN =====
  const changeRole = async (staffId, newRole) => {
    try {
      const res = await fetch(`${API}/api/staff/update-role/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: staffId, role: newRole }),
      });
      if (res.ok) loadStaff();
    } catch { alert("Lỗi cập nhật quyền"); }
  };

  const handleLogout = () => { localStorage.removeItem("user"); navigate("/admin/login"); };

  const ROLE_COLOR = {
    Admin:      "bg-orange-500/20 text-orange-300 border-orange-500/30",
    Staff:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
    Unentitled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };

  const menuItems = [
    { key: "profile",  label: "Thông tin cá nhân",  icon: User },
    { key: "staff",    label: "Quản lý nhân viên",   icon: Users },
    { key: "product",  label: "Quản lý sản phẩm",    icon: Package },
    { key: "import",   label: "Nhập hàng",            icon: PackagePlus },
    { key: "settings", label: "Cài đặt",              icon: Settings },
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">

      {/* ===== HỘP THOẠI ĐĂNG XUẤT ===== */}
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
            <p className="text-gray-400 text-sm mb-6">Bạn có muốn đăng xuất khỏi trang quản trị không?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmLogout(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition border border-white/10">Hủy</button>
              <button onClick={handleLogout}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== SIDEBAR ===== */}
      <aside className="w-64 bg-[#111111] border-r border-white/5 flex flex-col min-h-screen">
        {/* Header */}
        <div className="px-6 py-6 border-b border-white/5">
          <p className="text-xs text-orange-400 font-medium tracking-widest uppercase mb-1">Quản trị</p>
          <h1 className="text-lg font-bold tracking-tight">PHONEZONE</h1>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center py-8 px-6 border-b border-white/5">
          <div className="relative group mb-3">
            {admin?.avatar ? (
              <img src={admin.avatar} alt="avatar"
                className="w-20 h-20 rounded-full object-cover ring-2 ring-orange-500/30" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <User size={32} className="text-orange-400/60" />
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              {avatarLoading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Camera size={16} className="text-white" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <p className="font-semibold text-sm">{admin?.full_name}</p>
          <span className={`mt-1 text-xs px-2 py-0.5 rounded-full border ${ROLE_COLOR[admin?.role] || ROLE_COLOR.Staff}`}>
            {admin?.role}
          </span>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {menuItems.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition group
                ${activeTab === key
                  ? "bg-orange-500/15 text-orange-300 border border-orange-500/20"
                  : "text-white/40 hover:bg-white/5 hover:text-white"}`}>
              <span className="flex items-center gap-3"><Icon size={16} />{label}</span>
              <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition ${activeTab === key ? "opacity-100" : ""}`} />
            </button>
          ))}
        </nav>

        <div className="px-3 pb-6">
          <button onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition">
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 overflow-y-auto">

        {/* TOPBAR */}
        <div className="sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 px-8 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-white/80">
            {menuItems.find((m) => m.key === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-2 text-xs text-white/30">
            <Shield size={12} className="text-orange-400" />
            {admin?.role}
          </div>
        </div>

        <div className="p-8">

          {/* ===== THÔNG TIN CÁ NHÂN ===== */}
          {activeTab === "profile" && (
            <div className="max-w-2xl flex flex-col gap-6">
              <AdminSection title="Thông tin tài khoản">
                <InfoRow label="Mã nhân viên" value={admin?.id} />
                <InfoRow label="Họ và tên"    value={admin?.full_name} />
                <InfoRow label="Email"         value={admin?.email} />
                <InfoRow label="Vai trò"
                  value={<span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLOR[admin?.role]}`}>{admin?.role}</span>} />
              </AdminSection>

              <AdminSection title="Đổi mật khẩu">
                {editPass ? (
                  <div className="flex flex-col gap-3 py-2">
                    <PwInput placeholder="Mật khẩu hiện tại" value={passForm.current}
                      show={showPass.current} onToggle={() => setShowPass((p) => ({ ...p, current: !p.current }))}
                      onChange={(v) => setPassForm((p) => ({ ...p, current: v }))} error={errors.current} />
                    <PwInput placeholder="Mật khẩu mới" value={passForm.newPass}
                      show={showPass.newPass} onToggle={() => setShowPass((p) => ({ ...p, newPass: !p.newPass }))}
                      onChange={(v) => setPassForm((p) => ({ ...p, newPass: v }))} error={errors.newPass} />
                    <PwInput placeholder="Nhập lại mật khẩu mới" value={passForm.confirm}
                      show={showPass.confirm} onToggle={() => setShowPass((p) => ({ ...p, confirm: !p.confirm }))}
                      onChange={(v) => setPassForm((p) => ({ ...p, confirm: v }))} error={errors.confirm} />
                    <div className="flex gap-2 mt-1">
                      <button onClick={savePassword} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                        <Check size={14} /> Lưu
                      </button>
                      <button onClick={() => { setEditPass(false); setPassForm({ current: "", newPass: "", confirm: "" }); setErrors({}); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition">
                        <X size={14} /> Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-3">
                    <span className="text-white/30 text-sm tracking-widest">••••••••</span>
                    <button onClick={() => setEditPass(true)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs transition">
                      <Pencil size={12} /> Đổi mật khẩu
                    </button>
                  </div>
                )}
              </AdminSection>
            </div>
          )}

          {/* ===== QUẢN LÝ NHÂN VIÊN ===== */}
          {activeTab === "staff" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/40">{staffList.length} tài khoản</p>
                <button onClick={() => setShowAddStaff(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition">
                  <Plus size={16} /> Thêm nhân viên
                </button>
              </div>

              {/* Form thêm nhân viên */}
              {showAddStaff && (
                <div className="bg-[#161616] border border-white/10 rounded-2xl p-6">
                  <h3 className="font-semibold mb-4 text-sm">Tạo tài khoản mới</h3>
                  {newStaffErrors.general && <p className="text-red-400 text-xs mb-3">{newStaffErrors.general}</p>}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input placeholder="Họ và tên" value={newStaff.fullname}
                        onChange={(e) => setNewStaff((p) => ({ ...p, fullname: e.target.value }))}
                        className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition
                          ${newStaffErrors.fullname ? "border-red-500/50" : "border-white/10"}`} />
                      {newStaffErrors.fullname && <p className="text-red-400 text-xs mt-1">{newStaffErrors.fullname}</p>}
                    </div>
                    <div>
                      <input placeholder="Email" value={newStaff.email}
                        onChange={(e) => setNewStaff((p) => ({ ...p, email: e.target.value }))}
                        className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition
                          ${newStaffErrors.email ? "border-red-500/50" : "border-white/10"}`} />
                      {newStaffErrors.email && <p className="text-red-400 text-xs mt-1">{newStaffErrors.email}</p>}
                    </div>
                    <div>
                      <input placeholder="Mật khẩu" type="password" value={newStaff.password}
                        onChange={(e) => setNewStaff((p) => ({ ...p, password: e.target.value }))}
                        className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition
                          ${newStaffErrors.password ? "border-red-500/50" : "border-white/10"}`} />
                      {newStaffErrors.password && <p className="text-red-400 text-xs mt-1">{newStaffErrors.password}</p>}
                    </div>
                    <div>
                      <select value={newStaff.role} onChange={(e) => setNewStaff((p) => ({ ...p, role: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition">
                        <option value="Staff">Staff</option>
                        <option value="Admin">Admin</option>
                        <option value="Unentitled">Unentitled</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={handleAddStaff} disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                      <Check size={14} /> Tạo tài khoản
                    </button>
                    <button onClick={() => { setShowAddStaff(false); setNewStaffErrors({}); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition">
                      <X size={14} /> Hủy
                    </button>
                  </div>
                </div>
              )}

              {/* Danh sách nhân viên */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-4 px-6 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider">
                  <span>Nhân viên</span><span>Email</span><span>Vai trò</span><span>Hành động</span>
                </div>
                {staffLoading ? (
                  <div className="py-12 flex justify-center">
                    <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  </div>
                ) : staffList.length === 0 ? (
                  <div className="py-12 text-center text-white/20 text-sm">Chưa có nhân viên nào</div>
                ) : (
                  staffList.map((s) => (
                    <div key={s.id} className="grid grid-cols-4 px-6 py-4 border-b border-white/5 last:border-0 items-center hover:bg-white/2 transition">
                      <div className="flex items-center gap-3">
                        {s.avatar ? (
                          <img src={s.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                            <User size={14} className="text-white/30" />
                          </div>
                        )}
                        <span className="text-sm font-medium">{s.full_name}</span>
                      </div>
                      <span className="text-sm text-white/50">{s.email}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${ROLE_COLOR[s.role] || ROLE_COLOR.Staff}`}>{s.role}</span>
                      <select value={s.role} onChange={(e) => changeRole(s.id, e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-orange-500/50 w-fit">
                        <option value="Admin">Admin</option>
                        <option value="Staff">Staff</option>
                        <option value="Unentitled">Unentitled</option>
                      </select>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ===== QUẢN LÝ SẢN PHẨM ===== */}
          {/* ===== QUẢN LÝ SẢN PHẨM ===== */}
          {activeTab === "product" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/40">{productList.length} sản phẩm</p>
                <button onClick={() => setShowAddProduct(!showAddProduct)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition">
                  <Plus size={16} /> {showAddProduct ? "Đóng" : "Thêm sản phẩm"}
                </button>
              </div>

              {showAddProduct && (
                <div className="bg-[#161616] border border-white/10 rounded-2xl p-6 flex flex-col gap-6">
                  <h3 className="font-semibold text-sm text-orange-400">Tạo sản phẩm mới</h3>
                  {productErrors.general && <p className="text-red-400 text-xs">{productErrors.general}</p>}

                  {/* THÔNG TIN CHUNG */}
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Thông tin chung</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input placeholder="Tên sản phẩm *" value={newProduct.name}
                          onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                          className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition ${productErrors.name ? "border-red-500/50" : "border-white/10"}`} />
                        {productErrors.name && <p className="text-red-400 text-xs mt-1">{productErrors.name}</p>}
                      </div>
                      <input placeholder="Hãng sản xuất" value={newProduct.brand}
                        onChange={(e) => setNewProduct((p) => ({ ...p, brand: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition" />
                      <div>
                        <select value={newProduct.categoryId}
                          onChange={(e) => setNewProduct((p) => ({ ...p, categoryId: e.target.value }))}
                          className={`w-full bg-[#1e1e1e] border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition ${productErrors.categoryId ? "border-red-500/50" : "border-white/10"}`}>
                          <option value="">-- Chọn danh mục *</option>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {productErrors.categoryId && <p className="text-red-400 text-xs mt-1">{productErrors.categoryId}</p>}
                      </div>
                      <textarea placeholder="Mô tả sản phẩm" value={newProduct.description}
                        onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition resize-none h-20" />
                    </div>
                  </div>

                  {/* ẢNH SẢN PHẨM */}
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Ảnh sản phẩm</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {productImages.map((file, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 group">
                          <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => setProductImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <X size={16} className="text-white" />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => productImageRef.current?.click()}
                        className="w-20 h-20 rounded-xl border border-dashed border-white/20 hover:border-orange-500/50 flex flex-col items-center justify-center text-white/30 hover:text-orange-400 transition text-xs gap-1">
                        <Plus size={20} /><span>Thêm</span>
                      </button>
                      <input ref={productImageRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => setProductImages((prev) => [...prev, ...Array.from(e.target.files)])} />
                    </div>
                  </div>

                  {/* BIẾN THỂ */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-white/40 uppercase tracking-wider">
                        Biến thể sản phẩm ({variants.length})
                        {productErrors.variants && <span className="text-red-400 ml-2 normal-case">{productErrors.variants}</span>}
                      </p>
                      <button onClick={addVariant}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs transition">
                        <Plus size={12} /> Thêm biến thể
                      </button>
                    </div>

                    <div className="flex flex-col gap-4">
                      {variants.map((v, i) => (
                        <div key={i} className="border border-white/10 rounded-xl p-4 bg-white/2 relative">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium text-orange-400">Biến thể #{i + 1}</span>
                            {variants.length > 1 && (
                              <button onClick={() => removeVariant(i)}
                                className="text-red-400/60 hover:text-red-400 transition p-1 rounded-lg hover:bg-red-500/10">
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          {/* Thông tin cơ bản - luôn hiện */}
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            {[
                              { key: "color",   placeholder: "Màu sắc" },
                              { key: "storage", placeholder: "Bộ nhớ (VD: 128GB)" },
                              { key: "ram",     placeholder: "RAM (VD: 8GB)" },
                              { key: "price",   placeholder: "Giá (VNĐ) *" },
                              { key: "stock",   placeholder: "Số lượng *" },
                            ].map(({ key, placeholder }) => (
                              <input key={key} placeholder={placeholder} value={v[key]}
                                onChange={(e) => updateVariant(i, key, e.target.value)}
                                className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition
                                  ${(key === "price" || key === "stock") && !v[key] && productErrors.variants ? "border-red-500/50" : "border-white/10"}`} />
                            ))}
                          </div>

                          {/* Thông số kỹ thuật - có thể thu gọn */}
                          <details className="group">
                            <summary className="text-xs text-white/30 hover:text-white/60 cursor-pointer select-none list-none flex items-center gap-1 mb-3">
                              <ChevronRight size={12} className="group-open:rotate-90 transition-transform" />
                              Thông số kỹ thuật
                            </summary>
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { key: "cpu",           placeholder: "CPU" },
                                { key: "os",            placeholder: "Hệ điều hành" },
                                { key: "screenSize",    placeholder: "Kích thước màn hình" },
                                { key: "screenTech",    placeholder: "Công nghệ màn hình" },
                                { key: "refreshRate",   placeholder: "Tần số quét" },
                                { key: "battery",       placeholder: "Dung lượng pin" },
                                { key: "chargingSpeed", placeholder: "Tốc độ sạc" },
                                { key: "frontCamera",   placeholder: "Camera trước" },
                                { key: "rearCamera",    placeholder: "Camera sau" },
                                { key: "weights",       placeholder: "Trọng lượng" },
                                { key: "updates",       placeholder: "Cập nhật hệ điều hành" },
                              ].map(({ key, placeholder }) => (
                                <input key={key} placeholder={placeholder} value={v[key]}
                                  onChange={(e) => updateVariant(i, key, e.target.value)}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 transition" />
                              ))}
                            </div>
                          </details>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-white/5">
                    <button onClick={handleSaveProduct} disabled={productSaving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                      <Check size={14} /> {productSaving ? "Đang lưu..." : "Lưu sản phẩm"}
                    </button>
                    <button onClick={() => { setShowAddProduct(false); setProductErrors({}); }}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition">
                      <X size={14} /> Hủy
                    </button>
                  </div>
                </div>
              )}

              {/* DANH SÁCH SẢN PHẨM */}
              {productLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                </div>
              ) : productList.length === 0 ? (
                <div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-white/20">
                  <Package size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Chưa có sản phẩm nào</p>
                </div>
              ) : (
                <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-5 px-6 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider">
                    <span className="col-span-2">Sản phẩm</span><span>Hãng</span><span>Biến thể</span><span>Danh mục</span>
                  </div>
                  {productList.map((p) => (
                    <div key={p.id} className="grid grid-cols-5 px-6 py-4 border-b border-white/5 last:border-0 items-center hover:bg-white/2 transition">
                      <div className="col-span-2">
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-white/30 mt-0.5">#{p.id}</p>
                      </div>
                      <span className="text-sm text-white/50">{p.brand || "—"}</span>
                      <span className="text-sm text-white/50">{p.variant_count} biến thể</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 w-fit">{p.category}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== NHẬP HÀNG ===== */}
          {activeTab === "import" && (
            <div className="flex flex-col gap-6">
              <p className="text-sm text-white/40">Chọn sản phẩm để nhập thêm hàng</p>

              {/* Chọn sản phẩm */}
              <div className="bg-[#161616] border border-white/10 rounded-2xl p-5">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Chọn sản phẩm</p>
                <select value={importProductId}
                  onChange={(e) => { setImportProductId(e.target.value); loadImportVariants(e.target.value); }}
                  className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/50 transition">
                  <option value="">-- Chọn sản phẩm</option>
                  {productList.map((p) => <option key={p.id} value={p.id}>{p.name} {p.brand ? `(${p.brand})` : ""}</option>)}
                </select>
              </div>

              {/* Danh sách biến thể để nhập */}
              {importLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                </div>
              ) : importVariants.length > 0 && (
                <div className="flex flex-col gap-4">
                  <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-5 px-6 py-3 border-b border-white/5 text-xs text-white/30 uppercase tracking-wider">
                      <span className="col-span-2">Biến thể</span><span>Giá</span><span>Tồn kho</span><span>Nhập thêm</span>
                    </div>
                    {importVariants.map((v) => (
                      <div key={v.id} className="grid grid-cols-5 px-6 py-4 border-b border-white/5 last:border-0 items-center">
                        <div className="col-span-2">
                          <p className="text-sm font-medium">{[v.color, v.storage, v.ram].filter(Boolean).join(" / ") || `Variant #${v.id}`}</p>
                          <p className="text-xs text-white/30 mt-0.5">#{v.id}</p>
                        </div>
                        <span className="text-sm text-orange-300">{parseInt(v.price).toLocaleString("vi-VN")}đ</span>
                        <span className={`text-sm font-medium ${v.stock <= 5 ? "text-red-400" : "text-white/60"}`}>{v.stock}</span>
                        <input type="number" min="0" placeholder="0"
                          value={importQty[v.id] || ""}
                          onChange={(e) => setImportQty((q) => ({ ...q, [v.id]: e.target.value }))}
                          className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-orange-500/50 transition" />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 items-center">
                    <button onClick={handleImport} disabled={importSaving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition disabled:opacity-50">
                      <Check size={14} /> {importSaving ? "Đang nhập..." : "Xác nhận nhập hàng"}
                    </button>
                    <p className="text-xs text-white/30">
                      {Object.values(importQty).filter((q) => parseInt(q) > 0).length} biến thể được chọn
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== CÀI ĐẶT ===== */}
          {activeTab === "settings" && (
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-12 text-center text-white/20">
              <Settings size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Đang phát triển</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ===== COMPONENT PHỤ =====
function AdminSection({ title, children }) {
  return (
    <div className="bg-[#161616] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5">
        <h3 className="font-semibold text-sm text-white/70">{title}</h3>
      </div>
      <div className="px-6 py-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-white/30 text-sm w-36 shrink-0">{label}</span>
      <span className="flex-1 text-sm">{value || <span className="text-white/20 italic">Chưa cập nhật</span>}</span>
    </div>
  );
}

function PwInput({ placeholder, value, show, onToggle, onChange, error }) {
  return (
    <div>
      <div className="relative">
        <input type={show ? "text" : "password"} placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 pr-10 text-sm outline-none focus:border-orange-500/50 transition
            ${error ? "border-red-500/50" : "border-white/10"}`} />
        <button type="button" onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-1 pl-1">{error}</p>}
    </div>
  );
}