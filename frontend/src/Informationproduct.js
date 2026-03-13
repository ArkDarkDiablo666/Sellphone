import { useState, useEffect, useRef, useCallback } from "react";
import { BlockRenderer } from "./Blockeditor";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCart } from "./Cart";
import {
  User, LogOut, Settings, ShoppingCart, ChevronDown,
  AlertTriangle, ShoppingBag, ChevronLeft, ChevronRight, Package,
  Shield, Truck, RotateCcw, ZapIcon, Star, Heart, MessageCircle,
  Send, Image as ImageIcon, X, ChevronUp, Edit2, CornerDownRight,
  Camera, Loader2, Search, GitCompare, Plus, Check, Tag
} from "lucide-react";
import { SearchModal } from "./Searchbar";
import Footer from "./Footer";

const API = "http://localhost:8000";

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
//  REVIEW & COMMENT SECTION
// ═══════════════════════════════════════════════════════

const STAR_LABELS = ["", "Rất tệ", "Tệ", "Bình thường", "Tốt", "Xuất sắc"];
const STAR_COLORS = ["", "text-red-400", "text-orange-400", "text-yellow-400", "text-lime-400", "text-green-400"];

function StarRow({ value, onChange, size = 28, readonly = false }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button"
          onClick={() => !readonly && onChange && onChange(n)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`transition-transform ${!readonly && "hover:scale-110 cursor-pointer"}`}
          style={{ background: "none", border: "none", padding: 0 }}>
          <Star
            size={size}
            fill={n <= active ? "#f59e0b" : "none"}
            stroke={n <= active ? "#f59e0b" : "#ffffff30"}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

function MediaThumb({ url, type, onRemove }) {
  return (
    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 group">
      {type === "video"
        ? <video src={url} className="w-full h-full object-cover" muted />
        : <img src={url} alt="" className="w-full h-full object-cover" />
      }
      {onRemove && (
        <button onClick={onRemove}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition">
          <X size={10} className="text-white" />
        </button>
      )}
    </div>
  );
}

function WriteReviewModal({ productId, user, onClose, onSubmit, existing }) {
  const [rating, setRating] = useState(existing?.rating || 0);
  const [content, setContent] = useState(existing?.content || "");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState(existing?.media || []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const handleFiles = (files) => {
    const arr = Array.from(files).slice(0, 5 - previewUrls.length);
    const urls = arr.map(f => ({ url: URL.createObjectURL(f), type: f.type.startsWith("video") ? "video" : "image", file: f }));
    setMediaFiles(p => [...p, ...arr]);
    setPreviewUrls(p => [...p, ...urls]);
  };

  const removeMedia = (i) => {
    setPreviewUrls(p => p.filter((_, idx) => idx !== i));
    setMediaFiles(p => p.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if (!rating) return setError("Vui lòng chọn số sao");
    setUploading(true); setError("");
    try {
      const uploadedMedia = [...(existing?.media || []).filter(m => typeof m.url === "string" && !m.url.startsWith("blob"))];
      for (const file of mediaFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("customer_id", user.id);
        const res = await fetch(`${API}/api/review/upload-media/`, { method: "POST", body: fd });
        const data = await res.json();
        if (data.url) uploadedMedia.push({ url: data.url, type: data.media_type });
      }
      const body = { customer_id: user.id, product_id: productId, rating, content, media: uploadedMedia };
      const endpoint = existing ? `${API}/api/review/update/` : `${API}/api/review/create/`;
      if (existing) body.review_id = existing.id;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Lỗi");
      onSubmit(data.review);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">{existing ? "Chỉnh sửa đánh giá" : "Viết đánh giá"}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"><X size={16} /></button>
        </div>
        <div className="flex flex-col items-center gap-2">
          <StarRow value={rating} onChange={setRating} size={36} />
          {rating > 0 && <span className={`text-sm font-medium ${STAR_COLORS[rating]}`}>{STAR_LABELS[rating]}</span>}
        </div>
        <textarea
          value={content} onChange={e => setContent(e.target.value)}
          placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..."
          rows={4}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30
            resize-none focus:outline-none focus:border-orange-500/50 transition"
        />
        <div>
          <div className="flex flex-wrap gap-2">
            {previewUrls.map((m, i) => (
              <MediaThumb key={i} url={m.url || m} type={m.type || "image"} onRemove={() => removeMedia(i)} />
            ))}
            {previewUrls.length < 5 && (
              <button onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-1
                  hover:border-orange-500/50 hover:bg-orange-500/5 transition cursor-pointer">
                <ImageIcon size={18} className="text-white/30" />
                <span className="text-[10px] text-white/30">Thêm ảnh</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
            onChange={e => handleFiles(e.target.files)} />
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition">Hủy</button>
          <button onClick={handleSubmit} disabled={uploading || !rating}
            className="px-6 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-medium transition flex items-center gap-2">
            {uploading && <Loader2 size={14} className="animate-spin" />}
            {existing ? "Cập nhật" : "Gửi đánh giá"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review, user, onLike, onAdminReply }) {
  const [showReply, setShowReply] = useState(false);
  const isOwn = user && String(user.id) === String(review.customer_id);

  return (
    <div className="flex flex-col gap-3 py-5 border-b border-white/5 last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-xs font-bold shrink-0">
          {review.customer_avatar
            ? <img src={review.customer_avatar} className="w-full h-full object-cover rounded-full" alt="" />
            : (review.customer_name?.[0] || "U").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{review.customer_name}</span>
            {review.variant && (
              <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{review.variant}</span>
            )}
            <span className="text-xs text-white/20 ml-auto">{new Date(review.created_at).toLocaleDateString("vi-VN")}</span>
          </div>
          <div className="mt-1">
            <StarRow value={review.rating} readonly size={14} />
          </div>
          {review.content && <p className="mt-2 text-sm text-white/80 leading-relaxed">{review.content}</p>}
        </div>
      </div>
      {review.media?.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-12">
          {review.media.map((m, i) => <MediaThumb key={i} url={m.url} type={m.type} />)}
        </div>
      )}
      {review.admin_reply && (
        <div className="ml-12 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex gap-3">
          <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-white">PZ</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-orange-400">PHONEZONE</span>
            <p className="text-sm text-white/70 mt-0.5">{review.admin_reply.content}</p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-4 pl-12">
        <button onClick={() => onLike("review", review.id)}
          className={`flex items-center gap-1.5 text-xs transition ${review.liked ? "text-red-400" : "text-white/30 hover:text-red-400"}`}>
          <Heart size={13} fill={review.liked ? "currentColor" : "none"} />
          {review.likes > 0 && review.likes}
          <span>Thích</span>
        </button>
      </div>
    </div>
  );
}

function CommentCard({ comment, user, onLike, depth = 0 }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replies, setReplies] = useState(comment.replies || []);

  const submitReply = async () => {
    if (!replyText.trim() || !user) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/comment/create/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: user.id, product_id: comment.product_id, content: replyText, parent_id: comment.id })
      });
      const data = await res.json();
      if (data.ok) {
        setReplies(p => [...p, data.comment]);
        setReplyText("");
        setReplyOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${depth > 0 ? "pl-10 border-l border-white/5 ml-4" : ""}`}>
      <div className="flex gap-3 py-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
          {comment.customer_avatar
            ? <img src={comment.customer_avatar} className="w-full h-full object-cover rounded-full" alt="" />
            : (comment.customer_name?.[0] || "U").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{comment.customer_name}</span>
            <span className="text-xs text-white/20">{new Date(comment.created_at).toLocaleDateString("vi-VN")}</span>
          </div>
          <p className="mt-1 text-sm text-white/75 leading-relaxed">{comment.content}</p>
          {comment.admin_reply && (
            <div className="mt-2 bg-orange-500/10 border border-orange-500/20 rounded-xl p-2.5 flex gap-2">
              <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                <span className="text-[8px] font-bold text-white">PZ</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-orange-400">PHONEZONE</span>
                <p className="text-xs text-white/70 mt-0.5">{comment.admin_reply.content}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-4 mt-2">
            <button onClick={() => onLike("comment", comment.id)}
              className={`flex items-center gap-1 text-xs transition ${comment.liked ? "text-red-400" : "text-white/30 hover:text-red-400"}`}>
              <Heart size={12} fill={comment.liked ? "currentColor" : "none"} />
              {comment.likes > 0 && <span>{comment.likes}</span>}
              <span>Thích</span>
            </button>
            {depth === 0 && (
              <button onClick={() => setReplyOpen(r => !r)}
                className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition">
                <CornerDownRight size={12} />
                Trả lời
              </button>
            )}
          </div>
          {replyOpen && (
            <div className="flex items-center gap-2 mt-2">
              <input
                value={replyText} onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitReply()}
                placeholder="Viết trả lời..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30
                  focus:outline-none focus:border-orange-500/40 transition"
              />
              <button onClick={submitReply} disabled={submitting || !replyText.trim()}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition">
                {submitting ? <Loader2 size={14} className="animate-spin text-white" /> : <Send size={14} className="text-white" />}
              </button>
            </div>
          )}
        </div>
      </div>
      {replies.map(r => (
        <CommentCard key={r.id} comment={{ ...r, product_id: comment.product_id }} user={user} onLike={onLike} depth={depth + 1} />
      ))}
    </div>
  );
}

function ReviewCommentSection({ productId, user, navigate }) {
  const [reviews, setReviews] = useState([]);
  const [comments, setComments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeSection, setActiveSection] = useState("reviews");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, cRes] = await Promise.all([
        fetch(`${API}/api/review/list/?product_id=${productId}${user ? `&customer_id=${user.id}` : ""}`),
        fetch(`${API}/api/comment/list/?product_id=${productId}${user ? `&customer_id=${user.id}` : ""}`),
      ]);
      const [rData, cData] = await Promise.all([rRes.json(), cRes.json()]);
      setReviews(rData.reviews || []);
      setStats(rData.stats || null);
      setComments(cData.comments || []);
    } finally {
      setLoading(false);
    }
  }, [productId, user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLike = async (type, id) => {
    if (!user) return navigate("/login");
    const res = await fetch(`${API}/api/like/toggle/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: user.id, type, target_id: id })
    });
    const data = await res.json();
    if (data.ok) {
      if (type === "review") {
        setReviews(prev => prev.map(r => r.id === id ? { ...r, liked: data.liked, likes: data.count } : r));
      } else {
        setComments(prev => prev.map(c => c.id === id ? { ...c, liked: data.liked, likes: data.count } : c));
      }
    }
  };

  const handleReviewSubmit = (review) => {
    setReviews(prev => {
      const exists = prev.find(r => r.id === review.id);
      return exists ? prev.map(r => r.id === review.id ? review : r) : [review, ...prev];
    });
    setShowWriteModal(false);
    setEditingReview(null);
    fetchData();
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    if (!user) return navigate("/login");
    setSubmittingComment(true);
    try {
      const res = await fetch(`${API}/api/comment/create/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: user.id, product_id: productId, content: commentText })
      });
      const data = await res.json();
      if (data.ok) {
        setComments(p => [data.comment, ...p]);
        setCommentText("");
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const userReview = user ? reviews.find(r => String(r.customer_id) === String(user.id)) : null;
  const avgRating = stats?.average || 0;
  const dist = stats?.distribution || {};
  const totalReviews = stats?.total || 0;

  return (
    <div className="w-full">
      {totalReviews > 0 && (
        <div className="flex items-center gap-8 p-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl mb-6">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="text-5xl font-bold text-amber-400">{avgRating.toFixed(1)}</span>
            <StarRow value={Math.round(avgRating)} readonly size={16} />
            <span className="text-xs text-white/30 mt-0.5">{totalReviews} đánh giá</span>
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            {[5,4,3,2,1].map(n => {
              const count = dist[n] || 0;
              const pct = totalReviews > 0 ? Math.round(count / totalReviews * 100) : 0;
              return (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-white/40 text-right">{n}</span>
                  <Star size={10} fill="#f59e0b" stroke="#f59e0b" />
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-white/30">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-white/10 mb-5">
        {[
          { key: "reviews", label: `Đánh giá${totalReviews > 0 ? ` (${totalReviews})` : ""}` },
          { key: "comments", label: `Bình luận${comments.length > 0 ? ` (${comments.length})` : ""}` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setActiveSection(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition
              ${activeSection === key ? "text-orange-400 border-orange-500" : "text-white/30 border-transparent hover:text-white/60"}`}>
            {label}
          </button>
        ))}
      </div>

      {activeSection === "reviews" && (
        <div>
          {!userReview && user && (
            <button onClick={() => setShowWriteModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 mb-5 rounded-xl border border-dashed border-orange-500/40
                hover:border-orange-500 hover:bg-orange-500/5 text-orange-400 text-sm font-medium transition">
              <Star size={16} />
              Viết đánh giá của bạn
            </button>
          )}
          {!user && (
            <button onClick={() => navigate("/login")}
              className="w-full flex items-center justify-center gap-2 py-3 mb-5 rounded-xl border border-dashed border-white/10
                hover:border-white/20 text-white/30 text-sm transition">
              Đăng nhập để đánh giá
            </button>
          )}
          {userReview && (
            <div className="mb-4 border border-orange-500/20 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-orange-500/10">
                <span className="text-xs text-orange-400 font-medium">Đánh giá của bạn</span>
                <button onClick={() => { setEditingReview(userReview); setShowWriteModal(true); }}
                  className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition">
                  <Edit2 size={11} /> Chỉnh sửa
                </button>
              </div>
              <div className="px-4">
                <ReviewCard review={userReview} user={user} onLike={handleLike} />
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-white/20" />
            </div>
          ) : reviews.filter(r => !user || String(r.customer_id) !== String(user?.id)).length === 0 ? (
            <div className="flex flex-col items-center py-12 text-white/20 gap-3">
              <Star size={40} strokeWidth={1} />
              <p className="text-sm">Chưa có đánh giá nào</p>
            </div>
          ) : (
            reviews.filter(r => !user || String(r.customer_id) !== String(user?.id))
              .map(r => <ReviewCard key={r.id} review={r} user={user} onLike={handleLike} />)
          )}
        </div>
      )}

      {activeSection === "comments" && (
        <div>
          <div className="flex gap-3 mb-6">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0 mt-1">
              {user?.full_name?.[0]?.toUpperCase() || <User size={14} />}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <input
                value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitComment()}
                placeholder={user ? "Viết bình luận..." : "Đăng nhập để bình luận..."}
                onFocus={() => !user && navigate("/login")}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white
                  placeholder-white/30 focus:outline-none focus:border-orange-500/40 transition"
              />
              <button onClick={submitComment} disabled={submittingComment || !commentText.trim()}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition shrink-0">
                {submittingComment ? <Loader2 size={15} className="animate-spin text-white" /> : <Send size={15} className="text-white" />}
              </button>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-white/20" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-white/20 gap-3">
              <MessageCircle size={40} strokeWidth={1} />
              <p className="text-sm">Chưa có bình luận nào</p>
            </div>
          ) : (
            comments.map(c => (
              <CommentCard key={c.id} comment={{ ...c, product_id: productId }} user={user} onLike={handleLike} depth={0} />
            ))
          )}
        </div>
      )}

      {showWriteModal && (
        <WriteReviewModal
          productId={productId}
          user={user}
          existing={editingReview}
          onClose={() => { setShowWriteModal(false); setEditingReview(null); }}
          onSubmit={handleReviewSubmit}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
export default function InformationProduct() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [addToast, setAddToast] = useState(false);
  const navigate = useNavigate();
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
  const [qty,            setQty]            = useState(1);
  const [related,        setRelated]        = useState([]);

  // ── So sánh ──
  const [compareList,    setCompareList]    = useState([]);   // [{id, name, image, min_price, variants:[]}]
  const [showCompare,    setShowCompare]    = useState(false);
  const [showAddCompare, setShowAddCompare] = useState(false);
  const [allProducts,    setAllProducts]    = useState([]);

  const [selColor,   setSelColor]   = useState(null);
  const [selCombo,   setSelCombo]   = useState(null);

  const allColors = [...new Set(variants.map(v => v.color).filter(Boolean))];

  const allComboMap = {};
  for (const v of variants) {
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
      match = variants.find(v => v.color === selColor && `${v.ram || ""}|${v.storage || ""}` === selCombo);
    } else if (selCombo) {
      const candidates = variants.filter(v => `${v.ram || ""}|${v.storage || ""}` === selCombo);
      match = candidates.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
    } else if (selColor) {
      const candidates = variants.filter(v => v.color === selColor);
      match = candidates.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
    } else {
      match = [...variants].sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0))[0];
    }
    if (match) {
      setSelectedVariant(match);
      if (match.image) setActiveImg(-1);
    }
  }, [selColor, selCombo, variants]);

  const handleColorClick = (col) => {
    if (selColor === col) { setSelColor(null); return; }
    setSelColor(col);
    if (selCombo) {
      const ok = variants.some(v => v.color === col && `${v.ram || ""}|${v.storage || ""}` === selCombo);
      if (!ok) setSelCombo(null);
    }
  };

  const handleComboClick = (comboKey) => {
    if (selCombo === comboKey) { setSelCombo(null); return; }
    setSelCombo(comboKey);
    if (selColor) {
      const ok = variants.some(v => v.color === selColor && `${v.ram || ""}|${v.storage || ""}` === comboKey);
      if (!ok) setSelColor(null);
    }
  };

  const currentPrice = selectedVariant ? parseInt(selectedVariant.price) : 0;
  const currentStock = selectedVariant ? selectedVariant.stock : 0;

  useEffect(() => {
    if (!id) return;
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

  const handleLogout = () => { localStorage.removeItem("user"); setConfirmLogout(false); navigate("/login"); };

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
    else { setAddToast(true); setTimeout(() => setAddToast(false), 2500); }
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
      <button onClick={() => navigate("/product")} className="text-orange-400 text-sm hover:underline">← Quay lại</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1C1C1E] text-white">

      {addToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium bg-green-500/20 border border-green-500/40 text-green-300 backdrop-blur-md">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Đã thêm vào giỏ hàng thành công!
          <button onClick={() => navigate("/cart")} className="ml-2 text-xs text-white/60 hover:text-white underline">Xem giỏ</button>
        </div>
      )}

      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmLogout(false)} />
          <div className="relative bg-[#161616] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <h3 className="font-semibold">Đăng xuất</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">Bạn có muốn đăng xuất không?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmLogout(false)} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10">Hủy</button>
              <button onClick={handleLogout} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-4 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="text-2xl font-bold cursor-pointer" onClick={() => navigate("/")}>PHONEZONE</div>
        <div className="flex gap-8 items-center text-gray-300">
          <Link to="/" className="hover:text-white transition">Trang chủ</Link>
          <Link to="/product" className="text-white font-medium">Sản phẩm</Link>
          <Link to="/blog" className="hover:text-white transition">Bài viết</Link>
        </div>
        <div className="flex gap-5 items-center text-gray-300">
          <button onClick={() => setSearchOpen(true)} className="text-gray-300 hover:text-white transition">
            <Search size={20} />
          </button>
          <button onClick={() => navigate(user ? "/cart" : "/login")} className="relative">
            <ShoppingCart className="hover:text-white transition" size={22} />
            {totalCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {totalCount > 9 ? "9+" : totalCount}
              </span>
            )}
          </button>
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 hover:text-white transition">
                {user.avatar
                  ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20" onError={e => e.currentTarget.style.display="none"} />
                  : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                    {user.avatar
                      ? <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" onError={e => e.currentTarget.style.display="none"} />
                      : <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{user.fullName}</p>
                      <p className="text-xs text-white/40 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button onClick={() => { setDropdownOpen(false); navigate("/information"); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition">
                    <Settings size={15} /> Tài khoản
                  </button>
                  <div className="h-px bg-white/5 mx-3" />
                  <button onClick={() => { setDropdownOpen(false); setConfirmLogout(true); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition">
                    <LogOut size={15} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => navigate("/login")}><User className="hover:text-white transition" size={22} /></button>
          )}
        </div>
      </nav>

      {/* ── BODY (centered) ── */}
      <div className="pt-[64px]">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center gap-2 text-xs text-white/30 border-b border-white/5">
          <button onClick={() => navigate("/")} className="hover:text-white transition">Trang chủ</button>
          <ChevronRight size={12} />
          <button onClick={() => navigate("/product")} className="hover:text-white transition">Sản phẩm</button>
          <ChevronRight size={12} />
          <span className="text-white/60 truncate max-w-xs">{product.name}</span>
        </div>

        {/* Product main section */}
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 flex gap-10 flex-wrap lg:flex-nowrap">

          {/* ===== ẢNH ===== */}
          <div className="w-full lg:w-[420px] shrink-0 flex flex-col gap-3">
            <div className="w-full h-[380px] rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden flex items-center justify-center border border-white/5 relative">
              {activeImg === -1 && selectedVariant?.image ? (
                <img src={selectedVariant.image} alt={product.name} className="w-full h-full object-contain p-6" />
              ) : images.length > 0 ? (
                <>
                  <img src={images[Math.max(0, activeImg)]?.url || images[Math.max(0, activeImg)]} alt={product.name} className="w-full h-full object-contain p-6" />
                  {images.length > 1 && (
                    <>
                      <button onClick={() => setActiveImg(i => { const x = i < 0 ? 0 : i; return (x - 1 + images.length) % images.length; })}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center transition">
                        <ChevronLeft size={16} />
                      </button>
                      <button onClick={() => setActiveImg(i => { const x = i < 0 ? 0 : i; return (x + 1) % images.length; })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center transition">
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}
                </>
              ) : <Package size={64} className="text-white/10" />}
            </div>
            {(images.length > 0 || selectedVariant?.image) && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedVariant?.image && (
                  <button onClick={() => setActiveImg(-1)}
                    className={`w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition relative ${activeImg === -1 ? "border-orange-500" : "border-white/10 hover:border-white/30"}`}>
                    <img src={selectedVariant.image} alt="" className="w-full h-full object-contain p-1 bg-gray-900" />
                    <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-orange-500 text-white px-1 rounded">BT</span>
                  </button>
                )}
                {images.map((img, i) => (
                  <button key={i} onClick={() => setActiveImg(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition ${activeImg === i ? "border-orange-500" : "border-white/10 hover:border-white/30"}`}>
                    <img src={img?.url || img} alt="" className="w-full h-full object-contain p-1 bg-gray-900" />
                  </button>
                ))}
              </div>
            )}
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
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition text-lg">−</button>
                <span className="w-10 text-center text-sm">{qty}</span>
                <button onClick={() => setQty(q => Math.min(currentStock, q + 1))} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition text-lg">+</button>
              </div>
              <button onClick={() => handleAddToCart(false)} disabled={currentStock === 0}
                className="flex-1 h-11 rounded-xl bg-[rgba(255,149,0,0.8)] hover:bg-[rgba(255,149,0,1)] disabled:opacity-40 disabled:cursor-not-allowed border border-[#ff9500] text-white font-semibold text-sm transition">
                Thêm vào giỏ hàng
              </button>
              <button onClick={() => handleAddToCart(true)} disabled={currentStock === 0}
                className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition">
                Mua ngay
              </button>
            </div>

            {/* Nút so sánh */}
            <button onClick={() => setShowAddCompare(true)}
              className="flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-white/10 hover:border-orange-500/40 hover:bg-orange-500/5 text-white/40 hover:text-orange-400 text-sm transition">
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
              <button key={key} onClick={() => setActiveTab(key)}
                className={`px-5 py-3 text-sm font-medium transition border-b-2 -mb-px
                  ${activeTab === key ? "text-orange-400 border-orange-500" : "text-white/40 border-transparent hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>

          {activeTab === "info" && (
            <div className="w-full max-w-3xl mx-auto">
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
              {related.map(p => {
                const minPrice = parseFloat(p.min_price) || 0;
                return (
                  <article key={p.id} onClick={() => navigate(`/product/${p.id}`)}
                    className="flex flex-col rounded-2xl overflow-hidden cursor-pointer hover:-translate-y-1 transition-all duration-300
                      shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
                      hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.60),inset_1px_0_0_rgba(255,255,255,0.48),0_8px_32px_rgba(0,0,0,0.4)]">
                    {/* Image */}
                    <div className="w-full h-36 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center overflow-hidden relative">
                      {p.image
                        ? <img src={p.image} alt={p.name} className="w-full h-full object-contain p-3" />
                        : <Package size={28} className="text-white/10" />}
                    </div>
                    {/* Info */}
                    <div className="flex flex-col gap-1.5 p-2.5">
                      <h3 className="font-semibold text-xs leading-snug line-clamp-2 hover:text-orange-400 transition">{p.name}</h3>
                      {p.brand && <span className="text-[10px] text-white/30">{p.brand}</span>}
                      <div className="flex items-center justify-between mt-auto pt-1 gap-1">
                        <p className="font-bold text-sm text-[#ff3b30]">
                          {minPrice ? minPrice.toLocaleString("vi-VN") + "đ" : "Liên hệ"}
                        </p>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (compareList.some(c => c.id === p.id)) {
                              setCompareList(prev => prev.filter(c => c.id !== p.id));
                            } else if (compareList.length < 3) {
                              setCompareList(prev => [...prev, p]);
                            }
                          }}
                          className={`shrink-0 h-7 px-2.5 rounded-full text-[10px] font-medium border transition
                            ${compareList.some(c => c.id === p.id)
                              ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                              : "bg-white/5 border-white/10 text-white/40 hover:border-orange-500/40 hover:text-orange-400"}`}>
                          {compareList.some(c => c.id === p.id) ? <Check size={11} /> : <GitCompare size={11} />}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {compareList.length > 0 && (
              <div className="mt-5 flex items-center justify-between px-4 py-3 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-center gap-2 text-sm text-orange-300">
                  <GitCompare size={15} />
                  Đã chọn {compareList.length} sản phẩm để so sánh
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCompareList([])} className="text-xs text-white/30 hover:text-red-400 transition">Xóa tất cả</button>
                  <button onClick={() => setShowCompare(true)}
                    className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition">
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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAddCompare(false)} />
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <GitCompare size={16} className="text-orange-400" />
                <h3 className="font-semibold text-sm">So sánh sản phẩm</h3>
                <span className="text-xs text-white/30">Chọn tối đa 3</span>
              </div>
              <button onClick={() => setShowAddCompare(false)} className="text-white/30 hover:text-white"><X size={16} /></button>
            </div>

            {/* Sản phẩm hiện tại luôn có */}
            <div className="px-5 py-3 border-b border-white/5">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Sản phẩm đang xem</p>
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
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
                    <button onClick={() => setCompareList(prev => prev.filter(c => c.id !== p.id))} className="text-white/20 hover:text-red-400 ml-1"><X size={10} /></button>
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
                className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold transition">
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
        {q && <button onClick={() => setQ("")}><X size={11} className="text-white/30 hover:text-white" /></button>}
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
          <button onClick={onClose} className="text-white/30 hover:text-white transition"><X size={18} /></button>
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
          <button onClick={onClose} className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10 transition">Đóng</button>
        </div>
      </div>
    </div>
  );
}