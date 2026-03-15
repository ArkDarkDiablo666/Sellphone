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
import Searchage from "./Searchpage";
import Chatbot from "./Chatbot";   // [NEW]
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

function App() {
  return (
    <Router>
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
          <Route path="/search" element={<Searchage />} />
          <Route path="*" element={<Login />} />
        </Routes>

        {/* [NEW] Chatbot gợi ý sản phẩm — hiển thị trên tất cả trang customer */}
        <Chatbot />
      </CartProvider>
    </Router>
  );
}

export default App;