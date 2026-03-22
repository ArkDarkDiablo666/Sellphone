import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, Play, Pause } from "lucide-react";

import { API } from "./config";

// ─── Hook fetch banner active ────────────────────────────────
export function useBanner(page = "all") {
  const [banner,  setBanner]  = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/api/banner/active/?page=${page}`)
      .then(r => r.json())
      .then(d => setBanner(d.banner || null))
      .catch(() => setBanner(null))
      .finally(() => setLoading(false));
  }, [page]);
  return { banner, loading };
}

// ─── Helper: nhận dạng loại URL video ────────────────────────
function getVideoType(url = "") {
  if (/youtu\.?be|youtube\.com\/embed/.test(url)) return "youtube";
  if (/drive\.google\.com\/file\/d\/.+\/preview/.test(url)) return "gdrive";
  return "direct";
}

function extractYouTubeId(url = "") {
  const m = url.match(/embed\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}

// ─── YouTube IFrame API loader (singleton) ───────────────────
let _ytApiReady = false;
let _ytCallbacks = [];

function loadYouTubeAPI(cb) {
  if (_ytApiReady) { cb(); return; }
  _ytCallbacks.push(cb);
  if (!window._ytApiLoading) {
    window._ytApiLoading = true;
    window.onYouTubeIframeAPIReady = () => {
      _ytApiReady = true;
      _ytCallbacks.forEach(fn => fn());
      _ytCallbacks = [];
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }
}

// ─── Video item ───────────────────────────────────────────────
// [FIX] Xóa prop onResumeSlider — không được dùng trong component này.
//       Slider resume được xử lý hoàn toàn qua onVideoEnded.
function VideoItem({ item, isActive, onPauseSlider, onVideoEnded }) {
  const videoRef    = useRef(null);
  const ytDivRef    = useRef(null);
  const ytPlayerRef = useRef(null);
  const endedRef    = useRef(onVideoEnded);
  const [muted,   setMuted]   = useState(true);
  const [playing, setPlaying] = useState(false);

  const videoType = getVideoType(item.media_url);
  const videoId   = extractYouTubeId(item.media_url);

  useEffect(() => { endedRef.current = onVideoEnded; }, [onVideoEnded]);

  // ── Khởi tạo YouTube Player khi isActive lần đầu ──────────
  useEffect(() => {
    if (videoType !== "youtube" || !isActive) return;

    loadYouTubeAPI(() => {
      if (ytPlayerRef.current) return;
      if (!ytDivRef.current)   return;

      ytPlayerRef.current = new window.YT.Player(ytDivRef.current, {
        videoId,
        playerVars: {
          autoplay:    1,
          mute:        1,
          controls:    1,
          rel:         0,
          playsinline: 1,
          loop:        0,
        },
        events: {
          onStateChange: (e) => {
            if (e.data === 0) {
              endedRef.current?.();
            }
          },
        },
      });
    });

    return () => {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch {}
        ytPlayerRef.current = null;
      }
    };
  }, [isActive, videoId, videoType]); // eslint-disable-line

  // ── Pause slider ngay khi slide video active ──────────────
  useEffect(() => {
    if (isActive) {
      onPauseSlider?.();
    } else {
      if (videoType === "direct" && videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setPlaying(false);
      }
      if (videoType === "youtube" && ytPlayerRef.current) {
        try { ytPlayerRef.current.pauseVideo(); } catch {}
      }
    }
  }, [isActive, videoType]); // eslint-disable-line

  // ── Auto-play video file khi active ──────────────────────
  useEffect(() => {
    if (videoType !== "direct" || !videoRef.current || !isActive) return;
    videoRef.current.muted = true;
    videoRef.current.play().catch(() => {});
    setPlaying(true);
  }, [isActive, videoType]);

  const handleClickPlay = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else         { videoRef.current.play().catch(() => {}); setPlaying(true); }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    const next = !muted;
    setMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
  };

  // ── YouTube ───────────────────────────────────────────────
  if (videoType === "youtube") {
    return (
      <div className="relative w-full h-full bg-black">
        <div ref={ytDivRef} className="w-full h-full" />
      </div>
    );
  }

  // ── Google Drive ──────────────────────────────────────────
  if (videoType === "gdrive") {
    return (
      <div className="relative w-full h-full">
        <iframe
          src={isActive ? item.media_url : "about:blank"}
          className="w-full h-full"
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen title="banner-gdrive"
          style={{ border: "none" }}
        />
        {isActive && (
          <div className="absolute bottom-4 right-14 z-20 px-3 py-1.5 rounded-full
            bg-black/50 text-white/60 text-xs border border-white/20 pointer-events-none backdrop-blur-sm">
            Google Drive · Bấm › để tiếp tục
          </div>
        )}
      </div>
    );
  }

  // ── Video file trực tiếp ──────────────────────────────────
  return (
    <div className="relative w-full h-full group">
      <video ref={videoRef} src={item.media_url} muted={muted} playsInline
        className="w-full h-full object-cover"
        onEnded={() => { setPlaying(false); onVideoEnded?.(); }}
      />
      {item.video_mode === "click" && (
        <button onClick={handleClickPlay}
          className="absolute inset-0 flex items-center justify-center focus:outline-none">
          {!playing && (
            <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-sm flex items-center
              justify-center border border-white/30 transition-transform hover:scale-110">
              <Play size={32} className="text-white ml-1" fill="white" />
            </div>
          )}
          {playing && (
            <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center
              justify-center opacity-0 group-hover:opacity-100 transition border border-white/20">
              <Pause size={20} className="text-white" fill="white" />
            </div>
          )}
        </button>
      )}
      <button onClick={toggleMute}
        className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm
          flex items-center justify-center text-white border border-white/20
          opacity-0 group-hover:opacity-100 transition focus:outline-none z-10">
        {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </button>
    </div>
  );
}

// ─── Main BannerSlider ────────────────────────────────────────
export default function BannerSlider({ className = "", height = "h-[460px]", page = "all" }) {
  const { banner, loading } = useBanner(page);
  const [current,      setCurrent]      = useState(0);
  const [sliderPaused, setSliderPaused] = useState(false);
  const [dragStart,    setDragStart]    = useState(null);
  const intervalRef = useRef(null);

  const items = banner?.items || [];
  const total = items.length;

  const next = useCallback(() => setCurrent(c => (c + 1) % total), [total]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + total) % total), [total]);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!banner?.auto_play || total <= 1 || sliderPaused) return;
    intervalRef.current = setInterval(next, banner.interval || 4000);
    return () => clearInterval(intervalRef.current);
  }, [banner, total, next, sliderPaused]);

  useEffect(() => {
    const fn = (e) => {
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [next, prev]);

  const handleDragStart = (e) => setDragStart(e.clientX ?? e.touches?.[0]?.clientX ?? null);
  const handleDragEnd   = (e) => {
    if (dragStart == null) return;
    const end  = e.clientX ?? e.changedTouches?.[0]?.clientX ?? dragStart;
    const diff = dragStart - end;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    setDragStart(null);
  };

  if (loading) return <div className={`${height} ${className} animate-pulse rounded-2xl bg-white/5`} />;
  if (!banner || total === 0) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl select-none ${height} ${className}`}
      onMouseDown={handleDragStart} onMouseUp={handleDragEnd}
      onTouchStart={handleDragStart} onTouchEnd={handleDragEnd}
    >
      {items.map((it, idx) => (
        <div key={it.id}
          className={`absolute inset-0 transition-opacity duration-700
            ${idx === current ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
        >
          {it.media_type === "video" ? (
            // [FIX] Bỏ prop onResumeSlider — slider resume được xử lý qua onVideoEnded
            <VideoItem
              item={it}
              isActive={idx === current}
              onPauseSlider={() => setSliderPaused(true)}
              onVideoEnded={() => {
                setSliderPaused(false);
                setCurrent(c => (c + 1) % total);
              }}
            />
          ) : it.link_url ? (
            <a href={it.link_url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
              <img src={it.media_url} alt={it.caption || `Banner ${idx + 1}`} className="w-full h-full object-cover" draggable={false} />
            </a>
          ) : (
            <img src={it.media_url} alt={it.caption || `Banner ${idx + 1}`} className="w-full h-full object-cover" draggable={false} />
          )}
          {it.caption && (
            <div className="absolute bottom-0 inset-x-0 px-6 pb-10 pt-8 z-20 bg-gradient-to-t from-black/65 to-transparent pointer-events-none">
              <p className="text-white text-sm font-medium drop-shadow">{it.caption}</p>
            </div>
          )}
        </div>
      ))}

      {total > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 hover:bg-black/60 transition focus:outline-none">
            <ChevronLeft size={18} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 hover:bg-black/60 transition focus:outline-none">
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {total > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5">
          {items.map((_, idx) => (
            <button key={idx} onClick={(e) => { e.stopPropagation(); setCurrent(idx); }}
              className={`rounded-full transition-all focus:outline-none ${idx === current ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/70"}`} />
          ))}
        </div>
      )}

      {total > 1 && (
        <div className="absolute top-3 right-3 z-30 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-xs font-medium pointer-events-none">
          {current + 1} / {total}
        </div>
      )}
    </div>
  );
}