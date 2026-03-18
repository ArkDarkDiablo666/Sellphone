import { useEffect, useState, useCallback } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

// ── Toast item ────────────────────────────────────────────────────────────────
function ToastItem({ id, type, message, onRemove }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // mount → slide in
    const t1 = setTimeout(() => setVisible(true), 10);
    // auto dismiss after 3.5s
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(id), 300);
    }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [id, onRemove]);

  const cfg = {
    success: {
      bg:     "bg-[#0d2918] border-green-500/40",
      icon:   <CheckCircle size={16} className="text-green-400 shrink-0" />,
      bar:    "bg-green-500",
      text:   "text-green-100",
    },
    error: {
      bg:     "bg-[#2a0d0d] border-red-500/40",
      icon:   <XCircle size={16} className="text-red-400 shrink-0" />,
      bar:    "bg-red-500",
      text:   "text-red-100",
    },
    info: {
      bg:     "bg-[#0d1a2a] border-blue-500/40",
      icon:   <Info size={16} className="text-blue-400 shrink-0" />,
      bar:    "bg-blue-500",
      text:   "text-blue-100",
    },
  };

  const c = cfg[type] || cfg.info;

  return (
    <div
      className={`relative flex items-start gap-3 w-80 rounded-2xl border px-4 py-3
        shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden
        transition-all duration-300
        ${c.bg}
        ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"}`}
    >
      {/* progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-[2px] ${c.bar}`}
        style={{ animation: "toast-shrink 3.5s linear forwards" }}
      />
      {c.icon}
      <p className={`flex-1 text-sm leading-snug ${c.text}`}>{message}</p>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onRemove(id), 300); }}
        className="text-white/30 hover:text-white/70 transition shrink-0 mt-0.5"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ── Container ─────────────────────────────────────────────────────────────────
export function ToastContainer({ toasts, removeToast }) {
  return (
    <>
      <style>{`
        @keyframes toast-shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem {...t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const toast = {
    success: (msg) => addToast("success", msg),
    error:   (msg) => addToast("error",   msg),
    info:    (msg) => addToast("info",    msg),
  };

  return { toasts, removeToast, toast };
}