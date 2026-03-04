import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaApple, FaGoogle } from "react-icons/fa";
import { SiSamsung } from "react-icons/si";
import bgImage from "./Image/image-177.png";
import {
  User, LogOut, Camera, Settings, Package,
  PackagePlus, Users, ChevronRight, Eye, EyeOff,
  Pencil, Check, X, Plus, Shield, AlertTriangle, Search, ShoppingCart,ChevronDown,ShoppingBag  
} from "lucide-react";

export default function Product() {
  const navigate = useNavigate();
  const [user, setUser] = React.useState(() => JSON.parse(localStorage.getItem("user")));

  // Cập nhật user khi localStorage thay đổi (ví dụ sau khi đổi avatar)
  React.useEffect(() => {
    const syncUser = () => setUser(JSON.parse(localStorage.getItem("user")));
    window.addEventListener("storage", syncUser);
    window.addEventListener("focus", syncUser);
    // Lắng nghe khi avatar/thông tin user được cập nhật
    window.addEventListener("userUpdated", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("focus", syncUser);
      window.removeEventListener("userUpdated", syncUser);
    };
  }, []);
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const dropdownRef = useRef(null);

  const [selectedBrand, setSelectedBrand]   = useState("");
  const [selectedPrices, setSelectedPrices] = useState([]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCartClick = () => navigate(user ? "/cart" : "/login");

  const handleLogout = () => {
    localStorage.removeItem("user");
    setConfirmLogout(false);
    navigate("/login");
  };

  const togglePrice = (price) => {
    setSelectedPrices((prev) =>
      prev.includes(price) ? prev.filter((p) => p !== price) : [...prev, price]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-950 text-white">

      {/* ===== HỘP THOẠI XÁC NHẬN ĐĂNG XUẤT ===== */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmLogout(false)} />
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
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm transition border border-white/10">Hủy</button>
              <button onClick={handleLogout}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-medium transition">Đăng xuất</button>
            </div>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-5 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="text-2xl font-bold text-white">PHONEZONE</div>

        <div className="flex gap-8 items-center text-gray-300">
          <Link to="/" className="hover:text-white">Trang chủ</Link>
          <Link to="/product" className="text-white">Sản phẩm</Link>
        </div>

        <div className="flex items-center gap-6 text-gray-300">
          <Search className="cursor-pointer hover:text-white" size={22} />
          <button onClick={handleCartClick}>
            <ShoppingCart size={22} className="hover:text-white transition" />
          </button>

          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 hover:text-white transition">
                {/* Avatar hoặc icon User */}
                {user.avatar ? (
                  <img src={user.avatar} alt="avatar"
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <User size={16} />
                  </div>
                )}
                <ChevronDown size={14} className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-52 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                    {user.avatar ? (
                      <img src={user.avatar} alt="avatar" className="w-9 h-9 rounded-full object-cover" />
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
                  <button onClick={() => { setDropdownOpen(false); navigate("/information"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition">
                    <Settings size={15} /> Tài khoản
                  </button>
                  <button onClick={() => { setDropdownOpen(false); setConfirmLogout(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition">
                    <LogOut size={15} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => navigate("/login")}>
              <User size={22} className="hover:text-white transition" />
            </button>
          )}
        </div>
      </nav>

      {/* HERO BANNER */}
      <div className="h-[350px] bg-cover bg-center pt-[72px]"
        style={{ backgroundImage: `url(${bgImage})` }}>
        <div className="h-full w-full bg-black/60 flex items-center justify-center">
          <h1 className="text-4xl font-bold">Danh sách sản phẩm</h1>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex gap-[10px] px-10 py-10 bg-[#1C1C1E]">

        {/* BỘ LỌC */}
        <div className="w-[220px] bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5 h-fit sticky top-24">
          <h2 className="text-lg font-semibold mb-5">Bộ lọc tìm kiếm</h2>

          <div className="mb-6">
            <h3 className="mb-3 text-gray-300">Hãng sản xuất</h3>
            <div className="flex gap-3">
              {[
                { brand: "Samsung", icon: <SiSamsung className="text-xl" /> },
                { brand: "Pixel",   icon: <FaGoogle  className="text-xl" /> },
                { brand: "iPhone",  icon: <FaApple   className="text-xl" /> },
              ].map(({ brand, icon }) => (
                <button key={brand} onClick={() => setSelectedBrand(selectedBrand === brand ? "" : brand)}
                  className={`w-12 h-12 rounded-xl border transition flex items-center justify-center
                    ${selectedBrand === brand ? "bg-white text-black" : "bg-white/10 border-white/20 hover:bg-white/20"}`}>
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-gray-300">Mức giá</h3>
            <div className="flex flex-col gap-2 text-sm">
              {["Dưới 5 triệu", "5 - 10 triệu", "10 - 20 triệu", "Trên 20 triệu"].map((price) => (
                <label key={price} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedPrices.includes(price)}
                    onChange={() => togglePrice(price)} className="accent-white" />
                  {price}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* DANH SÁCH SẢN PHẨM */}
        <div className="flex-1 grid md:grid-cols-5 gap-6">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <article key={item}
              className="flex flex-col gap-3 p-3 rounded-[20px] overflow-hidden transition-transform duration-300 hover:-translate-y-1
                bg-[#00000001] backdrop-blur-[2px]
                shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
                hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.60),inset_1px_0_0_rgba(255,255,255,0.48),inset_0_-1px_1px_rgba(0,0,0,0.20),inset_-1px_0_1px_rgba(0,0,0,0.18),0_8px_32px_rgba(0,0,0,0.4)]">
              {/* Ảnh sản phẩm */}
              <div className="w-full h-56 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden">
                <div className="w-full h-full flex items-center justify-center text-white/10 text-4xl font-bold">
                  {item}
                </div>
              </div>
              {/* Thông tin */}
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="font-semibold text-white text-sm leading-snug mb-1">
                    Điện thoại Demo {item}
                  </h3>
                  <p className="text-[#ff3b30] font-semibold text-lg text-right">
                    12.990.000đ
                  </p>
                </div>
                {/* Nút Mua Ngay - màu cam như thiết kế gốc */}
                <button className="w-full h-9 flex items-center justify-center rounded-full text-white text-sm font-medium
                  bg-[rgba(255,149,0,0.7)] border border-[#ff9500]
                  backdrop-blur-[2px]
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]
                  hover:bg-[rgba(255,149,0,0.9)] transition">
                  Mua Ngay
                </button>
              </div>
            </article>
          ))}
        </div>

      </div>
    </div>
  );
}