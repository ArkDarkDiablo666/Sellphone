import Login from "./Login";
import ForgotPassword from "./Forgotpassword";
import OTPForm from "./OTPForm";
import Resetpassword from "./Resetpassword";
import Home from "./Home";
import Product from "./Product";
import Cart from "./Cart";
import Payment from "./Payment";
import Informatio from "./Information";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

function App() {
  return (
    <Router>
      <Routes>
        {/* ROOT */}
        {/* LOGIN FLOW */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/forgot_password" element={<ForgotPassword />} />
        <Route path="/login/forgot_password/otp" element={<OTPForm />} />
        <Route path="/login/forgot_password/otp/reset_password" element={<Resetpassword />} />
        <Route path="/product" element={<Product />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/information" element={<Informatio />} />

        {/* FALLBACK */}
        <Route path="*" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;