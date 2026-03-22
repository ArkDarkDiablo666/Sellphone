import { useState } from "react";
import "./animations.css";
import bg from "./Image/z7570039080822_f06fa6384704bb9b43c3e63fae7c17cf.jpg";
import { useNavigate } from "react-router-dom";
import { ToastContainer, useToast } from "./Toast";

import { API } from "./config";

export default function Forgotpassword() {
  const [email, setEmail]     = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast, toasts, removeToast } = useToast();

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

      // [FIX] Chỉ navigate khi res.ok — bỏ || res.status === 500
      // Trước đây navigate kể cả khi server lỗi 500, khiến người dùng
      // vào trang OTP dù email chưa được gửi
      if (res.ok) {
        sessionStorage.setItem("reset_email", email);
        navigate("/login/forgot_password/otp");
        return;
      }

      const data = await res.json();
      toast.error(data.message || "Có lỗi xảy ra");

    } catch {
      toast.error("Không thể kết nối server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover blur-[1px] brightness-75 scale-110" />
      <div className="absolute inset-0 bg-black/60"></div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="relative w-[1200px] h-[700px] rounded-3xl overflow-hidden flex shadow-2xl">
        <div className="w-1/2">
          <img src={bg} alt="" className="w-full h-full object-cover" />
        </div>

        <div className="w-1/2 bg-black/40 backdrop-blur-xl flex flex-col justify-center px-20 text-white pz-slideleft">
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
            className="w-full p-3 flex items-center justify-center rounded-full text-white text-sm font-medium
                  bg-[rgba(255,149,0,0.7)] border border-[#ff9500]
                  backdrop-blur-[2px]
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
                  hover:bg-[rgba(255,149,0,0.9)] transition disabled:opacity-60">
            {loading ? "Đang gửi..." : "Gửi OTP"}
          </button>
        </div>
      </div>
    </div>
  );
}