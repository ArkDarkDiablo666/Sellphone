import { useState, useRef } from "react";
import {
  Type, AlignLeft, Image, Video, Quote, Minus,
  List, ChevronUp, ChevronDown, Trash2, Plus,
  Bold, Italic, Underline as UnderlineIcon, Link2,
  GripVertical, Eye, EyeOff
} from "lucide-react";

let _idCounter = Date.now();
const uid = () => String(++_idCounter);

const BLOCK_TYPES = [
  { type: "heading",    icon: Type,      label: "Tiêu đề lớn"  },
  { type: "subheading", icon: Type,      label: "Tiêu đề nhỏ"  },
  { type: "paragraph",  icon: AlignLeft, label: "Đoạn văn"     },
  { type: "quote",      icon: Quote,     label: "Trích dẫn"    },
  { type: "list",       icon: List,      label: "Danh sách"    },
  { type: "image",      icon: Image,     label: "Hình ảnh"     },
  { type: "video",      icon: Video,     label: "Video"        },
  { type: "divider",    icon: Minus,     label: "Đường kẻ"     },
];

function newBlock(type) {
  const id = uid();
  const base = { id, type, _idx: id };
  switch (type) {
    case "heading":    return { ...base, text: "", align: "left" };
    case "subheading": return { ...base, text: "", align: "left" };
    case "paragraph":  return { ...base, text: "", align: "left" };
    case "quote":      return { ...base, text: "" };
    case "list":       return { ...base, items: [""] };
    case "image":      return { ...base, url: "", caption: "", file: null };
    case "video":      return { ...base, url: "", file: null };
    case "divider":    return { ...base };
    default:           return base;
  }
}

// ── Text formatting toolbar ──────────────────────────────────
function FormatBar({ onFormat }) {
  const btns = [
    { cmd: "bold",      icon: Bold,          tip: "Đậm (Ctrl+B)"     },
    { cmd: "italic",    icon: Italic,        tip: "Nghiêng (Ctrl+I)" },
    { cmd: "underline", icon: UnderlineIcon, tip: "Gạch dưới"        },
  ];
  return (
    <div className="flex items-center gap-0.5 mb-2">
      {btns.map(b => (
        <button key={b.cmd} type="button" title={b.tip}
          onMouseDown={e => { e.preventDefault(); document.execCommand(b.cmd); }}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition">
          <b.icon size={12} />
        </button>
      ))}
      <div className="w-px h-4 bg-white/10 mx-1" />
      {["left","center","right"].map(align => (
        <button key={align} type="button"
          onMouseDown={e => { e.preventDefault(); onFormat && onFormat("align", align); }}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition text-[10px] font-mono">
          {align === "left" ? "⇤" : align === "center" ? "⇔" : "⇥"}
        </button>
      ))}
    </div>
  );
}

// ── Từng block ───────────────────────────────────────────────
function BlockItem({ block, index, total, onChange, onMove, onDelete, mediaFiles, onMediaChange }) {
  const fileRef  = useRef();
  const videoRef = useRef();
  const [focused, setFocused] = useState(false);

  const upd = (patch) => onChange({ ...block, ...patch });

  const handleImageFile = (file) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    upd({ url: preview, _pendingFile: true });
    onMediaChange({ ...mediaFiles, [`block_img_${block._idx}`]: file });
  };

  const handleVideoFile = (file) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    upd({ url: preview, _pendingFile: true });
    onMediaChange({ ...mediaFiles, [`block_vid_${block._idx}`]: file });
  };

  const style_map = {
    heading:    "text-2xl font-bold",
    subheading: "text-lg font-semibold",
    paragraph:  "text-sm leading-relaxed",
    quote:      "text-sm italic border-l-4 border-orange-500 pl-4 text-white/60",
  };

  return (
    <div className={`group relative flex gap-2 items-start rounded-xl transition ${focused ? "bg-white/3" : "hover:bg-white/2"} p-2`}>
      {/* Drag handle + order */}
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

      {/* Block content */}
      <div className="flex-1 min-w-0">
        {/* Text blocks */}
        {["heading","subheading","paragraph","quote"].includes(block.type) && (
          <div>
            {focused && block.type !== "quote" && <FormatBar onFormat={(_, align) => upd({ align })} />}
            <div
              contentEditable
              suppressContentEditableWarning
              onFocus={() => setFocused(true)}
              onBlur={e => { setFocused(false); upd({ text: e.target.innerHTML }); }}
              dangerouslySetInnerHTML={{ __html: block.text }}
              style={{ textAlign: block.align || "left" }}
              className={`w-full outline-none bg-transparent min-h-[28px] ${style_map[block.type]} text-white/90 empty:before:content-[attr(data-placeholder)] empty:before:text-white/20`}
              data-placeholder={
                block.type === "heading" ? "Tiêu đề lớn..." :
                block.type === "subheading" ? "Tiêu đề nhỏ..." :
                block.type === "quote" ? "Trích dẫn..." : "Nhập nội dung..."
              }
            />
          </div>
        )}

        {/* List block */}
        {block.type === "list" && (
          <div className="flex flex-col gap-1">
            {(block.items || [""]).map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 mt-0.5" />
                <input value={item}
                  onChange={e => {
                    const items = [...block.items];
                    items[i] = e.target.value;
                    upd({ items });
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); const items = [...block.items]; items.splice(i+1,0,""); upd({ items }); }
                    if (e.key === "Backspace" && !item && block.items.length > 1) {
                      e.preventDefault(); const items = block.items.filter((_,j) => j !== i); upd({ items });
                    }
                  }}
                  placeholder="Mục danh sách..."
                  className="flex-1 bg-transparent outline-none text-sm text-white/80 placeholder-white/20" />
              </div>
            ))}
            <button onClick={() => upd({ items: [...block.items, ""] })}
              className="text-xs text-orange-400/60 hover:text-orange-400 transition mt-1 w-fit">+ Thêm mục</button>
          </div>
        )}

        {/* Image block */}
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

        {/* Video block */}
        {block.type === "video" && (
          <div>
            {block.url ? (
              <div className="relative group/vid">
                <video src={block.url} controls className="w-full rounded-xl max-h-72" />
                <button onClick={() => { upd({ url: "", _pendingFile: false }); onMediaChange({ ...mediaFiles, [`block_vid_${block._idx}`]: undefined }); }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-red-400 opacity-0 group-hover/vid:opacity-100 transition">
                  <Trash2 size={13} />
                </button>
              </div>
            ) : (
              <div>
                <div onClick={() => videoRef.current?.click()}
                  className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-orange-500/40 transition mb-2">
                  <Video size={24} className="mx-auto mb-2 text-white/20" />
                  <p className="text-xs text-white/30">Click để tải video lên (MP4, MOV, WEBM)</p>
                  <input ref={videoRef} type="file" accept="video/*" className="hidden"
                    onChange={e => handleVideoFile(e.target.files[0])} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/20">hoặc dán URL:</span>
                  <input value={block.url || ""} onChange={e => upd({ url: e.target.value })}
                    placeholder="https://youtube.com/..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-orange-500/50 transition" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        {block.type === "divider" && (
          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px bg-white/10" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <div className="flex-1 h-px bg-white/10" />
          </div>
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

// ── Preview renderer (dùng cả ở InformationProduct) ─────────
export function BlockRenderer({ blocks }) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return <h2 key={i} style={{ textAlign: block.align || "left" }}
              className="text-2xl font-bold text-white"
              dangerouslySetInnerHTML={{ __html: block.text }} />;
          case "subheading":
            return <h3 key={i} style={{ textAlign: block.align || "left" }}
              className="text-lg font-semibold text-white/90"
              dangerouslySetInnerHTML={{ __html: block.text }} />;
          case "paragraph":
            return <p key={i} style={{ textAlign: block.align || "left" }}
              className="text-sm leading-relaxed text-white/70"
              dangerouslySetInnerHTML={{ __html: block.text }} />;
          case "quote":
            return <blockquote key={i}
              className="border-l-4 border-orange-500 pl-4 italic text-white/50 text-sm"
              dangerouslySetInnerHTML={{ __html: block.text }} />;
          case "list":
            return (
              <ul key={i} className="flex flex-col gap-1.5 pl-2">
                {(block.items || []).map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-white/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            );
          case "image":
            return (
              <figure key={i}>
                {block.url && <img src={block.url} alt={block.caption || ""} className="w-full rounded-xl object-cover" />}
                {block.caption && <figcaption className="text-xs text-white/30 text-center mt-1.5">{block.caption}</figcaption>}
              </figure>
            );
          case "video":
            return block.url ? (
              <div key={i} className="rounded-xl overflow-hidden">
                {block.url.includes('youtube') || block.url.includes('youtu.be') ? (
                  <iframe src={block.url.replace('watch?v=','embed/')} className="w-full aspect-video" allowFullScreen title="video" />
                ) : (
                  <video src={block.url} controls className="w-full max-h-96" />
                )}
              </div>
            ) : null;
          case "divider":
            return (
              <div key={i} className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-white/10" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                <div className="flex-1 h-px bg-white/10" />
              </div>
            );
          default: return null;
        }
      })}
    </div>
  );
}

// ── Main Editor ──────────────────────────────────────────────
export default function BlockEditor({ blocks, onChange, mediaFiles = {}, onMediaChange }) {
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [preview, setPreview] = useState(false);

  const addBlock = (type) => {
    onChange([...blocks, newBlock(type)]);
    setShowTypeMenu(false);
  };

  const updateBlock = (i, updated) => {
    const arr = [...blocks]; arr[i] = updated; onChange(arr);
  };

  const moveBlock = (i, dir) => {
    const arr = [...blocks];
    const j   = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  };

  const deleteBlock = (i) => {
    onChange(blocks.filter((_, idx) => idx !== i));
  };

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

      {/* Blocks */}
      <div className="flex flex-col gap-1 mb-4 min-h-[60px] border border-white/5 rounded-2xl p-3"
        style={{ background: "#111" }}>
        {blocks.length === 0 && (
          <div className="text-center py-8 text-white/20 text-sm">
            Chưa có nội dung — bấm "+ Thêm block" để bắt đầu
          </div>
        )}
        {blocks.map((block, i) => (
          <BlockItem key={block.id || i} block={block} index={i} total={blocks.length}
            onChange={updated => updateBlock(i, updated)}
            onMove={(idx, dir) => moveBlock(idx, dir)}
            onDelete={deleteBlock}
            mediaFiles={mediaFiles}
            onMediaChange={onMediaChange} />
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