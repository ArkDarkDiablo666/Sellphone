import json
import datetime
from django.conf import settings
import os
from django.contrib.auth.hashers import make_password, check_password
import cloudinary
import cloudinary.uploader

# [FIX #SSL-v3] Patch SSL certificate cho Cloudinary trên Windows.
# Nguyên nhân: Windows thiếu certifi CA bundle → urllib3 không verify được
# Cloudinary SSL cert → SSLEOFError / MaxRetryError port=443.
# Giải pháp: inject certifi CA bundle + disable keep-alive vào requests session
# của Cloudinary SDK TRƯỚC KHI config.
try:
    import certifi
    import requests
    import urllib3

    # Tắt cảnh báo SSL (chỉ trong trường hợp fallback)
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    # Tạo session dùng certifi CA bundle, tắt keep-alive
    _cld_session = requests.Session()
    _cld_session.verify = certifi.where()
    _cld_session.headers.update({"Connection": "close"})  # tắt keep-alive
    adapter = requests.adapters.HTTPAdapter(
        max_retries=urllib3.util.Retry(total=3, backoff_factor=0.5),
        pool_connections=1,
        pool_maxsize=1,
    )
    _cld_session.mount("https://", adapter)
    _cld_session.mount("http://",  adapter)

    # Inject session vào Cloudinary SDK
    try:
        import cloudinary.api_client.execute_request as _exec
        if hasattr(_exec, "http_client") and _exec.http_client is not None:
            if hasattr(_exec.http_client, "_session"):
                _exec.http_client._session = _cld_session
            elif hasattr(_exec.http_client, "session"):
                _exec.http_client.session = _cld_session
    except Exception:
        pass

except ImportError:
    pass  # certifi chưa cài — pip install certifi requests

cloudinary.config(
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME", ""),
    api_key    = os.environ.get("CLOUDINARY_API_KEY",    ""),
    api_secret = os.environ.get("CLOUDINARY_API_SECRET", ""),
    secure     = True,
)

# ══════════════════════════════════════════════════════════════
# IMAGE ENHANCEMENT — Cloudinary AI + Pillow fallback
# ══════════════════════════════════════════════════════════════
import io
import time as _time

# ── Pillow: tăng chất lượng ảnh cục bộ trước khi upload ──────
def _enhance_image_pillow(raw_bytes: bytes):
    """
    Tăng chất lượng ảnh bằng Pillow (chạy local, không cần internet).
    [FIX #EMPTYFILE] Chỉ nhận bytes thuần — KHÔNG nhận file object
    để tránh lỗi con trỏ file bị lệch → Cloudinary nhận file rỗng.
    Trả về: BytesIO nếu thành công, None nếu lỗi.
    """
    try:
        from PIL import Image, ImageEnhance, ImageFilter

        img = Image.open(io.BytesIO(raw_bytes))
        img.load()  # load toàn bộ pixel data ngay lập tức

        # Chuyển RGB (bỏ alpha)
        if img.mode in ("RGBA", "P", "LA"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Sharpen — làm nét cạnh sản phẩm
        img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=130, threshold=3))

        # Tăng độ sắc nét (sharpness)
        img = ImageEnhance.Sharpness(img).enhance(1.4)

        # Tăng contrast nhẹ
        img = ImageEnhance.Contrast(img).enhance(1.08)

        # Tăng độ bão hòa màu nhẹ (ảnh sản phẩm trông tươi hơn)
        img = ImageEnhance.Color(img).enhance(1.06)

        # Xuất ra BytesIO
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=92, optimize=True, progressive=True)
        out.seek(0)
        return out

    except ImportError:
        logger.warning("[ImageEnhance] Pillow chưa được cài. Chạy: pip install Pillow")
        return None
    except Exception as e:
        logger.warning(f"[ImageEnhance] Pillow enhance lỗi: {e}")
        return None


# ── Cloudinary: transformation tăng chất lượng AI ────────────
# Các preset transformation theo loại ảnh
_ENHANCE_TRANSFORMS = {
    # Ảnh sản phẩm / biến thể: upscale + enhance + sharpen
    "product": [
        {"width": 800, "height": 800, "crop": "limit"},
        {"effect": "improve"},          # AI auto-enhance màu sắc & độ sáng
        {"effect": "sharpen:80"},       # Sharpen mức 80
        {"quality": "auto:best"},       # Nén thông minh chất lượng cao nhất
        {"fetch_format": "auto"},       # Tự chọn format tốt nhất (webp/avif)
    ],
    # Ảnh bài viết / content: rộng hơn, enhance nhẹ hơn
    "post": [
        {"width": 1200, "crop": "limit"},
        {"effect": "improve:50"},
        {"effect": "sharpen:50"},
        {"quality": "auto:good"},
        {"fetch_format": "auto"},
    ],
    # Avatar: crop mặt + enhance
    "avatar": [
        {"width": 300, "height": 300, "crop": "fill", "gravity": "face"},
        {"effect": "improve:40"},
        {"effect": "sharpen:40"},
        {"quality": "auto:good"},
        {"fetch_format": "auto"},
    ],
    # Danh mục: enhance nhẹ
    "category": [
        {"width": 400, "height": 400, "crop": "fill"},
        {"effect": "improve:40"},
        {"quality": "auto:good"},
        {"fetch_format": "auto"},
    ],
}


# ── [FIX #SSL] Wrapper chính: Pillow enhance → Cloudinary AI upload ──────────
# Nguyên nhân lỗi SSL gốc: SDK tái dùng connection pool cũ bị đứt (keep-alive)
# → SSLEOFError / MaxRetryError / TCPKeepAliveHTTPSConnection port=443.
def _upload_to_cloudinary(file_or_path, enhance: str = None, **kwargs):
    """
    Upload ảnh lên Cloudinary với 2 lớp tăng chất lượng:

    Bước 1 — Pillow (local, trước khi upload):
      - Sharpen, contrast, color enhance, xuất JPEG quality=92
      - Nếu Pillow lỗi/chưa cài → dùng file gốc (không crash)

    Bước 2 — Cloudinary AI transformation (trên cloud):
      - enhance="product" | "post" | "avatar" | "category"
      - Nếu không truyền enhance → dùng transformation trong kwargs gốc

    Bước 3 — Retry SSL:
      - Tự retry 1 lần sau 0.5s nếu gặp SSL/EOF/connection error

    Cách dùng:
      result = _upload_to_cloudinary(img_file, enhance="product",
                  folder="sellphone/products/1",
                  public_id="product_1_img_0", overwrite=True)
    """
    resource_type = kwargs.get("resource_type", "image")

    # ── Bước 1: Đọc toàn bộ file vào bytes ngay lập tức ──────────────────────
    # [FIX #EMPTYFILE] Django InMemoryUploadedFile / file object chỉ đọc được 1 lần.
    # Phải đọc hết thành bytes TRƯỚC khi làm bất cứ điều gì,
    # tránh con trỏ bị lệch khiến Cloudinary nhận file rỗng.
    if isinstance(file_or_path, (bytes, bytearray)):
        raw_bytes = bytes(file_or_path)
    elif isinstance(file_or_path, str):
        raw_bytes = None  # path string — Cloudinary tự đọc
    else:
        try:
            if hasattr(file_or_path, "seek"):
                file_or_path.seek(0)
            raw_bytes = file_or_path.read()
        except Exception:
            raw_bytes = None

    # ── Bước 2: Pillow enhance (chỉ ảnh, không áp dụng video) ───────────────
    enhanced_bytes = None
    if resource_type == "image" and raw_bytes is not None:
        enhanced_bytes = _enhance_image_pillow(raw_bytes)

    # Chọn nguồn upload: enhanced BytesIO > raw bytes > path string gốc
    if enhanced_bytes is not None:
        upload_source = enhanced_bytes
    elif raw_bytes is not None:
        upload_source = io.BytesIO(raw_bytes)
    else:
        upload_source = file_or_path  # fallback path string

    # ── Bước 3: Gắn Cloudinary AI transformation nếu có preset ──────────────
    if enhance and enhance in _ENHANCE_TRANSFORMS:
        kwargs["transformation"] = _ENHANCE_TRANSFORMS[enhance]
        kwargs.pop("quality", None)

    # ── Bước 4: Upload với retry SSL ─────────────────────────────────────────
    # [FIX #SSL-v2] Reset toàn bộ connection pool của Cloudinary SDK trước khi upload.
    # Nguyên nhân gốc: urllib3 giữ connection pool keep-alive, khi server Cloudinary
    # đóng kết nối phía backend (idle timeout ~60s), SDK vẫn tái dùng socket cũ
    # → SSLEOFError. Giải pháp: buộc tạo session mới bằng cách reset HTTPClient.
    def _reset_cloudinary_connection():
        """Reset hoàn toàn connection pool + inject certifi session mới."""
        try:
            import certifi, requests, urllib3
            import cloudinary.api_client.execute_request as _exec

            # Close session cũ
            if hasattr(_exec, "http_client") and _exec.http_client:
                old_sess = getattr(_exec.http_client, "_session", None) or                            getattr(_exec.http_client, "session",  None)
                if old_sess and hasattr(old_sess, "close"):
                    try: old_sess.close()
                    except Exception: pass
            _exec.http_client = None

            # Tạo session mới với certifi + Connection: close
            new_sess = requests.Session()
            new_sess.verify = certifi.where()
            new_sess.headers.update({"Connection": "close"})
            _adapter = requests.adapters.HTTPAdapter(
                max_retries=urllib3.util.Retry(total=1, backoff_factor=0.3),
                pool_connections=1, pool_maxsize=1,
            )
            new_sess.mount("https://", _adapter)
            new_sess.mount("http://",  _adapter)

            # Inject session mới vào SDK
            import cloudinary.api_client.http_client as _hc
            if hasattr(_hc, "HttpClient"):
                client = _hc.HttpClient()
                if hasattr(client, "_session"):   client._session = new_sess
                elif hasattr(client, "session"):  client.session  = new_sess
                _exec.http_client = client

        except Exception as e:
            logger.debug(f"[SSL-reset] {e}")

    max_tries = 3   # tăng lên 3 lần
    last_err  = None
    for attempt in range(max_tries):
        try:
            # Reset connection pool trước mỗi lần thử
            _reset_cloudinary_connection()
            # Reset về đầu khi retry
            if attempt > 0 and hasattr(upload_source, "seek"):
                upload_source.seek(0)
            return cloudinary.uploader.upload(upload_source, **kwargs)
        except Exception as e:
            err_str = str(e).lower()
            is_retriable = any(k in err_str for k in (
                "ssl", "eof", "connection", "retry", "timeout",
                "reset", "broken pipe", "remotedisconnected",
            ))
            last_err = e
            if is_retriable and attempt < max_tries - 1:
                wait = 1.0 * (attempt + 1)  # backoff: 1s, 2s
                logger.warning(f"[Upload] SSL/connection lỗi lần {attempt+1}, thử lại sau {wait}s: {e}")
                _time.sleep(wait)
                continue
            raise
    raise last_err
import random
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework import status
from .permissions import IsAdminOrStaff, IsAdminOnly, IsAuthenticatedCustomer
from .models import Customer, Staff, Product, ProductVariant, ProductImage, Category, generate_customer_id, Order, OrderDetail, Post, ProductContent, ReturnRequest, ReturnMedia, Banner, BannerItem, ActivityLog, CustomerActivityLog
import logging
from django.db.models import Avg, Count, Sum, F, FloatField, ExpressionWrapper, Min, Max, Q, DecimalField
from django.db.models.functions import TruncDay, TruncMonth, TruncYear, Coalesce
from django.utils import timezone as tz
from datetime import date as _date
import re as _re
import io
import time
import os as _os
import django.conf as _dj_conf

logger = logging.getLogger(__name__)
MAX_OTP_ATTEMPTS = 5
OTP_EXPIRY_SECONDS = 300


# [FIX #1.3] JWT token helper — dùng cho tất cả login responses
def get_tokens_for_customer(customer):
    """
    Tạo JWT token cho Customer dùng PyJWT trực tiếp.
    [FIX] Đổi từ simplejwt sang PyJWT để đồng nhất với Permissions.py
    — Permissions._decode_token() dùng pyjwt.decode(SECRET_KEY) để verify,
      nếu token được ký bằng simplejwt (SIGNING_KEY có thể khác) thì sẽ fail.
    Token chứa: customer_id, type="customer", exp (8 giờ)
    """
    import jwt as pyjwt
    from datetime import datetime, timezone, timedelta
    from django.conf import settings
    payload = {
        "customer_id": customer.CustomerID,
        "type":        "customer",
        "iat":         datetime.now(timezone.utc),
        "exp":         datetime.now(timezone.utc) + timedelta(hours=720),  # 30 ngày
    }
    return pyjwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def get_tokens_for_staff(staff):
    """
    Tạo JWT token cho Staff/Admin dùng PyJWT trực tiếp.
    Không dùng SimpleJWT vì Staff không phải AbstractBaseUser.
    permissions.py decode token này bằng _decode_token().
    """
    import jwt as pyjwt
    from datetime import datetime, timezone, timedelta
    from django.conf import settings
    payload = {
        "staff_id": staff.StaffID,
        "role":     staff.Role,
        "type":     "staff",
        "iat":      datetime.now(timezone.utc),
        "exp":      datetime.now(timezone.utc) + timedelta(hours=720),  # 30 ngàys
    }
    return pyjwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


# ══════════════════════════════════════════════════════════════
# SEARCH HELPERS
# ══════════════════════════════════════════════════════════════

def _serialize_product(p) -> dict:
    variants = list(ProductVariant.objects.filter(ProductID=p).values("Price", "Image"))
    prices   = [float(v["Price"]) for v in variants if v.get("Price")]

    image_url = ""
    primary = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first()
    if primary:       image_url = primary.ImageUrl or ""
    if not image_url:
        first_img = ProductImage.objects.filter(ProductID=p).first()
        if first_img: image_url = first_img.ImageUrl or ""
    if not image_url and variants:
        image_url = variants[0].get("Image") or ""

    return {
        "id":           p.ProductID,
        "name":         p.ProductName or "",
        "brand":        p.Brand or "",
        "category":     getattr(p.CategoryID, "CategoryName", "") if getattr(p, "CategoryID", None) else "",
        "image":        image_url,
        "min_price":    min(prices) if prices else None,
        "max_price":    max(prices) if prices else None,
        "rating_avg":   0,
        "rating_count": 0,
        "sold":         0,
        "views":        0,
    }


def _serialize_with_ratings(products: list) -> list:
    from .models import Review
    ids     = [p.ProductID for p in products]
    ratings = {
        r["product_id"]: r
        for r in Review.objects.filter(product_id__in=ids)
        .values("product_id")
        .annotate(avg=Avg("rating"), cnt=Count("id"))
        .order_by()
    }
    result = []
    for p in products:
        d = _serialize_product(p)
        r = ratings.get(p.ProductID, {})
        d["rating_avg"]   = round(float(r.get("avg") or 0), 1)
        d["rating_count"] = int(r.get("cnt") or 0)
        result.append(d)
    return result


def _get_fallback_products(exclude_ids=None, max_total=4) -> list:
    done   = list(exclude_ids or [])
    result = []

    def add(p):
        if p and p.ProductID not in done:
            done.append(p.ProductID); result.append(p); return True
        return False

    def first_new(qs):
        for p in qs:
            if p.ProductID not in done: return p
        return None

    try:
        sold_pids = (OrderDetail.objects.values("VariantID__ProductID__ProductID").annotate(tot=Sum("Quantity")).filter(VariantID__ProductID__isnull=False).order_by("-tot").values_list("VariantID__ProductID__ProductID", flat=True)[:30])
        order_map = {pid: i for i, pid in enumerate(sold_pids)}
        qs        = Product.objects.filter(ProductID__in=sold_pids)
        add(first_new(sorted(qs, key=lambda p: order_map.get(p.ProductID, 999))))
    except Exception as e:
        logger.debug(f"Fallback slot1: {e}")

    try:
        add(first_new(Product.objects.all().annotate(avg_r=Avg("reviews__rating"), cnt_r=Count("reviews__id")).filter(cnt_r__gte=1).order_by("-avg_r", "-cnt_r").iterator()))
    except Exception as e:
        logger.debug(f"Fallback slot2: {e}")

    try:
        add(first_new(Product.objects.select_related("CategoryID").exclude(ProductID__in=done).order_by("-CreatedAt")))
    except Exception as e:
        logger.debug(f"Fallback slot3: {e}")

    try:
        add(first_new(Product.objects.all().order_by("-CreatedAt").iterator()))
    except Exception as e:
        logger.debug(f"Fallback slot4: {e}")

    if len(result) < max_total:
        for p in Product.objects.exclude(ProductID__in=done).order_by("-CreatedAt")[:max_total - len(result)]:
            add(p)

    return result[:max_total]


def on_product_saved(product_id):
    try:
        from .search_engine import rebuild_index
        rebuild_index()
    except Exception as e:
        logger.error(f"[Search] rebuild: {e}")
    try:
        from .yolo_search import train_product_async
        train_product_async(product_id)
    except Exception as e:
        logger.error(f"[Search] yolo train: {e}")


# ══════════════════════════════════════════════════════════════
# AUTH HELPERS
# ══════════════════════════════════════════════════════════════

def hash_password(password):
    return make_password(password)

def customer_data(customer):
    return {"id": customer.CustomerID, "full_name": customer.FullName, "email": customer.Email, "avatar": customer.Avatar or "", "login_type": customer.LoginType}

def create_customer(**kwargs):
    from django.db import IntegrityError
    import time
    for _ in range(5):  # retry tối đa 5 lần nếu race condition
        try:
            customer_id = generate_customer_id()
            return Customer.objects.create(CustomerID=customer_id, **kwargs)
        except IntegrityError:
            time.sleep(0.05)  # đợi 50ms rồi thử lại
    raise IntegrityError("Không thể tạo CustomerID sau nhiều lần thử")

def email_exists_message(existing_login_type):
    if existing_login_type == 'google':   return "Email này đã được đăng ký bằng Google, vui lòng đăng nhập bằng Google"
    if existing_login_type == 'facebook': return "Email này đã được đăng ký bằng Facebook, vui lòng đăng nhập bằng Facebook"
    return "Email này đã được đăng ký, vui lòng đăng nhập bằng email và mật khẩu"


# ══════════════════════════════════════════════════════════════
# CUSTOMER AUTH
# ══════════════════════════════════════════════════════════════

@api_view(['POST'])
def check_email(request):
    email = request.data.get('email', '').strip()
    if not email: return Response({"message": "Vui lòng nhập email"}, status=status.HTTP_400_BAD_REQUEST)
    existing = Customer.objects.filter(Email=email).first()
    if existing: return Response({"message": email_exists_message(existing.LoginType)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"message": "Email hợp lệ"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def register_normal(request):
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()
    password  = request.data.get('password', '').strip()
    if not full_name: return Response({"message": "Vui lòng nhập họ và tên", "field": "fullname"}, status=status.HTTP_400_BAD_REQUEST)
    if not email:     return Response({"message": "Vui lòng nhập email", "field": "email"}, status=status.HTTP_400_BAD_REQUEST)
    if not password:  return Response({"message": "Vui lòng nhập mật khẩu", "field": "password"}, status=status.HTTP_400_BAD_REQUEST)
    if ' ' in password:   return Response({"message": "Mật khẩu không được chứa dấu cách", "field": "password"}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 6: return Response({"message": "Mật khẩu phải có ít nhất 6 ký tự", "field": "password"}, status=status.HTTP_400_BAD_REQUEST)
    existing = Customer.objects.filter(Email=email).first()
    if existing: return Response({"message": email_exists_message(existing.LoginType), "field": "email"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        customer = create_customer(FullName=full_name, Email=email, Password=hash_password(password), LoginType='normal')
    except ValueError as e:
        return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    _write_customer_log(request, customer, "register", f"Email: {email}")
    return Response({"message": "Đăng ký thành công", "token": get_tokens_for_customer(customer), "customer": customer_data(customer)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def login_normal(request):
    email    = request.data.get('email', '').strip()
    password = request.data.get('password', '').strip()
    if not email:    return Response({"message": "Vui lòng nhập email", "field": "email"}, status=status.HTTP_400_BAD_REQUEST)
    if not password: return Response({"message": "Vui lòng nhập mật khẩu", "field": "password"}, status=status.HTTP_400_BAD_REQUEST)
    existing = Customer.objects.filter(Email=email).first()
    if not existing:                          return Response({"message": "Email không tồn tại", "field": "email"}, status=status.HTTP_404_NOT_FOUND)
    if existing.LoginType != 'normal':        return Response({"message": email_exists_message(existing.LoginType), "field": "email"}, status=status.HTTP_400_BAD_REQUEST)
    if not check_password(password, existing.Password): return Response({"message": "Mật khẩu không đúng", "field": "password"}, status=status.HTTP_401_UNAUTHORIZED)
    avatar = existing.Avatar or ""
    if avatar.startswith("data:"): avatar = ""
    _write_customer_log(request, existing, "login", f"Email: {existing.Email}")
    return Response({"message": "Đăng nhập thành công", "token": get_tokens_for_customer(existing), "customer": {"id": existing.CustomerID, "full_name": existing.FullName, "email": existing.Email, "avatar": avatar, "login_type": existing.LoginType}}, status=status.HTTP_200_OK)


@api_view(['POST'])
def register_google(request):
    google_id = request.data.get('google_id', '').strip()
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()
    avatar    = request.data.get('avatar', '')
    if not google_id or not email or not full_name: return Response({"message": "Thiếu thông tin từ Google"}, status=status.HTTP_400_BAD_REQUEST)
    existing = Customer.objects.filter(Email=email).first()
    if existing: return Response({"message": email_exists_message(existing.LoginType)}, status=status.HTTP_400_BAD_REQUEST)
    try:
        customer = create_customer(FullName=full_name, Email=email, Password=None, GoogleID=google_id, Avatar=avatar, LoginType='google')
    except ValueError as e:
        return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    _write_customer_log(request, customer, "register", f"Google: {email}")
    return Response({"message": "Đăng ký Google thành công", "token": get_tokens_for_customer(customer), "customer": customer_data(customer)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def login_google(request):
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()
    if not full_name or not email: return Response({"message": "Thiếu thông tin Google"}, status=status.HTTP_400_BAD_REQUEST)
    existing = Customer.objects.filter(Email=email).first()
    if not existing:                   return Response({"message": "Tài khoản Google chưa được đăng ký"}, status=status.HTTP_404_NOT_FOUND)
    if existing.LoginType != 'google': return Response({"message": email_exists_message(existing.LoginType)}, status=status.HTTP_400_BAD_REQUEST)
    _write_customer_log(request, existing, "login_google", f"Email: {existing.Email}")
    return Response({"message": "Đăng nhập Google thành công", "token": get_tokens_for_customer(existing), "customer": {"id": existing.CustomerID, "full_name": existing.FullName, "email": existing.Email, "avatar": existing.Avatar or "", "login_type": existing.LoginType}}, status=status.HTTP_200_OK)


@api_view(['POST'])
def register_facebook(request):
    facebook_id = request.data.get('facebook_id', '').strip()
    full_name   = request.data.get('full_name', '').strip()
    email       = request.data.get('email', '')
    avatar      = request.data.get('avatar', '')
    if not facebook_id or not full_name: return Response({"message": "Thiếu thông tin từ Facebook"}, status=status.HTTP_400_BAD_REQUEST)
    if email:
        existing = Customer.objects.filter(Email=email).first()
        if existing: return Response({"message": email_exists_message(existing.LoginType)}, status=status.HTTP_400_BAD_REQUEST)
    try:
        customer = create_customer(FullName=full_name, Email=email if email else f"fb_{facebook_id}@noemail.com", Password=None, FacebookID=facebook_id, Avatar=avatar, LoginType='facebook')
    except ValueError as e:
        return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    _write_customer_log(request, customer, "register", f"Facebook: {email}")
    return Response({"message": "Đăng ký Facebook thành công", "token": get_tokens_for_customer(customer), "customer": customer_data(customer)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def login_facebook(request):
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()
    if not full_name or not email: return Response({"message": "Thiếu thông tin Facebook"}, status=status.HTTP_400_BAD_REQUEST)
    existing = Customer.objects.filter(Email=email).first()
    if not existing:                      return Response({"message": "Tài khoản Facebook chưa được đăng ký"}, status=status.HTTP_404_NOT_FOUND)
    if existing.LoginType != 'facebook':  return Response({"message": email_exists_message(existing.LoginType)}, status=status.HTTP_400_BAD_REQUEST)
    _write_customer_log(request, existing, "login_facebook", f"Email: {existing.Email}")
    return Response({"message": "Đăng nhập Facebook thành công", "token": get_tokens_for_customer(existing), "customer": {"id": existing.CustomerID, "full_name": existing.FullName, "email": existing.Email, "avatar": existing.Avatar or "", "login_type": existing.LoginType}}, status=status.HTTP_200_OK)


@api_view(['POST'])
def forgot_password(request):
    email = request.data.get('email', '').strip()
    if not email: return Response({"message": "Vui lòng nhập email"}, status=status.HTTP_400_BAD_REQUEST)
    existing = Customer.objects.filter(Email=email).first()
    if not existing:                      return Response({"message": "Email chưa được đăng ký"}, status=status.HTTP_404_NOT_FOUND)
    if existing.LoginType == 'google':    return Response({"message": "Email này đã đăng ký bằng Google, vui lòng đăng nhập bằng Google"}, status=status.HTTP_400_BAD_REQUEST)
    if existing.LoginType == 'facebook':  return Response({"message": "Email này đã đăng ký bằng Facebook, vui lòng đăng nhập bằng Facebook"}, status=status.HTTP_400_BAD_REQUEST)
    # [FIX #2] Dùng Django cache thay vì in-memory dict (thread-safe, hỗ trợ Redis)
    from django.core.cache import cache
    otp_code = str(random.randint(100000, 999999))
    cache.set(f"otp_value:{email}",    otp_code, timeout=OTP_EXPIRY_SECONDS)
    cache.set(f"otp_attempts:{email}", 0,        timeout=OTP_EXPIRY_SECONDS)
    try:
        send_mail(subject="Mã OTP đặt lại mật khẩu - Sellphone", message=f"Mã OTP của bạn là: {otp_code}\nMã có hiệu lực trong 5 phút.", from_email=settings.EMAIL_HOST_USER, recipient_list=[email], fail_silently=False)
    except Exception as e:
        return Response({"message": f"Không thể gửi email: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response({"message": "OTP đã được gửi đến email của bạn"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def verify_otp(request):
    email    = request.data.get('email', '').strip()
    otp_code = request.data.get('otp', '').strip()
    if not email or not otp_code: return Response({"message": "Thiếu email hoặc OTP"}, status=status.HTTP_400_BAD_REQUEST)
    # [FIX #2] Brute-force protection qua cache
    from django.core.cache import cache
    cache_key_attempts = f"otp_attempts:{email}"
    cache_key_otp      = f"otp_value:{email}"
    attempts = cache.get(cache_key_attempts, 0)
    if attempts >= MAX_OTP_ATTEMPTS:
        return Response({"message": "Quá nhiều lần thử sai. Vui lòng yêu cầu mã OTP mới."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    stored_otp = cache.get(cache_key_otp)
    if not stored_otp:
        return Response({"message": "OTP đã hết hạn, vui lòng gửi lại"}, status=status.HTTP_400_BAD_REQUEST)
    if otp_code != stored_otp:
        cache.set(cache_key_attempts, attempts + 1, timeout=OTP_EXPIRY_SECONDS)
        remaining = MAX_OTP_ATTEMPTS - attempts - 1
        msg = f"Mã OTP không đúng (còn {remaining} lần thử)" if remaining > 0 else "Mã OTP không đúng. Đã hết lượt thử."
        return Response({"message": msg}, status=status.HTTP_400_BAD_REQUEST)
    # Đúng → xóa cache
    cache.delete(cache_key_otp)
    cache.delete(cache_key_attempts)
    return Response({"message": "OTP hợp lệ"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def reset_password(request):
    email        = request.data.get('email', '').strip()
    new_password = request.data.get('new_password', '').strip()
    if not email or not new_password: return Response({"message": "Thiếu email hoặc mật khẩu"}, status=status.HTTP_400_BAD_REQUEST)
    if ' ' in new_password:   return Response({"message": "Mật khẩu không được chứa dấu cách"}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 6: return Response({"message": "Mật khẩu phải có ít nhất 6 ký tự"}, status=status.HTTP_400_BAD_REQUEST)
    customer = Customer.objects.filter(Email=email, LoginType='normal').first()
    if not customer: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    customer.Password = hash_password(new_password)
    customer.save()
    # [FIX #2] Cache đã tự xóa trong verify_otp; đây chỉ là cleanup phòng thủ
    from django.core.cache import cache
    cache.delete(f"otp_value:{email}")
    cache.delete(f"otp_attempts:{email}")
    _write_customer_log(request, email, "reset_password", f"Email: {email}")
    return Response({"message": "Đặt lại mật khẩu thành công"}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════
# CUSTOMER PROFILE
# ══════════════════════════════════════════════════════════════

@api_view(['GET'])
def get_customer(request, customer_id):
    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    return Response({"id": customer.CustomerID, "full_name": customer.FullName, "email": customer.Email, "phone_number": customer.PhoneNumber or "", "address": customer.Address or "", "avatar": customer.Avatar or "", "login_type": customer.LoginType}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def update_customer(request):
    customer_id = request.data.get('id', '').strip()
    phone       = request.data.get('phone_number', None)
    address     = request.data.get('address', None)
    avatar      = request.data.get('avatar', None)
    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    if phone   is not None: customer.PhoneNumber = phone.strip()
    if address is not None: customer.Address     = address.strip()
    if avatar  is not None:
        try:
            upload_result = _upload_to_cloudinary(avatar, enhance="avatar", folder="sellphone/avatars", public_id=f"avatar_{customer_id}", overwrite=True, resource_type="image")
            customer.Avatar = upload_result["secure_url"]
        except Exception as e:
            return Response({"message": f"Lỗi upload ảnh: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    customer.save()
    _write_customer_log(request, customer_id, "update_profile", f"CustomerID: {customer_id}")
    return Response({"message": "Cập nhật thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def change_password(request):
    customer_id      = request.data.get('id', '').strip()
    current_password = request.data.get('current_password', '').strip()
    new_password     = request.data.get('new_password', '').strip()
    if not customer_id or not current_password or not new_password: return Response({"message": "Vui lòng điền đầy đủ thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if ' ' in new_password:   return Response({"message": "Mật khẩu không được chứa dấu cách"}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 6: return Response({"message": "Mật khẩu phải có ít nhất 6 ký tự"}, status=status.HTTP_400_BAD_REQUEST)
    customer = Customer.objects.filter(CustomerID=customer_id, LoginType='normal').first()
    if not customer: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    if not check_password(current_password, customer.Password): return Response({"message": "Mật khẩu hiện tại không đúng"}, status=status.HTTP_401_UNAUTHORIZED)
    customer.Password = hash_password(new_password)
    customer.save()
    _write_customer_log(request, customer, "change_password", "")
    return Response({"message": "Đổi mật khẩu thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def upload_avatar(request):
    customer_id = request.data.get('id', '').strip()
    avatar_file = request.FILES.get('avatar_file')
    if not customer_id or not avatar_file: return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    # [FIX #9] Server-side file validation
    MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
    ALLOWED_IMAGE_MIMES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
    if avatar_file.size > MAX_IMAGE_SIZE:
        return Response({"message": "Ảnh không được vượt quá 5MB"}, status=status.HTTP_400_BAD_REQUEST)
    content_type = avatar_file.content_type or ''
    if content_type not in ALLOWED_IMAGE_MIMES:
        return Response({"message": f"Loại file không được phép: {content_type}. Chỉ chấp nhận jpg, png, webp, gif"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        upload_result = _upload_to_cloudinary(avatar_file, enhance="avatar", folder="sellphone/avatars", public_id=f"avatar_{customer_id}", overwrite=True, resource_type="image")
        customer.Avatar = upload_result["secure_url"]
        customer.save()
        _write_customer_log(request, customer_id, "upload_avatar", "")
        return Response({"message": "Upload avatar thành công", "avatar_url": upload_result["secure_url"]}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"message": f"Lỗi upload: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ══════════════════════════════════════════════════════════════
# CUSTOMER ADDRESS
# ══════════════════════════════════════════════════════════════

@api_view(['GET'])
def get_customer_addresses(request, customer_id):
    from .models import CustomerAddress
    addrs = CustomerAddress.objects.filter(CustomerID=customer_id)
    return Response({"addresses": [{"id": a.AddressID, "name": a.Name, "phone": a.Phone, "address": a.Address} for a in addrs]}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def create_customer_address(request):
    from .models import CustomerAddress
    customer_id = request.data.get('customer_id')
    name        = request.data.get('name', '').strip()
    phone       = request.data.get('phone', '').strip()
    address     = request.data.get('address', '').strip()
    if not all([customer_id, name, phone, address]):
        return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    a = CustomerAddress.objects.create(CustomerID=customer, Name=name, Phone=phone, Address=address)
    _write_customer_log(request, customer_id, "create_address", f"Address: {address}")
    return Response({"message": "Đã lưu địa chỉ", "id": a.AddressID}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def update_customer_address(request):
    from .models import CustomerAddress
    addr_id = request.data.get('id')
    a = CustomerAddress.objects.filter(AddressID=addr_id).first()
    if not a: return Response({"message": "Không tìm thấy địa chỉ"}, status=status.HTTP_404_NOT_FOUND)
    a.Name    = request.data.get('name',    a.Name).strip()
    a.Phone   = request.data.get('phone',   a.Phone).strip()
    a.Address = request.data.get('address', a.Address).strip()
    a.save()
    _write_customer_log(request, request.data.get("customer_id"), "update_address", f"AddressID: {addr_id}")
    return Response({"message": "Đã cập nhật địa chỉ"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def delete_customer_address(request):
    from .models import CustomerAddress
    addr_id = request.data.get('id')
    a = CustomerAddress.objects.filter(AddressID=addr_id).first()
    if not a: return Response({"message": "Không tìm thấy địa chỉ"}, status=status.HTTP_404_NOT_FOUND)
    a.delete()
    _write_customer_log(request, request.data.get("customer_id"), "delete_address", f"AddressID: {addr_id}")
    return Response({"message": "Đã xóa địa chỉ"}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════
# STAFF / ADMIN
# ══════════════════════════════════════════════════════════════

@api_view(['POST'])
def admin_login(request):
    from django.core.cache import cache as _cache
    MAX_LOGIN_ATTEMPTS = 5
    LOCKOUT_SECONDS    = 300  # 5 phút

    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()
    if not username: return Response({"message": "Vui lòng nhập tên tài khoản", "field": "username"}, status=status.HTTP_400_BAD_REQUEST)
    if not password: return Response({"message": "Vui lòng nhập mật khẩu", "field": "password"}, status=status.HTTP_400_BAD_REQUEST)

    # Brute-force protection: lock 5 phút sau 5 lần sai
    lock_key     = f"admin_login_lock:{username}"
    attempts_key = f"admin_login_attempts:{username}"
    if _cache.get(lock_key):
        return Response({"message": "Tài khoản tạm thời bị khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút.", "field": "general"}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    staff = Staff.objects.filter(Email=username).first()
    if not staff:
        return Response({"message": "Tài khoản không tồn tại", "field": "username"}, status=status.HTTP_404_NOT_FOUND)

    if not check_password(password, staff.Password):
        attempts = _cache.get(attempts_key, 0) + 1
        _cache.set(attempts_key, attempts, timeout=LOCKOUT_SECONDS)
        remaining = MAX_LOGIN_ATTEMPTS - attempts
        if attempts >= MAX_LOGIN_ATTEMPTS:
            _cache.set(lock_key, True, timeout=LOCKOUT_SECONDS)
            _cache.delete(attempts_key)
            return Response({"message": "Tài khoản bị khóa 5 phút do đăng nhập sai quá nhiều lần.", "field": "general"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        return Response({"message": f"Mật khẩu không đúng (còn {remaining} lần thử)", "field": "password"}, status=status.HTTP_401_UNAUTHORIZED)

    if staff.Role == 'Unentitled':
        return Response({"message": "Bạn không có quyền truy cập", "field": "general"}, status=status.HTTP_403_FORBIDDEN)

    # Đăng nhập thành công — reset bộ đếm
    _cache.delete(attempts_key)
    _cache.delete(lock_key)
    _write_log(request, staff, 'login', f'Đăng nhập thành công — {staff.Email} ({staff.Role})')
    return Response({"message": "Đăng nhập thành công", "token": get_tokens_for_staff(staff), "admin": {"id": staff.StaffID, "full_name": staff.FullName, "username": staff.Email, "role": staff.Role, "avatar": ""}}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def get_staff(request, staff_id):
    staff = Staff.objects.filter(StaffID=staff_id).first()
    if not staff: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    return Response({"id": staff.StaffID, "full_name": staff.FullName, "email": staff.Email, "role": staff.Role, "avatar": staff.Avatar or "" if hasattr(staff, 'Avatar') else ""}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def list_staff(request):
    data = [{"id": s.StaffID, "full_name": s.FullName, "email": s.Email, "role": s.Role, "avatar": s.Avatar or "" if hasattr(s, 'Avatar') else ""} for s in Staff.objects.all().order_by('StaffID')]
    return Response({"staff": data}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOnly])
def create_staff(request):
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()
    password  = request.data.get('password', '').strip()
    role      = request.data.get('role', 'Staff').strip()
    if not full_name or not email or not password: return Response({"message": "Vui lòng điền đầy đủ thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 6:                          return Response({"message": "Mật khẩu phải có ít nhất 6 ký tự"}, status=status.HTTP_400_BAD_REQUEST)
    if role not in ['Admin', 'Staff', 'Unentitled']: return Response({"message": "Vai trò không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    if Staff.objects.filter(Email=email).exists(): return Response({"message": "Email đã tồn tại"}, status=status.HTTP_400_BAD_REQUEST)
    staff = Staff.objects.create(FullName=full_name, Email=email, Password=make_password(password), Role=role)
    _write_log(request, None, 'create_staff', f'Tạo nhân viên: {full_name} ({email}) – {role}')
    return Response({"message": "Tạo tài khoản thành công", "staff": {"id": staff.StaffID, "full_name": staff.FullName, "email": staff.Email, "role": staff.Role}}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAdminOnly])
def update_staff_role(request):
    staff_id = request.data.get('id')
    role     = request.data.get('role', '').strip()
    if not staff_id or not role:                     return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if role not in ['Admin', 'Staff', 'Unentitled']: return Response({"message": "Vai trò không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    staff = Staff.objects.filter(StaffID=staff_id).first()
    if not staff: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    # [FIX] Bảo vệ Admin đầu tiên (StaffID nhỏ nhất) — không thể đổi quyền
    first_admin = Staff.objects.order_by("StaffID").first()
    if first_admin and staff.StaffID == first_admin.StaffID:
        return Response({"message": "Không thể thay đổi quyền của tài khoản Admin gốc"}, status=status.HTTP_403_FORBIDDEN)
    staff.Role = role; staff.save()
    _write_log(request, None, 'update_staff_role', f'Đổi quyền nhân viên ID={staff_id} → {role}')
    return Response({"message": "Cập nhật quyền thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOnly])
def delete_staff(request):
    staff_id = request.data.get('id')
    if not staff_id: return Response({"message": "Thiếu staff_id"}, status=status.HTTP_400_BAD_REQUEST)
    # [FIX] Bảo vệ Admin đầu tiên — không thể xóa
    first_admin = Staff.objects.order_by("StaffID").first()
    if first_admin and str(staff_id) == str(first_admin.StaffID):
        return Response({"message": "Không thể xóa tài khoản Admin gốc"}, status=status.HTTP_403_FORBIDDEN)
    Staff.objects.filter(StaffID=staff_id).delete()
    _write_log(request, None, 'delete_staff', f'Xóa nhân viên ID={staff_id}')
    return Response({"message": "Đã xóa tài khoản"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def change_staff_password(request):
    staff_id         = request.data.get('id')
    current_password = request.data.get('current_password', '').strip()
    new_password     = request.data.get('new_password', '').strip()
    if not staff_id or not current_password or not new_password: return Response({"message": "Vui lòng điền đầy đủ thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if ' ' in new_password:   return Response({"message": "Mật khẩu không được chứa dấu cách"}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 6: return Response({"message": "Mật khẩu phải có ít nhất 6 ký tự"}, status=status.HTTP_400_BAD_REQUEST)
    staff = Staff.objects.filter(StaffID=staff_id).first()
    if not staff: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    if not check_password(current_password, staff.Password): return Response({"message": "Mật khẩu hiện tại không đúng"}, status=status.HTTP_401_UNAUTHORIZED)
    staff.Password = make_password(new_password); staff.save()
    return Response({"message": "Đổi mật khẩu thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def upload_staff_avatar(request):
    staff_id    = request.data.get('id')
    avatar_file = request.FILES.get('avatar_file')
    if not staff_id or not avatar_file: return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    staff = Staff.objects.filter(StaffID=staff_id).first()
    if not staff: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    try:
        upload_result = _upload_to_cloudinary(avatar_file, enhance="avatar", folder="sellphone/staff_avatars", public_id=f"staff_avatar_{staff_id}", overwrite=True, resource_type="image")
        staff.Avatar = upload_result["secure_url"]; staff.save()
        return Response({"message": "Upload thành công", "avatar_url": upload_result["secure_url"]}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"message": f"Lỗi upload: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ══════════════════════════════════════════════════════════════
# CATEGORY
# ══════════════════════════════════════════════════════════════

@api_view(['GET'])
def list_categories(request):
    cats = Category.objects.all().order_by('CategoryID')
    return Response({"categories": [{"id": c.CategoryID, "name": c.CategoryName, "image": c.Image or "" if hasattr(c, 'Image') else "", "is_active": getattr(c, "IsActive", True)} for c in cats]}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def create_category(request):
    name       = request.data.get('name', '').strip()
    image_file = request.FILES.get('image')
    if not name: return Response({"message": "Vui lòng nhập tên danh mục"}, status=status.HTTP_400_BAD_REQUEST)
    if Category.objects.filter(CategoryName=name).exists(): return Response({"message": "Danh mục đã tồn tại"}, status=status.HTTP_400_BAD_REQUEST)
    image_url = ""
    if image_file:
        try:
            result    = _upload_to_cloudinary(image_file, enhance="category", folder="sellphone/categories", public_id=f"category_{name.lower().replace(' ', '_')}", overwrite=True, resource_type="image")
            image_url = result["secure_url"]
        except Exception as e:
            return Response({"message": f"Lỗi upload ảnh: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    cat = Category.objects.create(CategoryName=name, Image=image_url)
    _write_log(request, None, 'create_category', f'Tạo danh mục: {name}')
    return Response({"message": "Tạo danh mục thành công", "id": cat.CategoryID, "name": cat.CategoryName, "image": image_url}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def update_category(request):
    cat_id     = request.data.get('id')
    name       = request.data.get('name', '').strip()
    image_file = request.FILES.get('image')
    if not cat_id or not name: return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    cat = Category.objects.filter(CategoryID=cat_id).first()
    if not cat: return Response({"message": "Không tìm thấy danh mục"}, status=status.HTTP_404_NOT_FOUND)
    cat.CategoryName = name
    if image_file:
        try:
            result    = _upload_to_cloudinary(image_file, enhance="category", folder="sellphone/categories", public_id=f"category_{cat_id}", overwrite=True, resource_type="image")
            cat.Image = result["secure_url"]
        except Exception as e:
            return Response({"message": f"Lỗi upload ảnh: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    cat.save()
    _write_log(request, None, 'update_category', f'Sửa danh mục ID={cat_id} → {name}')
    return Response({"message": "Cập nhật danh mục thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOnly])
def delete_category(request):
    cat_id = request.data.get('id')
    if not cat_id: return Response({"message": "Thiếu category_id"}, status=status.HTTP_400_BAD_REQUEST)
    if Product.objects.filter(CategoryID=cat_id).exists(): return Response({"message": "Không thể xóa danh mục đang có sản phẩm"}, status=status.HTTP_400_BAD_REQUEST)
    Category.objects.filter(CategoryID=cat_id).delete()
    return Response({"message": "Đã xóa danh mục"}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════
# PRODUCT
# ══════════════════════════════════════════════════════════════

def _validate_variants(variants):
    errors = []
    for idx, v in enumerate(variants):
        ve = {}; label = f"Biến thể #{idx + 1}"
        price_raw = v.get('price', '')
        try:
            price = float(price_raw)
            if price <= 0: ve['price'] = f"{label}: Giá phải lớn hơn 0"
        except (ValueError, TypeError):
            ve['price'] = f"{label}: Giá không hợp lệ"
        stock_raw = v.get('stock', '')
        try:
            stock = int(stock_raw)
            if stock <= 0:      ve['stock'] = f"{label}: Số lượng phải lớn hơn 0"
            elif stock > 10000: ve['stock'] = f"{label}: Số lượng tối đa 10.000"
        except (ValueError, TypeError):
            ve['stock'] = f"{label}: Số lượng không hợp lệ"
        ram = (v.get('ram') or '').strip()
        if not ram:
            ve['ram'] = f"{label}: Vui lòng nhập RAM"
        else:
            m = _re.match(r'^(\d+(?:\.\d+)?)\s*GB$', ram, _re.IGNORECASE)
            if not m:                   ve['ram'] = f"{label}: RAM phải có dạng số + GB (VD: 8GB)"
            elif float(m.group(1)) < 4: ve['ram'] = f"{label}: RAM tối thiểu là 4GB"
        storage = (v.get('storage') or '').strip()
        if storage:
            m = _re.match(r'^(\d+(?:\.\d+)?)\s*(GB|TB)$', storage, _re.IGNORECASE)
            if not m:
                ve['storage'] = f"{label}: Bộ nhớ phải có dạng số + GB/TB (VD: 128GB, 1TB)"
            else:
                num = float(m.group(1)); unit = m.group(2).upper()
                if unit == 'GB' and num < 64:  ve['storage'] = f"{label}: Bộ nhớ GB phải từ 64GB trở lên"
                elif unit == 'TB' and num < 1: ve['storage'] = f"{label}: Bộ nhớ TB phải từ 1TB trở lên"
        errors.append(ve)
    return errors


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def create_product(request):
    product_name = request.data.get('product_name', '').strip()
    brand        = request.data.get('brand', '').strip()
    description  = request.data.get('description', '').strip()
    category_id  = request.data.get('category_id')
    variants_raw = request.data.get('variants', '[]')
    images       = request.FILES.getlist('images')
    if not product_name: return Response({"message": "Vui lòng nhập tên sản phẩm"}, status=status.HTTP_400_BAD_REQUEST)
    if not category_id:  return Response({"message": "Vui lòng chọn danh mục"}, status=status.HTTP_400_BAD_REQUEST)
    if Product.objects.filter(ProductName__iexact=product_name).exists(): return Response({"message": f"Sản phẩm '{product_name}' đã tồn tại"}, status=status.HTTP_400_BAD_REQUEST)
    category = Category.objects.filter(CategoryID=category_id).first()
    if not category: return Response({"message": "Danh mục không tồn tại"}, status=status.HTTP_400_BAD_REQUEST)
    try:    variants = json.loads(variants_raw)
    except (ValueError, TypeError, json.JSONDecodeError): return Response({"message": "Dữ liệu biến thể không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    if not variants: return Response({"message": "Cần ít nhất 1 biến thể"}, status=status.HTTP_400_BAD_REQUEST)
    variant_errors = _validate_variants(variants)
    all_errors = [e for e in variant_errors if e]
    if all_errors:
        messages = []
        for ve in all_errors: messages.extend(ve.values())
        return Response({"message": " | ".join(messages), "variant_errors": variant_errors}, status=status.HTTP_400_BAD_REQUEST)
    seen_combos = set()
    for v in variants:
        combo = (str(v.get("color","")).strip().lower(), str(v.get("storage","")).strip().lower())
        color_val=v.get('color',''); storage_val=v.get('storage','')
        if combo in seen_combos:
            return Response({"message": f"Biến thể trùng lặp: màu '{color_val}' bộ nhớ '{storage_val}'"}, status=status.HTTP_400_BAD_REQUEST)
        seen_combos.add(combo)
    product = Product.objects.create(ProductName=product_name, Brand=brand or None, Description=description or None, CategoryID=category)
    for idx, v in enumerate(variants):
        variant_obj = ProductVariant.objects.create(ProductID=product, Color=v.get('color') or None, Storage=v.get('storage') or None, Ram=v.get('ram') or None, Price=float(v.get('price', 0)), StockQuantity=int(v.get('stock', 0)), Cpu=v.get('cpu') or None, OperatingSystem=v.get('os') or None, ScreenSize=v.get('screenSize') or None, ScreenTechnology=v.get('screenTech') or None, RefreshRate=v.get('refreshRate') or None, Battery=v.get('battery') or None, ChargingSpeed=v.get('chargingSpeed') or None, FrontCamera=v.get('frontCamera') or None, RearCamera=v.get('rearCamera') or None, Weights=v.get('weights') or None, Updates=v.get('updates') or None)
        variant_img = request.FILES.get(f'variant_image_{idx}')
        if variant_img:
            try:
                result = _upload_to_cloudinary(variant_img, enhance="product", folder=f"sellphone/variants/{product.ProductID}", public_id=f"variant_{variant_obj.VariantID}", overwrite=True, resource_type="image")
                variant_obj.Image = result["secure_url"]; variant_obj.save()
            except: pass
    for idx, img_file in enumerate(images):
        try:
            result = _upload_to_cloudinary(img_file, enhance="product", folder=f"sellphone/products/{product.ProductID}", public_id=f"product_{product.ProductID}_img_{idx}", overwrite=True, resource_type="image")
            ProductImage.objects.create(ProductID=product, ImageUrl=result["secure_url"], IsPrimary=(idx == 0))
        except: pass
    on_product_saved(product.ProductID)
    _write_log(request, None, 'create_product', f'Tạo sản phẩm: {product_name} (ID={product.ProductID})')
    return Response({"message": "Tạo sản phẩm thành công", "product_id": product.ProductID}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def list_products(request):
    # [FIX] Admin/Staff nhận tất cả, customer chỉ nhận active
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    is_staff_request = bool(auth.startswith("Bearer "))
    try:
        if is_staff_request:
            import jwt as _jwt
            from django.conf import settings as _s
            payload = _jwt.decode(auth.split(" ", 1)[1], _s.SECRET_KEY, algorithms=["HS256"])
            is_staff_request = payload.get("type") == "staff"
    except Exception:
        is_staff_request = False

    products = Product.objects.select_related('CategoryID').all().order_by('-CreatedAt')
    if not is_staff_request:
        products = products.filter(IsActive=True, CategoryID__IsActive=True)
    data = []
    for p in products:
        variants = ProductVariant.objects.filter(ProductID=p) if is_staff_request else ProductVariant.objects.filter(ProductID=p, IsActive=True)
        active_variants = variants
        min_v       = active_variants.order_by('Price').first()
        primary_img = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first() or ProductImage.objects.filter(ProductID=p).first()
        rams        = list(set(v.Ram     for v in active_variants if v.Ram))
        storages    = list(set(v.Storage for v in active_variants if v.Storage))
        data.append({
            "id": p.ProductID, "name": p.ProductName, "brand": p.Brand or "",
            "description": p.Description or "", "category": p.CategoryID.CategoryName,
            "category_id": p.CategoryID.CategoryID, "is_active": getattr(p, "IsActive", True),
            "category_is_active": getattr(p.CategoryID, "IsActive", True),
            "variant_count": active_variants.count(),
            "min_price": str(min_v.Price) if min_v else "0",
            "image": primary_img.ImageUrl if primary_img else "",
            "rams": rams, "storages": storages,
            "variants": [{"id": v.VariantID, "color": v.Color or "", "storage": v.Storage or "",
                          "ram": v.Ram or "", "price": float(v.Price), "stock": v.StockQuantity,
                          "image": v.Image or "", "is_active": getattr(v, "IsActive", True)} for v in variants]
        })
    return Response({"products": data}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_product_detail(request, product_id):
    product = Product.objects.select_related('CategoryID').filter(ProductID=product_id).first()
    if not product: return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    # Check active for customer (no auth)
    auth_hdr = request.META.get("HTTP_AUTHORIZATION", "")
    _is_staff = False
    try:
        if auth_hdr.startswith("Bearer "):
            import jwt as _jwt2
            from django.conf import settings as _s2
            _pl = _jwt2.decode(auth_hdr.split(" ", 1)[1], _s2.SECRET_KEY, algorithms=["HS256"])
            _is_staff = _pl.get("type") == "staff"
    except Exception:
        pass
    if not _is_staff and (not getattr(product, "IsActive", True) or not getattr(product.CategoryID, "IsActive", True)):
        return Response({"message": "Sản phẩm không tồn tại"}, status=status.HTTP_404_NOT_FOUND)
    variants         = ProductVariant.objects.filter(ProductID=product) if _is_staff else ProductVariant.objects.filter(ProductID=product, IsActive=True)
    images           = ProductImage.objects.filter(ProductID=product)
    related_products = Product.objects.filter(CategoryID=product.CategoryID, IsActive=True, CategoryID__IsActive=True).exclude(ProductID=product_id).order_by('-CreatedAt')[:5]

    def variant_data(v):
        return {"id": v.VariantID, "image": v.Image or "" if hasattr(v, "Image") else "", "color": v.Color or "", "storage": v.Storage or "", "ram": v.Ram or "", "price": str(v.Price), "stock": v.StockQuantity, "is_active": getattr(v, "IsActive", True), "cpu": v.Cpu or "", "os": v.OperatingSystem or "", "screen_size": v.ScreenSize or "", "screen_tech": v.ScreenTechnology or "", "refresh_rate": v.RefreshRate or "", "battery": v.Battery or "", "charging_speed": v.ChargingSpeed or "", "front_camera": v.FrontCamera or "", "rear_camera": v.RearCamera or "", "weights": v.Weights or "", "updates": v.Updates or ""}

    def related_data(p):
        primary_img = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first() or ProductImage.objects.filter(ProductID=p).first()
        min_v       = ProductVariant.objects.filter(ProductID=p).order_by('Price').first()
        return {"id": p.ProductID, "name": p.ProductName, "brand": p.Brand or "", "image": primary_img.ImageUrl if primary_img else "", "min_price": str(min_v.Price) if min_v else "0"}

    images_sorted = list(images.filter(IsPrimary=True)) + list(images.filter(IsPrimary=False))
    return Response({"product": {"id": product.ProductID, "name": product.ProductName, "brand": product.Brand or "", "description": product.Description or "", "category": product.CategoryID.CategoryName, "category_id": product.CategoryID.CategoryID}, "variants": [variant_data(v) for v in variants], "images": [{"image_id": img.ImageID, "url": img.ImageUrl, "is_primary": img.IsPrimary} for img in images_sorted], "related": [related_data(p) for p in related_products]}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_product_variants(request, product_id):
    product = Product.objects.filter(ProductID=product_id).first()
    if not product: return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    variants = ProductVariant.objects.filter(ProductID=product)
    return Response({"variants": [{"id": v.VariantID, "color": v.Color or "", "storage": v.Storage or "", "ram": v.Ram or "", "price": str(v.Price), "stock": v.StockQuantity} for v in variants]}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def add_variants(request):
    product_id    = request.data.get('product_id') or request.POST.get('product_id')
    variants_json = request.POST.get('variants')
    if not product_id: return Response({"message": "Thiếu product_id"}, status=status.HTTP_400_BAD_REQUEST)
    product = Product.objects.filter(ProductID=product_id).first()
    if not product: return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    try:    variants = json.loads(variants_json) if variants_json else []
    except (ValueError, TypeError, json.JSONDecodeError): return Response({"message": "Dữ liệu biến thể không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    if not variants: return Response({"message": "Vui lòng thêm ít nhất 1 biến thể"}, status=status.HTTP_400_BAD_REQUEST)
    variant_errors = _validate_variants(variants)
    all_errors = [e for e in variant_errors if e]
    if all_errors:
        messages = []
        for ve in all_errors: messages.extend(ve.values())
        return Response({"message": " | ".join(messages), "variant_errors": variant_errors}, status=status.HTTP_400_BAD_REQUEST)
    existing_combos = set(
        (str(ev.Color or "").strip().lower(), str(ev.Storage or "").strip().lower())
        for ev in ProductVariant.objects.filter(ProductID=product)
    )
    seen_combos = set()
    for v in variants:
        combo = (str(v.get("color","")).strip().lower(), str(v.get("storage","")).strip().lower())
        color_val=v.get('color',''); storage_val=v.get('storage','')
        if combo in existing_combos:
            return Response({"message": f"Biến thể màu '{color_val}' bộ nhớ '{storage_val}' đã tồn tại trong sản phẩm này"}, status=status.HTTP_400_BAD_REQUEST)
        if combo in seen_combos:
            return Response({"message": f"Biến thể trùng lặp trong danh sách: màu '{color_val}' bộ nhớ '{storage_val}'"}, status=status.HTTP_400_BAD_REQUEST)
        seen_combos.add(combo)
    created = []
    for idx, v in enumerate(variants):
        variant_obj = ProductVariant.objects.create(ProductID=product, Color=v.get('color') or None, Storage=v.get('storage') or None, Ram=v.get('ram') or None, Price=float(v.get('price', 0)), StockQuantity=int(v.get('stock', 0)), Cpu=v.get('cpu') or None, OperatingSystem=v.get('os') or None, ScreenSize=v.get('screenSize') or None, ScreenTechnology=v.get('screenTech') or None, RefreshRate=v.get('refreshRate') or None, Battery=v.get('battery') or None, ChargingSpeed=v.get('chargingSpeed') or None, FrontCamera=v.get('frontCamera') or None, RearCamera=v.get('rearCamera') or None, Weights=v.get('weights') or None, Updates=v.get('updates') or None)
        variant_img = request.FILES.get(f'variant_image_{idx}')
        if variant_img:
            try:
                result = _upload_to_cloudinary(variant_img, enhance="product", folder=f"sellphone/variants/{product.ProductID}", public_id=f"variant_{variant_obj.VariantID}", overwrite=True, resource_type="image")
                variant_obj.Image = result["secure_url"]; variant_obj.save()
            except: pass
        created.append(variant_obj.VariantID)
    on_product_saved(product.ProductID)
    return Response({"message": f"Đã thêm {len(created)} biến thể thành công", "variant_ids": created}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@parser_classes([MultiPartParser])
@permission_classes([IsAdminOrStaff])
def update_product(request):
    product_id   = request.data.get('product_id') or request.POST.get('product_id')
    product_name = (request.data.get('product_name') or '').strip()
    brand        = (request.data.get('brand') or '').strip()
    description  = (request.data.get('description') or '').strip()
    category_id  = request.data.get('category_id')
    images       = request.FILES.getlist('images')
    if not product_id: return Response({"message": "Thiếu product_id"}, status=status.HTTP_400_BAD_REQUEST)
    product = Product.objects.filter(ProductID=product_id).first()
    if not product: return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    if product_name: product.ProductName = product_name
    if brand:        product.Brand       = brand
    if description:  product.Description = description
    if category_id:
        cat = Category.objects.filter(CategoryID=category_id).first()
        if not cat: return Response({"message": "Danh mục không tồn tại"}, status=status.HTTP_400_BAD_REQUEST)
        product.CategoryID = cat
    product.save()
    for idx, img_file in enumerate(images):
        try:
            result = _upload_to_cloudinary(img_file, enhance="product", folder=f"sellphone/products/{product.ProductID}", resource_type="image")
            ProductImage.objects.create(ProductID=product, ImageUrl=result["secure_url"], IsPrimary=False)
        except Exception as e:
            logger.error(f"update_product image upload: {e}")
    on_product_saved(product.ProductID)
    _write_log(request, None, 'update_product', f'Sửa sản phẩm ID={product_id} → {product.ProductName}')
    return Response({"message": "Cập nhật sản phẩm thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOnly])
def delete_product(request):
    product_id = request.data.get('product_id')
    if not product_id: return Response({"message": "Thiếu product_id"}, status=status.HTTP_400_BAD_REQUEST)
    product = Product.objects.filter(ProductID=product_id).first()
    if not product: return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    # [FIX #6] Không xóa nếu còn đơn hàng active
    active_statuses = ['Pending', 'Processing', 'Shipping']
    has_active = OrderDetail.objects.filter(
        VariantID__ProductID=product_id,
        OrderID__Status__in=active_statuses
    ).exists()
    if has_active:
        return Response({"message": "Không thể xóa sản phẩm đang có trong đơn hàng chưa hoàn tất"}, status=status.HTTP_400_BAD_REQUEST)
    product.delete()
    _write_log(request, None, 'delete_product', f'Xóa sản phẩm ID={product_id}')
    return Response({"message": "Đã xóa sản phẩm"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def delete_product_image(request):
    image_id = request.data.get('image_id')
    if not image_id: return Response({"message": "Thiếu image_id"}, status=status.HTTP_400_BAD_REQUEST)
    img = ProductImage.objects.filter(ImageID=image_id).first()
    if not img: return Response({"message": "Không tìm thấy ảnh"}, status=status.HTTP_404_NOT_FOUND)
    product = img.ProductID
    was_primary = img.IsPrimary
    img.delete()
    # Nếu ảnh bị xóa là ảnh chính → promote ảnh còn lại làm primary
    if was_primary:
        next_img = ProductImage.objects.filter(ProductID=product).first()
        if next_img:
            next_img.IsPrimary = True
            next_img.save()
    return Response({"message": "Đã xóa ảnh"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def set_primary_image(request):
    image_id   = request.data.get('image_id')
    product_id = request.data.get('product_id')
    if not image_id or not product_id: return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    ProductImage.objects.filter(ProductID=product_id).update(IsPrimary=False)
    img = ProductImage.objects.filter(ImageID=image_id, ProductID=product_id).first()
    if not img: return Response({"message": "Không tìm thấy ảnh"}, status=status.HTTP_404_NOT_FOUND)
    img.IsPrimary = True; img.save()
    return Response({"message": "Đã đặt ảnh chính"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def import_stock(request):
    items = request.data.get('items', [])
    if not items: return Response({"message": "Không có dữ liệu nhập hàng"}, status=status.HTTP_400_BAD_REQUEST)
    updated = []
    for item in items:
        variant_id = item.get('variant_id'); quantity = int(item.get('quantity', 0))
        if quantity <= 0: continue
        variant = ProductVariant.objects.filter(VariantID=variant_id).first()
        if variant:
            variant.StockQuantity += quantity; variant.save()
            updated.append({"variant_id": variant_id, "new_stock": variant.StockQuantity})
    return Response({"message": f"Đã nhập hàng cho {len(updated)} biến thể", "updated": updated}, status=status.HTTP_200_OK)


@api_view(['POST'])
@parser_classes([MultiPartParser])
@permission_classes([IsAdminOrStaff])
def update_variant(request):
    variant_id = request.data.get('variant_id')
    if not variant_id: return Response({"message": "Thiếu variant_id"}, status=status.HTTP_400_BAD_REQUEST)
    variant = ProductVariant.objects.filter(VariantID=variant_id).first()
    if not variant: return Response({"message": "Không tìm thấy biến thể"}, status=status.HTTP_404_NOT_FOUND)
    fields = {'color': 'Color', 'storage': 'Storage', 'ram': 'Ram', 'cpu': 'Cpu', 'os': 'OperatingSystem', 'screenSize': 'ScreenSize', 'screenTech': 'ScreenTechnology', 'refreshRate': 'RefreshRate', 'battery': 'Battery', 'chargingSpeed': 'ChargingSpeed', 'frontCamera': 'FrontCamera', 'rearCamera': 'RearCamera', 'weights': 'Weights', 'updates': 'Updates'}
    for req_key, model_field in fields.items():
        val = request.data.get(req_key)
        if val is not None: setattr(variant, model_field, val.strip() or None)
    price = request.data.get('price')
    stock = request.data.get('stock')
    if price is not None:
        try:    variant.Price = float(price)
        except (ValueError, TypeError): return Response({"message": "Giá không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    if stock is not None:
        try:    variant.StockQuantity = int(stock)
        except (ValueError, TypeError): return Response({"message": "Số lượng không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    img_file = request.FILES.get('image')
    if img_file:
        try:
            result = _upload_to_cloudinary(img_file, enhance="product", folder=f"sellphone/variants/{variant.ProductID_id}", public_id=f"variant_{variant_id}", overwrite=True, resource_type="image")
            variant.Image = result["secure_url"]
        except Exception as e:
            return Response({"message": f"Lỗi upload ảnh: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    variant.save()
    on_product_saved(variant.ProductID_id)
    _write_log(request, None, 'update_variant', f'Sửa biến thể ID={request.data.get("variant_id")}')
    return Response({"message": "Cập nhật biến thể thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def delete_variant(request):
    variant_id = request.data.get('variant_id')
    if not variant_id: return Response({"message": "Thiếu variant_id"}, status=status.HTTP_400_BAD_REQUEST)
    variant = ProductVariant.objects.filter(VariantID=variant_id).first()
    if not variant: return Response({"message": "Không tìm thấy biến thể"}, status=status.HTTP_404_NOT_FOUND)
    product_id = variant.ProductID_id
    if ProductVariant.objects.filter(ProductID=product_id).count() <= 1:
        return Response({"message": "Không thể xóa biến thể duy nhất của sản phẩm"}, status=status.HTTP_400_BAD_REQUEST)
    # [FIX #6] Không xóa nếu biến thể đang có trong đơn hàng active
    active_statuses = ['Pending', 'Processing', 'Shipping']
    has_active = OrderDetail.objects.filter(
        VariantID=variant_id,
        OrderID__Status__in=active_statuses
    ).exists()
    if has_active:
        return Response({"message": "Không thể xóa biến thể đang có trong đơn hàng chưa hoàn tất"}, status=status.HTTP_400_BAD_REQUEST)
    variant.delete()
    on_product_saved(product_id)
    return Response({"message": "Đã xóa biến thể"}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════
# PRODUCT CONTENT
# ══════════════════════════════════════════════════════════════

@api_view(['GET'])
def get_product_content(request, product_id):
    pc = ProductContent.objects.filter(ProductID_id=product_id).first()
    if not pc: return Response({"content": None}, status=status.HTTP_200_OK)
    try: blocks = json.loads(pc.Blocks) if isinstance(pc.Blocks, str) else (pc.Blocks or [])
    except: blocks = []
    return Response({"content": {"blocks": blocks, "updated_at": pc.UpdatedAt.isoformat()}}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def save_product_content(request):
    product_id = request.data.get('product_id')
    blocks     = request.data.get('blocks', '[]')
    product = Product.objects.filter(ProductID=product_id).first()
    if not product: return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    if isinstance(blocks, str):
        try: blocks_parsed = json.loads(blocks)
        except: blocks_parsed = []
    else: blocks_parsed = blocks
    for key in request.FILES:
        if key.startswith('block_img_'):
            idx = key.replace('block_img_', '')
            try:
                result = _upload_to_cloudinary(request.FILES[key], enhance="post", folder=f"sellphone/product_content/{product_id}", resource_type="image")
                for b in blocks_parsed:
                    if b.get('_idx') == idx and b.get('type') == 'image': b['url'] = result['secure_url']; break
            except: pass
    ProductContent.objects.update_or_create(ProductID_id=product_id, defaults={"Blocks": json.dumps(blocks_parsed, ensure_ascii=False)})
    return Response({"message": "Lưu mô tả sản phẩm thành công"}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════
# VOUCHER
# ══════════════════════════════════════════════════════════════

def _fmt_voucher(v):
    return {
        "id":           v.VoucherID,
        "code":         v.Code,
        "type":         v.Type,
        "value":        float(v.Value),
        "scope":        v.Scope,
        "category_id":  v.CategoryID.CategoryID if v.CategoryID else None,
        "product_id":   v.ProductID.ProductID   if v.ProductID  else None,
        "variant_id":   v.VariantID.VariantID   if getattr(v, 'VariantID', None) else None,
        "min_order":    float(v.MinOrder or 0),
        "max_discount": float(v.MaxDiscount) if v.MaxDiscount else None,
    }


def _active_vouchers():
    from .models import Voucher
    today  = _date.today()
    result = []
    for v in Voucher.objects.filter(IsActive=True):
        if v.StartDate and v.StartDate > today: continue
        if v.EndDate   and v.EndDate   < today: continue
        if v.UsageLimit and v.UsedCount >= v.UsageLimit: continue
        result.append(v)
    return result


def _voucher_applies(v, item):
    scope = v.Scope
    if scope == 'all': return True
    if scope == 'category' and v.CategoryID:
        return str(item.get('category_id')) == str(v.CategoryID.CategoryID)
    if scope == 'product' and v.ProductID:
        if str(item.get('product_id')) != str(v.ProductID.ProductID): return False
        if getattr(v, 'VariantID', None):
            return str(item.get('variant_id')) == str(v.VariantID.VariantID)
        return True
    return False


def _calc_discount_for_items(v, item_list):
    eligible = [i for i in item_list if _voucher_applies(v, i)]
    base = sum(float(i.get('price', 0)) * int(i.get('qty', 1)) for i in eligible)
    if base < float(v.MinOrder or 0): return 0
    if v.Type == 'percent':
        disc = round(base * min(float(v.Value), 100) / 100)
    else:
        disc = min(float(v.Value), base)
    if v.MaxDiscount: disc = min(disc, float(v.MaxDiscount))
    return disc


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def list_vouchers(request):
    from .models import Voucher
    today    = _date.today()
    vouchers = Voucher.objects.all().order_by('-VoucherID')
    data = []
    for v in vouchers:
        is_active = v.IsActive
        if v.EndDate and v.EndDate < today:              is_active = False
        if v.UsageLimit and v.UsedCount >= v.UsageLimit: is_active = False
        d = _fmt_voucher(v)
        d.update({"start_date": str(v.StartDate) if v.StartDate else None, "end_date": str(v.EndDate) if v.EndDate else None, "usage_limit": v.UsageLimit, "used_count": v.UsedCount, "is_active": is_active, "description": v.Description if hasattr(v, 'Description') else ""})
        data.append(d)
    return Response({"vouchers": data}, status=status.HTTP_200_OK)


@api_view(['GET'])
def list_active_vouchers(request):
    data = []
    for v in _active_vouchers():
        d = _fmt_voucher(v)
        d["description"] = v.Description if hasattr(v, 'Description') else ""
        data.append(d)
    return Response({"vouchers": data}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def create_voucher(request):
    from .models import Voucher
    code  = request.data.get('code', '').strip().upper()
    vtype = request.data.get('type', 'percent')
    value = request.data.get('value')
    scope = request.data.get('scope', 'all')
    if not code:    return Response({"message": "Vui lòng nhập mã voucher"}, status=status.HTTP_400_BAD_REQUEST)
    if Voucher.objects.filter(Code=code).exists(): return Response({"message": "Mã voucher đã tồn tại"}, status=status.HTTP_400_BAD_REQUEST)
    if not value or float(value) <= 0: return Response({"message": "Giá trị voucher không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    if vtype == 'percent' and float(value) > 100: return Response({"message": "Phần trăm giảm không được vượt quá 100%"}, status=status.HTTP_400_BAD_REQUEST)
    cat_id     = request.data.get('category_id')
    prod_id    = request.data.get('product_id')
    variant_id = request.data.get('variant_id')
    cat_obj     = Category.objects.filter(CategoryID=cat_id).first()          if cat_id     else None
    prod_obj    = Product.objects.filter(ProductID=prod_id).first()            if prod_id    else None
    variant_obj = ProductVariant.objects.filter(VariantID=variant_id).first() if variant_id else None
    start_raw   = request.data.get('start_date')
    end_raw     = request.data.get('end_date')
    start_date  = _date.fromisoformat(start_raw) if start_raw else None
    end_date    = _date.fromisoformat(end_raw)   if end_raw   else None
    # [FIX #7] Kiểm tra ngày hợp lệ
    if start_date and end_date and end_date <= start_date:
        return Response({"message": "Ngày kết thúc phải sau ngày bắt đầu"}, status=status.HTTP_400_BAD_REQUEST)
    if end_date and not start_date:
        return Response({"message": "Vui lòng chọn ngày bắt đầu"}, status=status.HTTP_400_BAD_REQUEST)
    min_order   = float(request.data.get('min_order', 0) or 0)
    max_disc    = request.data.get('max_discount')
    usage_limit = request.data.get('usage_limit')
    v = Voucher.objects.create(Code=code, Type=vtype, Value=float(value), Scope=scope, CategoryID=cat_obj, ProductID=prod_obj, VariantID=variant_obj, MinOrder=min_order, MaxDiscount=float(max_disc) if max_disc else None, StartDate=start_date, EndDate=end_date, UsageLimit=int(usage_limit) if usage_limit else None, IsActive=True)
    _write_log(request, None, 'create_voucher', f'Tạo voucher: {code} ({vtype}, {value})')
    return Response({"message": "Tạo voucher thành công", "id": v.VoucherID}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def update_voucher(request):
    from .models import Voucher
    voucher_id = request.data.get('id')
    if not voucher_id: return Response({"message": "Thiếu voucher_id"}, status=status.HTTP_400_BAD_REQUEST)
    v = Voucher.objects.filter(VoucherID=voucher_id).first()
    if not v: return Response({"message": "Không tìm thấy voucher"}, status=status.HTTP_404_NOT_FOUND)
    map_ = {'type': 'Type', 'value': 'Value', 'min_order': 'MinOrder', 'max_discount': 'MaxDiscount', 'usage_limit': 'UsageLimit', 'start_date': 'StartDate', 'end_date': 'EndDate'}
    for req_key, model_field in map_.items():
        val = request.data.get(req_key)
        if val is not None: setattr(v, model_field, val or None)
    v.save()
    _write_log(request, None, 'update_voucher', f'Sửa voucher ID={voucher_id}')
    return Response({"message": "Cập nhật voucher thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOnly])
def delete_voucher(request):
    from .models import Voucher
    voucher_id = request.data.get('id')
    if not voucher_id: return Response({"message": "Thiếu voucher_id"}, status=status.HTTP_400_BAD_REQUEST)
    Voucher.objects.filter(VoucherID=voucher_id).delete()
    _write_log(request, None, 'delete_voucher', f'Xóa voucher ID={voucher_id}')
    return Response({"message": "Đã xóa voucher"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def deactivate_voucher(request):
    from .models import Voucher
    vid = request.data.get('id')
    v = Voucher.objects.filter(VoucherID=vid).first()
    if not v: return Response({"message": "Không tìm thấy voucher"}, status=status.HTTP_404_NOT_FOUND)
    v.IsActive = False; v.save()
    _write_log(request, None, 'deactivate_voucher', f'Tắt voucher ID={vid}')
    return Response({"message": "Đã vô hiệu hóa voucher"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def activate_voucher(request):
    """Kích hoạt lại voucher — chặn nếu đã hết hạn."""
    import datetime as _dt
    from .models import Voucher
    voucher_id = request.data.get('id')
    if not voucher_id:
        return Response({"message": "Thiếu voucher_id"}, status=status.HTTP_400_BAD_REQUEST)
    v = Voucher.objects.filter(VoucherID=voucher_id).first()
    if not v:
        return Response({"message": "Không tìm thấy voucher"}, status=status.HTTP_404_NOT_FOUND)
    today = _dt.date.today()
    if v.EndDate and v.EndDate < today:
        return Response({"message": f"Không thể kích hoạt — voucher đã hết hạn từ {v.EndDate.strftime('%d/%m/%Y')}"}, status=status.HTTP_400_BAD_REQUEST)
    v.IsActive = True
    v.save(update_fields=["IsActive"])
    _write_log(request, None, 'update_voucher', f'Kích hoạt lại voucher ID={voucher_id}')
    return Response({"message": "Voucher đã được kích hoạt", "is_active": True})


@api_view(['POST'])
def apply_voucher(request):
    from .models import Voucher
    code = request.data.get('code', '').strip().upper()
    if not code: return Response({"message": "Vui lòng nhập mã voucher"}, status=status.HTTP_400_BAD_REQUEST)
    v = Voucher.objects.filter(Code=code).first()
    if not v:          return Response({"message": "Mã voucher không tồn tại"}, status=status.HTTP_404_NOT_FOUND)
    if not v.IsActive: return Response({"message": "Voucher đã bị vô hiệu hóa"}, status=status.HTTP_400_BAD_REQUEST)
    today = _date.today()
    if v.StartDate and v.StartDate > today: return Response({"message": "Voucher chưa đến thời gian sử dụng"}, status=status.HTTP_400_BAD_REQUEST)
    if v.EndDate   and v.EndDate   < today: return Response({"message": "Voucher đã hết hạn"}, status=status.HTTP_400_BAD_REQUEST)
    if v.UsageLimit and v.UsedCount >= v.UsageLimit: return Response({"message": "Voucher đã hết lượt sử dụng"}, status=status.HTTP_400_BAD_REQUEST)
    _write_customer_log(request, request.data.get("customer_id"), "apply_voucher", f"Code: {code}")
    return Response({"message": "Áp dụng voucher thành công", "voucher": _fmt_voucher(v)}, status=status.HTTP_200_OK)


@api_view(['POST'])
def get_best_voucher_for_cart(request):
    items = request.data.get('items', [])
    if not items: return Response({"voucher": None}, status=status.HTTP_200_OK)
    active = _active_vouchers()
    if not active: return Response({"voucher": None}, status=status.HTTP_200_OK)
    best, best_disc = None, 0
    for v in active:
        d = _calc_discount_for_items(v, items)
        if d > best_disc: best_disc = d; best = v
    if not best or best_disc <= 0: return Response({"voucher": None, "discount": 0}, status=status.HTTP_200_OK)
    return Response({"voucher": _fmt_voucher(best), "discount": best_disc}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_best_voucher_for_product(request):
    product_id  = request.query_params.get('product_id')
    category_id = request.query_params.get('category_id')
    variant_id  = request.query_params.get('variant_id')
    try:
        price = float(request.query_params.get('price', 0))
        qty   = int(request.query_params.get('qty', 1))
    except (ValueError, TypeError):
        return Response({"message": "price/qty không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    if not price: return Response({"voucher": None}, status=status.HTTP_200_OK)
    item_list = [{"product_id": product_id, "category_id": category_id, "variant_id": variant_id, "price": price, "qty": qty}]
    active    = _active_vouchers()
    if not active: return Response({"voucher": None}, status=status.HTTP_200_OK)
    best, best_disc = None, 0
    for v in active:
        d = _calc_discount_for_items(v, item_list)
        if d > best_disc: best_disc = d; best = v
    if not best or best_disc <= 0: return Response({"voucher": None, "discount": 0}, status=status.HTTP_200_OK)
    return Response({"voucher": _fmt_voucher(best), "discount": best_disc, "final_price": max(0, price * qty - best_disc), "unit_price": max(0, price - round(best_disc / qty))}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_best_voucher(request):
    active = _active_vouchers()
    if not active: return Response({"voucher": None}, status=status.HTTP_200_OK)
    def sort_key(v):
        if v.Type == 'fixed':   return float(v.Value)
        if v.Type == 'percent': return float(v.Value) * 1_000_000
        return 0
    best = max(active, key=sort_key)
    return Response({"voucher": _fmt_voucher(best)}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════
# ORDER
# ══════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def create_order(request):
    from .models import Voucher
    from django.db import transaction
    from django.db.models import F
    from django.utils import timezone as _tz

    customer_id      = request.data.get('customer_id')
    items            = request.data.get('items', [])
    voucher_code     = request.data.get('voucher_code')
    payment_method   = request.data.get('payment_method', 'cod')
    receiver_name    = request.data.get('receiver_name', '').strip()
    receiver_phone   = request.data.get('receiver_phone', '').strip()
    receiver_address = request.data.get('receiver_address', '').strip()
    note             = request.data.get('note', '').strip()

    if not customer_id:      return Response({"message": "Thiếu thông tin tài khoản"}, status=status.HTTP_400_BAD_REQUEST)
    if not items:            return Response({"message": "Giỏ hàng trống"}, status=status.HTTP_400_BAD_REQUEST)
    if not receiver_name:    return Response({"message": "Vui lòng nhập tên người nhận"}, status=status.HTTP_400_BAD_REQUEST)
    if not receiver_phone:   return Response({"message": "Vui lòng nhập số điện thoại"}, status=status.HTTP_400_BAD_REQUEST)
    if not receiver_address: return Response({"message": "Vui lòng nhập địa chỉ nhận hàng"}, status=status.HTTP_400_BAD_REQUEST)

    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)

    # [FIX #3 + #5] Tính lại subtotal từ DB — KHÔNG tin giá từ frontend
    # Dùng select_for_update để lock row, tránh race condition stock
    validated_items = []
    try:
        with transaction.atomic():
            subtotal = 0.0
            for item in items:
                raw_vid = item.get('variant_id')
                try:    vid = int(raw_vid)
                except (ValueError, TypeError): return Response({"message": "Sản phẩm không hợp lệ. Vui lòng xóa giỏ hàng và thêm lại."}, status=status.HTTP_400_BAD_REQUEST)

                # [FIX RACE CONDITION] select_for_update(nowait=False) lock row độc quyền
                # Nếu transaction khác đang giữ lock → đợi giải phóng rồi mới đọc
                # Đảm bảo 2 request đồng thời không đọc cùng stock value
                variant = ProductVariant.objects.select_for_update().select_related('ProductID').filter(VariantID=vid).first()
                if not variant:
                    return Response({"message": f"Sản phẩm #{vid} không còn tồn tại"}, status=status.HTTP_400_BAD_REQUEST)

                qty = int(item.get('qty', 1))
                if qty <= 0:
                    return Response({"message": "Số lượng sản phẩm phải lớn hơn 0"}, status=status.HTTP_400_BAD_REQUEST)

                # [FIX RACE CONDITION] Kiểm tra stock SAU KHI đã lock row
                # Tại thời điểm này không có transaction nào khác có thể đọc/ghi variant này
                if variant.StockQuantity < qty:
                    pname = variant.ProductID.ProductName
                    color = f" ({variant.Color})" if variant.Color else ""
                    avail = variant.StockQuantity
                    if avail == 0:
                        msg = f"'{pname}{color}' đã hết hàng"
                    else:
                        msg = f"'{pname}{color}' chỉ còn {avail} sản phẩm trong kho"
                    return Response({"message": msg}, status=status.HTTP_400_BAD_REQUEST)

                # [FIX #3] Dùng giá từ DB, không dùng giá frontend gửi lên
                db_price = float(variant.Price)
                subtotal += db_price * qty
                validated_items.append({"variant": variant, "qty": qty, "price": db_price})

            # [FIX #4] Tính discount từ BE, kiểm tra usage_limit atomic
            discount = 0.0
            voucher  = None
            if voucher_code:
                # select_for_update để tránh race condition usage_limit
                voucher = Voucher.objects.select_for_update().filter(
                    Code=voucher_code.strip().upper(), IsActive=True
                ).first()
                if voucher:
                    today = _tz.now().date()
                    if voucher.EndDate   and voucher.EndDate   < today:
                        return Response({"message": "Voucher đã hết hạn"}, status=status.HTTP_400_BAD_REQUEST)
                    if voucher.StartDate and voucher.StartDate > today:
                        return Response({"message": "Voucher chưa có hiệu lực"}, status=status.HTTP_400_BAD_REQUEST)
                    # [FIX #4] Kiểm tra usage_limit atomically
                    if voucher.UsageLimit and voucher.UsedCount >= voucher.UsageLimit:
                        return Response({"message": "Voucher đã hết lượt sử dụng"}, status=status.HTTP_400_BAD_REQUEST)
                    # Tính discount từ BE
                    if subtotal >= float(voucher.MinOrder or 0):
                        if voucher.Type == 'percent':
                            discount = round(subtotal * min(float(voucher.Value), 100) / 100)
                            if voucher.MaxDiscount:
                                discount = min(discount, float(voucher.MaxDiscount))
                        else:
                            discount = min(float(voucher.Value), subtotal)

            total = max(0.0, subtotal - discount)

            # Tạo đơn hàng
            shipping_address = f"{receiver_name} - {receiver_phone} - {receiver_address}"
            if note: shipping_address += f" | Ghi chú: {note}"
            order = Order(CustomerID=customer, TotalAmount=total, Status='Processing', ShippingAddress=shipping_address)
            for field, val in [('PaymentMethod', payment_method), ('Subtotal', subtotal), ('Discount', discount), ('StatusNote', '')]:
                try: setattr(order, field, val)
                except: pass
            order.save()

            # Tạo OrderDetail và trừ stock trong cùng transaction
            for vi in validated_items:
                variant = vi['variant']; qty = vi['qty']
                OrderDetail.objects.create(OrderID=order, VariantID=variant, Quantity=qty, UnitPrice=vi['price'])
                # [FIX RACE CONDITION] Trừ stock với điều kiện stock >= qty
                # Dùng F() + filter stock >= qty để chắc chắn không xuống âm
                # Nếu rows_updated == 0 → có race condition xảy ra → rollback toàn bộ transaction
                rows_updated = ProductVariant.objects.filter(
                    VariantID=variant.VariantID,
                    StockQuantity__gte=qty  # Chỉ update nếu stock còn đủ
                ).update(StockQuantity=F('StockQuantity') - qty)

                if rows_updated == 0:
                    # Race condition: transaction khác đã trừ stock trước
                    pname = variant.ProductID.ProductName
                    color = f" ({variant.Color})" if variant.Color else ""
                    raise Exception(f"'{pname}{color}' vừa hết hàng, vui lòng thử lại")

            # [FIX #4] Tăng used_count atomically sau khi đã xác nhận voucher hợp lệ
            if voucher:
                Voucher.objects.filter(VoucherID=voucher.VoucherID).update(
                    UsedCount=F('UsedCount') + 1
                )

    except Exception as e:
        return Response({"message": f"Đặt hàng thất bại, vui lòng thử lại. ({str(e)})"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    resp = {"message": "Đặt hàng thành công", "order_id": order.OrderID}
    _write_customer_log(request, customer_id, "create_order",
        f"OrderID: {order.OrderID}, total: {total}, method: {payment_method}")

    # [FIX] Gọi MoMo API inline — dùng helper _call_momo_api
    if payment_method == "momo":
        resp["momo_url"] = _call_momo_api(order.OrderID, total)

    return Response(resp, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticatedCustomer])
def list_orders(request):
    customer_id = request.query_params.get('customer_id')
    if not customer_id: return Response({"message": "Thiếu customer_id"}, status=status.HTTP_400_BAD_REQUEST)
    orders = Order.objects.filter(CustomerID=customer_id).order_by('-OrderDate')
    result = []
    for o in orders:
        details = OrderDetail.objects.filter(OrderID=o).select_related('VariantID__ProductID')
        items = []
        for d in details:
            v = d.VariantID; p = v.ProductID
            primary_img = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first()
            items.append({"product_name": p.ProductName, "color": v.Color or "", "storage": v.Storage or "", "ram": v.Ram or "", "quantity": d.Quantity, "unit_price": str(d.UnitPrice), "image": v.Image or (primary_img.ImageUrl if primary_img else "")})
        result.append({"id": o.OrderID, "status": o.Status, "total_amount": str(o.TotalAmount), "shipping_address": o.ShippingAddress, "payment_method": getattr(o, 'PaymentMethod', 'cod'), "status_note": getattr(o, 'StatusNote', ''), "subtotal": str(getattr(o, 'Subtotal', o.TotalAmount) or o.TotalAmount), "discount": str(getattr(o, 'Discount', 0) or 0), "created_at": o.OrderDate.isoformat(), "items": items})
    return Response({"orders": result}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def cancel_order(request):
    from django.db import transaction
    order_id    = request.data.get('order_id')
    customer_id = request.data.get('customer_id')
    o = Order.objects.filter(OrderID=order_id, CustomerID=customer_id).first()
    if not o: return Response({"message": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)
    if o.Status in ('Shipping', 'Delivered', 'Cancelled'):
        label = {'Shipping': 'đang giao', 'Delivered': 'đã giao', 'Cancelled': 'đã hủy'}.get(o.Status)
        return Response({"message": f"Không thể hủy đơn hàng {label}"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        with transaction.atomic():
            for d in OrderDetail.objects.filter(OrderID=o):
                # [FIX] Dùng F() để cộng stock atomically, tránh race condition
                ProductVariant.objects.filter(VariantID=d.VariantID_id).update(
                    StockQuantity=F('StockQuantity') + d.Quantity
                )
            o.Status = 'Cancelled'
            try: o.StatusNote = 'Khách hàng hủy đơn'
            except: pass
            o.save()
    except Exception as e:
        return Response({"message": f"Hủy đơn thất bại: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    _write_customer_log(request, customer_id, "cancel_order", f"OrderID: {order_id}")
    return Response({"message": "Đã hủy đơn hàng thành công"}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def admin_list_orders(request):
    orders = Order.objects.all().order_by('-OrderDate')
    result = []
    for o in orders:
        details = OrderDetail.objects.filter(OrderID=o).select_related('VariantID__ProductID')
        items = []
        for d in details:
            v = d.VariantID; p = v.ProductID
            primary_img = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first()
            items.append({"product_name": p.ProductName, "color": v.Color or "", "storage": v.Storage or "", "ram": v.Ram or "", "quantity": d.Quantity, "unit_price": str(d.UnitPrice), "image": v.Image or (primary_img.ImageUrl if primary_img else "")})
        cust = o.CustomerID
        result.append({"id": o.OrderID, "status": o.Status, "total_amount": str(o.TotalAmount), "shipping_address": o.ShippingAddress, "payment_method": getattr(o, 'PaymentMethod', 'cod'), "status_note": getattr(o, 'StatusNote', ''), "subtotal": str(getattr(o, 'Subtotal', o.TotalAmount) or o.TotalAmount), "discount": str(getattr(o, 'Discount', 0) or 0), "created_at": o.OrderDate.isoformat(), "customer_name": cust.FullName, "customer_phone": cust.PhoneNumber or "", "items": items})
    return Response({"orders": result}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def update_order_status(request):
    from django.db import transaction
    VALID = ['Pending', 'Processing', 'Shipping', 'Delivered', 'Cancelled']
    FLOW  = {'Pending': 'Processing', 'Processing': 'Shipping', 'Shipping': 'Delivered'}
    order_id   = request.data.get('order_id')
    new_status = request.data.get('status')
    note       = request.data.get('note', '').strip()
    if new_status not in VALID: return Response({"message": f"Trạng thái không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)
    o = Order.objects.filter(OrderID=order_id).first()
    if not o: return Response({"message": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)
    if new_status != 'Cancelled' and FLOW.get(o.Status) != new_status:
        return Response({"message": f"Không thể chuyển từ '{o.Status}' sang '{new_status}'"}, status=status.HTTP_400_BAD_REQUEST)
    if new_status == 'Cancelled' and o.Status in ['Shipping', 'Delivered']:
        return Response({"message": "Không thể hủy đơn đang giao hoặc đã giao"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        with transaction.atomic():
            if new_status == 'Cancelled':
                for d in OrderDetail.objects.filter(OrderID=o):
                    # [FIX] Dùng F() để cộng stock atomically
                    ProductVariant.objects.filter(VariantID=d.VariantID_id).update(
                        StockQuantity=F('StockQuantity') + d.Quantity
                    )
            o.Status = new_status
            try:
                # [FIX] Khi admin hủy đơn → ghi rõ "Nhà bán hủy đơn" để khách hàng biết
                if new_status == 'Cancelled':
                    o.StatusNote = note if note else 'Nhà bán hủy đơn'
                else:
                    o.StatusNote = note
            except: pass
            o.save()
    except Exception as e:
        return Response({"message": f"Cập nhật thất bại: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    label = {'Processing': 'Đang xử lý', 'Shipping': 'Đang giao hàng', 'Delivered': 'Đã giao hàng', 'Cancelled': 'Đã hủy'}.get(new_status, new_status)
    _write_log(request, None, 'update_order', f'Cập nhật đơn #{order_id}: {o.Status} → {new_status}')
    return Response({"message": f"Cập nhật thành công: {label}"}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════
# RETURN REQUEST
# ══════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def create_return_request(request):
    from django.db import transaction
    order_id    = request.data.get('order_id')
    customer_id = request.data.get('customer_id')
    reason      = request.data.get('reason', '').strip()
    files       = request.FILES.getlist('media')
    if not order_id or not customer_id: return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if not reason: return Response({"message": "Vui lòng nhập lý do trả hàng"}, status=status.HTTP_400_BAD_REQUEST)
    o = Order.objects.filter(OrderID=order_id, CustomerID=customer_id).first()
    if not o: return Response({"message": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)
    if o.Status != 'Delivered': return Response({"message": "Chỉ có thể yêu cầu trả hàng cho đơn đã giao"}, status=status.HTTP_400_BAD_REQUEST)
    existing = ReturnRequest.objects.filter(OrderID=o).first()
    if existing: return Response({"message": "Đơn hàng này đã có yêu cầu trả hàng"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        with transaction.atomic():
            rr = ReturnRequest.objects.create(OrderID=o, Reason=reason, Status='Pending')
            for f in files:
                try:
                    resource_type = 'video' if f.content_type.startswith('video') else 'image'
                    result = _upload_to_cloudinary(f, enhance="product", folder=f"sellphone/returns/{o.OrderID}", resource_type=resource_type)
                    ReturnMedia.objects.create(ReturnID=rr, Url=result['secure_url'], MediaType=resource_type)
                except: pass
            o.Status = 'ReturnRequested'
            try: o.StatusNote = f'Yêu cầu trả hàng: {reason}'
            except: pass
            o.save()
    except Exception as e:
        return Response({"message": f"Tạo yêu cầu thất bại: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    _write_customer_log(request, customer_id, "create_return", f"OrderID: {order_id}, reason: {reason[:80]}")
    return Response({"message": "Đã gửi yêu cầu trả hàng thành công", "return_id": rr.ReturnID}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def list_return_requests(request):
    returns = ReturnRequest.objects.all().select_related('OrderID').order_by('-CreatedAt')
    result  = []
    for rr in returns:
        o     = rr.OrderID
        media = ReturnMedia.objects.filter(ReturnID=rr)
        result.append({"return_id": rr.ReturnID, "order_id": o.OrderID, "customer_id": str(o.CustomerID_id), "customer_name": o.CustomerID.FullName, "reason": rr.Reason, "status": rr.Status, "admin_note": rr.AdminNote or "", "created_at": rr.CreatedAt.isoformat(), "media": [{"url": m.Url, "type": m.MediaType} for m in media], "order_total": str(o.TotalAmount)})
    return Response({"returns": result}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def process_return_request(request):
    from django.db import transaction
    return_id = request.data.get('return_id')
    action    = request.data.get('action')
    note      = request.data.get('note', '').strip()
    VALID_ACTIONS = ('approve', 'reject', 'complete', 'returning')
    if action not in VALID_ACTIONS: return Response({"message": "Hành động không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)
    rr = ReturnRequest.objects.select_related('OrderID').filter(ReturnID=return_id).first()
    if not rr: return Response({"message": "Không tìm thấy yêu cầu trả hàng"}, status=status.HTTP_404_NOT_FOUND)
    o = rr.OrderID
    FLOW = {'approve': ('Pending', 'Approved', 'Đã chấp nhận'), 'reject': ('Pending', 'Rejected', 'Đã từ chối'), 'returning': ('Approved', 'Returning', 'Đang nhận hàng hoàn về'), 'complete': ('Returning', 'Completed', 'Hoàn tất trả hàng')}
    required_status, new_rr_status, default_note = FLOW[action]
    if rr.Status != required_status: return Response({"message": f"Không thể '{action}' khi yêu cầu đang ở trạng thái '{rr.Status}'"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        with transaction.atomic():
            rr.Status = new_rr_status; rr.AdminNote = note or default_note; rr.save()
            ORDER_STATUS_MAP = {'approve': 'ReturnApproved', 'reject': 'Delivered', 'returning': 'Returning', 'complete': 'Returned'}
            o.Status = ORDER_STATUS_MAP[action]
            try: o.StatusNote = note or default_note
            except: pass
            if action == 'complete':
                for d in OrderDetail.objects.select_related('VariantID').filter(OrderID=o):
                    d.VariantID.StockQuantity += d.Quantity; d.VariantID.save()
            o.save()
    except Exception as e:
        return Response({"message": f"Xử lý thất bại: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    _write_log(request, None, 'process_return', f'Xử lý trả hàng #{return_id}: {action} – {note or default_note}')
    return Response({"message": f"{note or default_note}"}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticatedCustomer])
def get_return_request(request, order_id):
    o = Order.objects.filter(OrderID=order_id).first()
    if not o: return Response({"return": None}, status=status.HTTP_200_OK)
    rr = ReturnRequest.objects.filter(OrderID=o).first()
    if not rr: return Response({"return": None}, status=status.HTTP_200_OK)
    media = ReturnMedia.objects.filter(ReturnID=rr)
    return Response({"return": {"return_id": rr.ReturnID, "reason": rr.Reason, "status": rr.Status, "admin_note": rr.AdminNote or "", "created_at": rr.CreatedAt.isoformat(), "media": [{"url": m.Url, "type": m.MediaType} for m in media]}}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════
# POST / BLOG
# ══════════════════════════════════════════════════════════════

@api_view(['GET'])
def list_posts(request):
    category = request.query_params.get('category', 'all')
    auth_hdr2 = request.META.get("HTTP_AUTHORIZATION", "")
    _is_staff_post = False
    try:
        if auth_hdr2.startswith("Bearer "):
            import jwt as _jwt3
            from django.conf import settings as _s3
            _pl3 = _jwt3.decode(auth_hdr2.split(" ", 1)[1], _s3.SECRET_KEY, algorithms=["HS256"])
            _is_staff_post = _pl3.get("type") == "staff"
    except Exception:
        pass
    posts = Post.objects.all() if _is_staff_post else Post.objects.filter(IsActive=True)
    if category and category != 'all': posts = posts.filter(Category=category)
    posts = posts.order_by('-CreatedAt')
    result = []
    for p in posts:
        thumb = ""
        try:
            blocks = json.loads(p.Blocks) if isinstance(p.Blocks, str) else (p.Blocks or [])
            for b in blocks:
                if b.get('type') == 'image' and b.get('url'): thumb = b['url']; break
        except: pass
        result.append({"id": p.PostID, "title": p.Title, "category": p.Category or "Mẹo vặt", "thumbnail": thumb, "created_at": p.CreatedAt.isoformat(), "author": p.Author or "Admin", "is_active": getattr(p, "IsActive", True)})
    return Response({"posts": result}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_post(request, post_id):
    p = Post.objects.filter(PostID=post_id).first()
    if not p: return Response({"message": "Không tìm thấy bài viết"}, status=status.HTTP_404_NOT_FOUND)
    auth_hdr3 = request.META.get("HTTP_AUTHORIZATION", "")
    _is_staff_gp = False
    try:
        if auth_hdr3.startswith("Bearer "):
            import jwt as _jwt4
            from django.conf import settings as _s4
            _pl4 = _jwt4.decode(auth_hdr3.split(" ", 1)[1], _s4.SECRET_KEY, algorithms=["HS256"])
            _is_staff_gp = _pl4.get("type") == "staff"
    except Exception:
        pass
    if not _is_staff_gp and not getattr(p, "IsActive", True):
        return Response({"message": "Không tìm thấy bài viết"}, status=status.HTTP_404_NOT_FOUND)
    try: blocks = json.loads(p.Blocks) if isinstance(p.Blocks, str) else (p.Blocks or [])
    except: blocks = []
    return Response({"post": {"id": p.PostID, "title": p.Title, "category": p.Category or "", "blocks": blocks, "created_at": p.CreatedAt.isoformat(), "author": p.Author or "Admin"}}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def create_post(request):
    title    = request.data.get('title', '').strip()
    category = request.data.get('category', '').strip()
    blocks   = request.data.get('blocks', '[]')
    author   = request.data.get('author', 'Admin').strip()
    if not title: return Response({"message": "Vui lòng nhập tiêu đề bài viết"}, status=status.HTTP_400_BAD_REQUEST)
    if Post.objects.filter(Title__iexact=title).exists(): return Response({"message": f"Bài viết '{title}' đã tồn tại"}, status=status.HTTP_400_BAD_REQUEST)
    if isinstance(blocks, str):
        try: blocks_parsed = json.loads(blocks)
        except: blocks_parsed = []
    else: blocks_parsed = blocks
    for key in request.FILES:
        if key.startswith('block_img_'):
            idx = key.replace('block_img_', '')
            try:
                result = _upload_to_cloudinary(request.FILES[key], enhance="post", folder="sellphone/posts", resource_type="image")
                for b in blocks_parsed:
                    if b.get('_idx') == idx and b.get('type') == 'image': b['url'] = result['secure_url']; break
            except: pass
    post = Post.objects.create(Title=title, Category=category or "Mẹo vặt", Blocks=json.dumps(blocks_parsed, ensure_ascii=False), Author=author)
    _write_log(request, None, 'create_post', f'Tạo bài viết: "{title}" (ID={post.PostID})')
    return Response({"message": "Đăng bài thành công", "post_id": post.PostID}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def update_post(request):
    post_id = request.data.get('post_id')
    p = Post.objects.filter(PostID=post_id).first()
    if not p: return Response({"message": "Không tìm thấy bài viết"}, status=status.HTTP_404_NOT_FOUND)
    title    = request.data.get('title', p.Title).strip()
    category = request.data.get('category', p.Category).strip()
    blocks   = request.data.get('blocks', '[]')
    if isinstance(blocks, str):
        try: blocks_parsed = json.loads(blocks)
        except: blocks_parsed = []
    else: blocks_parsed = blocks
    for key in request.FILES:
        if key.startswith('block_img_'):
            idx = key.replace('block_img_', '')
            try:
                result = _upload_to_cloudinary(request.FILES[key], enhance="post", folder="sellphone/posts", resource_type="image")
                for b in blocks_parsed:
                    if b.get('_idx') == idx and b.get('type') == 'image': b['url'] = result['secure_url']; break
            except: pass
    p.Title = title; p.Category = category; p.Blocks = json.dumps(blocks_parsed, ensure_ascii=False); p.save()
    _write_log(request, None, 'update_post', f'Sửa bài viết ID={post_id}: "{title}"')
    return Response({"message": "Cập nhật bài viết thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def delete_post(request):
    post_id = request.data.get('post_id')
    p = Post.objects.filter(PostID=post_id).first()
    if not p: return Response({"message": "Không tìm thấy bài viết"}, status=status.HTTP_404_NOT_FOUND)
    p.delete()
    _write_log(request, None, 'delete_post', f'Xóa bài viết ID={post_id}')
    return Response({"message": "Đã xóa bài viết"}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════
# REVIEW & COMMENT
# ══════════════════════════════════════════════════════════════

def _serialize_review(review, customer_id=None):
    from .models import AdminReply, Like, ReviewMedia
    import json as _json
    media       = [{"url": m.url, "type": m.media_type} for m in ReviewMedia.objects.filter(review=review)]
    admin_reply = AdminReply.objects.filter(target_type="review", target_id=review.id).first()
    liked = False
    likes = Like.objects.filter(target_type="review", target_id=review.id).count()
    if customer_id:
        liked = Like.objects.filter(customer_id=customer_id, target_type="review", target_id=review.id).exists()
    variant_label = ""
    if review.variant:
        v = review.variant
        parts = [v.Color, v.Ram, v.Storage]
        variant_label = " · ".join(p for p in parts if p)
    # Kiểm tra đã mua hàng
    has_purchased = False
    purchased_info = ""
    if customer_id:
        od = OrderDetail.objects.filter(
            OrderID__CustomerID=customer_id,
            OrderID__Status="Delivered",
            VariantID__ProductID=review.product_id,
        ).select_related("VariantID").first()
        if od:
            has_purchased = True
            v = od.VariantID
            parts = [p for p in [v.Color, v.Ram, v.Storage] if p]
            purchased_info = review.product.ProductName + (" · " + " / ".join(parts) if parts else "")
    # Admin reply media
    ar_media = []
    if admin_reply:
        try: ar_media = _json.loads(admin_reply.Media or "[]")
        except (ValueError, TypeError, json.JSONDecodeError): ar_media = []
    return {
        "id": review.id, "type": "review",
        "customer_id": str(review.customer_id), "customer_name": review.customer.FullName,
        "customer_avatar": review.customer.Avatar or "",
        "product_id": review.product_id, "product_name": review.product.ProductName,
        "variant": variant_label, "rating": review.rating, "content": review.content,
        "media": media,
        "has_purchased": has_purchased, "purchased_info": purchased_info,
        "admin_reply": {"content": admin_reply.content, "media": ar_media, "created_at": admin_reply.created_at.isoformat()} if admin_reply else None,
        "liked": liked, "likes": likes,
        "created_at": review.created_at.isoformat(), "updated_at": review.updated_at.isoformat(),
    }


def _serialize_comment(comment, customer_id=None):
    from .models import AdminReply, Like, Comment
    import json as _json
    admin_reply = AdminReply.objects.filter(target_type="comment", target_id=comment.id).first()
    liked = False
    likes = Like.objects.filter(target_type="comment", target_id=comment.id).count()
    if customer_id:
        liked = Like.objects.filter(customer_id=customer_id, target_type="comment", target_id=comment.id).exists()
    replies = [_serialize_comment(r, customer_id) for r in Comment.objects.filter(parent=comment).order_by("created_at")]
    # Comment media
    try: c_media = _json.loads(comment.Media or "[]")
    except (ValueError, TypeError, json.JSONDecodeError): c_media = []
    # has_purchased
    has_purchased = False
    purchased_info = ""
    if customer_id:
        od = OrderDetail.objects.filter(
            OrderID__CustomerID=customer_id,
            OrderID__Status="Delivered",
            VariantID__ProductID=comment.product_id,
        ).select_related("VariantID", "VariantID__ProductID").first()
        if od:
            has_purchased = True
            v = od.VariantID
            parts = [p for p in [v.Color, v.Ram, v.Storage] if p]
            purchased_info = v.ProductID.ProductName + (" · " + " / ".join(parts) if parts else "")
    # Admin reply media
    ar_media = []
    if admin_reply:
        try: ar_media = _json.loads(admin_reply.Media or "[]")
        except (ValueError, TypeError, json.JSONDecodeError): ar_media = []
    return {
        "id": comment.id, "type": "comment",
        "customer_id": str(comment.customer_id), "customer_name": comment.customer.FullName,
        "customer_avatar": comment.customer.Avatar or "",
        "product_id": comment.product_id, "product_name": comment.product.ProductName,
        "parent_id": comment.parent_id, "content": comment.content,
        "media": c_media,
        "has_purchased": has_purchased, "purchased_info": purchased_info,
        "admin_reply": {"content": admin_reply.content, "media": ar_media, "created_at": admin_reply.created_at.isoformat()} if admin_reply else None,
        "liked": liked, "likes": likes, "replies": replies,
        "created_at": comment.created_at.isoformat(), "updated_at": comment.updated_at.isoformat(),
    }


@api_view(['GET'])
def list_reviews(request):
    from .models import Review
    product_id  = request.query_params.get("product_id")
    customer_id = request.query_params.get("customer_id")
    if not product_id: return Response({"message": "Thiếu product_id"}, status=status.HTTP_400_BAD_REQUEST)
    reviews_qs = Review.objects.filter(product_id=product_id).select_related("customer", "product", "variant").order_by("-created_at")
    reviews    = [_serialize_review(r, customer_id) for r in reviews_qs]
    total = reviews_qs.count(); dist = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}; total_score = 0
    for r in reviews_qs:
        dist[r.rating] = dist.get(r.rating, 0) + 1; total_score += r.rating
    average = round(total_score / total, 1) if total else 0
    return Response({"reviews": reviews, "stats": {"total": total, "average": average, "distribution": dist}}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def create_review(request):
    from .models import Review, ReviewMedia
    customer_id = request.data.get("customer_id"); product_id = request.data.get("product_id")
    rating = request.data.get("rating"); content = request.data.get("content", "").strip()
    media_list = request.data.get("media", []); variant_id = request.data.get("variant_id")
    if not customer_id or not product_id: return Response({"ok": False, "error": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        rating = int(rating)
        if not (1 <= rating <= 5): raise ValueError
    except (ValueError, TypeError): return Response({"ok": False, "error": "Rating phải từ 1–5"}, status=status.HTTP_400_BAD_REQUEST)
    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer: return Response({"ok": False, "error": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    product = Product.objects.filter(ProductID=product_id).first()
    if not product: return Response({"ok": False, "error": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    # [FIX #8] Kiểm tra đã mua sản phẩm chưa (phải có đơn Delivered)
    has_purchased = OrderDetail.objects.filter(
        VariantID__ProductID=product_id,
        OrderID__CustomerID=customer_id,
        OrderID__Status='Delivered'
    ).exists()
    if not has_purchased:
        return Response({"ok": False, "error": "Bạn cần mua và nhận sản phẩm này trước khi đánh giá"}, status=status.HTTP_403_FORBIDDEN)
    if Review.objects.filter(customer=customer, product=product).exists(): return Response({"ok": False, "error": "Bạn đã đánh giá sản phẩm này rồi"}, status=status.HTTP_400_BAD_REQUEST)
    variant = ProductVariant.objects.filter(VariantID=variant_id).first() if variant_id else None
    review = Review.objects.create(customer=customer, product=product, variant=variant, rating=rating, content=content)
    for m in media_list:
        url = m.get("url", ""); mtype = m.get("type", "image")
        if url: ReviewMedia.objects.create(review=review, url=url, media_type=mtype)
    _write_customer_log(request, customer_id, "create_review", f"ProductID: {product_id}, rating: {rating}")
    return Response({"ok": True, "review": _serialize_review(review, customer_id)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def update_review(request):
    from .models import Review, ReviewMedia
    review_id = request.data.get("review_id"); customer_id = request.data.get("customer_id")
    rating = request.data.get("rating"); content = request.data.get("content", "").strip()
    media_list = request.data.get("media", [])
    review = Review.objects.filter(id=review_id, customer_id=customer_id).first()
    if not review: return Response({"ok": False, "error": "Không tìm thấy đánh giá"}, status=status.HTTP_404_NOT_FOUND)
    try:
        rating = int(rating)
        if not (1 <= rating <= 5): raise ValueError
    except (ValueError, TypeError): return Response({"ok": False, "error": "Rating phải từ 1–5"}, status=status.HTTP_400_BAD_REQUEST)
    review.rating = rating; review.content = content; review.save()
    ReviewMedia.objects.filter(review=review).delete()
    for m in media_list:
        url = m.get("url", ""); mtype = m.get("type", "image")
        if url: ReviewMedia.objects.create(review=review, url=url, media_type=mtype)
    _write_customer_log(request, customer_id, "update_review", f"ReviewID: {review.id}")
    return Response({"ok": True, "review": _serialize_review(review, customer_id)}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def delete_review(request):
    from .models import Review
    review_id = request.data.get("review_id"); customer_id = request.data.get("customer_id")
    review = Review.objects.filter(id=review_id, customer_id=customer_id).first()
    if not review: return Response({"ok": False, "error": "Không tìm thấy đánh giá"}, status=status.HTTP_404_NOT_FOUND)
    review.delete()
    _write_customer_log(request, request.data.get("customer_id"), "delete_review", f"ReviewID: {request.data.get('review_id')}")
    return Response({"ok": True, "message": "Đã xóa đánh giá"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def upload_review_media(request):
    """
    Upload 1 file media (ảnh / video / gif) cho review hoặc comment.
    Mỗi lần chỉ upload 1 file — frontend gọi nhiều lần nếu cần nhiều file.
    Giới hạn: ảnh ≤100MB, video ≤100MB, gif ≤100MB.
    """
    customer_id = request.data.get("customer_id")
    media_file  = request.FILES.get("file")
    if not customer_id or not media_file:
        return Response({"ok": False, "error": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)

    MAX_SIZE = 100 * 1024 * 1024   # 100MB cho tất cả loại
    ALLOWED_IMAGE_MIMES = {'image/jpeg', 'image/jpg', 'image/png', 'image/webp'}
    ALLOWED_GIF_MIMES   = {'image/gif'}
    ALLOWED_VIDEO_MIMES = {'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'}

    ct = (media_file.content_type or "").lower()
    is_video = ct in ALLOWED_VIDEO_MIMES
    is_gif   = ct in ALLOWED_GIF_MIMES
    is_image = ct in ALLOWED_IMAGE_MIMES

    if not (is_video or is_gif or is_image):
        return Response({
            "ok": False,
            "error": f"Định dạng không được hỗ trợ: {ct}. Chỉ chấp nhận ảnh (jpg/png/webp), gif, video (mp4/webm/mov)."
        }, status=status.HTTP_400_BAD_REQUEST)

    if media_file.size > MAX_SIZE:
        return Response({
            "ok": False,
            "error": f"File quá lớn. Mỗi {'ảnh' if is_image else 'GIF' if is_gif else 'video'} tối đa 100MB."
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        if is_video:
            resource_type = "video"
            media_type_label = "video"
            enhance = None
        elif is_gif:
            resource_type = "image"
            media_type_label = "gif"
            enhance = None   # GIF không enhance để giữ animation
        else:
            resource_type = "image"
            media_type_label = "image"
            enhance = "product"

        result = _upload_to_cloudinary(
            media_file,
            enhance=enhance,
            folder=f"sellphone/reviews/{customer_id}",
            resource_type=resource_type,
        )
        return Response({
            "ok": True,
            "url": result["secure_url"],
            "media_type": media_type_label,
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"ok": False, "error": f"Lỗi upload: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def list_comments(request):
    from .models import Comment
    product_id  = request.query_params.get("product_id")
    customer_id = request.query_params.get("customer_id")
    if not product_id: return Response({"message": "Thiếu product_id"}, status=status.HTTP_400_BAD_REQUEST)
    comments_qs = Comment.objects.filter(product_id=product_id, parent__isnull=True).select_related("customer", "product").order_by("-created_at")
    return Response({"comments": [_serialize_comment(c, customer_id) for c in comments_qs]}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def create_comment(request):
    from .models import Comment
    import json as _json
    customer_id = request.data.get("customer_id"); product_id = request.data.get("product_id")
    content    = request.data.get("content", "").strip()
    parent_id  = request.data.get("parent_id")
    media_list = request.data.get("media", [])   # [{url, type}] đã upload sẵn
    if not customer_id or not product_id: return Response({"ok": False, "error": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if not content: return Response({"ok": False, "error": "Nội dung bình luận không được để trống"}, status=status.HTTP_400_BAD_REQUEST)
    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer: return Response({"ok": False, "error": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    product = Product.objects.filter(ProductID=product_id).first()
    if not product: return Response({"ok": False, "error": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    parent = Comment.objects.filter(id=parent_id).first() if parent_id else None
    media_json = _json.dumps(media_list, ensure_ascii=False) if media_list else "[]"
    comment = Comment.objects.create(customer=customer, product=product, parent=parent, content=content, Media=media_json)
    _write_customer_log(request, customer_id, "create_comment", f"ProductID: {request.data.get('product_id')}")
    return Response({"ok": True, "comment": _serialize_comment(comment, customer_id)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def update_comment(request):
    """Sửa nội dung + media của bình luận (chỉ chủ sở hữu)."""
    from .models import Comment
    import json as _json
    comment_id  = request.data.get("comment_id")
    customer_id = request.data.get("customer_id")
    content     = request.data.get("content", "").strip()
    media_list  = request.data.get("media", [])  # [{url, type}] sau khi đã upload

    if not comment_id or not customer_id:
        return Response({"ok": False, "error": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if not content:
        return Response({"ok": False, "error": "Nội dung không được để trống"}, status=status.HTTP_400_BAD_REQUEST)

    comment = Comment.objects.filter(id=comment_id, customer_id=customer_id).first()
    if not comment:
        return Response({"ok": False, "error": "Không tìm thấy bình luận hoặc bạn không có quyền"}, status=status.HTTP_404_NOT_FOUND)

    comment.content = content
    comment.Media   = _json.dumps(media_list, ensure_ascii=False)
    comment.save(update_fields=["content", "Media", "updated_at"])

    _write_customer_log(request, customer_id, "create_comment", f"Edit CommentID: {comment_id}")
    return Response({"ok": True, "comment": _serialize_comment(comment, customer_id)}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def delete_comment(request):
    from .models import Comment
    comment_id = request.data.get("comment_id"); customer_id = request.data.get("customer_id")
    comment = Comment.objects.filter(id=comment_id, customer_id=customer_id).first()
    if not comment: return Response({"ok": False, "error": "Không tìm thấy bình luận"}, status=status.HTTP_404_NOT_FOUND)
    comment.delete()
    _write_customer_log(request, request.data.get("customer_id"), "delete_comment", f"CommentID: {request.data.get('comment_id')}")
    return Response({"ok": True, "message": "Đã xóa bình luận"}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticatedCustomer])
def toggle_like(request):
    from .models import Like
    customer_id = request.data.get("customer_id"); target_type = request.data.get("type"); target_id = request.data.get("target_id")
    if not customer_id or not target_type or not target_id: return Response({"ok": False, "error": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if target_type not in ("review", "comment"): return Response({"ok": False, "error": "type phải là 'review' hoặc 'comment'"}, status=status.HTTP_400_BAD_REQUEST)
    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer: return Response({"ok": False, "error": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    like_obj = Like.objects.filter(customer=customer, target_type=target_type, target_id=target_id).first()
    if like_obj: like_obj.delete(); liked = False
    else: Like.objects.create(customer=customer, target_type=target_type, target_id=target_id); liked = True
    count = Like.objects.filter(target_type=target_type, target_id=target_id).count()
    action_name = "like" if liked else "unlike"
    _write_customer_log(request, customer_id, action_name, f"{target_type}:{target_id}")
    return Response({"ok": True, "liked": liked, "count": count}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def admin_list_reviews(request):
    from .models import Review, Comment, AdminReply, ReviewMedia
    count_only = request.query_params.get("count_only")
    all_review_ids  = list(Review.objects.values_list("id", flat=True))
    all_comment_ids = list(Comment.objects.filter(parent__isnull=True).values_list("id", flat=True))
    replied_review_ids  = set(AdminReply.objects.filter(target_type="review").values_list("target_id", flat=True))
    replied_comment_ids = set(AdminReply.objects.filter(target_type="comment").values_list("target_id", flat=True))
    unanswered = sum(1 for rid in all_review_ids if rid not in replied_review_ids) + sum(1 for cid in all_comment_ids if cid not in replied_comment_ids)
    if count_only: return Response({"unanswered_count": unanswered}, status=status.HTTP_200_OK)
    review_items = []
    for r in Review.objects.select_related("customer", "product", "variant").order_by("-created_at"):
        media       = [{"url": m.url, "type": m.media_type} for m in ReviewMedia.objects.filter(review=r)]
        admin_reply = AdminReply.objects.filter(target_type="review", target_id=r.id).first()
        variant_label = ""
        if r.variant:
            parts = [r.variant.Color, r.variant.Ram, r.variant.Storage]
            variant_label = " · ".join(p for p in parts if p)
        review_items.append({"id": r.id, "type": "review", "customer_id": str(r.customer_id), "customer_name": r.customer.FullName, "customer_avatar": r.customer.Avatar or "", "product_id": r.product_id, "product_name": r.product.ProductName, "variant": variant_label, "rating": r.rating, "content": r.content, "media": media, "admin_reply": {"content": admin_reply.content} if admin_reply else None, "created_at": r.created_at.isoformat()})
    comment_items = []
    for c in Comment.objects.filter(parent__isnull=True).select_related("customer", "product").order_by("-created_at"):
        admin_reply = AdminReply.objects.filter(target_type="comment", target_id=c.id).first()
        comment_items.append({"id": c.id, "type": "comment", "customer_id": str(c.customer_id), "customer_name": c.customer.FullName, "customer_avatar": c.customer.Avatar or "", "product_id": c.product_id, "product_name": c.product.ProductName, "content": c.content, "media": [], "admin_reply": {"content": admin_reply.content} if admin_reply else None, "created_at": c.created_at.isoformat()})
    all_items = sorted(review_items + comment_items, key=lambda x: x["created_at"], reverse=True)
    return Response({"items": all_items, "unanswered_count": unanswered}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def admin_reply(request):
    from .models import AdminReply
    target_type = request.data.get("type"); target_id = request.data.get("target_id"); content = request.data.get("content", "").strip()
    if not target_type or not target_id: return Response({"ok": False, "error": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if target_type not in ("review", "comment"): return Response({"ok": False, "error": "type không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    if not content: return Response({"ok": False, "error": "Nội dung phản hồi không được để trống"}, status=status.HTTP_400_BAD_REQUEST)
    import json as _json
    media_list = request.data.get("media", [])
    media_json = _json.dumps(media_list, ensure_ascii=False) if media_list else "[]"
    obj, _ = AdminReply.objects.update_or_create(target_type=target_type, target_id=int(target_id), defaults={"content": content, "Media": media_json})
    return Response({"ok": True, "message": "Đã phản hồi thành công", "reply": {"id": obj.id, "content": obj.content}}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def admin_delete_reply(request):
    from .models import AdminReply
    target_type = request.data.get("type"); target_id = request.data.get("target_id")
    reply = AdminReply.objects.filter(target_type=target_type, target_id=target_id).first()
    if not reply: return Response({"ok": False, "error": "Không tìm thấy phản hồi"}, status=status.HTTP_404_NOT_FOUND)
    reply.delete()
    return Response({"ok": True, "message": "Đã xóa phản hồi"}, status=status.HTTP_200_OK)



# ══════════════════════════════════════════════════════════════
# DISABLE / ENABLE — Category, Product, Variant, Post, Banner
# ══════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def toggle_category(request):
    """Vô hiệu hóa / kích hoạt danh mục. Kéo theo toàn bộ sản phẩm."""
    cat_id   = request.data.get('id')
    is_active = request.data.get('is_active')  # bool
    if cat_id is None or is_active is None:
        return Response({"message": "Thiếu id hoặc is_active"}, status=status.HTTP_400_BAD_REQUEST)
    cat = Category.objects.filter(CategoryID=cat_id).first()
    if not cat:
        return Response({"message": "Không tìm thấy danh mục"}, status=status.HTTP_404_NOT_FOUND)
    cat.IsActive = bool(is_active)
    cat.save(update_fields=["IsActive"])
    action = "Kích hoạt" if is_active else "Vô hiệu hóa"
    _write_log(request, None, "update_category", f"{action} danh mục: {cat.CategoryName}")
    return Response({"message": f"{action} danh mục thành công", "is_active": cat.IsActive})


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def toggle_product(request):
    """Vô hiệu hóa / kích hoạt sản phẩm (và mô tả sản phẩm)."""
    product_id = request.data.get('id')
    is_active  = request.data.get('is_active')
    if product_id is None or is_active is None:
        return Response({"message": "Thiếu id hoặc is_active"}, status=status.HTTP_400_BAD_REQUEST)
    product = Product.objects.filter(ProductID=product_id).first()
    if not product:
        return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    product.IsActive = bool(is_active)
    product.save(update_fields=["IsActive"])
    action = "Kích hoạt" if is_active else "Vô hiệu hóa"
    _write_log(request, None, "update_product", f"{action} sản phẩm: {product.ProductName}")
    return Response({"message": f"{action} sản phẩm thành công", "is_active": product.IsActive})


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def toggle_variant(request):
    """Vô hiệu hóa / kích hoạt một hoặc nhiều biến thể.
    Nếu sau khi toggle mà sản phẩm không còn biến thể active nào,
    tự động vô hiệu hóa sản phẩm (và ngược lại khi kích hoạt lại).
    """
    variant_ids = request.data.get('ids')   # list of int
    is_active   = request.data.get('is_active')
    if not variant_ids or is_active is None:
        return Response({"message": "Thiếu ids hoặc is_active"}, status=status.HTTP_400_BAD_REQUEST)
    if not isinstance(variant_ids, list):
        variant_ids = [variant_ids]

    updated = ProductVariant.objects.filter(VariantID__in=variant_ids)
    if not updated.exists():
        return Response({"message": "Không tìm thấy biến thể"}, status=status.HTTP_404_NOT_FOUND)

    product_ids = set(updated.values_list("ProductID_id", flat=True))
    updated.update(IsActive=bool(is_active))

    # Cascade: nếu 1 biến thể active còn lại = 0 → vô hiệu sản phẩm
    for pid in product_ids:
        active_count = ProductVariant.objects.filter(ProductID=pid, IsActive=True).count()
        Product.objects.filter(ProductID=pid).update(IsActive=(active_count > 0))

    action = "Kích hoạt" if is_active else "Vô hiệu hóa"
    _write_log(request, None, "update_variant", f"{action} {len(variant_ids)} biến thể")
    return Response({"message": f"{action} biến thể thành công", "is_active": bool(is_active)})


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def toggle_post(request):
    """Vô hiệu hóa / kích hoạt bài viết."""
    post_id   = request.data.get('id')
    is_active = request.data.get('is_active')
    if post_id is None or is_active is None:
        return Response({"message": "Thiếu id hoặc is_active"}, status=status.HTTP_400_BAD_REQUEST)
    post = Post.objects.filter(PostID=post_id).first()
    if not post:
        return Response({"message": "Không tìm thấy bài viết"}, status=status.HTTP_404_NOT_FOUND)
    post.IsActive = bool(is_active)
    post.save(update_fields=["IsActive"])
    action = "Kích hoạt" if is_active else "Vô hiệu hóa"
    _write_log(request, None, "update_post", f"{action} bài viết: {post.Title}")
    return Response({
        "message": f"Bài viết đã {'được kích hoạt' if is_active else 'bị vô hiệu hóa'}",
        "is_active": post.IsActive
    })


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def toggle_banner(request):
    """Vô hiệu hóa / kích hoạt banner. Cảnh báo nếu trùng page."""
    banner_id = request.data.get('id')
    is_active = request.data.get('is_active')
    if banner_id is None or is_active is None:
        return Response({"message": "Thiếu id hoặc is_active"}, status=status.HTTP_400_BAD_REQUEST)
    banner = Banner.objects.filter(BannerID=banner_id).first()
    if not banner:
        return Response({"message": "Không tìm thấy banner"}, status=status.HTTP_404_NOT_FOUND)
    banner.IsActive = bool(is_active)
    banner.save(update_fields=["IsActive"])
    # Kiểm tra conflict: cùng page đang có banner active khác
    conflict = None
    if is_active:
        dup = Banner.objects.filter(IsActive=True, Page=banner.Page).exclude(BannerID=banner_id).first()
        if dup:
            page_label = {"all": "tất cả trang", "home": "trang chủ", "product": "trang sản phẩm", "blog": "trang blog"}.get(banner.Page, banner.Page)
            conflict = f"Đã có banner khác (#{dup.BannerID} – {dup.Title or 'không tên'}) đang hiển thị tại {page_label}. Banner cũ sẽ bị thay thế hiển thị."
    action = "Kích hoạt" if is_active else "Vô hiệu hóa"
    _write_log(request, None, "update_banner", f"{action} banner #{banner_id}")
    return Response({"message": f"{action} banner thành công", "is_active": banner.IsActive, "conflict_warning": conflict})


# ══════════════════════════════════════════════════════════════
# SEARCH
# ══════════════════════════════════════════════════════════════

@api_view(['GET'])
def search_text(request):
    from .search_engine import get_index, rebuild_index
    q     = (request.query_params.get("q") or "").strip()
    limit = min(int(request.query_params.get("limit", 20) or 20), 100)
    if not q: return Response({"query": "", "results": [], "total": 0, "fallback": False})
    index = get_index()
    if index.N == 0: rebuild_index(); index = get_index()
    ranked = index.score(q, top_k=limit)
    if ranked:
        products = [doc["product"] for _, doc in ranked]
        return Response({"query": q, "results": _serialize_with_ratings(products), "total": len(products), "fallback": False})
    fallback = _get_fallback_products(max_total=4)
    return Response({"query": q, "results": [], "total": 0, "fallback": True, "suggestions": _serialize_with_ratings(fallback)})


@api_view(['POST'])
@parser_classes([MultiPartParser])
def search_image(request):
    from .yolo_search import search_by_image
    img_file = request.FILES.get("file")
    if not img_file: return Response({"error": "Thiếu file ảnh"}, status=400)
    if img_file.size > 10 * 1024 * 1024: return Response({"error": "Ảnh tối đa 10MB"}, status=400)
    pids = search_by_image(img_file.read(), top_k=20)
    if pids:
        products = [p for pid in pids for p in [Product.objects.filter(ProductID=pid).first()] if p]
        if products: return Response({"results": _serialize_with_ratings(products), "total": len(products), "fallback": False})
    fallback = _get_fallback_products(max_total=4)
    return Response({"results": [], "total": 0, "fallback": True, "suggestions": _serialize_with_ratings(fallback), "message": "Không tìm thấy sản phẩm phù hợp với ảnh"})


@api_view(['GET'])
def search_suggestions(request):
    from .search_engine import get_index
    q = (request.query_params.get("q") or "").strip()
    if len(q) < 2: return Response({"suggestions": []})
    ranked = get_index().score(q, top_k=8)
    seen, out = set(), []
    for _, doc in ranked:
        t = doc["title"]
        if t and t not in seen: seen.add(t); out.append({"name": t, "id": doc["id"]})
    return Response({"suggestions": out})


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
def rebuild_search_index(request):
    from .search_engine import rebuild_index, get_version
    v = rebuild_index()
    return Response({"ok": True, "version": v})


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def search_model_info(request):
    from .yolo_search   import get_model_info
    from .search_engine import get_index, get_version
    idx = get_index()
    return Response({"text_index": {"docs": idx.N, "version": get_version()}, "yolo_model": get_model_info()})


# ══════════════════════════════════════════════════════════════
# PAYMENT — MoMo & VNPay
# ══════════════════════════════════════════════════════════════

# Dùng config từ settings.py — KHÔNG hardcode secret ở đây
from django.conf import settings as _payment_settings
MOMO_CONFIG  = _payment_settings.MOMO_CONFIG
VNPAY_CONFIG = _payment_settings.VNPAY_CONFIG


def _call_momo_api(order_id, amount) -> str | None:
    """
    Gọi MoMo captureWallet API, trả về payUrl hoặc None nếu lỗi.

    Các fix so với phiên bản cũ:
    1. orderId dùng uuid4 thay time.time() → tránh trùng khi gọi nhanh
    2. amount là str (MoMo v2 yêu cầu string trong JSON nhưng integer trong raw)
    3. storeId thêm vào để MoMo nhận diện đúng merchant
    4. Log đầy đủ resultCode + message + orderId để debug dễ hơn
    """
    import hmac as _hmac, hashlib as _hashlib, uuid as _uuid, urllib.request as _urllib_req
    try:
        partner_code = MOMO_CONFIG["partner_code"]
        access_key   = MOMO_CONFIG["access_key"]
        secret_key   = MOMO_CONFIG["secret_key"]
        endpoint     = MOMO_CONFIG["endpoint"]
        redirect_url = MOMO_CONFIG["redirect_url"]
        ipn_url      = MOMO_CONFIG["ipn_url"]

        request_id   = str(_uuid.uuid4())
        # [FIX #1] orderId dùng uuid thay time.time() — tránh trùng khi retry
        momo_order_id = f"{order_id}-{str(_uuid.uuid4())[:8]}"
        order_info   = f"Thanh toan don hang #{order_id}"
        extra_data   = ""
        # [FIX #2] amount phải là integer khi ký, string khi gửi JSON
        amt_int      = int(float(str(amount)))

        # Raw string — đúng thứ tự alphabet, không có space
        raw = (
            f"accessKey={access_key}"
            f"&amount={amt_int}"
            f"&extraData={extra_data}"
            f"&ipnUrl={ipn_url}"
            f"&orderId={momo_order_id}"
            f"&orderInfo={order_info}"
            f"&partnerCode={partner_code}"
            f"&redirectUrl={redirect_url}"
            f"&requestId={request_id}"
            f"&requestType=captureWallet"
        )
        sig = _hmac.new(
            secret_key.encode("utf-8"),
            raw.encode("utf-8"),
            _hashlib.sha256,
        ).hexdigest()

        payload = json.dumps({
            "partnerCode": partner_code,
            "accessKey":   access_key,
            "requestId":   request_id,
            "amount":      str(amt_int),   # [FIX #2] string theo MoMo v2 JSON spec
            "orderId":     momo_order_id,
            "orderInfo":   order_info,
            "redirectUrl": redirect_url,
            "ipnUrl":      ipn_url,
            "extraData":   extra_data,
            "requestType": "captureWallet",
            "signature":   sig,
            "lang":        "vi",
        }, ensure_ascii=False).encode("utf-8")

        req = _urllib_req.Request(
            endpoint, data=payload,
            headers={"Content-Type": "application/json; charset=utf-8"},
        )
        with _urllib_req.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode("utf-8"))

        rc = data.get("resultCode", -1)
        if rc == 0:
            logger.info(f"[MoMo] OK orderId={momo_order_id} payUrl={data.get('payUrl','')[:60]}")
            return data.get("payUrl")
        else:
            # Log chi tiết để debug
            logger.error(
                f"[MoMo] FAILED orderId={momo_order_id} "
                f"resultCode={rc} message={data.get('message')} "
                f"localMessage={data.get('localMessage')}"
            )
            return None

    except Exception as e:
        logger.error(f"[MoMo] Exception order={order_id}: {e}")
        return None


@api_view(['POST'])
def momo_create(request):
    """Endpoint riêng để tạo lại MoMo URL (dùng khi URL cũ hết hạn)."""
    order_id = request.data.get("order_id")
    amount   = request.data.get("amount")
    if not order_id or not amount:
        return Response({"message": "Thiếu order_id hoặc amount"}, status=status.HTTP_400_BAD_REQUEST)
    pay_url = _call_momo_api(order_id, amount)
    if pay_url:
        return Response({"pay_url": pay_url}, status=status.HTTP_200_OK)
    return Response({"message": "Không thể kết nối MoMo. Vui lòng thử lại."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def momo_ipn(request):
    """
    MoMo gọi IPN này sau khi người dùng thanh toán xong.
    orderId từ MoMo = "{OrderID}-{uuid8}" → tách lấy phần trước dấu '-' đầu tiên.
    resultCode là integer trong IPN payload.
    """
    result_code = request.data.get("resultCode")
    momo_order_id = request.data.get("orderId", "")
    # Tách real OrderID: "42-a1b2c3d4" → "42"
    real_order_id = momo_order_id.split("-")[0] if momo_order_id else ""

    logger.info(f"[MoMo IPN] resultCode={result_code} orderId={momo_order_id} realOrderId={real_order_id}")

    # [FIX] resultCode là int trong IPN
    if str(result_code) == "0" and real_order_id:
        try:
            o = Order.objects.filter(OrderID=real_order_id).first()
            if o:
                try:
                    o.PaymentMethod = "momo"
                    o.save(update_fields=["PaymentMethod"])
                except Exception:
                    pass
                logger.info(f"[MoMo IPN] Order #{real_order_id} đã thanh toán thành công")
        except Exception as e:
            logger.error(f"[MoMo IPN] Lỗi cập nhật order: {e}")

    # MoMo yêu cầu trả về 200 luôn để tắt retry
    return Response({"message": "IPN received"}, status=status.HTTP_200_OK)


@api_view(['GET'])
def momo_return(request):
    """
    MoMo redirect người dùng về đây sau khi thanh toán.
    Thay vì trả JSON (người dùng thấy màn hình trắng),
    redirect ngay về frontend với các query params để React xử lý.

    URL frontend nhận: /payment/momo-return?success=true&order_id=42
    """
    from django.http import HttpResponseRedirect
    result_code   = request.query_params.get("resultCode", "-1")
    momo_order_id = request.query_params.get("orderId", "")
    message       = request.query_params.get("message", "")

    # Tách real OrderID: "42-a1b2c3d4" → "42"
    real_order_id = momo_order_id.split("-")[0] if momo_order_id else ""

    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")

    if result_code == "0":
        # Thanh toán thành công → về trang đơn hàng
        redirect_url = f"{frontend_url}/payment/momo-return?success=true&order_id={real_order_id}"
    else:
        # Thất bại/hủy → về trang payment với thông báo lỗi
        import urllib.parse
        err_msg = urllib.parse.quote(message or "Thanh toán thất bại hoặc bị hủy")
        redirect_url = f"{frontend_url}/payment/momo-return?success=false&order_id={real_order_id}&message={err_msg}"

    logger.info(f"[MoMo Return] resultCode={result_code} orderId={momo_order_id} → redirect {redirect_url}")
    return HttpResponseRedirect(redirect_url)


@api_view(['POST'])
def vnpay_create(request):
    import hmac, hashlib, urllib.parse
    order_id = request.data.get("order_id"); amount = request.data.get("amount")
    if not order_id or not amount:
        return Response({"message": "Thiếu order_id hoặc amount"}, status=status.HTTP_400_BAD_REQUEST)
    # [FIX] Dùng GMT+7 cho vnp_CreateDate theo yêu cầu VNPAY
    import pytz
    tz_vn   = pytz.timezone("Asia/Ho_Chi_Minh")
    now     = datetime.datetime.now(tz_vn)
    txn_ref = f"{order_id}-{int(now.timestamp())}"
    params  = {
        "vnp_Version":    "2.1.0",
        "vnp_Command":    "pay",
        "vnp_TmnCode":    VNPAY_CONFIG["tmn_code"],
        "vnp_Amount":     str(int(float(amount)) * 100),
        "vnp_CurrCode":   "VND",
        "vnp_TxnRef":     txn_ref,
        "vnp_OrderInfo":  f"Thanh toan don hang {order_id}",
        "vnp_OrderType":  "other",
        "vnp_Locale":     "vn",
        "vnp_ReturnUrl":  VNPAY_CONFIG["return_url"],
        "vnp_IpAddr":     request.META.get("REMOTE_ADDR", "127.0.0.1"),
        "vnp_CreateDate": now.strftime("%Y%m%d%H%M%S"),
        "vnp_ExpireDate": (now + datetime.timedelta(minutes=15)).strftime("%Y%m%d%H%M%S"),
    }
    # [FIX] Theo tài liệu chính thức VNPAY (PHP demo):
    # - Sort params theo alphabet
    # - Cả hashData lẫn queryString đều dùng urlencode (quote_plus) cho cả KEY lẫn VALUE
    # - vnp_Command phải là "pay" (không phải "default")
    sorted_params = sorted(params.items())
    hash_data = ""
    query_str = ""
    for i, (k, v) in enumerate(sorted_params):
        sep = "&" if i > 0 else ""
        encoded_k = urllib.parse.quote_plus(str(k))
        encoded_v = urllib.parse.quote_plus(str(v))
        hash_data += f"{sep}{encoded_k}={encoded_v}"
        query_str += f"{sep}{encoded_k}={encoded_v}"
    sig     = hmac.new(
        VNPAY_CONFIG["hash_secret"].encode("utf-8"),
        hash_data.encode("utf-8"),
        hashlib.sha512
    ).hexdigest()
    pay_url = f"{VNPAY_CONFIG['url']}?{query_str}&vnp_SecureHash={sig}"
    return Response({"pay_url": pay_url}, status=status.HTTP_200_OK)


@api_view(['GET'])
def vnpay_return(request):
    import hmac, hashlib, urllib.parse
    params   = dict(request.query_params); vnp_hash = params.pop("vnp_SecureHash", [""])[0]
    params.pop("vnp_SecureHashType", None)
    flat     = {k: v[0] if isinstance(v, list) else v for k, v in params.items()}
    sorted_p = sorted(flat.items()); query_str = urllib.parse.urlencode(sorted_p)
    expected = hmac.new(VNPAY_CONFIG["hash_secret"].encode("utf-8"), query_str.encode("utf-8"), hashlib.sha512).hexdigest()
    if vnp_hash != expected: return Response({"success": False, "message": "Chữ ký không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    code = flat.get("vnp_ResponseCode", "99"); txn_ref = flat.get("vnp_TxnRef", ""); order_id = txn_ref.split("-")[0] if "-" in txn_ref else txn_ref
    if code == "00": return Response({"success": True, "order_id": order_id, "message": "Thanh toán thành công"})
    return Response({"success": False, "order_id": order_id, "message": "Thanh toán thất bại"})


# ══════════════════════════════════════════════════════════════
# DASHBOARD
# ══════════════════════════════════════════════════════════════

def _revenue_qs():
    return Order.objects.filter(Status="Delivered")


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def dashboard_overview(request):
    today = tz.localdate(); qs = _revenue_qs()
    def rev(qs): return float(qs.aggregate(s=Coalesce(Sum("TotalAmount"), 0, output_field=DecimalField()))["s"])
    today_rev  = rev(qs.filter(OrderDate__date=today))
    month_rev  = rev(qs.filter(OrderDate__year=today.year, OrderDate__month=today.month))
    year_rev   = rev(qs.filter(OrderDate__year=today.year))
    total_rev  = rev(qs)
    yesterday  = today - datetime.timedelta(days=1)
    last_month = (today.replace(day=1) - datetime.timedelta(days=1))
    yesterday_rev  = rev(qs.filter(OrderDate__date=yesterday))
    last_month_rev = rev(qs.filter(OrderDate__year=last_month.year, OrderDate__month=last_month.month))
    last_year_rev  = rev(qs.filter(OrderDate__year=today.year - 1))
    def pct(current, previous): return None if previous == 0 else round((current - previous) / previous * 100, 1)
    return Response({"today": {"revenue": today_rev, "orders": qs.filter(OrderDate__date=today).count(), "vs_yesterday": pct(today_rev, yesterday_rev)}, "this_month": {"revenue": month_rev, "orders": qs.filter(OrderDate__year=today.year, OrderDate__month=today.month).count(), "vs_last_month": pct(month_rev, last_month_rev)}, "this_year": {"revenue": year_rev, "vs_last_year": pct(year_rev, last_year_rev)}, "all_time": {"revenue": total_rev, "orders": qs.count()}})


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def dashboard_revenue_by_day(request):
    today = tz.localdate(); year = int(request.query_params.get("year", today.year)); month = int(request.query_params.get("month", today.month))
    qs   = _revenue_qs().filter(OrderDate__year=year, OrderDate__month=month)
    rows = qs.annotate(day=TruncDay("OrderDate")).values("day").annotate(revenue=Sum("TotalAmount"), orders=Count("OrderID")).order_by("day")
    first_this = datetime.date(year, month, 1); first_prev = (first_this - datetime.timedelta(days=1)).replace(day=1)
    prev_rows  = {r["day"].day: float(r["revenue"]) for r in _revenue_qs().filter(OrderDate__year=first_prev.year, OrderDate__month=first_prev.month).annotate(day=TruncDay("OrderDate")).values("day").annotate(revenue=Sum("TotalAmount"))}
    result = [{"date": r["day"].strftime("%Y-%m-%d"), "day": r["day"].day, "revenue": float(r["revenue"]), "orders": r["orders"], "prev_revenue": prev_rows.get(r["day"].day, 0)} for r in rows]
    return Response({"year": year, "month": month, "data": result})


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def dashboard_revenue_by_month(request):
    today = tz.localdate(); year = int(request.query_params.get("year", today.year))
    qs    = _revenue_qs().filter(OrderDate__year=year)
    rows  = qs.annotate(month=TruncMonth("OrderDate")).values("month").annotate(revenue=Sum("TotalAmount"), orders=Count("OrderID")).order_by("month")
    prev_rows = {r["month"].month: float(r["revenue"]) for r in _revenue_qs().filter(OrderDate__year=year - 1).annotate(month=TruncMonth("OrderDate")).values("month").annotate(revenue=Sum("TotalAmount"))}
    result = [{"month": r["month"].month, "label": f"T{r['month'].month}/{year}", "revenue": float(r["revenue"]), "orders": r["orders"], "prev_revenue": prev_rows.get(r["month"].month, 0)} for r in rows]
    return Response({"year": year, "data": result})


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def dashboard_revenue_by_year(request):
    rows   = _revenue_qs().annotate(year=TruncYear("OrderDate")).values("year").annotate(revenue=Sum("TotalAmount"), orders=Count("OrderID")).order_by("year")
    result = [{"year": r["year"].year, "revenue": float(r["revenue"]), "orders": r["orders"]} for r in rows]
    return Response({"data": result})


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def dashboard_revenue_by_product(request):
    today = tz.localdate(); limit = int(request.query_params.get("limit", 20))
    year  = request.query_params.get("year"); month = request.query_params.get("month")
    qs    = OrderDetail.objects.filter(OrderID__Status="Delivered")
    if year:  qs = qs.filter(OrderID__OrderDate__year=int(year))
    if month: qs = qs.filter(OrderID__OrderDate__month=int(month))
    rows = qs.values(product_id=F("VariantID__ProductID__ProductID"), product_name=F("VariantID__ProductID__ProductName")).annotate(revenue=Sum(ExpressionWrapper(F("UnitPrice") * F("Quantity"), output_field=FloatField())), qty_sold=Sum("Quantity"), order_count=Count("OrderID", distinct=True)).order_by("-revenue")[:limit]
    result = []
    for r in rows:
        pid = r["product_id"]; img = ""
        primary = ProductImage.objects.filter(ProductID=pid, IsPrimary=True).first()
        if primary: img = primary.ImageUrl or ""
        result.append({"product_id": pid, "product_name": r["product_name"], "revenue": float(r["revenue"] or 0), "qty_sold": r["qty_sold"] or 0, "order_count": r["order_count"] or 0, "image": img})
    return Response({"data": result})


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def dashboard_revenue_by_brand(request):
    year  = request.query_params.get("year"); month = request.query_params.get("month")
    qs    = OrderDetail.objects.filter(OrderID__Status="Delivered")
    if year:  qs = qs.filter(OrderID__OrderDate__year=int(year))
    if month: qs = qs.filter(OrderID__OrderDate__month=int(month))
    rows  = qs.values(brand=F("VariantID__ProductID__Brand")).annotate(revenue=Sum(ExpressionWrapper(F("UnitPrice") * F("Quantity"), output_field=FloatField())), qty_sold=Sum("Quantity"), order_count=Count("OrderID", distinct=True), product_count=Count("VariantID__ProductID", distinct=True)).order_by("-revenue")
    total_rev = sum(float(r["revenue"] or 0) for r in rows)
    result = [{"brand": r["brand"] or "Không rõ", "revenue": float(r["revenue"] or 0), "qty_sold": r["qty_sold"] or 0, "order_count": r["order_count"] or 0, "product_count": r["product_count"] or 0, "share_pct": round(float(r["revenue"] or 0) / total_rev * 100, 1) if total_rev else 0} for r in rows]
    return Response({"data": result})


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def dashboard_revenue_compare(request):
    mode  = request.query_params.get("mode", "month"); values = request.query_params.get("values", "")
    items = [v.strip() for v in values.split(",") if v.strip()]
    result = []
    for item in items:
        qs = _revenue_qs(); label = item
        try:
            if mode == "day":
                d  = datetime.date.fromisoformat(item); qs = qs.filter(OrderDate__date=d)
            elif mode == "month":
                y, m = item.split("-"); qs = qs.filter(OrderDate__year=int(y), OrderDate__month=int(m)); label = f"T{m}/{y}"
            elif mode == "year":
                qs = qs.filter(OrderDate__year=int(item))
        except: continue
        agg = qs.aggregate(revenue=Coalesce(Sum("TotalAmount"), 0, output_field=DecimalField()), orders=Count("OrderID"))
        result.append({"label": label, "revenue": float(agg["revenue"]), "orders": agg["orders"]})
    return Response({"mode": mode, "data": result})


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def dashboard_revenue_by_category(request):
    year  = request.query_params.get("year")
    month = request.query_params.get("month")
    qs    = OrderDetail.objects.filter(OrderID__Status="Delivered")
    if year:  qs = qs.filter(OrderID__OrderDate__year=int(year))
    if month: qs = qs.filter(OrderID__OrderDate__month=int(month))
    rows  = qs.values(
        category_id=F("VariantID__ProductID__CategoryID__CategoryID"),
        category_name=F("VariantID__ProductID__CategoryID__CategoryName"),
    ).annotate(
        revenue=Sum(ExpressionWrapper(F("UnitPrice") * F("Quantity"), output_field=FloatField())),
        qty_sold=Sum("Quantity"),
        order_count=Count("OrderID", distinct=True),
        product_count=Count("VariantID__ProductID", distinct=True),
    ).order_by("-revenue")
    total_rev = sum(float(r["revenue"] or 0) for r in rows)
    result = [{
        "category_id":   r["category_id"],
        "category_name": r["category_name"] or "Không rõ",
        "revenue":       float(r["revenue"] or 0),
        "qty_sold":      r["qty_sold"] or 0,
        "order_count":   r["order_count"] or 0,
        "product_count": r["product_count"] or 0,
        "share_pct":     round(float(r["revenue"] or 0) / total_rev * 100, 1) if total_rev else 0,
    } for r in rows]
    return Response({"data": result})


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def dashboard_order_stats(request):
    year  = request.query_params.get("year")
    month = request.query_params.get("month")
    day   = request.query_params.get("day")
    qs = Order.objects.all()
    if year:  qs = qs.filter(OrderDate__year=int(year))
    if month: qs = qs.filter(OrderDate__month=int(month))
    if day:   qs = qs.filter(OrderDate__day=int(day))
    rows  = qs.values("Status").annotate(count=Count("OrderID"))
    stats = {r["Status"]: r["count"] for r in rows}
    return Response({
        "Pending":    stats.get("Pending", 0),
        "Processing": stats.get("Processing", 0),
        "Shipping":   stats.get("Shipping", 0),
        "Delivered":  stats.get("Delivered", 0),
        "Cancelled":  stats.get("Cancelled", 0),
        "total":      sum(stats.values()),
    })


# ══════════════════════════════════════════════════════════════
# HOME
# ══════════════════════════════════════════════════════════════

@api_view(['GET'])
def home_featured(request):
    limit = int(request.query_params.get('limit', 12))
    qs    = Product.objects.select_related('CategoryID').order_by('-CreatedAt')[:limit]
    return Response({"products": _serialize_with_ratings(list(qs))}, status=status.HTTP_200_OK)


@api_view(['GET'])
def home_best_sellers(request):
    limit = int(request.query_params.get('limit', 8))
    sold_pids = (
        OrderDetail.objects
        .filter(OrderID__Status__in=['Delivered', 'Shipping', 'Processing'])
        .values('VariantID__ProductID')
        .annotate(total_sold=Sum('Quantity'))
        .order_by('-total_sold')
        .values_list('VariantID__ProductID', flat=True)[:limit * 2]
    )
    products = list(Product.objects.filter(ProductID__in=sold_pids))
    id_order = {pid: i for i, pid in enumerate(sold_pids)}
    products = sorted(products, key=lambda p: id_order.get(p.ProductID, 999))[:limit]
    return Response({"products": _serialize_with_ratings(products)}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════
# ADMIN — Customers
# ══════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def admin_list_customers(request):
    customers = Customer.objects.all().order_by('-CustomerID')
    data = [{"id": c.CustomerID, "full_name": c.FullName, "email": c.Email, "phone": c.PhoneNumber or "", "address": c.Address or "", "login_type": c.LoginType, "order_count": Order.objects.filter(CustomerID=c.CustomerID).count(), "total_spent": float(Order.objects.filter(CustomerID=c.CustomerID, Status='Delivered').aggregate(s=Sum('TotalAmount'))['s'] or 0)} for c in customers]
    return Response({"customers": data}, status=status.HTTP_200_OK)

# ══════════════════════════════════════════════════════════════
# ACTIVITY LOG HELPER
# ══════════════════════════════════════════════════════════════

def _get_staff_from_request(request):
    """Decode token để lấy Staff object. Trả về None nếu không xác định được."""
    try:
        import jwt as pyjwt
        from django.conf import settings as _settings
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth.startswith("Bearer "):
            return None
        raw     = auth.split(" ", 1)[1].strip()
        payload = pyjwt.decode(raw, _settings.SECRET_KEY, algorithms=["HS256"])
        staff_id = payload.get("staff_id")
        if staff_id:
            return Staff.objects.filter(StaffID=staff_id).first()
    except Exception:
        pass
    return None


# ══════════════════════════════════════════════════════════════
# VIDEO URL HELPER — chuẩn hóa YouTube / Google Drive URL
# ══════════════════════════════════════════════════════════════
import re as _re

def _normalize_video_url(url: str) -> str:
    """
    Nhận URL YouTube hoặc Google Drive, trả về URL embed chuẩn.
    Trả về "" nếu URL không hợp lệ.

    YouTube:
      https://youtu.be/VIDEO_ID
      https://www.youtube.com/watch?v=VIDEO_ID
      https://www.youtube.com/embed/VIDEO_ID  (đã là embed)
      → https://www.youtube.com/embed/VIDEO_ID?autoplay=0&rel=0

    Google Drive:
      https://drive.google.com/file/d/FILE_ID/view
      https://drive.google.com/open?id=FILE_ID
      → https://drive.google.com/file/d/FILE_ID/preview
    """
    url = url.strip()
    if not url:
        return ""

    # YouTube — youtu.be short link
    m = _re.match(r"https?://youtu\.be/([A-Za-z0-9_-]{11})", url)
    if m:
        return f"https://www.youtube.com/embed/{m.group(1)}?rel=0"

    # YouTube — watch?v=
    m = _re.search(r"youtube\.com/watch\?.*v=([A-Za-z0-9_-]{11})", url)
    if m:
        return f"https://www.youtube.com/embed/{m.group(1)}?rel=0"

    # YouTube — đã là embed
    m = _re.match(r"https?://(?:www\.)?youtube\.com/embed/([A-Za-z0-9_-]{11})", url)
    if m:
        return f"https://www.youtube.com/embed/{m.group(1)}?rel=0"

    # YouTube — shorts
    m = _re.match(r"https?://(?:www\.)?youtube\.com/shorts/([A-Za-z0-9_-]{11})", url)
    if m:
        return f"https://www.youtube.com/embed/{m.group(1)}?rel=0"

    # Google Drive — /file/d/FILE_ID/
    m = _re.search(r"drive\.google\.com/file/d/([A-Za-z0-9_-]+)", url)
    if m:
        return f"https://drive.google.com/file/d/{m.group(1)}/preview"

    # Google Drive — open?id= hoặc uc?id=
    m = _re.search(r"drive\.google\.com/(?:open|uc)\?(?:.*&)?id=([A-Za-z0-9_-]+)", url)
    if m:
        return f"https://drive.google.com/file/d/{m.group(1)}/preview"

    return ""  # không nhận dạng được


def _write_log(request, staff_obj, action: str, detail: str = ""):
    """
    Ghi 1 dòng ActivityLog.
    - staff_obj: truyền trực tiếp nếu đã có (VD: admin_login).
    - Nếu None, tự decode từ token.
    """
    try:
        if staff_obj is None:
            staff_obj = _get_staff_from_request(request)
        ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR", "")
        )
        ActivityLog.objects.create(
            StaffID=staff_obj,
            Action=action,
            Detail=detail[:500],
            IPAddress=ip[:45],
        )
    except Exception as e:
        logger.warning(f"[ActivityLog] write failed: {e}")


def _write_customer_log(request, customer_id, action: str, detail: str = ""):
    """
    Ghi 1 dòng CustomerActivityLog.
    - customer_id: CustomerID string hoặc Customer instance.
    - action: một trong ACTION_CHOICES của CustomerActivityLog.
    - detail: mô tả chi tiết (tối đa 500 ký tự), nên dùng JSON string.
    """
    try:
        if isinstance(customer_id, Customer):
            customer_obj = customer_id
        elif customer_id:
            customer_obj = Customer.objects.filter(CustomerID=customer_id).first()
        else:
            customer_obj = None

        ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR", "")
        )
        ua = request.META.get("HTTP_USER_AGENT", "")[:300]

        CustomerActivityLog.objects.create(
            CustomerID=customer_obj,
            Action=action,
            Detail=str(detail)[:500],
            IPAddress=ip[:45],
            UserAgent=ua,
        )
    except Exception as e:
        logger.warning(f"[CustomerActivityLog] write failed: {e}")


# ══════════════════════════════════════════════════════════════
# ACTIVITY LOG VIEWS
# ══════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════
# CUSTOMER ACTIVITY LOG VIEWS
# ══════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def list_customer_activity_logs(request):
    """
    GET /api/customer-log/list/
    Query params:
      - customer_id  : lọc theo khách hàng (optional)
      - action       : lọc theo hành động (optional)
      - page         : trang (default 1)
      - page_size    : số dòng/trang (default 50, max 200)
    """
    from .models import CustomerActivityLog
    customer_id = request.query_params.get("customer_id")
    action      = request.query_params.get("action")
    try:
        page      = max(1, int(request.query_params.get("page", 1)))
        page_size = min(200, max(1, int(request.query_params.get("page_size", 50))))
    except (ValueError, TypeError):
        page, page_size = 1, 50

    qs = CustomerActivityLog.objects.select_related("CustomerID").order_by("-CreatedAt")
    if customer_id:
        qs = qs.filter(CustomerID=customer_id)
    if action:
        qs = qs.filter(Action=action)

    total  = qs.count()
    offset = (page - 1) * page_size
    logs   = qs[offset: offset + page_size]

    result = []
    for log in logs:
        cust = log.CustomerID
        result.append({
            "id":          log.LogID,
            "customer_id": cust.CustomerID if cust else None,
            "full_name":   cust.FullName   if cust else "Đã xóa",
            "email":       cust.Email      if cust else "",
            "action":      log.Action,
            "action_label": dict(CustomerActivityLog.ACTION_CHOICES).get(log.Action, log.Action),
            "detail":      log.Detail,
            "ip":          log.IPAddress,
            "user_agent":  log.UserAgent,
            "created_at":  log.CreatedAt.isoformat() if log.CreatedAt else "",
        })

    return Response({
        "logs":      result,
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     (total + page_size - 1) // page_size,
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticatedCustomer])
def get_my_activity_log(request):
    """
    GET /api/customer-log/me/
    Query params:
      - customer_id : bắt buộc
      - page        : trang (default 1)
      - page_size   : số dòng/trang (default 20, max 100)
    Khách hàng chỉ xem được log của chính mình.
    """
    from .models import CustomerActivityLog
    customer_id = request.query_params.get("customer_id")
    if not customer_id:
        return Response({"message": "Thiếu customer_id"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        page      = max(1, int(request.query_params.get("page", 1)))
        page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
    except (ValueError, TypeError):
        page, page_size = 1, 20

    qs     = CustomerActivityLog.objects.filter(CustomerID=customer_id).order_by("-CreatedAt")
    total  = qs.count()
    offset = (page - 1) * page_size
    logs   = qs[offset: offset + page_size]

    result = [{
        "id":          log.LogID,
        "action":      log.Action,
        "action_label": dict(CustomerActivityLog.ACTION_CHOICES).get(log.Action, log.Action),
        "detail":      log.Detail,
        "created_at":  log.CreatedAt.isoformat() if log.CreatedAt else "",
    } for log in logs]

    return Response({
        "logs":      result,
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     (total + page_size - 1) // page_size,
    }, status=status.HTTP_200_OK)


@api_view(["DELETE", "POST"])
@permission_classes([IsAdminOnly])
def clear_customer_activity_logs(request):
    """
    POST /api/customer-log/clear/
    Body: { "customer_id": "KH001" }  → xóa log của 1 khách
    Body: {}                           → xóa toàn bộ (cẩn thận!)
    """
    from .models import CustomerActivityLog
    customer_id = request.data.get("customer_id")
    if customer_id:
        deleted, _ = CustomerActivityLog.objects.filter(CustomerID=customer_id).delete()
        return Response({"message": f"Đã xóa {deleted} bản ghi của khách {customer_id}"},
                        status=status.HTTP_200_OK)
    deleted, _ = CustomerActivityLog.objects.all().delete()
    return Response({"message": f"Đã xóa toàn bộ {deleted} bản ghi log khách hàng"},
                    status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def customer_activity_stats(request):
    """
    GET /api/customer-log/stats/
    Thống kê số lượt theo từng action trong 30 ngày gần nhất.
    """
    from .models import CustomerActivityLog
    from django.utils import timezone as _tz
    import datetime as _dt

    since = _tz.now() - _dt.timedelta(days=30)
    qs = (
        CustomerActivityLog.objects
        .filter(CreatedAt__gte=since)
        .values("Action")
        .annotate(count=Count("LogID"))
        .order_by("-count")
    )
    labels = dict(CustomerActivityLog.ACTION_CHOICES)
    result = [
        {"action": row["Action"], "label": labels.get(row["Action"], row["Action"]), "count": row["count"]}
        for row in qs
    ]
    return Response({"stats": result, "period_days": 30}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAdminOnly])
def list_activity_logs(request):
    """
    Lấy danh sách log, chỉ Admin.
    Query params:
      page     – trang (default 1)
      per_page – số dòng/trang (default 50, max 200)
      action   – lọc theo loại hành động (tuỳ chọn)
      staff_id – lọc theo nhân viên (tuỳ chọn)
      q        – tìm kiếm trong Detail (tuỳ chọn)
    """
    page     = max(1, int(request.query_params.get("page", 1)))
    per_page = min(200, max(1, int(request.query_params.get("per_page", 50))))
    action   = request.query_params.get("action", "").strip()
    staff_id = request.query_params.get("staff_id", "").strip()
    q        = request.query_params.get("q", "").strip()

    qs = ActivityLog.objects.select_related("StaffID").all()
    if action:
        qs = qs.filter(Action=action)
    if staff_id:
        qs = qs.filter(StaffID=staff_id)
    if q:
        qs = qs.filter(Detail__icontains=q)

    total  = qs.count()
    offset = (page - 1) * per_page
    logs   = qs[offset: offset + per_page]

    data = []
    for log in logs:
        staff = log.StaffID
        data.append({
            "id":         log.LogID,
            "staff_id":   staff.StaffID   if staff else None,
            "staff_name": staff.FullName  if staff else "Không xác định",
            "staff_role": staff.Role      if staff else "",
            "action":     log.Action,
            "detail":     log.Detail,
            "ip":         log.IPAddress,
            # [FIX #TIMESTAMP] Bảo vệ khi CreatedAt=None hoặc aware datetime lỗi
            "created_at": (
                log.CreatedAt.strftime("%Y-%m-%d %H:%M:%S")
                if log.CreatedAt else ""
            ),
        })

    # Danh sách action để filter trên frontend
    action_choices = [
        {"value": a[0], "label": a[1]}
        for a in ActivityLog.ACTION_CHOICES
    ]

    return Response({
        "logs":           data,
        "total":          total,
        "page":           page,
        "per_page":       per_page,
        "total_pages":    (total + per_page - 1) // per_page,
        "action_choices": action_choices,
    })


@api_view(["POST"])
@permission_classes([IsAdminOnly])
def clear_activity_logs(request):
    """Xóa toàn bộ log (chỉ Admin). Cẩn thận — không thể phục hồi."""
    count, _ = ActivityLog.objects.all().delete()
    _write_log(request, None, "login", f"Đã xóa toàn bộ {count} dòng log")
    return Response({"message": f"Đã xóa {count} dòng log"})


# ══════════════════════════════════════════════════════════════
# BANNER
# ══════════════════════════════════════════════════════════════

def _serialize_banner(banner):
    items = banner.items.all().order_by("SortOrder", "BannerItemID")
    return {
        "id":        banner.BannerID,
        "title":     banner.Title,
        "page":      banner.Page,
        "is_active": banner.IsActive,
        "auto_play": banner.AutoPlay,
        "interval":  banner.Interval,
        "items": [
            {
                "id":         item.BannerItemID,
                "media_type": item.MediaType,
                "media_url":  item.MediaUrl,
                "public_id":  item.PublicID,
                "link_url":   item.LinkUrl,
                "caption":    item.Caption,
                "video_mode": item.VideoMode,
                "sort_order": item.SortOrder,
            }
            for item in items
        ],
    }


@api_view(["GET"])
def get_active_banner(request):
    page = request.query_params.get("page", "all")
    # Ưu tiên banner cho trang cụ thể, fallback về "all"
    banner = Banner.objects.filter(IsActive=True, Page=page).order_by("-BannerID").first()
    if not banner and page != "all":
        banner = Banner.objects.filter(IsActive=True, Page="all").order_by("-BannerID").first()
    if not banner:
        return Response({"banner": None})
    return Response({"banner": _serialize_banner(banner)})


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def list_banners(request):
    banners = Banner.objects.all().order_by("-BannerID")
    return Response({"banners": [_serialize_banner(b) for b in banners]})


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def create_banner(request):
    title     = request.data.get("title", "").strip()
    page      = request.data.get("page", "all")
    is_active = request.data.get("is_active", True)
    auto_play = request.data.get("auto_play", True)
    interval  = int(request.data.get("interval", 4000))
    if page not in ("all", "home", "product", "blog"):
        return Response({"message": "page không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    banner = Banner.objects.create(
        Title=title, Page=page, IsActive=bool(is_active),
        AutoPlay=bool(auto_play), Interval=max(1000, min(interval, 30000)),
    )
    _write_log(request, None, "create_banner", f"Tạo banner: {title or f'#{banner.BannerID}'}")
    return Response({"message": "Tạo banner thành công", "banner": _serialize_banner(banner)}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def update_banner(request):
    banner = Banner.objects.filter(BannerID=request.data.get("id")).first()
    if not banner:
        return Response({"message": "Không tìm thấy banner"}, status=status.HTTP_404_NOT_FOUND)
    if "title"     in request.data: banner.Title    = request.data["title"].strip()
    if "page"      in request.data: banner.Page     = request.data["page"]
    if "is_active" in request.data: banner.IsActive = bool(request.data["is_active"])
    if "auto_play" in request.data: banner.AutoPlay = bool(request.data["auto_play"])
    if "interval"  in request.data: banner.Interval = max(1000, min(int(request.data["interval"]), 30000))
    banner.save()
    _write_log(request, None, "update_banner", f"Sửa banner #{banner.BannerID}: {banner.Title}")
    return Response({"message": "Cập nhật thành công", "banner": _serialize_banner(banner)})


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def delete_banner(request):
    banner = Banner.objects.filter(BannerID=request.data.get("id")).first()
    if not banner:
        return Response({"message": "Không tìm thấy banner"}, status=status.HTTP_404_NOT_FOUND)
    bid = banner.BannerID
    for item in banner.items.all():
        if item.PublicID:
            try:
                cloudinary.uploader.destroy(item.PublicID,
                    resource_type="video" if item.MediaType == "video" else "image")
            except Exception as e:
                logger.warning(f"[Banner] Cloudinary delete failed: {e}")
    banner.delete()
    _write_log(request, None, "delete_banner", f"Xóa banner #{bid}")
    return Response({"message": "Đã xóa banner"})


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
@parser_classes([MultiPartParser])
def add_banner_item(request):
    banner = Banner.objects.filter(BannerID=request.data.get("banner_id")).first()
    if not banner:
        return Response({"message": "Không tìm thấy banner"}, status=status.HTTP_404_NOT_FOUND)

    file_obj    = request.FILES.get("file")
    video_url   = (request.data.get("video_url") or "").strip()   # [NEW] URL YouTube/GDrive
    media_type  = request.data.get("media_type", "image")

    if media_type not in ("image", "video"):
        return Response({"message": "media_type phải là image hoặc video"}, status=status.HTTP_400_BAD_REQUEST)

    # ── [NEW] Nếu là video URL (YouTube / Google Drive) → không upload Cloudinary ──
    if media_type == "video" and video_url:
        embed_url = _normalize_video_url(video_url)
        if not embed_url:
            return Response({"message": "URL video không hợp lệ. Chỉ hỗ trợ YouTube và Google Drive."}, status=status.HTTP_400_BAD_REQUEST)
        item = BannerItem.objects.create(
            BannerID=banner, MediaType="video",
            MediaUrl=embed_url, PublicID="",
            LinkUrl=request.data.get("link_url", "").strip(),
            Caption=request.data.get("caption", "").strip(),
            VideoMode=request.data.get("video_mode", "autoplay"),
            SortOrder=int(request.data.get("sort_order", 0)),
        )
        _write_log(request, None, "add_banner_item",
                   f"Thêm video URL vào banner #{banner.BannerID}: {embed_url[:60]}")
        return Response({"message": "Đã thêm item", "item": {
            "id": item.BannerItemID, "media_type": item.MediaType,
            "media_url": item.MediaUrl, "public_id": item.PublicID,
            "link_url": item.LinkUrl, "caption": item.Caption,
            "video_mode": item.VideoMode, "sort_order": item.SortOrder,
        }}, status=status.HTTP_201_CREATED)

    # ── Upload file thông thường (ảnh hoặc video nhỏ ≤ 100MB) ──
    if not file_obj:
        return Response({"message": "Vui lòng chọn file hoặc nhập URL video"}, status=status.HTTP_400_BAD_REQUEST)
    limit_mb = 95 if media_type == "video" else 50   # Cloudinary free tối đa 100MB
    if file_obj.size > limit_mb * 1024 * 1024:
        return Response({"message": f"File không được vượt quá {limit_mb}MB. Video lớn hơn hãy dùng URL YouTube/Google Drive."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        upload_result = _upload_to_cloudinary(
            file_obj, enhance="post", folder="sellphone/banners",
            resource_type="video" if media_type == "video" else "image",
            overwrite=False,
        )
    except Exception as e:
        return Response({"message": f"Lỗi upload: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    item = BannerItem.objects.create(
        BannerID=banner, MediaType=media_type,
        MediaUrl=upload_result["secure_url"], PublicID=upload_result["public_id"],
        LinkUrl=request.data.get("link_url", "").strip(),
        Caption=request.data.get("caption", "").strip(),
        VideoMode=request.data.get("video_mode", "autoplay") if media_type == "video" else "autoplay",
        SortOrder=int(request.data.get("sort_order", 0)),
    )
    _write_log(request, None, "add_banner_item",
               f"Thêm {media_type} vào banner #{banner.BannerID} (item #{item.BannerItemID})")
    return Response({"message": "Đã thêm item", "item": {
        "id": item.BannerItemID, "media_type": item.MediaType,
        "media_url": item.MediaUrl, "public_id": item.PublicID,
        "link_url": item.LinkUrl, "caption": item.Caption,
        "video_mode": item.VideoMode, "sort_order": item.SortOrder,
    }}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def update_banner_item(request):
    item = BannerItem.objects.filter(BannerItemID=request.data.get("id")).first()
    if not item:
        return Response({"message": "Không tìm thấy item"}, status=status.HTTP_404_NOT_FOUND)
    if "caption"    in request.data: item.Caption   = request.data["caption"].strip()
    if "link_url"   in request.data: item.LinkUrl   = request.data["link_url"].strip()
    if "video_mode" in request.data: item.VideoMode = request.data["video_mode"]
    if "sort_order" in request.data: item.SortOrder = int(request.data["sort_order"])
    item.save()
    return Response({"message": "Cập nhật item thành công"})


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def delete_banner_item(request):
    item = BannerItem.objects.filter(BannerItemID=request.data.get("id")).first()
    if not item:
        return Response({"message": "Không tìm thấy item"}, status=status.HTTP_404_NOT_FOUND)
    iid = item.BannerItemID
    bid = item.BannerID_id
    if item.PublicID:
        try:
            cloudinary.uploader.destroy(item.PublicID,
                resource_type="video" if item.MediaType == "video" else "image")
        except Exception as e:
            logger.warning(f"[Banner] Cloudinary delete failed: {e}")
    item.delete()
    _write_log(request, None, "delete_banner_item", f"Xóa item #{iid} khỏi banner #{bid}")
    return Response({"message": "Đã xóa item"})


@api_view(["POST"])
@permission_classes([IsAdminOrStaff])
def reorder_banner_items(request):
    order = request.data.get("order", [])
    for idx, item_id in enumerate(order):
        BannerItem.objects.filter(BannerItemID=item_id).update(SortOrder=idx)
    return Response({"message": "Đã cập nhật thứ tự"})
# ══════════════════════════════════════════════════════════════
# [NEW] TÁCH NỀN ẢNH BIẾN THỂ — local rembg (không tốn phí)
# Chỉ áp dụng cho ảnh biến thể (ProductVariant.Image).
# Ảnh gốc ProductImage KHÔNG bị tách nền.
# ══════════════════════════════════════════════════════════════


# ── In-memory job store cho remove-bg tasks ─────────────────
import threading as _threading
_rmbg_jobs = {}
_rmbg_lock  = _threading.Lock()


def _run_remove_bg(job_id: str, raw_bytes: bytes, variant_id, variant_product_id):
    """Chạy rembg trong background thread. Lần đầu download model ~170MB (1 lần duy nhất)."""
    with _rmbg_lock:
        _rmbg_jobs[job_id] = {"status": "pending", "image_url": "", "message": "Đang tách nền..."}
    try:
        try:
            from rembg import remove as rembg_remove, new_session
        except ImportError:
            with _rmbg_lock:
                _rmbg_jobs[job_id] = {"status": "error", "image_url": "", "message": "Chưa cài rembg. Chạy: pip install rembg onnxruntime"}
            return
        from PIL import Image as _PILImage
        try:
            session      = new_session("u2net")
            result_bytes = rembg_remove(raw_bytes, session=session)
        except Exception as e:
            with _rmbg_lock:
                _rmbg_jobs[job_id] = {"status": "error", "image_url": "", "message": f"Lỗi tách nền: {e}"}
            return
        pil_img   = _PILImage.open(io.BytesIO(result_bytes)).convert("RGBA")
        bg_img    = _PILImage.new("RGBA", pil_img.size, (255, 255, 255, 255))
        bg_img.paste(pil_img, mask=pil_img.split()[3])
        final_img = bg_img.convert("RGB")
        out_buf   = io.BytesIO()
        final_img.save(out_buf, format="JPEG", quality=92, optimize=True)
        out_buf.seek(0)
        try:
            result  = _upload_to_cloudinary(
                out_buf, enhance="product",
                folder=f"sellphone/variants/{variant_product_id}",
                public_id=f"variant_{variant_id}_nobg",
                overwrite=True, resource_type="image",
            )
            new_url = result["secure_url"]
        except Exception as e:
            with _rmbg_lock:
                _rmbg_jobs[job_id] = {"status": "error", "image_url": "", "message": f"Lỗi upload: {e}"}
            return
        try:
            v = ProductVariant.objects.filter(VariantID=variant_id).first()
            if v:
                v.Image = new_url
                v.save()
        except Exception as e:
            logger.error(f"[RemoveBg] DB error: {e}")
        try:
            from .yolo_search import train_product_async
            train_product_async(variant_product_id, force=False)
        except Exception:
            pass
        with _rmbg_lock:
            _rmbg_jobs[job_id] = {"status": "done", "image_url": new_url, "message": "Tách nền thành công!"}
        logger.info(f"[RemoveBg] Job {job_id} done")
    except Exception as e:
        logger.error(f"[RemoveBg] Error: {e}")
        with _rmbg_lock:
            _rmbg_jobs[job_id] = {"status": "error", "image_url": "", "message": f"Lỗi: {e}"}


@api_view(['POST'])
@permission_classes([IsAdminOrStaff])
@parser_classes([MultiPartParser])
def variant_remove_bg(request):
    """POST /api/variant/remove-bg/ — Khởi động job async, trả job_id ngay lập tức."""
    variant_id = request.data.get("variant_id")
    if not variant_id:
        return Response({"message": "Thiếu variant_id"}, status=status.HTTP_400_BAD_REQUEST)
    variant = ProductVariant.objects.filter(VariantID=variant_id).first()
    if not variant:
        return Response({"message": "Không tìm thấy biến thể"}, status=status.HTTP_404_NOT_FOUND)
    img_file  = request.FILES.get("image")
    raw_bytes = None
    if img_file:
        raw_bytes = img_file.read()
    elif variant.Image:
        try:
            # Thử requests trước (hỗ trợ redirect + SSL tốt hơn urllib trên Windows)
            try:
                import requests as _req_lib
                _r = _req_lib.get(
                    variant.Image,
                    timeout=30,
                    verify=False,  # bỏ SSL verify — Windows thường lỗi SSL với Cloudinary
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                        "Accept": "image/*,*/*",
                    },
                    stream=False,
                )
                _r.raise_for_status()
                raw_bytes = _r.content
            except Exception:
                # Fallback urllib
                import urllib.request as _ureq, ssl as _ssl
                _ctx = _ssl.create_default_context()
                _ctx.check_hostname = False
                _ctx.verify_mode = _ssl.CERT_NONE
                _req2 = _ureq.Request(
                    variant.Image,
                    headers={"User-Agent": "Mozilla/5.0", "Accept": "image/*"},
                )
                with _ureq.urlopen(_req2, timeout=30, context=_ctx) as resp:
                    raw_bytes = resp.read()

            if not raw_bytes or len(raw_bytes) < 500:
                return Response({
                    "message": "Ảnh tải về bị lỗi. Hãy dùng nút 'Đổi ảnh' để upload ảnh mới rồi tách nền."
                }, status=400)
        except Exception as e:
            return Response({
                "message": f"Không tải được ảnh từ Cloudinary ({type(e).__name__}). "
                           f"Hãy dùng nút 'Đổi ảnh' để upload ảnh mới rồi bấm Tách nền."
            }, status=400)
    else:
        return Response({"message": "Biến thể chưa có ảnh."}, status=400)
    import uuid as _uuid
    job_id = str(_uuid.uuid4())
    _threading.Thread(
        target=_run_remove_bg,
        args=(job_id, raw_bytes, variant_id, variant.ProductID_id),
        daemon=True, name=f"rmbg-{variant_id}",
    ).start()
    return Response({"job_id": job_id, "status": "pending", "message": "Đang tách nền..."}, status=202)


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def variant_remove_bg_status(request):
    """GET /api/variant/remove-bg/status/?job_id=... — Poll trạng thái job."""
    job_id = request.query_params.get("job_id", "")
    with _rmbg_lock:
        job = dict(_rmbg_jobs.get(job_id) or {})
    if not job:
        return Response({"status": "not_found", "message": "Job không tồn tại"}, status=404)
    if job.get("status") in ("done", "error"):
        with _rmbg_lock:
            _rmbg_jobs.pop(job_id, None)
    return Response(job)


# ══════════════════════════════════════════════════════════════
# CHATBOT PHONEZONE
# ══════════════════════════════════════════════════════════════
# CHATBOT PHONEZONE — Powered by Claude AI (Full Version)
# Tính năng:
#   ✅ Trả lời FAQ chính sách (thanh toán, bảo hành, đổi trả...)
#   ✅ Gợi ý sản phẩm thông minh dựa trên BM25 + DB
#   ✅ Tư vấn kỹ thuật chi tiết (CPU, RAM, camera, pin...)
#   ✅ Nhớ lịch sử hội thoại trong phiên
#   ✅ Trả lời mọi thứ có trên web (blog, đơn hàng, tài khoản...)
#   ✅ Fallback rule-based nếu chưa có API key
# ══════════════════════════════════════════════════════════════

import os as _os

# ── System prompt cố định ────────────────────────────────────
_SYSTEM_BASE = """Bạn là trợ lý AI của PHONEZONE — cửa hàng điện thoại chính hãng tại Việt Nam.
Nhiệm vụ: tư vấn mua hàng, hỗ trợ chính sách, giải đáp kỹ thuật, và trả lời mọi câu hỏi liên quan đến cửa hàng.

══ THÔNG TIN CỬA HÀNG ══
- Tên: PHONEZONE
- Địa chỉ: 123 Đường Công Nghệ, Quận 1, TP. Hồ Chí Minh
- Hotline: 1800 6789 (miễn phí | T2–T7: 8:00–21:00 | CN: 9:00–18:00)
- Email: support@phonezone.vn
- Mạng xã hội: Facebook / TikTok / Instagram @phonezone03

══ CHÍNH SÁCH ══
THANH TOÁN:
  • COD — tiền mặt khi nhận hàng
  • MoMo — quét mã QR qua App MoMo
  • VNPay — ATM nội địa, Visa, MasterCard, JCB
  • Chuyển khoản ngân hàng

GIAO HÀNG:
  • Toàn quốc qua đối tác vận chuyển uy tín
  • Nội thành TP.HCM & Hà Nội: 1–2 ngày làm việc
  • Tỉnh thành khác: 2–5 ngày làm việc
  • Miễn phí giao hàng cho đơn từ 500.000đ
  • Có thể theo dõi đơn trong mục "Đơn hàng của tôi"

BẢO HÀNH:
  • Bảo hành chính hãng 12–24 tháng theo nhà sản xuất
  • iPhone: bảo hành tại Apple Store hoặc AASP
  • Đổi máy mới trong 30 ngày nếu lỗi nhà sản xuất
  • Bảo hành không áp dụng: rơi vỡ, ngấm nước, tự sửa chữa

ĐỔI TRẢ:
  • 7 ngày kể từ ngày nhận hàng
  • Sản phẩm nguyên vẹn, đủ phụ kiện, còn hộp
  • Vào Đơn hàng → chọn đơn → "Yêu cầu trả hàng"

HÓA ĐƠN:
  • Hóa đơn điện tử tự động sau khi giao thành công
  • Xem & in trong Đơn hàng → "In hóa đơn"
  • Hóa đơn VAT (đỏ): liên hệ support@phonezone.vn

KHUYẾN MÃI & VOUCHER:
  • Mã giảm giá hiển thị trực tiếp trên trang sản phẩm
  • Tự động áp dụng khi đủ điều kiện
  • Theo dõi fanpage để nhận ưu đãi mới nhất

══ QUY TẮC TRẢ LỜI ══
1. Luôn trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp
2. Dùng emoji vừa phải để tăng thân thiện
3. Câu hỏi chính sách/hỗ trợ → trả lời trực tiếp, ngắn gọn
4. Câu hỏi sản phẩm → dựa HOÀN TOÀN vào danh sách sản phẩm được cung cấp, KHÔNG bịa thông tin
5. Câu hỏi kỹ thuật → dùng thông số specs trong danh sách sản phẩm để so sánh chi tiết
6. Câu hỏi về đơn hàng/tài khoản → dùng thông tin khách hàng được cung cấp nếu có
7. Câu hỏi về blog/bài viết → dùng danh sách bài viết được cung cấp
8. Không biết → thành thật nói và hướng dẫn liên hệ hotline
9. Cuối mỗi câu trả lời tư vấn sản phẩm → hỏi thêm nhu cầu để cá nhân hóa tốt hơn

ĐỊNH DẠNG PHẢN HỒI (JSON bắt buộc):
{"reply": "nội dung trả lời", "show_products": true/false}
- show_products = true: khi câu trả lời liên quan đến sản phẩm cụ thể cần hiển thị card
- show_products = false: câu hỏi chính sách, FAQ, kỹ thuật thuần túy, đơn hàng, blog
"""


def _build_full_context(msg: str, candidate_products: list, customer_data: dict, blog_titles: list) -> str:
    """
    Xây dựng context đầy đủ để inject vào prompt:
    - Sản phẩm tìm được (với full specs)
    - Thông tin khách hàng + đơn hàng gần đây (nếu đã login)
    - Bài viết blog liên quan
    """
    sections = []

    # ── 1. Sản phẩm với full specs ───────────────────────────
    if candidate_products:
        lines = [f"══ DANH SÁCH {len(candidate_products)} SẢN PHẨM PHÙ HỢP ══"]
        for i, p in enumerate(candidate_products, 1):
            rating = f"⭐{p['rating_avg']} ({p['rating_count']} đánh giá)" if p.get("rating_avg") else "Chưa có đánh giá"
            price  = f"{int(p['min_price']):,}đ".replace(",", ".") if p.get("min_price") else "Liên hệ"
            lines.append(f"\n[{i}] {p['name']} | Thương hiệu: {p.get('brand','?')} | Từ {price} | {rating}")

            # Specs chi tiết từng biến thể
            for vi, v in enumerate((p.get("variants") or [])[:6], 1):
                spec_parts = []
                if v.get("color"):            spec_parts.append(f"Màu: {v['color']}")
                if v.get("storage"):          spec_parts.append(f"ROM: {v['storage']}")
                if v.get("ram"):              spec_parts.append(f"RAM: {v['ram']}")
                if v.get("price"):            spec_parts.append(f"Giá: {int(v['price']):,}đ".replace(",", "."))
                if v.get("cpu"):              spec_parts.append(f"CPU: {v['cpu']}")
                if v.get("os"):               spec_parts.append(f"HĐH: {v['os']}")
                if v.get("screen_size"):      spec_parts.append(f"Màn: {v['screen_size']}")
                if v.get("screen_tech"):      spec_parts.append(f"Tấm nền: {v['screen_tech']}")
                if v.get("refresh_rate"):     spec_parts.append(f"Tần số: {v['refresh_rate']}")
                if v.get("battery"):          spec_parts.append(f"Pin: {v['battery']}")
                if v.get("charging_speed"):   spec_parts.append(f"Sạc: {v['charging_speed']}")
                if v.get("rear_camera"):      spec_parts.append(f"Camera sau: {v['rear_camera']}")
                if v.get("front_camera"):     spec_parts.append(f"Camera trước: {v['front_camera']}")
                if v.get("weight"):           spec_parts.append(f"Trọng lượng: {v['weight']}")
                if v.get("stock") is not None:
                    spec_parts.append("Còn hàng" if v["stock"] > 0 else "❌ Hết hàng")
                if spec_parts:
                    lines.append(f"  Phiên bản {vi}: {' | '.join(spec_parts)}")
        sections.append("\n".join(lines))

    # ── 2. Thông tin khách hàng (nếu đã login) ───────────────
    if customer_data:
        clines = ["══ THÔNG TIN KHÁCH HÀNG (đã đăng nhập) ══"]
        clines.append(f"Tên: {customer_data.get('name','?')} | Email: {customer_data.get('email','?')}")
        if customer_data.get("phone"):
            clines.append(f"SĐT: {customer_data['phone']}")

        recent_orders = customer_data.get("recent_orders") or []
        if recent_orders:
            clines.append(f"\nĐơn hàng gần đây ({len(recent_orders)} đơn):")
            for o in recent_orders[:3]:
                items_str = ", ".join(
                    f"{it['name']} x{it['qty']}" for it in (o.get("items") or [])[:2]
                )
                clines.append(
                    f"  • Đơn #{o['id']} | {o['status_label']} | "
                    f"{int(float(o['total'])):,}đ | {items_str}".replace(",", ".")
                )
        sections.append("\n".join(clines))

    # ── 3. Bài viết blog liên quan ────────────────────────────
    if blog_titles:
        sections.append(
            "══ BÀI VIẾT BLOG LIÊN QUAN ══\n" +
            "\n".join(f"  • {t}" for t in blog_titles[:5])
        )

    return "\n\n".join(sections)


def _get_customer_context(customer_id: str) -> dict:
    """Lấy thông tin khách hàng + đơn hàng gần đây cho context."""
    try:
        from .models import Customer, Order, OrderDetail
        cust = Customer.objects.filter(CustomerID=customer_id).first()
        if not cust:
            return {}

        STATUS_LABEL = {
            "Pending": "Chờ xác nhận", "Processing": "Đang xử lý",
            "Shipping": "Đang giao", "Delivered": "Đã giao", "Cancelled": "Đã hủy",
        }

        recent_orders = []
        for o in Order.objects.filter(CustomerID=customer_id).order_by("-OrderDate")[:5]:
            details = OrderDetail.objects.filter(OrderID=o).select_related("VariantID__ProductID")
            items = [
                {"name": d.VariantID.ProductID.ProductName, "qty": d.Quantity}
                for d in details
            ]
            recent_orders.append({
                "id":           o.OrderID,
                "status_label": STATUS_LABEL.get(o.Status, o.Status),
                "total":        str(o.TotalAmount),
                "items":        items,
            })

        return {
            "name":          cust.FullName,
            "email":         cust.Email,
            "phone":         cust.PhoneNumber or "",
            "recent_orders": recent_orders,
        }
    except Exception as e:
        logger.debug(f"[Chatbot] get_customer_context error: {e}")
        return {}


def _get_blog_context(query: str) -> list:
    """Tìm các bài blog liên quan đến query."""
    try:
        from .models import Post
        posts = Post.objects.order_by("-CreatedAt")[:20]
        q = query.lower()
        matched = [p.Title for p in posts if any(w in p.Title.lower() for w in q.split() if len(w) > 2)]
        # Nếu không match cụ thể, lấy 3 bài mới nhất
        if not matched:
            matched = [p.Title for p in posts[:3]]
        return matched[:5]
    except Exception:
        return []


def _get_candidate_products(msg: str, budget_max, bought_pids: set) -> list:
    """BM25 search + build full product list với specs chi tiết."""
    from .search_engine import get_index, rebuild_index
    from .models import Review

    idx = get_index()
    if idx.N == 0:
        rebuild_index()
        idx = get_index()

    ranked = idx.score(msg, top_k=10)

    candidates = []
    for _, doc in ranked:
        p = doc["product"]
        if p.ProductID in bought_pids:
            continue

        variants_raw = list(p.productvariant_set.all())
        prices       = [float(v.Price) for v in variants_raw if v.Price]
        min_price    = min(prices) if prices else 0

        if budget_max and min_price > budget_max:
            continue

        variant_imgs = [v.Image for v in variants_raw if v.Image]
        r_data       = Review.objects.filter(product=p).aggregate(avg=Avg("rating"), cnt=Count("id"))

        # Full variant specs
        variants_full = []
        for v in variants_raw:
            variants_full.append({
                "id":            v.VariantID,
                "color":         v.Color or "",
                "storage":       v.Storage or "",
                "ram":           v.Ram or "",
                "price":         float(v.Price),
                "stock":         v.StockQuantity,
                "image":         v.Image or "",
                "cpu":           v.Cpu or "",
                "os":            v.OperatingSystem or "",
                "screen_size":   v.ScreenSize or "",
                "screen_tech":   v.ScreenTechnology or "",
                "refresh_rate":  v.RefreshRate or "",
                "battery":       v.Battery or "",
                "charging_speed":v.ChargingSpeed or "",
                "rear_camera":   v.RearCamera or "",
                "front_camera":  v.FrontCamera or "",
                "weight":        v.Weights or "",
            })

        candidates.append({
            "id":           p.ProductID,
            "name":         p.ProductName,
            "brand":        p.Brand or "",
            "image":        variant_imgs[0] if variant_imgs else "",
            "min_price":    min_price,
            "rating_avg":   round(float(r_data["avg"] or 0), 1),
            "rating_count": int(r_data["cnt"] or 0),
            "variants":     variants_full,
        })

        if len(candidates) >= 6:
            break

    # Fallback nếu không đủ
    if len(candidates) < 3:
        for p in _get_fallback_products(
            exclude_ids=[s["id"] for s in candidates],
            max_total=6 - len(candidates)
        ):
            variants_raw = list(p.productvariant_set.all())
            variant_imgs = [v.Image for v in variants_raw if v.Image]
            prices       = [float(v.Price) for v in variants_raw if v.Price]
            candidates.append({
                "id": p.ProductID, "name": p.ProductName, "brand": p.Brand or "",
                "image": variant_imgs[0] if variant_imgs else "",
                "min_price": min(prices) if prices else 0,
                "rating_avg": 0, "rating_count": 0,
                "variants": [
                    {"id": v.VariantID, "color": v.Color or "", "storage": v.Storage or "",
                     "ram": v.Ram or "", "price": float(v.Price), "stock": v.StockQuantity,
                     "image": v.Image or "", "cpu": v.Cpu or "", "os": v.OperatingSystem or "",
                     "screen_size": v.ScreenSize or "", "screen_tech": v.ScreenTechnology or "",
                     "refresh_rate": v.RefreshRate or "", "battery": v.Battery or "",
                     "charging_speed": v.ChargingSpeed or "", "rear_camera": v.RearCamera or "",
                     "front_camera": v.FrontCamera or "", "weight": v.Weights or ""}
                    for v in variants_raw
                ],
            })

    return candidates


def _call_claude_api(system: str, messages: list, api_key: str) -> dict:
    """
    Gọi Claude claude-haiku-4-5 — nhanh, rẻ, phù hợp chatbot realtime.
    Trả về {"reply": str, "show_products": bool}.
    """
    import json as _json
    import urllib.request as _ureq
    import urllib.error as _uerr
    import re as _re

    payload = _json.dumps({
        "model":      "claude-haiku-4-5-20251001",
        "max_tokens": 800,
        "system":     system,
        "messages":   messages,
    }).encode("utf-8")

    req = _ureq.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type":      "application/json",
            "x-api-key":         api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )

    try:
        with _ureq.urlopen(req, timeout=20) as resp:
            data     = _json.loads(resp.read().decode("utf-8"))
        raw_text = data["content"][0]["text"].strip()

        # Parse JSON response từ Claude
        try:
            json_match = _re.search(r'\{[\s\S]*\}', raw_text)
            if json_match:
                parsed = _json.loads(json_match.group())
                return {
                    "reply":        str(parsed.get("reply", raw_text)),
                    "show_products": bool(parsed.get("show_products", True)),
                }
        except Exception:
            pass

        # Nếu Claude không trả JSON đúng format, dùng raw text
        return {"reply": raw_text, "show_products": True}

    except _uerr.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        logger.error(f"[Chatbot] Claude HTTP {e.code}: {body[:300]}")
        raise
    except Exception as e:
        logger.error(f"[Chatbot] Claude call error: {e}")
        raise


@api_view(['POST'])
def chatbot_suggest(request):
    """
    POST /api/chatbot/suggest/
    Body JSON:
        message     : str  — tin nhắn người dùng
        history     : list — [{"role":"user"|"assistant","content":"..."}] (tối đa 20 turns)
        customer_id : str  — ID khách hàng (nếu đã đăng nhập)

    Trả về:
        reply         : str   — phản hồi Claude (hoặc rule-based nếu chưa có API key)
        products      : list  — sản phẩm gợi ý kèm full specs
        show_products : bool  — true = hiển thị card sản phẩm
        intent        : str   — "product" | "faq" | "general"
    """
    import re as _re2

    msg         = (request.data.get("message") or "").strip()
    history     = request.data.get("history") or []
    customer_id = request.data.get("customer_id") or ""

    if not msg:
        return Response({
            "reply":         "Xin chào! 👋 Tôi là trợ lý PHONEZONE. Tôi có thể giúp bạn tìm điện thoại, tư vấn kỹ thuật, hoặc giải đáp về chính sách của cửa hàng. Bạn cần hỗ trợ gì?",
            "products":      [],
            "show_products": False,
            "intent":        "general",
        })

    msg_lower = msg.lower()

    # ── Lấy API key ──────────────────────────────────────────
    from django.conf import settings as _dj_settings
    api_key = (
        getattr(_dj_settings, "ANTHROPIC_API_KEY", None)
        or _os.environ.get("ANTHROPIC_API_KEY", "")
    )

    # ── Detect budget ─────────────────────────────────────────
    budget_max = None
    m_price = _re2.search(r'(\d+(?:[.,]\d+)?)\s*(triệu|tr\b)', msg_lower)
    if m_price:
        try: budget_max = float(m_price.group(1).replace(",", ".")) * 1_000_000
        except: pass
    for kw, val in [("dưới 5", 5e6), ("dưới 10", 10e6), ("dưới 15", 15e6),
                    ("dưới 20", 20e6), ("dưới 30", 30e6), ("dưới 50", 50e6)]:
        if kw in msg_lower:
            budget_max = val

    # ── Sản phẩm đã mua (không gợi ý lại) ───────────────────
    bought_pids = set()
    if customer_id:
        try:
            bought_pids = set(
                OrderDetail.objects
                .filter(OrderID__CustomerID=customer_id)
                .values_list("VariantID__ProductID__ProductID", flat=True)
            )
        except Exception:
            pass

    # ── Thu thập context đầy đủ ──────────────────────────────
    candidate_products = _get_candidate_products(msg, budget_max, bought_pids)
    customer_data      = _get_customer_context(customer_id) if customer_id else {}
    blog_titles        = _get_blog_context(msg)

    # ── Fallback rule-based nếu chưa có API key ──────────────
    if not api_key:
        return _chatbot_rule_based(msg, msg_lower, candidate_products, budget_max)

    # ── Build full context ────────────────────────────────────
    context_block = _build_full_context(msg, candidate_products, customer_data, blog_titles)
    full_system   = _SYSTEM_BASE
    if context_block:
        full_system += f"\n\n{context_block}"

    # ── Build messages (giữ tối đa 16 turns = ~8000 tokens) ──
    claude_messages = []
    for h in history[-16:]:
        role    = h.get("role", "user")
        content = (h.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            claude_messages.append({"role": role, "content": content})
    claude_messages.append({"role": "user", "content": msg})

    # ── Gọi Claude ───────────────────────────────────────────
    try:
        result        = _call_claude_api(full_system, claude_messages, api_key)
        reply         = result["reply"]
        show_products = result["show_products"]
    except Exception:
        # Nếu Claude lỗi → fallback rule-based, không crash
        return _chatbot_rule_based(msg, msg_lower, candidate_products, budget_max)

    return Response({
        "reply":         reply,
        "products":      candidate_products if show_products else [],
        "show_products": show_products,
        "intent":        "faq" if not show_products else "product",
        "query":         msg,
    })


def _chatbot_rule_based(msg: str, msg_lower: str, candidate_products: list, budget_max) -> "Response":
    """Rule-based fallback khi chưa cấu hình ANTHROPIC_API_KEY."""
    FAQ = [
        (["thanh toán","hình thức thanh toán","trả tiền","momo","vnpay","cod","chuyển khoản","tiền mặt"],
         "💳 PHONEZONE hỗ trợ 4 hình thức thanh toán:\n• COD — tiền mặt khi nhận hàng\n• 💜 MoMo — quét mã QR\n• 🏦 VNPay — ATM, Visa, MasterCard\n• 🏧 Chuyển khoản ngân hàng"),
        (["bảo hành","warranty","hư hỏng","lỗi","đổi máy","sửa"],
         "🛡️ Bảo hành chính hãng 12–24 tháng. Đổi máy mới trong 30 ngày nếu lỗi nhà sản xuất.\n📞 Hotline: 1800 6789"),
        (["đổi trả","trả hàng","hoàn tiền","refund","return"],
         "🔄 Đổi trả trong 7 ngày, sản phẩm nguyên vẹn đủ phụ kiện.\nVào Đơn hàng → Yêu cầu trả hàng."),
        (["giao hàng","ship","vận chuyển","mấy ngày","bao lâu","phí ship"],
         "🚚 Nội thành HCM/HN: 1–2 ngày. Tỉnh khác: 2–5 ngày.\nMiễn phí từ 500.000đ."),
        (["khuyến mãi","voucher","mã giảm giá","ưu đãi","sale"],
         "🎫 Mã giảm giá hiển thị trực tiếp trên trang sản phẩm, tự động áp dụng.\nTheo dõi @phonezone03 để nhận ưu đãi mới!"),
        (["liên hệ","hotline","hỗ trợ","contact","cskh"],
         "📞 1800 6789 (miễn phí | T2–T7: 8–21h | CN: 9–18h)\n📧 support@phonezone.vn\n📍 123 Đường Công Nghệ, Q.1, TP.HCM"),
        (["hóa đơn","invoice","vat","xuất hóa đơn"],
         "🧾 Hóa đơn tự động sau khi giao thành công.\nXem & In trong Đơn hàng → In hóa đơn.\nVAT: liên hệ support@phonezone.vn"),
        (["địa chỉ","cửa hàng","showroom","ở đâu","chi nhánh"],
         "📍 123 Đường Công Nghệ, Quận 1, TP. Hồ Chí Minh\n⏰ T2–T7: 8:00–21:00 | CN: 9:00–18:00"),
        (["xin chào","hello","hi","chào","hey","alo"],
         "Xin chào! 👋 Tôi có thể giúp bạn tìm điện thoại, tư vấn kỹ thuật hoặc hỗ trợ chính sách. Bạn cần gì?"),
        (["cảm ơn","thanks","thank","tks","ty","ok rồi","được rồi"],
         "Không có gì! 😊 Cần thêm thông tin gì cứ hỏi nhé!"),
    ]

    for keywords, reply in FAQ:
        if any(kw in msg_lower for kw in keywords):
            return Response({
                "reply": reply, "products": [],
                "show_products": False, "intent": "faq", "query": msg
            })

    # Product search
    if budget_max:
        reply = f"Với ngân sách dưới {int(budget_max // 1_000_000)} triệu, đây là {len(candidate_products)} sản phẩm phù hợp:"
    elif candidate_products:
        reply = f"Tìm thấy {len(candidate_products)} sản phẩm phù hợp với \"{msg}\":"
    else:
        reply = "Xin lỗi, không tìm thấy sản phẩm phù hợp. Liên hệ 1800 6789 để được tư vấn trực tiếp nhé!"

    return Response({
        "reply": reply, "products": candidate_products,
        "show_products": bool(candidate_products), "intent": "product", "query": msg
    })

# ══════════════════════════════════════════════════════════════
# STATS — Review / Product / Voucher / Order
# Thêm vào cuối views.py
# ══════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def stats_reviews(request):
    """
    Thống kê đánh giá & bình luận.
    Query params: year (optional), month (optional)
    """
    from .models import Review, Comment, AdminReply
    from django.db.models.functions import TruncMonth, TruncDay

    year  = request.query_params.get("year")
    month = request.query_params.get("month")

    # --- Base querysets ---
    rv_qs = Review.objects.all()
    cm_qs = Comment.objects.filter(parent__isnull=True)

    if year:
        rv_qs = rv_qs.filter(created_at__year=int(year))
        cm_qs = cm_qs.filter(created_at__year=int(year))
    if month:
        rv_qs = rv_qs.filter(created_at__month=int(month))
        cm_qs = cm_qs.filter(created_at__month=int(month))

    total_reviews  = rv_qs.count()
    total_comments = cm_qs.count()

    # Tỉ lệ trả lời
    replied_rv  = AdminReply.objects.filter(target_type="review").values_list("target_id", flat=True)
    replied_cm  = AdminReply.objects.filter(target_type="comment").values_list("target_id", flat=True)
    answered_rv = rv_qs.filter(id__in=replied_rv).count()
    answered_cm = cm_qs.filter(id__in=replied_cm).count()

    # Phân phối sao (chỉ review)
    from django.db.models import Count as DCount
    star_dist = list(
        rv_qs.values("rating")
             .annotate(count=DCount("id"))
             .order_by("rating")
    )
    star_map = {r["rating"]: r["count"] for r in star_dist}
    stars = [{"star": i, "count": star_map.get(i, 0)} for i in range(1, 6)]

    avg_rating = rv_qs.aggregate(avg=Avg("rating"))["avg"]

    # Top 5 sản phẩm được đánh giá nhiều nhất
    top_products = list(
        rv_qs.values(pid=F("product__ProductID"), pname=F("product__ProductName"))
             .annotate(count=DCount("id"), avg_r=Avg("rating"))
             .order_by("-count")[:5]
    )

    # Xu hướng theo tháng (12 tháng gần nhất hoặc theo year)
    trend_qs = Review.objects.all()
    if year:
        trend_qs = trend_qs.filter(created_at__year=int(year))
    trend = list(
        trend_qs.annotate(mo=TruncMonth("created_at"))
                .values("mo")
                .annotate(reviews=DCount("id"), avg_r=Avg("rating"))
                .order_by("mo")
    )
    trend_data = [
        {"month": t["mo"].month, "label": f"T{t['mo'].month}", "reviews": t["reviews"],
         "avg_rating": round(float(t["avg_r"] or 0), 2)}
        for t in trend
    ]

    # Xu hướng comment
    trend_cm_qs = Comment.objects.filter(parent__isnull=True)
    if year:
        trend_cm_qs = trend_cm_qs.filter(created_at__year=int(year))
    trend_cm = list(
        trend_cm_qs.annotate(mo=TruncMonth("created_at"))
                   .values("mo")
                   .annotate(comments=DCount("id"))
                   .order_by("mo")
    )
    cm_map = {t["mo"].month: t["comments"] for t in trend_cm}
    # Merge với trend_data
    for row in trend_data:
        row["comments"] = cm_map.get(row["month"], 0)

    return Response({
        "total_reviews":    total_reviews,
        "total_comments":   total_comments,
        "answered_reviews": answered_rv,
        "answered_comments":answered_cm,
        "unanswered":       (total_reviews - answered_rv) + (total_comments - answered_cm),
        "avg_rating":       round(float(avg_rating or 0), 2),
        "stars":            stars,
        "top_products":     top_products,
        "trend":            trend_data,
    })


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def stats_products(request):
    """
    Thống kê kho hàng & sản phẩm.
    """
    from .models import Review
    from django.db.models import Count as DCount, Min, Max

    # Tổng sản phẩm / biến thể
    total_products = Product.objects.count()
    total_variants = ProductVariant.objects.count()

    # Tổng tồn kho
    stock_agg = ProductVariant.objects.aggregate(
        total_stock=Sum("StockQuantity"),
        min_stock=Min("StockQuantity"),
        max_stock=Max("StockQuantity"),
    )
    total_stock   = stock_agg["total_stock"] or 0
    out_of_stock  = ProductVariant.objects.filter(StockQuantity=0).count()
    low_stock     = ProductVariant.objects.filter(StockQuantity__gt=0, StockQuantity__lte=5).count()

    # Phân phối theo danh mục
    by_cat = list(
        Product.objects.values(
            cat_id=F("CategoryID__CategoryID"),
            cat_name=F("CategoryID__CategoryName"),
        ).annotate(
            product_count=DCount("ProductID"),
            total_stock=Sum("productvariant__StockQuantity"),
        ).order_by("-product_count")
    )

    # Phân phối theo hãng
    by_brand = list(
        Product.objects.values("Brand")
                       .annotate(count=DCount("ProductID"))
                       .order_by("-count")[:10]
    )

    # Top 10 biến thể tồn kho cao nhất
    top_stock = list(
        ProductVariant.objects.select_related("ProductID")
                              .order_by("-StockQuantity")[:10]
                              .values(
                                  pid=F("ProductID__ProductID"),
                                  pname=F("ProductID__ProductName"),
                                  color=F("Color"),
                                  storage=F("Storage"),
                                  ram=F("Ram"),
                                  stock=F("StockQuantity"),
                                  price=F("Price"),
                              )
    )

    # Top 10 sắp hết hàng (stock > 0 và <= 5)
    low_stock_items = list(
        ProductVariant.objects.filter(StockQuantity__gt=0, StockQuantity__lte=5)
                              .select_related("ProductID")
                              .order_by("StockQuantity")[:10]
                              .values(
                                  pid=F("ProductID__ProductID"),
                                  pname=F("ProductID__ProductName"),
                                  vid=F("VariantID"),
                                  color=F("Color"),
                                  storage=F("Storage"),
                                  stock=F("StockQuantity"),
                              )
    )

    # Sản phẩm được đánh giá cao nhất (avg rating >= 4)
    top_rated = list(
        Review.objects.values(
            pid=F("product__ProductID"),
            pname=F("product__ProductName"),
        ).annotate(
            avg_r=Avg("rating"),
            count=DCount("id"),
        ).filter(count__gte=1)
         .order_by("-avg_r", "-count")[:5]
    )

    return Response({
        "total_products":  total_products,
        "total_variants":  total_variants,
        "total_stock":     total_stock,
        "out_of_stock":    out_of_stock,
        "low_stock":       low_stock,
        "by_category":     by_cat,
        "by_brand":        [{"brand": b["Brand"] or "Không rõ", "count": b["count"]} for b in by_brand],
        "top_stock":       [
            {**item, "price": float(item["price"] or 0)} for item in top_stock
        ],
        "low_stock_items": low_stock_items,
        "top_rated":       [
            {**item, "avg_r": round(float(item["avg_r"] or 0), 2)} for item in top_rated
        ],
    })


@api_view(['GET'])
@permission_classes([IsAdminOrStaff])
def stats_vouchers(request):
    """
    Thống kê voucher & hiệu quả sử dụng.
    """
    from .models import Voucher
    from django.db.models import Count as DCount
    import datetime

    today = datetime.date.today()

    qs = Voucher.objects.all()
    total         = qs.count()
    active        = qs.filter(IsActive=True).count()
    inactive      = qs.filter(IsActive=False).count()
    expired       = qs.filter(EndDate__lt=today, IsActive=True).count()
    no_limit      = qs.filter(UsageLimit__isnull=True).count()
    exhausted     = qs.filter(UsageLimit__isnull=False, UsedCount__gte=F("UsageLimit")).count()

    # Phân loại theo scope
    by_scope = list(
        qs.values("Scope").annotate(count=DCount("VoucherID")).order_by("-count")
    )

    # Phân loại theo type
    by_type = list(
        qs.values("Type").annotate(count=DCount("VoucherID")).order_by("-count")
    )

    # Top 10 voucher dùng nhiều nhất
    top_used = list(
        qs.filter(UsedCount__gt=0)
          .order_by("-UsedCount")[:10]
          .values("VoucherID", "Code", "Type", "Value", "Scope", "UsedCount", "UsageLimit", "IsActive", "EndDate")
    )

    # Sắp hết hạn (trong 7 ngày tới)
    near_expiry = list(
        qs.filter(
            IsActive=True,
            EndDate__gte=today,
            EndDate__lte=today + datetime.timedelta(days=7),
        ).values("VoucherID", "Code", "Type", "Value", "EndDate", "UsedCount", "UsageLimit")
         .order_by("EndDate")
    )

    # Tỉ lệ sử dụng tổng
    total_used = sum(v.UsedCount for v in qs)
    total_limit = sum(v.UsageLimit for v in qs if v.UsageLimit)

    return Response({
        "total":        total,
        "active":       active,
        "inactive":     inactive,
        "expired":      expired,
        "exhausted":    exhausted,
        "no_limit":     no_limit,
        "total_used":   total_used,
        "total_limit":  total_limit,
        "by_scope":     by_scope,
        "by_type":      by_type,
        "top_used":     [
            {
                **item,
                "Value": float(item["Value"]),
                "EndDate": item["EndDate"].isoformat() if item["EndDate"] else None,
                "usage_pct": round(item["UsedCount"] / item["UsageLimit"] * 100, 1)
                             if item["UsageLimit"] else None,
            }
            for item in top_used
        ],
        "near_expiry":  [
            {**item, "Value": float(item["Value"]),
             "EndDate": item["EndDate"].isoformat() if item["EndDate"] else None}
            for item in near_expiry
        ],
    })