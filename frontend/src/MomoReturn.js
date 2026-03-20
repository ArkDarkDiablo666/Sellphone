// MomoReturn.js
// Trang này nhận redirect từ MoMo sau khi người dùng thanh toán.
// URL: /payment/momo-return?success=true&order_id=42
//               hoặc: ?success=false&order_id=42&message=...
//
// Thêm vào App.js:
//   import MomoReturn from "./MomoReturn";
//   <Route path="/payment/momo-return" element={<MomoReturn />} />

import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function MomoReturn() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();

  const success  = searchParams.get("success") === "true";
  const orderId  = searchParams.get("order_id") || "";
  const message  = searchParams.get("message")  || "";

  const [countdown, setCountdown] = useState(5);

  // Tự động chuyển trang sau 5 giây
  useEffect(() => {
    if (countdown <= 0) {
      navigate(success ? "/orders" : "/", { replace: true });
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, success, navigate]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-white"
      style={{ background: "#0a0a0a" }}
    >
      {success ? (
        <>
          {/* Thành công */}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: "rgba(52,199,89,0.15)" }}
          >
            <CheckCircle2 size={48} className="text-green-400" />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Thanh toán thành công!</h1>
            <p className="text-white/50 text-sm">
              Đơn hàng <span className="text-orange-400 font-mono font-bold">#{orderId}</span> đã được thanh toán qua MoMo.
            </p>
          </div>

          <div
            className="flex items-center gap-3 px-5 py-3 rounded-2xl border"
            style={{ background: "rgba(174,32,112,0.08)", borderColor: "rgba(174,32,112,0.25)" }}
          >
            {/* MoMo logo */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xl shrink-0"
              style={{ background: "linear-gradient(135deg,#ae2070,#d82d8b)" }}
            >
              M
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#d82d8b" }}>MoMo</p>
              <p className="text-xs text-white/40">Thanh toán thành công</p>
            </div>
          </div>

          {/* Đếm ngược */}
          <p className="text-white/30 text-sm">
            Chuyển về đơn hàng sau{" "}
            <span className="text-orange-400 font-bold">{countdown}</span> giây...
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => navigate("/orders", { replace: true })}
              className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition focus:outline-none"
            >
              Xem đơn hàng ngay
            </button>
            <button
              onClick={() => navigate("/", { replace: true })}
              className="px-6 py-2.5 rounded-xl text-sm text-white/50 hover:text-white transition focus:outline-none"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              Về trang chủ
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Thất bại / Hủy */}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,59,48,0.12)" }}
          >
            <XCircle size={48} className="text-red-400" />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Thanh toán thất bại</h1>
            <p className="text-white/50 text-sm">
              {message
                ? decodeURIComponent(message)
                : "Giao dịch bị hủy hoặc có lỗi xảy ra."}
            </p>
            {orderId && (
              <p className="text-white/30 text-xs mt-1">
                Mã đơn hàng: <span className="text-white/50 font-mono">#{orderId}</span>
              </p>
            )}
          </div>

          {/* Đếm ngược */}
          <p className="text-white/30 text-sm">
            Về trang chủ sau{" "}
            <span className="text-orange-400 font-bold">{countdown}</span> giây...
          </p>

          <div className="flex gap-3">
            {orderId && (
              <button
                onClick={() => navigate("/orders", { replace: true })}
                className="px-6 py-2.5 rounded-xl text-sm text-white/50 hover:text-white transition focus:outline-none"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                Xem đơn hàng
              </button>
            )}
            <button
              onClick={() => navigate("/", { replace: true })}
              className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition focus:outline-none"
            >
              Về trang chủ
            </button>
          </div>
        </>
      )}
    </div>
  );
}
