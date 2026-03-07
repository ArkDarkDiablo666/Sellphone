import json
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
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Customer, Staff, Product, ProductVariant, ProductImage, Category, generate_customer_id, Order, OrderDetail, Post, ProductContent, ReturnRequest, ReturnMedia

otp_storage = {}


def hash_password(password):
    return make_password(password)


def customer_data(customer):
    avatar = customer.Avatar or ""
    return {
        "id":         customer.CustomerID,
        "full_name":  customer.FullName,
        "email":      customer.Email,
        "avatar":     avatar,
        "login_type": customer.LoginType,
    }


def create_customer(**kwargs):
    customer_id = generate_customer_id()
    return Customer.objects.create(CustomerID=customer_id, **kwargs)


def email_exists_message(existing_login_type):
    if existing_login_type == 'google':
        return "Email này đã được đăng ký bằng Google, vui lòng đăng nhập bằng Google"
    elif existing_login_type == 'facebook':
        return "Email này đã được đăng ký bằng Facebook, vui lòng đăng nhập bằng Facebook"
    else:
        return "Email này đã được đăng ký, vui lòng đăng nhập bằng email và mật khẩu"


@api_view(['POST'])
def check_email(request):
    email = request.data.get('email', '').strip()
    if not email:
        return Response({"message": "Vui lòng nhập email"}, status=status.HTTP_400_BAD_REQUEST)
    existing = Customer.objects.filter(Email=email).first()
    if existing:
        return Response({"message": email_exists_message(existing.LoginType)}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"message": "Email hợp lệ"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def register_normal(request):
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()
    password  = request.data.get('password', '').strip()

    if not full_name:
        return Response({"message": "Vui lòng nhập họ và tên", "field": "fullname"}, status=status.HTTP_400_BAD_REQUEST)
    if not email:
        return Response({"message": "Vui lòng nhập email", "field": "email"}, status=status.HTTP_400_BAD_REQUEST)
    if not password:
        return Response({"message": "Vui lòng nhập mật khẩu", "field": "password"}, status=status.HTTP_400_BAD_REQUEST)
    if ' ' in password:
        return Response({"message": "Mật khẩu không được chứa dấu cách", "field": "password"}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 6:
        return Response({"message": "Mật khẩu phải có ít nhất 6 ký tự", "field": "password"}, status=status.HTTP_400_BAD_REQUEST)

    existing = Customer.objects.filter(Email=email).first()
    if existing:
        return Response({"message": email_exists_message(existing.LoginType), "field": "email"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        customer = create_customer(FullName=full_name, Email=email, Password=hash_password(password), LoginType='normal')
    except ValueError as e:
        return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"message": "Đăng ký thành công", "customer": customer_data(customer)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def login_normal(request):
    email    = request.data.get('email', '').strip()
    password = request.data.get('password', '').strip()

    if not email:
        return Response({"message": "Vui lòng nhập email", "field": "email"}, status=status.HTTP_400_BAD_REQUEST)
    if not password:
        return Response({"message": "Vui lòng nhập mật khẩu", "field": "password"}, status=status.HTTP_400_BAD_REQUEST)

    existing = Customer.objects.filter(Email=email).first()
    if not existing:
        return Response({"message": "Email không tồn tại", "field": "email"}, status=status.HTTP_404_NOT_FOUND)
    if existing.LoginType != 'normal':
        return Response({"message": email_exists_message(existing.LoginType), "field": "email"}, status=status.HTTP_400_BAD_REQUEST)
    if not check_password(password, existing.Password):
        return Response({"message": "Mật khẩu không đúng", "field": "password"}, status=status.HTTP_401_UNAUTHORIZED)

    avatar = existing.Avatar or ""
    if avatar.startswith("data:"): avatar = ""

    return Response({
        "message": "Đăng nhập thành công",
        "customer": {
            "id":         existing.CustomerID,
            "full_name":  existing.FullName,
            "email":      existing.Email,
            "avatar":     avatar,
            "login_type": existing.LoginType,
        }
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def register_google(request):
    google_id = request.data.get('google_id', '').strip()
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()
    avatar    = request.data.get('avatar', '')

    if not google_id or not email or not full_name:
        return Response({"message": "Thiếu thông tin từ Google"}, status=status.HTTP_400_BAD_REQUEST)

    existing = Customer.objects.filter(Email=email).first()
    if existing:
        return Response({"message": email_exists_message(existing.LoginType)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        customer = create_customer(FullName=full_name, Email=email, Password=None, GoogleID=google_id, Avatar=avatar, LoginType='google')
    except ValueError as e:
        return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"message": "Đăng ký Google thành công", "customer": customer_data(customer)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def login_google(request):
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()

    if not full_name or not email:
        return Response({"message": "Thiếu thông tin Google"}, status=status.HTTP_400_BAD_REQUEST)

    existing = Customer.objects.filter(Email=email).first()
    if not existing:
        return Response({"message": "Tài khoản Google chưa được đăng ký"}, status=status.HTTP_404_NOT_FOUND)
    if existing.LoginType != 'google':
        return Response({"message": email_exists_message(existing.LoginType)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        "message": "Đăng nhập Google thành công",
        "customer": {
            "id":         existing.CustomerID,
            "full_name":  existing.FullName,
            "email":      existing.Email,
            "avatar":     existing.Avatar or "",
            "login_type": existing.LoginType,
        }
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def register_facebook(request):
    facebook_id = request.data.get('facebook_id', '').strip()
    full_name   = request.data.get('full_name', '').strip()
    email       = request.data.get('email', '')
    avatar      = request.data.get('avatar', '')

    if not facebook_id or not full_name:
        return Response({"message": "Thiếu thông tin từ Facebook"}, status=status.HTTP_400_BAD_REQUEST)

    if email:
        existing = Customer.objects.filter(Email=email).first()
        if existing:
            return Response({"message": email_exists_message(existing.LoginType)}, status=status.HTTP_400_BAD_REQUEST)

    try:
        customer = create_customer(
            FullName=full_name,
            Email=email if email else f"fb_{facebook_id}@noemail.com",
            Password=None, FacebookID=facebook_id, Avatar=avatar, LoginType='facebook'
        )
    except ValueError as e:
        return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"message": "Đăng ký Facebook thành công", "customer": customer_data(customer)}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def login_facebook(request):
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()

    if not full_name or not email:
        return Response({"message": "Thiếu thông tin Facebook"}, status=status.HTTP_400_BAD_REQUEST)

    existing = Customer.objects.filter(Email=email).first()
    if not existing:
        return Response({"message": "Tài khoản Facebook chưa được đăng ký"}, status=status.HTTP_404_NOT_FOUND)
    if existing.LoginType != 'facebook':
        return Response({"message": email_exists_message(existing.LoginType)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        "message": "Đăng nhập Facebook thành công",
        "customer": {
            "id":         existing.CustomerID,
            "full_name":  existing.FullName,
            "email":      existing.Email,
            "avatar":     existing.Avatar or "",
            "login_type": existing.LoginType,
        }
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def forgot_password(request):
    email = request.data.get('email', '').strip()
    if not email:
        return Response({"message": "Vui lòng nhập email"}, status=status.HTTP_400_BAD_REQUEST)

    existing = Customer.objects.filter(Email=email).first()
    if not existing:
        return Response({"message": "Email chưa được đăng ký"}, status=status.HTTP_404_NOT_FOUND)
    if existing.LoginType == 'google':
        return Response({"message": "Email này đã đăng ký bằng Google, vui lòng đăng nhập bằng Google"}, status=status.HTTP_400_BAD_REQUEST)
    if existing.LoginType == 'facebook':
        return Response({"message": "Email này đã đăng ký bằng Facebook, vui lòng đăng nhập bằng Facebook"}, status=status.HTTP_400_BAD_REQUEST)

    otp_code = str(random.randint(100000, 999999))
    otp_storage[email] = otp_code

    try:
        send_mail(
            subject    = "Mã OTP đặt lại mật khẩu - Sellphone",
            message    = f"Mã OTP của bạn là: {otp_code}\nMã có hiệu lực trong 5 phút.",
            from_email = settings.EMAIL_HOST_USER,
            recipient_list = [email],
            fail_silently  = False,
        )
    except Exception as e:
        return Response({"message": f"Không thể gửi email: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({"message": "OTP đã được gửi đến email của bạn"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def verify_otp(request):
    email    = request.data.get('email', '').strip()
    otp_code = request.data.get('otp', '').strip()

    if not email or not otp_code:
        return Response({"message": "Thiếu email hoặc OTP"}, status=status.HTTP_400_BAD_REQUEST)

    stored_otp = otp_storage.get(email)
    if not stored_otp:
        return Response({"message": "OTP đã hết hạn, vui lòng gửi lại"}, status=status.HTTP_400_BAD_REQUEST)
    if otp_code != stored_otp:
        return Response({"message": "Mã OTP không đúng"}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"message": "OTP hợp lệ"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def reset_password(request):
    email        = request.data.get('email', '').strip()
    new_password = request.data.get('new_password', '').strip()

    if not email or not new_password:
        return Response({"message": "Thiếu email hoặc mật khẩu"}, status=status.HTTP_400_BAD_REQUEST)
    if ' ' in new_password:
        return Response({"message": "Mật khẩu không được chứa dấu cách"}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 6:
        return Response({"message": "Mật khẩu phải có ít nhất 6 ký tự"}, status=status.HTTP_400_BAD_REQUEST)

    customer = Customer.objects.filter(Email=email, LoginType='normal').first()
    if not customer:
        return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)

    customer.Password = hash_password(new_password)
    customer.save()
    if email in otp_storage:
        del otp_storage[email]

    return Response({"message": "Đặt lại mật khẩu thành công"}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_customer(request, customer_id):
    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer:
        return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        "id":           customer.CustomerID,
        "full_name":    customer.FullName,
        "email":        customer.Email,
        "phone_number": customer.PhoneNumber or "",
        "address":      customer.Address or "",
        "avatar":       customer.Avatar or "",
        "login_type":   customer.LoginType,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def update_customer(request):
    customer_id = request.data.get('id', '').strip()
    phone       = request.data.get('phone_number', None)
    address     = request.data.get('address', None)

    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer:
        return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)

    avatar = request.data.get('avatar', None)

    if phone is not None:   customer.PhoneNumber = phone.strip()
    if address is not None: customer.Address     = address.strip()
    if avatar is not None:
        try:
            upload_result = cloudinary.uploader.upload(
                avatar, folder="sellphone/avatars", public_id=f"avatar_{customer_id}",
                overwrite=True, resource_type="image",
                transformation=[{"width": 300, "height": 300, "crop": "fill", "gravity": "face"}],
            )
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

    if not customer_id or not current_password or not new_password:
        return Response({"message": "Vui lòng điền đầy đủ thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if ' ' in new_password:
        return Response({"message": "Mật khẩu không được chứa dấu cách"}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 6:
        return Response({"message": "Mật khẩu phải có ít nhất 6 ký tự"}, status=status.HTTP_400_BAD_REQUEST)

    customer = Customer.objects.filter(CustomerID=customer_id, LoginType='normal').first()
    if not customer:
        return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    if not check_password(current_password, customer.Password):
        return Response({"message": "Mật khẩu hiện tại không đúng"}, status=status.HTTP_401_UNAUTHORIZED)

    customer.Password = hash_password(new_password)
    customer.save()
    return Response({"message": "Đổi mật khẩu thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def upload_avatar(request):
    customer_id = request.data.get('id', '').strip()
    avatar_file = request.FILES.get('avatar_file')

    if not customer_id or not avatar_file:
        return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)

    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer:
        return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)

    try:
        upload_result = cloudinary.uploader.upload(
            avatar_file, folder="sellphone/avatars", public_id=f"avatar_{customer_id}",
            overwrite=True, resource_type="image",
            transformation=[{"width": 300, "height": 300, "crop": "fill", "gravity": "face"}],
        )
        avatar_url = upload_result["secure_url"]
        customer.Avatar = avatar_url
        customer.save()
        return Response({"message": "Upload avatar thành công", "avatar_url": avatar_url}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"message": f"Lỗi upload: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def admin_login(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()

    if not username:
        return Response({"message": "Vui lòng nhập tên tài khoản", "field": "username"}, status=status.HTTP_400_BAD_REQUEST)
    if not password:
        return Response({"message": "Vui lòng nhập mật khẩu", "field": "password"}, status=status.HTTP_400_BAD_REQUEST)

    staff = Staff.objects.filter(Email=username).first()
    if not staff:
        return Response({"message": "Tài khoản không tồn tại", "field": "username"}, status=status.HTTP_404_NOT_FOUND)
    if not check_password(password, staff.Password):
        return Response({"message": "Mật khẩu không đúng", "field": "password"}, status=status.HTTP_401_UNAUTHORIZED)
    if staff.Role == 'Unentitled':
        return Response({"message": "Bạn không có quyền truy cập", "field": "general"}, status=status.HTTP_403_FORBIDDEN)

    return Response({
        "message": "Đăng nhập thành công",
        "admin": {
            "id":        staff.StaffID,
            "full_name": staff.FullName,
            "username":  staff.Email,
            "role":      staff.Role,
            "avatar":    "",
        }
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_staff(request, staff_id):
    staff = Staff.objects.filter(StaffID=staff_id).first()
    if not staff:
        return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    return Response({
        "id":        staff.StaffID,
        "full_name": staff.FullName,
        "email":     staff.Email,
        "role":      staff.Role,
        "avatar":    staff.Avatar or "" if hasattr(staff, 'Avatar') else "",
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
def list_staff(request):
    staff_list = Staff.objects.all().order_by('StaffID')
    data = [{
        "id":        s.StaffID,
        "full_name": s.FullName,
        "email":     s.Email,
        "role":      s.Role,
        "avatar":    s.Avatar or "" if hasattr(s, 'Avatar') else "",
    } for s in staff_list]
    return Response({"staff": data}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_staff(request):
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()
    password  = request.data.get('password', '').strip()
    role      = request.data.get('role', 'Staff').strip()

    if not full_name or not email or not password:
        return Response({"message": "Vui lòng điền đầy đủ thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 6:
        return Response({"message": "Mật khẩu phải có ít nhất 6 ký tự"}, status=status.HTTP_400_BAD_REQUEST)
    if role not in ['Admin', 'Staff', 'Unentitled']:
        return Response({"message": "Vai trò không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    if Staff.objects.filter(Email=email).exists():
        return Response({"message": "Email đã tồn tại"}, status=status.HTTP_400_BAD_REQUEST)

    staff = Staff.objects.create(FullName=full_name, Email=email, Password=make_password(password), Role=role)
    return Response({
        "message": "Tạo tài khoản thành công",
        "staff":   {"id": staff.StaffID, "full_name": staff.FullName, "email": staff.Email, "role": staff.Role},
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def update_staff_role(request):
    staff_id = request.data.get('id')
    role     = request.data.get('role', '').strip()

    if not staff_id or not role:
        return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if role not in ['Admin', 'Staff', 'Unentitled']:
        return Response({"message": "Vai trò không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

    staff = Staff.objects.filter(StaffID=staff_id).first()
    if not staff:
        return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)

    staff.Role = role
    staff.save()
    return Response({"message": "Cập nhật quyền thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def change_staff_password(request):
    staff_id         = request.data.get('id')
    current_password = request.data.get('current_password', '').strip()
    new_password     = request.data.get('new_password', '').strip()

    if not staff_id or not current_password or not new_password:
        return Response({"message": "Vui lòng điền đầy đủ thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if ' ' in new_password:
        return Response({"message": "Mật khẩu không được chứa dấu cách"}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 6:
        return Response({"message": "Mật khẩu phải có ít nhất 6 ký tự"}, status=status.HTTP_400_BAD_REQUEST)

    staff = Staff.objects.filter(StaffID=staff_id).first()
    if not staff:
        return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
    if not check_password(current_password, staff.Password):
        return Response({"message": "Mật khẩu hiện tại không đúng"}, status=status.HTTP_401_UNAUTHORIZED)

    staff.Password = make_password(new_password)
    staff.save()
    return Response({"message": "Đổi mật khẩu thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def upload_staff_avatar(request):
    staff_id    = request.data.get('id')
    avatar_file = request.FILES.get('avatar_file')

    if not staff_id or not avatar_file:
        return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)

    staff = Staff.objects.filter(StaffID=staff_id).first()
    if not staff:
        return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)

    try:
        upload_result = cloudinary.uploader.upload(
            avatar_file, folder="sellphone/staff_avatars", public_id=f"staff_avatar_{staff_id}",
            overwrite=True, resource_type="image",
            transformation=[{"width": 300, "height": 300, "crop": "fill", "gravity": "face"}],
        )
        avatar_url = upload_result["secure_url"]
        staff.Avatar = avatar_url
        staff.save()
        return Response({"message": "Upload thành công", "avatar_url": avatar_url}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"message": f"Lỗi upload: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def list_categories(request):
    cats = Category.objects.all().order_by('CategoryID')
    return Response({
        "categories": [{
            "id":    c.CategoryID,
            "name":  c.CategoryName,
            "image": c.Image or "" if hasattr(c, 'Image') else "",
        } for c in cats]
    }, status=status.HTTP_200_OK)


import re as _re

def _validate_variants(variants):
    errors = []
    for idx, v in enumerate(variants):
        ve = {}
        label = f"Biến thể #{idx + 1}"

        price_raw = v.get('price', '')
        try:
            price = float(price_raw)
            if price <= 0: ve['price'] = f"{label}: Giá phải lớn hơn 0"
        except (ValueError, TypeError):
            ve['price'] = f"{label}: Giá không hợp lệ"

        stock_raw = v.get('stock', '')
        try:
            stock = int(stock_raw)
            if stock <= 0:   ve['stock'] = f"{label}: Số lượng phải lớn hơn 0"
            elif stock > 10000: ve['stock'] = f"{label}: Số lượng tối đa 10.000"
        except (ValueError, TypeError):
            ve['stock'] = f"{label}: Số lượng không hợp lệ"

        ram = (v.get('ram') or '').strip()
        if not ram:
            ve['ram'] = f"{label}: Vui lòng nhập RAM"
        else:
            m = _re.match(r'^(\d+(?:\.\d+)?)\s*GB$', ram, _re.IGNORECASE)
            if not m: ve['ram'] = f"{label}: RAM phải có dạng số + GB (VD: 8GB)"
            elif float(m.group(1)) < 4: ve['ram'] = f"{label}: RAM tối thiểu là 4GB"

        storage = (v.get('storage') or '').strip()
        if storage:
            m = _re.match(r'^(\d+(?:\.\d+)?)\s*(GB|TB)$', storage, _re.IGNORECASE)
            if not m:
                ve['storage'] = f"{label}: Bộ nhớ phải có dạng số + GB/TB (VD: 128GB, 1TB)"
            else:
                num  = float(m.group(1))
                unit = m.group(2).upper()
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

    if not product_name:
        return Response({"message": "Vui lòng nhập tên sản phẩm"}, status=status.HTTP_400_BAD_REQUEST)
    if not category_id:
        return Response({"message": "Vui lòng chọn danh mục"}, status=status.HTTP_400_BAD_REQUEST)

    category = Category.objects.filter(CategoryID=category_id).first()
    if not category:
        return Response({"message": "Danh mục không tồn tại"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        variants = json.loads(variants_raw)
    except Exception:
        return Response({"message": "Dữ liệu biến thể không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

    if not variants:
        return Response({"message": "Cần ít nhất 1 biến thể"}, status=status.HTTP_400_BAD_REQUEST)

    variant_errors = _validate_variants(variants)
    all_errors = [e for e in variant_errors if e]
    if all_errors:
        messages = []
        for ve in all_errors: messages.extend(ve.values())
        return Response({"message": " | ".join(messages), "variant_errors": variant_errors}, status=status.HTTP_400_BAD_REQUEST)

    product = Product.objects.create(
        ProductName=product_name, Brand=brand or None,
        Description=description or None, CategoryID=category,
    )

    for idx, v in enumerate(variants):
        variant_obj = ProductVariant.objects.create(
            ProductID=product, Color=v.get('color') or None, Storage=v.get('storage') or None,
            Ram=v.get('ram') or None, Price=float(v.get('price', 0)), StockQuantity=int(v.get('stock', 0)),
            Cpu=v.get('cpu') or None, OperatingSystem=v.get('os') or None, ScreenSize=v.get('screenSize') or None,
            ScreenTechnology=v.get('screenTech') or None, RefreshRate=v.get('refreshRate') or None,
            Battery=v.get('battery') or None, ChargingSpeed=v.get('chargingSpeed') or None,
            FrontCamera=v.get('frontCamera') or None, RearCamera=v.get('rearCamera') or None,
            Weights=v.get('weights') or None, Updates=v.get('updates') or None,
        )
        variant_img = request.FILES.get(f'variant_image_{idx}')
        if variant_img:
            try:
                result = cloudinary.uploader.upload(
                    variant_img, folder=f"sellphone/variants/{product.ProductID}",
                    public_id=f"variant_{variant_obj.VariantID}", overwrite=True, resource_type="image",
                    transformation=[{"width": 800, "height": 800, "crop": "limit"}],
                )
                variant_obj.Image = result["secure_url"]
                variant_obj.save()
            except Exception: pass

    for idx, img_file in enumerate(images):
        try:
            result = cloudinary.uploader.upload(
                img_file, folder=f"sellphone/products/{product.ProductID}",
                public_id=f"product_{product.ProductID}_img_{idx}", overwrite=True, resource_type="image",
                transformation=[{"width": 800, "height": 800, "crop": "limit"}],
            )
            ProductImage.objects.create(ProductID=product, ImageUrl=result["secure_url"], IsPrimary=(idx == 0))
        except Exception: pass

    return Response({"message": "Tạo sản phẩm thành công", "product_id": product.ProductID}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def get_product_variants(request, product_id):
    product = Product.objects.filter(ProductID=product_id).first()
    if not product:
        return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)

    variants = ProductVariant.objects.filter(ProductID=product)
    data = [{
        "id":      v.VariantID,
        "color":   v.Color or "",
        "storage": v.Storage or "",
        "ram":     v.Ram or "",
        "price":   str(v.Price),
        "stock":   v.StockQuantity,
    } for v in variants]
    return Response({"variants": data}, status=status.HTTP_200_OK)


@api_view(['POST'])
def import_stock(request):
    items = request.data.get('items', [])
    if not items:
        return Response({"message": "Không có dữ liệu nhập hàng"}, status=status.HTTP_400_BAD_REQUEST)

    updated = []
    for item in items:
        variant_id = item.get('variant_id')
        quantity   = int(item.get('quantity', 0))
        if quantity <= 0: continue
        variant = ProductVariant.objects.filter(VariantID=variant_id).first()
        if variant:
            variant.StockQuantity += quantity
            variant.save()
            updated.append({"variant_id": variant_id, "new_stock": variant.StockQuantity})

    return Response({"message": f"Đã nhập hàng cho {len(updated)} biến thể", "updated": updated}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_category(request):
    name       = request.data.get('name', '').strip()
    image_file = request.FILES.get('image')

    if not name:
        return Response({"message": "Vui lòng nhập tên danh mục"}, status=status.HTTP_400_BAD_REQUEST)
    if Category.objects.filter(CategoryName=name).exists():
        return Response({"message": "Danh mục đã tồn tại"}, status=status.HTTP_400_BAD_REQUEST)

    image_url = ""
    if image_file:
        try:
            result = cloudinary.uploader.upload(
                image_file, folder="sellphone/categories",
                public_id=f"category_{name.lower().replace(' ', '_')}",
                overwrite=True, resource_type="image",
                transformation=[{"width": 400, "height": 400, "crop": "fill"}],
            )
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

    if not cat_id or not name:
        return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)

    cat = Category.objects.filter(CategoryID=cat_id).first()
    if not cat:
        return Response({"message": "Không tìm thấy danh mục"}, status=status.HTTP_404_NOT_FOUND)

    cat.CategoryName = name
    if image_file:
        try:
            result = cloudinary.uploader.upload(
                image_file, folder="sellphone/categories", public_id=f"category_{cat_id}",
                overwrite=True, resource_type="image",
                transformation=[{"width": 400, "height": 400, "crop": "fill"}],
            )
            cat.Image = result["secure_url"]
        except Exception as e:
            return Response({"message": f"Lỗi upload ảnh: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    cat.save()
    return Response({"message": "Cập nhật danh mục thành công"}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_product_detail(request, product_id):
    product = Product.objects.select_related('CategoryID').filter(ProductID=product_id).first()
    if not product:
        return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)

    variants = ProductVariant.objects.filter(ProductID=product)
    images   = ProductImage.objects.filter(ProductID=product)
    related_products = Product.objects.filter(CategoryID=product.CategoryID).exclude(ProductID=product_id).order_by('-CreatedAt')[:5]

    def variant_data(v):
        return {
            "id": v.VariantID, "image": v.Image or "" if hasattr(v, "Image") else "",
            "color": v.Color or "", "storage": v.Storage or "", "ram": v.Ram or "",
            "price": str(v.Price), "stock": v.StockQuantity,
            "cpu": v.Cpu or "", "os": v.OperatingSystem or "",
            "screen_size": v.ScreenSize or "", "screen_tech": v.ScreenTechnology or "",
            "refresh_rate": v.RefreshRate or "", "battery": v.Battery or "",
            "charging_speed": v.ChargingSpeed or "", "front_camera": v.FrontCamera or "",
            "rear_camera": v.RearCamera or "", "weights": v.Weights or "", "updates": v.Updates or "",
        }

    def related_data(p):
        primary_img = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first()
        if not primary_img: primary_img = ProductImage.objects.filter(ProductID=p).first()
        min_v = ProductVariant.objects.filter(ProductID=p).order_by('Price').first()
        return {
            "id": p.ProductID, "name": p.ProductName, "brand": p.Brand or "",
            "image": primary_img.ImageUrl if primary_img else "",
            "min_price": str(min_v.Price) if min_v else "0",
        }

    images_sorted = list(images.filter(IsPrimary=True)) + list(images.filter(IsPrimary=False))
    min_variant = variants.order_by('Price').first()

    return Response({
        "product": {
            "id": product.ProductID, "name": product.ProductName, "brand": product.Brand or "",
            "description": product.Description or "", "category": product.CategoryID.CategoryName,
            "category_id": product.CategoryID.CategoryID,
        },
        "variants": [variant_data(v) for v in variants],
        "images":   [{"url": img.ImageUrl, "is_primary": img.IsPrimary} for img in images_sorted],
        "related":  [related_data(p) for p in related_products],
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
def list_products(request):
    products = Product.objects.select_related('CategoryID').all().order_by('-CreatedAt')
    data = []
    for p in products:
        variants      = ProductVariant.objects.filter(ProductID=p)
        variant_count = variants.count()
        min_v         = variants.order_by('Price').first()
        primary_img   = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first()
        if not primary_img: primary_img = ProductImage.objects.filter(ProductID=p).first()

        rams     = list(set(v.Ram     for v in variants if v.Ram))
        storages = list(set(v.Storage for v in variants if v.Storage))

        variant_list = [{
            "id":      v.VariantID,
            "color":   v.Color or "",
            "storage": v.Storage or "",
            "ram":     v.Ram or "",
            "price":   float(v.Price),
            "stock":   v.StockQuantity,
            "image":   v.Image or "",
        } for v in variants]

        data.append({
            "id": p.ProductID, "name": p.ProductName, "brand": p.Brand or "",
            "description": p.Description or "", "category": p.CategoryID.CategoryName,
            "category_id": p.CategoryID.CategoryID, "variant_count": variant_count,
            "min_price": str(min_v.Price) if min_v else "0",
            "image": primary_img.ImageUrl if primary_img else "",
            "rams": rams, "storages": storages, "variants": variant_list,
        })
    return Response({"products": data}, status=status.HTTP_200_OK)


@api_view(['POST'])
def add_variants(request):
    product_id    = request.data.get('product_id') or request.POST.get('product_id')
    variants_json = request.POST.get('variants')

    if not product_id:
        return Response({"message": "Thiếu product_id"}, status=status.HTTP_400_BAD_REQUEST)

    product = Product.objects.filter(ProductID=product_id).first()
    if not product:
        return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)

    try:
        variants = json.loads(variants_json) if variants_json else []
    except json.JSONDecodeError:
        return Response({"message": "Dữ liệu biến thể không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

    if not variants:
        return Response({"message": "Vui lòng thêm ít nhất 1 biến thể"}, status=status.HTTP_400_BAD_REQUEST)

    variant_errors = _validate_variants(variants)
    all_errors = [e for e in variant_errors if e]
    if all_errors:
        messages = []
        for ve in all_errors: messages.extend(ve.values())
        return Response({"message": " | ".join(messages), "variant_errors": variant_errors}, status=status.HTTP_400_BAD_REQUEST)

    created = []
    for idx, v in enumerate(variants):
        variant_obj = ProductVariant.objects.create(
            ProductID=product, Color=v.get('color') or None, Storage=v.get('storage') or None,
            Ram=v.get('ram') or None, Price=float(v.get('price', 0)), StockQuantity=int(v.get('stock', 0)),
            Cpu=v.get('cpu') or None, OperatingSystem=v.get('os') or None, ScreenSize=v.get('screenSize') or None,
            ScreenTechnology=v.get('screenTech') or None, RefreshRate=v.get('refreshRate') or None,
            Battery=v.get('battery') or None, ChargingSpeed=v.get('chargingSpeed') or None,
            FrontCamera=v.get('frontCamera') or None, RearCamera=v.get('rearCamera') or None,
            Weights=v.get('weights') or None, Updates=v.get('updates') or None,
        )
        variant_img = request.FILES.get(f'variant_image_{idx}')
        if variant_img:
            try:
                result = cloudinary.uploader.upload(
                    variant_img, folder=f"sellphone/variants/{product.ProductID}",
                    public_id=f"variant_{variant_obj.VariantID}", overwrite=True, resource_type="image",
                    transformation=[{"width": 800, "height": 800, "crop": "limit"}],
                )
                variant_obj.Image = result["secure_url"]
                variant_obj.save()
            except Exception: pass
        created.append(variant_obj.VariantID)

    return Response({"message": f"Đã thêm {len(created)} biến thể thành công", "variant_ids": created}, status=status.HTTP_201_CREATED)


from datetime import date as _date

# ── HELPER: format voucher object (dùng chung) ──
def _fmt_voucher(v):
    return {
        "id":           v.VoucherID,
        "code":         v.Code,
        "type":         v.Type,
        "value":        float(v.Value),
        "scope":        v.Scope,
        "category_id":  v.CategoryID.CategoryID if v.CategoryID else None,
        "product_id":   v.ProductID.ProductID   if v.ProductID  else None,
        "variant_id":   v.VariantID.VariantID   if getattr(v, 'VariantID', None) else None,  # ← KEY FIX
        "min_order":    float(v.MinOrder or 0),
        "max_discount": float(v.MaxDiscount) if v.MaxDiscount else None,
    }


@api_view(['GET'])
def list_vouchers(request):
    from .models import Voucher
    today = _date.today()
    vouchers = Voucher.objects.all().order_by('-VoucherID')
    data = []
    for v in vouchers:
        is_active = v.IsActive
        if v.EndDate and v.EndDate < today: is_active = False
        if v.UsageLimit and v.UsedCount >= v.UsageLimit: is_active = False
        d = _fmt_voucher(v)
        d.update({
            "min_order":    str(v.MinOrder),
            "max_discount": str(v.MaxDiscount) if v.MaxDiscount else None,
            "start_date":   str(v.StartDate) if v.StartDate else None,
            "end_date":     str(v.EndDate)   if v.EndDate   else None,
            "usage_limit":  v.UsageLimit,
            "used_count":   v.UsedCount,
            "is_active":    is_active,
            "description":  v.Description if hasattr(v, 'Description') else "",
        })
        data.append(d)
    return Response({"vouchers": data}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_voucher(request):
    from .models import Voucher
    code  = request.data.get('code', '').strip().upper()
    vtype = request.data.get('type', 'percent')
    value = request.data.get('value')
    scope = request.data.get('scope', 'all')

    if not code:
        return Response({"message": "Vui lòng nhập mã voucher"}, status=status.HTTP_400_BAD_REQUEST)
    if Voucher.objects.filter(Code=code).exists():
        return Response({"message": "Mã voucher đã tồn tại"}, status=status.HTTP_400_BAD_REQUEST)
    if not value or float(value) <= 0:
        return Response({"message": "Giá trị voucher không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
    if vtype == 'percent' and float(value) > 100:
        return Response({"message": "Phần trăm giảm không được vượt quá 100%"}, status=status.HTTP_400_BAD_REQUEST)

    cat_id     = request.data.get('category_id')
    prod_id    = request.data.get('product_id')
    variant_id = request.data.get('variant_id')  # ← THÊM

    cat_obj     = Category.objects.filter(CategoryID=cat_id).first()           if cat_id     else None
    prod_obj    = Product.objects.filter(ProductID=prod_id).first()             if prod_id    else None
    variant_obj = ProductVariant.objects.filter(VariantID=variant_id).first()  if variant_id else None  # ← THÊM

    start_raw   = request.data.get('start_date')
    end_raw     = request.data.get('end_date')
    start_date  = _date.fromisoformat(start_raw) if start_raw else None
    end_date    = _date.fromisoformat(end_raw)   if end_raw   else None
    min_order   = float(request.data.get('min_order', 0) or 0)
    max_disc    = request.data.get('max_discount')
    usage_limit = request.data.get('usage_limit')

    v = Voucher.objects.create(
        Code        = code,
        Type        = vtype,
        Value       = float(value),
        Scope       = scope,
        CategoryID  = cat_obj,
        ProductID   = prod_obj,
        VariantID   = variant_obj,  # ← THÊM
        MinOrder    = min_order,
        MaxDiscount = float(max_disc) if max_disc else None,
        StartDate   = start_date,
        EndDate     = end_date,
        UsageLimit  = int(usage_limit) if usage_limit else None,
        IsActive    = True,
    )
    return Response({"message": "Tạo voucher thành công", "id": v.VoucherID}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def deactivate_voucher(request):
    from .models import Voucher
    vid = request.data.get('id')
    v = Voucher.objects.filter(VoucherID=vid).first()
    if not v:
        return Response({"message": "Không tìm thấy voucher"}, status=status.HTTP_404_NOT_FOUND)
    v.IsActive = False
    v.save()
    return Response({"message": "Đã vô hiệu hóa voucher"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def apply_voucher(request):
    from .models import Voucher
    code = request.data.get('code', '').strip().upper()
    if not code:
        return Response({"message": "Vui lòng nhập mã voucher"}, status=status.HTTP_400_BAD_REQUEST)

    v = Voucher.objects.filter(Code=code).first()
    if not v:
        return Response({"message": "Mã voucher không tồn tại"}, status=status.HTTP_404_NOT_FOUND)
    if not v.IsActive:
        return Response({"message": "Voucher đã bị vô hiệu hóa"}, status=status.HTTP_400_BAD_REQUEST)

    today = _date.today()
    if v.StartDate and v.StartDate > today:
        return Response({"message": "Voucher chưa đến thời gian sử dụng"}, status=status.HTTP_400_BAD_REQUEST)
    if v.EndDate and v.EndDate < today:
        return Response({"message": "Voucher đã hết hạn"}, status=status.HTTP_400_BAD_REQUEST)
    if v.UsageLimit and v.UsedCount >= v.UsageLimit:
        return Response({"message": "Voucher đã hết lượt sử dụng"}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"message": "Áp dụng voucher thành công", "voucher": _fmt_voucher(v)}, status=status.HTTP_200_OK)


# ── HELPER: kiểm tra voucher có áp dụng cho item không (check cả variant_id) ──
def _voucher_applies(v, item):
    scope = v.Scope
    if scope == 'all': return True
    if scope == 'category' and v.CategoryID:
        return str(item.get('category_id')) == str(v.CategoryID.CategoryID)
    if scope == 'product' and v.ProductID:
        if str(item.get('product_id')) != str(v.ProductID.ProductID): return False
        # Nếu có variant_id → phải khớp
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


def _active_vouchers():
    from .models import Voucher
    today = _date.today()
    result = []
    for v in Voucher.objects.filter(IsActive=True):
        if v.StartDate and v.StartDate > today: continue
        if v.EndDate   and v.EndDate   < today: continue
        if v.UsageLimit and v.UsedCount >= v.UsageLimit: continue
        result.append(v)
    return result


@api_view(['GET'])
def list_active_vouchers(request):
    data = []
    for v in _active_vouchers():
        d = _fmt_voucher(v)
        d["description"] = v.Description if hasattr(v, 'Description') else ""
        data.append(d)
    return Response({"vouchers": data}, status=status.HTTP_200_OK)


@api_view(['POST'])
def get_best_voucher_for_cart(request):
    items = request.data.get('items', [])
    if not items:
        return Response({"voucher": None}, status=status.HTTP_200_OK)

    active = _active_vouchers()
    if not active:
        return Response({"voucher": None}, status=status.HTTP_200_OK)

    best, best_disc = None, 0
    for v in active:
        d = _calc_discount_for_items(v, items)
        if d > best_disc: best_disc = d; best = v

    if not best or best_disc <= 0:
        return Response({"voucher": None, "discount": 0}, status=status.HTTP_200_OK)

    return Response({"voucher": _fmt_voucher(best), "discount": best_disc}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_best_voucher_for_product(request):
    product_id  = request.query_params.get('product_id')
    category_id = request.query_params.get('category_id')
    variant_id  = request.query_params.get('variant_id')  # ← THÊM (optional)
    try:
        price = float(request.query_params.get('price', 0))
        qty   = int(request.query_params.get('qty', 1))
    except (ValueError, TypeError):
        return Response({"message": "price/qty không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

    if not price:
        return Response({"voucher": None}, status=status.HTTP_200_OK)

    item_list = [{"product_id": product_id, "category_id": category_id, "variant_id": variant_id, "price": price, "qty": qty}]

    active = _active_vouchers()
    if not active:
        return Response({"voucher": None}, status=status.HTTP_200_OK)

    best, best_disc = None, 0
    for v in active:
        d = _calc_discount_for_items(v, item_list)
        if d > best_disc: best_disc = d; best = v

    if not best or best_disc <= 0:
        return Response({"voucher": None, "discount": 0}, status=status.HTTP_200_OK)

    return Response({
        "voucher":     _fmt_voucher(best),
        "discount":    best_disc,
        "final_price": max(0, price * qty - best_disc),
        "unit_price":  max(0, price - round(best_disc / qty)),
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_best_voucher(request):
    active = _active_vouchers()
    if not active:
        return Response({"voucher": None}, status=status.HTTP_200_OK)

    def sort_key(v):
        if v.Type == 'fixed':   return float(v.Value)
        if v.Type == 'percent': return float(v.Value) * 1_000_000
        return 0

    best = max(active, key=sort_key)
    return Response({"voucher": _fmt_voucher(best)}, status=status.HTTP_200_OK)


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

    if not customer_id:   return Response({"message": "Thiếu thông tin tài khoản"}, status=status.HTTP_400_BAD_REQUEST)
    if not items:         return Response({"message": "Giỏ hàng trống"}, status=status.HTTP_400_BAD_REQUEST)
    if not receiver_name: return Response({"message": "Vui lòng nhập tên người nhận"}, status=status.HTTP_400_BAD_REQUEST)
    if not receiver_phone:    return Response({"message": "Vui lòng nhập số điện thoại"}, status=status.HTTP_400_BAD_REQUEST)
    if not receiver_address:  return Response({"message": "Vui lòng nhập địa chỉ nhận hàng"}, status=status.HTTP_400_BAD_REQUEST)

    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer:
        return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)

    validated_items = []
    for item in items:
        raw_vid = item.get('variant_id')
        try:
            vid = int(raw_vid)
        except (TypeError, ValueError):
            return Response({"message": "Sản phẩm không hợp lệ. Vui lòng xóa giỏ hàng và thêm lại từ trang chi tiết."}, status=status.HTTP_400_BAD_REQUEST)
        variant = ProductVariant.objects.select_related('ProductID').filter(VariantID=vid).first()
        if not variant:
            return Response({"message": f"Sản phẩm #{vid} không còn tồn tại"}, status=status.HTTP_400_BAD_REQUEST)
        qty = int(item.get('qty', 1))
        if qty <= 0:
            return Response({"message": "Số lượng sản phẩm phải lớn hơn 0"}, status=status.HTTP_400_BAD_REQUEST)
        if variant.StockQuantity < qty:
            pname = variant.ProductID.ProductName
            color = f" ({variant.Color})" if variant.Color else ""
            return Response({"message": f"'{pname}{color}' chỉ còn {variant.StockQuantity} sản phẩm trong kho"}, status=status.HTTP_400_BAD_REQUEST)
        price = float(item.get('price', 0))
        if price <= 0:
            return Response({"message": "Giá sản phẩm không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)
        validated_items.append({"variant": variant, "qty": qty, "price": price})

    try:
        with transaction.atomic():
            shipping_address = f"{receiver_name} - {receiver_phone} - {receiver_address}"
            if note: shipping_address += f" | Ghi chú: {note}"

            order = Order(CustomerID=customer, TotalAmount=total, Status='Processing', ShippingAddress=shipping_address)
            for field, val in [('PaymentMethod', payment_method), ('Subtotal', subtotal), ('Discount', discount), ('StatusNote', '')]:
                try: setattr(order, field, val)
                except Exception: pass
            order.save()

            for vi in validated_items:
                variant = vi['variant']
                qty     = vi['qty']
                OrderDetail.objects.create(OrderID=order, VariantID=variant, Quantity=qty, UnitPrice=vi['price'])
                variant.StockQuantity = max(0, variant.StockQuantity - qty)
                variant.save()

            if voucher_code:
                vobj = Voucher.objects.filter(Code=voucher_code.upper()).first()
                if vobj: vobj.UsedCount += 1; vobj.save()

    except Exception as e:
        return Response({"message": f"Đặt hàng thất bại, vui lòng thử lại. ({str(e)})"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    resp = {"message": "Đặt hàng thành công", "order_id": order.OrderID}
    if payment_method == "momo": resp["momo_url"] = None
    return Response(resp, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def get_customer_addresses(request, customer_id):
    from .models import CustomerAddress
    addrs = CustomerAddress.objects.filter(CustomerID=customer_id)
    return Response({"addresses": [{"id": a.AddressID, "name": a.Name, "phone": a.Phone, "address": a.Address} for a in addrs]}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_customer_address(request):
    from .models import CustomerAddress
    customer_id = request.data.get('customer_id')
    name    = request.data.get('name', '').strip()
    phone   = request.data.get('phone', '').strip()
    address = request.data.get('address', '').strip()
    if not all([customer_id, name, phone, address]):
        return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer:
        return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)
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


@api_view(['GET'])
def list_orders(request):
    customer_id = request.query_params.get('customer_id')
    if not customer_id:
        return Response({"message": "Thiếu customer_id"}, status=status.HTTP_400_BAD_REQUEST)
    orders = Order.objects.filter(CustomerID=customer_id).order_by('-OrderDate')
    result = []
    for o in orders:
        details = OrderDetail.objects.filter(OrderID=o).select_related('VariantID__ProductID')
        items = []
        for d in details:
            v = d.VariantID; p = v.ProductID
            primary_img = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first()
            items.append({
                "product_name": p.ProductName, "color": v.Color or "", "storage": v.Storage or "",
                "ram": v.Ram or "", "quantity": d.Quantity, "unit_price": str(d.UnitPrice),
                "image": v.Image or (primary_img.ImageUrl if primary_img else ""),
            })
        result.append({
            "id": o.OrderID, "status": o.Status, "total_amount": str(o.TotalAmount),
            "shipping_address": o.ShippingAddress, "payment_method": getattr(o, 'PaymentMethod', 'cod'),
            "status_note": getattr(o, 'StatusNote', ''),
            "subtotal": str(getattr(o, 'Subtotal', o.TotalAmount) or o.TotalAmount),
            "discount": str(getattr(o, 'Discount', 0) or 0),
            "created_at": o.OrderDate.isoformat(), "items": items,
        })
    return Response({"orders": result}, status=status.HTTP_200_OK)


@api_view(['POST'])
def cancel_order(request):
    from django.db import transaction
    order_id    = request.data.get('order_id')
    customer_id = request.data.get('customer_id')

    o = Order.objects.filter(OrderID=order_id, CustomerID=customer_id).first()
    if not o:
        return Response({"message": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)
    if o.Status in ('Shipping', 'Delivered', 'Cancelled'):
        label = {'Shipping': 'đang giao', 'Delivered': 'đã giao', 'Cancelled': 'đã hủy'}.get(o.Status)
        return Response({"message": f"Không thể hủy đơn hàng {label}"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            for d in OrderDetail.objects.select_related('VariantID').filter(OrderID=o):
                d.VariantID.StockQuantity += d.Quantity; d.VariantID.save()
            o.Status = 'Cancelled'
            try: o.StatusNote = 'Khách hàng hủy đơn'
            except Exception: pass
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
            items.append({
                "product_name": p.ProductName, "color": v.Color or "", "storage": v.Storage or "",
                "ram": v.Ram or "", "quantity": d.Quantity, "unit_price": str(d.UnitPrice),
                "image": v.Image or (primary_img.ImageUrl if primary_img else ""),
            })
        cust = o.CustomerID
        result.append({
            "id": o.OrderID, "status": o.Status, "total_amount": str(o.TotalAmount),
            "shipping_address": o.ShippingAddress, "payment_method": getattr(o, 'PaymentMethod', 'cod'),
            "status_note": getattr(o, 'StatusNote', ''),
            "subtotal": str(getattr(o, 'Subtotal', o.TotalAmount) or o.TotalAmount),
            "discount": str(getattr(o, 'Discount', 0) or 0),
            "created_at": o.OrderDate.isoformat(),
            "customer_name": cust.FullName, "customer_phone": cust.PhoneNumber or "", "items": items,
        })
    return Response({"orders": result}, status=status.HTTP_200_OK)


@api_view(['POST'])
def update_order_status(request):
    VALID = ['Pending', 'Processing', 'Shipping', 'Delivered', 'Cancelled']
    FLOW  = {'Pending': 'Processing', 'Processing': 'Shipping', 'Shipping': 'Delivered'}

    order_id   = request.data.get('order_id')
    new_status = request.data.get('status')
    note       = request.data.get('note', '').strip()

    if new_status not in VALID:
        return Response({"message": f"Trạng thái không hợp lệ. Chọn: {', '.join(VALID)}"}, status=status.HTTP_400_BAD_REQUEST)

    o = Order.objects.filter(OrderID=order_id).first()
    if not o:
        return Response({"message": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)

    if new_status != 'Cancelled' and FLOW.get(o.Status) != new_status:
        return Response({"message": f"Không thể chuyển từ '{o.Status}' sang '{new_status}'"}, status=status.HTTP_400_BAD_REQUEST)
    if new_status == 'Cancelled' and o.Status in ['Shipping', 'Delivered']:
        return Response({"message": "Không thể hủy đơn đang giao hoặc đã giao"}, status=status.HTTP_400_BAD_REQUEST)

    from django.db import transaction
    try:
        with transaction.atomic():
            if new_status == 'Cancelled':
                for d in OrderDetail.objects.select_related('VariantID').filter(OrderID=o):
                    d.VariantID.StockQuantity += d.Quantity; d.VariantID.save()
            o.Status = new_status
            try: o.StatusNote = note
            except Exception: pass
            o.save()
    except Exception as e:
        return Response({"message": f"Cập nhật thất bại: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    label = {'Processing': 'Đang xử lý', 'Shipping': 'Đang giao hàng', 'Delivered': 'Đã giao hàng', 'Cancelled': 'Đã hủy'}.get(new_status, new_status)
    return Response({"message": f"Cập nhật thành công: {label}"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_return_request(request):
    from django.db import transaction
    from django.utils import timezone
    from datetime import timedelta

    order_id    = request.data.get('order_id')
    customer_id = request.data.get('customer_id')
    reason      = request.data.get('reason', '').strip()
    files       = request.FILES.getlist('media')

    if not order_id or not customer_id:
        return Response({"message": "Thiếu thông tin"}, status=status.HTTP_400_BAD_REQUEST)
    if not reason:
        return Response({"message": "Vui lòng nhập lý do trả hàng"}, status=status.HTTP_400_BAD_REQUEST)

    o = Order.objects.filter(OrderID=order_id, CustomerID=customer_id).first()
    if not o:
        return Response({"message": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)
    if o.Status != 'Delivered':
        return Response({"message": "Chỉ có thể yêu cầu trả hàng cho đơn đã giao"}, status=status.HTTP_400_BAD_REQUEST)

    delivered_at = getattr(o, 'DeliveredAt', None) or o.OrderDate
    if timezone.now() > delivered_at + timedelta(days=7):
        return Response({"message": "Đã quá 7 ngày kể từ khi nhận hàng, không thể yêu cầu trả"}, status=status.HTTP_400_BAD_REQUEST)

    existing = ReturnRequest.objects.filter(OrderID=o).first()
    if existing:
        return Response({"message": f"Đơn hàng này đã có yêu cầu trả hàng (#{existing.ReturnID})"}, status=status.HTTP_400_BAD_REQUEST)

    MAX_SIZE = 500 * 1024 * 1024
    if sum(f.size for f in files) > MAX_SIZE:
        return Response({"message": f"Tổng dung lượng file vượt quá 500MB"}, status=status.HTTP_400_BAD_REQUEST)

    ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    ALLOWED_VIDEO = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
    for f in files:
        if f.content_type not in ALLOWED_IMAGE + ALLOWED_VIDEO:
            return Response({"message": f"File '{f.name}' không được hỗ trợ."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            rr = ReturnRequest.objects.create(OrderID=o, Reason=reason, Status='Pending')
            media_urls = []
            for f in files:
                try:
                    resource_type = 'video' if f.content_type.startswith('video') else 'image'
                    result = cloudinary.uploader.upload(f, folder=f"sellphone/returns/{o.OrderID}", public_id=f"return_{rr.ReturnID}_{f.name}", overwrite=True, resource_type=resource_type)
                    ReturnMedia.objects.create(ReturnID=rr, Url=result['secure_url'], MediaType='video' if resource_type == 'video' else 'image')
                    media_urls.append(result['secure_url'])
                except Exception: pass
            o.Status = 'ReturnRequested'
            try: o.StatusNote = f'Yêu cầu trả hàng: {reason}'
            except Exception: pass
            o.save()
    except Exception as e:
        return Response({"message": f"Tạo yêu cầu thất bại: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({"message": "Đã gửi yêu cầu trả hàng thành công", "return_id": rr.ReturnID, "media_count": len(media_urls)}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def list_return_requests(request):
    returns = ReturnRequest.objects.all().select_related('OrderID').order_by('-CreatedAt')
    result  = []
    for rr in returns:
        o = rr.OrderID
        media = ReturnMedia.objects.filter(ReturnID=rr)
        result.append({
            "return_id": rr.ReturnID, "order_id": o.OrderID,
            "customer_id": str(o.CustomerID_id), "customer_name": o.CustomerID.FullName,
            "reason": rr.Reason, "status": rr.Status, "admin_note": rr.AdminNote or "",
            "created_at": rr.CreatedAt.isoformat(),
            "media": [{"url": m.Url, "type": m.MediaType} for m in media],
            "order_total": str(o.TotalAmount),
        })
    return Response({"returns": result}, status=status.HTTP_200_OK)


@api_view(['POST'])
def process_return_request(request):
    from django.db import transaction
    return_id = request.data.get('return_id')
    action    = request.data.get('action')
    note      = request.data.get('note', '').strip()

    VALID_ACTIONS = ('approve', 'reject', 'complete', 'returning')
    if action not in VALID_ACTIONS:
        return Response({"message": f"Hành động không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)

    rr = ReturnRequest.objects.select_related('OrderID').filter(ReturnID=return_id).first()
    if not rr:
        return Response({"message": "Không tìm thấy yêu cầu trả hàng"}, status=status.HTTP_404_NOT_FOUND)

    o = rr.OrderID
    FLOW = {
        'approve':   ('Pending',   'Approved',  'Đã chấp nhận - chờ khách gửi hàng về'),
        'reject':    ('Pending',   'Rejected',  'Đã từ chối yêu cầu trả hàng'),
        'returning': ('Approved',  'Returning', 'Đang nhận hàng hoàn về'),
        'complete':  ('Returning', 'Completed', 'Hoàn tất trả hàng'),
    }
    required_status, new_rr_status, default_note = FLOW[action]
    if rr.Status != required_status:
        return Response({"message": f"Không thể '{action}' khi yêu cầu đang ở trạng thái '{rr.Status}'"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            rr.Status = new_rr_status; rr.AdminNote = note or default_note; rr.save()
            ORDER_STATUS_MAP = {'approve': 'ReturnApproved', 'reject': 'Delivered', 'returning': 'Returning', 'complete': 'Returned'}
            o.Status = ORDER_STATUS_MAP[action]
            try: o.StatusNote = note or default_note
            except Exception: pass
            if action == 'complete':
                for d in OrderDetail.objects.select_related('VariantID').filter(OrderID=o):
                    d.VariantID.StockQuantity += d.Quantity; d.VariantID.save()
            o.save()
    except Exception as e:
        return Response({"message": f"Xử lý thất bại: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({"message": f"✅ {note or default_note}"}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_return_request(request, order_id):
    o = Order.objects.filter(OrderID=order_id).first()
    if not o: return Response({"return": None}, status=status.HTTP_200_OK)
    rr = ReturnRequest.objects.filter(OrderID=o).first()
    if not rr: return Response({"return": None}, status=status.HTTP_200_OK)
    media = ReturnMedia.objects.filter(ReturnID=rr)
    return Response({
        "return": {
            "return_id": rr.ReturnID, "reason": rr.Reason, "status": rr.Status,
            "admin_note": rr.AdminNote or "", "created_at": rr.CreatedAt.isoformat(),
            "media": [{"url": m.Url, "type": m.MediaType} for m in media],
        }
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
def list_posts(request):
    category = request.query_params.get('category', 'all')
    posts    = Post.objects.all()
    if category and category != 'all': posts = posts.filter(Category=category)
    posts = posts.order_by('-CreatedAt')
    result = []
    for p in posts:
        import json as _json
        thumb = ""
        try:
            blocks = _json.loads(p.Blocks) if isinstance(p.Blocks, str) else (p.Blocks or [])
            for b in blocks:
                if b.get('type') == 'image' and b.get('url'): thumb = b['url']; break
        except Exception: pass
        result.append({
            "id": p.PostID, "title": p.Title, "category": p.Category or "Mẹo vặt",
            "thumbnail": thumb, "created_at": p.CreatedAt.isoformat(), "author": p.Author or "Admin",
        })
    return Response({"posts": result}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_post(request, post_id):
    p = Post.objects.filter(PostID=post_id).first()
    if not p: return Response({"message": "Không tìm thấy bài viết"}, status=status.HTTP_404_NOT_FOUND)
    import json as _json
    try: blocks = _json.loads(p.Blocks) if isinstance(p.Blocks, str) else (p.Blocks or [])
    except: blocks = []
    return Response({"post": {"id": p.PostID, "title": p.Title, "category": p.Category or "", "blocks": blocks, "created_at": p.CreatedAt.isoformat(), "author": p.Author or "Admin"}}, status=status.HTTP_200_OK)


@api_view(['POST'])
def create_post(request):
    import json as _json
    title    = request.data.get('title', '').strip()
    category = request.data.get('category', '').strip()
    blocks   = request.data.get('blocks', '[]')
    author   = request.data.get('author', 'Admin').strip()

    if not title: return Response({"message": "Vui lòng nhập tiêu đề bài viết"}, status=status.HTTP_400_BAD_REQUEST)

    if isinstance(blocks, str):
        try: blocks_parsed = _json.loads(blocks)
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
        if key.startswith('block_vid_'):
            idx = key.replace('block_vid_', '')
            try:
                result = cloudinary.uploader.upload(request.FILES[key], folder="sellphone/posts/videos", resource_type="video")
                for b in blocks_parsed:
                    if b.get('_idx') == idx and b.get('type') == 'video': b['url'] = result['secure_url']; break
            except: pass

    post = Post.objects.create(Title=title, Category=category or "Mẹo vặt", Blocks=_json.dumps(blocks_parsed, ensure_ascii=False), Author=author)
    return Response({"message": "Đăng bài thành công", "post_id": post.PostID}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def update_post(request):
    import json as _json
    post_id = request.data.get('post_id')
    p = Post.objects.filter(PostID=post_id).first()
    if not p: return Response({"message": "Không tìm thấy bài viết"}, status=status.HTTP_404_NOT_FOUND)

    title    = request.data.get('title', p.Title).strip()
    category = request.data.get('category', p.Category).strip()
    blocks   = request.data.get('blocks', '[]')
    if isinstance(blocks, str):
        try: blocks_parsed = _json.loads(blocks)
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
        elif key.startswith('block_vid_'):
            idx = key.replace('block_vid_', '')
            try:
                result = cloudinary.uploader.upload(request.FILES[key], folder="sellphone/posts/videos", resource_type="video")
                for b in blocks_parsed:
                    if b.get('_idx') == idx and b.get('type') == 'video': b['url'] = result['secure_url']; break
            except: pass

    p.Title = title; p.Category = category; p.Blocks = _json.dumps(blocks_parsed, ensure_ascii=False); p.save()
    return Response({"message": "Cập nhật bài viết thành công"}, status=status.HTTP_200_OK)


@api_view(['POST'])
def delete_post(request):
    post_id = request.data.get('post_id')
    p = Post.objects.filter(PostID=post_id).first()
    if not p: return Response({"message": "Không tìm thấy bài viết"}, status=status.HTTP_404_NOT_FOUND)
    p.delete()
    return Response({"message": "Đã xóa bài viết"}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_product_content(request, product_id):
    import json as _json
    pc = ProductContent.objects.filter(ProductID_id=product_id).first()
    if not pc: return Response({"content": None}, status=status.HTTP_200_OK)
    try: blocks = _json.loads(pc.Blocks) if isinstance(pc.Blocks, str) else (pc.Blocks or [])
    except: blocks = []
    return Response({"content": {"blocks": blocks, "updated_at": pc.UpdatedAt.isoformat()}}, status=status.HTTP_200_OK)


@api_view(['POST'])
def save_product_content(request):
    import json as _json
    product_id = request.data.get('product_id')
    blocks     = request.data.get('blocks', '[]')

    product = Product.objects.filter(ProductID=product_id).first()
    if not product: return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)

    if isinstance(blocks, str):
        try: blocks_parsed = _json.loads(blocks)
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
        elif key.startswith('block_vid_'):
            idx = key.replace('block_vid_', '')
            try:
                result = cloudinary.uploader.upload(request.FILES[key], folder=f"sellphone/product_content/{product_id}", resource_type="video")
                for b in blocks_parsed:
                    if b.get('_idx') == idx and b.get('type') == 'video': b['url'] = result['secure_url']; break
            except: pass

    ProductContent.objects.update_or_create(ProductID_id=product_id, defaults={"Blocks": _json.dumps(blocks_parsed, ensure_ascii=False)})
    return Response({"message": "Lưu mô tả sản phẩm thành công"}, status=status.HTTP_200_OK)