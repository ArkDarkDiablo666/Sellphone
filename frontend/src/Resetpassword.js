import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import bg from "./Image/image-177.png";

export default function Resetpassword() {
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

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
            Tạo mật khẩu mới
          </h2>

          <div className="flex flex-col gap-[20px]">

            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                placeholder="Mật khẩu"
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 pl-6 pr-12 rounded-full bg-transparent 
                border border-white/40 text-white placeholder-gray-400 
                focus:ring-2 focus:ring-white/60 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Nhập lại mật khẩu"
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full p-3 pl-6 pr-12 rounded-full bg-transparent 
                border border-white/40 text-white placeholder-gray-400 
                focus:ring-2 focus:ring-white/60 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {password !== confirm && confirm !== "" && (
              <p className="text-red-500 text-sm">
                Mật khẩu không trùng khớp.
              </p>
            )}

            <button
              className="p-3 rounded-full bg-gray-300 hover:bg-white text-black font-semibold transition"
            >
              Xác nhận
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}