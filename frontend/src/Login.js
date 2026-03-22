import { useState, useEffect } from "react";
import "./animations.css";
import { Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { FaFacebookF } from "react-icons/fa";
import bg from "./Image/z7570039080822_f06fa6384704bb9b43c3e63fae7c17cf.jpg";
import { useNavigate } from "react-router-dom";
import { ToastContainer, useToast } from "./Toast";
import { useGoogleLogin } from "@react-oauth/google";
import FacebookLogin from "@greatsumini/react-facebook-login";
import { saveSession } from "./authUtils";   // [FIX] dùng authUtils
import { API } from "./config"; 
const FACEBOOK_APP_ID = "2817792315239726";


export default function Login() {
  const [isLogin,      setIsLogin]      = useState(true);
  const [showPass,     setShowPass]     = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [errors,       setErrors]       = useState({});
  const [loading,      setLoading]      = useState(false);
  const { toasts, removeToast, toast } = useToast();

  const [form, setForm] = useState({ fullname: "", email: "", password: "", confirm: "" });
  const navigate = useNavigate();

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

  // ── Validate form ──────────────────────────────────────────
  const validateForm = () => {
    const e = {};
    if (!isLogin && !form.fullname.trim())
      e.fullname = "Vui lòng nhập họ và tên";
    if (!form.email.trim())
      e.email = "Vui lòng nhập email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Email không hợp lệ";
    else if (form.email.includes(" "))
      e.email = "Email không được chứa khoảng trắng";
    if (!form.password.trim())
      e.password = "Vui lòng nhập mật khẩu";
    else if (form.password.includes(" "))
      e.password = "Mật khẩu không được chứa khoảng trắng";
    else if (form.password.length < 6)
      e.password = "Mật khẩu phải có ít nhất 6 ký tự";
    if (!isLogin) {
      if (!form.confirm.trim())
        e.confirm = "Vui lòng nhập lại mật khẩu";
      else if (form.confirm.includes(" "))
        e.confirm = "Mật khẩu không được chứa khoảng trắng";
      else if (form.password !== form.confirm)
        e.confirm = "Mật khẩu không trùng khớp";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Đăng nhập / Đăng ký ──────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);

    try {
      if (isLogin) {
        const res  = await fetch(`${API}/api/auth/login/`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        const data = await res.json();
        if (res.ok) {
          // [FIX] Lưu token vào localStorage qua authUtils
          saveSession("user", {
            id:        data.customer.id,
            fullName:  data.customer.full_name,
            email:     data.customer.email,
            avatar:    data.customer.avatar || "",
            loginType: "normal",
          }, data.token);
          sessionStorage.setItem("login_toast", `Chào mừng trở lại, ${data.customer.full_name}!`);
          navigate("/");
        } else {
          if (data.field === "email")       setErrors({ email:    data.message });
          else if (data.field === "password") setErrors({ password: data.message });
          else                                setErrors({ general:  data.message });
        }
      } else {
        // Đăng ký — kiểm tra email trước
        const checkRes  = await fetch(`${API}/api/auth/check-email/`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email }),
        });
        const checkData = await checkRes.json();
        if (!checkRes.ok) { setErrors({ email: checkData.message }); return; }

        const res  = await fetch(`${API}/api/auth/register/`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: form.fullname, email: form.email, password: form.password }),
        });
        const data = await res.json();
        if (res.ok) {
          saveSession("user", {
            id:        data.customer.id,
            fullName:  data.customer.full_name,
            email:     data.customer.email,
            avatar:    data.customer.avatar || "",
            loginType: "normal",
          }, data.token);
          sessionStorage.setItem("login_toast", `Đăng ký thành công! Chào mừng, ${data.customer.full_name}!`);
          navigate("/");
        } else {
          setErrors({ general: data.message });
        }
      }
    } catch { setErrors({ general: "Không thể kết nối server" }); }
    finally { setLoading(false); }
  };

  // ── Google ────────────────────────────────────────────────
  const loginGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const gRes    = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const profile = await gRes.json();
        // Thử login trước; nếu 404 (chưa có tài khoản) → tự động register
        const payload = JSON.stringify({ google_id: profile.sub, full_name: profile.name, email: profile.email, avatar: profile.picture });
        let res  = await fetch(`${API}/api/auth/google/login/`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: payload,
        });
        // Nếu 404 (chưa đăng ký) → tự động register
        if (res.status === 404) {
          res = await fetch(`${API}/api/auth/google/register/`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: payload,
          });
        }
        const data = await res.json();
        if (res.ok) {
          const isNewUser = res.status === 201;
          saveSession("user", {
            id: data.customer.id, fullName: profile.name, email: profile.email,
            avatar: profile.picture, loginType: "google",
          }, data.token);
          sessionStorage.setItem("login_toast",
            isNewUser ? `Đăng ký thành công! Chào mừng, ${profile.name}!` : `Chào mừng trở lại, ${profile.name}!`);
          navigate("/");
        } else { toast.error(data.message); }
      } catch { toast.error("Lỗi kết nối Google"); }
    },
    onError: () => toast.error("Đăng nhập Google thất bại"),
  });

  // ── Facebook ──────────────────────────────────────────────
  const handleFacebookSuccess = async (response) => {
    try {
      const accessToken = response.accessToken;
      if (!accessToken) { toast.error("Không nhận được token Facebook"); return; }
      const fbRes   = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`);
      const profile = await fbRes.json();
      const full_name   = profile.name || "";
      const email       = profile.email || "";
      const avatar      = profile.picture?.data?.url || "";
      const facebook_id = profile.id;
      // Thử login trước; nếu 404 (chưa có tài khoản) → tự động register
      const fbPayload = JSON.stringify({ facebook_id, full_name, email, avatar });
      let res = await fetch(`${API}/api/auth/facebook/login/`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: fbPayload,
      });
      if (res.status === 404) {
        res = await fetch(`${API}/api/auth/facebook/register/`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: fbPayload,
        });
      }
      const data = await res.json();
      if (res.ok) {
        saveSession("user", { id: data.customer.id, fullName: full_name, email, avatar, loginType: "facebook" }, data.token);
        sessionStorage.setItem("login_toast",
          res.status === 201 ? `Đăng ký thành công! Chào mừng, ${full_name}!` : `Chào mừng trở lại, ${full_name}!`);
        navigate("/");
      } else { toast.error(data.message); }
    } catch { toast.error("Lỗi khi xử lý đăng nhập Facebook"); }
  };

  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      <img src={bg} alt="background" className="absolute inset-0 w-full h-full object-cover blur-[1px] brightness-75 scale-110" />
      <div className="absolute inset-0 bg-black/60" />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="relative w-[1200px] h-[700px] rounded-3xl overflow-hidden flex shadow-2xl">
        <div className="w-1/2">
          <img src={bg} alt="phone" className="w-full h-full object-cover" />
        </div>
        <div className="w-1/2 bg-black/40 backdrop-blur-xl flex flex-col items-center justify-center px-20 pz-slideleft">

          {/* TAB */}
          <div className="relative w-[260px] h-[44px] bg-gray-700/60 rounded-full">
            <div className={`absolute top-1 left-1 h-[36px] w-[calc(50%-4px)] rounded-full bg-gray-300 transition-all duration-300 ${isLogin ? "translate-x-[calc(100%+2px)]" : "translate-x-0"}`} />
            <div className="relative z-10 flex w-full h-full">
              <button type="button" onClick={() => { setIsLogin(false); setErrors({}); setForm({ fullname: "", email: "", password: "", confirm: "" }); }}
                className={`w-1/2 text-sm font-medium transition ${!isLogin ? "text-black" : "text-gray-300"}`}>
                Đăng ký
              </button>
              <button type="button" onClick={() => { setIsLogin(true); setErrors({}); setForm({ fullname: "", email: "", password: "", confirm: "" }); }}
                className={`w-1/2 text-sm font-medium transition ${isLogin ? "text-black" : "text-gray-300"}`}>
                Đăng nhập
              </button>
            </div>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="w-full mt-[20px]">
            <div className="flex flex-col gap-[14px]">
              {errors.general && <p className="text-red-400 text-sm text-center">{errors.general}</p>}

              {!isLogin && (
                <div>
                  <input name="fullname" value={form.fullname} onChange={handleChange} placeholder="Họ và tên"
                    className={`w-full p-3 pl-6 rounded-full bg-transparent border text-white placeholder-gray-400 focus:ring-2 outline-none transition
                      ${errors.fullname ? "border-red-400 focus:ring-red-400/60" : "border-white/40 focus:ring-white/60"}`} />
                  {errors.fullname && <p className="text-red-400 text-xs pl-4 mt-1">{errors.fullname}</p>}
                </div>
              )}

              <div>
                <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="Email"
                  className={`w-full p-3 pl-6 rounded-full bg-transparent border text-white placeholder-gray-400 focus:ring-2 outline-none transition
                    ${errors.email ? "border-red-400 focus:ring-red-400/60" : "border-white/40 focus:ring-white/60"}`} />
                {errors.email && <p className="text-red-400 text-xs pl-4 mt-1">{errors.email}</p>}
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

              {!isLogin && (
                <div>
                  <div className="relative">
                    <input name="confirm" type={showConfirm ? "text" : "password"} value={form.confirm} onChange={handleChange} placeholder="Nhập lại mật khẩu"
                      className={`w-full p-3 pl-6 pr-12 rounded-full bg-transparent border text-white placeholder-gray-400 focus:ring-2 outline-none transition
                        ${errors.confirm ? "border-red-400 focus:ring-red-400/60" : "border-white/40 focus:ring-white/60"}`} />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.confirm && <p className="text-red-400 text-xs pl-4 mt-1">{errors.confirm}</p>}
                </div>
              )}

              {isLogin && (
                <div className="flex justify-end -mt-[4px]">
                  <button type="button" onClick={() => navigate("/login/forgot_password")}
                    className="text-sm text-blue-400 hover:underline">
                    Quên mật khẩu?
                  </button>
                </div>
              )}

              <button disabled={loading}
                className="w-full p-3 flex items-center justify-center rounded-full text-white text-sm font-medium
                  bg-[rgba(255,149,0,0.7)] border border-[#ff9500] backdrop-blur-[2px]
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
                  hover:bg-[rgba(255,149,0,0.9)] disabled:opacity-60 transition">
                {loading ? "Đang xử lý..." : isLogin ? "Đăng nhập" : "Đăng ký"}
              </button>

              <div className="flex items-center gap-4 text-gray-300">
                <div className="flex-1 h-[1px] bg-gray-500" />
                <span className="text-sm">Hoặc</span>
                <div className="flex-1 h-[1px] bg-gray-500" />
              </div>

              <button type="button" onClick={() => loginGoogle()}
                className="flex items-center justify-center gap-3 p-3 rounded-full bg-white text-black font-medium hover:opacity-90 transition">
                <FcGoogle size={20} />
                {isLogin ? "Đăng nhập bằng Google" : "Đăng ký bằng Google"}
              </button>

              <FacebookLogin
                appId={FACEBOOK_APP_ID} scope="public_profile" fields="id,name,email,picture"
                onSuccess={handleFacebookSuccess}
                onFail={(err) => { console.error(err); toast.error("Đăng nhập Facebook thất bại"); }}
                render={({ onClick }) => (
                  <button type="button" onClick={onClick}
                    className="flex items-center justify-center gap-3 p-3 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition">
                    <FaFacebookF size={18} />
                    {isLogin ? "Đăng nhập bằng Facebook" : "Đăng ký bằng Facebook"}
                  </button>
                )}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}