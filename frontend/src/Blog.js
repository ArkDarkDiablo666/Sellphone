import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Tag,
  Search,
  ChevronRight,
  ShoppingCart,
  User,
  LogOut,
  Settings,
  ChevronDown,
  AlertTriangle,
  X,
} from "lucide-react";
import { BlockRenderer } from "./Blockeditor";
import { useCart } from "./Cart";
import { SearchModal } from "./Searchbar";
import Footer from "./Footer";
import { isLoggedIn, clearSession } from "./authUtils";
import BannerSlider from "./BannerSlider";

const API = "http://localhost:8000";

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
  const navigate = useNavigate();
  const { totalCount } = useCart();
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("user") || "null"),
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const dropdownRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const syncUser = () =>
      setUser(JSON.parse(localStorage.getItem("user") || "null"));
    window.addEventListener("storage", syncUser);
    window.addEventListener("focus", syncUser);
    window.addEventListener("userUpdated", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("focus", syncUser);
      window.removeEventListener("userUpdated", syncUser);
    };
  }, []);

  useEffect(() => {
    const fn = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleLogout = () => {
    clearSession("user");
    setConfirmLogout(false);
    sessionStorage.setItem("logout_toast", "Đã đăng xuất thành công!");
    navigate("/login");
  };

  useEffect(() => {
    fetch(`${API}/api/post/${id}/`)
      .then((r) => r.json())
      .then((d) => setPost(d.post))
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
      {/* LOGOUT DIALOG */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmLogout(false)}
          />
          <div className="relative bg-[#161616] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <h3 className="font-semibold">Đăng xuất</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Bạn có muốn đăng xuất không?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmLogout(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition border border-white/10"
              >
                Hủy
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-4 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div
          className="text-2xl font-bold cursor-pointer"
          onClick={() => navigate("/")}
        >
          PHONEZONE
        </div>
        <div className="flex gap-8 items-center text-gray-300">
          <Link to="/" className="hover:text-white transition">
            Trang chủ
          </Link>
          <Link to="/product" className="hover:text-white transition">
            Sản phẩm
          </Link>
          <Link to="/blog" className="text-white font-medium transition">
            Bài viết
          </Link>
        </div>
        <div className="flex gap-5 items-center text-gray-300">
          <button
            onClick={() => setSearchOpen(true)}
            className="text-gray-300 hover:text-white transition"
          >
            <Search size={20} />
          </button>
          <button
            onClick={() => navigate(isLoggedIn() ? "/cart" : "/login")}
            className="relative"
          >
            <ShoppingCart className="hover:text-white transition" size={22} />
            {totalCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {totalCount > 9 ? "9+" : totalCount}
              </span>
            )}
          </button>
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 hover:text-white transition"
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <User size={16} />
                  </div>
                )}
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                        <User size={16} />
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">
                        {user.fullName}
                      </p>
                      <p className="text-xs text-white/40 truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/information");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition"
                  >
                    <Settings size={15} /> Tài khoản
                  </button>
                  <div className="h-px bg-white/5 mx-3" />
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      setConfirmLogout(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition"
                  >
                    <LogOut size={15} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => navigate("/login")}>
              <User className="hover:text-white transition" size={22} />
            </button>
          )}
        </div>
      </nav>

      <div className="pt-20 pb-16 px-6 max-w-3xl mx-auto">
        {/* BANNER */}
        <div className="mb-8">
          <BannerSlider height="h-[220px]" className="w-full" />
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
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("user") || "null"),
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const dropdownRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const syncUser = () =>
      setUser(JSON.parse(localStorage.getItem("user") || "null"));
    window.addEventListener("storage", syncUser);
    window.addEventListener("focus", syncUser);
    window.addEventListener("userUpdated", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("focus", syncUser);
      window.removeEventListener("userUpdated", syncUser);
    };
  }, []);

  useEffect(() => {
    const fn = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleLogout = () => {
    clearSession("user");
    setConfirmLogout(false);
    sessionStorage.setItem("logout_toast", "Đã đăng xuất thành công!");
    navigate("/login");
  };

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
      {/* LOGOUT DIALOG */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmLogout(false)}
          />
          <div className="relative bg-[#161616] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <h3 className="font-semibold">Đăng xuất</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Bạn có muốn đăng xuất không?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmLogout(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition border border-white/10"
              >
                Hủy
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-4 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div
          className="text-2xl font-bold cursor-pointer"
          onClick={() => navigate("/")}
        >
          PHONEZONE
        </div>
        <div className="flex gap-8 items-center text-gray-300">
          <Link to="/" className="hover:text-white transition">
            Trang chủ
          </Link>
          <Link to="/product" className="hover:text-white transition">
            Sản phẩm
          </Link>
          <Link to="/blog" className="text-white font-medium transition">
            Bài viết
          </Link>
        </div>
        <div className="flex gap-5 items-center text-gray-300">
          <button
            onClick={() => setSearchOpen(true)}
            className="text-gray-300 hover:text-white transition"
          >
            <Search size={20} />
          </button>
          <button
            onClick={() => navigate(isLoggedIn() ? "/cart" : "/login")}
            className="relative"
          >
            <ShoppingCart className="hover:text-white transition" size={22} />
            {totalCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {totalCount > 9 ? "9+" : totalCount}
              </span>
            )}
          </button>
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 hover:text-white transition"
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <User size={16} />
                  </div>
                )}
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                        <User size={16} />
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">
                        {user.fullName}
                      </p>
                      <p className="text-xs text-white/40 truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/information");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition"
                  >
                    <Settings size={15} /> Tài khoản
                  </button>
                  <div className="h-px bg-white/5 mx-3" />
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      setConfirmLogout(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition"
                  >
                    <LogOut size={15} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => navigate("/login")}>
              <User className="hover:text-white transition" size={22} />
            </button>
          )}
        </div>
      </nav>

      {/* ── Main content ── */}
      <div className="pt-24 pb-16 px-8 max-w-5xl mx-auto">

        {/* BANNER */}
        <div className="mb-8">
          <BannerSlider height="h-[300px]" className="w-full" />
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