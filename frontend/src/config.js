// src/config.js — Tập trung cấu hình API URL
// Thay vì hardcode "http://localhost:8000" rải rác khắp nơi,
// tất cả component import API từ đây.
//
// Khi deploy production, chỉ cần set biến môi trường:
//   REACT_APP_API_URL=https://api.yourdomain.com
// rồi build lại — không cần sửa từng file.

export const API = process.env.REACT_APP_API_URL || "http://localhost:8000";