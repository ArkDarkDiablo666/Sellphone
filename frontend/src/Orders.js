import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, useToast } from "./Toast";
import { getUser, authFetch, AUTH_REDIRECTED, checkAndHandleExpiry } from "./authUtils";
import {
  ArrowLeft, Package, ChevronRight, Clock, CheckCircle2,
  Truck, MapPin, XCircle, RefreshCw, ShoppingBag, Check,
  RotateCcw, Upload, X, FileVideo, Image, AlertCircle, Info,
  Loader2, ArrowRight, CreditCard, ChevronDown, AlertTriangle,
  Printer, FileText,
} from "lucide-react";

const API = "http://localhost:8000";

const STATUS_MAP = {
  Pending:          { label: "Chờ xác nhận",          color: "#ff9500", bg: "rgba(255,149,0,0.12)",  icon: Clock,        step: 0 },
  Processing:       { label: "Đang xử lý",             color: "#0a84ff", bg: "rgba(10,132,255,0.12)", icon: RefreshCw,    step: 1 },
  Shipping:         { label: "Đang giao hàng",         color: "#30d158", bg: "rgba(48,209,88,0.12)",  icon: Truck,        step: 2 },
  Delivered:        { label: "Đã giao hàng",           color: "#34c759", bg: "rgba(52,199,89,0.12)",  icon: CheckCircle2, step: 3 },
  Cancelled:        { label: "Đã hủy",                 color: "#ff3b30", bg: "rgba(255,59,48,0.12)",  icon: XCircle,      step: -1 },
  ReturnRequested:  { label: "Yêu cầu trả hàng",       color: "#bf5af2", bg: "rgba(191,90,242,0.12)", icon: RotateCcw,    step: 3 },
  ReturnApproved:   { label: "Trả hàng được duyệt",    color: "#bf5af2", bg: "rgba(191,90,242,0.12)", icon: RotateCcw,    step: 3 },
  Returning:        { label: "Đang hoàn hàng",         color: "#ff9500", bg: "rgba(255,149,0,0.12)",  icon: Truck,        step: 3 },
  Returned:         { label: "Hoàn tất trả hàng",      color: "#34c759", bg: "rgba(52,199,89,0.12)",  icon: CheckCircle2, step: 3 },
};

const RETURN_STATUS_MAP = {
  Pending:   { label: "Chờ xét duyệt",         color: "#ff9500" },
  Approved:  { label: "Đã chấp nhận",           color: "#34c759" },
  Rejected:  { label: "Đã từ chối",             color: "#ff3b30" },
  Returning: { label: "Đang nhận hàng hoàn về", color: "#0a84ff" },
  Completed: { label: "Hoàn tất",               color: "#34c759" },
};

function CustomerDeliveryCountdown({ estimated, status }) {
  const est  = new Date(estimated);
  const now  = new Date();
  const diff = Math.ceil((est - now) / (1000 * 60 * 60 * 24));
  if (status === "Shipping") {
    if (diff < 0) return (
      <span className="text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1"
        style={{background:"rgba(255,59,48,0.1)",color:"#ff3b30",border:"1px solid rgba(255,59,48,0.2)"}}>
        ⚠ Trễ {Math.abs(diff)} ngày
      </span>
    );
    if (diff === 0) return (
      <span className="text-xs px-2.5 py-1 rounded-full font-medium"
        style={{background:"rgba(255,149,0,0.1)",color:"#ff9500",border:"1px solid rgba(255,149,0,0.2)"}}>
        🚚 Giao hôm nay!
      </span>
    );
    return (
      <span className="text-xs px-2.5 py-1 rounded-full font-medium"
        style={{background:"rgba(10,132,255,0.1)",color:"#5ac8fa",border:"1px solid rgba(10,132,255,0.2)"}}>
        🕐 Còn {diff} ngày
      </span>
    );
  }
  return null;
}

const STEPS = [
  { key: "Pending",    label: "Chờ xác nhận" },
  { key: "Processing", label: "Đang xử lý"   },
  { key: "Shipping",   label: "Đang giao"    },
  { key: "Delivered",  label: "Đã giao"      },
];

const MOMO_TEST_CARDS = [
  { label: "✅ Thành công",     no: "9704 0000 0000 0018", exp: "03/07", otp: "OTP" },
  { label: "🔒 Thẻ bị khóa",   no: "9704 0000 0000 0026", exp: "03/07", otp: "OTP" },
  { label: "💸 Không đủ số dư", no: "9704 0000 0000 0034", exp: "03/07", otp: "OTP" },
];

const VNPAY_TEST_CARDS = [
  { label: "✅ NCB - Thành công",       no: "9704 1985 2619 1432 198", name: "NGUYEN VAN A", exp: "07/15", otp: "123456" },
  { label: "💸 NCB - Không đủ số dư",  no: "9704 1957 9845 9170 488", name: "NGUYEN VAN A", exp: "07/15", otp: "—" },
  { label: "✅ VISA - Thành công",      no: "4456 5300 0000 1005",     name: "NGUYEN VAN A", exp: "12/26", cvc: "123", otp: "—" },
  { label: "✅ MasterCard - Thành công",no: "5200 0000 0000 1005",     name: "NGUYEN VAN A", exp: "12/26", cvc: "123", otp: "—" },
];

// ════════════════════════════════════════════════════════════════
// [NEW] HÓA ĐƠN IN — Invoice Print Component
// ════════════════════════════════════════════════════════════════

function InvoicePrint({ order, user, onClose }) {
  const PAY_LABEL = {
    cod:   "Thanh toán khi nhận hàng (COD)",
    momo:  "Thanh toán qua MoMo",
    vnpay: "Thanh toán qua VNPay",
    bank:  "Chuyển khoản ngân hàng",
  };

  const handlePrint = () => {
    const printContent = document.getElementById("invoice-print-area");
    if (!printContent) return;
    const win = window.open("", "_blank", "width=800,height=900");
    win.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <title>Hóa đơn #${order.id} — PHONEZONE</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 32px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #ff6b00; padding-bottom: 16px; margin-bottom: 20px; }
          .brand { font-size: 24px; font-weight: 800; color: #ff6b00; letter-spacing: -0.5px; }
          .brand-sub { font-size: 11px; color: #888; margin-top: 2px; }
          .invoice-title { font-size: 20px; font-weight: 700; color: #333; text-align: right; }
          .invoice-meta { font-size: 11px; color: #666; text-align: right; margin-top: 4px; }
          .section { margin-bottom: 18px; }
          .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; }
          .info-row { display: flex; gap: 6px; font-size: 12px; }
          .info-label { color: #888; min-width: 90px; }
          .info-value { color: #222; font-weight: 500; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f8f8f8; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #666; border-bottom: 1px solid #e0e0e0; }
          td { padding: 9px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
          .text-right { text-align: right; }
          .total-section { margin-top: 12px; display: flex; justify-content: flex-end; }
          .total-table { width: 260px; }
          .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
          .total-row.final { font-size: 15px; font-weight: 800; color: #ff6b00; border-top: 2px solid #ff6b00; padding-top: 8px; margin-top: 4px; }
          .discount-value { color: #16a34a; }
          .footer { margin-top: 32px; text-align: center; color: #aaa; font-size: 11px; border-top: 1px solid #eee; padding-top: 16px; }
          .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: #dcfce7; color: #16a34a; }
          @media print {
            body { padding: 16px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
        <script>
          window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 1000); }
        <\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const subtotal  = parseFloat(order.subtotal || order.total_amount);
  const discount  = parseFloat(order.discount || 0);
  const total     = parseFloat(order.total_amount);
  const createdAt = new Date(order.created_at).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-orange-500" />
            <span className="font-bold text-gray-800">Hóa đơn #{ order.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition"
            >
              <Printer size={15} /> In hóa đơn
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Invoice content */}
        <div id="invoice-print-area" className="p-6 text-gray-800">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-orange-500 pb-4 mb-5">
            <div>
              <div className="text-2xl font-extrabold text-orange-500 tracking-tight">PHONEZONE</div>
              <div className="text-xs text-gray-400 mt-1">Cửa hàng điện thoại chính hãng</div>
              <div className="text-xs text-gray-400">support@phonezone.vn · 1800 6789</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-700">HÓA ĐƠN BÁN HÀNG</div>
              <div className="text-sm text-gray-500 mt-1">Số: #PZ-{String(order.id).padStart(6, "0")}</div>
              <div className="text-xs text-gray-400 mt-0.5">Ngày: {createdAt}</div>
              <div className="mt-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: "#dcfce7", color: "#16a34a" }}>
                  {STATUS_MAP[order.status]?.label || order.status}
                </span>
              </div>
            </div>
          </div>

          {/* Customer + Delivery info */}
          <div className="grid grid-cols-2 gap-6 mb-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 border-b border-gray-100 pb-1">
                Thông tin khách hàng
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">Họ tên:</span><span className="font-medium">{user?.fullName || "Khách hàng"}</span></div>
                <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">Email:</span><span className="font-medium">{user?.email || "—"}</span></div>
                <div className="flex gap-2"><span className="text-gray-400 w-20 shrink-0">Địa chỉ:</span><span className="font-medium">{order.shipping_address}</span></div>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 border-b border-gray-100 pb-1">
                Thông tin thanh toán
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex gap-2"><span className="text-gray-400 w-28 shrink-0">Phương thức:</span><span className="font-medium">{PAY_LABEL[order.payment_method] || "COD"}</span></div>
                <div className="flex gap-2"><span className="text-gray-400 w-28 shrink-0">Mã đơn hàng:</span><span className="font-mono font-bold text-orange-500">#{order.id}</span></div>
                {order.estimated_delivery && (
                  <div className="flex gap-2"><span className="text-gray-400 w-28 shrink-0">Giao dự kiến:</span><span className="font-medium">{new Date(order.estimated_delivery).toLocaleDateString("vi-VN")}</span></div>
                )}
                {order.actual_delivery && (
                  <div className="flex gap-2"><span className="text-gray-400 w-28 shrink-0">Đã giao:</span><span className="font-medium text-green-600">{new Date(order.actual_delivery).toLocaleString("vi-VN")}</span></div>
                )}
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="mb-5">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 border-b border-gray-100 pb-1">
              Chi tiết sản phẩm
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Sản phẩm</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Cấu hình</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase">SL</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Đơn giá</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-3 py-2.5 font-medium text-gray-800">{item.product_name}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{[item.color, item.storage, item.ram].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-2.5 text-center text-gray-700">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{parseFloat(item.unit_price).toLocaleString("vi-VN")}đ</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{(parseFloat(item.unit_price) * item.quantity).toLocaleString("vi-VN")}đ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-5">
            <div className="w-64 space-y-1.5">
              {subtotal !== total && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Tạm tính</span>
                  <span>{subtotal.toLocaleString("vi-VN")}đ</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Giảm giá</span>
                  <span className="text-green-600 font-medium">-{discount.toLocaleString("vi-VN")}đ</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold border-t-2 border-orange-500 pt-2 mt-1 text-orange-600">
                <span>TỔNG THANH TOÁN</span>
                <span>{total.toLocaleString("vi-VN")}đ</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 pt-4 text-center text-xs text-gray-400 space-y-1">
            <p className="font-medium text-gray-500">Cảm ơn quý khách đã mua sắm tại PHONEZONE!</p>
            <p>Mọi thắc mắc vui lòng liên hệ: support@phonezone.vn · 1800 6789</p>
            <p className="text-gray-300">Hóa đơn được xuất tự động · PHONEZONE © {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ════════════════════════════════════════════════════════════════

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.Processing;
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ color: s.color, background: s.bg }}>
      <Icon size={11} /> {s.label}
    </span>
  );
}

function OrderTimeline({ status }) {
  const currentStep = STATUS_MAP[status]?.step ?? 0;
  if (status === "Cancelled") return (
    <div className="flex items-center gap-2 text-red-400 text-xs mt-2">
      <XCircle size={13} /> Đơn hàng đã bị hủy
    </div>
  );
  if (['ReturnRequested','ReturnApproved','Returning','Returned'].includes(status)) return (
    <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: "#bf5af2" }}>
      <RotateCcw size={13} /> {STATUS_MAP[status]?.label}
    </div>
  );
  const fillPct = currentStep >= 3 ? 100 : (currentStep / 3) * 100;
  return (
    <div className="mt-3">
      <div className="flex items-start justify-between relative">
        <div className="absolute left-3 right-3 h-1 top-3 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="absolute left-3 h-1 top-3 rounded-full bg-orange-500 transition-all duration-700"
          style={{ width: `calc(${fillPct}% * ((100% - 24px) / 100%))` }} />
        {STEPS.map((s, i) => {
          const done = i <= currentStep;
          return (
            <div key={s.key} className="flex flex-col items-center gap-1.5 relative z-10" style={{ width: "56px" }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                style={{ background: done ? "#ff9500" : "rgba(255,255,255,0.1)" }}>
                {done ? <Check size={11} className="text-white" /> : <div className="w-1.5 h-1.5 rounded-full bg-white/30" />}
              </div>
              <span className="text-[9px] text-center leading-tight"
                style={{ color: done ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.25)" }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TestCardInfo({ method }) {
  const [show, setShow] = useState(false);
  const cards = method === "momo" ? MOMO_TEST_CARDS : VNPAY_TEST_CARDS;
  return (
    <div className="mt-1">
      <button onClick={() => setShow(s => !s)}
        className="flex items-center gap-1.5 text-xs transition w-full"
        style={{ color: "rgba(255,255,255,0.3)" }}>
        <AlertCircle size={11} /> Xem thông tin thẻ test
        <ChevronDown size={10} className={`ml-auto transition-transform ${show ? "rotate-180" : ""}`} />
      </button>
      {show && (
        <div className="mt-2 rounded-xl border border-white/8 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.03)" }}>
          {cards.map((c, i) => (
            <div key={i} className="px-3 py-2.5 border-b border-white/5 last:border-0">
              <p className="text-[10px] font-semibold mb-1"
                style={{ color: method === "momo" ? "#d82d8b" : "#0077cc" }}>{c.label}</p>
              <div className="flex flex-col gap-0.5">
                <p className="text-[10px] font-mono text-white/60 tracking-wider">{c.no}</p>
                {c.name && <p className="text-[10px] text-white/40">Tên: {c.name}</p>}
                <div className="flex gap-3 flex-wrap">
                  <p className="text-[10px] text-white/40">Hạn: {c.exp}</p>
                  {c.otp !== "—" && <p className="text-[10px] text-white/40">OTP: <span className="font-mono text-white/60">{c.otp}</span></p>}
                  {c.cvc && <p className="text-[10px] text-white/40">CVC: <span className="font-mono text-white/60">{c.cvc}</span></p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QRCode({ url, size = 200 }) {
  const [status, setStatus] = useState("loading");
  const encoded = encodeURIComponent(url);
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=10&format=png`;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }}>
          <Loader2 size={24} className="animate-spin text-white/30" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl gap-2" style={{ background: "rgba(255,255,255,0.04)" }}>
          <AlertCircle size={20} className="text-red-400" />
          <p className="text-[10px] text-white/40">Không thể tải QR</p>
        </div>
      )}
      <img src={src} alt="QR Code" width={size} height={size} className="rounded-2xl"
        style={{ display: status === "error" ? "none" : "block", opacity: status === "loading" ? 0 : 1, transition: "opacity 0.3s", border: "3px solid rgba(255,255,255,0.08)" }}
        onLoad={() => setStatus("ok")} onError={() => setStatus("error")} />
    </div>
  );
}

function PaymentSection({ order, onPaid }) {
  const [step,    setStep]    = useState("idle");
  const [payUrl,  setPayUrl]  = useState("");
  const [err,     setErr]     = useState("");
  const [copied,  setCopied]  = useState(false);
  const [expired, setExpired] = useState(false);
  const timerRef = useRef(null);

  const method  = order.payment_method;
  const isMomo  = method === "momo";
  const isVnpay = method === "vnpay";
  const needsPay = (isMomo || isVnpay) && ["Pending", "Processing"].includes(order.status);

  useEffect(() => () => clearTimeout(timerRef.current), []);
  if (!needsPay) return null;

  const accentColor   = isMomo ? "#d82d8b" : "#005baa";
  const accentColorBg = isMomo ? "rgba(216,45,139,0.08)" : "rgba(0,91,170,0.08)";
  const accentBorder  = isMomo ? "rgba(216,45,139,0.3)" : "rgba(0,91,170,0.3)";

  const handleGetQR = async () => {
    setStep("loading"); setErr(""); setPayUrl(""); setExpired(false);
    const endpoint = isMomo ? `${API}/api/payment/momo/create/` : `${API}/api/payment/vnpay/create/`;
    try {
      const res  = await authFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: order.id, amount: Math.round(parseFloat(order.total_amount)) }) });
      if (!res || res === AUTH_REDIRECTED) return;
      const data = await res.json();
      if (res.ok && data.pay_url) { setPayUrl(data.pay_url); setStep("qr"); timerRef.current = setTimeout(() => setExpired(true), 15 * 60 * 1000); }
      else { setErr(data.message || "Không thể tạo link thanh toán"); setStep("error"); }
    } catch { setErr("Không thể kết nối server"); setStep("error"); }
  };

  if (step === "idle" || step === "error") return (
    <div className="rounded-2xl p-5 mb-4 flex flex-col gap-3" style={{ background: accentColorBg, border: `1.5px solid ${accentBorder}` }}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accentColor }} />
        <p className="text-xs font-semibold" style={{ color: accentColor }}>Đơn hàng chưa thanh toán</p>
        <span className="ml-auto text-sm font-bold text-orange-400">{parseFloat(order.total_amount).toLocaleString("vi-VN")}đ</span>
      </div>
      <button onClick={handleGetQR}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]"
        style={{ background: isMomo ? "linear-gradient(135deg,#ae2070 0%,#d82d8b 50%,#e8479e 100%)" : "linear-gradient(135deg,#003f8a 0%,#005baa 50%,#0077cc 100%)", boxShadow: isMomo ? "0 4px 20px rgba(216,45,139,0.4)" : "0 4px 20px rgba(0,91,170,0.4)", border: "none" }}>
        {isMomo ? <><span className="text-base">💜</span> Lấy mã QR MoMo <ArrowRight size={14} /></> : <><span className="font-extrabold text-xs">VN<span style={{color:"#FFD700"}}>Pay</span></span> Lấy mã QR VNPay <ArrowRight size={14} /></>}
      </button>
      {step === "error" && <div className="flex items-center gap-2 text-xs text-red-400"><AlertCircle size={12} /> {err}</div>}
      <TestCardInfo method={method} />
    </div>
  );

  if (step === "loading") return (
    <div className="rounded-2xl p-8 mb-4 flex flex-col items-center gap-3" style={{ background: accentColorBg, border: `1.5px solid ${accentBorder}` }}>
      <Loader2 size={32} className="animate-spin" style={{ color: accentColor }} />
      <p className="text-sm text-white/50">Đang tạo mã QR...</p>
    </div>
  );

  if (step === "qr") return (
    <div className="rounded-2xl p-5 mb-4 flex flex-col gap-4" style={{ background: accentColorBg, border: `1.5px solid ${accentBorder}` }}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accentColor }} />
        <p className="text-xs font-semibold" style={{ color: accentColor }}>{isMomo ? "Quét mã QR bằng App MoMo" : "Quét mã QR bằng App VNPay"}</p>
        <span className="ml-auto text-sm font-bold text-orange-400">{parseFloat(order.total_amount).toLocaleString("vi-VN")}đ</span>
      </div>
      <div className="flex gap-4 items-start">
        <div className="flex flex-col items-center gap-2 shrink-0">
          {expired ? (
            <div className="w-[180px] h-[180px] rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.03)" }}>
              <AlertCircle size={24} className="text-orange-400" />
              <p className="text-xs text-white/40 text-center px-3">QR hết hạn</p>
              <button onClick={handleGetQR} className="text-xs px-3 py-1 rounded-lg font-medium" style={{ background: accentColor + "22", color: accentColor }}>Tạo lại</button>
            </div>
          ) : <QRCode url={payUrl} size={180} />}
          {!expired && <p className="text-[9px] text-white/20 text-center">Hiệu lực 15 phút</p>}
        </div>
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex flex-col gap-2">
            {(isMomo ? ["Mở App MoMo trên điện thoại","Chọn biểu tượng quét QR","Quét mã và xác nhận thanh toán","Nhập OTP: 000000"] : ["Mở App VNPay trên điện thoại","Chọn Quét QR / Thanh toán QR","Quét mã và xác nhận thanh toán","Nhập OTP từ ngân hàng"]).map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5" style={{ background: accentColor + "25", color: accentColor }}>{i + 1}</div>
                <p className="text-xs text-white/55 leading-relaxed">{s}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
            <p className="text-[10px] text-white/25">Không quét được? Dùng link:</p>
            <div className="flex gap-1.5">
              <button onClick={() => window.open(payUrl, "_blank")} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition" style={{ background: accentColor + "20", color: accentColor, border: `1px solid ${accentColor}40` }}><ArrowRight size={11} /> Mở trang TT</button>
              <button onClick={async () => { try { await navigator.clipboard.writeText(payUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition" style={{ background: "rgba(255,255,255,0.05)", color: copied ? "#30d158" : "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>{copied ? <><Check size={11}/> Đã copy</> : "Copy link"}</button>
            </div>
          </div>
        </div>
      </div>
      <TestCardInfo method={method} />
      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <p className="text-xs text-white/30 flex-1">Đã thanh toán xong?</p>
        <button onClick={() => { setStep("done"); onPaid?.(); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition" style={{ background: "rgba(48,209,88,0.15)", border: "1px solid rgba(48,209,88,0.3)", color: "#30d158" }}><CheckCircle2 size={12} /> Xác nhận đã thanh toán</button>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl p-4 mb-4 flex items-center gap-3" style={{ background: "rgba(48,209,88,0.08)", border: "1px solid rgba(48,209,88,0.2)" }}>
      <CheckCircle2 size={20} className="text-green-400 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-green-400">Đã xác nhận thanh toán</p>
        <p className="text-xs text-white/40 mt-0.5">Đơn hàng sẽ được cập nhật sau khi {isMomo ? "MoMo" : "VNPay"} xác nhận giao dịch.</p>
      </div>
    </div>
  );
}

function PaidNotice({ method }) {
  return (
    <div className="rounded-2xl p-4 mb-4 flex items-center gap-3" style={{ background: "rgba(48,209,88,0.08)", border: "1px solid rgba(48,209,88,0.2)" }}>
      <CheckCircle2 size={18} className="text-green-400 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-green-400">Đã mở trang thanh toán</p>
        <p className="text-xs text-white/40 mt-0.5">Hoàn tất thanh toán trong tab {method === "momo" ? "MoMo" : "VNPay"} vừa mở. Đơn hàng sẽ được cập nhật sau.</p>
      </div>
    </div>
  );
}

function ReturnForm({ order, onSuccess, onCancel }) {
  const [reason,  setReason]  = useState("");
  const [files,   setFiles]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const fileRef = useRef();

  const MAX_TOTAL = 500 * 1024 * 1024;
  const ALLOWED   = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/x-msvideo','video/webm'];

  const addFiles = (newFiles) => {
    const arr = Array.from(newFiles);
    const invalid = arr.filter(f => !ALLOWED.includes(f.type));
    if (invalid.length) { setError(`File không được hỗ trợ: ${invalid.map(f => f.name).join(', ')}`); return; }
    const all = [...files, ...arr];
    if (all.reduce((s, f) => s + f.size, 0) > MAX_TOTAL) { setError("Tổng dung lượng vượt 500MB"); return; }
    setError(""); setFiles(all);
  };

  const submit = async () => {
    if (!reason.trim()) { setError("Vui lòng nhập lý do trả hàng"); return; }
    if (files.length === 0) { setError("Vui lòng đính kèm ít nhất 1 ảnh hoặc video"); return; }
    setLoading(true); setError("");
    const fd = new FormData();
    fd.append("order_id", order.id); fd.append("customer_id", getUser()?.id); fd.append("reason", reason);
    files.forEach(f => fd.append("media", f));
    try {
      const res = await authFetch(`${API}/api/order/return/request/`, { method: "POST", body: fd });
      if (!res || res === AUTH_REDIRECTED) return;
      const data = await res.json();
      if (res.ok) onSuccess(data); else setError(data.message || "Gửi yêu cầu thất bại");
    } catch { setError("Không thể kết nối server"); }
    finally { setLoading(false); }
  };

  const totalMB = (files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1);

  return (
    <div className="rounded-2xl border border-purple-500/20 p-5 mb-4" style={{ background: "rgba(191,90,242,0.05)" }}>
      <div className="flex items-center gap-2 mb-4">
        <RotateCcw size={15} className="text-purple-400" />
        <p className="text-sm font-semibold text-purple-300">Yêu cầu trả hàng</p>
        <span className="text-xs text-white/30 ml-auto flex items-center gap-1"><Info size={11} /> Trong vòng 7 ngày</span>
      </div>
      <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
        placeholder="Mô tả lý do trả hàng..."
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500/50 transition resize-none mb-3"
        style={{ color: "white" }} />
      <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition mb-3"
        style={{ borderColor: "rgba(191,90,242,0.3)" }}>
        <Upload size={20} className="mx-auto mb-2 text-purple-400 opacity-70" />
        <p className="text-sm text-white/50">Kéo thả hoặc <span className="text-purple-400">chọn file</span></p>
        <p className="text-xs text-white/25 mt-1">Ảnh và Video · Tối đa 500MB</p>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => addFiles(e.target.files)} />
      </div>
      {files.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-xs text-white/40">{files.length} file · {totalMB}MB / 500MB</p>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
              {f.type.startsWith('video') ? <FileVideo size={13} className="text-purple-400 shrink-0" /> : <Image size={13} className="text-blue-400 shrink-0" />}
              <span className="text-xs text-white/60 flex-1 truncate">{f.name}</span>
              <button onClick={() => setFiles(p => p.filter((_, idx) => idx !== i))} className="text-white/20 hover:text-red-400 transition shrink-0"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
      {error && <div className="flex items-center gap-2 text-red-400 text-xs mb-3 px-3 py-2.5 rounded-xl border border-red-500/20 bg-red-500/8"><AlertCircle size={13} /> {error}</div>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-sm font-medium transition text-white">{loading ? "Đang gửi..." : "Gửi yêu cầu trả hàng"}</button>
        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition text-white">Hủy</button>
      </div>
    </div>
  );
}

function PayMethodLabel({ method }) {
  const map = {
    momo:  { emoji: "💜", label: "Thanh toán qua MoMo",            color: "#d82d8b" },
    vnpay: { emoji: "🏦", label: "Thanh toán qua VNPay",           color: "#005baa" },
    cod:   { emoji: "🚚", label: "Thanh toán khi nhận hàng (COD)", color: "#30d158" },
    bank:  { emoji: "🏧", label: "Chuyển khoản ngân hàng",         color: "#0a84ff" },
  };
  const c = map[method] || map.cod;
  return (
    <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: c.color }}>
      {c.emoji} {c.label}
    </p>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════

export default function Orders({ embedded = false }) {
  const navigate   = useNavigate();
  const user       = getUser() || {};
  const { toast, toasts, removeToast } = useToast();

  const [orders,         setOrders]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [detail,         setDetail]         = useState(null);
  const [returnReq,      setReturnReq]      = useState(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [paidOpened,     setPaidOpened]     = useState(false);
  const [confirmModal,   setConfirmModal]   = useState(null);
  const [showInvoice,    setShowInvoice]    = useState(false);  // [NEW]

  useEffect(() => {
    if (checkAndHandleExpiry("user")) return;
    if (!user.id) { navigate("/login"); return; }
    loadOrders();
  }, []); // eslint-disable-line

  const loadOrders = () => {
    setLoading(true);
    authFetch(`${API}/api/order/list/?customer_id=${user.id}`)
      .then(r => { if (!r || r === AUTH_REDIRECTED) return; return r.json(); })
      .then(d => { if (d) setOrders(d.orders || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadReturnReq = async (orderId) => {
    try {
      const res  = await authFetch(`${API}/api/order/${orderId}/return/`);
      if (!res || res === AUTH_REDIRECTED) return;
      const data = await res.json();
      setReturnReq(data.return || null);
    } catch { setReturnReq(null); }
  };

  const openDetail = (order) => {
    setDetail(order);
    setShowReturnForm(false);
    setPaidOpened(false);
    setShowInvoice(false);
    loadReturnReq(order.id);
  };

  const cancelOrder = (orderId) => {
    setConfirmModal({
      message: "Bạn có chắc muốn hủy đơn hàng này?",
      onConfirm: async () => {
        const res  = await authFetch(`${API}/api/order/cancel/`, { method: "POST", body: JSON.stringify({ order_id: orderId, customer_id: user.id }) });
        if (!res || res === AUTH_REDIRECTED) return;
        const data = await res.json();
        if (res.ok) {
          setOrders(p => p.map(o => o.id === orderId ? { ...o, status: "Cancelled", status_note: "Khách hàng hủy đơn" } : o));
          if (detail?.id === orderId) setDetail(d => ({ ...d, status: "Cancelled", status_note: "Khách hàng hủy đơn" }));
          toast.success("Đã hủy đơn hàng thành công!");
        } else toast.error(data.message);
      },
    });
  };

  // ── CHI TIẾT ────────────────────────────────────────────────
  if (detail) {
    const canReturn = detail.status === "Delivered" && !returnReq && !showReturnForm;

    return (
      <div className={embedded ? "" : "min-h-screen text-white"} style={embedded ? {} : { background: "#1C1C1E" }}>
        {/* [NEW] Invoice modal */}
        {showInvoice && (
          <InvoicePrint order={detail} user={user} onClose={() => setShowInvoice(false)} />
        )}

        {confirmModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmModal(null)} />
            <div className="relative bg-[#161616] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0"><AlertTriangle size={18} className="text-red-400" /></div>
                <h3 className="font-semibold text-white">Xác nhận hủy đơn</h3>
              </div>
              <p className="text-sm text-white/60 mb-6">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10 transition">Không hủy</button>
                <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition">Xác nhận hủy</button>
              </div>
            </div>
          </div>
        )}

        {!embedded && (
          <nav className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-10 py-4 border-b border-white/10"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}>
            <div className="text-xl font-bold cursor-pointer" onClick={() => navigate("/")}>PHONEZONE</div>
            <button onClick={() => { setDetail(null); setReturnReq(null); setShowReturnForm(false); setPaidOpened(false); }}
              className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition">
              <ArrowLeft size={15} /> Danh sách đơn
            </button>
          </nav>
        )}
        {embedded && (
          <button onClick={() => { setDetail(null); setReturnReq(null); setShowReturnForm(false); setPaidOpened(false); }}
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white mb-4 transition">
            <ArrowLeft size={15} /> Danh sách đơn
          </button>
        )}

        <div className={embedded ? "pb-6" : "pt-20 px-6 pb-10 max-w-2xl mx-auto"}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-lg font-bold">Đơn hàng #{detail.id}</h1>
              <p className="text-xs text-white/30 mt-0.5">{new Date(detail.created_at).toLocaleString("vi-VN")}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={detail.status} />
              {/* [NEW] Nút in hóa đơn — hiện khi Delivered */}
              {detail.status === "Delivered" && (
                <button
                  onClick={() => setShowInvoice(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition"
                >
                  <Printer size={13} /> Hóa đơn
                </button>
              )}
            </div>
          </div>

          {paidOpened ? <PaidNotice method={detail.payment_method} /> : <PaymentSection order={detail} onPaid={() => setPaidOpened(true)} />}

          {/* Timeline */}
          <div className="rounded-2xl border border-white/5 p-5 mb-4" style={{ background: "#161616" }}>
            <p className="text-sm font-semibold mb-1">Trạng thái đơn hàng</p>
            <OrderTimeline status={detail.status} />
            {detail.status === "Cancelled" ? (
              <div className="mt-3 rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: "rgba(255,59,48,0.07)", border: "1px solid rgba(255,59,48,0.2)" }}>
                <XCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-red-400">{detail.status_note === "Nhà bán hủy đơn" ? "🏪 Nhà bán đã hủy đơn hàng này" : detail.status_note === "Khách hàng hủy đơn" ? "👤 Bạn đã hủy đơn hàng này" : "Đơn hàng đã bị hủy"}</p>
                  {detail.status_note && !["Nhà bán hủy đơn","Khách hàng hủy đơn"].includes(detail.status_note) && <p className="text-xs text-white/40 mt-0.5 italic">Lý do: {detail.status_note}</p>}
                </div>
              </div>
            ) : detail.status_note ? (
              <p className="text-xs text-white/40 mt-3 rounded-xl px-3 py-2 italic" style={{ background: "rgba(255,255,255,0.04)" }}>💬 {detail.status_note}</p>
            ) : null}
          </div>

          {(detail.estimated_delivery || detail.actual_delivery) && (
            <div className="rounded-2xl border border-white/5 p-4 mb-4 flex items-center gap-3 flex-wrap" style={{ background: "#161616" }}>
              {detail.actual_delivery ? (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:"rgba(52,199,89,0.12)",border:"1px solid rgba(52,199,89,0.25)"}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <p className="text-xs text-white/30">Đã giao lúc</p>
                    <p className="text-sm font-semibold text-green-400">{new Date(detail.actual_delivery).toLocaleString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</p>
                  </div>
                </div>
              ) : detail.estimated_delivery ? (
                <>
                  <div className="flex items-center gap-2 text-sm flex-1">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:"rgba(10,132,255,0.12)",border:"1px solid rgba(10,132,255,0.25)"}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5ac8fa" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div>
                      <p className="text-xs text-white/30">Ngày giao dự kiến</p>
                      <p className="text-sm font-semibold text-blue-300">{new Date(detail.estimated_delivery).toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"})}</p>
                    </div>
                  </div>
                  <CustomerDeliveryCountdown estimated={detail.estimated_delivery} status={detail.status} />
                </>
              ) : null}
            </div>
          )}

          {returnReq && (
            <div className="rounded-2xl border border-purple-500/20 p-5 mb-4" style={{ background: "rgba(191,90,242,0.05)" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-purple-300 flex items-center gap-2"><RotateCcw size={13} /> Yêu cầu trả hàng</p>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ color: RETURN_STATUS_MAP[returnReq.status]?.color, background: (RETURN_STATUS_MAP[returnReq.status]?.color || "#fff") + "22" }}>{RETURN_STATUS_MAP[returnReq.status]?.label || returnReq.status}</span>
              </div>
              <p className="text-xs text-white/50 mb-2">Lý do: {returnReq.reason}</p>
              {returnReq.admin_note && <p className="text-xs text-white/40 bg-white/4 rounded-xl px-3 py-2 italic">💬 Admin: {returnReq.admin_note}</p>}
            </div>
          )}

          <div className="rounded-2xl border border-white/5 p-5 mb-4" style={{ background: "#161616" }}>
            <p className="text-sm font-semibold mb-3 flex items-center gap-2"><MapPin size={13} className="text-orange-400" /> Giao hàng đến</p>
            <p className="text-sm text-white/70">{detail.shipping_address}</p>
            <PayMethodLabel method={detail.payment_method} />
          </div>

          <div className="rounded-2xl border border-white/5 overflow-hidden mb-4" style={{ background: "#161616" }}>
            <p className="text-sm font-semibold px-5 py-4 border-b border-white/5">Sản phẩm ({detail.items?.length || 0})</p>
            {(detail.items || []).map((item, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-white/5 last:border-0">
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/5" style={{ background: "#222" }}>
                  {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain p-1" /> : <Package size={22} className="text-white/10 m-auto mt-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product_name}</p>
                  <p className="text-xs text-white/40 mt-0.5">{[item.color, item.storage, item.ram].filter(Boolean).join(" · ")}</p>
                  <p className="text-xs text-white/30 mt-0.5">Số lượng: {item.quantity}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-white/30">{parseFloat(item.unit_price).toLocaleString("vi-VN")}đ</p>
                  <p className="text-sm text-orange-400 font-bold mt-0.5">{(parseFloat(item.unit_price) * item.quantity).toLocaleString("vi-VN")}đ</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/5 p-5 mb-4" style={{ background: "#161616" }}>
            {detail.subtotal && parseFloat(detail.subtotal) !== parseFloat(detail.total_amount) && (
              <div className="flex justify-between text-sm mb-2 text-white/50"><span>Tạm tính</span><span>{parseFloat(detail.subtotal).toLocaleString("vi-VN")}đ</span></div>
            )}
            {parseFloat(detail.discount || 0) > 0 && (
              <div className="flex justify-between text-sm mb-2"><span className="text-white/50">🏷️ Giảm giá</span><span className="text-green-400">-{parseFloat(detail.discount).toLocaleString("vi-VN")}đ</span></div>
            )}
            <div className="flex justify-between font-bold pt-2 border-t border-white/10">
              <span>Tổng thanh toán</span>
              <span className="text-orange-400 text-base">{parseFloat(detail.total_amount).toLocaleString("vi-VN")}đ</span>
            </div>
          </div>

          {detail.status === "Processing" && (
            <button onClick={() => cancelOrder(detail.id)} className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition mb-3">
              Hủy đơn hàng
            </button>
          )}

          {canReturn && (
            <button onClick={() => setShowReturnForm(true)} className="w-full py-3 rounded-xl border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 text-sm font-medium transition flex items-center justify-center gap-2 mb-3">
              <RotateCcw size={14} /> Yêu cầu trả hàng (trong 7 ngày)
            </button>
          )}

          {/* [NEW] Nút xem hóa đơn ở cuối detail */}
          {detail.status === "Delivered" && (
            <button onClick={() => setShowInvoice(true)} className="w-full py-3 rounded-xl border border-white/10 text-white/50 hover:bg-white/5 hover:text-white text-sm font-medium transition flex items-center justify-center gap-2">
              <FileText size={14} /> Xem & In hóa đơn
            </button>
          )}

          {showReturnForm && (
            <ReturnForm order={detail}
              onSuccess={() => { setShowReturnForm(false); loadReturnReq(detail.id); setDetail(d => ({ ...d, status: "ReturnRequested" })); setOrders(p => p.map(o => o.id === detail.id ? { ...o, status: "ReturnRequested" } : o)); }}
              onCancel={() => setShowReturnForm(false)} />
          )}
        </div>
      </div>
    );
  }

  // ── DANH SÁCH ───────────────────────────────────────────────
  return (
    <div className={embedded ? "" : "min-h-screen text-white"} style={embedded ? {} : { background: "#1C1C1E" }}>
      {!embedded && <ToastContainer toasts={toasts} removeToast={removeToast} />}

      {confirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-[#161616] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0"><AlertTriangle size={18} className="text-red-400" /></div>
              <h3 className="font-semibold text-white">Xác nhận hủy đơn</h3>
            </div>
            <p className="text-sm text-white/60 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10 transition">Không hủy</button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition">Xác nhận hủy</button>
            </div>
          </div>
        </div>
      )}

      {!embedded && (
        <nav className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-10 py-4 border-b border-white/10"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}>
          <div className="text-xl font-bold cursor-pointer" onClick={() => navigate("/")}>PHONEZONE</div>
          <button onClick={() => navigate("/product")} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition">
            <ArrowLeft size={15} /> Tiếp tục mua sắm
          </button>
        </nav>
      )}

      <div className={embedded ? "pb-6" : "pt-20 px-8 pb-10 max-w-3xl mx-auto"}>
        {!embedded && <h1 className="text-xl font-bold mb-6 flex items-center gap-3"><ShoppingBag size={20} className="text-orange-400" /> Đơn hàng của tôi</h1>}

        {loading ? (
          <div className="text-center py-20 text-white/30 text-sm">Đang tải...</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-24 gap-4">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center"><ShoppingBag size={32} className="text-white/15" /></div>
            <p className="text-white/40">Bạn chưa có đơn hàng nào</p>
            <button onClick={() => navigate("/product")} className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition text-white">Mua sắm ngay</button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((order) => {
              const needsPay = ["momo","vnpay"].includes(order.payment_method) && ["Pending","Processing"].includes(order.status);
              return (
                <div key={order.id} className="rounded-2xl border overflow-hidden"
                  style={{ background: "#161616", borderColor: needsPay ? (order.payment_method === "momo" ? "rgba(216,45,139,0.35)" : "rgba(0,91,170,0.35)") : "rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div>
                      <p className="text-sm font-semibold">Đơn #{order.id}</p>
                      <p className="text-xs text-white/30 mt-0.5">{new Date(order.created_at).toLocaleString("vi-VN")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {needsPay && <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1" style={{ color: order.payment_method === "momo" ? "#d82d8b" : "#0077cc", background: order.payment_method === "momo" ? "rgba(216,45,139,0.15)" : "rgba(0,119,204,0.15)" }}><CreditCard size={9} /> Chưa thanh toán</span>}
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                  <div className="px-5 py-3"><OrderTimeline status={order.status} /></div>
                  <div className="px-5 pb-3 flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {(order.items || []).slice(0, 3).map((item, i) => (
                        <div key={i} className="w-9 h-9 rounded-lg border-2 overflow-hidden shrink-0" style={{ background: "#2a2a2a", borderColor: "#161616" }}>
                          {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain" /> : <Package size={14} className="text-white/10 m-auto mt-1" />}
                        </div>
                      ))}
                      {order.items?.length > 3 && <div className="w-9 h-9 rounded-lg border-2 flex items-center justify-center text-[10px] text-white/40" style={{ background: "#2a2a2a", borderColor: "#161616" }}>+{order.items.length - 3}</div>}
                    </div>
                    <span className="text-xs text-white/40">{order.items?.length || 0} sản phẩm</span>
                    <span className="ml-auto text-sm font-bold text-orange-400">{parseFloat(order.total_amount).toLocaleString("vi-VN")}đ</span>
                  </div>
                  <div className="flex gap-2 px-5 pb-4">
                    <button onClick={() => openDetail(order)} className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition" style={{ background: "rgba(255,149,0,0.1)", color: "#ff9500" }}>
                      {needsPay ? "Thanh toán ngay" : "Xem chi tiết"} <ChevronRight size={14} />
                    </button>
                    {order.status === "Processing" && (
                      <button onClick={() => cancelOrder(order.id)} className="px-4 py-2 rounded-xl text-sm text-red-400 border border-red-500/20 hover:bg-red-500/10 transition">Hủy</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}