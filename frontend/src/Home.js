import { useState, useRef, useEffect } from "react";
import "./animations.css";
import { useNavigate } from "react-router-dom";
import { useCart } from "./Cart";
import bgImage from "./Image/image-177.png";
import {
  Package, Shield, Truck, CreditCard, Headphones,
  Star, ArrowRight, Zap, Award, Tag, ChevronRight
} from "lucide-react";
import { ToastContainer } from "./Toast";
import Footer from "./Footer";
import BannerSlider from "./BannerSlider";
import Navbar, { useNavbarToast } from "./Navbar";
import { API } from "./config";

// ─── Voucher helpers ──────────────────────────────────────────────────────────
function calcDisc(v, price, productId, categoryId, variantId) {
  if (!v || !price) return 0;
  if (v.scope === "category" && v.category_id && String(categoryId) !== String(v.category_id)) return 0;
  if (v.scope === "product") {
    if (v.product_id && String(productId) !== String(v.product_id)) return 0;
    if (v.variant_id && String(variantId) !== String(v.variant_id)) return 0;
  }
  if (price < (v.min_order || 0)) return 0;
  let d = v.type === "percent"
    ? Math.round(price * Math.min(v.value, 100) / 100)
    : Math.min(v.value, price);
  if (v.max_discount) d = Math.min(d, v.max_discount);
  return d;
}

function getBestForVariant(variant, productId, categoryId, voucherList, cartVoucher) {
  const price     = parseFloat(variant.price || 0);
  const variantId = variant.id;
  if (!price) return { finalPrice: 0, discount: 0, voucher: null };
  if (cartVoucher) {
    const d = calcDisc(cartVoucher, price, productId, categoryId, variantId);
    if (d > 0) return { finalPrice: Math.max(0, price - d), discount: d, voucher: cartVoucher };
  }
  let bestVoucher = null, bestDisc = 0;
  for (const vou of voucherList) {
    const d = calcDisc(vou, price, productId, categoryId, variantId);
    if (d > bestDisc) { bestDisc = d; bestVoucher = vou; }
  }
  return {
    finalPrice: bestDisc > 0 ? Math.max(0, price - bestDisc) : price,
    discount:   bestDisc,
    voucher:    bestVoucher,
  };
}

// ─── ProductCard — y chang Product.js ────────────────────────────────────────
function ProductCard({ product: p, comboVariant, voucherList, cartVoucher, navigate, toast }) {
  const variants   = p.variants || [];
  const comboKey   = comboVariant ? `${comboVariant.ram || ""}|${comboVariant.storage || ""}` : null;
  const comboLabel = comboVariant ? [comboVariant.ram, comboVariant.storage].filter(Boolean).join(" · ") : null;

  const colorsOfCombo = comboKey
    ? [...new Set(variants.filter(v => `${v.ram || ""}|${v.storage || ""}` === comboKey && v.color).map(v => v.color))]
    : [...new Set(variants.map(v => v.color).filter(Boolean))];

  const [activeColor, setActiveColor] = useState(null);

  const displayVariant = (() => {
    if (activeColor && comboKey)
      return variants.find(v => v.color === activeColor && `${v.ram || ""}|${v.storage || ""}` === comboKey) || null;
    if (comboKey) {
      const candidates = variants.filter(v => `${v.ram || ""}|${v.storage || ""}` === comboKey);
      return candidates.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0] || null;
    }
    return [...variants].sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0))[0] || null;
  })();

  const basePrice = displayVariant ? parseFloat(displayVariant.price) : parseFloat(p.min_price || 0);
  const { finalPrice, voucher: bestVoucher } = displayVariant
    ? getBestForVariant(displayVariant, p.id, p.category_id, voucherList, cartVoucher)
    : { finalPrice: basePrice, voucher: null };
  const hasDisc = finalPrice < basePrice;

  const variantImages = (() => {
    const imgs = [];
    if (displayVariant?.image) imgs.push(displayVariant.image);
    if (comboKey) {
      variants.filter(v => `${v.ram || ""}|${v.storage || ""}` === comboKey && v.image && !imgs.includes(v.image)).forEach(v => imgs.push(v.image));
    } else {
      variants.filter(v => v.image && !imgs.includes(v.image)).forEach(v => imgs.push(v.image));
    }
    return imgs;
  })();

  const [slideIdx, setSlideIdx] = useState(0);
  const slideRef                = useRef(null);
  const [fading,  setFading]    = useState(false);

  useEffect(() => { setSlideIdx(0); }, [displayVariant?.image]);

  const frozen = !!(activeColor && comboKey);
  useEffect(() => {
    clearInterval(slideRef.current);
    if (frozen || variantImages.length <= 1) return;
    slideRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => { setSlideIdx(i => (i + 1) % variantImages.length); setFading(false); }, 150);
    }, 2500);
    return () => clearInterval(slideRef.current);
  }, [frozen, variantImages.length]);

  const currentImg = variantImages.length > 0 ? variantImages[slideIdx % variantImages.length] : null;

  const handleColorClick = (col) => {
    const hasStock = variants.some(v =>
      v.color === col && (!comboKey || `${v.ram || ""}|${v.storage || ""}` === comboKey) && (v.stock ?? 1) > 0
    );
    if (!hasStock) return;
    setActiveColor(prev => prev === col ? null : col);
  };

  const handleBuy = (e) => {
    e.stopPropagation();
    const target = displayVariant || variants[0];
    const params = new URLSearchParams();
    if (target?.color)   params.set("color",   target.color);
    if (target?.ram)     params.set("ram",      target.ram);
    if (target?.storage) params.set("storage",  target.storage);
    navigate(`/product/${p.id}${params.toString() ? "?" + params.toString() : ""}`);
  };

  const { addItem } = useCart();
  const handleAddToCart = (e) => {
    e.stopPropagation();
    const target = displayVariant || variants[0];
    if (!target) return;
    addItem(p, target, 1);
    toast.success("Đã thêm vào giỏ hàng!");
  };

  return (
    <article
      onClick={() => navigate(`/product/${p.id}`)}
      className="flex flex-col h-full rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer
        bg-[#00000001] backdrop-blur-[2px]
        shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
        hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.60),inset_1px_0_0_rgba(255,255,255,0.48),inset_0_-1px_1px_rgba(0,0,0,0.20),inset_-1px_0_1px_rgba(0,0,0,0.18),0_8px_32px_rgba(0,0,0,0.4)]"
    >
      {/* Ảnh */}
      <div className="w-full h-32 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden">
        {currentImg
          ? <img key={currentImg} src={currentImg} alt={p.name} className="w-full h-full object-contain p-2 transition-opacity duration-300" style={{ opacity: fading ? 0 : 1 }} />
          : <Package size={24} className="text-white/10" />}
        {hasDisc && bestVoucher && (
          <div className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-tight">
            {bestVoucher.type === "percent" ? `-${bestVoucher.value}%` : `-${(basePrice - finalPrice).toLocaleString("vi-VN")}đ`}
          </div>
        )}
        {variantImages.length > 1 && !frozen && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {variantImages.map((_, i) => (
              <span key={i} className={`rounded-full transition-all ${i === slideIdx % variantImages.length ? "w-3 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30"}`} />
            ))}
          </div>
        )}
        {variantImages.length > 1 && (
          <div className="absolute top-1.5 right-1.5 bg-black/50 text-white/60 text-[8px] px-1.5 py-0.5 rounded-full pointer-events-none">
            {variantImages.length} màu
          </div>
        )}
      </div>

      {/* Nội dung */}
      <div className="flex flex-col gap-1.5 p-2.5 flex-1">
        <h3 className="font-semibold text-white text-xs leading-snug line-clamp-2 hover:text-orange-400 transition">{p.name}</h3>
        {comboLabel && (
          <span className="inline-block px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[9px] font-semibold text-white/50 w-fit">{comboLabel}</span>
        )}
        {colorsOfCombo.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {colorsOfCombo.map(col => {
              const hasStock = variants.some(v =>
                v.color === col && (!comboKey || `${v.ram || ""}|${v.storage || ""}` === comboKey) && (v.stock ?? 1) > 0
              );
              return (
                <span key={col} title={!hasStock ? `${col} - Hết hàng` : col}
                  className={`px-1.5 py-0.5 rounded text-[9px] border font-medium cursor-pointer transition
                    ${activeColor === col
                      ? "bg-orange-500/20 border-orange-500/40 text-orange-300"
                      : !hasStock
                      ? "bg-white/[0.02] border-white/5 text-white/20 line-through cursor-not-allowed"
                      : "bg-white/5 border-white/10 text-white/50 hover:border-white/30"}`}
                  onClick={e => { e.stopPropagation(); handleColorClick(col); }}>
                  {col}
                </span>
              );
            })}
          </div>
        )}
        {bestVoucher && hasDisc && (
          <div className="flex items-center gap-1">
            <Tag size={8} className="text-orange-400 shrink-0" />
            <span className="text-[8px] text-orange-400 font-mono font-semibold">{bestVoucher.code}</span>
          </div>
        )}
        <div className="h-5 flex items-center">
          {p.rating_avg > 0 && (
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(n => (
                <svg key={n} width="9" height="9" viewBox="0 0 24 24" fill={n <= Math.round(p.rating_avg) ? "#f59e0b" : "none"} stroke="#f59e0b" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
              <span className="text-[9px] text-white/30 ml-0.5">({p.rating_count})</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end justify-between mt-auto pt-1 gap-1">
          <div className="shrink-0">
            {hasDisc && <p className="text-[#ff3b30]/40 text-[9px] line-through leading-none">{basePrice.toLocaleString("vi-VN")}đ</p>}
            <p className="font-bold text-sm leading-tight text-[#ff3b30] whitespace-nowrap">
              {finalPrice ? finalPrice.toLocaleString("vi-VN") + "đ" : "Liên hệ"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handleAddToCart} className="shrink-0 h-7 w-14 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition focus:outline-none">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </button>
            <button onClick={handleBuy} className="shrink-0 h-7 w-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-medium transition flex items-center justify-center focus:outline-none">
              Mua
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

// ─── Fetch sản phẩm ───────────────────────────────────────────────────────────
function useProducts(url, limit) {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`${API}${url}?limit=${limit}`)
      .then(r => r.json())
      .then(async d => {
        const list = d.products || [];
        const detailed = await Promise.all(
          list.map(p =>
            fetch(`${API}/api/product/${p.id}/detail/`)
              .then(r => r.json())
              .then(dd => ({ ...p, variants: dd.variants || [] }))
              .catch(() => p)
          )
        );
        setProducts(detailed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [url, limit]);
  return { products, loading };
}

// ─── ProductSection — 4 cột cố định ──────────────────────────────────────────
function ProductSection({ title, subtitle, url, limit, navigate }) {
  const { products, loading } = useProducts(url, limit);
  const [vouchers, setVouchers] = useState([]);
  const { voucher: cartVoucher } = useCart();
  const { toast } = useNavbarToast();

  useEffect(() => {
    fetch(`${API}/api/voucher/active/`)
      .then(r => r.json())
      .then(d => setVouchers(d.vouchers || []))
      .catch(() => {});
  }, []);

  if (loading) return (
    <div className="px-10 pb-16">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl pz-skeleton" style={{ height: 260 }} />
          ))}
        </div>
      </div>
    </div>
  );
  if (!products.length) return null;

  // Mỗi combo RAM|Storage = 1 card, giới hạn đúng limit
  const cards = products.flatMap(p => {
    const vars = p.variants || [];
    const comboMap = {};
    for (const v of vars) {
      if (!v.price) continue;
      const key = `${v.ram || ""}|${v.storage || ""}`;
      if (!comboMap[key] || parseFloat(v.price) < parseFloat(comboMap[key].price)) comboMap[key] = v;
    }
    const combos = Object.values(comboMap);
    if (combos.length === 0) return [{ p, comboV: null, key: String(p.id) }];
    return combos.map(comboV => ({ p, comboV, key: `${p.id}_${comboV.ram || ""}|${comboV.storage || ""}` }));
  }).slice(0, limit);

  return (
    <section className="px-10 pb-16">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-500/70 mb-1">{subtitle}</p>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
          </div>
          <button onClick={() => navigate("/product")}
            className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition px-4 py-2 rounded-xl border border-orange-500/20 hover:border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10">
            Xem tất cả <ChevronRight size={13} />
          </button>
        </div>

        {/* ⬇ 4 CỘT CỐ ĐỊNH ⬇ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {cards.map(({ p, comboV, key }) => (
            <ProductCard
              key={key}
              product={p}
              comboVariant={comboV}
              voucherList={vouchers}
              cartVoucher={cartVoucher}
              navigate={navigate}
              toast={toast}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FeatureCard ──────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="group flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/[0.07] hover:border-orange-500/25 transition-all duration-300 hover:-translate-y-0.5"
      style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110"
        style={{ background: "rgba(255,149,0,0.12)", border: "1px solid rgba(255,149,0,0.2)" }}>
        <Icon size={20} className="text-orange-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-white/40 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// ─── TestimonialCard ──────────────────────────────────────────────────────────
function TestimonialCard({ name, role, text, rating }) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl border border-white/[0.07] hover:border-orange-500/20 transition-all duration-300"
      style={{ background: "rgba(255,255,255,0.025)" }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full shrink-0 ring-2 ring-orange-500/20 flex items-center justify-center font-bold text-sm text-orange-400"
          style={{ background: "rgba(255,149,0,0.1)" }}>
          {name[0]}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{name}</p>
          <p className="text-[11px] text-white/35">{role}</p>
        </div>
        <div className="ml-auto flex gap-0.5">
          {[1,2,3,4,5].map(n => (
            <Star key={n} size={11} fill={n <= rating ? "#f59e0b" : "none"} stroke={n <= rating ? "#f59e0b" : "rgba(255,255,255,0.15)"} strokeWidth={1.5} />
          ))}
        </div>
      </div>
      <p className="text-xs text-white/55 leading-relaxed">{text}</p>
    </div>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const { toast, toasts, removeToast } = useNavbarToast();

  const features = [
    { icon: Package,    title: "Đóng gói an toàn",    desc: "Giao hàng nguyên vẹn" },
    { icon: Truck,      title: "Giao hàng miễn phí",  desc: "Toàn quốc" },
    { icon: Shield,     title: "Bảo hành chính hãng", desc: "12 tháng" },
    { icon: CreditCard, title: "Trả góp 0%",          desc: "Dễ tiếp cận" },
    { icon: Headphones, title: "Hỗ trợ 24/7",         desc: "Tư vấn nhanh chóng" },
  ];

  const testimonials = [
    { name: "Trần Nguyễn",  role: "Khách hàng thân thiết", rating: 5, text: "Mua iPhone ở đây giá tốt, lại còn hỗ trợ trả góp 0%. Rất hài lòng với trải nghiệm mua hàng." },
    { name: "Anh Phạm",     role: "Mua lần đầu",           rating: 5, text: "Lần đầu mua ở PHONEZONE, mình được giảm ngay cho khách hàng mới. Máy nguyên seal, bảo hành chính hãng." },
    { name: "Ngọc Nguyễn",  role: "Khách hàng thường",     rating: 5, text: "Trang web dễ sử dụng, đặt hàng nhanh chóng. Nhân viên gọi xác nhận ngay sau khi mình bấm mua." },
    { name: "Quân Nguyễn",  role: "Mua lần 3",             rating: 5, text: "Máy giao đúng model, nguyên hộp, còn được tặng kèm balo và chuột. Sẽ tiếp tục ủng hộ PHONEZONE." },
  ];

  return (
    <div className="relative min-h-screen text-white overflow-x-hidden" style={{ background: "#1C1C1E" }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <style>{`
        @keyframes fadeUp    { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glowPulse { 0%,100%{opacity:.35} 50%{opacity:.65} }
        .anim-fadeup { animation: fadeUp 0.6s cubic-bezier(.16,1,.3,1) both; }
        .glow-pulse  { animation: glowPulse 4s ease-in-out infinite; }
      `}</style>

      {/* Shared Navbar */}
      <Navbar />

      {/* HERO */}
      <div className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center scale-105 opacity-25" style={{ backgroundImage: `url(${bgImage})` }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom,rgba(10,10,10,.55) 0%,rgba(10,10,10,.9) 65%,#1C1C1E 100%)" }} />
        <div className="glow-pulse absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[320px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse,rgba(255,149,0,.13) 0%,transparent 70%)" }} />

        <section className="relative z-10 flex flex-col items-center text-center py-24 px-6">
          <div className="anim-fadeup inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/20 bg-orange-500/8 mb-6" style={{ animationDelay: "0ms" }}>
            <Zap size={12} className="text-orange-400" />
            <span className="text-orange-400 text-xs font-semibold tracking-wider uppercase">Công nghệ đỉnh cao</span>
          </div>
          <h1 className="anim-fadeup text-5xl md:text-6xl font-black mb-5 leading-tight tracking-tight" style={{ animationDelay: "80ms" }}>
            <span className="text-white">Công nghệ</span><br />
            <span style={{ background: "linear-gradient(135deg,#ff9500,#ff6b00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              trong tầm tay bạn
            </span>
          </h1>
          <p className="anim-fadeup text-white/50 max-w-lg mb-10 text-base leading-relaxed" style={{ animationDelay: "160ms" }}>
            Khám phá các dòng điện thoại mới nhất với hiệu năng mạnh mẽ, camera sắc nét và thiết kế tuyệt vời nhất.
          </p>
          <div className="anim-fadeup flex gap-4 flex-wrap justify-center" style={{ animationDelay: "240ms" }}>
            <button onClick={() => navigate("/product")} className="flex items-center gap-2 px-8 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition shadow-[0_0_24px_rgba(255,149,0,.4)]">
              Khám phá ngay <ArrowRight size={15} />
            </button>
            <button onClick={() => navigate("/blog")} className="flex items-center gap-2 px-8 py-3 rounded-full border border-white/15 hover:border-white/30 text-white/70 hover:text-white text-sm transition">
              Đọc bài viết
            </button>
          </div>
          <div className="anim-fadeup flex items-center gap-10 mt-16" style={{ animationDelay: "320ms" }}>
            {[{ v: "10K+", l: "Khách hàng" }, { v: "500+", l: "Sản phẩm" }, { v: "4.9★", l: "Đánh giá TB" }, { v: "24/7", l: "Hỗ trợ" }].map(({ v, l }) => (
              <div key={l} className="text-center">
                <p className="text-2xl font-black text-white">{v}</p>
                <p className="text-[11px] text-white/35 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* BODY — page enter animation */}
      <div className="pz-page-enter" style={{ background: "#1C1C1E" }}>

        {/* BANNER */}
        <div className="max-w-5xl mx-auto px-10 pb-12">
          <BannerSlider height="h-[420px]" className="w-full" />
        </div>

        {/* FEATURES */}
        <section className="px-10 pb-16">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-500/70 mb-2">Cam kết của chúng tôi</p>
              <h2 className="text-2xl font-bold text-white">Tại sao chọn PHONEZONE?</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {features.map(f => <FeatureCard key={f.title} {...f} />)}
            </div>
          </div>
        </section>

        {/* PRODUCTS — 4 CỘT CỐ ĐỊNH */}
        <ProductSection title="Sản phẩm nổi bật" subtitle="Gợi ý cho bạn" url="/api/home/featured/"    limit={8} navigate={navigate} />
        <ProductSection title="Bán chạy nhất"    subtitle="Được yêu thích"  url="/api/home/best-sellers/" limit={4} navigate={navigate} />

        {/* TESTIMONIALS */}
        <section className="px-10 pb-20">
          <div className="max-w-5xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden p-10"
              style={{ background: "linear-gradient(135deg,rgba(255,149,0,.06) 0%,rgba(255,100,0,.03) 100%)", border: "1px solid rgba(255,149,0,.12)" }}>
              <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(ellipse,rgba(255,149,0,.1) 0%,transparent 70%)" }} />
              <div className="relative z-10 text-center mb-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-500/70 mb-2">Phản hồi thực tế</p>
                <h2 className="text-2xl font-bold text-white">Đánh giá khách hàng</h2>
                <p className="text-white/40 text-sm mt-2">Một số đánh giá đến từ các khách hàng đã trải nghiệm sản phẩm từ PHONEZONE</p>
              </div>
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {testimonials.map(t => <TestimonialCard key={t.name} {...t} />)}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-10 pb-20">
          <div className="max-w-5xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden px-12 py-14 text-center"
              style={{ background: "linear-gradient(135deg,#1a0f00,#1f1200)", border: "1px solid rgba(255,149,0,.2)" }}>
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(ellipse at 50% 0%,rgba(255,149,0,.15) 0%,transparent 60%)" }} />
              <div className="relative z-10">
                <Award size={32} className="text-orange-400 mx-auto mb-4" />
                <h3 className="text-3xl font-black text-white mb-3">Sẵn sàng nâng cấp?</h3>
                <p className="text-white/45 text-sm mb-8 max-w-md mx-auto">Hàng ngàn sản phẩm chính hãng đang chờ bạn. Mua ngay hôm nay với nhiều ưu đãi hấp dẫn.</p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <button onClick={() => navigate("/product")} className="flex items-center gap-2 px-8 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition shadow-[0_0_20px_rgba(255,149,0,.35)]">
                    Mua sắm ngay <ArrowRight size={15} />
                  </button>
                  <button onClick={() => navigate("/blog")} className="flex items-center gap-2 px-8 py-3 rounded-full border border-white/15 hover:border-white/30 text-white/70 hover:text-white text-sm transition">
                    Xem bài viết
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}