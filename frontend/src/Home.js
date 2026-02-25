import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShoppingCart, User } from "lucide-react";
import bgImage from "./Image/image-177.png";

export default function Home() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const handleCartClick = () => {
    if (user) {
      navigate("/cart");
    } else {
      navigate("/login");
    }
  };

  const handleUserClick = () => {
    if (user) {
      navigate("/information");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="relative min-h-screen text-white overflow-hidden">

      {/* ===== Background Image (KHÔNG blur trực tiếp) ===== */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{ backgroundImage: `url(${bgImage})` }}
      ></div>

      {/* ===== Dark Overlay + Blur ===== */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

      {/* ===== Main Content ===== */}
      <div className="relative z-10">

        {/* ===== NAVBAR ===== */}
        <nav className="flex justify-between items-center px-10 py-5 backdrop-blur-md bg-white/5 border-b border-white/10">

          {/* Logo */}
          <div className="text-2xl font-bold tracking-wide">
            PHONEZONE
          </div>

          {/* Menu */}
          <div className="flex gap-8 text-gray-300">
            <Link to="/" className="hover:text-white transition duration-300">
              Trang chủ
            </Link>
            <Link to="/product" className="hover:text-white transition duration-300">
              Sản phẩm
            </Link>
          </div>

          {/* Icons */}
          <div className="flex gap-6 items-center text-gray-300">
            <Search className="cursor-pointer hover:text-white transition" size={22} />

            <button onClick={handleCartClick}>
              <ShoppingCart className="hover:text-white transition" size={22} />
            </button>

            <button onClick={handleUserClick}>
              <User className="hover:text-white transition" size={22} />
            </button>
          </div>
        </nav>

        {/* ===== HERO SECTION ===== */}
        <section className="flex flex-col items-center justify-center text-center py-40 px-6">

          <h1 className="text-5xl font-bold mb-6 drop-shadow-lg bg-gradient-to-r from-gray-200 to-gray-400 bg-clip-text text-transparent">
            Công nghệ trong tầm tay bạn
          </h1>

          <p className="text-gray-400 max-w-xl mb-10">
            Khám phá các dòng điện thoại và thiết bị mới nhất với hiệu năng mạnh mẽ
          </p>

          <Link
            to="/product"
            className="px-8 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-md hover:bg-white/20 transition duration-300"
          >
            Khám phá ngay
          </Link>

        </section>

      </div>
    </div>
  );
}