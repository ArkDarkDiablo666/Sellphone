import { useState, useEffect, useRef } from "react";
import "./animations.css";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Tag, Search, ChevronRight, X } from "lucide-react";
import { BlockRenderer } from "./Blockeditor";
import { useCart } from "./Cart";
import Footer from "./Footer";
import BannerSlider from "./BannerSlider";
import Navbar, { useNavbarToast } from "./Navbar";
import { API } from "./config";


const CATEGORIES = [
  "Tất cả",
  "Mới nhất",
  "Cũ nhất",
  "Mẹo vặt",
  "Đánh giá",
  "Tin tức",
];

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return `${Math.floor(diff)} giây trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

// ── Chi tiết bài viết ────────────────────────────────────────
export function BlogDetail() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState([]);
  const navigate = useNavigate();
  const { totalCount } = useCart();

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/post/${id}/`)
      .then((r) => r.json())
      .then((d) => {
        setPost(d.post);
        if (d.post?.category) {
          fetch(`${API}/api/post/list/?category=${encodeURIComponent(d.post.category)}`)
            .then(r => r.json())
            .then(rd => setRelated((rd.posts || []).filter(p => String(p.id) !== String(id)).slice(0, 4)));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div
        className="min-h-screen text-white flex items-center justify-center"
        style={{ background: "#1C1C1E" }}
      >
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  if (!post)
    return (
      <div
        className="min-h-screen text-white flex flex-col items-center justify-center gap-4"
        style={{ background: "#1C1C1E" }}
      >
        <p className="text-white/40">Không tìm thấy bài viết</p>
        <button
          onClick={() => navigate("/blog")}
          className="px-4 py-2 rounded-xl bg-orange-500 text-sm"
        >
          Quay lại
        </button>
      </div>
    );

  return (
    <div className="min-h-screen text-white" style={{ background: "#1C1C1E" }}>
      <Navbar />

      <div className="pt-20 pb-16 px-6 max-w-3xl mx-auto">
        {/* BANNER */}
        <div className="mb-8">
          <BannerSlider height="h-[220px]" className="w-full" page="blog" />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-orange-500/15 text-orange-400">
            {post.category}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-white/30">
            <Clock size={11} /> {timeAgo(post.created_at)}
          </span>
          <span className="text-xs text-white/20">by {post.author}</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-8 leading-snug">
          {post.title}
        </h1>

        <div className="prose-custom">
          <BlockRenderer blocks={post.blocks || []} />
        </div>

        <div className="mt-12 pt-8 border-t border-white/5">
          <button
            onClick={() => navigate("/blog")}
            className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition"
          >
            <ArrowLeft size={14} /> Xem tất cả bài viết
          </button>
        </div>

        {/* ── GỢI Ý BÀI VIẾT LIÊN QUAN ── */}
        {related.length > 0 && (
          <div className="mt-12">
            <h3 className="text-base font-semibold text-white/70 mb-5 uppercase tracking-widest text-xs">
              Bài viết liên quan
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {related.map(p => (
                <div
                  key={p.id}
                  onClick={() => { navigate(`/blog/${p.id}`); window.scrollTo({ top: 0, behavior: "instant" }); }}
                  className="cursor-pointer rounded-2xl border border-white/5 hover:border-orange-500/25 transition group overflow-hidden flex gap-3 p-3"
                  style={{ background: "#161616" }}
                >
                  <div className="w-20 h-16 shrink-0 rounded-xl overflow-hidden bg-[#1e1e1e] flex items-center justify-center">
                    {p.thumbnail
                      ? <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      : <Tag size={18} className="text-white/10" />}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <p className="text-sm font-medium text-white/80 leading-snug line-clamp-2 group-hover:text-orange-400 transition">
                      {p.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400/70">{p.category}</span>
                      <span className="text-[10px] text-white/25 flex items-center gap-1"><Clock size={9}/> {timeAgo(p.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

// ── Danh sách bài viết ───────────────────────────────────────
export default function Blog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Tất cả");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { totalCount } = useCart();

  useEffect(() => {
    loadPosts(activeTab);
  }, [activeTab]);

  const loadPosts = (cat) => {
    setLoading(true);
    const q =
      cat === "Tất cả"
        ? "all"
        : cat === "Mới nhất"
          ? "all"
          : cat === "Cũ nhất"
            ? "all"
            : cat;
    fetch(`${API}/api/post/list/?category=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        let list = d.posts || [];
        if (cat === "Mới nhất")
          list = [...list].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at),
          );
        if (cat === "Cũ nhất")
          list = [...list].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at),
          );
        setPosts(list);
      })
      .finally(() => setLoading(false));
  };

  const filtered = search
    ? posts.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    : posts;

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="min-h-screen text-white" style={{ background: "#1C1C1E" }}>
      <Navbar />

      {/* ── Main content ── */}
      <div className="pt-24 pb-16 px-8 max-w-5xl mx-auto">

        {/* BANNER */}
        <div className="mb-8">
          <BannerSlider height="h-[300px]" className="w-full" page="blog" />
        </div>

        {/* SEARCH BAR — full width, prominent */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm bài viết theo tiêu đề..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-11 pr-10 py-3 text-sm outline-none
              focus:border-orange-500/50 focus:bg-white/[0.06] transition placeholder-white/20"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* TABS — hidden while searching */}
        {!search && (
          <div className="flex items-center gap-0 mb-8 border-b border-white/8">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-5 py-2.5 text-sm transition border-b-2 -mb-px ${
                  activeTab === cat
                    ? "text-orange-400 border-orange-500"
                    : "text-white/40 hover:text-white/70 border-transparent"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-white/20">Đang tải...</div>

        ) : search ? (
          /* ── KẾT QUẢ TÌM KIẾM ── */
          <div>
            <p className="text-sm text-white/30 mb-5">
              {filtered.length === 0
                ? <>Không tìm thấy bài viết nào cho <span className="text-orange-400">"{search}"</span></>
                : <>{filtered.length} kết quả cho <span className="text-orange-400">"{search}"</span></>}
            </p>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center py-20 gap-3 text-white/15">
                <Search size={48} strokeWidth={1} />
                <p className="text-sm">Thử từ khóa khác</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((post) => (
                  <SearchResultRow
                    key={post.id}
                    post={post}
                    query={search}
                    onClick={() => navigate(`/blog/${post.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-white/20">
            Không có bài viết nào
          </div>
        ) : (
          /* ── LAYOUT BÀI VIẾT BÌNH THƯỜNG ── */
          <div className="flex flex-col gap-8">
            <h1 className="text-2xl font-bold -mb-2">Bài viết nổi bật</h1>
            {featured && (
              <div
                onClick={() => navigate(`/blog/${featured.id}`)}
                className="cursor-pointer rounded-2xl overflow-hidden border border-white/5 hover:border-orange-500/30 transition group"
                style={{ background: "#161616" }}
              >
                <div className="relative h-64 overflow-hidden">
                  {featured.thumbnail ? (
                    <img
                      src={featured.thumbnail}
                      alt={featured.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: "#222" }}
                    >
                      <Tag size={40} className="text-white/10" />
                    </div>
                  )}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)",
                    }}
                  />
                  <div className="absolute bottom-0 left-0 p-5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 mb-2 inline-block">
                      {featured.category}
                    </span>
                    <h2 className="text-lg font-bold text-white leading-snug">
                      {featured.title}
                    </h2>
                  </div>
                  <div className="absolute top-4 right-4 text-xs text-white/50 bg-black/50 px-2.5 py-1 rounded-full">
                    {timeAgo(featured.created_at)}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {rest.map((post, i) => (
                <div
                  key={post.id}
                  onClick={() => navigate(`/blog/${post.id}`)}
                  className={`cursor-pointer rounded-2xl border border-white/5 hover:border-orange-500/20 transition flex overflow-hidden group ${i % 2 === 1 ? "flex-row-reverse" : ""}`}
                  style={{ background: "#161616" }}
                >
                  {post.thumbnail ? (
                    <div className="w-56 shrink-0 overflow-hidden">
                      <img
                        src={post.thumbnail}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-40 shrink-0 flex items-center justify-center"
                      style={{ background: "#1e1e1e" }}
                    >
                      <Tag size={28} className="text-white/10" />
                    </div>
                  )}
                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400/80">
                          {post.category}
                        </span>
                      </div>
                      <h3 className="font-semibold text-white/90 leading-snug group-hover:text-orange-400 transition">
                        {post.title}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="flex items-center gap-1.5 text-xs text-white/30">
                        <Clock size={11} /> {timeAgo(post.created_at)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-orange-400/60 group-hover:text-orange-400 transition">
                        Đọc thêm <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

// ── Highlight từ khóa trong tiêu đề ─────────────────────────
function HighlightText({ text, query }) {
  if (!query) return <span>{text}</span>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-orange-500/30 text-orange-300 rounded px-0.5 not-italic">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

// ── Row hiển thị trong kết quả tìm kiếm ─────────────────────
function SearchResultRow({ post, query, onClick }) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer flex items-center gap-4 p-4 rounded-2xl border border-white/5
        hover:border-orange-500/25 hover:bg-white/[0.02] transition group"
      style={{ background: "#161616" }}
    >
      <div className="w-20 h-14 shrink-0 rounded-xl overflow-hidden bg-[#1e1e1e] flex items-center justify-center">
        {post.thumbnail
          ? <img src={post.thumbnail} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : <Tag size={18} className="text-white/10" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400/80">
            {post.category}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/25">
            <Clock size={9} /> {timeAgo(post.created_at)}
          </span>
        </div>
        <h3 className="text-sm font-medium text-white/85 leading-snug group-hover:text-orange-400 transition line-clamp-2">
          <HighlightText text={post.title} query={query} />
        </h3>
      </div>
      <ChevronRight size={14} className="shrink-0 text-white/20 group-hover:text-orange-400 transition" />
    </div>
  );
}