import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import bg from "./Image/z7570039080822_f06fa6384704bb9b43c3e63fae7c17cf.jpg";
import { useNavigate } from "react-router-dom";
import { ToastContainer, useToast } from "./Toast";

const API = "http://localhost:8000";

export default function Resetpassword() {
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [errors, setErrors]           = useState({});
  const [loading, setLoading]         = useState(false);
  const { toasts, removeToast, toast } = useToast();
  const navigate = useNavigate();

  const validatePassword = (pass) => {
    if (!pass)              return "Vui lòng nhập mật khẩu";
    if (pass.includes(" ")) return "Mật khẩu không được chứa dấu cách";
    if (pass.length < 6)    return "Mật khẩu phải có ít nhất 6 ký tự";
    return "";
  };

  const handleSubmit = async () => {
    const newErrors = {};

    const passError = validatePassword(password);
    if (passError) newErrors.password = passError;

    if (!confirm)                    newErrors.confirm = "Vui lòng nhập lại mật khẩu";
    else if (confirm.includes(" "))  newErrors.confirm = "Mật khẩu không được chứa dấu cách";
    else if (password !== confirm)   newErrors.confirm = "Mật khẩu không trùng khớp";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const email = sessionStorage.getItem("reset_email");
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/auth/reset-password/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, new_password: password }),
      });
      const data = await res.json();

      if (res.ok) {
        sessionStorage.removeItem("reset_email");
        toast.success("Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.");
        navigate("/login");
      } else {
        setErrors({ general: data.message });
      }
    } catch {
      setErrors({ general: "Không thể kết nối server" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover blur-[1px] brightness-75 scale-110" />
      <div className="absolute inset-0 bg-black/60"></div>

      <div className="relative w-[1200px] h-[700px] rounded-3xl overflow-hidden flex shadow-2xl">
        {/* LEFT — ảnh */}
        <div className="w-1/2">
          <img src={bg} alt="" className="w-full h-full object-cover" />
        </div>

        {/* RIGHT — form */}
        <div className="w-1/2 bg-black/40 backdrop-blur-xl flex flex-col justify-center px-20 text-white">
          <h2 className="text-3xl font-semibold text-white mb-6">Tạo mật khẩu mới</h2>

          <div className="flex flex-col gap-4">

            {errors.general && (
              <p className="text-red-400 text-sm text-center">{errors.general}</p>
            )}

            {/* MẬT KHẨU MỚI */}
            <div>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Mật khẩu mới"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }}
                  className={`w-full p-3 pl-6 pr-12 rounded-full bg-transparent border text-white placeholder-gray-400 focus:ring-2 outline-none transition
                    ${errors.password ? "border-red-400 focus:ring-red-400/60" : "border-white/40 focus:ring-white/60"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs pl-4 mt-1">{errors.password}</p>}
            </div>

            {/* NHẬP LẠI MẬT KHẨU */}
            <div>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setErrors((p) => ({ ...p, confirm: "" })); }}
                  className={`w-full p-3 pl-6 pr-12 rounded-full bg-transparent border text-white placeholder-gray-400 focus:ring-2 outline-none transition
                    ${errors.confirm ? "border-red-400 focus:ring-red-400/60" : "border-white/40 focus:ring-white/60"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.confirm && <p className="text-red-400 text-xs pl-4 mt-1">{errors.confirm}</p>}
            </div>

            {/* XÁC NHẬN */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full p-3 flex items-center justify-center rounded-full text-white text-sm font-medium
                bg-[rgba(255,149,0,0.7)] border border-[#ff9500]
                backdrop-blur-[2px]
                shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
                hover:bg-[rgba(255,149,0,0.9)] transition"
            >
              {loading ? "Đang cập nhật..." : "Xác nhận"}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}