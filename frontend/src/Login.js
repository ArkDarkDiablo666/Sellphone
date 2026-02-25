import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { FaFacebookF } from "react-icons/fa";
import bg from "./Image/image-177.png";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import FacebookLogin from "@greatsumini/react-facebook-login";

const FACEBOOK_APP_ID = "2817792315239726";

// ===== HÀM LƯU USER VÀO LOCALSTORAGE =====
// Dùng lại ở bất kỳ đâu: const user = JSON.parse(localStorage.getItem("user"))
// user.fullName, user.email, user.avatar, user.loginType
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

  // ===== ĐĂNG NHẬP / ĐĂNG KÝ THƯỜNG =====
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLogin && form.password !== form.confirm) {
      alert("Mật khẩu không trùng khớp");
      return;
    }

    const url = isLogin
      ? "http://localhost:8000/api/auth/login/"
      : "http://localhost:8000/api/auth/register/";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.fullname,
          email:     form.email,
          password:  form.password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Lưu thông tin user
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
    } catch (err) {
      alert("Không thể kết nối server");
    }
  };

  // ===== GOOGLE LOGIN =====
  const loginGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Lấy thông tin từ Google
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const profile = await res.json();

        // Gửi lên Django backend
        const backendRes = await fetch("http://localhost:8000/api/auth/google/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            google_id:  profile.sub,
            full_name:  profile.name,
            email:      profile.email,
            avatar:     profile.picture,
            login_type: "google",
          }),
        });

        const data = await backendRes.json();

        // Lưu thông tin user
        saveUser({
          id:        data.customer.id,
          fullName:  profile.name,
          email:     profile.email,
          avatar:    profile.picture,
          loginType: "google",
        });

        navigate("/");
      } catch (err) {
        alert("Đăng nhập Google thất bại");
      }
    },
    onError: () => alert("Đăng nhập Google thất bại"),
  });

  // ===== FACEBOOK LOGIN =====
  const handleFacebookSuccess = async (response) => {
    try {
      // Gửi lên Django backend
      const backendRes = await fetch("http://localhost:8000/api/auth/facebook/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facebook_id: response.id,
          full_name:   response.name,
          email:       response.email || "",
          avatar:      response.picture?.data?.url || "",
          login_type:  "facebook",
        }),
      });

      const data = await backendRes.json();

      // Lưu thông tin user
      saveUser({
        id:        data.customer.id,
        fullName:  response.name,
        email:     response.email || "",
        avatar:    response.picture?.data?.url || "",
        loginType: "facebook",
      });

      navigate("/");
    } catch (err) {
      alert("Đăng nhập Facebook thất bại");
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
