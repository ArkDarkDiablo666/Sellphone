import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import bgImage from "./Image/image-177.png";
import {
  User, LogOut, Settings, AlertTriangle,
  ShoppingCart, ChevronDown, ShoppingBag
} from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = React.useState(() => JSON.parse(localStorage.getItem("user")));

  React.useEffect(() => {
    const syncUser = () => setUser(JSON.parse(localStorage.getItem("user")));
    window.addEventListener("storage",     syncUser);
    window.addEventListener("focus",       syncUser);
    window.addEventListener("userUpdated", syncUser);
    return () => {
      window.removeEventListener("storage",     syncUser);
      window.removeEventListener("focus",       syncUser);
      window.removeEventListener("userUpdated", syncUser);
    };
  }, []);

  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setConfirmLogout(false);
    navigate("/login");
  };

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center scale-105"
        style={{ backgroundImage: `url(${bgImage})` }} />
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* LOGOUT DIALOG */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmLogout(false)} />
          <div className="relative bg-[#161616] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <h3 className="font-semibold">Đăng xuất</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">Bạn có muốn đăng xuất không?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmLogout(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition border border-white/10">
                Hủy
              </button>
              <button onClick={handleLogout}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition">
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 pt-24">

        {/* NAVBAR */}
        <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-5
          backdrop-blur-md bg-black/70 border-b border-white/10">
          <div className="text-2xl font-bold tracking-wide">PHONEZONE</div>

          {/* NAV LINKS */}
          <div className="flex gap-8 text-gray-300">
            <Link to="/"       className="text-white font-medium transition">Trang chủ</Link>
            <Link to="/product" className="hover:text-white transition">Sản phẩm</Link>
            <Link to="/blog"    className="hover:text-white transition">Bài viết</Link>
          </div>

          {/* RIGHT ACTIONS */}
          <div className="flex gap-5 items-center text-gray-300">
            <button onClick={() => navigate(user ? "/cart" : "/login")}>
              <ShoppingCart className="hover:text-white transition" size={22} />
            </button>

            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 hover:text-white transition">
                  {user.avatar ? (
                    <img src={user.avatar} alt="avatar"
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <User size={16} />
                    </div>
                  )}
                  <ChevronDown size={14}
                    className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10
                    rounded-2xl shadow-xl overflow-hidden z-50">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                      {user.avatar ? (
                        <img src={user.avatar} alt="avatar"
                          className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                          <User size={16} />
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium truncate">{user.fullName}</p>
                        <p className="text-xs text-white/40 truncate">{user.email}</p>
                      </div>
                    </div>

                    {/* Đơn hàng */}
                    <button onClick={() => { setDropdownOpen(false); navigate("/information"); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/70
                        hover:bg-white/5 hover:text-white transition">
                      <ShoppingBag size={15} className="text-orange-400" /> Đơn hàng của tôi
                    </button>

                    {/* Tài khoản */}
                    <button onClick={() => { setDropdownOpen(false); navigate("/information"); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300
                        hover:bg-white/5 hover:text-white transition">
                      <Settings size={15} /> Tài khoản
                    </button>

                    <div className="h-px bg-white/5 mx-3" />

                    {/* Đăng xuất */}
                    <button onClick={() => { setDropdownOpen(false); setConfirmLogout(true); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400
                        hover:bg-red-500/10 transition">
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

        {/* HERO */}
        <section className="flex flex-col items-center justify-center text-center py-40 px-6">
          <p className="text-orange-400 text-sm tracking-widest uppercase mb-4 font-medium">
            Chào mừng đến với PHONEZONE
          </p>
          <h1 className="text-5xl font-bold mb-6 drop-shadow-lg
            bg-gradient-to-r from-gray-200 to-gray-400 bg-clip-text text-transparent leading-tight">
            Công nghệ trong tầm tay bạn
          </h1>
          <p className="text-gray-400 max-w-xl mb-10 text-base leading-relaxed">
            Khám phá các dòng điện thoại và thiết bị mới nhất với hiệu năng mạnh mẽ
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <Link to="/product"
              className="px-8 py-3 rounded-full bg-orange-500 hover:bg-orange-600
                text-white font-semibold text-sm transition duration-300 shadow-lg shadow-orange-500/30">
              Khám phá ngay
            </Link>
            <Link to="/blog"
              className="px-8 py-3 rounded-full bg-white/10 border border-white/20
                backdrop-blur-md hover:bg-white/20 text-sm transition duration-300">
              Đọc bài viết
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}