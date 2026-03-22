// ============================================================
// Pagination.js — Component phân trang dùng chung
// Dùng cho: Product, Blog, Orders, Searchpage, Admin (các tab)
//
// Props:
//   page        — trang hiện tại (1-indexed)
//   totalPages  — tổng số trang
//   total       — tổng số mục (để hiển thị "X - Y / Z")
//   pageSize    — số mục mỗi trang
//   onChange    — fn(newPage) khi người dùng chọn trang
//   className   — class bổ sung (optional)
//   compact     — true = chỉ hiện prev/next + số trang (dành cho admin)
// ============================================================

import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
  className = "",
  compact = false,
}) {
  if (!totalPages || totalPages <= 1) return null;

  const from = Math.min((page - 1) * pageSize + 1, total);
  const to   = Math.min(page * pageSize, total);

  // Tạo dãy trang hiển thị (tối đa 7 nút, có dấu "…")
  const buildPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    if (page <= 4) {
      pages.push(1, 2, 3, 4, 5, "...", totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
    }
    return pages;
  };

  const pages = buildPages();

  // ── Compact mode (cho Admin panels) ──────────────────────
  if (compact) {
    return (
      <div className={`flex items-center justify-between text-xs text-white/40 ${className}`}>
        {total != null && (
          <span>
            {from}–{to} / {total?.toLocaleString("vi-VN")} mục
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onChange(page - 1)}
            disabled={page === 1}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center
              disabled:opacity-30 focus:outline-none transition"
          >
            <ChevronLeft size={14} />
          </button>

          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="w-8 text-center text-white/20 select-none">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition focus:outline-none
                  ${p === page
                    ? "bg-orange-500 text-white"
                    : "bg-white/5 hover:bg-white/10 text-white/40"}`}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => onChange(page + 1)}
            disabled={page === totalPages}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center
              disabled:opacity-30 focus:outline-none transition"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ── Full mode (cho Product, Blog, Orders, Search) ─────────
  return (
    <div className={`flex flex-col items-center gap-3 py-6 ${className}`}>
      {/* Info */}
      {total != null && (
        <p className="text-xs text-white/30">
          Hiển thị <span className="text-white/60">{from}–{to}</span> trong{" "}
          <span className="text-white/60">{total?.toLocaleString("vi-VN")}</span> kết quả
        </p>
      )}

      {/* Nút */}
      <div className="flex items-center gap-1.5">
        {/* Về trang đầu */}
        <button
          onClick={() => onChange(1)}
          disabled={page === 1}
          className="hidden sm:flex w-8 h-8 rounded-xl bg-white/[0.04] border border-white/8
            hover:bg-white/8 hover:border-white/15 items-center justify-center text-white/30
            hover:text-white disabled:opacity-20 disabled:cursor-not-allowed
            focus:outline-none transition text-xs font-medium"
          title="Trang đầu"
        >
          «
        </button>

        {/* Prev */}
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/8
            hover:bg-white/8 hover:border-white/15 flex items-center justify-center
            text-white/30 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed
            focus:outline-none transition"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Số trang */}
        {pages.map((p, i) =>
          p === "..." ? (
            <span
              key={`ellipsis-${i}`}
              className="w-8 h-8 flex items-center justify-center text-white/20 text-xs select-none"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-8 h-8 rounded-xl text-xs font-semibold transition focus:outline-none border
                ${p === page
                  ? "bg-orange-500 border-orange-500/80 text-white shadow-[0_0_12px_rgba(255,149,0,0.35)]"
                  : "bg-white/[0.04] border-white/8 text-white/40 hover:bg-white/8 hover:border-white/15 hover:text-white"}`}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/8
            hover:bg-white/8 hover:border-white/15 flex items-center justify-center
            text-white/30 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed
            focus:outline-none transition"
        >
          <ChevronRight size={15} />
        </button>

        {/* Về trang cuối */}
        <button
          onClick={() => onChange(totalPages)}
          disabled={page === totalPages}
          className="hidden sm:flex w-8 h-8 rounded-xl bg-white/[0.04] border border-white/8
            hover:bg-white/8 hover:border-white/15 items-center justify-center text-white/30
            hover:text-white disabled:opacity-20 disabled:cursor-not-allowed
            focus:outline-none transition text-xs font-medium"
          title="Trang cuối"
        >
          »
        </button>
      </div>

      {/* Trang X / Y */}
      <p className="text-[11px] text-white/20">
        Trang {page} / {totalPages}
      </p>
    </div>
  );
}

// usePagination hook đã được tích hợp trực tiếp vào từng file.
