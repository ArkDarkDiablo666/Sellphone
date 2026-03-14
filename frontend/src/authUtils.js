// ============================================================
// authUtils.js  —  Quản lý token xác thực tập trung
// ============================================================

const TOKEN_KEY_USER  = "auth_token_user";
const TOKEN_KEY_ADMIN = "auth_token_admin";
const USER_KEY        = "user";
const ADMIN_KEY       = "admin_user";

// ── Cờ toàn cục để tránh redirect nhiều lần ─────────────────
let _isRedirecting = false;

// ── Lưu session sau đăng nhập ────────────────────────────────
export function saveSession(type, profile, token) {
  if (type === "user") {
    localStorage.setItem(USER_KEY,       JSON.stringify(profile));
    localStorage.setItem(TOKEN_KEY_USER, token || "");
  } else {
    localStorage.setItem(ADMIN_KEY,       JSON.stringify(profile));
    localStorage.setItem(TOKEN_KEY_ADMIN, token || "");
  }
  window.dispatchEvent(new Event("userUpdated"));
}

// ── Xóa session khi đăng xuất ────────────────────────────────
export function clearSession(type = "user") {
  if (type === "user") {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY_USER);
  } else {
    localStorage.removeItem(ADMIN_KEY);
    localStorage.removeItem(TOKEN_KEY_ADMIN);
  }
}

// ── Lấy user object ──────────────────────────────────────────
export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
  catch { return null; }
}

export function getAdminUser() {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || "null"); }
  catch { return null; }
}

// ── Kiểm tra đăng nhập ───────────────────────────────────────
export function isLoggedIn() {
  return !!(getUser()?.id && localStorage.getItem(TOKEN_KEY_USER));
}

export function isAdminLoggedIn(requiredRole = null) {
  const admin = getAdminUser();
  const token = localStorage.getItem(TOKEN_KEY_ADMIN);
  if (!admin?.id || !token) return false;
  if (requiredRole && admin.role !== requiredRole) return false;
  return true;
}

// ── Tạo headers kèm Bearer token ────────────────────────────
export function getAuthHeaders(type = "user", extra = {}) {
  const tokenKey = type === "admin" ? TOKEN_KEY_ADMIN : TOKEN_KEY_USER;
  const token    = localStorage.getItem(tokenKey) || "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function getAuthHeadersFormData(type = "user") {
  const tokenKey = type === "admin" ? TOKEN_KEY_ADMIN : TOKEN_KEY_USER;
  const token    = localStorage.getItem(tokenKey) || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Sentinel object — dùng để báo hiệu đã redirect, KHÔNG throw ──
// Caller kiểm tra: if (res === AUTH_REDIRECTED) return;
export const AUTH_REDIRECTED = Object.freeze({ __authRedirected: true });

// ── Wrapper fetch tự động gắn token + xử lý 401 ──────────────
//
// FIX so với bản cũ:
//   1. Không throw Error("Phiên đăng nhập đã hết hạn") → gây uncaught error
//      và React re-render loop.
//   2. Trả về sentinel AUTH_REDIRECTED thay vì throw.
//   3. _isRedirecting guard ngăn redirect chạy nhiều lần song song
//      khi nhiều authFetch cùng nhận 401 một lúc.
//   4. Caller nên kiểm tra: if (!res || res === AUTH_REDIRECTED) return;
//
export async function authFetch(url, options = {}, type = "user") {
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? { ...getAuthHeadersFormData(type), ...(options.headers || {}) }
    : { ...getAuthHeaders(type),         ...(options.headers || {}) };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Chỉ redirect một lần dù nhiều request cùng thất bại
    if (!_isRedirecting) {
      _isRedirecting = true;
      clearSession(type);
      sessionStorage.setItem(
        "logout_toast",
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      );
      // Dùng replace để không lưu trang admin vào history
      window.location.replace(type === "admin" ? "/admin/login" : "/login");
    }
    // Trả về sentinel — KHÔNG throw, tránh uncaught runtime error
    return AUTH_REDIRECTED;
  }

  _isRedirecting = false; // reset nếu request thành công
  return res;
}
