import React from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Facebook, Youtube, Instagram, Smartphone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#0e0e0e] border-t border-white/[0.06] text-white">
      <div className="max-w-7xl mx-auto px-10 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">

        {/* Brand */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Smartphone size={20} className="text-orange-500" />
            <span className="text-xl font-bold tracking-tight">PHONEZONE</span>
          </div>
          <p className="text-sm text-white/40 leading-relaxed">
            Điểm đến công nghệ uy tín — điện thoại chính hãng, giá tốt, dịch vụ tận tâm.
          </p>
          <div className="flex gap-3 mt-1">
            <a href="#" aria-label="Facebook"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-orange-500/20 hover:text-orange-400 flex items-center justify-center text-white/40 transition">
              <Facebook size={15} />
            </a>
            <a href="#" aria-label="YouTube"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-orange-500/20 hover:text-orange-400 flex items-center justify-center text-white/40 transition">
              <Youtube size={15} />
            </a>
            <a href="#" aria-label="Instagram"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-orange-500/20 hover:text-orange-400 flex items-center justify-center text-white/40 transition">
              <Instagram size={15} />
            </a>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-1">Khám phá</p>
          {[
            { to: "/",           label: "Trang chủ" },
            { to: "/product",    label: "Sản phẩm" },
            { to: "/blog",       label: "Bài viết" },
            { to: "/cart",       label: "Giỏ hàng" },
            { to: "/information",label: "Tài khoản" },
          ].map(({ to, label }) => (
            <Link key={to} to={to}
              className="text-sm text-white/40 hover:text-orange-400 transition w-fit">
              {label}
            </Link>
          ))}
        </div>

        {/* Policy */}
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-1">Chính sách</p>
          {[
            "Chính sách bảo hành",
            "Chính sách đổi trả",
            "Chính sách thanh toán",
            "Bảo mật thông tin",
            "Điều khoản sử dụng",
          ].map((item) => (
            <span key={item} className="text-sm text-white/40 hover:text-orange-400 transition cursor-pointer w-fit">
              {item}
            </span>
          ))}
        </div>

        {/* Contact */}
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-1">Liên hệ</p>
          <div className="flex items-start gap-2.5 text-sm text-white/40">
            <MapPin size={14} className="shrink-0 mt-0.5 text-orange-500/60" />
            <span>123 Đường Công Nghệ, Quận 1, TP. Hồ Chí Minh</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-white/40">
            <Phone size={14} className="shrink-0 text-orange-500/60" />
            <span>1800 6789</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-white/40">
            <Mail size={14} className="shrink-0 text-orange-500/60" />
            <span>support@phonezone.vn</span>
          </div>
          <div className="mt-2 p-3 rounded-xl bg-orange-500/5 border border-orange-500/15">
            <p className="text-xs text-orange-400/80 font-medium">Giờ hỗ trợ</p>
            <p className="text-xs text-white/30 mt-0.5">Thứ 2 – Thứ 7: 8:00 – 21:00</p>
            <p className="text-xs text-white/30">Chủ nhật: 9:00 – 18:00</p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.05] px-10 py-4">
        <p className="text-center text-xs text-white/20">
          © {new Date().getFullYear()} PHONEZONE. Tất cả quyền được bảo lưu.
        </p>
      </div>
    </footer>
  );
}
