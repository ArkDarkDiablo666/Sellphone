import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { FaFacebookF } from "react-icons/fa";
import bg from "./Image/z7570039080822_f06fa6384704bb9b43c3e63fae7c17cf.jpg";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import FacebookLogin from "@greatsumini/react-facebook-login";

const FACEBOOK_APP_ID = "2817792315239726";
const API = "http://localhost:8000";

const saveUser = (data) => {
  localStorage.setItem("user", JSON.stringify(data));
};

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    fullname: "",
    email: "",
    password: "",
    confirm: "",
  });

  const navigate = useNavigate();

  // ===== HANDLE CHANGE - controlled input =====
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ===== VALIDATE =====
  const validateForm = () => {
    const newErrors = {};

    if (!isLogin && !form.fullname.trim())
      newErrors.fullname = "Vui lòng nhập họ và tên";

    if (!form.email.trim())
      newErrors.email = "Vui lòng nhập email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Email không hợp lệ";

    if (!form.password.trim())
      newErrors.password = "Vui lòng nhập mật khẩu";
    else if (form.password.length < 6)
      newErrors.password = "Mật khẩu phải có ít nhất 6 ký tự";

    if (!isLogin) {
      if (!form.confirm.trim())
        newErrors.confirm = "Vui lòng nhập lại mật khẩu";
      else if (form.password !== form.confirm)
        newErrors.confirm = "Mật khẩu không trùng khớp";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ===== ĐĂNG KÝ / ĐĂNG NHẬP THƯỜNG =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (isLogin) {
      // ĐĂNG NHẬP
      try {
        const res  = await fetch(`${API}/api/auth/login/`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ email: form.email, password: form.password }),
        });
        const data = await res.json();
        if (res.ok) {
          saveUser({
            id:        data.customer.id,
            fullName:  data.customer.full_name,
            email:     data.customer.email,
            avatar:    data.customer.avatar || "",
            loginType: "normal",
          });
          navigate("/");
        } else {
          if (data.field === "email")       setErrors({ email: data.message });
          else if (data.field === "password") setErrors({ password: data.message });
          else                               setErrors({ general: data.message });
        }
      } catch {
        setErrors({ general: "Không thể kết nối server" });
      }

    } else {
      // ĐĂNG KÝ - check email trước
      try {
        const checkRes  = await fetch(`${API}/api/auth/check-email/`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ email: form.email }),
        });
        const checkData = await checkRes.json();
        if (!checkRes.ok) {
          setErrors({ email: checkData.message });
          return;
        }

        // Email hợp lệ → đăng ký
        const res  = await fetch(`${API}/api/auth/register/`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            full_name: form.fullname,
            email:     form.email,
            password:  form.password,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          saveUser({
            id:        data.customer.id,
            fullName:  data.customer.full_name,
            email:     data.customer.email,
            avatar:    data.customer.avatar || "",
            loginType: "normal",
          });
          navigate("/");
        } else {
          setErrors({ general: data.message });
        }
      } catch {
        setErrors({ general: "Không thể kết nối server" });
      }
    }
  };

  // ===== GOOGLE =====
  const loginGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const gRes    = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const profile = await gRes.json();

        if (isLogin) {
          const res  = await fetch(`${API}/api/auth/google/login/`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ full_name: profile.name, email: profile.email }),
          });
          const data = await res.json();
          if (res.ok) {
            saveUser({ id: data.customer.id, fullName: profile.name, email: profile.email, avatar: profile.picture, loginType: "google" });
            navigate("/");
          } else { alert(data.message); }
        } else {
          const res  = await fetch(`${API}/api/auth/google/register/`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ google_id: profile.sub, full_name: profile.name, email: profile.email, avatar: profile.picture }),
          });
          const data = await res.json();
          if (res.ok) {
            saveUser({ id: data.customer.id, fullName: profile.name, email: profile.email, avatar: profile.picture, loginType: "google" });
            navigate("/");
          } else { alert(data.message); }
        }
      } catch { alert("Lỗi kết nối Google"); }
    },
    onError: () => alert("Đăng nhập Google thất bại"),
  });

  // ===== FACEBOOK =====
  const handleFacebookSuccess = async (response) => {
    try {
      const accessToken = response.accessToken;
      if (!accessToken) { alert("Không nhận được token Facebook"); return; }

      const fbRes   = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`);
      const profile = await fbRes.json();

      const full_name   = profile.name || "";
      const email       = profile.email || "";
      const avatar      = profile.picture?.data?.url || "";
      const facebook_id = profile.id;

      if (isLogin) {
        const res  = await fetch(`${API}/api/auth/facebook/login/`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ full_name, email }),
        });
        const data = await res.json();
        if (res.ok) {
          saveUser({ id: data.customer.id, fullName: full_name, email, avatar, loginType: "facebook" });
          navigate("/");
        } else { alert(data.message); }
      } else {
        const res  = await fetch(`${API}/api/auth/facebook/register/`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ facebook_id, full_name, email, avatar }),
        });
        const data = await res.json();
        if (res.ok) {
          saveUser({ id: data.customer.id, fullName: full_name, email, avatar, loginType: "facebook" });
          navigate("/");
        } else { alert(data.message); }
      }
    } catch { alert("Lỗi khi xử lý đăng nhập Facebook"); }
  };

  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      <img src={bg} alt="background" className="absolute inset-0 w-full h-full object-cover blur-[1px] brightness-75 scale-110" />
      <div className="absolute inset-0 bg-black/60"></div>

      <div className="relative w-[1200px] h-[700px] rounded-3xl overflow-hidden flex shadow-2xl">
        {/* Left */}
        <div className="w-1/2">
          <img src={bg} alt="phone" className="w-full h-full object-cover" />
        </div>

        {/* Right */}
        <div className="w-1/2 bg-black/40 backdrop-blur-xl flex flex-col items-center justify-center px-20">

          {/* TAB */}
          <div className="relative w-[260px] h-[44px] bg-gray-700/60 rounded-full">
            <div className={`absolute top-1 left-1 h-[36px] w-[calc(50%-4px)] rounded-full bg-gray-300 transition-all duration-300 ${isLogin ? "translate-x-[calc(100%+2px)]" : "translate-x-0"}`}></div>
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

              {/* HỌ TÊN */}
              {!isLogin && (
                <div>
                  <input
                    name="fullname"
                    value={form.fullname}
                    onChange={handleChange}
                    placeholder="Họ và tên"
                    className={`w-full p-3 pl-6 rounded-full bg-transparent border text-white placeholder-gray-400 focus:ring-2 outline-none transition
                      ${errors.fullname ? "border-red-400 focus:ring-red-400/60" : "border-white/40 focus:ring-white/60"}`}
                  />
                  {errors.fullname && <p className="text-red-400 text-xs pl-4 mt-1">{errors.fullname}</p>}
                </div>
              )}

              {/* EMAIL */}
              <div>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Email"
                  className={`w-full p-3 pl-6 rounded-full bg-transparent border text-white placeholder-gray-400 focus:ring-2 outline-none transition
                    ${errors.email ? "border-red-400 focus:ring-red-400/60" : "border-white/40 focus:ring-white/60"}`}
                />
                {errors.email && <p className="text-red-400 text-xs pl-4 mt-1">{errors.email}</p>}
              </div>

              {/* MẬT KHẨU */}
              <div>
                <div className="relative">
                  <input
                    name="password"
                    type={showPass ? "text" : "password"}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Mật khẩu"
                    className={`w-full p-3 pl-6 pr-12 rounded-full bg-transparent border text-white placeholder-gray-400 focus:ring-2 outline-none transition
                      ${errors.password ? "border-red-400 focus:ring-red-400/60" : "border-white/40 focus:ring-white/60"}`}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs pl-4 mt-1">{errors.password}</p>}
              </div>

              {/* NHẬP LẠI MẬT KHẨU */}
              {!isLogin && (
                <div>
                  <div className="relative">
                    <input
                      name="confirm"
                      type={showConfirm ? "text" : "password"}
                      value={form.confirm}
                      onChange={handleChange}
                      placeholder="Nhập lại mật khẩu"
                      className={`w-full p-3 pl-6 pr-12 rounded-full bg-transparent border text-white placeholder-gray-400 focus:ring-2 outline-none transition
                        ${errors.confirm ? "border-red-400 focus:ring-red-400/60" : "border-white/40 focus:ring-white/60"}`}
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.confirm && <p className="text-red-400 text-xs pl-4 mt-1">{errors.confirm}</p>}
                </div>
              )}

              {/* QUÊN MẬT KHẨU */}
              {isLogin && (
                <div className="flex justify-end -mt-[4px]">
                  <button type="button" onClick={() => navigate("/login/forgot_password")}
                    className="text-sm text-blue-400 hover:underline">
                    Quên mật khẩu?
                  </button>
                </div>
              )}

              {/* SUBMIT */}
              <button className="w-full p-3 flex items-center justify-center rounded-full text-white text-sm font-medium
                  bg-[rgba(255,149,0,0.7)] border border-[#ff9500]
                  backdrop-blur-[2px]
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
                  hover:bg-[rgba(255,149,0,0.9)] transition">
                {isLogin ? "Đăng nhập" : "Đăng ký"}
              </button>

              {/* OR */}
              <div className="flex items-center gap-4 text-gray-300">
                <div className="flex-1 h-[1px] bg-gray-500"></div>
                <span className="text-sm">Hoặc</span>
                <div className="flex-1 h-[1px] bg-gray-500"></div>
              </div>

              {/* GOOGLE */}
              <button type="button" onClick={() => loginGoogle()}
                className="flex items-center justify-center gap-3 p-3 rounded-full bg-white text-black font-medium hover:opacity-90 transition">
                <FcGoogle size={20} />
                {isLogin ? "Đăng nhập bằng Google" : "Đăng ký bằng Google"}
              </button>

              {/* FACEBOOK */}
              <FacebookLogin
                appId={FACEBOOK_APP_ID}
                scope="public_profile"
                fields="id,name,email,picture"
                onSuccess={handleFacebookSuccess}
                onFail={(err) => { console.error(err); alert("Đăng nhập Facebook thất bại"); }}
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