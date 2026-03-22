import { useState, useEffect, useRef } from "react";
import "./animations.css";
import Navbar from "./Navbar";
import Orders from "./Orders";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "./Cart";
import { Search, ShoppingCart, User, ShoppingBag, Settings, Pencil, X, Check, Eye, EyeOff, LogOut, Camera, ChevronDown, AlertTriangle } from "lucide-react";
import bgImage from "./Image/image-177.png";
import Footer from "./Footer";
import { useToast, ToastContainer } from "./Toast";
import { getUser, authFetch, AUTH_REDIRECTED, checkAndHandleExpiry } from "./authUtils";

import { API } from "./config";  

export default function Information() {
  const navigate  = useNavigate();
  const userLocal = getUser() || {};
  const { totalCount } = useCart();
  const { toast, toasts, removeToast } = useToast();

  const [customer, setCustomer]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("profile");

  // Search

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

  const fileInputRef = useRef(null);


  // ===== LẤY THÔNG TIN CUSTOMER =====
  useEffect(() => {
    if (checkAndHandleExpiry("user")) return;
    if (!userLocal.id) { navigate("/login"); return; }
    authFetch(`${API}/api/customer/${userLocal.id}/`)
      .then((r) => { if (!r || r === AUTH_REDIRECTED) return; return r.json(); })
      .then((data) => {
        if (!data) return;
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
      const res  = await authFetch(`${API}/api/customer/upload-avatar/`, { method: "POST", body: formData });
      if (!res || res === AUTH_REDIRECTED) return;
      const data = await res.json();
      if (res.ok) {
        const stored  = getUser() || {};
        const updated = { ...stored, avatar: data.avatar_url };
        localStorage.setItem("user", JSON.stringify(updated));
        setCustomer((prev) => ({ ...prev, avatar: data.avatar_url }));
        window.dispatchEvent(new Event("userUpdated"));
        toast.success("Cập nhật ảnh đại diện thành công!");
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
      const res = await authFetch(`${API}/api/customer/update/`, {
        method: "POST",
        body: JSON.stringify({ id: userLocal.id, phone_number: phone }),
      });
      if (!res || res === AUTH_REDIRECTED) return;
      if (res.ok) { setCustomer((prev) => ({ ...prev, phone_number: phone })); setEditPhone(false); setErrors({}); toast.success("Cập nhật số điện thoại thành công!"); }
    } finally { setSaving(false); }
  };

  // ===== LƯU ĐỊA CHỈ =====
  const saveAddress = async () => {
    if (!address.trim()) { setErrors({ address: "Vui lòng nhập địa chỉ" }); return; }
    setSaving(true);
    try {
      const res = await authFetch(`${API}/api/customer/update/`, {
        method: "POST",
        body: JSON.stringify({ id: userLocal.id, address }),
      });
      if (!res || res === AUTH_REDIRECTED) return;
      if (res.ok) { setCustomer((prev) => ({ ...prev, address })); setEditAddress(false); setErrors({}); toast.success("Cập nhật địa chỉ thành công!"); }
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
      const res  = await authFetch(`${API}/api/customer/change-password/`, {
        method: "POST",
        body: JSON.stringify({ id: userLocal.id, current_password: passForm.current, new_password: passForm.newPass }),
      });
      if (!res || res === AUTH_REDIRECTED) return;
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
}