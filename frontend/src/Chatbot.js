// Chatbot.js — Chatbot gợi ý sản phẩm nội bộ
// Dùng BM25 search từ DB, không cần LLM ngoài
// Import vào App.js và đặt <Chatbot /> ở cuối layout

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Package, ChevronRight, Bot, User, Loader2, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "./Cart";
import { useToast } from "./Toast";
import { getUser } from "./authUtils";

const API = "http://localhost:8000";

const QUICK_REPLIES = [
  "📱 iPhone mới nhất",
  "💰 Điện thoại dưới 10 triệu",
  "📸 Chụp ảnh đẹp nhất",
  "🎮 Chơi game mượt",
  "🔋 Pin trâu dùng lâu",
  "💳 Hình thức thanh toán",
  "🚚 Chính sách giao hàng",
  "🛡️ Chính sách bảo hành",
];

const WELCOME_MSG = {
  role: "bot",
  content: "Xin chào! 👋 Tôi là trợ lý PHONEZONE. Tôi có thể giúp bạn tìm điện thoại phù hợp theo ngân sách, nhu cầu hoặc thương hiệu yêu thích. Bạn muốn tìm gì?",
  products: [],
};


// Render reply text với markdown đơn giản: **bold**, xuống dòng
function renderReply(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    // **bold** → <strong>
    const parts = line.split(/\*\*(.+?)\*\*/g);
    const rendered = parts.map((p, j) =>
      j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{p}</strong> : p
    );
    return (
      <span key={i}>
        {rendered}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    );
  });
}

function ProductCard({ p, onNavigate, onAddCart, toast }) {
  const imgs = (p.variants || []).map(v => v.image).filter(Boolean);
  const displayImg = imgs[0] || p.image;
  const [imgIdx, setImgIdx] = useState(0);
  const timerRef = useRef(null);

  // Auto-slide ảnh biến thể
  useEffect(() => {
    if (imgs.length <= 1) return;
    timerRef.current = setInterval(() => setImgIdx(i => (i + 1) % imgs.length), 2000);
    return () => clearInterval(timerRef.current);
  }, [imgs.length]);

  const currentImg = imgs.length > 0 ? imgs[imgIdx % imgs.length] : displayImg;
  const firstV = (p.variants || [])[0] || {};
  const specTags = [firstV.cpu && firstV.cpu.split(' ')[0], firstV.battery, firstV.screen_size].filter(Boolean).slice(0,2);

  return (
    <div
      className="flex-shrink-0 w-36 rounded-xl overflow-hidden cursor-pointer border border-white/10 bg-white/[0.03] hover:border-orange-500/40 transition-all duration-200 hover:-translate-y-0.5"
      onClick={() => onNavigate(p.id)}
    >
      <div className="w-full h-24 bg-gray-800 flex items-center justify-center relative overflow-hidden">
        {currentImg
          ? <img src={currentImg} alt={p.name} className="w-full h-full object-contain p-1.5 transition-opacity duration-300" />
          : <Package size={20} className="text-white/20" />}
        {imgs.length > 1 && (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
            {imgs.slice(0, 4).map((_, i) => (
              <span key={i} className={`rounded-full transition-all ${i === imgIdx % imgs.length ? "w-2.5 h-1 bg-white" : "w-1 h-1 bg-white/30"}`} />
            ))}
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-[10px] font-semibold text-white line-clamp-2 leading-tight mb-1">{p.name}</p>
        {specTags.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mb-1">
            {specTags.map((s,i) => <span key={i} className="text-[8px] px-1 py-0.5 rounded bg-white/8 text-white/40 truncate">{s}</span>)}
          </div>
        )}
        {p.rating_avg > 0 && (
          <div className="flex items-center gap-0.5 mb-1">
            <span className="text-yellow-400 text-[9px]">★</span>
            <span className="text-[9px] text-white/40">{p.rating_avg} ({p.rating_count})</span>
          </div>
        )}
        <p className="text-[11px] font-bold text-orange-400">
          {p.min_price ? p.min_price.toLocaleString("vi-VN") + "đ" : "Liên hệ"}
        </p>
        <button
          onClick={e => { e.stopPropagation(); onAddCart(p); }}
          className="mt-1.5 w-full py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/40 text-orange-300 text-[9px] font-medium transition flex items-center justify-center gap-1"
        >
          <ShoppingCart size={9} /> Thêm giỏ
        </button>
      </div>
    </div>
  );
}

export default function Chatbot() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { toast } = useToast();
  const user = getUser();

  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [unread,   setUnread]   = useState(0);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { if (open) { scrollToBottom(); setUnread(0); } }, [messages, open, scrollToBottom]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg = { role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages
        .filter(m => m.role !== "system")
        .slice(-16)
        .map(m => ({ role: m.role === "bot" ? "assistant" : "user", content: m.content }));

      const res = await fetch(`${API}/api/chatbot/suggest/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:     msg,
          history,
          customer_id: user?.id || null,
        }),
      });

      const data = await res.json();
      const botMsg = {
        role:         "bot",
        content:      data.reply || "Đã có lỗi xảy ra.",
        products:     data.show_products !== false ? (data.products || []) : [],
        intent:       data.intent,
        show_products: data.show_products,
      };
      setMessages(prev => [...prev, botMsg]);
      if (!open) setUnread(u => u + 1);
    } catch {
      setMessages(prev => [...prev, {
        role: "bot",
        content: "Xin lỗi, không thể kết nối server. Vui lòng thử lại.",
        products: [],
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (p) => {
    const cheapest = [...(p.variants || [])]
      .sort((a, b) => (a.price || 0) - (b.price || 0))[0];
    if (!cheapest) return;
    addItem(
      { id: p.id, name: p.name },
      { id: cheapest.id, price: cheapest.price, color: cheapest.color, storage: cheapest.storage, ram: cheapest.ram, image: cheapest.image },
      1
    );
    toast.success(`Đã thêm ${p.name} vào giỏ hàng!`);
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-[9998] w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/30 flex items-center justify-center text-white transition-all duration-300 hover:scale-110 active:scale-95"
        aria-label="Chatbot tư vấn"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[9997] w-80 rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
          style={{
            background: "#141414",
            height: "520px",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10"
            style={{ background: "linear-gradient(135deg,#1a1a1a,#222)" }}>
            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
              <Bot size={16} className="text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Trợ lý PHONEZONE</p>
              <p className="text-[10px] text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Online
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white transition">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 scrollbar-hide">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar */}
                <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5
                  ${m.role === "user" ? "bg-orange-500/20" : "bg-white/8"}`}>
                  {m.role === "user"
                    ? <User size={12} className="text-orange-400" />
                    : <Bot size={12} className="text-white/40" />}
                </div>

                <div className={`flex flex-col gap-1.5 max-w-[85%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                  {/* Bubble */}
                  <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed
                    ${m.role === "user"
                      ? "bg-orange-500 text-white rounded-tr-sm"
                      : "bg-white/8 text-white/85 rounded-tl-sm border border-white/8"}`}>
                    {renderReply(m.content)}
                  </div>

                  {/* Product cards */}
                  {m.products?.length > 0 && (
                    <div className="w-full">
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide w-[260px]">
                        {m.products.map(p => (
                          <ProductCard
                            key={p.id}
                            p={p}
                            onNavigate={id => { navigate(`/product/${id}`); setOpen(false); }}
                            onAddCart={handleAddToCart}
                            toast={toast}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => navigate("/product")}
                        className="mt-1.5 text-[10px] text-orange-400 hover:text-orange-300 flex items-center gap-1 transition"
                      >
                        Xem tất cả sản phẩm <ChevronRight size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex gap-2 items-center">
                <div className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center">
                  <Bot size={12} className="text-white/40" />
                </div>
                <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-white/8 border border-white/8">
                  <Loader2 size={14} className="text-white/40 animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick replies — hiện khi messages <= 1 */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {QUICK_REPLIES.map(qr => (
                <button
                  key={qr}
                  onClick={() => sendMessage(qr)}
                  className="px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-300 text-[10px] hover:bg-orange-500/20 transition"
                >
                  {qr}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-white/8">
            <div className="flex gap-2 items-center bg-white/5 rounded-xl border border-white/10 px-3 py-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                placeholder="Hỏi tôi về sản phẩm..."
                className="flex-1 bg-transparent text-xs text-white placeholder:text-white/25 outline-none"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-30 flex items-center justify-center text-white transition shrink-0"
              >
                <Send size={12} />
              </button>
            </div>
            <p className="text-[9px] text-white/15 text-center mt-1.5">
              Powered by PHONEZONE AI
            </p>
          </div>
        </div>
      )}
    </>
  );
}