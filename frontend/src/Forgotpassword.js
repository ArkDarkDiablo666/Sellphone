import { useState } from "react";
import bg from "./Image/image-177.png";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8000";

export default function Forgotpassword() {
  const [email, setEmail]     = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOTP = async () => {
    setError("");

    if (!email.trim()) { setError("Vui lòng nhập email"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Email không hợp lệ"); return; }
    if (email.includes(" ")) { setError("Email không được chứa dấu cách"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/forgot-password/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });

      if (res.ok || res.status === 500) {
        sessionStorage.setItem("reset_email", email);
        navigate("/login/forgot_password/otp");
        return;
      }

      const data = await res.json();
      setError(data.message || "Có lỗi xảy ra");

    } catch (err) {
      console.log("Lỗi fetch:", err);
      setError("Không thể kết nối server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover blur-md brightness-75 scale-110" />
      <div className="absolute inset-0 bg-black/60"></div>

      <div className="relative w-[1200px] h-[700px] rounded-3xl overflow-hidden flex shadow-2xl">
        <div className="w-1/2">
          <img src={bg} alt="" className="w-full h-full object-cover" />
        </div>

        <div className="w-1/2 bg-black/40 backdrop-blur-xl flex flex-col justify-center px-20 text-white">
          <h2 className="text-3xl font-semibold text-white mb-4">Quên mật khẩu</h2>
          <p className="text-gray-300 mb-6">Nhập email của bạn để nhận mã OTP.</p>

          <div className="mb-[20px]">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              className={`w-full p-3 pl-6 rounded-full bg-transparent border text-white placeholder-gray-400 focus:ring-2 outline-none transition
                ${error ? "border-red-400 focus:ring-red-400/60" : "border-white/40 focus:ring-white/60"}`}
            />
            {error && <p className="text-red-400 text-xs pl-4 mt-1">{error}</p>}
          </div>

          <button
            onClick={handleSendOTP}
            disabled={loading}
            className="p-3 rounded-full bg-gray-300 hover:bg-white text-black font-semibold transition disabled:opacity-60"
          >
            {loading ? "Đang gửi..." : "Gửi OTP"}
          </button>
        </div>
      </div>
    </div>
  );
}