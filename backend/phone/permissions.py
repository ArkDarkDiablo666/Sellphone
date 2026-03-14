"""
permissions.py — decode JWT thủ công bằng PyJWT.
Staff/Admin token chứa: staff_id, role, type="staff"
Customer token chứa:   customer_id, type="customer"

[FIX] Thêm thuộc tính www_authenticate_realm để DRF tự gắn
      WWW-Authenticate header vào 401 response → frontend nhận
      được header chuẩn, dễ phân biệt expired vs invalid.
"""
import logging
import jwt as pyjwt
from django.conf import settings
from rest_framework.permissions import BasePermission

logger = logging.getLogger(__name__)


def _decode_token(request):
    """
    Decode Bearer token, trả về (payload, error_code) tuple.
    error_code: None | 'expired' | 'invalid' | 'missing'
    """
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Bearer "):
        return None, "missing"
    raw = auth.split(" ", 1)[1].strip()
    if not raw:
        return None, "missing"
    try:
        payload = pyjwt.decode(raw, settings.SECRET_KEY, algorithms=["HS256"])
        logger.debug(
            "[PERM] Token OK — type=%s role=%s staff_id=%s",
            payload.get("type"), payload.get("role"), payload.get("staff_id")
        )
        return payload, None
    except pyjwt.ExpiredSignatureError:
        logger.info("[PERM] Token expired")
        return None, "expired"
    except pyjwt.InvalidTokenError as e:
        logger.info("[PERM] Token invalid: %s", e)
        return None, "invalid"


def _attach_auth_error(request, error_code):
    """Lưu error_code vào request để view có thể dùng nếu cần."""
    request._auth_error = error_code


class IsAdminOrStaff(BasePermission):
    message = "Bạn không có quyền truy cập. Yêu cầu đăng nhập Admin hoặc Staff."
    www_authenticate_realm = "api"

    def has_permission(self, request, view):
        payload, err = _decode_token(request)
        if err:
            _attach_auth_error(request, err)
            if err == "expired":
                self.message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            return False
        result = bool(
            payload.get("type") == "staff"
            and payload.get("role") in ("Admin", "Staff")
        )
        if not result:
            self.message = "Bạn không có quyền truy cập. Yêu cầu đăng nhập Admin hoặc Staff."
        logger.debug("[PERM] IsAdminOrStaff → %s", result)
        return result


class IsAdminOnly(BasePermission):
    message = "Chỉ Admin mới có quyền thực hiện thao tác này."
    www_authenticate_realm = "api"

    def has_permission(self, request, view):
        payload, err = _decode_token(request)
        if err:
            _attach_auth_error(request, err)
            if err == "expired":
                self.message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            return False
        result = bool(
            payload.get("type") == "staff"
            and payload.get("role") == "Admin"
        )
        if not result:
            self.message = "Chỉ Admin mới có quyền thực hiện thao tác này."
        logger.debug("[PERM] IsAdminOnly → %s", result)
        return result


class IsAuthenticatedCustomer(BasePermission):
    message = "Vui lòng đăng nhập để thực hiện thao tác này."
    www_authenticate_realm = "api"

    def has_permission(self, request, view):
        payload, err = _decode_token(request)
        if err:
            _attach_auth_error(request, err)
            if err == "expired":
                self.message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            return False
        if payload.get("type") == "customer" and payload.get("customer_id"):
            return True
        if payload.get("type") == "staff" and payload.get("staff_id"):
            return True
        return False