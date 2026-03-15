import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, X, Play, Volume2, VolumeX, Package } from "lucide-react";

// ─── Lightbox full-screen ────────────────────────────────────
function Lightbox({ items, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const total = items.length;

  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowLeft")  setIdx(i => (i - 1 + total) % total);
      if (e.key === "ArrowRight") setIdx(i => (i + 1) % total);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [total, onClose]);

  const item = items[idx];

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
      onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
          flex items-center justify-center text-white transition focus:outline-none z-10">
        <X size={20} />
      </button>

      {total > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + total) % total); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full
              bg-white/10 hover:bg-white/20 flex items-center justify-center text-white
              transition focus:outline-none z-10">
            <ChevronLeft size={22} />
          </button>
          <button onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % total); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full
              bg-white/10 hover:bg-white/20 flex items-center justify-center text-white
              transition focus:outline-none z-10">
            <ChevronRight size={22} />
          </button>
        </>
      )}

      <div className="max-w-5xl max-h-[85vh] flex items-center justify-center"
        onClick={e => e.stopPropagation()}>
        {item?.type === "video"
          ? <video src={item.url} controls autoPlay className="max-h-[85vh] max-w-full rounded-xl" />
          : <img src={item.url} alt="" className="max-h-[85vh] max-w-full rounded-xl object-contain" />
        }
      </div>

      {total > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {items.map((_, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
              className={`rounded-full transition-all focus:outline-none
                ${i === idx ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/30 hover:bg-white/60"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ProductImageSlider ───────────────────────────────────────────────────────
// FIX lỗi 3:
//   (A) Khi chỉ chọn màu (chưa frozen): tự động nhảy đến ảnh của biến thể đó.
//   (B) Ảnh biến thể trùng URL với ảnh sản phẩm → KHÔNG loại bỏ khỏi list,
//       chỉ dedupe theo vị trí, và khi chọn màu sẽ nhảy đến đúng index.
//   (C) Khi frozen: chỉ hiện ảnh variant đã chọn (behavior cũ, giữ nguyên).
export default function ProductImageSlider({
  images           = [],
  variantImage     = null,   // ảnh của variant đang chọn (để jump đến)
  variantImages    = [],     // tất cả ảnh của mọi biến thể (để hiển thị đủ)
  variantVideo     = null,
  frozen           = false,
  autoPlayInterval = 3500,
}) {
  const videoRef    = useRef(null);
  const intervalRef = useRef(null);
  const [current,     setCurrent]     = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [muted,       setMuted]       = useState(true);

  // ── Xây dựng danh sách items ─────────────────────────────────────────────
  // FIX (B): không filter trùng URL ở đây — giữ tất cả ảnh sản phẩm gốc
  //          + thêm ảnh biến thể vào cuối nếu URL đó CHƯA có trong ảnh gốc.
  //          Điều này đảm bảo ảnh biến thể "trùng ảnh chính" vẫn được đại diện
  //          đúng index khi jump.
  const buildItems = useCallback(() => {
    if (frozen && variantImage) {
      // Đã chọn đủ: chỉ hiện ảnh variant đang chọn + video
      const items = [{ url: variantImage, type: "image" }];
      if (variantVideo) items.push({ url: variantVideo, type: "video" });
      return items;
    }

    // Sắp xếp: primary trước
    const sorted = [...images].sort((a, b) => {
      const bP = b.is_primary ?? b.IsPrimary ?? false;
      const aP = a.is_primary ?? a.IsPrimary ?? false;
      return (bP ? 1 : 0) - (aP ? 1 : 0);
    });

    const items = sorted.map(img => ({
      url:  img.url || img.ImageUrl || (typeof img === "string" ? img : ""),
      type: "image",
    })).filter(i => i.url);

    const existingUrls = new Set(items.map(i => i.url));

    // [FIX] Thêm ảnh biến thể vào list, bỏ qua URL đã có (kể cả trùng ảnh gốc)
    // Dedupe hoàn toàn — mỗi URL chỉ xuất hiện 1 lần duy nhất
    variantImages.forEach(url => {
      if (url && !existingUrls.has(url)) {
        items.push({ url, type: "image" });
        existingUrls.add(url);
      }
    });

    // Thêm video nếu có
    if (variantVideo && !existingUrls.has(variantVideo)) {
      items.push({ url: variantVideo, type: "video" });
    }

    return items;
  }, [images, variantImage, variantImages, variantVideo, frozen]);

  const [items, setItems] = useState(buildItems);
  const total = items.length;

  // ── Rebuild + jump đến ảnh variant khi props đổi ─────────────────────────
  useEffect(() => {
    const newItems = buildItems();
    setItems(newItems);

    if (variantImage) {
      // FIX (A) + (C): nhảy đến ảnh variant dù frozen hay không
      const idx = newItems.findIndex(i => i.url === variantImage);
      setCurrent(idx >= 0 ? idx : 0);
    } else if (!frozen) {
      // Không có variantImage và không frozen → về ảnh đầu
      setCurrent(0);
    }
  }, [buildItems, frozen, variantImage]);

  const next = useCallback(() => setCurrent(c => (c + 1) % total), [total]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + total) % total), [total]);

  // Auto-slide: chỉ khi không frozen và item hiện tại không phải video
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (frozen || total <= 1) return;
    if (items[current]?.type === "video") return;
    intervalRef.current = setInterval(next, autoPlayInterval);
    return () => clearInterval(intervalRef.current);
  }, [frozen, total, current, items, next, autoPlayInterval]);

  const goTo = (idx) => {
    clearInterval(intervalRef.current);
    setCurrent(idx);
  };

  const item = items[current] || null;

  if (total === 0) {
    return (
      <div className="w-full aspect-square rounded-2xl bg-gray-900/50 border border-white/8
        flex items-center justify-center">
        <Package size={64} className="text-white/10" />
      </div>
    );
  }

  return (
    <>
      {lightboxIdx !== null && (
        <Lightbox items={items} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

      <div className="flex flex-col gap-3 select-none">
        {/* ── Main display ── */}
        <div
          className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900
            border border-white/5 group"
          style={{ aspectRatio: "1 / 1" }}
        >
          {item?.type === "video" ? (
            <div className="w-full h-full relative">
              <video
                ref={videoRef}
                key={item.url}
                src={item.url}
                muted={muted}
                loop
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => {
                  const n = !muted;
                  setMuted(n);
                  if (videoRef.current) videoRef.current.muted = n;
                }}
                className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm
                  flex items-center justify-center text-white border border-white/20
                  opacity-0 group-hover:opacity-100 transition focus:outline-none z-10"
              >
                {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 text-white/80
                text-xs px-2.5 py-1 rounded-full border border-white/10 pointer-events-none">
                <Play size={10} fill="currentColor" /> Video
              </div>
            </div>
          ) : (
            item?.url
              ? <img
                  key={item.url}
                  src={item.url}
                  alt="Sản phẩm"
                  className="w-full h-full object-contain p-6 transition-opacity duration-300"
                  draggable={false}
                />
              : <div className="w-full h-full flex items-center justify-center">
                  <Package size={64} className="text-white/10" />
                </div>
          )}

          {/* Zoom */}
          <button
            onClick={() => setLightboxIdx(current)}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm
              flex items-center justify-center text-white border border-white/20
              opacity-0 group-hover:opacity-100 transition focus:outline-none z-10"
          >
            <ZoomIn size={14} />
          </button>

          {/* Prev / Next */}
          {total > 1 && (
            <>
              <button
                onClick={() => { clearInterval(intervalRef.current); prev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full
                  bg-black/40 backdrop-blur-sm flex items-center justify-center text-white
                  border border-white/20 opacity-0 group-hover:opacity-100 transition
                  hover:bg-black/60 focus:outline-none z-10"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => { clearInterval(intervalRef.current); next(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full
                  bg-black/40 backdrop-blur-sm flex items-center justify-center text-white
                  border border-white/20 opacity-0 group-hover:opacity-100 transition
                  hover:bg-black/60 focus:outline-none z-10"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}

          {/* Dots */}
          {total > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
              {items.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goTo(idx)}
                  className={`rounded-full transition-all focus:outline-none
                    ${idx === current
                      ? "w-4 h-1.5 bg-orange-400"
                      : "w-1.5 h-1.5 bg-white/30 hover:bg-white/60"}`}
                />
              ))}
            </div>
          )}

          {/* Counter */}
          {total > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/50 text-white/60 text-[10px]
              px-2 py-0.5 rounded-full pointer-events-none z-10">
              {current + 1} / {total}
            </div>
          )}

          {/* Frozen badge */}
          {frozen && (
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full
              bg-orange-500/20 border border-orange-500/40 text-orange-400 text-[10px]
              font-medium pointer-events-none z-10">
              Đã chọn màu
            </div>
          )}
        </div>

        {/* ── Thumbnails ── */}
        {total > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {items.map((it, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition
                  focus:outline-none relative
                  ${idx === current ? "border-orange-500" : "border-white/10 hover:border-white/30"}`}
              >
                {it.type === "video" ? (
                  <>
                    <video src={it.url} muted className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play size={12} fill="white" className="text-white" />
                    </div>
                  </>
                ) : (
                  <img src={it.url} alt="" className="w-full h-full object-contain p-1 bg-gray-900" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}