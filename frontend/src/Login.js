import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { FaFacebookF } from "react-icons/fa";
import bg from "./Image/image-177.png";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import FacebookLogin from "@greatsumini/react-facebook-login";

const FACEBOOK_APP_ID = "2817792315239726";
const API = "http://localhost:8000";

// Lưu user vào localStorage
// Dùng lại: const user = JSON.parse(localStorage.getItem("user"))
// user.id, user.fullName, user.email, user.avatar, user.loginType
const saveUser = (data) => {
  localStorage.setItem("user", JSON.stringify(data));
};

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    fullname: "",
    email: "",
    password: "",
    confirm: "",
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ============================================
  // ĐĂNG KÝ / ĐĂNG NHẬP THƯỜNG
  // Đăng ký: gửi full_name + email + password → /api/auth/register/
  // Đăng nhập: gửi email + password → /api/auth/login/
  // ============================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLogin && form.password !== form.confirm) {
      alert("Mật khẩu không trùng khớp");
      return;
    }

    const url = isLogin
      ? `${API}/api/auth/login/`
      : `${API}/api/auth/register/`;

    const body = isLogin
      ? { email: form.email, password: form.password }
      : { full_name: form.fullname, email: form.email, password: form.password };

    try {
      const res  = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
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
        alert(data.message || "Có lỗi xảy ra");
      }
    } catch {
      alert("Không thể kết nối server");
    }
  };

  // ============================================
  // GOOGLE
  // Đăng ký: gửi google_id + full_name + email + avatar → /api/auth/google/register/
  // Đăng nhập: gửi full_name + email → /api/auth/google/login/
  // ============================================
  const loginGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Lấy thông tin từ Google
        const gRes    = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const profile = await gRes.json();

        if (isLogin) {
          // ĐĂNG NHẬP: kiểm tra full_name + email trong database
          const res  = await fetch(`${API}/api/auth/google/login/`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              full_name: profile.name,
              email:     profile.email,
            }),
          });
          const data = await res.json();

          if (res.ok) {
            saveUser({
              id:        data.customer.id,
              fullName:  profile.name,
              email:     profile.email,
              avatar:    profile.picture,
              loginType: "google",
            });
            navigate("/");
          } else {
            alert(data.message);
          }

        } else {
          // ĐĂNG KÝ: gửi google_id + full_name + email + avatar
          const res  = await fetch(`${API}/api/auth/google/register/`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              google_id: profile.sub,
              full_name: profile.name,
              email:     profile.email,
              avatar:    profile.picture,
            }),
          });
          const data = await res.json();

          if (res.ok) {
            saveUser({
              id:        data.customer.id,
              fullName:  profile.name,
              email:     profile.email,
              avatar:    profile.picture,
              loginType: "google",
            });
            navigate("/");
          } else {
            alert(data.message);
          }
        }
      } catch {
        alert("Lỗi kết nối Google");
      }
    },
    onError: () => alert("Đăng nhập Google thất bại"),
  });

  // ============================================
  // FACEBOOK
  // Đăng ký: gửi facebook_id + full_name + email + avatar → /api/auth/facebook/register/
  // Đăng nhập: gửi full_name + email → /api/auth/facebook/login/
  // ============================================
  const handleFacebookSuccess = async (response) => {
  console.log("Facebook raw response:", response);

  try {
    // 🔑 Lấy access token
    const accessToken = response.accessToken;

    if (!accessToken) {
      alert("Không nhận được access token từ Facebook");
      return;
    }

    // ✅ Gọi Graph API để lấy name + email + picture
    const fbRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
    );

    const profile = await fbRes.json();
    console.log("Facebook profile:", profile);

    const full_name   = profile.name || "";
    const email       = profile.email || "";
    const avatar      = profile.picture?.data?.url || "";
    const facebook_id = profile.id;

    if (!full_name || !email) {
      alert("Facebook không trả về email hoặc tên");
      return;
    }

    if (isLogin) {
      // ===== ĐĂNG NHẬP =====
      const res = await fetch(`${API}/api/auth/facebook/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name,
          email,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        saveUser({
          id: data.customer.id,
          fullName: full_name,
          email: email,
          avatar: avatar,
          loginType: "facebook",
        });
        navigate("/");
      } else {
        alert(data.message);
      }

    } else {
      // ===== ĐĂNG KÝ =====
      const res = await fetch(`${API}/api/auth/facebook/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facebook_id,
          full_name,
          email,
          avatar,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        saveUser({
          id: data.customer.id,
          fullName: full_name,
          email: email,
          avatar: avatar,
          loginType: "facebook",
        });
        navigate("/");
      } else {
        alert(data.message);
      }
    }

  } catch (error) {
    console.error("Facebook login error:", error);
    alert("Lỗi khi xử lý đăng nhập Facebook");
  }
};

  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <img
        src={bg}
        alt="background"
        className="absolute inset-0 w-full h-full object-cover blur-md brightness-75 scale-110"
      />
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
            <div
              className={`absolute top-1 left-1 h-[36px] w-[calc(50%-4px)] 
              rounded-full bg-gray-300 transition-all duration-300
              ${isLogin ? "translate-x-[calc(100%+2px)]" : "translate-x-0"}`}
            ></div>
            <div className="relative z-10 flex w-full h-full">
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`w-1/2 text-sm font-medium transition ${!isLogin ? "text-black" : "text-gray-300"}`}
              >
                Đăng ký
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`w-1/2 text-sm font-medium transition ${isLogin ? "text-black" : "text-gray-300"}`}
              >
                Đăng nhập
              </button>
            </div>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} autoComplete="off" className="w-full mt-[20px] flex flex-col">
            <div className="flex flex-col gap-[20px]">

              {/* Họ tên - chỉ hiện khi đăng ký thường */}
              {!isLogin && (
                <input
                  name="fullname"
                  placeholder="Họ và tên"
                  onChange={handleChange}
                  required
                  className="w-full p-3 pl-6 rounded-full bg-transparent border border-white/40 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/60 outline-none transition"
                />
              )}

              <input
                name="email"
                type="email"
                autoComplete="off"
                placeholder="Email"
                onChange={handleChange}
                required
                className="w-full p-3 pl-6 rounded-full bg-transparent border border-white/40 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/60 outline-none transition"
              />

              {/* PASSWORD */}
              <div className="relative">
                <input
                  name="password"
                  type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Mật khẩu"
                  onChange={handleChange}
                  required
                  className="w-full p-3 pl-6 pr-12 rounded-full bg-transparent border border-white/40 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/60 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {/* NHẬP LẠI MẬT KHẨU - chỉ khi đăng ký */}
              {!isLogin && (
                <div className="relative">
                  <input
                    name="confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Nhập lại mật khẩu"
                    onChange={handleChange}
                    required
                    className="w-full p-3 pl-6 pr-12 rounded-full bg-transparent border border-white/40 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/60 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              )}

              {isLogin && (
                <div className="flex justify-end -mt-[10px]">
                  <button
                    type="button"
                    onClick={() => navigate("/login/forgot_password")}
                    className="text-sm text-blue-400 hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="p-3 rounded-full bg-gray-300 hover:bg-white text-black font-semibold transition"
              >
                {isLogin ? "Đăng nhập" : "Đăng ký"}
              </button>

              {/* OR */}
              <div className="flex items-center gap-4 text-gray-300">
                <div className="flex-1 h-[1px] bg-gray-500"></div>
                <span className="text-sm">Hoặc</span>
                <div className="flex-1 h-[1px] bg-gray-500"></div>
              </div>

              {/* GOOGLE */}
              <button
                type="button"
                onClick={() => loginGoogle()}
                className="flex items-center justify-center gap-3 p-3 rounded-full bg-white text-black font-medium hover:opacity-90 transition"
              >
                <FcGoogle size={20} />
                {isLogin ? "Đăng nhập bằng Google" : "Đăng ký bằng Google"}
              </button>

              {/* FACEBOOK */}
              <FacebookLogin
                appId={FACEBOOK_APP_ID}
                scope="email"
                onSuccess={handleFacebookSuccess}
                onFail={(err) => {
                  console.error("Facebook error:", err);
                  alert("Đăng nhập Facebook thất bại");
                }}
                fields="name,email,picture"
                render={({ onClick }) => (
                  <button
                    type="button"
                    onClick={onClick}
                    className="flex items-center justify-center gap-3 p-3 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                  >
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