import { useState, useRef, useEffect } from "react";
import {
  Type, AlignLeft, Image, Video, Quote, Minus,
  List, ChevronUp, ChevronDown, Trash2, Plus,
  Bold, Italic, Underline as UnderlineIcon, Link2,
  GripVertical, Eye, EyeOff, BookOpen, Hash, Palette,
  AlignJustify,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// VIDEO URL HELPER
// ─────────────────────────────────────────────────────────────
function normalizeVideoUrl(url = "") {
  const s = url.trim();
  if (!s) return { embed: "", type: "unknown" };

  // YouTube
  let m = s.match(/(?:youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (!m) m = s.match(/youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  if (m) return { embed: `https://www.youtube.com/embed/${m[1]}?rel=0`, type: "youtube", id: m[1] };

  // Google Drive
  let gm = s.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  if (!gm) gm = s.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([A-Za-z0-9_-]+)/);
  if (gm) return { embed: `https://drive.google.com/file/d/${gm[1]}/preview`, type: "gdrive", id: gm[1] };

  // URL video trực tiếp (.mp4, .webm...)
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(s)) return { embed: s, type: "direct" };

  return { embed: s, type: "unknown" };
}

function isVideoUrl(url = "") {
  return /youtu\.?be|youtube\.com|drive\.google\.com|\.(mp4|webm|ogg|mov)/i.test(url);
}


//  HELPERS
// ─────────────────────────────────────────────────────────────
let _idCounter = Date.now();
const uid = () => String(++_idCounter);

function slugify(str) {
  return (str || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-") || "section-" + uid();
}

function stripHtml(html) {
  return (html || "").replace(/<[^>]*>/g, "");
}

/** Lấy danh sách heading có anchor từ blocks – dùng cho TOC */
function extractHeadings(blocks) {
  return (blocks || [])
    .filter(b => (b.type === "heading" || b.type === "subheading") && b.text)
    .map(b => ({
      id:    b.id,
      text:  stripHtml(b.text),
      level: b.type === "heading" ? 2 : 3,
      slug:  b.slug || slugify(stripHtml(b.text)),
    }));
}

// ─────────────────────────────────────────────────────────────
//  BLOCK TYPES
// ─────────────────────────────────────────────────────────────
const BLOCK_TYPES = [
  { type: "heading",    icon: Type,      label: "Tiêu đề lớn"  },
  { type: "subheading", icon: Hash,      label: "Tiêu đề nhỏ"  },
  { type: "paragraph",  icon: AlignLeft, label: "Đoạn văn"     },
  { type: "quote",      icon: Quote,     label: "Trích dẫn"    },
  { type: "list",       icon: List,      label: "Danh sách"    },
  { type: "image",      icon: Image,     label: "Hình ảnh"     },
  { type: "video",      icon: Video,     label: "Video"        },
  { type: "divider",    icon: Minus,     label: "Đường kẻ"     },
  { type: "toc",        icon: BookOpen,  label: "Mục lục"      },
];

function newBlock(type) {
  const id   = uid();
  const base = { id, type, _idx: id };
  switch (type) {
    case "heading":    return { ...base, text: "", align: "left", slug: "" };
    case "subheading": return { ...base, text: "", align: "left", slug: "" };
    case "paragraph":  return { ...base, text: "", align: "left" };
    case "quote":      return { ...base, text: "" };
    case "list":       return { ...base, items: [""] };
    case "image":      return { ...base, url: "", caption: "" };
    case "video":      return { ...base, url: "" };
    case "divider":    return { ...base };
    case "toc":        return { ...base, title: "Mục lục" };
    default:           return base;
  }
}

// ─────────────────────────────────────────────────────────────
//  COLOR PALETTE
// ─────────────────────────────────────────────────────────────
const TEXT_COLORS = [
  { label: "Trắng",       value: "#ffffff" },
  { label: "Cam",         value: "#ff9500" },
  { label: "Đỏ",          value: "#ff3b30" },
  { label: "Xanh lá",    value: "#30d158" },
  { label: "Xanh dương",  value: "#0a84ff" },
  { label: "Tím",         value: "#bf5af2" },
  { label: "Vàng",        value: "#ffd60a" },
  { label: "Xám",         value: "#8e8e93" },
];

// ─────────────────────────────────────────────────────────────
//  FORMAT BAR  (thêm căn đều / justify)
// ─────────────────────────────────────────────────────────────
function FormatBar({ onFormat, showAlign = true }) {
  const [showColors, setShowColors] = useState(false);
  const colorRef = useRef(null);

  useEffect(() => {
    const fn = (e) => {
      if (colorRef.current && !colorRef.current.contains(e.target)) setShowColors(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const exec = (cmd, val = null) => document.execCommand(cmd, false, val);

  return (
    <div className="flex items-center gap-0.5 mb-2 flex-wrap">
      {/* Bold / Italic / Underline */}
      {[
        { cmd: "bold",      icon: Bold,          tip: "Đậm"       },
        { cmd: "italic",    icon: Italic,        tip: "Nghiêng"   },
        { cmd: "underline", icon: UnderlineIcon, tip: "Gạch dưới" },
      ].map(b => (
        <button key={b.cmd} type="button" title={b.tip}
          onMouseDown={e => { e.preventDefault(); exec(b.cmd); }}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition">
          <b.icon size={12} />
        </button>
      ))}

      {/* Chèn link */}
      <button type="button" title="Chèn liên kết"
        onMouseDown={e => {
          e.preventDefault();
          const url = window.prompt("Nhập URL liên kết:");
          if (url) exec("createLink", url);
        }}
        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition">
        <Link2 size={12} />
      </button>

      {/* Màu chữ */}
      <div className="relative" ref={colorRef}>
        <button type="button" title="Màu chữ"
          onMouseDown={e => { e.preventDefault(); setShowColors(s => !s); }}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition">
          <Palette size={12} />
        </button>

        {showColors && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#1e1e1e] border border-white/10 rounded-xl p-2.5 shadow-2xl"
            style={{ minWidth: 180 }}>
            <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5 px-0.5">Màu chữ</p>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {TEXT_COLORS.map(c => (
                <button key={c.value} type="button" title={c.label}
                  onMouseDown={e => { e.preventDefault(); exec("foreColor", c.value); setShowColors(false); }}
                  className="w-5 h-5 rounded-full border border-white/20 hover:scale-125 transition flex-shrink-0"
                  style={{ backgroundColor: c.value }} />
              ))}
              <label title="Màu tùy chỉnh"
                className="w-5 h-5 rounded-full border border-dashed border-white/30 hover:border-orange-400 flex items-center justify-center cursor-pointer flex-shrink-0">
                <span className="text-[8px] text-white/40 select-none">+</span>
                <input type="color" className="opacity-0 absolute w-0 h-0"
                  onChange={e => exec("foreColor", e.target.value)} />
              </label>
            </div>

            <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5 px-0.5">Nền chữ</p>
            <div className="flex flex-wrap gap-1.5">
              {TEXT_COLORS.filter(c => c.value !== "#ffffff").map(c => (
                <button key={c.value} type="button" title={c.label}
                  onMouseDown={e => { e.preventDefault(); exec("hiliteColor", c.value); setShowColors(false); }}
                  className="w-5 h-5 rounded border border-white/20 hover:scale-125 transition flex-shrink-0"
                  style={{ backgroundColor: c.value }} />
              ))}
              <button type="button" title="Bỏ nền"
                onMouseDown={e => { e.preventDefault(); exec("hiliteColor", "transparent"); setShowColors(false); }}
                className="w-5 h-5 rounded border border-dashed border-white/30 hover:border-orange-400 flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] text-white/40">∅</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Căn chỉnh – bao gồm căn đều */}
      {showAlign && (
        <>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          {[
            { val: "left",    label: "⇤",            tip: "Căn trái"  },
            { val: "center",  label: "⇔",            tip: "Căn giữa"  },
            { val: "right",   label: "⇥",            tip: "Căn phải"  },
            { val: "justify", icon: AlignJustify,    tip: "Căn đều"   },
          ].map(a => (
            <button key={a.val} type="button"
              onMouseDown={e => { e.preventDefault(); onFormat && onFormat("align", a.val); }}
              title={a.tip}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition">
              {a.icon
                ? <a.icon size={12} />
                : <span className="text-[10px] font-mono">{a.label}</span>}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  BLOCK ITEM
// ─────────────────────────────────────────────────────────────
function BlockItem({ block, index, total, onChange, onMove, onDelete, mediaFiles, onMediaChange, allBlocks }) {
  const fileRef  = useRef();
  const videoRef = useRef();
  const [focused,        setFocused]        = useState(false);
  const [videoInputMode, setVideoInputMode] = useState("file"); // "file" | "url"
  const [videoUrlDraft,  setVideoUrlDraft]  = useState("");     // URL đang nhập
  const [videoUrlError,  setVideoUrlError]  = useState("");

  const upd = (patch) => onChange({ ...block, ...patch });

  const handleImageFile = (file) => {
    if (!file) return;
    upd({ url: URL.createObjectURL(file), _pendingFile: true });
    onMediaChange({ ...mediaFiles, [`block_img_${block._idx}`]: file });
  };

  const handleVideoFile = (file) => {
    if (!file) return;
    upd({ url: URL.createObjectURL(file), _pendingFile: true });
    onMediaChange({ ...mediaFiles, [`block_vid_${block._idx}`]: file });
  };

  const handleVideoUrlConfirm = () => {
    const { embed, type } = normalizeVideoUrl(videoUrlDraft);
    if (!videoUrlDraft.trim()) { setVideoUrlError("Vui lòng nhập URL"); return; }
    if (type === "unknown") { setVideoUrlError("Chỉ hỗ trợ YouTube, Google Drive, hoặc link video trực tiếp (.mp4)"); return; }
    setVideoUrlError("");
    upd({ url: embed, _pendingFile: false });
    onMediaChange({ ...mediaFiles, [`block_vid_${block._idx}`]: undefined });
  };

  const styleMap = {
    heading:    "text-2xl font-bold",
    subheading: "text-lg font-semibold",
    paragraph:  "text-sm leading-relaxed",
    quote:      "text-sm italic border-l-4 border-orange-500 pl-4 text-white/60",
  };

  return (
    <div className={`group relative flex gap-2 items-start rounded-xl transition
      ${focused ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"} p-2`}>

      {/* Move handles */}
      <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
        <GripVertical size={14} className="text-white/20 cursor-grab" />
        <button onClick={() => onMove(index, -1)} disabled={index === 0}
          className="text-white/20 hover:text-white/60 disabled:opacity-20 transition p-0.5">
          <ChevronUp size={12} />
        </button>
        <button onClick={() => onMove(index, 1)} disabled={index === total - 1}
          className="text-white/20 hover:text-white/60 disabled:opacity-20 transition p-0.5">
          <ChevronDown size={12} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">

        {/* ── HEADING ── */}
        {block.type === "heading" && (
          <div>
            {focused && <FormatBar onFormat={(_, a) => upd({ align: a })} />}
            <div contentEditable suppressContentEditableWarning
              onFocus={() => setFocused(true)}
              onBlur={e => {
                setFocused(false);
                const html  = e.target.innerHTML;
                const plain = stripHtml(html);
                upd({ text: html, slug: slugify(plain) });
              }}
              dangerouslySetInnerHTML={{ __html: block.text }}
              style={{ textAlign: block.align || "left" }}
              data-placeholder="Tiêu đề lớn..."
              className={`w-full outline-none bg-transparent min-h-[32px] ${styleMap.heading}
                text-white/90 empty:before:content-[attr(data-placeholder)] empty:before:text-white/20`} />
            {block.slug && (
              <p className="text-[9px] text-white/20 mt-0.5 select-none">
                anchor: <code className="text-orange-400/50">#{block.slug}</code>
              </p>
            )}
          </div>
        )}

        {/* ── SUBHEADING ── */}
        {block.type === "subheading" && (
          <div>
            {focused && <FormatBar onFormat={(_, a) => upd({ align: a })} />}
            <div contentEditable suppressContentEditableWarning
              onFocus={() => setFocused(true)}
              onBlur={e => {
                setFocused(false);
                const html  = e.target.innerHTML;
                const plain = stripHtml(html);
                upd({ text: html, slug: slugify(plain) });
              }}
              dangerouslySetInnerHTML={{ __html: block.text }}
              style={{ textAlign: block.align || "left" }}
              data-placeholder="Tiêu đề nhỏ..."
              className={`w-full outline-none bg-transparent min-h-[28px] ${styleMap.subheading}
                text-white/90 empty:before:content-[attr(data-placeholder)] empty:before:text-white/20`} />
            {block.slug && (
              <p className="text-[9px] text-white/20 mt-0.5 select-none">
                anchor: <code className="text-orange-400/50">#{block.slug}</code>
              </p>
            )}
          </div>
        )}

        {/* ── PARAGRAPH ── */}
        {block.type === "paragraph" && (
          <div>
            {focused && <FormatBar onFormat={(_, a) => upd({ align: a })} />}
            <div contentEditable suppressContentEditableWarning
              onFocus={() => setFocused(true)}
              onBlur={e => { setFocused(false); upd({ text: e.target.innerHTML }); }}
              dangerouslySetInnerHTML={{ __html: block.text }}
              style={{ textAlign: block.align || "left" }}
              data-placeholder="Nhập nội dung..."
              className={`w-full outline-none bg-transparent min-h-[28px] ${styleMap.paragraph}
                text-white/90 empty:before:content-[attr(data-placeholder)] empty:before:text-white/20`} />
          </div>
        )}

        {/* ── QUOTE ── */}
        {block.type === "quote" && (
          <div>
            {focused && <FormatBar showAlign={false} />}
            <div contentEditable suppressContentEditableWarning
              onFocus={() => setFocused(true)}
              onBlur={e => { setFocused(false); upd({ text: e.target.innerHTML }); }}
              dangerouslySetInnerHTML={{ __html: block.text }}
              data-placeholder="Trích dẫn..."
              className={`w-full outline-none bg-transparent min-h-[28px] ${styleMap.quote}
                empty:before:content-[attr(data-placeholder)] empty:before:text-white/20`} />
          </div>
        )}

        {/* ── LIST ── */}
        {block.type === "list" && (
          <div className="flex flex-col gap-1">
            {(block.items || [""]).map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 mt-0.5" />
                <input value={item}
                  onChange={e => { const items = [...block.items]; items[i] = e.target.value; upd({ items }); }}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); const items = [...block.items]; items.splice(i+1,0,""); upd({ items }); }
                    if (e.key === "Backspace" && !item && block.items.length > 1) { e.preventDefault(); upd({ items: block.items.filter((_,j) => j !== i) }); }
                  }}
                  placeholder="Mục danh sách..."
                  className="flex-1 bg-transparent outline-none text-sm text-white/80 placeholder-white/20" />
              </div>
            ))}
            <button onClick={() => upd({ items: [...block.items, ""] })}
              className="text-xs text-orange-400/60 hover:text-orange-400 transition mt-1 w-fit">
              + Thêm mục
            </button>
          </div>
        )}

        {/* ── IMAGE ── */}
        {block.type === "image" && (
          <div>
            {block.url ? (
              <div className="relative group/img">
                <img src={block.url} alt={block.caption} className="w-full rounded-xl object-cover max-h-80" />
                <button onClick={() => { upd({ url: "", _pendingFile: false }); onMediaChange({ ...mediaFiles, [`block_img_${block._idx}`]: undefined }); }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-red-400 opacity-0 group-hover/img:opacity-100 transition">
                  <Trash2 size={13} />
                </button>
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-orange-500/40 transition">
                <Image size={24} className="mx-auto mb-2 text-white/20" />
                <p className="text-xs text-white/30">Click hoặc kéo thả ảnh vào đây</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => handleImageFile(e.target.files[0])} />
              </div>
            )}
            <input value={block.caption || ""} onChange={e => upd({ caption: e.target.value })}
              placeholder="Chú thích ảnh (tùy chọn)"
              className="mt-2 w-full bg-transparent text-xs text-white/40 outline-none placeholder-white/20 border-b border-white/5 py-1 focus:border-white/20 transition" />
          </div>
        )}

        {/* ── VIDEO ── */}
        {block.type === "video" && (
          <div>
            {block.url ? (
              /* ── Đã có video — hiển thị preview + nút xóa ── */
              <div className="relative group/vid">
                {(() => {
                  const { type, embed, id } = normalizeVideoUrl(block.url);
                  if (type === "youtube") return (
                    <div className="rounded-xl overflow-hidden aspect-video bg-black">
                      <iframe src={embed} className="w-full h-full" allowFullScreen title="YouTube video"/>
                    </div>
                  );
                  if (type === "gdrive") return (
                    <div className="rounded-xl overflow-hidden aspect-video bg-black">
                      <iframe src={embed} className="w-full h-full" allowFullScreen title="Google Drive video"/>
                    </div>
                  );
                  return <video src={embed} controls className="w-full rounded-xl max-h-72"/>;
                })()}
                <button onClick={() => { upd({ url: "", _pendingFile: false }); onMediaChange({ ...mediaFiles, [`block_vid_${block._idx}`]: undefined }); setVideoUrlDraft(""); }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-red-400 opacity-0 group-hover/vid:opacity-100 transition focus:outline-none">
                  <Trash2 size={13} />
                </button>
                {/* Badge loại video */}
                {(() => {
                  const { type } = normalizeVideoUrl(block.url);
                  const labels = { youtube: "🎬 YouTube", gdrive: "📁 Google Drive", direct: "🎥 Video file" };
                  return labels[type] ? (
                    <span className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-white/60 border border-white/10">
                      {labels[type]}
                    </span>
                  ) : null;
                })()}
              </div>
            ) : (
              /* ── Chưa có video — tab chọn cách nhập ── */
              <div>
                {/* Tab switch */}
                <div className="flex gap-1 mb-3 bg-white/5 rounded-xl p-1">
                  {[{v:"file",l:"📁 Upload file"},{v:"url",l:"🔗 YouTube / Drive"}].map(tab => (
                    <button key={tab.v} onClick={() => { setVideoInputMode(tab.v); setVideoUrlError(""); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition focus:outline-none
                        ${videoInputMode === tab.v
                          ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                          : "text-white/40 hover:text-white/60"}`}>
                      {tab.l}
                    </button>
                  ))}
                </div>

                {/* Upload file */}
                {videoInputMode === "file" && (
                  <div onClick={() => videoRef.current?.click()}
                    className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-orange-500/40 transition">
                    <Video size={24} className="mx-auto mb-2 text-white/20"/>
                    <p className="text-xs text-white/30">Click để tải video lên</p>
                    <p className="text-[10px] text-white/20 mt-1">Video ≤ 95MB (MP4, WebM)</p>
                    <input ref={videoRef} type="file" accept="video/*" className="hidden"
                      onChange={e => handleVideoFile(e.target.files[0])}/>
                  </div>
                )}

                {/* Nhập URL */}
                {videoInputMode === "url" && (
                  <div>
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 mb-3">
                      <p className="text-[11px] text-blue-400/80 leading-relaxed">
                        Hỗ trợ <span className="text-white/70">YouTube</span>, <span className="text-white/70">Google Drive</span>, hoặc link video trực tiếp (.mp4).
                        Video không giới hạn dung lượng.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={videoUrlDraft}
                        onChange={e => { setVideoUrlDraft(e.target.value); setVideoUrlError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleVideoUrlConfirm()}
                        placeholder="https://youtu.be/... hoặc https://drive.google.com/..."
                        className={`flex-1 bg-white/5 border rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none transition
                          ${videoUrlError ? "border-red-500/50" : "border-white/10 focus:border-orange-500/50"}`}/>
                      <button onClick={handleVideoUrlConfirm}
                        className="px-4 py-2 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-medium hover:bg-orange-500/30 transition focus:outline-none whitespace-nowrap">
                        Chèn
                      </button>
                    </div>
                    {videoUrlError && <p className="text-red-400 text-[11px] mt-1 pl-1">{videoUrlError}</p>}

                    {/* Preview YouTube realtime */}
                    {videoUrlDraft && (() => {
                      const { type, embed, id } = normalizeVideoUrl(videoUrlDraft);
                      if (type === "youtube") return (
                        <div className="mt-3 rounded-xl overflow-hidden aspect-video bg-black">
                          <iframe src={embed} className="w-full h-full" allowFullScreen title="preview"/>
                        </div>
                      );
                      if (type === "gdrive") return (
                        <div className="mt-2 p-2.5 bg-green-500/5 border border-green-500/20 rounded-xl flex items-center gap-2">
                          <span>✅</span>
                          <p className="text-[11px] text-green-400/80">Google Drive hợp lệ — sẽ hiển thị sau khi lưu</p>
                        </div>
                      );
                      if (type === "direct") return (
                        <div className="mt-2 p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl flex items-center gap-2">
                          <span>🎥</span>
                          <p className="text-[11px] text-blue-400/80">Link video trực tiếp hợp lệ</p>
                        </div>
                      );
                      return null;
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── DIVIDER ── */}
        {block.type === "divider" && (
          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px bg-white/10" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <div className="flex-1 h-px bg-white/10" />
          </div>
        )}

        {/* ── TABLE OF CONTENTS ── */}
        {block.type === "toc" && (
          <TocEditorBlock block={block} onChange={upd} allBlocks={allBlocks} />
        )}

      </div>

      {/* Delete */}
      <button onClick={() => onDelete(index)}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition shrink-0 mt-0.5">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  TOC EDITOR (preview trong admin)
// ─────────────────────────────────────────────────────────────
function TocEditorBlock({ block, onChange, allBlocks }) {
  const headings = extractHeadings(allBlocks);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <BookOpen size={13} className="text-orange-400 shrink-0" />
        <input value={block.title || "Mục lục"}
          onChange={e => onChange({ ...block, title: e.target.value })}
          placeholder="Tiêu đề mục lục"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-orange-500/50 transition" />
      </div>
      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
        <p className="text-[9px] text-white/25 uppercase tracking-wider mb-2">Xem trước</p>
        {headings.length === 0 ? (
          <p className="text-xs text-white/20 italic">
            Chưa có tiêu đề. Thêm block "Tiêu đề lớn" hoặc "Tiêu đề nhỏ" để tạo mục lục tự động.
          </p>
        ) : (
          <ol className="flex flex-col gap-1">
            {headings.map((h, i) => (
              <li key={h.id} style={{ paddingLeft: `${(h.level - 2) * 14}px` }}
                className="flex items-baseline gap-1.5">
                <span className="text-orange-400/50 text-[10px] shrink-0">{i + 1}.</span>
                <span className="text-xs text-white/50">{h.text}</span>
                <code className="text-[9px] text-white/20 ml-auto shrink-0">#{h.slug}</code>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  BLOCK RENDERER – dùng ở InformationProduct / Blog frontend
// ─────────────────────────────────────────────────────────────
export function BlockRenderer({ blocks }) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className="flex flex-col gap-5">
      <style>{`
        html { scroll-behavior: smooth; }
        .bk-link a { color: #ff9500; text-decoration: underline; }
      `}</style>
      {blocks.map((block, i) => (
        <BlockRenderItem key={block.id || i} block={block} allBlocks={blocks} />
      ))}
    </div>
  );
}

function BlockRenderItem({ block, allBlocks }) {
  switch (block.type) {

    case "heading": {
      const slug = block.slug || slugify(stripHtml(block.text || ""));
      return (
        <h2 id={slug}
          style={{ textAlign: block.align || "left" }}
          className="text-2xl font-bold text-white scroll-mt-24"
          dangerouslySetInnerHTML={{ __html: block.text }} />
      );
    }

    case "subheading": {
      const slug = block.slug || slugify(stripHtml(block.text || ""));
      return (
        <h3 id={slug}
          style={{ textAlign: block.align || "left" }}
          className="text-lg font-semibold text-white/90 scroll-mt-24"
          dangerouslySetInnerHTML={{ __html: block.text }} />
      );
    }

    case "paragraph":
      return (
        <div style={{ textAlign: block.align || "left" }}
          className="bk-link text-sm leading-relaxed text-white/70"
          dangerouslySetInnerHTML={{ __html: block.text }} />
      );

    case "quote":
      return (
        <blockquote className="bk-link border-l-4 border-orange-500 pl-4 italic text-white/50 text-sm"
          dangerouslySetInnerHTML={{ __html: block.text }} />
      );

    case "list":
      return (
        <ul className="flex flex-col gap-1.5 pl-2">
          {(block.items || []).map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 mt-1.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case "image":
      return block.url ? (
        <figure>
          <img src={block.url} alt={block.caption || ""} className="w-full rounded-xl object-cover" />
          {block.caption && <figcaption className="text-xs text-white/30 text-center mt-1.5">{block.caption}</figcaption>}
        </figure>
      ) : null;

    case "video":
      return block.url ? (() => {
        const { type, embed } = normalizeVideoUrl(block.url);
        if (type === "youtube" || type === "gdrive") return (
          <div className="rounded-xl overflow-hidden aspect-video bg-black">
            <iframe src={embed} className="w-full h-full" allowFullScreen title="video"/>
          </div>
        );
        return <video src={embed} controls className="w-full rounded-xl max-h-96"/>;
      })() : null;

    case "divider":
      return (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-white/10" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <div className="flex-1 h-px bg-white/10" />
        </div>
      );

    case "toc": {
      const headings = extractHeadings(allBlocks || []);
      if (headings.length === 0) return null;
      return (
        <nav className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 my-2">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={14} className="text-orange-400" />
            <span className="text-sm font-semibold text-white/80">{block.title || "Mục lục"}</span>
          </div>
          <ol className="flex flex-col gap-1.5">
            {headings.map((h, i) => (
              <li key={h.id} style={{ paddingLeft: `${(h.level - 2) * 16}px` }}
                className="flex items-baseline gap-2">
                <span className="text-orange-400/60 text-xs shrink-0">{i + 1}.</span>
                <a href={`#${h.slug}`}
                  className="text-sm text-white/60 hover:text-orange-400 transition underline-offset-2 hover:underline">
                  {h.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      );
    }

    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  MAIN EDITOR
// ─────────────────────────────────────────────────────────────
export default function BlockEditor({ blocks, onChange, mediaFiles = {}, onMediaChange }) {
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [preview,      setPreview]      = useState(false);

  const addBlock    = (type) => { onChange([...blocks, newBlock(type)]); setShowTypeMenu(false); };
  const updateBlock = (i, updated) => { const arr = [...blocks]; arr[i] = updated; onChange(arr); };
  const moveBlock   = (i, dir) => {
    const arr = [...blocks]; const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; onChange(arr);
  };
  const deleteBlock = (i) => onChange(blocks.filter((_, idx) => idx !== i));

  if (preview) return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setPreview(false)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs transition">
          <EyeOff size={13} /> Thoát xem trước
        </button>
      </div>
      <div className="border border-white/5 rounded-2xl p-6" style={{ background: "#111" }}>
        <BlockRenderer blocks={blocks} />
      </div>
    </div>
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/30">{blocks.length} block{blocks.length !== 1 ? "s" : ""}</span>
        <button onClick={() => setPreview(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs transition">
          <Eye size={12} /> Xem trước
        </button>
      </div>

      {/* Block list */}
      <div className="flex flex-col gap-1 mb-4 min-h-[60px] border border-white/5 rounded-2xl p-3"
        style={{ background: "#111" }}>
        {blocks.length === 0 && (
          <div className="text-center py-8 text-white/20 text-sm">
            Chưa có nội dung — bấm "+ Thêm block" để bắt đầu
          </div>
        )}
        {blocks.map((block, i) => (
          <BlockItem
            key={block.id || i}
            block={block} index={i} total={blocks.length}
            onChange={updated => updateBlock(i, updated)}
            onMove={(idx, dir) => moveBlock(idx, dir)}
            onDelete={deleteBlock}
            mediaFiles={mediaFiles}
            onMediaChange={onMediaChange}
            allBlocks={blocks}
          />
        ))}
      </div>

      {/* Add block */}
      <div className="relative">
        <button onClick={() => setShowTypeMenu(!showTypeMenu)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-orange-500/30 hover:border-orange-500/60 text-orange-400/70 hover:text-orange-400 text-sm transition w-full justify-center">
          <Plus size={14} /> Thêm block
        </button>

        {showTypeMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-white/10 overflow-hidden shadow-2xl z-50"
            style={{ background: "#1a1a1a" }}>
            <div className="grid grid-cols-4 gap-0">
              {BLOCK_TYPES.map(bt => (
                <button key={bt.type} onClick={() => addBlock(bt.type)}
                  className="flex flex-col items-center gap-1.5 p-3 hover:bg-white/5 transition text-center">
                  <bt.icon size={18} className="text-orange-400/70" />
                  <span className="text-[10px] text-white/50 leading-tight">{bt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}