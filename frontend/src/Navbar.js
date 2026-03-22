// Navbar.js — Navbar dùng chung cho tất cả trang customer
// Tính năng:
//   - Active link highlight theo route hiện tại
//   - Click link đang active → scroll về đầu trang (giống Footer)
//   - Click link trang khác → navigate bình thường
//   - Hiệu ứng page-enter khi mount
import { useState, useRef, useEffect } from "react";
import "./animations.css";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  User, LogOut, Settings, ShoppingCart,
  ChevronDown, Search, AlertTriangle
} from "lucide-react";
import { SearchModal } from "./Searchbar";
import { isLoggedIn, clearSession } from "./authUtils";
import { useCart } from "./Cart";
import { ToastContainer, useToast } from "./Toast";

// ─── Hook điều hướng thông minh (giống Footer.js) ────────────────────────────
function useSmartNav() {
  const location = useLocation();
  const navigate  = useNavigate();
  return (to) => (e) => {
    if (e) e.preventDefault();
    if (location.pathname === to) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate(to);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };
}

// ─── NavLink với active highlight + smart scroll ─────────────────────────────
function NavLink({ to, children, handleNav }) {
  const { pathname } = useLocation();
  const isActive = pathname === to || (to !== "/" && pathname.startsWith(to));
  return (
    <a
      href={to}
      onClick={handleNav(to)}
      className={`text-sm transition-colors duration-150 cursor-pointer
        ${isActive ? "text-white font-semibold" : "text-gray-400 hover:text-white"}`}
    >
      {children}
      {isActive && (
        <span className="block h-0.5 mt-0.5 rounded-full bg-orange-500 w-full" />
      )}
    </a>
  );
}

// ─── Navbar component ─────────────────────────────────────────────────────────
export default function Navbar({ toasts, removeToast }) {
  const navigate    = useNavigate();
  const handleNav   = useSmartNav();
  const { totalCount } = useCart();
  const { toast }   = useToast();

  const [user,          setUser]          = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const sync = () => setUser(JSON.parse(localStorage.getItem("user") || "null"));
    window.addEventListener("storage",     sync);
    window.addEventListener("focus",       sync);
    window.addEventListener("userUpdated", sync);
    return () => {
      window.removeEventListener("storage",     sync);
      window.removeEventListener("focus",       sync);
      window.removeEventListener("userUpdated", sync);
    };
  }, []);

  useEffect(() => {
    const fn = e => {
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

  return (
    <>
      {/* Toast container — dùng chung nếu page truyền vào */}
      {toasts && removeToast && <ToastContainer toasts={toasts} removeToast={removeToast} />}

      {/* LOGOUT CONFIRM */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm pz-backdrop" onClick={() => setConfirmLogout(false)} />
          <div className="relative bg-[#161616] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl pz-modal-box">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <h3 className="font-semibold text-white">Đăng xuất</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">Bạn có muốn đăng xuất không?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmLogout(false)} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition border border-white/10 text-white">Hủy</button>
              <button onClick={handleLogout} className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition text-white">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-4 pz-navbar">
        {/* Logo */}
        <div
          className="text-2xl pz-brand-logo pz-logo cursor-pointer"
          onClick={handleNav("/")}
        >
          <span className="pz-white">PHONE</span><span className="pz-orange">ZONE</span>
        </div>

        {/* Menu links */}
        <div className="flex gap-8 items-end">
          <NavLink to="/"        handleNav={handleNav}>Trang chủ</NavLink>
          <NavLink to="/product" handleNav={handleNav}>Sản phẩm</NavLink>
          <NavLink to="/blog"    handleNav={handleNav}>Bài viết</NavLink>
        </div>

        {/* Actions */}
        <div className="flex gap-5 items-center text-gray-300">
          {/* Search */}
          <button onClick={() => setSearchOpen(true)} className="hover:text-white transition focus:outline-none">
            <Search size={20} />
          </button>

          {/* Cart */}
          <button
            onClick={() => navigate(isLoggedIn() ? "/cart" : "/login")}
            className="relative focus:outline-none"
          >
            <ShoppingCart className="hover:text-white transition" size={22} />
            {totalCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold pz-badge-pulse">
                {totalCount > 9 ? "9+" : totalCount}
              </span>
            )}
          </button>

          {/* User */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 hover:text-white transition"
              >
                {user.avatar
                  ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20" onError={e => { e.currentTarget.style.display = "none"; }} />
                  : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                <ChevronDown size={14} className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 pz-dropdown">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                    {user.avatar
                      ? <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                      : <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><User size={16} /></div>}
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
                      <p className="text-xs text-white/40 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setDropdownOpen(false); navigate("/information"); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition"
                  >
                    <Settings size={15} /> Tài khoản
                  </button>
                  <div className="h-px bg-white/5 mx-3" />
                  <button
                    onClick={() => { setDropdownOpen(false); setConfirmLogout(true); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition"
                  >
                    <LogOut size={15} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition"
            >
              Đăng nhập
            </button>
          )}
        </div>
      </nav>
    </>
  );
}

// ─── useNavbarToast — hook để lấy toast + hiển thị login toast ───────────────
// Dùng trong mỗi page: const { toast, toasts, removeToast } = useNavbarToast();
export function useNavbarToast() {
  const { toast, toasts, removeToast } = useToast();
  useEffect(() => {
    const msg = sessionStorage.getItem("login_toast");
    if (msg) { sessionStorage.removeItem("login_toast"); setTimeout(() => toast.success(msg), 100); }
  }, []); // eslint-disable-line
  return { toast, toasts, removeToast };
}
