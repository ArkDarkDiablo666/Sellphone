import { useState } from "react";
import bg from "./Image/image-177.png";

export default function OTPForm({ onNext }) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const handleChange = (value, index) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
  };

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
            Nhập mã OTP
          </h2>

          <p className="text-gray-300 mb-8">
            Nhập mã OTP được gửi đến email của bạn.
          </p>

          <div className="flex gap-4 mb-6">
            {otp.map((digit, index) => (
              <input
                key={index}
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(e.target.value, index)}
                className="w-14 h-14 text-center text-xl rounded-lg 
                bg-transparent border border-white/40 
                focus:ring-2 focus:ring-white/60 outline-none"
              />
            ))}
          </div>

          <button
            onClick={onNext}
            className="p-3 rounded-full bg-gray-300 hover:bg-white text-black font-semibold transition"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}