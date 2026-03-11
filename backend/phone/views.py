import json
import datetime
from django.contrib.auth.hashers import make_password, check_password
import cloudinary
import cloudinary.uploader
cloudinary.config(
    cloud_name = "dag3scrwl",
    api_key    = "997941784142674",
    api_secret = "5QXdjv-HeiJEPPhEUcukPFIRyFU",
)
import random
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework import status
from .models import Customer, Staff, Product, ProductVariant, ProductImage, Category, generate_customer_id, Order, OrderDetail, Post, ProductContent, ReturnRequest, ReturnMedia
import logging
from django.db.models import Avg, Count, Sum, F, FloatField, ExpressionWrapper, Min, Max, Q, DecimalField
from django.db.models.functions import TruncDay, TruncMonth, TruncYear, Coalesce
from django.utils import timezone as tz
from datetime import date as _date
import re as _re
import io
import time

logger = logging.getLogger(__name__)
otp_storage = {}


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
    customer_id = generate_customer_id()
    return Customer.objects.create(CustomerID=customer_id, **kwargs)

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
    return Response({"message": "Đăng ký thành công", "customer": customer_data(customer)}, status=status.HTTP_201_CREATED)


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
    return Response({"message": "Đăng nhập thành công", "customer": {"id": existing.CustomerID, "full_name": existing.FullName, "email": existing.Email, "avatar": avatar, "login_type": existing.LoginType}}, status=status.HTTP_200_OK)


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
    return Response({"message": "Đăng ký Google thành công", "customer": customer_data(customer)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def login_google(request):
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()
    if not full_name or not email: return Response({"message": "Thiếu thông tin Google"}, status=status.HTTP_400_BAD_REQUEST)
    existing = Customer.objects.filter(Email=email).first()
    if not existing:                   return Response({"message": "Tài khoản Google chưa được đăng ký"}, status=status.HTTP_404_NOT_FOUND)
    if existing.LoginType != 'google': return Response({"message": email_exists_message(existing.LoginType)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"message": "Đăng nhập Google thành công", "customer": {"id": existing.CustomerID, "full_name": existing.FullName, "email": existing.Email, "avatar": existing.Avatar or "", "login_type": existing.LoginType}}, status=status.HTTP_200_OK)


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
    return Response({"message": "Đăng ký Facebook thành công", "customer": customer_data(customer)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def login_facebook(request):
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()
    if not full_name or not email: return Response({"message": "Thiếu thông tin Facebook"}, status=status.HTTP_400_BAD_REQUEST)
    existing = Customer.objects.filter(Email=email).first()
    if not existing:                      return Response({"message": "Tài khoản Facebook chưa được đăng ký"}, status=status.HTTP_404_NOT_FOUND)
    if existing.LoginType != 'facebook':  return Response({"message": email_exists_message(existing.LoginType)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"message": "Đăng nhập Facebook thành công", "customer": {"id": existing.CustomerID, "full_name": existing.FullName, "email": existing.Email, "avatar": existing.Avatar or "", "login_type": existing.LoginType}}, status=status.HTTP_200_OK)


@api_view(['POST'])
def forgot_password(request):
    email = request.data.get('email', '').strip()
    if not email: return Response({"message": "Vui lòng nhập email"}, status=status.HTTP_400_BAD_REQUEST)
    existing = Customer.objects.filter(Email=email).first()
    if not existing:                      return Response({"message": "Email chưa được đăng ký"}, status=status.HTTP_404_NOT_FOUND)
    if existing.LoginType == 'google':    return Response({"message": "Email này đã đăng ký bằng Google, vui lòng đăng nhập bằng Google"}, status=status.HTTP_400_BAD_REQUEST)
    if existing.LoginType == 'facebook':  return Response({"message": "Email này đã đăng ký bằng Facebook, vui lòng đăng nhập bằng Facebook"}, status=status.HTTP_400_BAD_REQUEST)
    otp_code = str(random.randint(100000, 999999))
    otp_storage[email] = otp_code
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
    stored_otp = otp_storage.get(email)
    if not stored_otp:          return Response({"message": "OTP đã hết hạn, vui lòng gửi lại"}, status=status.HTTP_400_BAD_REQUEST)
    if otp_code != stored_otp:  return Response({"message": "Mã OTP không đúng"}, status=status.HTTP_400_BAD_REQUEST)
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
    if email in otp_storage: del otp_storage[email]
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
            upload_result = cloudinary.uploader.upload(avatar, folder="sellphone/avatars", public_id=f"avatar_{customer_id}", overwrite=True, resource_type="image", transformation=[{"width": 300, "height": 300, "crop": "fill", "gravity": "face"}])
            customer.Avatar = upload_result["secure_url"]
        except Exception as e:
            return Response({"message": f"Lỗi upload ảnh: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    customer.save()
    return Response({"message": "Cập nhật thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
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
    return Response({"message": "Đổi mật khẩu thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def upload_avatar(request):
    customer_id = request.data.get('id', '').strip()
    avatar_file = request.FILES.get('avatar_file')
    if not customer_id or not avatar_file: return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    try:
        upload_result = cloudinary.uploader.upload(avatar_file, folder="sellphone/avatars", public_id=f"avatar_{customer_id}", overwrite=True, resource_type="image", transformation=[{"width": 300, "height": 300, "crop": "fill", "gravity": "face"}])
        customer.Avatar = upload_result["secure_url"]
        customer.save()
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
    return Response({"message": "Đã lưu địa chỉ", "id": a.AddressID}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def update_customer_address(request):
    from .models import CustomerAddress
    addr_id = request.data.get('id')
    a = CustomerAddress.objects.filter(AddressID=addr_id).first()
    if not a: return Response({"message": "Không tìm thấy địa chỉ"}, status=status.HTTP_404_NOT_FOUND)
    a.Name    = request.data.get('name',    a.Name).strip()
    a.Phone   = request.data.get('phone',   a.Phone).strip()
    a.Address = request.data.get('address', a.Address).strip()
    a.save()
    return Response({"message": "Đã cập nhật địa chỉ"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def delete_customer_address(request):
    from .models import CustomerAddress
    addr_id = request.data.get('id')
    a = CustomerAddress.objects.filter(AddressID=addr_id).first()
    if not a: return Response({"message": "Không tìm thấy địa chỉ"}, status=status.HTTP_404_NOT_FOUND)
    a.delete()
    return Response({"message": "Đã xóa địa chỉ"}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════
# STAFF / ADMIN
# ══════════════════════════════════════════════════════════════

@api_view(['POST'])
def admin_login(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()
    if not username: return Response({"message": "Vui lòng nhập tên tài khoản", "field": "username"}, status=status.HTTP_400_BAD_REQUEST)
    if not password: return Response({"message": "Vui lòng nhập mật khẩu", "field": "password"}, status=status.HTTP_400_BAD_REQUEST)
    staff = Staff.objects.filter(Email=username).first()
    if not staff:                                    return Response({"message": "Tài khoản không tồn tại", "field": "username"}, status=status.HTTP_404_NOT_FOUND)
    if not check_password(password, staff.Password): return Response({"message": "Mật khẩu không đúng", "field": "password"}, status=status.HTTP_401_UNAUTHORIZED)
    if staff.Role == 'Unentitled':                   return Response({"message": "Bạn không có quyền truy cập", "field": "general"}, status=status.HTTP_403_FORBIDDEN)
    return Response({"message": "Đăng nhập thành công", "admin": {"id": staff.StaffID, "full_name": staff.FullName, "username": staff.Email, "role": staff.Role, "avatar": ""}}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_staff(request, staff_id):
    staff = Staff.objects.filter(StaffID=staff_id).first()
    if not staff: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    return Response({"id": staff.StaffID, "full_name": staff.FullName, "email": staff.Email, "role": staff.Role, "avatar": staff.Avatar or "" if hasattr(staff, 'Avatar') else ""}, status=status.HTTP_200_OK)


@api_view(['GET'])
def list_staff(request):
    data = [{"id": s.StaffID, "full_name": s.FullName, "email": s.Email, "role": s.Role, "avatar": s.Avatar or "" if hasattr(s, 'Avatar') else ""} for s in Staff.objects.all().order_by('StaffID')]
    return Response({"staff": data}, status=status.HTTP_200_OK)


@api_view(['POST'])
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
    return Response({"message": "Tạo tài khoản thành công", "staff": {"id": staff.StaffID, "full_name": staff.FullName, "email": staff.Email, "role": staff.Role}}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def update_staff_role(request):
    staff_id = request.data.get('id')
    role     = request.data.get('role', '').strip()
    if not staff_id or not role:                     return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if role not in ['Admin', 'Staff', 'Unentitled']: return Response({"message": "Vai trò không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    staff = Staff.objects.filter(StaffID=staff_id).first()
    if not staff: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    staff.Role = role; staff.save()
    return Response({"message": "Cập nhật quyền thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def delete_staff(request):
    staff_id = request.data.get('id')
    if not staff_id: return Response({"message": "Thiếu staff_id"}, status=status.HTTP_400_BAD_REQUEST)
    Staff.objects.filter(StaffID=staff_id).delete()
    return Response({"message": "Đã xóa tài khoản"}, status=status.HTTP_200_OK)


@api_view(['POST'])
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
def upload_staff_avatar(request):
    staff_id    = request.data.get('id')
    avatar_file = request.FILES.get('avatar_file')
    if not staff_id or not avatar_file: return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    staff = Staff.objects.filter(StaffID=staff_id).first()
    if not staff: return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    try:
        upload_result = cloudinary.uploader.upload(avatar_file, folder="sellphone/staff_avatars", public_id=f"staff_avatar_{staff_id}", overwrite=True, resource_type="image", transformation=[{"width": 300, "height": 300, "crop": "fill", "gravity": "face"}])
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
    return Response({"categories": [{"id": c.CategoryID, "name": c.CategoryName, "image": c.Image or "" if hasattr(c, 'Image') else ""} for c in cats]}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_category(request):
    name       = request.data.get('name', '').strip()
    image_file = request.FILES.get('image')
    if not name: return Response({"message": "Vui lòng nhập tên danh mục"}, status=status.HTTP_400_BAD_REQUEST)
    if Category.objects.filter(CategoryName=name).exists(): return Response({"message": "Danh mục đã tồn tại"}, status=status.HTTP_400_BAD_REQUEST)
    image_url = ""
    if image_file:
        try:
            result    = cloudinary.uploader.upload(image_file, folder="sellphone/categories", public_id=f"category_{name.lower().replace(' ', '_')}", overwrite=True, resource_type="image", transformation=[{"width": 400, "height": 400, "crop": "fill"}])
            image_url = result["secure_url"]
        except Exception as e:
            return Response({"message": f"Lỗi upload ảnh: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    cat = Category.objects.create(CategoryName=name, Image=image_url)
    return Response({"message": "Tạo danh mục thành công", "id": cat.CategoryID, "name": cat.CategoryName, "image": image_url}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
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
            result    = cloudinary.uploader.upload(image_file, folder="sellphone/categories", public_id=f"category_{cat_id}", overwrite=True, resource_type="image", transformation=[{"width": 400, "height": 400, "crop": "fill"}])
            cat.Image = result["secure_url"]
        except Exception as e:
            return Response({"message": f"Lỗi upload ảnh: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    cat.save()
    return Response({"message": "Cập nhật danh mục thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
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
def create_product(request):
    product_name = request.data.get('product_name', '').strip()
    brand        = request.data.get('brand', '').strip()
    description  = request.data.get('description', '').strip()
    category_id  = request.data.get('category_id')
    variants_raw = request.data.get('variants', '[]')
    images       = request.FILES.getlist('images')
    if not product_name: return Response({"message": "Vui lòng nhập tên sản phẩm"}, status=status.HTTP_400_BAD_REQUEST)
    if not category_id:  return Response({"message": "Vui lòng chọn danh mục"}, status=status.HTTP_400_BAD_REQUEST)
    category = Category.objects.filter(CategoryID=category_id).first()
    if not category: return Response({"message": "Danh mục không tồn tại"}, status=status.HTTP_400_BAD_REQUEST)
    try:    variants = json.loads(variants_raw)
    except: return Response({"message": "Dữ liệu biến thể không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    if not variants: return Response({"message": "Cần ít nhất 1 biến thể"}, status=status.HTTP_400_BAD_REQUEST)
    variant_errors = _validate_variants(variants)
    all_errors = [e for e in variant_errors if e]
    if all_errors:
        messages = []
        for ve in all_errors: messages.extend(ve.values())
        return Response({"message": " | ".join(messages), "variant_errors": variant_errors}, status=status.HTTP_400_BAD_REQUEST)
    product = Product.objects.create(ProductName=product_name, Brand=brand or None, Description=description or None, CategoryID=category)
    for idx, v in enumerate(variants):
        variant_obj = ProductVariant.objects.create(ProductID=product, Color=v.get('color') or None, Storage=v.get('storage') or None, Ram=v.get('ram') or None, Price=float(v.get('price', 0)), StockQuantity=int(v.get('stock', 0)), Cpu=v.get('cpu') or None, OperatingSystem=v.get('os') or None, ScreenSize=v.get('screenSize') or None, ScreenTechnology=v.get('screenTech') or None, RefreshRate=v.get('refreshRate') or None, Battery=v.get('battery') or None, ChargingSpeed=v.get('chargingSpeed') or None, FrontCamera=v.get('frontCamera') or None, RearCamera=v.get('rearCamera') or None, Weights=v.get('weights') or None, Updates=v.get('updates') or None)
        variant_img = request.FILES.get(f'variant_image_{idx}')
        if variant_img:
            try:
                result = cloudinary.uploader.upload(variant_img, folder=f"sellphone/variants/{product.ProductID}", public_id=f"variant_{variant_obj.VariantID}", overwrite=True, resource_type="image", transformation=[{"width": 800, "height": 800, "crop": "limit"}])
                variant_obj.Image = result["secure_url"]; variant_obj.save()
            except: pass
    for idx, img_file in enumerate(images):
        try:
            result = cloudinary.uploader.upload(img_file, folder=f"sellphone/products/{product.ProductID}", public_id=f"product_{product.ProductID}_img_{idx}", overwrite=True, resource_type="image", transformation=[{"width": 800, "height": 800, "crop": "limit"}])
            ProductImage.objects.create(ProductID=product, ImageUrl=result["secure_url"], IsPrimary=(idx == 0))
        except: pass
    on_product_saved(product.ProductID)
    return Response({"message": "Tạo sản phẩm thành công", "product_id": product.ProductID}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def list_products(request):
    products = Product.objects.select_related('CategoryID').all().order_by('-CreatedAt')
    data = []
    for p in products:
        variants    = ProductVariant.objects.filter(ProductID=p)
        min_v       = variants.order_by('Price').first()
        primary_img = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first() or ProductImage.objects.filter(ProductID=p).first()
        rams        = list(set(v.Ram     for v in variants if v.Ram))
        storages    = list(set(v.Storage for v in variants if v.Storage))
        data.append({"id": p.ProductID, "name": p.ProductName, "brand": p.Brand or "", "description": p.Description or "", "category": p.CategoryID.CategoryName, "category_id": p.CategoryID.CategoryID, "variant_count": variants.count(), "min_price": str(min_v.Price) if min_v else "0", "image": primary_img.ImageUrl if primary_img else "", "rams": rams, "storages": storages, "variants": [{"id": v.VariantID, "color": v.Color or "", "storage": v.Storage or "", "ram": v.Ram or "", "price": float(v.Price), "stock": v.StockQuantity, "image": v.Image or ""} for v in variants]})
    return Response({"products": data}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_product_detail(request, product_id):
    product = Product.objects.select_related('CategoryID').filter(ProductID=product_id).first()
    if not product: return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    variants         = ProductVariant.objects.filter(ProductID=product)
    images           = ProductImage.objects.filter(ProductID=product)
    related_products = Product.objects.filter(CategoryID=product.CategoryID).exclude(ProductID=product_id).order_by('-CreatedAt')[:5]
    def variant_data(v):
        return {"id": v.VariantID, "image": v.Image or "" if hasattr(v, "Image") else "", "color": v.Color or "", "storage": v.Storage or "", "ram": v.Ram or "", "price": str(v.Price), "stock": v.StockQuantity, "cpu": v.Cpu or "", "os": v.OperatingSystem or "", "screen_size": v.ScreenSize or "", "screen_tech": v.ScreenTechnology or "", "refresh_rate": v.RefreshRate or "", "battery": v.Battery or "", "charging_speed": v.ChargingSpeed or "", "front_camera": v.FrontCamera or "", "rear_camera": v.RearCamera or "", "weights": v.Weights or "", "updates": v.Updates or ""}
    def related_data(p):
        primary_img = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first() or ProductImage.objects.filter(ProductID=p).first()
        min_v       = ProductVariant.objects.filter(ProductID=p).order_by('Price').first()
        return {"id": p.ProductID, "name": p.ProductName, "brand": p.Brand or "", "image": primary_img.ImageUrl if primary_img else "", "min_price": str(min_v.Price) if min_v else "0"}
    images_sorted = list(images.filter(IsPrimary=True)) + list(images.filter(IsPrimary=False))
    return Response({"product": {"id": product.ProductID, "name": product.ProductName, "brand": product.Brand or "", "description": product.Description or "", "category": product.CategoryID.CategoryName, "category_id": product.CategoryID.CategoryID}, "variants": [variant_data(v) for v in variants], "images": [{"url": img.ImageUrl, "is_primary": img.IsPrimary} for img in images_sorted], "related": [related_data(p) for p in related_products]}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_product_variants(request, product_id):
    product = Product.objects.filter(ProductID=product_id).first()
    if not product: return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    variants = ProductVariant.objects.filter(ProductID=product)
    return Response({"variants": [{"id": v.VariantID, "color": v.Color or "", "storage": v.Storage or "", "ram": v.Ram or "", "price": str(v.Price), "stock": v.StockQuantity} for v in variants]}, status=status.HTTP_200_OK)


@api_view(['POST'])
def add_variants(request):
    product_id    = request.data.get('product_id') or request.POST.get('product_id')
    variants_json = request.POST.get('variants')
    if not product_id: return Response({"message": "Thiếu product_id"}, status=status.HTTP_400_BAD_REQUEST)
    product = Product.objects.filter(ProductID=product_id).first()
    if not product: return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    try:    variants = json.loads(variants_json) if variants_json else []
    except: return Response({"message": "Dữ liệu biến thể không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    if not variants: return Response({"message": "Vui lòng thêm ít nhất 1 biến thể"}, status=status.HTTP_400_BAD_REQUEST)
    variant_errors = _validate_variants(variants)
    all_errors = [e for e in variant_errors if e]
    if all_errors:
        messages = []
        for ve in all_errors: messages.extend(ve.values())
        return Response({"message": " | ".join(messages), "variant_errors": variant_errors}, status=status.HTTP_400_BAD_REQUEST)
    created = []
    for idx, v in enumerate(variants):
        variant_obj = ProductVariant.objects.create(ProductID=product, Color=v.get('color') or None, Storage=v.get('storage') or None, Ram=v.get('ram') or None, Price=float(v.get('price', 0)), StockQuantity=int(v.get('stock', 0)), Cpu=v.get('cpu') or None, OperatingSystem=v.get('os') or None, ScreenSize=v.get('screenSize') or None, ScreenTechnology=v.get('screenTech') or None, RefreshRate=v.get('refreshRate') or None, Battery=v.get('battery') or None, ChargingSpeed=v.get('chargingSpeed') or None, FrontCamera=v.get('frontCamera') or None, RearCamera=v.get('rearCamera') or None, Weights=v.get('weights') or None, Updates=v.get('updates') or None)
        variant_img = request.FILES.get(f'variant_image_{idx}')
        if variant_img:
            try:
                result = cloudinary.uploader.upload(variant_img, folder=f"sellphone/variants/{product.ProductID}", public_id=f"variant_{variant_obj.VariantID}", overwrite=True, resource_type="image", transformation=[{"width": 800, "height": 800, "crop": "limit"}])
                variant_obj.Image = result["secure_url"]; variant_obj.save()
            except: pass
        created.append(variant_obj.VariantID)
    on_product_saved(product.ProductID)
    return Response({"message": f"Đã thêm {len(created)} biến thể thành công", "variant_ids": created}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@parser_classes([MultiPartParser])
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
            result = cloudinary.uploader.upload(img_file, folder=f"sellphone/products/{product.ProductID}", resource_type="image", transformation=[{"width": 800, "height": 800, "crop": "limit"}])
            ProductImage.objects.create(ProductID=product, ImageUrl=result["secure_url"], IsPrimary=False)
        except Exception as e:
            logger.error(f"update_product image upload: {e}")
    on_product_saved(product.ProductID)
    return Response({"message": "Cập nhật sản phẩm thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def delete_product(request):
    product_id = request.data.get('product_id')
    if not product_id: return Response({"message": "Thiếu product_id"}, status=status.HTTP_400_BAD_REQUEST)
    product = Product.objects.filter(ProductID=product_id).first()
    if not product: return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    product.delete()
    return Response({"message": "Đã xóa sản phẩm"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def delete_product_image(request):
    image_id = request.data.get('image_id')
    if not image_id: return Response({"message": "Thiếu image_id"}, status=status.HTTP_400_BAD_REQUEST)
    img = ProductImage.objects.filter(ImageID=image_id).first()
    if not img: return Response({"message": "Không tìm thấy ảnh"}, status=status.HTTP_404_NOT_FOUND)
    img.delete()
    return Response({"message": "Đã xóa ảnh"}, status=status.HTTP_200_OK)


@api_view(['POST'])
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
        except: return Response({"message": "Giá không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    if stock is not None:
        try:    variant.StockQuantity = int(stock)
        except: return Response({"message": "Số lượng không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    img_file = request.FILES.get('image')
    if img_file:
        try:
            result = cloudinary.uploader.upload(img_file, folder=f"sellphone/variants/{variant.ProductID_id}", public_id=f"variant_{variant_id}", overwrite=True, resource_type="image", transformation=[{"width": 800, "height": 800, "crop": "limit"}])
            variant.Image = result["secure_url"]
        except Exception as e:
            return Response({"message": f"Lỗi upload ảnh: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    variant.save()
    on_product_saved(variant.ProductID_id)
    return Response({"message": "Cập nhật biến thể thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def delete_variant(request):
    variant_id = request.data.get('variant_id')
    if not variant_id: return Response({"message": "Thiếu variant_id"}, status=status.HTTP_400_BAD_REQUEST)
    variant = ProductVariant.objects.filter(VariantID=variant_id).first()
    if not variant: return Response({"message": "Không tìm thấy biến thể"}, status=status.HTTP_404_NOT_FOUND)
    product_id = variant.ProductID_id
    if ProductVariant.objects.filter(ProductID=product_id).count() <= 1:
        return Response({"message": "Không thể xóa biến thể duy nhất của sản phẩm"}, status=status.HTTP_400_BAD_REQUEST)
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
                result = cloudinary.uploader.upload(request.FILES[key], folder=f"sellphone/product_content/{product_id}", resource_type="image", transformation=[{"width": 1200, "crop": "limit"}])
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
    min_order   = float(request.data.get('min_order', 0) or 0)
    max_disc    = request.data.get('max_discount')
    usage_limit = request.data.get('usage_limit')
    v = Voucher.objects.create(Code=code, Type=vtype, Value=float(value), Scope=scope, CategoryID=cat_obj, ProductID=prod_obj, VariantID=variant_obj, MinOrder=min_order, MaxDiscount=float(max_disc) if max_disc else None, StartDate=start_date, EndDate=end_date, UsageLimit=int(usage_limit) if usage_limit else None, IsActive=True)
    return Response({"message": "Tạo voucher thành công", "id": v.VoucherID}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
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
    return Response({"message": "Cập nhật voucher thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def delete_voucher(request):
    from .models import Voucher
    voucher_id = request.data.get('id')
    if not voucher_id: return Response({"message": "Thiếu voucher_id"}, status=status.HTTP_400_BAD_REQUEST)
    Voucher.objects.filter(VoucherID=voucher_id).delete()
    return Response({"message": "Đã xóa voucher"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def deactivate_voucher(request):
    from .models import Voucher
    vid = request.data.get('id')
    v = Voucher.objects.filter(VoucherID=vid).first()
    if not v: return Response({"message": "Không tìm thấy voucher"}, status=status.HTTP_404_NOT_FOUND)
    v.IsActive = False; v.save()
    return Response({"message": "Đã vô hiệu hóa voucher"}, status=status.HTTP_200_OK)


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
def create_order(request):
    from .models import Voucher
    from django.db import transaction
    customer_id      = request.data.get('customer_id')
    items            = request.data.get('items', [])
    voucher_code     = request.data.get('voucher_code')
    subtotal         = float(request.data.get('subtotal', 0) or 0)
    discount         = float(request.data.get('discount', 0) or 0)
    total            = float(request.data.get('total', 0) or 0)
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
    validated_items = []
    for item in items:
        raw_vid = item.get('variant_id')
        try:    vid = int(raw_vid)
        except: return Response({"message": "Sản phẩm không hợp lệ. Vui lòng xóa giỏ hàng và thêm lại."}, status=status.HTTP_400_BAD_REQUEST)
        variant = ProductVariant.objects.select_related('ProductID').filter(VariantID=vid).first()
        if not variant: return Response({"message": f"Sản phẩm #{vid} không còn tồn tại"}, status=status.HTTP_400_BAD_REQUEST)
        qty = int(item.get('qty', 1))
        if qty <= 0: return Response({"message": "Số lượng sản phẩm phải lớn hơn 0"}, status=status.HTTP_400_BAD_REQUEST)
        if variant.StockQuantity < qty:
            pname = variant.ProductID.ProductName
            color = f" ({variant.Color})" if variant.Color else ""
            return Response({"message": f"'{pname}{color}' chỉ còn {variant.StockQuantity} sản phẩm trong kho"}, status=status.HTTP_400_BAD_REQUEST)
        price = float(item.get('price', 0))
        if price <= 0: return Response({"message": "Giá sản phẩm không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
        validated_items.append({"variant": variant, "qty": qty, "price": price})
    try:
        with transaction.atomic():
            shipping_address = f"{receiver_name} - {receiver_phone} - {receiver_address}"
            if note: shipping_address += f" | Ghi chú: {note}"
            order = Order(CustomerID=customer, TotalAmount=total, Status='Processing', ShippingAddress=shipping_address)
            for field, val in [('PaymentMethod', payment_method), ('Subtotal', subtotal), ('Discount', discount), ('StatusNote', '')]:
                try: setattr(order, field, val)
                except: pass
            order.save()
            for vi in validated_items:
                variant = vi['variant']; qty = vi['qty']
                OrderDetail.objects.create(OrderID=order, VariantID=variant, Quantity=qty, UnitPrice=vi['price'])
                variant.StockQuantity = max(0, variant.StockQuantity - qty); variant.save()
            if voucher_code:
                vobj = Voucher.objects.filter(Code=voucher_code.upper()).first()
                if vobj: vobj.UsedCount += 1; vobj.save()
    except Exception as e:
        return Response({"message": f"Đặt hàng thất bại, vui lòng thử lại. ({str(e)})"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    resp = {"message": "Đặt hàng thành công", "order_id": order.OrderID}
    if payment_method == "momo":  resp["momo_url"]  = None
    if payment_method == "vnpay": resp["vnpay_url"] = None
    return Response(resp, status=status.HTTP_201_CREATED)


@api_view(['GET'])
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
            for d in OrderDetail.objects.select_related('VariantID').filter(OrderID=o):
                d.VariantID.StockQuantity += d.Quantity; d.VariantID.save()
            o.Status = 'Cancelled'
            try: o.StatusNote = 'Khách hàng hủy đơn'
            except: pass
            o.save()
    except Exception as e:
        return Response({"message": f"Hủy đơn thất bại: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response({"message": "Đã hủy đơn hàng thành công"}, status=status.HTTP_200_OK)


@api_view(['GET'])
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
                for d in OrderDetail.objects.select_related('VariantID').filter(OrderID=o):
                    d.VariantID.StockQuantity += d.Quantity; d.VariantID.save()
            o.Status = new_status
            try: o.StatusNote = note
            except: pass
            o.save()
    except Exception as e:
        return Response({"message": f"Cập nhật thất bại: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    label = {'Processing': 'Đang xử lý', 'Shipping': 'Đang giao hàng', 'Delivered': 'Đã giao hàng', 'Cancelled': 'Đã hủy'}.get(new_status, new_status)
    return Response({"message": f"Cập nhật thành công: {label}"}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════
# RETURN REQUEST
# ══════════════════════════════════════════════════════════════

@api_view(['POST'])
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
                    result = cloudinary.uploader.upload(f, folder=f"sellphone/returns/{o.OrderID}", resource_type=resource_type)
                    ReturnMedia.objects.create(ReturnID=rr, Url=result['secure_url'], MediaType=resource_type)
                except: pass
            o.Status = 'ReturnRequested'
            try: o.StatusNote = f'Yêu cầu trả hàng: {reason}'
            except: pass
            o.save()
    except Exception as e:
        return Response({"message": f"Tạo yêu cầu thất bại: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response({"message": "Đã gửi yêu cầu trả hàng thành công", "return_id": rr.ReturnID}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def list_return_requests(request):
    returns = ReturnRequest.objects.all().select_related('OrderID').order_by('-CreatedAt')
    result  = []
    for rr in returns:
        o     = rr.OrderID
        media = ReturnMedia.objects.filter(ReturnID=rr)
        result.append({"return_id": rr.ReturnID, "order_id": o.OrderID, "customer_id": str(o.CustomerID_id), "customer_name": o.CustomerID.FullName, "reason": rr.Reason, "status": rr.Status, "admin_note": rr.AdminNote or "", "created_at": rr.CreatedAt.isoformat(), "media": [{"url": m.Url, "type": m.MediaType} for m in media], "order_total": str(o.TotalAmount)})
    return Response({"returns": result}, status=status.HTTP_200_OK)


@api_view(['POST'])
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
    return Response({"message": f"{note or default_note}"}, status=status.HTTP_200_OK)


@api_view(['GET'])
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
    posts    = Post.objects.all()
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
        result.append({"id": p.PostID, "title": p.Title, "category": p.Category or "Mẹo vặt", "thumbnail": thumb, "created_at": p.CreatedAt.isoformat(), "author": p.Author or "Admin"})
    return Response({"posts": result}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_post(request, post_id):
    p = Post.objects.filter(PostID=post_id).first()
    if not p: return Response({"message": "Không tìm thấy bài viết"}, status=status.HTTP_404_NOT_FOUND)
    try: blocks = json.loads(p.Blocks) if isinstance(p.Blocks, str) else (p.Blocks or [])
    except: blocks = []
    return Response({"post": {"id": p.PostID, "title": p.Title, "category": p.Category or "", "blocks": blocks, "created_at": p.CreatedAt.isoformat(), "author": p.Author or "Admin"}}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_post(request):
    title    = request.data.get('title', '').strip()
    category = request.data.get('category', '').strip()
    blocks   = request.data.get('blocks', '[]')
    author   = request.data.get('author', 'Admin').strip()
    if not title: return Response({"message": "Vui lòng nhập tiêu đề bài viết"}, status=status.HTTP_400_BAD_REQUEST)
    if isinstance(blocks, str):
        try: blocks_parsed = json.loads(blocks)
        except: blocks_parsed = []
    else: blocks_parsed = blocks
    for key in request.FILES:
        if key.startswith('block_img_'):
            idx = key.replace('block_img_', '')
            try:
                result = cloudinary.uploader.upload(request.FILES[key], folder="sellphone/posts", resource_type="image", transformation=[{"width": 1200, "crop": "limit"}])
                for b in blocks_parsed:
                    if b.get('_idx') == idx and b.get('type') == 'image': b['url'] = result['secure_url']; break
            except: pass
    post = Post.objects.create(Title=title, Category=category or "Mẹo vặt", Blocks=json.dumps(blocks_parsed, ensure_ascii=False), Author=author)
    return Response({"message": "Đăng bài thành công", "post_id": post.PostID}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
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
                result = cloudinary.uploader.upload(request.FILES[key], folder="sellphone/posts", resource_type="image")
                for b in blocks_parsed:
                    if b.get('_idx') == idx and b.get('type') == 'image': b['url'] = result['secure_url']; break
            except: pass
    p.Title = title; p.Category = category; p.Blocks = json.dumps(blocks_parsed, ensure_ascii=False); p.save()
    return Response({"message": "Cập nhật bài viết thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def delete_post(request):
    post_id = request.data.get('post_id')
    p = Post.objects.filter(PostID=post_id).first()
    if not p: return Response({"message": "Không tìm thấy bài viết"}, status=status.HTTP_404_NOT_FOUND)
    p.delete()
    return Response({"message": "Đã xóa bài viết"}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════
# REVIEW & COMMENT
# ══════════════════════════════════════════════════════════════

def _serialize_review(review, customer_id=None):
    from .models import AdminReply, Like, ReviewMedia
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
    return {"id": review.id, "type": "review", "customer_id": str(review.customer_id), "customer_name": review.customer.FullName, "customer_avatar": review.customer.Avatar or "", "product_id": review.product_id, "product_name": review.product.ProductName, "variant": variant_label, "rating": review.rating, "content": review.content, "media": media, "admin_reply": {"content": admin_reply.content} if admin_reply else None, "liked": liked, "likes": likes, "created_at": review.created_at.isoformat(), "updated_at": review.updated_at.isoformat()}


def _serialize_comment(comment, customer_id=None):
    from .models import AdminReply, Like, Comment
    admin_reply = AdminReply.objects.filter(target_type="comment", target_id=comment.id).first()
    liked = False
    likes = Like.objects.filter(target_type="comment", target_id=comment.id).count()
    if customer_id:
        liked = Like.objects.filter(customer_id=customer_id, target_type="comment", target_id=comment.id).exists()
    replies = [_serialize_comment(r, customer_id) for r in Comment.objects.filter(parent=comment).order_by("created_at")]
    return {"id": comment.id, "type": "comment", "customer_id": str(comment.customer_id), "customer_name": comment.customer.FullName, "customer_avatar": comment.customer.Avatar or "", "product_id": comment.product_id, "product_name": comment.product.ProductName, "parent_id": comment.parent_id, "content": comment.content, "admin_reply": {"content": admin_reply.content} if admin_reply else None, "liked": liked, "likes": likes, "replies": replies, "created_at": comment.created_at.isoformat(), "updated_at": comment.updated_at.isoformat()}


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
def create_review(request):
    from .models import Review, ReviewMedia
    customer_id = request.data.get("customer_id"); product_id = request.data.get("product_id")
    rating = request.data.get("rating"); content = request.data.get("content", "").strip()
    media_list = request.data.get("media", []); variant_id = request.data.get("variant_id")
    if not customer_id or not product_id: return Response({"ok": False, "error": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        rating = int(rating)
        if not (1 <= rating <= 5): raise ValueError
    except: return Response({"ok": False, "error": "Rating phải từ 1–5"}, status=status.HTTP_400_BAD_REQUEST)
    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer: return Response({"ok": False, "error": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    product = Product.objects.filter(ProductID=product_id).first()
    if not product: return Response({"ok": False, "error": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    if Review.objects.filter(customer=customer, product=product).exists(): return Response({"ok": False, "error": "Bạn đã đánh giá sản phẩm này rồi"}, status=status.HTTP_400_BAD_REQUEST)
    variant = ProductVariant.objects.filter(VariantID=variant_id).first() if variant_id else None
    review = Review.objects.create(customer=customer, product=product, variant=variant, rating=rating, content=content)
    for m in media_list:
        url = m.get("url", ""); mtype = m.get("type", "image")
        if url: ReviewMedia.objects.create(review=review, url=url, media_type=mtype)
    return Response({"ok": True, "review": _serialize_review(review, customer_id)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
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
    except: return Response({"ok": False, "error": "Rating phải từ 1–5"}, status=status.HTTP_400_BAD_REQUEST)
    review.rating = rating; review.content = content; review.save()
    ReviewMedia.objects.filter(review=review).delete()
    for m in media_list:
        url = m.get("url", ""); mtype = m.get("type", "image")
        if url: ReviewMedia.objects.create(review=review, url=url, media_type=mtype)
    return Response({"ok": True, "review": _serialize_review(review, customer_id)}, status=status.HTTP_200_OK)


@api_view(['POST'])
def delete_review(request):
    from .models import Review
    review_id = request.data.get("review_id"); customer_id = request.data.get("customer_id")
    review = Review.objects.filter(id=review_id, customer_id=customer_id).first()
    if not review: return Response({"ok": False, "error": "Không tìm thấy đánh giá"}, status=status.HTTP_404_NOT_FOUND)
    review.delete()
    return Response({"ok": True, "message": "Đã xóa đánh giá"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def upload_review_media(request):
    customer_id = request.data.get("customer_id"); media_file = request.FILES.get("file")
    if not customer_id or not media_file: return Response({"ok": False, "error": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if media_file.size > 200 * 1024 * 1024: return Response({"ok": False, "error": "File quá lớn (tối đa 200MB)"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        resource_type = "video" if media_file.content_type.startswith("video") else "image"
        result = cloudinary.uploader.upload(media_file, folder=f"sellphone/reviews/{customer_id}", resource_type=resource_type)
        return Response({"ok": True, "url": result["secure_url"], "media_type": resource_type}, status=status.HTTP_200_OK)
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
def create_comment(request):
    from .models import Comment
    customer_id = request.data.get("customer_id"); product_id = request.data.get("product_id")
    content = request.data.get("content", "").strip(); parent_id = request.data.get("parent_id")
    if not customer_id or not product_id: return Response({"ok": False, "error": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if not content: return Response({"ok": False, "error": "Nội dung bình luận không được để trống"}, status=status.HTTP_400_BAD_REQUEST)
    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer: return Response({"ok": False, "error": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    product = Product.objects.filter(ProductID=product_id).first()
    if not product: return Response({"ok": False, "error": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)
    parent = Comment.objects.filter(id=parent_id).first() if parent_id else None
    comment = Comment.objects.create(customer=customer, product=product, parent=parent, content=content)
    return Response({"ok": True, "comment": _serialize_comment(comment, customer_id)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def delete_comment(request):
    from .models import Comment
    comment_id = request.data.get("comment_id"); customer_id = request.data.get("customer_id")
    comment = Comment.objects.filter(id=comment_id, customer_id=customer_id).first()
    if not comment: return Response({"ok": False, "error": "Không tìm thấy bình luận"}, status=status.HTTP_404_NOT_FOUND)
    comment.delete()
    return Response({"ok": True, "message": "Đã xóa bình luận"}, status=status.HTTP_200_OK)


@api_view(['POST'])
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
    return Response({"ok": True, "liked": liked, "count": count}, status=status.HTTP_200_OK)


@api_view(['GET'])
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
def admin_reply(request):
    from .models import AdminReply
    target_type = request.data.get("type"); target_id = request.data.get("target_id"); content = request.data.get("content", "").strip()
    if not target_type or not target_id: return Response({"ok": False, "error": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if target_type not in ("review", "comment"): return Response({"ok": False, "error": "type không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    if not content: return Response({"ok": False, "error": "Nội dung phản hồi không được để trống"}, status=status.HTTP_400_BAD_REQUEST)
    obj, _ = AdminReply.objects.update_or_create(target_type=target_type, target_id=int(target_id), defaults={"content": content})
    return Response({"ok": True, "message": "Đã phản hồi thành công", "reply": {"id": obj.id, "content": obj.content}}, status=status.HTTP_200_OK)


@api_view(['POST'])
def admin_delete_reply(request):
    from .models import AdminReply
    target_type = request.data.get("type"); target_id = request.data.get("target_id")
    reply = AdminReply.objects.filter(target_type=target_type, target_id=target_id).first()
    if not reply: return Response({"ok": False, "error": "Không tìm thấy phản hồi"}, status=status.HTTP_404_NOT_FOUND)
    reply.delete()
    return Response({"ok": True, "message": "Đã xóa phản hồi"}, status=status.HTTP_200_OK)


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
def rebuild_search_index(request):
    from .search_engine import rebuild_index, get_version
    v = rebuild_index()
    return Response({"ok": True, "version": v})


@api_view(['GET'])
def search_model_info(request):
    from .yolo_search   import get_model_info
    from .search_engine import get_index, get_version
    idx = get_index()
    return Response({"text_index": {"docs": idx.N, "version": get_version()}, "yolo_model": get_model_info()})


# ══════════════════════════════════════════════════════════════
# PAYMENT — MoMo & VNPay
# ══════════════════════════════════════════════════════════════

MOMO_CONFIG = {
    "partner_code": "MOMO",
    "access_key":   "F8BBA842ECF85",
    "secret_key":   "K951B6PE1waDMi640xX08PD3vg6EkVlz",
    "endpoint":     "https://test-payment.momo.vn/v2/gateway/api/create",
    "redirect_url": "http://localhost:3000/payment/momo-return",
    "ipn_url":      "http://localhost:8000/api/payment/momo/ipn/",
}

VNPAY_CONFIG = {
    "tmn_code":    "DEMO1234",
    "hash_secret": "ABCDEFGHIJKLMNOP",
    "url":         "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    "return_url":  "http://localhost:3000/payment/vnpay-return",
}


@api_view(['POST'])
def momo_create(request):
    import hmac, hashlib, uuid, urllib.request
    order_id = request.data.get("order_id"); amount = request.data.get("amount")
    if not order_id or not amount: return Response({"message": "Thiếu order_id hoặc amount"}, status=status.HTTP_400_BAD_REQUEST)
    request_id = str(uuid.uuid4())
    order_info = f"Thanh toan don hang #{order_id}"
    extra_data = ""
    momo_order_id = f"{order_id}-{int(time.time())}"   # ← thêm timestamp, tránh trùng
    raw = f"accessKey={MOMO_CONFIG['access_key']}&amount={int(amount)}&extraData={extra_data}&ipnUrl={MOMO_CONFIG['ipn_url']}&orderId={momo_order_id}&orderInfo={order_info}&partnerCode={MOMO_CONFIG['partner_code']}&redirectUrl={MOMO_CONFIG['redirect_url']}&requestId={request_id}&requestType=payWithATM"
    sig = hmac.new(MOMO_CONFIG["secret_key"].encode("utf-8"), raw.encode("utf-8"), hashlib.sha256).hexdigest()
    payload = json.dumps({"partnerCode": MOMO_CONFIG["partner_code"], "accessKey": MOMO_CONFIG["access_key"], "requestId": request_id, "amount": str(int(amount)), "orderId": momo_order_id, "orderInfo": order_info, "redirectUrl": MOMO_CONFIG["redirect_url"], "ipnUrl": MOMO_CONFIG["ipn_url"], "extraData": extra_data, "requestType": "payWithATM", "signature": sig, "lang": "vi"}).encode("utf-8")
    try:
        req = urllib.request.Request(MOMO_CONFIG["endpoint"], data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if data.get("resultCode") != 0: return Response({"message": data.get("message", "MoMo error")}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"pay_url": data["payUrl"]}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"message": f"Lỗi MoMo: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def momo_ipn(request):
    result_code = request.data.get('resultCode'); order_id = request.data.get('orderId')
    if result_code == 0:
        o = Order.objects.filter(OrderID=order_id).first()
        if o:
            try: o.PaymentStatus = "Paid"; o.save()
            except: pass
    return Response({"message": "IPN received"}, status=status.HTTP_200_OK)


@api_view(['GET'])
def momo_return(request):
    result_code = request.query_params.get("resultCode", "-1"); order_id = request.query_params.get("orderId")
    if result_code == "0": return Response({"success": True, "order_id": order_id, "message": "Thanh toán thành công"})
    return Response({"success": False, "order_id": order_id, "message": "Thanh toán thất bại hoặc bị hủy"})


@api_view(['POST'])
def vnpay_create(request):
    import hmac, hashlib, urllib.parse
    order_id = request.data.get("order_id"); amount = request.data.get("amount")
    if not order_id or not amount: return Response({"message": "Thiếu order_id hoặc amount"}, status=status.HTTP_400_BAD_REQUEST)
    now = datetime.datetime.now(); txn_ref = f"{order_id}-{int(now.timestamp())}"
    params = {"vnp_Version": "2.1.0", "vnp_Command": "pay", "vnp_TmnCode": VNPAY_CONFIG["tmn_code"], "vnp_Amount": str(int(amount) * 100), "vnp_CurrCode": "VND", "vnp_TxnRef": txn_ref, "vnp_OrderInfo": f"Thanh toan don hang {order_id}", "vnp_OrderType": "other", "vnp_Locale": "vn", "vnp_ReturnUrl": VNPAY_CONFIG["return_url"], "vnp_IpAddr": request.META.get("REMOTE_ADDR", "127.0.0.1"), "vnp_CreateDate": now.strftime("%Y%m%d%H%M%S")}
    sorted_params = sorted(params.items()); query_str = urllib.parse.urlencode(sorted_params)
    sig = hmac.new(VNPAY_CONFIG["hash_secret"].encode("utf-8"), query_str.encode("utf-8"), hashlib.sha512).hexdigest()
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
    return Response({"today": {"revenue": today_rev, "orders": qs.filter(OrderDate__date=today).count(), "vs_yesterday": pct(today_rev, yesterday_rev)}, "this_month": {"revenue": month_rev, "orders": qs.filter(OrderDate__year=today.year, OrderDate__month=today.month).count(), "vs_last_month": pct(month_rev, last_month_rev)}, "this_year": {"revenue": year_rev, "vs_last_year": pct(year_rev, last_year_rev)}, "all_time": {"revenue": total_rev, "orders": Order.objects.count()}})


@api_view(['GET'])
def dashboard_revenue_by_day(request):
    today = tz.localdate(); year = int(request.query_params.get("year", today.year)); month = int(request.query_params.get("month", today.month))
    qs   = _revenue_qs().filter(OrderDate__year=year, OrderDate__month=month)
    rows = qs.annotate(day=TruncDay("OrderDate")).values("day").annotate(revenue=Sum("TotalAmount"), orders=Count("OrderID")).order_by("day")
    first_this = datetime.date(year, month, 1); first_prev = (first_this - datetime.timedelta(days=1)).replace(day=1)
    prev_rows  = {r["day"].day: float(r["revenue"]) for r in _revenue_qs().filter(OrderDate__year=first_prev.year, OrderDate__month=first_prev.month).annotate(day=TruncDay("OrderDate")).values("day").annotate(revenue=Sum("TotalAmount"))}
    result = [{"date": r["day"].strftime("%Y-%m-%d"), "day": r["day"].day, "revenue": float(r["revenue"]), "orders": r["orders"], "prev_revenue": prev_rows.get(r["day"].day, 0)} for r in rows]
    return Response({"year": year, "month": month, "data": result})


@api_view(['GET'])
def dashboard_revenue_by_month(request):
    today = tz.localdate(); year = int(request.query_params.get("year", today.year))
    qs    = _revenue_qs().filter(OrderDate__year=year)
    rows  = qs.annotate(month=TruncMonth("OrderDate")).values("month").annotate(revenue=Sum("TotalAmount"), orders=Count("OrderID")).order_by("month")
    prev_rows = {r["month"].month: float(r["revenue"]) for r in _revenue_qs().filter(OrderDate__year=year - 1).annotate(month=TruncMonth("OrderDate")).values("month").annotate(revenue=Sum("TotalAmount"))}
    result = [{"month": r["month"].month, "label": f"T{r['month'].month}/{year}", "revenue": float(r["revenue"]), "orders": r["orders"], "prev_revenue": prev_rows.get(r["month"].month, 0)} for r in rows]
    return Response({"year": year, "data": result})


@api_view(['GET'])
def dashboard_revenue_by_year(request):
    rows   = _revenue_qs().annotate(year=TruncYear("OrderDate")).values("year").annotate(revenue=Sum("TotalAmount"), orders=Count("OrderID")).order_by("year")
    result = [{"year": r["year"].year, "revenue": float(r["revenue"]), "orders": r["orders"]} for r in rows]
    return Response({"data": result})


@api_view(['GET'])
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
def admin_list_customers(request):
    customers = Customer.objects.all().order_by('-CustomerID')
    data = [{"id": c.CustomerID, "full_name": c.FullName, "email": c.Email, "phone": c.PhoneNumber or "", "address": c.Address or "", "login_type": c.LoginType, "order_count": Order.objects.filter(CustomerID=c.CustomerID).count(), "total_spent": float(Order.objects.filter(CustomerID=c.CustomerID, Status='Delivered').aggregate(s=Sum('TotalAmount'))['s'] or 0)} for c in customers]
    return Response({"customers": data}, status=status.HTTP_200_OK)