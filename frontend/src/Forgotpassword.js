import bg from "./Image/image-177.png";
import { useState } from "react";

export default function Forgotpassword({ onNext }) {
  const [email, setEmail] = useState("");

  return (
    <div className="relative h-screen flex items-center justify-center overflow-hidden">
      <img
        src={bg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover blur-md brightness-75 scale-110"
      />
      <div className="absolute inset-0 bg-black/60"></div>

      <div className="relative w-[1200px] h-[700px] rounded-3xl overflow-hidden flex shadow-2xl">
        <div className="w-1/2">
          <img src={bg} alt="" className="w-full h-full object-cover" />
        </div>

        <div className="w-1/2 bg-black/40 backdrop-blur-xl flex flex-col justify-center px-20 text-white">
          <h2 className="text-3xl font-semibold text-white mb-6">
            Quên mật khẩu
          </h2>

          <p className="text-gray-300 mb-6">
            Nhập email của bạn để nhận mã OTP.
          </p>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 pl-6 rounded-full bg-transparent 
            border border-white/40 text-white placeholder-gray-400 
            focus:ring-2 focus:ring-white/60 outline-none transition mb-[20px]"
          />

          <button
            onClick={onNext}
            className="p-3 rounded-full bg-gray-300 hover:bg-white text-black font-semibold transition"
          >
            Gửi OTP
          </button>
        </div>
      </div>
    </div>
  );
}