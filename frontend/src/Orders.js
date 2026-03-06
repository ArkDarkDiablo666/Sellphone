import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Package, ChevronRight, Clock, CheckCircle2,
  Truck, MapPin, XCircle, RefreshCw, ShoppingBag, Check,
  RotateCcw, Upload, X, FileVideo, Image, AlertCircle, Info
} from "lucide-react";

const API = "http://localhost:8000";

const STATUS_MAP = {
  Pending:          { label: "Chờ xác nhận",        color: "#ff9500", bg: "rgba(255,149,0,0.12)",  icon: Clock,        step: 0 },
  Processing:       { label: "Đang xử lý",           color: "#0a84ff", bg: "rgba(10,132,255,0.12)", icon: RefreshCw,    step: 1 },
  Shipping:         { label: "Đang giao hàng",       color: "#30d158", bg: "rgba(48,209,88,0.12)",  icon: Truck,        step: 2 },
  Delivered:        { label: "Đã giao hàng",         color: "#34c759", bg: "rgba(52,199,89,0.12)",  icon: CheckCircle2, step: 3 },
  Cancelled:        { label: "Đã hủy",               color: "#ff3b30", bg: "rgba(255,59,48,0.12)",  icon: XCircle,      step: -1 },
  ReturnRequested:  { label: "Yêu cầu trả hàng",     color: "#bf5af2", bg: "rgba(191,90,242,0.12)", icon: RotateCcw,    step: 3 },
  ReturnApproved:   { label: "Trả hàng được duyệt",  color: "#bf5af2", bg: "rgba(191,90,242,0.12)", icon: RotateCcw,    step: 3 },
  Returning:        { label: "Đang hoàn hàng",       color: "#ff9500", bg: "rgba(255,149,0,0.12)",  icon: Truck,        step: 3 },
  Returned:         { label: "Hoàn tất trả hàng",    color: "#34c759", bg: "rgba(52,199,89,0.12)",  icon: CheckCircle2, step: 3 },
};
const RETURN_STATUS_MAP = {
  Pending:   { label: "Chờ xét duyệt",        color: "#ff9500" },
  Approved:  { label: "Đã chấp nhận",          color: "#34c759" },
  Rejected:  { label: "Đã từ chối",            color: "#ff3b30" },
  Returning: { label: "Đang nhận hàng hoàn về",color: "#0a84ff" },
  Completed: { label: "Hoàn tất",              color: "#34c759" },
};
const STEPS = [
  { key: "Pending",    label: "Chờ xác nhận" },
  { key: "Processing", label: "Đang xử lý"   },
  { key: "Shipping",   label: "Đang giao"    },
  { key: "Delivered",  label: "Đã giao"      },
];

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

// ── Form trả hàng ────────────────────────────────────────────
function ReturnForm({ order, onSuccess, onCancel }) {
  const [reason,    setReason]    = useState("");
  const [files,     setFiles]     = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const fileRef = useRef();

  const MAX_TOTAL = 500 * 1024 * 1024; // 500MB
  const ALLOWED   = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/x-msvideo','video/webm'];

  const addFiles = (newFiles) => {
    const arr     = Array.from(newFiles);
    const invalid = arr.filter(f => !ALLOWED.includes(f.type));
    if (invalid.length) { setError(`File không được hỗ trợ: ${invalid.map(f=>f.name).join(', ')}`); return; }
    const all      = [...files, ...arr];
    const totalSz  = all.reduce((s,f) => s + f.size, 0);
    if (totalSz > MAX_TOTAL) { setError(`Tổng dung lượng vượt 500MB (hiện tại: ${(totalSz/1024/1024).toFixed(1)}MB)`); return; }
    setError("");
    setFiles(all);
  };

  const removeFile = (i) => setFiles(p => p.filter((_, idx) => idx !== i));

  const totalMB  = (files.reduce((s,f) => s+f.size, 0) / 1024 / 1024).toFixed(1);

  const submit = async () => {
    if (!reason.trim()) { setError("Vui lòng nhập lý do trả hàng"); return; }
    if (files.length === 0) { setError("Vui lòng đính kèm ít nhất 1 ảnh hoặc video"); return; }
    setLoading(true); setError("");
    const fd = new FormData();
    fd.append("order_id",    order.id);
    fd.append("customer_id", JSON.parse(localStorage.getItem("user")||"{}").id);
    fd.append("reason",      reason);
    files.forEach(f => fd.append("media", f));
    try {
      const res  = await fetch(`${API}/api/order/return/request/`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) onSuccess(data);
      else        setError(data.message || "Gửi yêu cầu thất bại");
    } catch { setError("Không thể kết nối server"); }
    finally   { setLoading(false); }
  };

  return (
    <div className="rounded-2xl border border-purple-500/20 p-5" style={{ background: "rgba(191,90,242,0.05)" }}>
      <div className="flex items-center gap-2 mb-4">
        <RotateCcw size={15} className="text-purple-400" />
        <p className="text-sm font-semibold text-purple-300">Yêu cầu trả hàng</p>
        <span className="text-xs text-white/30 ml-auto flex items-center gap-1">
          <Info size={11} /> Trong vòng 7 ngày kể từ khi nhận hàng
        </span>
      </div>

      {/* Lý do */}
      <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
        placeholder="Mô tả lý do trả hàng (lỗi sản phẩm, không đúng mô tả, ...)"
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500/50 transition resize-none mb-3" />

      {/* Upload */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition mb-3"
        style={{ borderColor: "rgba(191,90,242,0.3)" }}>
        <Upload size={20} className="mx-auto mb-2 text-purple-400 opacity-70" />
        <p className="text-sm text-white/50">Kéo thả hoặc <span className="text-purple-400">chọn file</span></p>
        <p className="text-xs text-white/25 mt-1">Ảnh (JPG, PNG, WEBP) và Video (MP4, MOV) · Tối đa 500MB</p>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={e => addFiles(e.target.files)} />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-xs text-white/40">
            {files.length} file · {totalMB}MB / 500MB
            <span className="ml-2 inline-block h-1.5 w-24 bg-white/10 rounded-full align-middle overflow-hidden">
              <span className="block h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${Math.min((parseFloat(totalMB)/500)*100, 100)}%` }} />
            </span>
          </p>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
              {f.type.startsWith('video') ? <FileVideo size={13} className="text-purple-400 shrink-0" />
                                           : <Image size={13} className="text-blue-400 shrink-0" />}
              <span className="text-xs text-white/60 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-white/30 shrink-0">{(f.size/1024/1024).toFixed(1)}MB</span>
              <button onClick={() => removeFile(i)} className="text-white/20 hover:text-red-400 transition shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs mb-3 px-3 py-2.5 rounded-xl border border-red-500/20 bg-red-500/8">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={submit} disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-sm font-medium transition">
          {loading ? "Đang gửi..." : "Gửi yêu cầu trả hàng"}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition">
          Hủy
        </button>
      </div>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────
export default function Orders({ embedded = false }) {
  const navigate  = useNavigate();
  const user      = JSON.parse(localStorage.getItem("user") || "{}");
  const [orders,  setOrders]     = useState([]);
  const [loading, setLoading]    = useState(true);
  const [detail,  setDetail]     = useState(null);
  const [returnReq, setReturnReq]= useState(null);   // return request của đơn đang xem
  const [showReturnForm, setShowReturnForm] = useState(false);

  useEffect(() => {
    if (!user.id) { navigate("/login"); return; }
    loadOrders();
  }, []); // eslint-disable-line

  const loadOrders = () => {
    setLoading(true);
    fetch(`${API}/api/order/list/?customer_id=${user.id}`)
      .then(r => r.json()).then(d => setOrders(d.orders || []))
      .catch(() => {}).finally(() => setLoading(false));
  };

  const loadReturnReq = async (orderId) => {
    try {
      const res  = await fetch(`${API}/api/order/${orderId}/return/`);
      const data = await res.json();
      setReturnReq(data.return || null);
    } catch { setReturnReq(null); }
  };

  const openDetail = (order) => {
    setDetail(order);
    setShowReturnForm(false);
    loadReturnReq(order.id);
  };

  const cancelOrder = async (orderId) => {
    if (!window.confirm("Bạn có chắc muốn hủy đơn hàng này?")) return;
    const res = await fetch(`${API}/api/order/cancel/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, customer_id: user.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setOrders(p => p.map(o => o.id === orderId ? { ...o, status: "Cancelled" } : o));
      if (detail?.id === orderId) setDetail(d => ({ ...d, status: "Cancelled" }));
    } else alert(data.message);
  };

  // Kiểm tra có thể yêu cầu trả hàng không
  const canReturn = (order) => {
    if (order.status !== 'Delivered') return false;
    if (returnReq) return false; // đã có rồi
    const created = new Date(order.created_at);
    const now     = new Date();
    const days    = (now - created) / (1000 * 60 * 60 * 24);
    return days <= 7;
  };

  // ── CHI TIẾT ───────────────────────────────────────────────
  if (detail) return (
    <div className={embedded ? "" : "min-h-screen text-white"} style={embedded ? {} : { background: "#1C1C1E" }}>
      {!embedded && (
        <nav className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-10 py-4 border-b border-white/10"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}>
          <div className="text-xl font-bold cursor-pointer" onClick={() => navigate("/")}>PHONEZONE</div>
          <button onClick={() => { setDetail(null); setReturnReq(null); setShowReturnForm(false); }}
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition">
            <ArrowLeft size={15} /> Danh sách đơn
          </button>
        </nav>
      )}
      {embedded && (
        <button onClick={() => { setDetail(null); setReturnReq(null); setShowReturnForm(false); }}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white mb-4 transition">
          <ArrowLeft size={15} /> Danh sách đơn
        </button>
      )}

      <div className={embedded ? "pb-6" : "pt-20 px-6 pb-10 max-w-2xl mx-auto"}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold">Đơn hàng #{detail.id}</h1>
            <p className="text-xs text-white/30 mt-0.5">{new Date(detail.created_at).toLocaleString("vi-VN")}</p>
          </div>
          <StatusBadge status={detail.status} />
        </div>

        {/* Timeline */}
        <div className="rounded-2xl border border-white/5 p-5 mb-4" style={{ background: "#161616" }}>
          <p className="text-sm font-semibold mb-1">Trạng thái đơn hàng</p>
          <OrderTimeline status={detail.status} />
          {detail.status_note && (
            <p className="text-xs text-white/40 mt-3 bg-white/4 rounded-xl px-3 py-2 italic">
              💬 {detail.status_note}
            </p>
          )}
        </div>

        {/* Trả hàng status */}
        {returnReq && (
          <div className="rounded-2xl border border-purple-500/20 p-5 mb-4" style={{ background: "rgba(191,90,242,0.05)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                <RotateCcw size={13} /> Yêu cầu trả hàng
              </p>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ color: RETURN_STATUS_MAP[returnReq.status]?.color, background: (RETURN_STATUS_MAP[returnReq.status]?.color || "#fff") + "22" }}>
                {RETURN_STATUS_MAP[returnReq.status]?.label || returnReq.status}
              </span>
            </div>
            <p className="text-xs text-white/50 mb-2">Lý do: {returnReq.reason}</p>
            {returnReq.admin_note && (
              <p className="text-xs text-white/40 bg-white/4 rounded-xl px-3 py-2 italic">
                💬 Admin: {returnReq.admin_note}
              </p>
            )}
            {/* Media */}
            {returnReq.media?.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {returnReq.media.map((m, i) => (
                  <a key={i} href={m.url} target="_blank" rel="noreferrer"
                    className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
                    {m.type === 'video'
                      ? <FileVideo size={20} className="text-purple-400" />
                      : <img src={m.url} alt="" className="w-full h-full object-cover" />}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Địa chỉ */}
        <div className="rounded-2xl border border-white/5 p-5 mb-4" style={{ background: "#161616" }}>
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <MapPin size={13} className="text-orange-400" /> Giao hàng đến
          </p>
          <p className="text-sm text-white/70">{detail.shipping_address}</p>
          <p className="text-xs text-white/30 mt-2">
            {detail.payment_method === "momo" ? "💜 Thanh toán qua MoMo" : "🚚 Thanh toán khi nhận hàng (COD)"}
          </p>
        </div>

        {/* Sản phẩm */}
        <div className="rounded-2xl border border-white/5 overflow-hidden mb-4" style={{ background: "#161616" }}>
          <p className="text-sm font-semibold px-5 py-4 border-b border-white/5">Sản phẩm ({detail.items?.length || 0})</p>
          {(detail.items || []).map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-white/5 last:border-0">
              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/5" style={{ background: "#222" }}>
                {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain p-1" /> : <Package size={22} className="text-white/10 m-auto mt-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.product_name}</p>
                <p className="text-xs text-white/40 mt-0.5">{[item.color,item.storage,item.ram].filter(Boolean).join(" · ")}</p>
                <p className="text-xs text-white/30 mt-0.5">Số lượng: {item.quantity}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-white/30">{parseFloat(item.unit_price).toLocaleString("vi-VN")}đ</p>
                <p className="text-sm text-orange-400 font-bold mt-0.5">{(parseFloat(item.unit_price)*item.quantity).toLocaleString("vi-VN")}đ</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tổng */}
        <div className="rounded-2xl border border-white/5 p-5 mb-4" style={{ background: "#161616" }}>
          {detail.subtotal && parseFloat(detail.subtotal) !== parseFloat(detail.total_amount) && (
            <div className="flex justify-between text-sm mb-2 text-white/50"><span>Tạm tính</span><span>{parseFloat(detail.subtotal).toLocaleString("vi-VN")}đ</span></div>
          )}
          {parseFloat(detail.discount) > 0 && (
            <div className="flex justify-between text-sm mb-2"><span className="text-white/50">Giảm giá</span><span className="text-green-400">-{parseFloat(detail.discount).toLocaleString("vi-VN")}đ</span></div>
          )}
          <div className="flex justify-between font-bold pt-2 border-t border-white/10">
            <span>Tổng thanh toán</span>
            <span className="text-orange-400 text-base">{parseFloat(detail.total_amount).toLocaleString("vi-VN")}đ</span>
          </div>
        </div>

        {/* Hủy đơn (Processing) */}
        {['Processing'].includes(detail.status) && (
          <button onClick={() => cancelOrder(detail.id)}
            className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition mb-3">
            Hủy đơn hàng
          </button>
        )}

        {/* Form trả hàng */}
        {detail.status === 'Delivered' && !returnReq && !showReturnForm && (
          <button onClick={() => setShowReturnForm(true)}
            className="w-full py-3 rounded-xl border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 text-sm font-medium transition flex items-center justify-center gap-2">
            <RotateCcw size={14} /> Yêu cầu trả hàng (trong 7 ngày)
          </button>
        )}
        {showReturnForm && (
          <ReturnForm
            order={detail}
            onSuccess={(data) => {
              setShowReturnForm(false);
              loadReturnReq(detail.id);
              setDetail(d => ({ ...d, status: 'ReturnRequested' }));
              setOrders(p => p.map(o => o.id === detail.id ? { ...o, status: 'ReturnRequested' } : o));
            }}
            onCancel={() => setShowReturnForm(false)}
          />
        )}
      </div>
    </div>
  );

  // ── DANH SÁCH ──────────────────────────────────────────────
  return (
    <div className={embedded ? "" : "min-h-screen text-white"} style={embedded ? {} : { background: "#1C1C1E" }}>
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
        {!embedded && <h1 className="text-xl font-bold mb-6 flex items-center gap-3">
          <ShoppingBag size={20} className="text-orange-400" /> Đơn hàng của tôi
        </h1>}
        {loading ? (
          <div className="text-center py-20 text-white/30 text-sm">Đang tải...</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-24 gap-4">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center"><ShoppingBag size={32} className="text-white/15" /></div>
            <p className="text-white/40">Bạn chưa có đơn hàng nào</p>
            <button onClick={() => navigate("/product")} className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition">Mua sắm ngay</button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#161616" }}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <div>
                    <p className="text-sm font-semibold">Đơn #{order.id}</p>
                    <p className="text-xs text-white/30 mt-0.5">{new Date(order.created_at).toLocaleString("vi-VN")}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="px-5 py-3"><OrderTimeline status={order.status} /></div>
                <div className="px-5 pb-3 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {(order.items || []).slice(0, 3).map((item, i) => (
                      <div key={i} className="w-9 h-9 rounded-lg border-2 overflow-hidden shrink-0" style={{ background: "#2a2a2a", borderColor: "#161616" }}>
                        {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain" /> : <Package size={14} className="text-white/10 m-auto mt-1" />}
                      </div>
                    ))}
                    {order.items?.length > 3 && (
                      <div className="w-9 h-9 rounded-lg border-2 flex items-center justify-center text-[10px] text-white/40" style={{ background: "#2a2a2a", borderColor: "#161616" }}>
                        +{order.items.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-white/40">{order.items?.length || 0} sản phẩm</span>
                  <span className="ml-auto text-sm font-bold text-orange-400">{parseFloat(order.total_amount).toLocaleString("vi-VN")}đ</span>
                </div>
                <div className="flex gap-2 px-5 pb-4">
                  <button onClick={() => openDetail(order)}
                    className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition"
                    style={{ background: "rgba(255,149,0,0.1)", color: "#ff9500" }}>
                    Xem chi tiết <ChevronRight size={14} />
                  </button>
                  {order.status === "Processing" && (
                    <button onClick={() => cancelOrder(order.id)}
                      className="px-4 py-2 rounded-xl text-sm text-red-400 border border-red-500/20 hover:bg-red-500/10 transition">
                      Hủy
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}