import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import bg from "./Image/z7570039080822_f06fa6384704bb9b43c3e63fae7c17cf.jpg";
import { useNavigate } from "react-router-dom";
import { ToastContainer, useToast } from "./Toast";
import { saveSession } from "./authUtils";   // [FIX] dùng authUtils

const API = "http://localhost:8000";

export default function Loginmanage() {
  const [showPass, setShowPass] = useState(false);
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [form,     setForm]     = useState({ username: "", password: "" });
  const navigate = useNavigate();
  const { toast, toasts, removeToast } = useToast();

  useEffect(() => {
    const msg  = sessionStorage.getItem("logout_toast");
    const type = sessionStorage.getItem("logout_toast_type") || "info";
    if (msg) {
      sessionStorage.removeItem("logout_toast");
      sessionStorage.removeItem("logout_toast_type");
      setTimeout(() => type === "error" ? toast.error(msg) : toast.info(msg), 100);
    }
  }, []); // eslint-disable-line

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    setErrors(p => ({ ...p, [name]: "" }));
  };

  const validateForm = () => {
    const e = {};
    if (!form.username.trim()) e.username = "Vui lòng nhập tên tài khoản";
    if (!form.password.trim()) e.password = "Vui lòng nhập mật khẩu";
    else if (form.password.length < 6) e.password = "Mật khẩu phải có ít nhất 6 ký tự";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/auth/admin/login/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username: form.username, password: form.password }),
      });
      const data = await res.json();
      if (res.ok) {
        // [FIX] Lưu token admin qua authUtils
        saveSession("admin", {
          id:        data.admin.id,
          fullName:  data.admin.full_name,
          username:  data.admin.username,
          role:      data.admin.role,
          avatar:    data.admin.avatar || "",
          loginType: "admin",
        }, data.token);

        // Điều hướng theo role
        if (data.admin.role === "Admin") {
          sessionStorage.setItem("login_toast", `Chào mừng trở lại, ${data.admin.full_name}!`);
          navigate("/admin");
        } else if (data.admin.role === "Staff") {
          sessionStorage.setItem("login_toast", `Chào mừng trở lại, ${data.admin.full_name}!`);
          navigate("/staff");
        }
      } else {
        if (res.status === 403)            toast.error(data.message);
        else if (data.field === "username") setErrors({ username: data.message });
        else if (data.field === "password") setErrors({ password: data.message });
        else                                toast.error(data.message);
      }
    } catch { toast.error("Không thể kết nối server"); }
    finally { setLoading(false); }
  };

  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      <img src={bg} alt="background" className="absolute inset-0 w-full h-full object-cover blur-[1px] brightness-75 scale-110" />
      <div className="absolute inset-0 bg-black/60" />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="relative w-[1200px] h-[700px] rounded-3xl overflow-hidden flex shadow-2xl">
        <div className="w-1/2">
          <img src={bg} alt="bg" className="w-full h-full object-cover" />
        </div>
        <div className="w-1/2 bg-black/40 backdrop-blur-xl flex flex-col items-center justify-center px-20">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-1">Quản trị viên</h1>
            <p className="text-gray-400 text-sm">Đăng nhập để truy cập trang quản lý</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full">
            <div className="flex flex-col gap-[14px]">

              <div>
                <input name="username" type="text" value={form.username} onChange={handleChange} placeholder="Tên tài khoản"
                  className={`w-full p-3 pl-6 rounded-full bg-transparent border text-white placeholder-gray-400 focus:ring-2 outline-none transition
                    ${errors.username ? "border-red-400 focus:ring-red-400/60" : "border-white/40 focus:ring-white/60"}`} />
                {errors.username && <p className="text-red-400 text-xs pl-4 mt-1">{errors.username}</p>}
              </div>

              <div>
                <div className="relative">
                  <input name="password" type={showPass ? "text" : "password"} value={form.password} onChange={handleChange} placeholder="Mật khẩu"
                    className={`w-full p-3 pl-6 pr-12 rounded-full bg-transparent border text-white placeholder-gray-400 focus:ring-2 outline-none transition
                      ${errors.password ? "border-red-400 focus:ring-red-400/60" : "border-white/40 focus:ring-white/60"}`} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs pl-4 mt-1">{errors.password}</p>}
              </div>

              <div className="flex justify-end -mt-[4px]">
                <button type="button" onClick={() => navigate("/login/forgot_password")}
                  className="text-sm text-blue-400 hover:underline">
                  Quên mật khẩu?
                </button>
              </div>

              <button type="submit" disabled={loading}
                className="w-full p-3 flex items-center justify-center rounded-full text-white text-sm font-medium
                  bg-[rgba(255,149,0,0.7)] border border-[#ff9500] backdrop-blur-[2px]
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
                  hover:bg-[rgba(255,149,0,0.9)] disabled:opacity-60 transition">
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}