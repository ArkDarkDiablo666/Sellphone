// ============================================================
// admin_validation_patches.js
// ============================================================
// File này KHÔNG phải component — chỉ chứa các hàm validate
// được tách ra để patch vào Admin.js và Staff.js
//
// Cách dùng trong Admin.js / Staff.js:
//   import {
//     validateVoucherForm,
//     validateProductImageCount,
//     MAX_PRODUCT_IMAGES,
//   } from "./admin_validation_patches";
// ============================================================

// ── Giới hạn upload ────────────────────────────────────────
// [FIX] Sửa giá trị và comment cho khớp nhau
export const MAX_PRODUCT_IMAGES = 10;     // tối đa 10 ảnh / sản phẩm
export const MAX_IMAGE_SIZE_MB  = 100;    // tối đa 100MB / ảnh
export const MAX_VIDEO_SIZE_MB  = 100;    // tối đa 100MB / video review
export const MAX_GIF_SIZE_MB    = 100;    // tối đa 100MB / GIF

// ── Validate file ảnh ─────────────────────────────────────
export function validateImageFile(file) {
  if (!file) return null;
  const ALLOWED = ['image/jpeg','image/jpg','image/png','image/webp'];
  if (!ALLOWED.includes(file.type))
    return "Vui lòng chọn file ảnh (jpg, png, webp)";
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024)
    return `Ảnh không được vượt quá ${MAX_IMAGE_SIZE_MB}MB`;
  return null;
}

// ── Validate file GIF ──────────────────────────────────
export function validateGifFile(file) {
  if (!file) return null;
  if (file.type !== 'image/gif')
    return "Vui lòng chọn file GIF";
  if (file.size > MAX_GIF_SIZE_MB * 1024 * 1024)
    return `GIF không được vượt quá ${MAX_GIF_SIZE_MB}MB`;
  return null;
}

// ── Validate file video (cho review/return) ───────────────
export function validateVideoFile(file) {
  if (!file) return null;
  if (!file.type.startsWith("video/"))
    return "Vui lòng chọn file video";
  if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024)
    return `Video không được vượt quá ${MAX_VIDEO_SIZE_MB}MB (tối đa 100MB)`;
  return null;
}

// ── Validate số lượng ảnh sản phẩm ───────────────────────
export function validateProductImageCount(currentCount, newCount) {
  const total = currentCount + newCount;
  if (total > MAX_PRODUCT_IMAGES)
    return `Tối đa ${MAX_PRODUCT_IMAGES} ảnh mỗi sản phẩm (hiện có ${currentCount}, thêm ${newCount})`;
  return null;
}

// ── Validate form tạo voucher ─────────────────────────────
export function validateVoucherForm(voucher) {
  const errors = [];

  // Mã không trống
  if (!voucher.code?.trim())
    errors.push("Vui lòng nhập mã voucher");
  else if (voucher.code.length < 3)
    errors.push("Mã voucher phải có ít nhất 3 ký tự");
  else if (!/^[A-Z0-9_-]+$/.test(voucher.code))
    errors.push("Mã voucher chỉ được chứa chữ hoa, số, dấu - và _");

  // Giá trị
  const val = parseFloat(voucher.value);
  if (!voucher.value || isNaN(val) || val <= 0)
    errors.push("Giá trị voucher phải lớn hơn 0");

  // Phần trăm tối đa 100
  if (voucher.type === "percent") {
    if (val > 100)
      errors.push("Voucher phần trăm không được vượt quá 100%");
  }

  // Kiểm tra ngày kết thúc sau ngày bắt đầu
  if (voucher.start_date && voucher.end_date) {
    const start = new Date(voucher.start_date);
    const end   = new Date(voucher.end_date);
    if (end <= start)
      errors.push("Ngày kết thúc phải sau ngày bắt đầu");
  }

  // Nếu có ngày kết thúc thì phải có ngày bắt đầu
  if (voucher.end_date && !voucher.start_date)
    errors.push("Vui lòng chọn ngày bắt đầu");

  // Phạm vi
  if (voucher.scope === "category" && !voucher.category_id)
    errors.push("Vui lòng chọn danh mục áp dụng");
  if (voucher.scope === "product" && !voucher.product_id)
    errors.push("Vui lòng chọn sản phẩm áp dụng");

  // max_discount chỉ áp dụng cho percent
  if (voucher.type === "fixed" && voucher.max_discount)
    errors.push("Giảm tối đa chỉ áp dụng cho voucher phần trăm");

  return errors;  // [] = hợp lệ
}

// ── Validate RAM ─────────────────────────────────────────
export function validateRam(val) {
  if (!val) return "Vui lòng nhập RAM";
  const m = val.trim().match(/^(\d+(?:\.\d+)?)\s*GB$/i);
  if (!m) return "RAM phải có dạng số + GB (VD: 8GB)";
  if (parseFloat(m[1]) < 4) return "RAM tối thiểu là 4GB";
  return null;
}

// ── Validate Storage ──────────────────────────────────────
export function validateStorage(val) {
  if (!val) return "Vui lòng nhập bộ nhớ trong";
  const m = val.trim().match(/^(\d+(?:\.\d+)?)\s*(GB|TB)$/i);
  if (!m) return "Bộ nhớ phải có dạng số + GB/TB (VD: 128GB, 1TB)";
  const n = parseFloat(m[1]);
  const u = m[2].toUpperCase();
  if (u === "GB" && n < 64) return "Bộ nhớ GB phải từ 64GB trở lên";
  if (u === "TB" && n < 1)  return "Bộ nhớ TB phải từ 1TB trở lên";
  return null;
}

// ── Validate SĐT Việt Nam ──────────────────────────────────
export function validatePhoneVN(phone) {
  if (!phone?.trim()) return "Vui lòng nhập số điện thoại";
  const cleaned = phone.replace(/\s/g, "");
  if (!/^(0|(\+84))[0-9]{8,9}$/.test(cleaned))
    return "Số điện thoại không hợp lệ (VD: 0901234567)";
  return null;
}

// ── Validate số lượng tồn kho ─────────────────────────────
export function validateStock(val) {
  const n = parseInt(val);
  if (!val || isNaN(n) || n < 1)    return "Số lượng phải lớn hơn 0";
  if (n > 10000)                     return "Số lượng tối đa là 10.000";
  return null;
}

// ── Validate giá ────────────────────────────────────────────
export function validatePrice(val) {
  const n = parseFloat(val);
  if (!val || isNaN(n) || n <= 0) return "Giá phải lớn hơn 0";
  return null;
}