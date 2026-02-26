import { useState, useEffect, useRef } from "react";
import bg from "./Image/image-177.png";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8000";

export default function OTPForm() {
  const [otp, setOtp]             = useState(["", "", "", "", "", ""]);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);
  const navigate  = useNavigate();

  // ===== ĐẾM NGƯỢC 60 GIÂY =====
  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // ===== NHẬP OTP TỰ ĐỘNG CHUYỂN Ô =====
  const handleChange = (value, index) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ===== XÁC NHẬN OTP =====
  const handleVerify = async () => {
    const otpCode = otp.join("");
    if (otpCode.length < 6) { setError("Vui lòng nhập đủ 6 số"); return; }

    const email = sessionStorage.getItem("reset_email");
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/auth/verify-otp/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, otp: otpCode }),
      });
      const data = await res.json();

      if (res.ok) {
        navigate("/login/forgot_password/otp/reset_password");
      } else {
        setError(data.message);
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("Không thể kết nối server");
    } finally {
      setLoading(false);
    }
  };

  // ===== GỬI LẠI OTP =====
  const handleResend = async () => {
    if (!canResend) return;
    const email = sessionStorage.getItem("reset_email");
    setError("");
    setOtp(["", "", "", "", "", ""]);

    try {
      const res = await fetch(`${API}/api/auth/forgot-password/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });

      if (res.ok || res.status === 500) {
        setCountdown(60);
        setCanResend(false);
        inputRefs.current[0]?.focus();
        return;
      }

      const data = await res.json();
      setError(data.message);
    } catch {
      setError("Không thể kết nối server");
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
          <h2 className="text-3xl font-semibold text-white mb-4">Nhập mã OTP</h2>
          <p className="text-gray-300 mb-2">Nhập mã OTP được gửi đến email của bạn.</p>
          <p className="text-blue-300 text-sm mb-8">{sessionStorage.getItem("reset_email")}</p>

          {/* 6 Ô OTP */}
          <div className="flex gap-3 mb-4">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={`w-14 h-14 text-center text-xl rounded-lg bg-transparent border
                  focus:ring-2 outline-none transition
                  ${error ? "border-red-400 focus:ring-red-400/60" : "border-white/40 focus:ring-white/60"}`}
              />
            ))}
          </div>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          {/* Đếm ngược / Gửi lại */}
          <div className="mb-6">
            {canResend ? (
              <button onClick={handleResend} className="text-blue-400 text-sm hover:underline">
                Gửi lại OTP
              </button>
            ) : (
              <p className="text-gray-400 text-sm">
                Gửi lại sau <span className="text-white font-medium">{countdown}s</span>
              </p>
            )}
          </div>

          <button
            onClick={handleVerify}
            disabled={loading}
            className="p-3 rounded-full bg-gray-300 hover:bg-white text-black font-semibold transition disabled:opacity-60"
          >
            {loading ? "Đang xác nhận..." : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}