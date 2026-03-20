// ============================================================
// authUtils.js  —  Quản lý token xác thực tập trung
// ============================================================

const TOKEN_KEY_USER  = "auth_token_user";
const TOKEN_KEY_ADMIN = "auth_token_admin";
const USER_KEY        = "user";
const ADMIN_KEY       = "admin_user";

// ── Cờ toàn cục để tránh redirect nhiều lần ─────────────────
let _isRedirecting = false;

// ── Decode JWT payload (không verify signature) ──────────────
function _decodeJwtPayload(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
    return JSON.parse(atob(base64 + pad));
  } catch {
    return null;
  }
}

// ── Kiểm tra token có hết hạn chưa ───────────────────────────
export function isTokenExpired(type = "user") {
  const tokenKey = type === "admin" ? TOKEN_KEY_ADMIN : TOKEN_KEY_USER;
  const token    = localStorage.getItem(tokenKey);
  if (!token) return true;
  const payload = _decodeJwtPayload(token);
  if (!payload?.exp) return true;
  // buffer 30s để tránh race condition
  return Date.now() / 1000 >= payload.exp - 30;
}

// ── Kiểm tra và xử lý hết hạn khi vào trang ─────────────────
export function checkAndHandleExpiry(type = "user") {
  const tokenKey = type === "admin" ? TOKEN_KEY_ADMIN : TOKEN_KEY_USER;
  const token    = localStorage.getItem(tokenKey);
  if (!token) return false;

  if (!isTokenExpired(type)) return false;

  if (!_isRedirecting) {
    _isRedirecting = true;
    clearSession(type);
    sessionStorage.setItem("logout_toast_type", "error");
    sessionStorage.setItem(
      "logout_toast",
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    );
    window.location.replace(type === "admin" ? "/admin/login" : "/login");
  }
  return true;
}

// ── Lưu session sau đăng nhập ────────────────────────────────
export function saveSession(type, profile, token) {
  // [FIX] Reset redirect flag khi user đăng nhập thành công
  // Trước đây reset trong mỗi authFetch thành công → race condition
  _isRedirecting = false;

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

// ── Sentinel object — dùng để báo hiệu đã redirect ──────────
export const AUTH_REDIRECTED = Object.freeze({ __authRedirected: true });

// ── Wrapper fetch tự động gắn token + xử lý 401 ──────────────
// [FIX] Bỏ _isRedirecting = false sau mỗi request thành công
//       (gây race condition khi 401 và 200 đến cùng lúc).
//       Flag chỉ được reset trong saveSession() khi user đăng nhập lại.
export async function authFetch(url, options = {}, type = "user") {
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? { ...getAuthHeadersFormData(type), ...(options.headers || {}) }
    : { ...getAuthHeaders(type),         ...(options.headers || {}) };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    if (!_isRedirecting) {
      _isRedirecting = true;
      clearSession(type);
      sessionStorage.setItem("logout_toast_type", "error");
      sessionStorage.setItem(
        "logout_toast",
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      );
      window.location.replace(type === "admin" ? "/admin/login" : "/login");
    }
    return AUTH_REDIRECTED;
  }

  // [FIX] KHÔNG reset _isRedirecting ở đây — chỉ reset trong saveSession()
  return res;
}