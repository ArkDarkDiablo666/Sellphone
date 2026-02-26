import React, { useState } from "react";
import { Search, ShoppingCart, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { FaApple, FaGoogle } from "react-icons/fa";
import { SiSamsung } from "react-icons/si";
import bgImage from "./Image/image-177.png";

export default function Product() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedPrices, setSelectedPrices] = useState([]);

  const handleCartClick = () => {
    user ? navigate("/cart") : navigate("/login");
  };

  const handleUserClick = () => {
    user ? navigate("/information") : navigate("/login");
  };

  const togglePrice = (price) => {
    if (selectedPrices.includes(price)) {
      setSelectedPrices(selectedPrices.filter((p) => p !== price));
    } else {
      setSelectedPrices([...selectedPrices, price]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-950 text-white">

      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-5 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="text-2xl font-bold text-white">
          PHONEZONE
        </div>

        <div className="flex gap-8 items-center text-gray-300">
          <Link to="/" className="hover:text-white">Trang chủ</Link>
          <Link to="/product" className="text-white">Sản phẩm</Link>
        </div>

        <div className="flex items-center gap-6">
          <Search className="cursor-pointer hover:text-white" size={22} />
          <button onClick={handleCartClick}>
            <ShoppingCart size={22} />
          </button>
          <button onClick={handleUserClick}>
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt="avatar"
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20"
              />
            ) : (
              <User size={22} />
            )}
          </button>
        </div>
      </nav>

      <div
        className="h-[350px] bg-cover bg-center"
        style={{ backgroundImage: `url(${bgImage})` }}
      >
        <div className="h-full w-full bg-black/60 flex items-center justify-center">
          <h1 className="text-4xl font-bold">Danh sách sản phẩm</h1>
        </div>
      </div>

      <div className="flex gap-[10px] px-10 py-10">

        <div className="w-[220px] bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5">

          <h2 className="text-lg font-semibold mb-5">Bộ lọc tìm kiếm</h2>

          <div className="mb-6">
            <h3 className="mb-3 text-gray-300">Hãng sản xuất</h3>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedBrand("Samsung")}
                className={`w-12 h-12 rounded-xl border transition flex items-center justify-center
                ${
                  selectedBrand === "Samsung"
                    ? "bg-white text-black"
                    : "bg-white/10 border-white/20 hover:bg-white/20"
                }`}
              >
                <SiSamsung className="text-xl" />
              </button>

              <button
                onClick={() => setSelectedBrand("Pixel")}
                className={`w-12 h-12 rounded-xl border transition flex items-center justify-center
                ${
                  selectedBrand === "Pixel"
                    ? "bg-white text-black"
                    : "bg-white/10 border-white/20 hover:bg-white/20"
                }`}
              >
                <FaGoogle className="text-xl" />
              </button>

              <button
                onClick={() => setSelectedBrand("iPhone")}
                className={`w-12 h-12 rounded-xl border transition flex items-center justify-center
                ${
                  selectedBrand === "iPhone"
                    ? "bg-white text-black"
                    : "bg-white/10 border-white/20 hover:bg-white/20"
                }`}
              >
                <FaApple className="text-xl" />
              </button>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-gray-300">Mức giá</h3>

            <div className="flex flex-col gap-2 text-sm">
              {[
                "Dưới 5 triệu",
                "5 - 10 triệu",
                "10 - 20 triệu",
                "Trên 20 triệu",
              ].map((price) => (
                <label key={price} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPrices.includes(price)}
                    onChange={() => togglePrice(price)}
                    className="accent-white"
                  />
                  {price}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 grid md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 hover:bg-white/10 transition"
            >
              <div className="h-40 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg mb-4"></div>

              <h3 className="font-semibold mb-2">
                Điện thoại Demo {item}
              </h3>

              <p className="text-red-400 mb-3">
                12.990.000đ
              </p>

              <button className="w-full py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition">
                Mua ngay
              </button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}