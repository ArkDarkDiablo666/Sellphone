import { useState, useEffect, useRef } from "react";
import {
  X, Package, MapPin, Clock, CheckCircle2,
  Truck, XCircle, RotateCcw, ChevronRight, Loader2,
  AlertCircle, Receipt, ShoppingBag,
  RefreshCw, ArrowRight, Check,
} from "lucide-react";

const API = "http://localhost:8000";

const STATUS_CONFIG = {
  Pending:         { label: "Chờ xác nhận",    color: "#ff9f0a", bg: "rgba(255,159,10,0.12)",  icon: Clock        },
  Processing:      { label: "Đang xử lý",      color: "#0a84ff", bg: "rgba(10,132,255,0.12)",  icon: RefreshCw    },
  Shipping:        { label: "Đang giao hàng",  color: "#5ac8fa", bg: "rgba(90,200,250,0.12)",  icon: Truck        },
  Delivered:       { label: "Đã giao hàng",    color: "#30d158", bg: "rgba(48,209,88,0.12)",   icon: CheckCircle2 },
  Cancelled:       { label: "Đã hủy",          color: "#ff453a", bg: "rgba(255,69,58,0.12)",   icon: XCircle      },
  ReturnRequested: { label: "Yêu cầu trả",     color: "#bf5af2", bg: "rgba(191,90,242,0.12)",  icon: RotateCcw    },
  ReturnApproved:  { label: "Chấp nhận trả",   color: "#bf5af2", bg: "rgba(191,90,242,0.12)",  icon: RotateCcw    },
  Returning:       { label: "Đang nhận hoàn",  color: "#bf5af2", bg: "rgba(191,90,242,0.12)",  icon: RotateCcw    },
  Returned:        { label: "Hoàn tất trả",    color: "#636366", bg: "rgba(99,99,102,0.12)",   icon: RotateCcw    },
};

const PAY_CONFIG = {
  momo:  { label: "MoMo",           color: "#d82d8b", bg: "rgba(216,45,139,0.12)", emoji: "💜" },
  vnpay: { label: "VNPay",          color: "#005baa", bg: "rgba(0,91,170,0.12)",   emoji: "🏦" },
  cod:   { label: "Thanh toán COD", color: "#30d158", bg: "rgba(48,209,88,0.12)",  emoji: "💵" },
  bank:  { label: "Chuyển khoản",   color: "#0a84ff", bg: "rgba(10,132,255,0.12)", emoji: "🏧" },
};

const MOMO_TEST_CARDS = [
  { label: "✅ ATM thành công",  no: "9704 0000 0000 0018", exp: "03/07", otp: "OTP tự động" },
  { label: "🔒 Thẻ bị khóa",   no: "9704 0000 0000 0026", exp: "03/07", otp: "OTP tự động" },
  { label: "💸 Không đủ số dư", no: "9704 0000 0000 0034", exp: "03/07", otp: "OTP tự động" },
];
const VNPAY_TEST_CARDS = [
  { label: "✅ NCB thành công",      no: "9704 1985 2619 1432 198", name: "NGUYEN VAN A", exp: "07/15", otp: "123456" },
  { label: "💸 NCB không đủ số dư", no: "9704 1957 9845 9170 488", name: "NGUYEN VAN A", exp: "07/15", otp: "—"      },
  { label: "✅ VISA thành công",     no: "4456 5300 0000 1005",     name: "NGUYEN VAN A", exp: "12/26", cvc: "123", otp: "—" },
  { label: "✅ MasterCard",          no: "5200 0000 0000 1005",     name: "NGUYEN VAN A", exp: "12/26", cvc: "123", otp: "—" },
];

const STEPS = ["Pending", "Processing", "Shipping", "Delivered"];

function Timeline({ status }) {
  const special = ["Cancelled","ReturnRequested","ReturnApproved","Returning","Returned"].includes(status);
  const currentIdx = special ? -1 : STEPS.indexOf(status);
  if (special) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Cancelled;
    const Icon = cfg.icon;
    return (
      <div className="flex items-center justify-center gap-3 py-3 px-4 rounded-2xl"
        style={{ background: cfg.bg, border: `1px solid ${cfg.color}22` }}>
        <Icon size={16} style={{ color: cfg.color }} />
        <span className="text-sm font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const cfg   = STATUS_CONFIG[step];
        const done  = idx <= currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: done ? cfg.color : "rgba(255,255,255,0.06)",
                  border:     done ? "none"     : "1.5px solid rgba(255,255,255,0.12)",
                  boxShadow:  active ? `0 0 14px ${cfg.color}66` : "none",
                }}>
                {done ? <CheckCircle2 size={14} color="white" /> : <div className="w-2 h-2 rounded-full bg-white/20" />}
              </div>
              <span className="text-[9px] font-medium whitespace-nowrap"
                style={{ color: done ? cfg.color : "rgba(255,255,255,0.25)" }}>
                {cfg.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className="flex-1 h-px mx-1 mb-4"
                style={{ background: idx < currentIdx ? "#30d158" : "rgba(255,255,255,0.08)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function QRCode({ url, size = 180, dotColor = "000000" }) {
  const [imgStatus, setImgStatus] = useState("loading");
  const encoded = encodeURIComponent(url);
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&color=${dotColor}&bgcolor=ffffff&margin=12&format=png&qzone=1`;
  return (
    <div className="relative flex items-center justify-center rounded-2xl overflow-hidden"
      style={{ width: size, height: size, background: "#fff" }}>
      {imgStatus === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      )}
      {imgStatus === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white">
          <AlertCircle size={20} className="text-red-400" />
          <p className="text-[10px] text-gray-500 text-center px-3">Không thể tải QR</p>
        </div>
      )}
      <img
        src={src} alt="QR thanh toán" width={size} height={size}
        style={{ display: imgStatus === "error" ? "none" : "block", opacity: imgStatus === "loading" ? 0 : 1, transition: "opacity 0.3s" }}
        onLoad={() => setImgStatus("ok")}
        onError={() => setImgStatus("error")}
      />
    </div>
  );
}

function TestCardInfo({ method }) {
  const [show, setShow] = useState(false);
  const cards = method === "momo" ? MOMO_TEST_CARDS : VNPAY_TEST_CARDS;
  const color = method === "momo" ? "#d82d8b" : "#005baa";
  return (
    <div>
      <button onClick={() => setShow(s => !s)}
        className="flex items-center gap-1.5 text-xs w-full transition"
        style={{ color: "rgba(255,255,255,0.3)" }}>
        <AlertCircle size={11} />
        Xem thông tin thẻ test
        <ChevronRight size={10} className={`ml-auto transition-transform ${show ? "rotate-90" : ""}`} />
      </button>
      {show && (
        <div className="mt-2 rounded-xl border border-white/8 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.03)" }}>
          {cards.map((c, i) => (
            <div key={i} className="px-3 py-2.5 border-b border-white/5 last:border-0">
              <p className="text-[10px] font-semibold mb-1" style={{ color }}>{c.label}</p>
              <p className="text-[10px] font-mono text-white/60 tracking-wider">{c.no}</p>
              {c.name && <p className="text-[10px] text-white/35">Tên: {c.name}</p>}
              <div className="flex gap-3 flex-wrap mt-0.5">
                <p className="text-[10px] text-white/35">Hạn: {c.exp}</p>
                {c.otp && c.otp !== "—" && <p className="text-[10px] text-white/35">OTP: <span className="font-mono text-white/55">{c.otp}</span></p>}
                {c.cvc && <p className="text-[10px] text-white/35">CVC: <span className="font-mono text-white/55">{c.cvc}</span></p>}
              </div>
            </div>
          ))}
          <div className="px-3 py-2 border-t border-white/5" style={{ background: `${color}08` }}>
            <p className="text-[9px] text-white/30">
              {method === "momo"
                ? "Mật khẩu ví MoMo: 000000 · OTP: 000000"
                : "Sandbox: sandbox.vnpayment.vn"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentQRSection({ order, onPaid }) {
  const [step,    setStep]    = useState("idle");
  const [payUrl,  setPayUrl]  = useState("");
  const [err,     setErr]     = useState("");
  const [copied,  setCopied]  = useState(false);
  const [expired, setExpired] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const method  = order.payment_method;
  const isMomo  = method === "momo";
  const accentColor  = isMomo ? "#d82d8b" : "#005baa";
  const accentBg     = isMomo ? "rgba(216,45,139,0.08)" : "rgba(0,91,170,0.08)";
  const accentBorder = isMomo ? "rgba(216,45,139,0.3)"  : "rgba(0,91,170,0.3)";
  const dotColor     = isMomo ? "ae2070" : "003f8a";

  const handleGetQR = async () => {
    setStep("loading"); setErr(""); setPayUrl(""); setExpired(false);
    clearTimeout(timerRef.current);
    const endpoint = isMomo
      ? `${API}/api/payment/momo/create/`
      : `${API}/api/payment/vnpay/create/`;
    try {
      const res  = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, amount: Math.round(parseFloat(order.total_amount)) }),
      });
      const data = await res.json();
      if (res.ok && data.pay_url) {
        setPayUrl(data.pay_url);
        setStep("qr");
        timerRef.current = setTimeout(() => setExpired(true), 15 * 60 * 1000);
      } else {
        setErr(data.message || "Không thể tạo mã QR");
        setStep("error");
      }
    } catch {
      setErr("Không thể kết nối server");
      setStep("error");
    }
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(payUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  if (step === "idle" || step === "error") return (
    <div className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: accentBg, border: `1.5px solid ${accentBorder}` }}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accentColor }} />
        <p className="text-xs font-semibold" style={{ color: accentColor }}>Đơn hàng chưa thanh toán</p>
        <span className="ml-auto text-sm font-bold text-orange-400">
          {parseFloat(order.total_amount).toLocaleString("vi-VN")}đ
        </span>
      </div>
      <button onClick={handleGetQR}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]"
        style={{
          background: isMomo
            ? "linear-gradient(135deg,#ae2070 0%,#d82d8b 50%,#e8479e 100%)"
            : "linear-gradient(135deg,#003f8a 0%,#005baa 50%,#0077cc 100%)",
          boxShadow: isMomo ? "0 4px 20px rgba(216,45,139,0.4)" : "0 4px 20px rgba(0,91,170,0.4)",
          border: "none",
        }}>
        {isMomo
          ? <><span className="text-base">💜</span> Lấy mã QR MoMo <ArrowRight size={14} /></>
          : <><span className="font-extrabold text-xs">VN<span style={{color:"#FFD700"}}>Pay</span></span> Lấy mã QR VNPay <ArrowRight size={14} /></>}
      </button>
      {step === "error" && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle size={12} /> {err}
        </div>
      )}
      <p className="text-[10px] text-white/25 text-center">
        Quét mã QR bằng app {isMomo ? "MoMo" : "VNPay"} để thanh toán
      </p>
      <TestCardInfo method={method} />
    </div>
  );

  if (step === "loading") return (
    <div className="rounded-2xl p-8 flex flex-col items-center gap-3"
      style={{ background: accentBg, border: `1.5px solid ${accentBorder}` }}>
      <Loader2 size={32} className="animate-spin" style={{ color: accentColor }} />
      <p className="text-sm text-white/50">Đang tạo mã QR...</p>
    </div>
  );

  if (step === "qr") return (
    <div className="rounded-2xl p-4 flex flex-col gap-4"
      style={{ background: accentBg, border: `1.5px solid ${accentBorder}` }}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accentColor }} />
        <p className="text-xs font-semibold" style={{ color: accentColor }}>
          {isMomo ? "Quét QR bằng App MoMo" : "Quét QR bằng App VNPay / NAPAS"}
        </p>
        <span className="ml-auto text-sm font-bold text-orange-400">
          {parseFloat(order.total_amount).toLocaleString("vi-VN")}đ
        </span>
      </div>
      <div className="flex gap-4 items-start">
        <div className="flex flex-col items-center gap-2 shrink-0">
          {expired ? (
            <div className="w-[160px] h-[160px] rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-2 bg-white/3">
              <AlertCircle size={22} className="text-orange-400" />
              <p className="text-xs text-white/40 text-center">QR hết hạn</p>
              <button onClick={handleGetQR}
                className="text-xs px-3 py-1 rounded-lg font-medium transition"
                style={{ background: accentColor + "22", color: accentColor }}>
                Tạo lại
              </button>
            </div>
          ) : (
            <>
              <div className="p-2 rounded-2xl" style={{ background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                <QRCode url={payUrl} size={156} dotColor={dotColor} />
              </div>
              <p className="text-[9px] text-white/20">Hiệu lực 15 phút</p>
            </>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {(isMomo ? [
            "Mở App MoMo",
            "Nhấn biểu tượng quét QR",
            "Quét mã và xác nhận",
            "Nhập OTP: 000000",
          ] : [
            "Mở App VNPay / NAPAS",
            "Chọn Quét QR thanh toán",
            "Quét mã và xác nhận",
            "Nhập OTP ngân hàng",
          ]).map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold"
                style={{ background: accentColor + "25", color: accentColor }}>{i + 1}</div>
              <p className="text-xs text-white/50">{s}</p>
            </div>
          ))}
          <div className="mt-1 pt-2 border-t border-white/5 flex flex-col gap-1.5">
            <p className="text-[10px] text-white/25">Không quét được?</p>
            <div className="flex gap-1.5">
              <button onClick={() => window.open(payUrl, "_blank")}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium transition active:scale-95"
                style={{ background: accentColor + "20", color: accentColor, border: `1px solid ${accentColor}40` }}>
                <ArrowRight size={11} /> Mở link
              </button>
              <button onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs transition"
                style={{ background: "rgba(255,255,255,0.05)", color: copied ? "#30d158" : "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {copied ? <><Check size={10}/> Copied</> : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <TestCardInfo method={method} />
      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <p className="text-xs text-white/30 flex-1">Đã thanh toán xong?</p>
        <button onClick={() => { setStep("done"); onPaid?.(); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition active:scale-95"
          style={{ background: "rgba(48,209,88,0.15)", border: "1px solid rgba(48,209,88,0.3)", color: "#30d158" }}>
          <CheckCircle2 size={12} /> Đã thanh toán
        </button>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background: "rgba(48,209,88,0.08)", border: "1px solid rgba(48,209,88,0.2)" }}>
      <CheckCircle2 size={20} className="text-green-400 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-green-400">Đã xác nhận thanh toán</p>
        <p className="text-xs text-white/40 mt-0.5">
          {isMomo ? "MoMo" : "VNPay"} sẽ xác nhận và cập nhật đơn hàng tự động.
        </p>
      </div>
    </div>
  );
}

export default function OrderDetailPopup({ order, onClose, onRefresh }) {
  const [paid, setPaid] = useState(false);
  if (!order) return null;

  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.Pending;
  const StatusIcon = statusCfg.icon;
  const payCfg     = PAY_CONFIG[order.payment_method] || PAY_CONFIG.cod;
  const showPay    = ["momo","vnpay"].includes(order.payment_method) &&
                     ["Pending","Processing"].includes(order.status) && !paid;

  const subtotal = parseFloat(order.subtotal || order.total_amount || 0);
  const discount = parseFloat(order.discount || 0);
  const total    = parseFloat(order.total_amount || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl overflow-hidden"
        style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: statusCfg.bg }}>
              <StatusIcon size={16} style={{ color: statusCfg.color }} />
            </div>
            <div>
              <p className="text-xs text-white/30 font-mono">#{order.id}</p>
              <p className="text-sm font-bold text-white leading-tight">Chi tiết đơn hàng</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition hover:bg-white/8"
            style={{ color: "rgba(255,255,255,0.4)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <Timeline status={order.status} />

          {showPay && (
            <PaymentQRSection order={order} onPaid={() => { setPaid(true); onRefresh?.(); }} />
          )}

          {paid && (
            <div className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: "rgba(48,209,88,0.08)", border: "1px solid rgba(48,209,88,0.2)" }}>
              <CheckCircle2 size={18} className="text-green-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-400">Đã xác nhận thanh toán</p>
                <p className="text-xs text-white/40 mt-0.5">Đơn hàng sẽ được cập nhật tự động.</p>
              </div>
            </div>
          )}

          {/* Status + payment method */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] text-white/30 mb-1.5">Trạng thái</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: statusCfg.color }} />
                <p className="text-xs font-semibold" style={{ color: statusCfg.color }}>{statusCfg.label}</p>
              </div>
            </div>
            <div className="rounded-2xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] text-white/30 mb-1.5">Thanh toán</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">{payCfg.emoji}</span>
                <p className="text-xs font-semibold" style={{ color: payCfg.color }}>{payCfg.label}</p>
              </div>
            </div>
          </div>

          {order.status_note && (
            <div className="rounded-xl px-4 py-3 flex items-start gap-2.5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <Receipt size={13} className="text-white/30 shrink-0 mt-0.5" />
              <p className="text-xs text-white/50 leading-relaxed">{order.status_note}</p>
            </div>
          )}

          {(order.estimated_delivery || order.actual_delivery) && (
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {order.actual_delivery ? (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(52,199,89,0.12)" }}>
                    <Check size={13} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30">Đã giao lúc</p>
                    <p className="text-xs font-semibold text-green-400">
                      {new Date(order.actual_delivery).toLocaleString("vi-VN", { weekday:"short", day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(10,132,255,0.12)" }}>
                    <Truck size={13} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30">Giao dự kiến</p>
                    <p className="text-xs font-semibold text-blue-300">
                      {new Date(order.estimated_delivery).toLocaleDateString("vi-VN", { weekday:"long", day:"2-digit", month:"2-digit", year:"numeric" })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={13} className="text-orange-400" />
              <p className="text-xs font-semibold text-white/70">Địa chỉ giao hàng</p>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">{order.shipping_address}</p>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <ShoppingBag size={13} className="text-orange-400" />
              <p className="text-xs font-semibold text-white/70">Sản phẩm ({order.items?.length || 0})</p>
            </div>
            {(order.items || []).map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                  style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain p-1" /> : <Package size={18} className="text-white/10" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{item.product_name}</p>
                  <p className="text-[10px] text-white/35 mt-0.5">{[item.color, item.ram, item.storage].filter(Boolean).join(" · ")}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{parseFloat(item.unit_price).toLocaleString("vi-VN")}đ × {item.quantity}</p>
                </div>
                <p className="text-xs font-bold text-orange-400 shrink-0">
                  {(parseFloat(item.unit_price) * item.quantity).toLocaleString("vi-VN")}đ
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4 flex flex-col gap-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Tạm tính</span>
              <span className="text-white/70">{subtotal.toLocaleString("vi-VN")}đ</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-white/40">🏷️ Giảm giá</span>
                <span className="text-green-400">-{discount.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            <div className="flex justify-between pt-2.5 border-t border-white/8">
              <span className="text-sm font-bold text-white">Tổng cộng</span>
              <span className="text-base font-bold text-orange-400">{total.toLocaleString("vi-VN")}đ</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 shrink-0">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition hover:bg-white/8"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}