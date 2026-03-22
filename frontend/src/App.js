import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from "react-router-dom";

import Login from "./Login";
import Forgotpassword from "./Forgotpassword";
import OTPForm from "./OTPForm";
import Resetpassword from "./Resetpassword";
import Home from "./Home";
import Product from "./Product";
import Informationproduct from "./Informationproduct";
import Payment from "./Payment";
import Information from "./Information";
import Loginmanage from "./Loginmanage";
import Admin from "./Admin";
import Staff from "./Staff";
import { CartProvider } from "./Cart";
import Cartpage from "./Cart";
import Orders from "./Orders";
import Blog, { BlogDetail } from "./Blog";
import Searchpage from "./Searchpage";
import MomoReturn from "./MomoReturn";
import Chatbot from "./Chatbot";

// ── Tự động scroll về đầu trang mỗi khi đổi route ──────────────
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

// ── Chỉ hiện Chatbot ở trang customer, ẩn khỏi admin/staff ─────
function ConditionalChatbot() {
  const { pathname } = useLocation();
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/staff");
  if (isAdminArea) return null;
  return <Chatbot />;
}

// ── Trang 404 ───────────────────────────────────────────────────
function NotFound() {
  const navigate = useNavigate();
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 text-white"
      style={{ background: "#0a0a0a" }}
    >
      <p className="text-8xl font-bold" style={{ color: "rgba(255,255,255,0.05)" }}>404</p>
      <p className="text-lg text-white/50 -mt-6">Trang không tồn tại</p>
      <button
        onClick={() => navigate("/")}
        className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-sm font-medium transition focus:outline-none"
      >
        Về trang chủ
      </button>
    </div>
  );
}

function App() {
  return (
    <Router>
      {/* ScrollToTop phải nằm bên trong Router để dùng được useLocation */}
      <ScrollToTop />
      <CartProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/forgot_password" element={<Forgotpassword />} />
          <Route path="/login/forgot_password/otp" element={<OTPForm />} />
          <Route path="/login/forgot_password/otp/reset_password" element={<Resetpassword />} />
          <Route path="/product" element={<Product />} />
          <Route path="/product/:id" element={<Informationproduct />} />
          <Route path="/cart" element={<Cartpage />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:id" element={<BlogDetail />} />
          <Route path="/information" element={<Information />} />
          <Route path="/admin/login" element={<Loginmanage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/search" element={<Searchpage />} />
          <Route path="/payment/momo-return" element={<MomoReturn />} />
          {/* [FIX] 404 thay vì redirect về Login */}
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* [FIX] Chatbot ẩn trên /admin và /staff */}
        <ConditionalChatbot />
      </CartProvider>
    </Router>
  );
}

export default App;