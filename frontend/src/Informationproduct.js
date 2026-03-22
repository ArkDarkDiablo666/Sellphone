import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import "./animations.css";
import { BlockRenderer } from "./Blockeditor";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCart } from "./Cart";
import {
  User, LogOut, Settings, ShoppingCart, ChevronDown,
  AlertTriangle, ShoppingBag, ChevronLeft, ChevronRight, Package,
  Shield, Truck, RotateCcw, ZapIcon, Star, Heart, MessageCircle,
  Send, Image as ImageIcon, X, ChevronUp, Edit2, CornerDownRight,
  Camera, Loader2, Search, GitCompare, Plus, Check, Tag, FileVideo, Gift
} from "lucide-react";
import { SearchModal } from "./Searchbar";
import Footer from "./Footer";
import { ToastContainer, useToast } from "./Toast";
import { isLoggedIn, clearSession, authFetch, getAuthHeadersFormData, AUTH_REDIRECTED } from "./authUtils";
import ProductImageSlider from "./ProductImageSlider";

import { API } from "./config";

// ═══════════════════════════════════════════════════════
// COMPONENT: Card sản phẩm gợi ý — ảnh auto-slide như Product.js
// ═══════════════════════════════════════════════════════
function SuggestedProductCard({ p, onNavigate, onAddCart, onCompare, compareList, extraButton }) {
  const variants    = p.variants || [];
  const variantImgs = (() => {
    const imgs = [];
    // Ưu tiên variant rẻ nhất trước
    const sorted = [...variants].sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0));
    sorted.forEach(v => { if (v.image && !imgs.includes(v.image)) imgs.push(v.image); });
    return imgs;
  })();

  const [slideIdx, setSlideIdx] = useState(0);
  const [fading,   setFading]   = useState(false);
  const slideRef = useRef(null);

  // Auto-slide mỗi 2.5s
  useEffect(() => {
    clearInterval(slideRef.current);
    if (variantImgs.length <= 1) return;
    slideRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setSlideIdx(i => (i + 1) % variantImgs.length);
        setFading(false);
      }, 150);
    }, 2500);
    return () => clearInterval(slideRef.current);
  }, [variantImgs.length]);

  const currentImg = variantImgs.length > 0 ? variantImgs[slideIdx % variantImgs.length] : (p.image || null);

  const dv       = variants.length > 0
    ? [...activeVars].sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0))[0]
    : null;
  const activeVars = variants.filter(v => v.is_active !== false);
  const rColors  = [...new Set(activeVars.map(v => v.color).filter(Boolean))];
  const rCombo   = dv ? [dv.ram, dv.storage].filter(Boolean).join(" · ") : null;

  return (
    <article
      onClick={() => onNavigate(p.id)}
      className="flex flex-col rounded-2xl overflow-hidden cursor-pointer hover:-translate-y-1 transition-all duration-300
        shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
        hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.60),inset_1px_0_0_rgba(255,255,255,0.48),0_8px_32px_rgba(0,0,0,0.4)]"
    >
      {/* ── Ảnh ── */}
      <div className="w-full h-36 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center overflow-hidden relative">
        {currentImg
          ? <img
              key={currentImg}
              src={currentImg}
              alt={p.name}
              className="w-full h-full object-contain p-2 transition-opacity duration-300"
              style={{ opacity: fading ? 0 : 1 }}
              draggable={false}
            />
          : <Package size={28} className="text-white/10" />}

        {/* Dots */}
        {variantImgs.length > 1 && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {variantImgs.map((_, i) => (
              <span key={i} className={`rounded-full transition-all
                ${i === slideIdx % variantImgs.length ? "w-3 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30"}`} />
            ))}
          </div>
        )}

        {/* Badge số màu */}
        {variantImgs.length > 1 && (
          <div className="absolute top-1.5 right-1.5 bg-black/50 text-white/60 text-[8px] px-1.5 py-0.5 rounded-full pointer-events-none">
            {variantImgs.length} màu
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div className="flex flex-col gap-1.5 p-2.5">
        <h3 className="font-semibold text-xs leading-snug line-clamp-2 hover:text-orange-400 transition">{p.name}</h3>
        {rCombo && (
          <span className="inline-block px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[9px] font-semibold text-white/50 w-fit">
            {rCombo}
          </span>
        )}
        {rColors.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {rColors.map(col => {
              const hasStock = activeVars.some(v => v.color === col && (v.stock ?? 1) > 0);
              return (
                <span key={col}
                  className={`px-1.5 py-0.5 rounded text-[9px] border font-medium
                    ${!hasStock ? "bg-white/[0.02] border-white/5 text-white/20 line-through" : "bg-white/5 border-white/10 text-white/50"}`}>
                  {col}
                </span>
              );
            })}
          </div>
        )}
        <div className="h-5 flex items-center">
          {p.rating_avg > 0 && (
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(n => (
                <svg key={n} width="9" height="9" viewBox="0 0 24 24"
                  fill={n <= Math.round(p.rating_avg) ? "#f59e0b" : "none"}
                  stroke="#f59e0b" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
              <span className="text-[9px] text-white/30 ml-0.5">({p.rating_count})</span>
            </div>
          )}
        </div>
        <div className="flex items-end justify-between mt-auto pt-1 gap-1">
          <div className="min-w-0">
            <p className="font-bold text-sm text-[#ff3b30] leading-tight truncate">
              {p.min_price ? parseFloat(p.min_price).toLocaleString("vi-VN") + "đ" : "Liên hệ"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0 mt-auto">
            {extraButton && extraButton(p, dv)}
            {onAddCart && (
              <button
                onClick={e => { e.stopPropagation(); if (dv) onAddCart(p, dv); }}
                className="shrink-0 h-7 w-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition focus:outline-none">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); onNavigate(p.id); }}
              className="shrink-0 h-7 px-2.5 rounded-full text-white text-[10px] font-medium bg-orange-500 hover:bg-orange-600 transition focus:outline-none">
              Mua
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

const applyVoucherDiscount = (price, voucher) => {
  if (!price || !voucher) return price;
  let disc = 0;
  if (voucher.type === "percent") disc = Math.round(price * Math.min(voucher.value, 100) / 100);
  if (voucher.type === "fixed")   disc = voucher.value;
  if (voucher.max_discount && disc > voucher.max_discount) disc = voucher.max_discount;
  return Math.max(0, price - disc);
};

const parseGB = (s) => {
  if (!s) return 0;
  const m = String(s).match(/([\d.]+)\s*(TB|GB|MB)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = (m[2] || "GB").toUpperCase();
  if (u === "TB") return n * 1024;
  if (u === "MB") return n / 1024;
  return n;
};

const voucherAppliesToVariant = (voucher, product, variant) => {
  if (!voucher) return false;
  const scope = voucher.scope || "all";
  if (scope === "all") return true;
  if (scope === "category") {
    return String(product?.category_id) === String(voucher.category_id);
  }
  if (scope === "product") {
    if (String(product?.id) !== String(voucher.product_id)) return false;
    if (voucher.variant_id) {
      return variant && String(variant.id) === String(voucher.variant_id);
    }
    return true;
  }
  return false;
};

// ═══════════════════════════════════════════════════════
//  REVIEW & COMMENT SECTION  (rewritten)
// ═══════════════════════════════════════════════════════

const STAR_LABELS = ["", "Rất tệ", "Tệ", "Bình thường", "Tốt", "Xuất sắc"];
const STAR_COLORS = ["", "text-red-400", "text-orange-400", "text-yellow-400", "text-lime-400", "text-green-400"];
const MAX_MEDIA_MB = 100;

function StarRow({ value, onChange, size = 28, readonly = false }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button"
          onClick={() => !readonly && onChange?.(n)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`transition-transform ${!readonly && "hover:scale-110 cursor-pointer"}`}
          style={{ background:"none", border:"none", padding:0 }}>
          <Star size={size} fill={n<=active?"#f59e0b":"none"} stroke={n<=active?"#f59e0b":"#ffffff30"} strokeWidth={1.5}/>
        </button>
      ))}
    </div>
  );
}

// ── Badge "Đã mua" ──
function PurchasedBadge({ info }) {
  if (!info) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
      style={{ background:"rgba(52,199,89,0.12)", color:"#30d158", border:"1px solid rgba(52,199,89,0.25)" }}>
      ✓ Đã mua · {info}
    </span>
  );
}

// ── MediaThumb ──
function MediaThumb({ url, type, onRemove }) {
  const isVideo = type === "video";
  return (
    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-white/5 group shrink-0">
      {isVideo
        ? <video src={url} className="w-full h-full object-cover" muted/>
        : <img src={url} alt="" className="w-full h-full object-cover"/>}
      {onRemove && (
        <button onClick={onRemove}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition focus:outline-none">
          <X size={10} className="text-white"/>
        </button>
      )}
      {isVideo   && <div className="absolute bottom-0.5 left-0.5 bg-black/60 rounded text-[7px] text-white px-1">VID</div>}
      {type==="gif" && <div className="absolute bottom-0.5 left-0.5 bg-purple-500/70 rounded text-[7px] text-white px-1">GIF</div>}
    </div>
  );
}

// ── Media hiển thị (click để xem lớn) ──
function MediaRow({ items }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {items.map((m, i) => {
        const isVideo = m.type === "video";
        return (
          <a key={i} href={m.url} target="_blank" rel="noreferrer"
            className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center hover:border-orange-500/30 transition">
            {isVideo
              ? <><video src={m.url} className="w-full h-full object-cover" muted/><div className="absolute inset-0 flex items-center justify-center bg-black/30"><FileVideo size={14} className="text-white/70"/></div></>
              : <img src={m.url} alt="" className="w-full h-full object-cover"/>}
            {m.type==="gif" && <div className="absolute bottom-0.5 left-0.5 bg-purple-500/70 rounded text-[7px] text-white px-0.5">GIF</div>}
          </a>
        );
      })}
    </div>
  );
}

// ── Upload buttons tách loại + upload từng file 1 ──
function MediaUploadButtons({ items, onAdd, onRemove, customerId, maxItems=5, uploading, setUploading, setError }) {
  const imgRef = useRef(); const vidRef = useRef(); const gifRef = useRef();

  const uploadFile = async (file, mediaType) => {
    if (file.size > MAX_MEDIA_MB * 1024 * 1024) {
      setError(`${mediaType==="gif"?"GIF":mediaType==="video"?"Video":"Ảnh"} không được vượt quá ${MAX_MEDIA_MB}MB`);
      return;
    }
    setUploading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("customer_id", customerId);
      const res = await authFetch(`${API}/api/review/upload-media/`, { method:"POST", body:fd });
      if (!res || res === AUTH_REDIRECTED) return;
      const data = await res.json();
      if (data.ok) onAdd({ url:data.url, type:data.media_type });
      else setError(data.error || "Lỗi upload");
    } catch { setError("Không thể kết nối server"); }
    finally { setUploading(false); }
  };

  // Upload tuần tự từng file để tránh lỗi
  const handleFiles = (files, mediaType) =>
    Array.from(files).reduce((p, f) => p.then(() => uploadFile(f, mediaType)), Promise.resolve());

  const canAdd = items.length < maxItems;
  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((m, i) => <MediaThumb key={i} url={m.url} type={m.type} onRemove={() => onRemove(i)}/>)}
        </div>
      )}
      {canAdd && (
        <div className="flex gap-2 flex-wrap items-center">
          <button type="button" onClick={() => imgRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white/50 hover:text-white transition disabled:opacity-40 focus:outline-none">
            <ImageIcon size={12}/> Ảnh
          </button>
          <button type="button" onClick={() => vidRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white/50 hover:text-white transition disabled:opacity-40 focus:outline-none">
            <FileVideo size={12}/> Video
          </button>
          <button type="button" onClick={() => gifRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white/50 hover:text-white transition disabled:opacity-40 focus:outline-none">
            <Gift size={12}/> GIF
          </button>
          {uploading && <span className="flex items-center gap-1 text-[10px] text-white/30"><Loader2 size={10} className="animate-spin"/> Đang tải...</span>}
        </div>
      )}
      <p className="text-[10px] text-white/20">Mỗi file ≤ {MAX_MEDIA_MB}MB · Tối đa {maxItems} file</p>
      <input ref={imgRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple className="hidden" onChange={e=>{handleFiles(e.target.files,"image");e.target.value="";}}/>
      <input ref={vidRef} type="file" accept="video/mp4,video/webm,video/quicktime" multiple className="hidden" onChange={e=>{handleFiles(e.target.files,"video");e.target.value="";}}/>
      <input ref={gifRef} type="file" accept="image/gif" multiple className="hidden" onChange={e=>{handleFiles(e.target.files,"gif");e.target.value="";}}/>
    </div>
  );
}

// ── WriteReviewModal ──
function WriteReviewModal({ productId, user, onClose, onSubmit, existing }) {
  const [rating,   setRating]   = useState(existing?.rating || 0);
  const [content,  setContent]  = useState(existing?.content || "");
  const [media,    setMedia]    = useState(existing?.media || []);
  const [uploading,setUploading]= useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async () => {
    if (!rating) return setError("Vui lòng chọn số sao");
    if (uploading) return setError("Vui lòng chờ upload xong");
    setSaving(true); setError("");
    try {
      const body = { customer_id:user.id, product_id:productId, rating, content, media };
      const endpoint = existing ? `${API}/api/review/update/` : `${API}/api/review/create/`;
      if (existing) body.review_id = existing.id;
      const res = await authFetch(endpoint, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      if (!res || res === AUTH_REDIRECTED) return;
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Lỗi");
      onSubmit(data.review);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">{existing?"Chỉnh sửa đánh giá":"Viết đánh giá"}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 focus:outline-none"><X size={16}/></button>
        </div>
        <div className="flex flex-col items-center gap-2">
          <StarRow value={rating} onChange={setRating} size={36}/>
          {rating>0 && <span className={`text-sm font-medium ${STAR_COLORS[rating]}`}>{STAR_LABELS[rating]}</span>}
        </div>
        <textarea value={content} onChange={e=>setContent(e.target.value)}
          placeholder="Chia sẻ trải nghiệm của bạn..." rows={4}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-orange-500/50 transition"/>
        <MediaUploadButtons
          items={media} onAdd={m=>setMedia(p=>[...p,m])} onRemove={i=>setMedia(p=>p.filter((_,idx)=>idx!==i))}
          customerId={user.id} maxItems={5} uploading={uploading} setUploading={setUploading} setError={setError}/>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition focus:outline-none">Hủy</button>
          <button onClick={handleSubmit} disabled={saving||uploading||!rating}
            className="px-6 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-medium transition flex items-center gap-2 focus:outline-none">
            {saving && <Loader2 size={14} className="animate-spin"/>}
            {existing?"Cập nhật":"Gửi đánh giá"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ReviewCard ──
function ReviewCard({ review, user, onLike }) {
  return (
    <div className="flex flex-col gap-3 py-5 border-b border-white/5 last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-xs font-bold shrink-0">
          {review.customer_avatar
            ? <img src={review.customer_avatar} className="w-full h-full object-cover rounded-full" alt=""/>
            : (review.customer_name?.[0]||"U").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{review.customer_name}</span>
            {review.has_purchased && <PurchasedBadge info={review.purchased_info}/>}
            {review.variant && !review.has_purchased && (
              <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{review.variant}</span>
            )}
            <span className="text-xs text-white/20 ml-auto">{new Date(review.created_at).toLocaleDateString("vi-VN")}</span>
          </div>
          <div className="mt-1"><StarRow value={review.rating} readonly size={14}/></div>
          {review.content && <p className="mt-2 text-sm text-white/80 leading-relaxed">{review.content}</p>}
          <MediaRow items={review.media}/>
        </div>
      </div>
      {/* Admin reply */}
      {review.admin_reply && (
        <div className="ml-12 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex gap-2.5">
          <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-white">PZ</span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-orange-400">PHONEZONE</span>
            <p className="text-sm text-white/70 mt-0.5 leading-relaxed">{review.admin_reply.content}</p>
            <MediaRow items={review.admin_reply.media}/>
          </div>
        </div>
      )}
      <div className="flex items-center gap-4 pl-12">
        <button onClick={()=>onLike("review",review.id)}
          className={`flex items-center gap-1.5 text-xs transition ${review.liked?"text-red-400":"text-white/30 hover:text-red-400"}`}>
          <Heart size={13} fill={review.liked?"currentColor":"none"}/>
          {review.likes>0 && review.likes}
          <span>Thích</span>
        </button>
      </div>
    </div>
  );
}

// ── CommentInputBox: dùng cho comment mới, reply, và edit ──
function CommentInputBox({ user, placeholder, defaultContent="", defaultMedia=[], onSubmit, onCancel, submitLabel="Gửi", customerId }) {
  const [text,      setText]      = useState(defaultContent);
  const [media,     setMedia]     = useState(defaultMedia);
  const [uploading, setUploading] = useState(false);
  const [submitting,setSubmitting]= useState(false);
  const [error,     setError]     = useState("");

  const handleSubmit = async () => {
    if (!text.trim()) return;
    if (uploading) return setError("Vui lòng chờ upload xong");
    setSubmitting(true); setError("");
    try {
      await onSubmit(text.trim(), media);
      setText(""); setMedia([]);
    } catch(e) { setError(e.message || "Lỗi"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <textarea value={text} onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey&&!e.ctrlKey){ e.preventDefault(); handleSubmit(); } }}
          placeholder={placeholder} rows={2}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-orange-500/40 transition"/>
        <button onClick={handleSubmit} disabled={submitting||uploading||!text.trim()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition shrink-0 focus:outline-none mt-0.5">
          {submitting ? <Loader2 size={14} className="animate-spin text-white"/> : <Send size={14} className="text-white"/>}
        </button>
      </div>
      <MediaUploadButtons
        items={media} onAdd={m=>setMedia(p=>[...p,m])} onRemove={i=>setMedia(p=>p.filter((_,idx)=>idx!==i))}
        customerId={customerId} maxItems={4} uploading={uploading} setUploading={setUploading} setError={setError}/>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {onCancel && (
        <button onClick={onCancel} className="text-xs text-white/30 hover:text-white/60 transition w-fit">Hủy</button>
      )}
    </div>
  );
}

// ── CommentCard ──
function CommentCard({ comment, user, onLike, onUpdate, onDelete, depth=0 }) {
  const [replyOpen,  setReplyOpen]  = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [replies,    setReplies]    = useState(comment.replies || []);
  const isOwn = user && String(user.id) === String(comment.customer_id);
  const maxDepth = 4; // tối đa 4 cấp lồng

  const submitReply = async (text, media) => {
    const res = await authFetch(`${API}/api/comment/create/`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ customer_id:user.id, product_id:comment.product_id, content:text, parent_id:comment.id, media })
    });
    if (!res || res === AUTH_REDIRECTED) return;
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Lỗi");
    setReplies(p => [...p, data.comment]);
    setReplyOpen(false);
  };

  const submitEdit = async (text, media) => {
    const res = await authFetch(`${API}/api/comment/update/`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ comment_id:comment.id, customer_id:user.id, content:text, media })
    });
    if (!res || res === AUTH_REDIRECTED) return;
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Lỗi");
    onUpdate?.(data.comment);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm("Xóa bình luận này?")) return;
    const res = await authFetch(`${API}/api/comment/delete/`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ comment_id:comment.id, customer_id:user.id })
    });
    if (!res || res === AUTH_REDIRECTED) return;
    const data = await res.json();
    if (data.ok) onDelete?.(comment.id);
  };

  // Media của comment — parse từ string nếu cần
  const commentMedia = (() => {
    if (!comment.media) return [];
    if (Array.isArray(comment.media)) return comment.media;
    try { return JSON.parse(comment.media); } catch { return []; }
  })();

  return (
    <div className={depth>0 ? "pl-8 border-l-2 border-white/[0.06] ml-3 mt-1" : ""}>
      <div className="flex gap-3 py-3">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 overflow-hidden">
          {comment.customer_avatar
            ? <img src={comment.customer_avatar} className="w-full h-full object-cover" alt=""/>
            : (comment.customer_name?.[0]||"U").toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium">{comment.customer_name}</span>
            {comment.has_purchased && <PurchasedBadge info={comment.purchased_info}/>}
            <span className="text-xs text-white/20">{new Date(comment.created_at).toLocaleDateString("vi-VN")}</span>
            {comment.updated_at !== comment.created_at && (
              <span className="text-[10px] text-white/15 italic">(đã chỉnh sửa)</span>
            )}
          </div>

          {/* Nội dung hoặc form sửa */}
          {editing ? (
            <CommentInputBox
              user={user} placeholder="Chỉnh sửa bình luận..."
              defaultContent={comment.content} defaultMedia={commentMedia}
              onSubmit={submitEdit} onCancel={()=>setEditing(false)}
              submitLabel="Lưu" customerId={user?.id}/>
          ) : (
            <>
              <p className="text-sm text-white/75 leading-relaxed">{comment.content}</p>
              <MediaRow items={commentMedia}/>
            </>
          )}

          {/* Admin reply */}
          {!editing && comment.admin_reply && (
            <div className="mt-2 bg-orange-500/10 border border-orange-500/20 rounded-xl p-2.5 flex gap-2">
              <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                <span className="text-[8px] font-bold text-white">PZ</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-orange-400">PHONEZONE</span>
                <p className="text-xs text-white/70 mt-0.5 leading-relaxed">{comment.admin_reply.content}</p>
                <MediaRow items={comment.admin_reply.media}/>
              </div>
            </div>
          )}

          {/* Actions */}
          {!editing && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <button onClick={()=>onLike("comment",comment.id)}
                className={`flex items-center gap-1 text-xs transition ${comment.liked?"text-red-400":"text-white/30 hover:text-red-400"}`}>
                <Heart size={12} fill={comment.liked?"currentColor":"none"}/>
                {comment.likes>0 && <span>{comment.likes}</span>}
                <span>Thích</span>
              </button>
              {user && depth < maxDepth && (
                <button onClick={()=>setReplyOpen(r=>!r)}
                  className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition">
                  <CornerDownRight size={12}/>
                  Trả lời
                </button>
              )}
              {isOwn && (
                <>
                  <button onClick={()=>setEditing(true)}
                    className="flex items-center gap-1 text-xs text-white/25 hover:text-orange-400 transition">
                    <Edit2 size={11}/> Sửa
                  </button>
                  <button onClick={handleDelete}
                    className="flex items-center gap-1 text-xs text-white/25 hover:text-red-400 transition">
                    <X size={11}/> Xóa
                  </button>
                </>
              )}
            </div>
          )}

          {/* Reply box */}
          {replyOpen && !editing && (
            <div className="mt-2">
              <CommentInputBox
                user={user} placeholder={`Trả lời ${comment.customer_name}...`}
                onSubmit={submitReply} onCancel={()=>setReplyOpen(false)}
                customerId={user?.id}/>
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {replies.map(r => (
        <CommentCard
          key={r.id}
          comment={{...r, product_id:comment.product_id}}
          user={user} onLike={onLike} depth={depth+1}
          onUpdate={updated => setReplies(p => p.map(x => x.id===updated.id ? updated : x))}
          onDelete={id => setReplies(p => p.filter(x => x.id!==id))}
        />
      ))}
    </div>
  );
}

function ReviewCommentSection({ productId, user, navigate }) {
  const [reviews,          setReviews]          = useState([]);
  const [comments,         setComments]          = useState([]);
  const [stats,            setStats]             = useState(null);
  const [loading,          setLoading]           = useState(true);
  const [showWriteModal,   setShowWriteModal]     = useState(false);
  const [editingReview,    setEditingReview]      = useState(null);
  const [activeSection,    setActiveSection]      = useState("reviews");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, cRes] = await Promise.all([
        fetch(`${API}/api/review/list/?product_id=${productId}${user?`&customer_id=${user.id}`:""}`),
        fetch(`${API}/api/comment/list/?product_id=${productId}${user?`&customer_id=${user.id}`:""}`),
      ]);
      const [rData, cData] = await Promise.all([rRes.json(), cRes.json()]);
      setReviews(rData.reviews || []);
      setStats(rData.stats || null);
      setComments(cData.comments || []);
    } finally { setLoading(false); }
  }, [productId, user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLike = async (type, id) => {
    if (!user) return navigate("/login");
    const res = await authFetch(`${API}/api/like/toggle/`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ customer_id:user.id, type, target_id:id })
    });
    if (!res || res === AUTH_REDIRECTED) return;
    const data = await res.json();
    if (data.ok) {
      if (type==="review") setReviews(prev => prev.map(r => r.id===id ? {...r, liked:data.liked, likes:data.count} : r));
      else setComments(prev => prev.map(c => c.id===id ? {...c, liked:data.liked, likes:data.count} : c));
    }
  };

  const handleReviewSubmit = (review) => {
    setReviews(prev => {
      const exists = prev.find(r => r.id===review.id);
      return exists ? prev.map(r => r.id===review.id ? review : r) : [review, ...prev];
    });
    setShowWriteModal(false); setEditingReview(null); fetchData();
  };

  // Submit comment mới (top-level)
  const submitNewComment = async (text, media) => {
    if (!user) { navigate("/login"); return; }
    const res = await authFetch(`${API}/api/comment/create/`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ customer_id:user.id, product_id:productId, content:text, media })
    });
    if (!res || res === AUTH_REDIRECTED) return;
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Lỗi");
    setComments(p => [data.comment, ...p]);
  };

  const userReview  = user ? reviews.find(r => String(r.customer_id)===String(user.id)) : null;
  const avgRating   = stats?.average || 0;
  const dist        = stats?.distribution || {};
  const totalReviews = stats?.total || 0;

  return (
    <div className="w-full">
      {/* Rating summary */}
      {totalReviews > 0 && (
        <div className="flex items-center gap-8 p-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl mb-6">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="text-5xl font-bold text-amber-400">{avgRating.toFixed(1)}</span>
            <StarRow value={Math.round(avgRating)} readonly size={16}/>
            <span className="text-xs text-white/30 mt-0.5">{totalReviews} đánh giá</span>
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            {[5,4,3,2,1].map(n => {
              const count = dist[n] || 0;
              const pct = totalReviews > 0 ? Math.round(count/totalReviews*100) : 0;
              return (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-white/40 text-right">{n}</span>
                  <Star size={10} fill="#f59e0b" stroke="#f59e0b"/>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all" style={{width:`${pct}%`}}/>
                  </div>
                  <span className="w-6 text-white/30">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 mb-5">
        {[
          {key:"reviews",  label:`Đánh giá${totalReviews>0?` (${totalReviews})`:""}`},
          {key:"comments", label:`Bình luận${comments.length>0?` (${comments.length})`:""}`},
        ].map(({key,label}) => (
          <button key={key} onClick={()=>setActiveSection(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition
              ${activeSection===key?"text-orange-400 border-orange-500":"text-white/30 border-transparent hover:text-white/60"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── REVIEWS ── */}
      {activeSection==="reviews" && (
        <div>
          {!userReview && user && (
            <button onClick={()=>setShowWriteModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 mb-5 rounded-xl border border-dashed border-orange-500/40 hover:border-orange-500 hover:bg-orange-500/5 text-orange-400 text-sm font-medium transition">
              <Star size={16}/> Viết đánh giá của bạn
            </button>
          )}
          {!user && (
            <button onClick={()=>navigate("/login")}
              className="w-full flex items-center justify-center gap-2 py-3 mb-5 rounded-xl border border-dashed border-white/10 hover:border-white/20 text-white/30 text-sm transition">
              Đăng nhập để đánh giá
            </button>
          )}
          {userReview && (
            <div className="mb-4 border border-orange-500/20 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-orange-500/10">
                <span className="text-xs text-orange-400 font-medium">Đánh giá của bạn</span>
                <button onClick={()=>{setEditingReview(userReview);setShowWriteModal(true);}}
                  className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition">
                  <Edit2 size={11}/> Chỉnh sửa
                </button>
              </div>
              <div className="px-4">
                <ReviewCard review={userReview} user={user} onLike={handleLike}/>
              </div>
            </div>
          )}
          {loading
            ? <div className="flex items-center justify-center py-10"><Loader2 size={24} className="animate-spin text-white/20"/></div>
            : reviews.filter(r=>!user||String(r.customer_id)!==String(user?.id)).length===0
              ? <div className="flex flex-col items-center py-12 text-white/20 gap-3"><Star size={40} strokeWidth={1}/><p className="text-sm">Chưa có đánh giá nào</p></div>
              : reviews.filter(r=>!user||String(r.customer_id)!==String(user?.id)).map(r=><ReviewCard key={r.id} review={r} user={user} onLike={handleLike}/>)
          }
        </div>
      )}

      {/* ── COMMENTS ── */}
      {activeSection==="comments" && (
        <div>
          {/* Input bình luận mới */}
          <div className="flex gap-3 mb-5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0 mt-1 overflow-hidden">
              {user?.avatar
                ? <img src={user.avatar} className="w-full h-full object-cover" alt=""/>
                : (user?.full_name?.[0]||<User size={14}/>)}
            </div>
            <div className="flex-1">
              {user ? (
                <CommentInputBox
                  user={user} placeholder="Viết bình luận..."
                  onSubmit={submitNewComment} customerId={user.id}/>
              ) : (
                <button onClick={()=>navigate("/login")}
                  className="w-full text-left bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/30 hover:border-white/20 transition">
                  Đăng nhập để bình luận...
                </button>
              )}
            </div>
          </div>

          {loading
            ? <div className="flex items-center justify-center py-10"><Loader2 size={24} className="animate-spin text-white/20"/></div>
            : comments.length===0
              ? <div className="flex flex-col items-center py-12 text-white/20 gap-3"><MessageCircle size={40} strokeWidth={1}/><p className="text-sm">Chưa có bình luận nào</p></div>
              : comments.map(c => (
                  <CommentCard
                    key={c.id}
                    comment={{...c, product_id:productId}}
                    user={user} onLike={handleLike} depth={0}
                    onUpdate={updated => setComments(p => p.map(x => x.id===updated.id ? updated : x))}
                    onDelete={id => setComments(p => p.filter(x => x.id!==id))}
                  />
                ))
          }
        </div>
      )}

      {showWriteModal && (
        <WriteReviewModal
          productId={productId} user={user} existing={editingReview}
          onClose={()=>{setShowWriteModal(false);setEditingReview(null);}}
          onSubmit={handleReviewSubmit}/>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════
export default function InformationProduct() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast, toasts, removeToast } = useToast();
  const { addItem, setShow, voucher, fetchBestVoucherForProduct, totalCount } = useCart();

  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [productBestVoucher, setProductBestVoucher] = useState(null);
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const dropdownRef = useRef(null);

  const [product,        setProduct]        = useState(null);
  const [variants,       setVariants]       = useState([]);
  const [images,         setImages]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [notFound,       setNotFound]       = useState(false);
  const [selectedVariant,setSelectedVariant]= useState(null);
  const [activeImg,      setActiveImg]      = useState(0);
  const [activeTab,      setActiveTab]      = useState("info");
  const [productContent, setProductContent] = useState([]);
  const contentSectionRef = useRef(null);
  const [qty,            setQty]            = useState(1);
  const [related,        setRelated]        = useState([]);
  const [activeVoucherList, setActiveVoucherList] = useState([]);

  // ── So sánh ──
  const [compareList,    setCompareList]    = useState([]);   // [{id, name, image, min_price, variants:[]}]
  const [showCompare,    setShowCompare]    = useState(false);
  const [showAddCompare, setShowAddCompare] = useState(false);
  const [allProducts,    setAllProducts]    = useState([]);

  const [selColor,   setSelColor]   = useState(null);
  const [selCombo,   setSelCombo]   = useState(null);

  const activeVariants = variants.filter(v => v.is_active !== false);
  const allColors = [...new Set(activeVariants.map(v => v.color).filter(Boolean))];

  const allComboMap = {};
  for (const v of activeVariants) {
    if (!v.price) continue;
    const key = `${v.ram || ""}|${v.storage || ""}`;
    if (!allComboMap[key] || parseFloat(v.price) < parseFloat(allComboMap[key].price)) {
      allComboMap[key] = v;
    }
  }
  const allCombos = Object.values(allComboMap).sort((a, b) => {
    const sd = parseGB(a.storage) - parseGB(b.storage);
    return sd !== 0 ? sd : parseGB(a.ram) - parseGB(b.ram);
  });

  const availableColors = selCombo
    ? allColors.filter(col => variants.some(v => v.color === col && `${v.ram || ""}|${v.storage || ""}` === selCombo))
    : allColors;

  const availableCombos = selColor
    ? allCombos.filter(c => variants.some(v => v.color === selColor && `${v.ram || ""}|${v.storage || ""}` === `${c.ram || ""}|${c.storage || ""}`))
    : allCombos;

  useEffect(() => {
    if (!variants.length) return;
    let match = null;
    if (selColor && selCombo) {
      match = activeVariants.find(v => v.color === selColor && `${v.ram || ""}|${v.storage || ""}` === selCombo);
    } else if (selCombo) {
      const candidates = activeVariants.filter(v => `${v.ram || ""}|${v.storage || ""}` === selCombo);
      match = candidates.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
    } else if (selColor) {
      const candidates = activeVariants.filter(v => v.color === selColor);
      match = candidates.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
    } else {
      match = [...activeVariants].sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0))[0];
    }
    if (match) {
      setSelectedVariant(match);
      if (match.image) {
        // Tìm đúng index của ảnh biến thể trong allImgs
        const productImgUrls = images.map(img => img?.url || img);
        const variantImgUrls = [...new Set(
          variants.map(v => v.image).filter(Boolean).filter(url => !productImgUrls.includes(url))
        )];
        const allImgsList = [
          ...images.map(img => ({ url: img?.url || img })),
          ...variantImgUrls.map(url => ({ url })),
        ];
        const idx = allImgsList.findIndex(img => img.url === match.image);
        setActiveImg(idx >= 0 ? idx : 0);
      }
    }
  }, [selColor, selCombo, variants]);

  const handleColorClick = (col) => {
    if (selColor === col) { setSelColor(null); return; }
    setSelColor(col);
    if (selCombo) {
      const ok = activeVariants.some(v => v.color === col && `${v.ram || ""}|${v.storage || ""}` === selCombo);
      if (!ok) setSelCombo(null);
    }
  };

  const handleComboClick = (comboKey) => {
    if (selCombo === comboKey) { setSelCombo(null); return; }
    setSelCombo(comboKey);
    if (selColor) {
      const ok = activeVariants.some(v => v.color === selColor && `${v.ram || ""}|${v.storage || ""}` === comboKey);
      if (!ok) setSelColor(null);
    }
  };

  const currentPrice = selectedVariant ? parseInt(selectedVariant.price) : 0;
  const currentStock = selectedVariant ? selectedVariant.stock : 0;

  // ── Danh sách ảnh tổng hợp: ảnh gốc trước, biến thể sau ──
  const allImgs = useMemo(() => {
    const productImgUrls = images.map(img => img?.url || img);
    const variantImgUrls = [...new Set(
      variants.map(v => v.image).filter(Boolean).filter(url => !productImgUrls.includes(url))
    )];
    return [
      ...images.map(img => ({ url: img?.url || img, type: "product" })),
      ...variantImgUrls.map(url => ({ url, type: "variant" })),
    ];
  }, [images, variants]);

  // ── Khi danh sách ảnh thay đổi (xóa ảnh, load xong) → clamp activeImg ──
  useEffect(() => {
    if (allImgs.length === 0) { setActiveImg(0); return; }
    setActiveImg(prev => Math.min(prev, allImgs.length - 1));
  }, [allImgs]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/product/${id}/detail/`).then(r => r.json()),
      fetch(`${API}/api/product/${id}/content/`).then(r => r.json()),
    ]).then(([detail, content]) => {
      if (!detail.product) { setNotFound(true); return; }
      setProduct(detail.product);
      setVariants(detail.variants || []);
      setImages(detail.images || []);
      setRelated(detail.related || []);
      setProductContent(content?.content?.blocks || []);
      // fetch active vouchers for related cards
      fetch(`${API}/api/voucher/active/`).then(r => r.json()).then(d => setActiveVoucherList(d.vouchers || [])).catch(() => {});
      // fetch variants for each related product
      const relatedList = detail.related || [];
      if (relatedList.length > 0) {
        Promise.all(
          relatedList.map(rp =>
            Promise.all([
              fetch(`${API}/api/product/${rp.id}/detail/`).then(r => r.json()).catch(() => ({})),
              fetch(`${API}/api/review/list/?product_id=${rp.id}`).then(r => r.json()).catch(() => ({})),
            ]).then(([d, rev]) => ({
              ...rp,
              variants: d.variants || [],
              rating_avg: rev.stats?.average || 0,
              rating_count: rev.stats?.total || 0,
            }))
          )
        ).then(withVariants => setRelated(withVariants));
      }
    }).catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!product?.id || !currentPrice) return;
    fetchBestVoucherForProduct(product.id, product.category_id, currentPrice, 1)
      .then(data => setProductBestVoucher(data))
      .catch(() => {});
  }, [product?.id, currentPrice]);

  useEffect(() => {
    if (!showAddCompare || allProducts.length > 0) return;
    fetch(`${API}/api/product/list/`)
      .then(r => r.json())
      .then(d => setAllProducts(d.products || []))
      .catch(() => {});
  }, [showAddCompare]);

  useEffect(() => {
    const sync = () => setUser(JSON.parse(localStorage.getItem("user") || "null"));
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("userUpdated", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("focus", sync); window.removeEventListener("userUpdated", sync); };
  }, []);

  useEffect(() => {
    const fn = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleLogout = () => { clearSession("user"); setConfirmLogout(false); sessionStorage.setItem("logout_toast", "Đã đăng xuất thành công!"); navigate("/login"); };

  useEffect(() => {
    if (!variants.length) return;
    const qColor   = searchParams.get("color")   || null;
    const qRam     = searchParams.get("ram")      || null;
    const qStorage = searchParams.get("storage")  || null;
    if (qColor) setSelColor(qColor);
    if (qRam || qStorage) setSelCombo(`${qRam || ""}|${qStorage || ""}`);
  }, [variants]);

  const activeVoucher = (() => {
    if (!currentPrice || !selectedVariant) return null;
    if (voucher && voucherAppliesToVariant(voucher, product, selectedVariant)) return voucher;
    if (productBestVoucher?.voucher && voucherAppliesToVariant(productBestVoucher.voucher, product, selectedVariant)) return productBestVoucher.voucher;
    return null;
  })();

  const discountedPrice = (activeVoucher && currentPrice) ? applyVoucherDiscount(currentPrice, activeVoucher) : currentPrice;
  const hasDiscount = discountedPrice < currentPrice;

  const getComboDisplayPrice = (comboVariant) => {
    const price = parseFloat(comboVariant.price);
    if (!price) return { price, disc: price, hasD: false, appliedVoucher: null };
    if (voucher && voucherAppliesToVariant(voucher, product, comboVariant)) {
      const disc = applyVoucherDiscount(price, voucher);
      if (disc < price) return { price, disc, hasD: true, appliedVoucher: voucher };
    }
    if (productBestVoucher?.voucher && voucherAppliesToVariant(productBestVoucher.voucher, product, comboVariant)) {
      const disc = applyVoucherDiscount(price, productBestVoucher.voucher);
      if (disc < price) return { price, disc, hasD: true, appliedVoucher: productBestVoucher.voucher };
    }
    return { price, disc: price, hasD: false, appliedVoucher: null };
  };

  const handleAddToCart = (buyNow = false) => {
    if (!selectedVariant || currentStock === 0) return;
    addItem(
      { id: product.id, name: product.name, image: images[0]?.url || "", categoryId: product.category_id },
      {
        id:      selectedVariant.id,
        color:   selectedVariant.color,
        storage: selectedVariant.storage,
        ram:     selectedVariant.ram,
        price:   parseFloat(selectedVariant.price) || 0,
        image:   selectedVariant.image,
        stock:   parseInt(selectedVariant.stock) || 0,
      },
      qty
    );
    if (buyNow) { setShow(false); navigate("/cart"); }
    else { toast.success("Đã thêm vào giỏ hàng thành công!"); }
  };

  const specsGroups = selectedVariant ? [
    { label: "Bộ xử lý",          color: "text-blue-400",   rows: [["CPU", selectedVariant.cpu], ["Hệ điều hành", selectedVariant.os]].filter(([,v]) => v) },
    { label: "Bộ nhớ & Lưu trữ", color: "text-green-400",  rows: [["RAM", selectedVariant.ram], ["Bộ nhớ", selectedVariant.storage]].filter(([,v]) => v) },
    { label: "Màn hình",           color: "text-purple-400", rows: [["Kích thước", selectedVariant.screen_size], ["Công nghệ", selectedVariant.screen_tech], ["Tần số quét", selectedVariant.refresh_rate]].filter(([,v]) => v) },
    { label: "Camera",             color: "text-yellow-400", rows: [["Camera trước", selectedVariant.front_camera], ["Camera sau", selectedVariant.rear_camera]].filter(([,v]) => v) },
    { label: "Pin & Sạc",          color: "text-orange-400", rows: [["Dung lượng pin", selectedVariant.battery], ["Tốc độ sạc", selectedVariant.charging_speed]].filter(([,v]) => v) },
    { label: "Khác",               color: "text-gray-400",   rows: [["Màu sắc", selectedVariant.color], ["Trọng lượng", selectedVariant.weights], ["Cập nhật OS", selectedVariant.updates]].filter(([,v]) => v) },
  ].filter(g => g.rows.length > 0) : [];

  if (loading) return (
    <div className="min-h-screen bg-[#1C1C1E] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  if (notFound || !product) return (
    <div className="min-h-screen bg-[#1C1C1E] flex flex-col items-center justify-center gap-4 text-white/40">
      <Package size={48} className="opacity-30" />
      <p>Không tìm thấy sản phẩm</p>
      <button onClick={() => navigate("/product")} className="text-orange-400 text-sm hover:underline focus:outline-none">← Quay lại</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1C1C1E] text-white">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm pz-backdrop" onClick={() => setConfirmLogout(false)} />
          <div className="relative bg-[#161616] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl pz-modal-box">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <h3 className="font-semibold">Đăng xuất</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">Bạn có muốn đăng xuất không?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmLogout(false)} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10 focus:outline-none">Hủy</button>
              <button onClick={handleLogout} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium focus:outline-none">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-4 pz-navbar">
        <div className="text-2xl pz-brand-logo pz-logo" onClick={() => navigate("/")}><span className="pz-white">PHONE</span><span className="pz-orange">ZONE</span></div>
        <div className="flex gap-8 items-center text-gray-300">
          <Link to="/" className="hover:text-white transition">Trang chủ</Link>
          <Link to="/product" className="text-white font-medium">Sản phẩm</Link>
          <Link to="/blog" className="hover:text-white transition">Bài viết</Link>
        </div>
        <div className="flex gap-5 items-center text-gray-300">
          <button onClick={() => setSearchOpen(true)} className="text-gray-300 hover:text-white transition focus:outline-none">
            <Search size={20} />
          </button>
          <button onClick={() => navigate(isLoggedIn() ? "/cart" : "/login")} className="relative focus:outline-none">
            <ShoppingCart className="hover:text-white transition" size={22} />
            {totalCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {totalCount > 9 ? "9+" : totalCount}
              </span>
            )}
          </button>
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 hover:text-white transition focus:outline-none">
                {user.avatar
                  ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20" onError={e => e.currentTarget.style.display="none"} />
                  : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 pz-dropdown">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                    {user.avatar
                      ? <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" onError={e => e.currentTarget.style.display="none"} />
                      : <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{user.fullName}</p>
                      <p className="text-xs text-white/40 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button onClick={() => { setDropdownOpen(false); navigate("/information"); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition focus:outline-none">
                    <Settings size={15} /> Tài khoản
                  </button>
                  <div className="h-px bg-white/5 mx-3" />
                  <button onClick={() => { setDropdownOpen(false); setConfirmLogout(true); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition focus:outline-none">
                    <LogOut size={15} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => navigate("/login")}><User className="hover:text-white transition focus:outline-none" size={22} /></button>
          )}
        </div>
      </nav>

      {/* ── BODY (centered) ── */}
      <div className="pt-[64px]">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center gap-2 text-xs text-white/30 border-b border-white/5">
          <button onClick={() => navigate("/")} className="hover:text-white transition focus:outline-none">Trang chủ</button>
          <ChevronRight size={12} />
          <button onClick={() => navigate("/product")} className="hover:text-white transition focus:outline-none">Sản phẩm</button>
          <ChevronRight size={12} />
          <span className="text-white/60 truncate max-w-xs">{product.name}</span>
        </div>

        {/* Product main section */}
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 flex gap-10 flex-wrap lg:flex-nowrap">

          {/* ===== ẢNH — ProductImageSlider ===== */}
          <div className="w-full lg:w-[420px] shrink-0">
            <ProductImageSlider
              images={images}
              variantImage={selectedVariant?.image || null}
              variantImages={(() => {
                // Lấy tất cả URL ảnh gốc sản phẩm (normalize: trim + lowercase)
                const productUrls = new Set(
                  images.map(img => (img?.url || img || "").trim().toLowerCase()).filter(Boolean)
                );
                // Chỉ lấy ảnh biến thể có URL CHƯA tồn tại trong ảnh gốc
                // dedupe luôn các biến thể trùng nhau
                const seen = new Set();
                return variants
                  .map(v => (v.image || "").trim())
                  .filter(url => {
                    if (!url) return false;
                    if (productUrls.has(url.toLowerCase())) return false; // trùng ảnh gốc → bỏ
                    if (seen.has(url)) return false;                       // trùng biến thể khác → bỏ
                    seen.add(url);
                    return true;
                  });
              })()}
              variantVideo={selectedVariant?.video_url || null}
              frozen={!!(selColor && selCombo)}
              autoPlayInterval={3500}
            />
          </div>

          {/* ===== INFO ===== */}
          <div className="flex-1 flex flex-col gap-5">
            <div>
              {product.brand && <p className="text-xs text-orange-400 uppercase tracking-widest mb-1">{product.brand}</p>}
              <h1 className="text-2xl font-bold leading-tight">{product.name}</h1>
              {product.category && (
                <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40">{product.category}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-3 flex-wrap">
                {hasDiscount && (
                  <span className="text-xl text-[#ff3b30]/40 line-through">
                    {currentPrice.toLocaleString("vi-VN")}đ
                  </span>
                )}
                <span className="text-3xl font-bold text-[#ff3b30]">
                  {discountedPrice ? discountedPrice.toLocaleString("vi-VN") + "đ" : "Liên hệ"}
                </span>
                {currentStock > 0
                  ? <span className="text-xs text-green-400">Còn hàng ({currentStock})</span>
                  : <span className="text-xs text-red-400">Hết hàng</span>}
              </div>
              {hasDiscount && activeVoucher && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs bg-orange-500/15 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full font-medium">
                    🏷 {activeVoucher.code} -{activeVoucher.type === "percent" ? `${activeVoucher.value}%` : `${parseInt(activeVoucher.value).toLocaleString("vi-VN")}đ`}
                  </span>
                  <span className="text-xs text-green-400">Tiết kiệm {(currentPrice - discountedPrice).toLocaleString("vi-VN")}đ</span>
                  {activeVoucher.id !== voucher?.id && (
                    <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">Voucher riêng SP</span>
                  )}
                </div>
              )}
            </div>

            {allColors.length > 0 && (
              <div>
                <p className="text-xs text-white/40 mb-2">
                  Màu sắc:
                  {selColor
                    ? <span className="text-white/80 font-medium ml-1">{selColor}</span>
                    : <span className="text-white/30 ml-1 italic text-[11px]">chưa chọn</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {allColors.map(col => {
                    const isAvailable = availableColors.includes(col);
                    const isSelected  = selColor === col;
                    const hasStock    = variants.some(v => v.color === col && (v.stock ?? 1) > 0);
                    return (
                      <button key={col} onClick={() => hasStock && handleColorClick(col)} disabled={!hasStock}
                        className={`px-3 py-1.5 rounded-xl text-sm border transition font-medium
                          ${isSelected
                            ? "bg-white text-black border-white"
                            : !isAvailable || !hasStock
                              ? "bg-white/[0.02] border-white/5 text-white/20 cursor-not-allowed" + (!hasStock ? " line-through" : " opacity-40")
                              : "bg-white/5 border-white/15 text-white/60 hover:border-white/40 hover:text-white"}`}>
                        {col}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {allCombos.length > 0 && (
              <div>
                <p className="text-xs text-white/40 mb-2">
                  Cấu hình:
                  {selCombo
                    ? <span className="text-white/80 font-medium ml-1">{selCombo.replace("|", " · ").replace(/^\|/, "").replace(/\|$/, "")}</span>
                    : <span className="text-white/30 ml-1 italic text-[11px]">chưa chọn</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {allCombos.map(v => {
                    const comboKey    = `${v.ram || ""}|${v.storage || ""}`;
                    const isSelected  = selCombo === comboKey;
                    const isAvailable = availableCombos.some(c => `${c.ram || ""}|${c.storage || ""}` === comboKey);
                    const label       = [v.ram, v.storage].filter(Boolean).join(" · ");
                    const { price, disc, hasD } = getComboDisplayPrice(v);

                    return (
                      <button key={comboKey} onClick={() => isAvailable && handleComboClick(comboKey)} disabled={!isAvailable}
                        className={`flex flex-col items-start px-3 py-2 rounded-xl border transition
                          ${isSelected
                            ? "bg-orange-500/20 border-orange-500 text-orange-300"
                            : !isAvailable
                              ? "bg-white/[0.02] border-white/5 text-white/20 cursor-not-allowed opacity-40"
                              : "bg-white/5 border-white/15 text-white/60 hover:border-white/40 hover:text-white"}`}>
                        <span className="text-sm font-semibold">{label || "Mặc định"}</span>
                        <span className={`text-xs mt-0.5 ${hasD ? "text-[#ff3b30]" : "text-white/40"}`}>
                          {hasD ? (
                            <>
                              <span className="line-through text-[#ff3b30]/30 mr-1 text-[10px]">{price.toLocaleString("vi-VN")}đ</span>
                              {disc.toLocaleString("vi-VN")}đ
                            </>
                          ) : price.toLocaleString("vi-VN") + "đ"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex items-center border border-white/10 rounded-xl overflow-hidden">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition text-lg focus:outline-none">−</button>
                <span className="w-10 text-center text-sm">{qty}</span>
                <button onClick={() => setQty(q => Math.min(currentStock, q + 1))} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition text-lg focus:outline-none">+</button>
              </div>
              <button onClick={() => handleAddToCart(false)} disabled={currentStock === 0}
                className="flex-1 h-11 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition flex items-center justify-center gap-2 focus:outline-none">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                Thêm vào giỏ hàng
              </button>
              <button onClick={() => handleAddToCart(true)} disabled={currentStock === 0}
                className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition focus:outline-none">
                Mua ngay
              </button>
            </div>

            {/* Nút so sánh */}
            <button onClick={() => setShowAddCompare(true)}
              className="flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-white/10 hover:border-orange-500/40 hover:bg-orange-500/5 text-white/40 hover:text-orange-400 text-sm transition focus:outline-none">
              <GitCompare size={15} />
              So sánh sản phẩm
              {compareList.length > 0 && (
                <span className="ml-1 bg-orange-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {compareList.length}
                </span>
              )}
            </button>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
              {[
                { icon: Shield,    text: "Bảo hành 12 tháng" },
                { icon: Truck,     text: "Giao hàng toàn quốc" },
                { icon: RotateCcw, text: "Đổi trả trong 7 ngày" },
                { icon: ZapIcon,   text: "Hỗ trợ 24/7" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-white/40">
                  <Icon size={14} className="text-orange-400 shrink-0" />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== TABS ===== */}
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-10">
          <div className="flex justify-center gap-1 border-b border-white/10 mb-6">
            {[
              { key: "info",   label: "Mô tả sản phẩm" },
              { key: "specs",  label: "Thông tin sản phẩm" },
              { key: "review", label: "Đánh giá" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => { setActiveTab(key); if (key === "info") setTimeout(() => contentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
                className={`px-5 py-3 text-sm font-medium transition border-b-2 -mb-px
                  ${activeTab === key ? "text-orange-400 border-orange-500" : "text-white/40 border-transparent hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>

          {activeTab === "info" && (
            <div className="w-full max-w-3xl mx-auto" ref={contentSectionRef}>
              {productContent.length > 0
                ? <BlockRenderer blocks={productContent} />
                : product.description
                  ? <div className="text-white/70 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: product.description }} />
                  : <p className="text-white/20 text-sm italic text-center">Chưa có mô tả sản phẩm</p>}
            </div>
          )}

          {activeTab === "specs" && (
            <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
              {specsGroups.length === 0
                ? <p className="text-white/20 text-sm italic text-center">Chưa có thông số kỹ thuật</p>
                : specsGroups.map(group => (
                  <div key={group.label} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5">
                      <h3 className={`text-xs font-semibold uppercase tracking-wider ${group.color}`}>{group.label}</h3>
                    </div>
                    {group.rows.map(([label, value], i) => (
                      <div key={label} className={`flex px-5 py-3 text-sm ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
                        <span className="w-44 shrink-0 text-white/40">{label}</span>
                        <span className="text-white/80">{value}</span>
                      </div>
                    ))}
                  </div>
                ))
              }
            </div>
          )}

          {activeTab === "review" && product && (
            <div className="w-full max-w-3xl mx-auto">
              <ReviewCommentSection productId={product.id} user={user} navigate={navigate} />
            </div>
          )}
        </div>

        {/* ===== SẢN PHẨM LIÊN QUAN ===== */}
        {related.length > 0 && (
          <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-12 border-t border-white/5 pt-8">
            <h2 className="text-lg font-semibold mb-5">Sản phẩm tương tự</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {related.map(p => (
                <SuggestedProductCard
                  key={p.id}
                  p={p}
                  onNavigate={id => navigate(`/product/${id}`)}
                  onAddCart={(prod, dv) => addItem(prod, dv, 1)}
                  extraButton={(prod, dv) => (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (compareList.some(c => c.id === prod.id)) {
                          setCompareList(prev => prev.filter(c => c.id !== prod.id));
                        } else if (compareList.length < 3) {
                          setCompareList(prev => [...prev, prod]);
                        }
                      }}
                      title="So sánh"
                      className={`shrink-0 h-7 w-7 flex items-center justify-center rounded-full border transition focus:outline-none
                        ${compareList.some(c => c.id === prod.id)
                          ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                          : "bg-white/5 border-white/10 text-white/40 hover:border-orange-500/40 hover:text-orange-400"}`}>
                      {compareList.some(c => c.id === prod.id) ? <Check size={10} /> : <GitCompare size={10} />}
                    </button>
                  )}
                />
              ))}
            </div>
            {compareList.length > 0 && (
              <div className="mt-5 flex items-center justify-between px-4 py-3 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-center gap-2 text-sm text-orange-300">
                  <GitCompare size={15} />
                  Đã chọn {compareList.length} sản phẩm để so sánh
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCompareList([])} className="text-xs text-white/30 hover:text-red-400 transition focus:outline-none">Xóa tất cả</button>
                  <button onClick={() => setShowCompare(true)}
                    className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition focus:outline-none">
                    Xem so sánh
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ MODAL: CHỌN SẢN PHẨM SO SÁNH ═══ */}
      {showAddCompare && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm pz-backdrop" onClick={() => setShowAddCompare(false)} />
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <GitCompare size={16} className="text-orange-400" />
                <h3 className="font-semibold text-sm">So sánh sản phẩm</h3>
                <span className="text-xs text-white/30">Chọn tối đa 3</span>
              </div>
              <button onClick={() => setShowAddCompare(false)} className="text-white/30 hover:text-white focus:outline-none"><X size={16} /></button>
            </div>

            {/* Sản phẩm hiện tại luôn có */}
            <div className="px-5 py-3 border-b border-white/5">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Sản phẩm đang xem</p>
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 focus:outline-none">
                {images[0]?.url && <img src={images[0].url} alt="" className="w-10 h-10 object-contain rounded-lg bg-gray-800" />}
                <p className="text-sm font-medium text-orange-300 flex-1 line-clamp-1">{product.name}</p>
                <Check size={14} className="text-orange-400 shrink-0" />
              </div>
            </div>

            {/* Danh sách đã chọn */}
            {compareList.length > 0 && (
              <div className="px-5 py-3 border-b border-white/5 flex flex-wrap gap-2">
                {compareList.map(p => (
                  <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs">
                    <span className="text-white/70 max-w-[100px] truncate">{p.name}</span>
                    <button onClick={() => setCompareList(prev => prev.filter(c => c.id !== p.id))} className="text-white/20 hover:text-red-400 ml-1 focus:outline-none"><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Search + list */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <AddCompareSearch
                allProducts={allProducts}
                currentId={product?.id}
                compareList={compareList}
                onToggle={(p) => {
                  if (compareList.some(c => c.id === p.id)) {
                    setCompareList(prev => prev.filter(c => c.id !== p.id));
                  } else if (compareList.length < 3) {
                    setCompareList(prev => [...prev, p]);
                  }
                }}
              />
            </div>

            <div className="px-5 py-4 border-t border-white/10 flex gap-3">
              <button onClick={() => setShowAddCompare(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10 transition">Đóng</button>
              <button
                onClick={() => { setShowAddCompare(false); if (compareList.length > 0) setShowCompare(true); }}
                disabled={compareList.length === 0}
                className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold transition focus:outline-none">
                So sánh ({compareList.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: BẢNG SO SÁNH ═══ */}
      {showCompare && product && (
        <CompareModal
          current={{ ...product, variants, images }}
          compareList={compareList}
          onClose={() => setShowCompare(false)}
          navigate={navigate}
        />
      )}

      <Footer />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// COMPONENT: Tìm kiếm sản phẩm để thêm vào so sánh
// ═══════════════════════════════════════════════════════
function AddCompareSearch({ allProducts, currentId, compareList, onToggle }) {
  const [q, setQ] = useState("");
  const filtered = allProducts.filter(p =>
    p.id !== currentId &&
    (!q.trim() || p.name?.toLowerCase().includes(q.toLowerCase()) || p.brand?.toLowerCase().includes(q.toLowerCase()))
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
        <Search size={13} className="text-white/30 shrink-0" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Tìm sản phẩm để so sánh..."
          className="bg-transparent text-xs outline-none flex-1 text-white placeholder:text-white/20" />
        {q && <button onClick={() => setQ("")}><X size={11} className="text-white/30 hover:text-white focus:outline-none" /></button>}
      </div>
      <div className="flex flex-col gap-1">
        {filtered.length === 0
          ? <p className="text-center text-white/20 text-xs py-6">Không tìm thấy sản phẩm</p>
          : filtered.map(p => {
              const inList  = compareList.some(c => c.id === p.id);
              const maxed   = !inList && compareList.length >= 3;
              const minP    = parseFloat(p.min_price) || 0;
              return (
                <button key={p.id} onClick={() => !maxed && onToggle(p)} disabled={maxed}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition
                    ${inList   ? "bg-orange-500/10 border-orange-500/30 text-orange-300"
                    : maxed    ? "opacity-30 border-transparent cursor-not-allowed"
                               : "border-transparent hover:bg-white/5 hover:border-white/10"}`}>
                  <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0 overflow-hidden">
                    {p.image ? <img src={p.image} alt="" className="w-full h-full object-contain p-1" /> : <Package size={14} className="text-white/20" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-1 text-white">{p.name}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{minP ? minP.toLocaleString("vi-VN") + "đ" : "Liên hệ"}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition
                    ${inList ? "bg-orange-500 border-orange-500" : "border-white/20"}`}>
                    {inList ? <Check size={11} className="text-white" /> : <Plus size={11} className="text-white/30" />}
                  </div>
                </button>
              );
            })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// COMPONENT: Bảng so sánh thông số
// ═══════════════════════════════════════════════════════
const COMPARE_ROWS = [
  { label: "Giá",            key: v => v ? parseInt(v.price || 0).toLocaleString("vi-VN") + "đ" : "—", group: null },
  { label: "CPU",            key: v => v?.cpu            || "—", group: "Bộ xử lý" },
  { label: "Hệ điều hành",  key: v => v?.os             || "—", group: "Bộ xử lý" },
  { label: "RAM",            key: v => v?.ram            || "—", group: "Bộ nhớ" },
  { label: "Bộ nhớ trong",  key: v => v?.storage        || "—", group: "Bộ nhớ" },
  { label: "Màn hình",      key: v => v?.screen_size    || "—", group: "Màn hình" },
  { label: "Công nghệ MH",  key: v => v?.screen_tech    || "—", group: "Màn hình" },
  { label: "Tần số quét",   key: v => v?.refresh_rate   || "—", group: "Màn hình" },
  { label: "Camera trước",  key: v => v?.front_camera   || "—", group: "Camera" },
  { label: "Camera sau",    key: v => v?.rear_camera    || "—", group: "Camera" },
  { label: "Pin",           key: v => v?.battery        || "—", group: "Pin & Sạc" },
  { label: "Tốc độ sạc",   key: v => v?.charging_speed || "—", group: "Pin & Sạc" },
  { label: "Trọng lượng",  key: v => v?.weights        || "—", group: "Khác" },
  { label: "Cập nhật OS",  key: v => v?.updates        || "—", group: "Khác" },
];

function CompareModal({ current, compareList, onClose, navigate }) {
  // Lấy variant rẻ nhất của mỗi sản phẩm
  const getBestVariant = (variants) =>
    [...(variants || [])].sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0))[0] || null;

  const [compareDetails, setCompareDetails] = useState({});

  useEffect(() => {
    // Fetch chi tiết variant cho từng sp trong compareList
    compareList.forEach(p => {
      if (compareDetails[p.id]) return;
      fetch(`${API}/api/product/${p.id}/detail/`)
        .then(r => r.json())
        .then(d => setCompareDetails(prev => ({ ...prev, [p.id]: d.variants || [] })))
        .catch(() => {});
    });
  }, [compareList]);

  const currentVariant = getBestVariant(current.variants);
  const allCols = [
    { id: current.id, name: current.name, image: current.images?.[0]?.url || "", variant: currentVariant, isCurrent: true },
    ...compareList.map(p => ({
      id: p.id, name: p.name, image: p.image || "",
      variant: getBestVariant(compareDetails[p.id] || []),
      isCurrent: false,
    })),
  ];

  // Group rows by group
  const groups = [];
  let lastGroup = null;
  COMPARE_ROWS.forEach(row => {
    const g = row.group || "Giá";
    if (g !== lastGroup) { groups.push({ name: g, rows: [] }); lastGroup = g; }
    groups[groups.length - 1].rows.push(row);
  });

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#161616] border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <GitCompare size={17} className="text-orange-400" />
            <h2 className="font-bold text-base">So sánh sản phẩm</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition focus:outline-none"><X size={18} /></button>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full border-collapse min-w-[600px]">
            {/* Product headers */}
            <thead>
              <tr className="border-b border-white/10">
                <th className="w-36 px-4 py-4 text-left text-xs text-white/30 uppercase tracking-wider font-medium shrink-0 bg-[#161616] sticky left-0 z-10">Thông số</th>
                {allCols.map(col => (
                  <th key={col.id} className={`px-4 py-4 text-center min-w-[180px] ${col.isCurrent ? "bg-orange-500/5" : ""}`}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-xl bg-gray-800 overflow-hidden flex items-center justify-center">
                        {col.image
                          ? <img src={col.image} alt="" className="w-full h-full object-contain p-1" />
                          : <Package size={20} className="text-white/20" />}
                      </div>
                      <p className="text-xs font-semibold text-white line-clamp-2 leading-snug max-w-[160px]">{col.name}</p>
                      {col.isCurrent && <span className="text-[9px] bg-orange-500/20 border border-orange-500/30 text-orange-400 px-1.5 py-0.5 rounded-full">Đang xem</span>}
                      <button onClick={() => { onClose(); navigate(`/product/${col.id}`); }}
                        className="text-[10px] text-orange-400 hover:underline">Xem sản phẩm →</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <>
                  {group.name && group.name !== "Giá" && (
                    <tr key={`g_${group.name}`} className="bg-white/[0.02]">
                      <td colSpan={allCols.length + 1} className="px-4 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400/60">{group.name}</span>
                      </td>
                    </tr>
                  )}
                  {group.rows.map((row, ri) => {
                    const vals = allCols.map(col => row.key(col.variant));
                    const unique = [...new Set(vals.filter(v => v !== "—"))];
                    return (
                      <tr key={row.label} className={`border-b border-white/5 ${ri % 2 === 0 ? "" : "bg-white/[0.015]"}`}>
                        <td className="px-4 py-3 text-xs text-white/40 font-medium sticky left-0 bg-[#161616] z-10 border-r border-white/5">{row.label}</td>
                        {allCols.map((col, ci) => {
                          const val     = row.key(col.variant);
                          const isPrice = row.label === "Giá";
                          // Highlight giá thấp nhất
                          const prices  = isPrice ? allCols.map(c => parseInt((c.variant?.price || "0").replace(/\D/g, ""))) : [];
                          const minPrice = isPrice ? Math.min(...prices.filter(p => p > 0)) : 0;
                          const thisPriceNum = isPrice ? parseInt((col.variant?.price || "0")) : 0;
                          const isBestPrice = isPrice && thisPriceNum === minPrice && thisPriceNum > 0;
                          const isDiff  = !isPrice && unique.length > 1 && val !== "—";
                          return (
                            <td key={col.id} className={`px-4 py-3 text-center text-xs transition
                              ${col.isCurrent ? "bg-orange-500/5" : ""}
                              ${isBestPrice   ? "text-green-400 font-bold" : ""}
                              ${isDiff && !isBestPrice ? "text-white/80" : ""}
                              ${!isDiff && !isBestPrice ? "text-white/40" : ""}`}>
                              {isBestPrice
                                ? <span className="flex flex-col items-center gap-0.5"><span>{val}</span><span className="text-[9px] text-green-400/60">Rẻ nhất</span></span>
                                : val}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-white/10 shrink-0 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10 transition focus:outline-none">Đóng</button>
        </div>
      </div>
    </div>
  );
}