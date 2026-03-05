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
from .models import Customer, Staff, Product, ProductVariant, ProductImage, Category, generate_customer_id, Order, OrderDetail

# Lưu OTP tạm thời trong memory { email: otp_code }
otp_storage = {}


# ===== HASH MẬT KHẨU =====
def hash_password(password):
    return make_password(password)


# ===== FORMAT DỮ LIỆU TRẢ VỀ =====
def customer_data(customer):
    # Nếu avatar là base64 (quá dài) thì vẫn trả về,
    # nếu là URL thì trả về bình thường
    avatar = customer.Avatar or ""
    return {
        "id":         customer.CustomerID,
        "full_name":  customer.FullName,
        "email":      customer.Email,
        "avatar":     avatar,
        "login_type": customer.LoginType,
    }


# ===== HÀM TẠO CUSTOMER =====
def create_customer(**kwargs):
    customer_id = generate_customer_id()
    return Customer.objects.create(CustomerID=customer_id, **kwargs)


# ===== HÀM THÔNG BÁO EMAIL ĐÃ TỒN TẠI =====
def email_exists_message(existing_login_type):
    if existing_login_type == 'google':
        return "Email này đã được đăng ký bằng Google, vui lòng đăng nhập bằng Google"
    elif existing_login_type == 'facebook':
        return "Email này đã được đăng ký bằng Facebook, vui lòng đăng nhập bằng Facebook"
    else:
        return "Email này đã được đăng ký, vui lòng đăng nhập bằng email và mật khẩu"


# ============================================
# API CHECK EMAIL
# POST /api/auth/check-email/
# ============================================
@api_view(['POST'])
def check_email(request):
    email = request.data.get('email', '').strip()
    if not email:
        return Response({"message": "Vui lòng nhập email"}, status=status.HTTP_400_BAD_REQUEST)

    existing = Customer.objects.filter(Email=email).first()
    if existing:
        return Response(
            {"message": email_exists_message(existing.LoginType)},
            status=status.HTTP_400_BAD_REQUEST
        )
    return Response({"message": "Email hợp lệ"}, status=status.HTTP_200_OK)


# ============================================
# API 1: ĐĂNG KÝ THƯỜNG
# POST /api/auth/register/
# ============================================
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
        return Response(
            {"message": email_exists_message(existing.LoginType), "field": "email"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        customer = create_customer(FullName=full_name, Email=email, Password=hash_password(password), LoginType='normal')
    except ValueError as e:
        return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"message": "Đăng ký thành công", "customer": customer_data(customer)}, status=status.HTTP_201_CREATED)


# ============================================
# API 2: ĐĂNG NHẬP THƯỜNG
# POST /api/auth/login/
# ============================================
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
        return Response(
            {"message": email_exists_message(existing.LoginType), "field": "email"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not check_password(password, existing.Password):
        return Response({"message": "Mật khẩu không đúng", "field": "password"}, status=status.HTTP_401_UNAUTHORIZED)

    # Chỉ trả avatar nếu là URL (Cloudinary), không trả nếu là base64 để tránh response quá lớn
    avatar = existing.Avatar or ""
    if avatar.startswith("data:"):  # base64 cũ → bỏ qua
        avatar = ""

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


# ============================================
# API 3: ĐĂNG KÝ GOOGLE
# POST /api/auth/google/register/
# ============================================
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


# ============================================
# API 4: ĐĂNG NHẬP GOOGLE
# POST /api/auth/google/login/
# ============================================
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


# ============================================
# API 5: ĐĂNG KÝ FACEBOOK
# POST /api/auth/facebook/register/
# ============================================
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


# ============================================
# API 6: ĐĂNG NHẬP FACEBOOK
# POST /api/auth/facebook/login/
# ============================================
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


# ============================================
# API 7: QUÊN MẬT KHẨU - GỬI OTP
# POST /api/auth/forgot-password/
# Body: { email }
# ============================================
@api_view(['POST'])
def forgot_password(request):
    email = request.data.get('email', '').strip()

    if not email:
        return Response({"message": "Vui lòng nhập email"}, status=status.HTTP_400_BAD_REQUEST)

    existing = Customer.objects.filter(Email=email).first()

    if not existing:
        return Response({"message": "Email chưa được đăng ký"}, status=status.HTTP_404_NOT_FOUND)

    # Email đăng ký bằng Google hoặc Facebook → không thể đặt lại mật khẩu
    if existing.LoginType == 'google':
        return Response(
            {"message": "Email này đã đăng ký bằng Google, vui lòng đăng nhập bằng Google"},
            status=status.HTTP_400_BAD_REQUEST
        )
    if existing.LoginType == 'facebook':
        return Response(
            {"message": "Email này đã đăng ký bằng Facebook, vui lòng đăng nhập bằng Facebook"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Tạo OTP 6 số ngẫu nhiên
    otp_code = str(random.randint(100000, 999999))
    otp_storage[email] = otp_code

    # Gửi email
    try:
        send_mail(
            subject = "Mã OTP đặt lại mật khẩu - Sellphone",
            message = f"Mã OTP của bạn là: {otp_code}\nMã có hiệu lực trong 5 phút.",
            from_email = settings.EMAIL_HOST_USER,
            recipient_list = [email],
            fail_silently = False,
        )
    except Exception as e:
        return Response({"message": f"Không thể gửi email: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({"message": "OTP đã được gửi đến email của bạn"}, status=status.HTTP_200_OK)


# ============================================
# API 8: XÁC NHẬN OTP
# POST /api/auth/verify-otp/
# Body: { email, otp }
# ============================================
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


# ============================================
# API 9: ĐẶT LẠI MẬT KHẨU
# POST /api/auth/reset-password/
# Body: { email, new_password }
# ============================================
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

    # Cập nhật mật khẩu mới
    customer.Password = hash_password(new_password)
    customer.save()

    # Xóa OTP sau khi đặt lại thành công
    if email in otp_storage:
        del otp_storage[email]

    return Response({"message": "Đặt lại mật khẩu thành công"}, status=status.HTTP_200_OK)


# ============================================
# API 10: LẤY THÔNG TIN CUSTOMER
# GET /api/customer/<id>/
# ============================================
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


# ============================================
# API 11: CẬP NHẬT SỐ ĐIỆN THOẠI / ĐỊA CHỈ
# POST /api/customer/update/
# Body: { id, phone_number? , address? }
# ============================================
@api_view(['POST'])
def update_customer(request):
    customer_id = request.data.get('id', '').strip()
    phone       = request.data.get('phone_number', None)
    address     = request.data.get('address', None)

    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer:
        return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)

    avatar = request.data.get('avatar', None)

    if phone is not None:
        customer.PhoneNumber = phone.strip()
    if address is not None:
        customer.Address = address.strip()
    if avatar is not None:
        # Upload base64 lên Cloudinary, lưu URL thay vì base64
        try:
            upload_result = cloudinary.uploader.upload(
                avatar,
                folder        = "sellphone/avatars",
                public_id     = f"avatar_{customer_id}",
                overwrite     = True,
                resource_type = "image",
                transformation = [{"width": 300, "height": 300, "crop": "fill", "gravity": "face"}],
            )
            customer.Avatar = upload_result["secure_url"]
        except Exception as e:
            return Response({"message": f"Lỗi upload ảnh: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    customer.save()

    return Response({"message": "Cập nhật thành công"}, status=status.HTTP_200_OK)


# ============================================
# API 12: ĐỔI MẬT KHẨU (khi đã đăng nhập)
# POST /api/customer/change-password/
# Body: { id, current_password, new_password }
# ============================================
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


# ============================================
# API 13: UPLOAD AVATAR QUA CLOUDINARY
# POST /api/customer/upload-avatar/
# Body: multipart/form-data { id, avatar_file }
# ============================================
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
            avatar_file,
            folder         = "sellphone/avatars",
            public_id      = f"avatar_{customer_id}",
            overwrite      = True,
            resource_type  = "image",
            transformation = [{"width": 300, "height": 300, "crop": "fill", "gravity": "face"}],
        )
        avatar_url = upload_result["secure_url"]
        customer.Avatar = avatar_url
        customer.save()

        return Response({
            "message":    "Upload avatar thành công",
            "avatar_url": avatar_url,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({"message": f"Lỗi upload: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================
# API 14: ĐĂNG NHẬP STAFF / ADMIN
# POST /api/auth/admin/login/
# Body: { username, password }  ← username = Email
# ============================================
@api_view(['POST'])
def admin_login(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()

    if not username:
        return Response({"message": "Vui lòng nhập tên tài khoản", "field": "username"}, status=status.HTTP_400_BAD_REQUEST)
    if not password:
        return Response({"message": "Vui lòng nhập mật khẩu", "field": "password"}, status=status.HTTP_400_BAD_REQUEST)

    # Tìm staff theo Email
    staff = Staff.objects.filter(Email=username).first()
    if not staff:
        return Response({"message": "Tài khoản không tồn tại", "field": "username"}, status=status.HTTP_404_NOT_FOUND)

    if not check_password(password, staff.Password):
        return Response({"message": "Mật khẩu không đúng", "field": "password"}, status=status.HTTP_401_UNAUTHORIZED)

    # Kiểm tra quyền
    if staff.Role == 'Unentitled':
        return Response(
            {"message": "Bạn không có quyền truy cập", "field": "general"},
            status=status.HTTP_403_FORBIDDEN
        )

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


# ============================================
# API 15: LẤY THÔNG TIN STAFF
# GET /api/staff/<id>/
# ============================================
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


# ============================================
# API 16: DANH SÁCH STAFF
# GET /api/staff/list/
# ============================================
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


# ============================================
# API 17: TẠO STAFF MỚI
# POST /api/staff/create/
# Body: { full_name, email, password, role }
# ============================================
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

    staff = Staff.objects.create(
        FullName = full_name,
        Email    = email,
        Password = make_password(password),
        Role     = role,
    )
    return Response({
        "message": "Tạo tài khoản thành công",
        "staff":   {"id": staff.StaffID, "full_name": staff.FullName, "email": staff.Email, "role": staff.Role},
    }, status=status.HTTP_201_CREATED)


# ============================================
# API 18: CẬP NHẬT QUYỀN STAFF
# POST /api/staff/update-role/
# Body: { id, role }
# ============================================
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


# ============================================
# API 19: ĐỔI MẬT KHẨU STAFF
# POST /api/staff/change-password/
# Body: { id, current_password, new_password }
# ============================================
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


# ============================================
# API 20: UPLOAD AVATAR STAFF
# POST /api/staff/upload-avatar/
# Body: multipart/form-data { id, avatar_file }
# ============================================
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
            avatar_file,
            folder        = "sellphone/staff_avatars",
            public_id     = f"staff_avatar_{staff_id}",
            overwrite     = True,
            resource_type = "image",
            transformation = [{"width": 300, "height": 300, "crop": "fill", "gravity": "face"}],
        )
        avatar_url = upload_result["secure_url"]
        staff.Avatar = avatar_url
        staff.save()
        return Response({"message": "Upload thành công", "avatar_url": avatar_url}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"message": f"Lỗi upload: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================
# API 21: DANH SÁCH DANH MỤC
# GET /api/product/categories/
# ============================================
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


# list_products được định nghĩa lại ở cuối file


# ============================================
# API 23: TẠO SẢN PHẨM + BIẾN THỂ + ẢNH
# POST /api/product/create/
# Body: multipart/form-data
#   product_name, brand, description, category_id
#   variants (JSON string)
#   images (files, nhiều file)
# ============================================
# ============================================================
# HELPER: validate danh sách biến thể (dùng chung)
# ============================================================
import re as _re

def _validate_variants(variants):
    """
    Trả về list lỗi theo từng biến thể.
    Mỗi phần tử là dict {field: message} hoặc {} nếu hợp lệ.
    """
    errors = []
    for idx, v in enumerate(variants):
        ve = {}
        label = f"Biến thể #{idx + 1}"

        # --- GIÁ ---
        price_raw = v.get('price', '')
        try:
            price = float(price_raw)
            if price <= 0:
                ve['price'] = f"{label}: Giá phải lớn hơn 0"
        except (ValueError, TypeError):
            ve['price'] = f"{label}: Giá không hợp lệ"

        # --- SỐ LƯỢNG ---
        stock_raw = v.get('stock', '')
        try:
            stock = int(stock_raw)
            if stock <= 0:
                ve['stock'] = f"{label}: Số lượng phải lớn hơn 0"
            elif stock > 10000:
                ve['stock'] = f"{label}: Số lượng tối đa 10.000"
        except (ValueError, TypeError):
            ve['stock'] = f"{label}: Số lượng không hợp lệ"

        # --- RAM ---
        ram = (v.get('ram') or '').strip()
        if not ram:
            ve['ram'] = f"{label}: Vui lòng nhập RAM"
        else:
            m = _re.match(r'^(\d+(?:\.\d+)?)\s*GB$', ram, _re.IGNORECASE)
            if not m:
                ve['ram'] = f"{label}: RAM phải có dạng số + GB (VD: 8GB)"
            elif float(m.group(1)) < 4:
                ve['ram'] = f"{label}: RAM tối thiểu là 4GB"

        # --- BỘ NHỚ (tuỳ chọn nhưng nếu nhập thì phải đúng định dạng) ---
        storage = (v.get('storage') or '').strip()
        if storage:
            m = _re.match(r'^(\d+(?:\.\d+)?)\s*(GB|TB)$', storage, _re.IGNORECASE)
            if not m:
                ve['storage'] = f"{label}: Bộ nhớ phải có dạng số + GB/TB (VD: 128GB, 1TB)"
            else:
                num  = float(m.group(1))
                unit = m.group(2).upper()
                if unit == 'GB' and num < 64:
                    ve['storage'] = f"{label}: Bộ nhớ GB phải từ 64GB trở lên"
                elif unit == 'TB' and num < 1:
                    ve['storage'] = f"{label}: Bộ nhớ TB phải từ 1TB trở lên"

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

    # Validate chi tiết từng biến thể
    variant_errors = _validate_variants(variants)
    all_errors = [e for e in variant_errors if e]
    if all_errors:
        # Gộp tất cả lỗi thành 1 message
        messages = []
        for ve in all_errors:
            messages.extend(ve.values())
        return Response({"message": " | ".join(messages), "variant_errors": variant_errors}, status=status.HTTP_400_BAD_REQUEST)

    # Tạo Product
    product = Product.objects.create(
        ProductName = product_name,
        Brand       = brand or None,
        Description = description or None,
        CategoryID  = category,
    )

    # Tạo Variants + upload ảnh biến thể
    for idx, v in enumerate(variants):
        variant_obj = ProductVariant.objects.create(
            ProductID        = product,
            Color            = v.get('color') or None,
            Storage          = v.get('storage') or None,
            Ram              = v.get('ram') or None,
            Price            = float(v.get('price', 0)),
            StockQuantity    = int(v.get('stock', 0)),
            Cpu              = v.get('cpu') or None,
            OperatingSystem  = v.get('os') or None,
            ScreenSize       = v.get('screenSize') or None,
            ScreenTechnology = v.get('screenTech') or None,
            RefreshRate      = v.get('refreshRate') or None,
            Battery          = v.get('battery') or None,
            ChargingSpeed    = v.get('chargingSpeed') or None,
            FrontCamera      = v.get('frontCamera') or None,
            RearCamera       = v.get('rearCamera') or None,
            Weights          = v.get('weights') or None,
            Updates          = v.get('updates') or None,
        )
        # Upload ảnh biến thể lên Cloudinary
        variant_img = request.FILES.get(f'variant_image_{idx}')
        if variant_img:
            try:
                result = cloudinary.uploader.upload(
                    variant_img,
                    folder        = f"sellphone/variants/{product.ProductID}",
                    public_id     = f"variant_{variant_obj.VariantID}",
                    overwrite     = True,
                    resource_type = "image",
                    transformation = [{"width": 800, "height": 800, "crop": "limit"}],
                )
                variant_obj.Image = result["secure_url"]
                variant_obj.save()
            except Exception:
                pass

    # Upload ảnh lên Cloudinary
    for idx, img_file in enumerate(images):
        try:
            result = cloudinary.uploader.upload(
                img_file,
                folder        = f"sellphone/products/{product.ProductID}",
                public_id     = f"product_{product.ProductID}_img_{idx}",
                overwrite     = True,
                resource_type = "image",
                transformation = [{"width": 800, "height": 800, "crop": "limit"}],
            )
            ProductImage.objects.create(
                ProductID = product,
                ImageUrl  = result["secure_url"],
                IsPrimary = (idx == 0),
            )
        except Exception:
            pass  # Bỏ qua lỗi upload ảnh, vẫn tạo sản phẩm

    return Response({
        "message":    "Tạo sản phẩm thành công",
        "product_id": product.ProductID,
    }, status=status.HTTP_201_CREATED)


# ============================================
# API 24: BIẾN THỂ CỦA SẢN PHẨM
# GET /api/product/<id>/variants/
# ============================================
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


# ============================================
# API 25: NHẬP HÀNG - TĂNG STOCK
# POST /api/product/import/
# Body: { items: [{ variant_id, quantity }] }
# ============================================
@api_view(['POST'])
def import_stock(request):
    items = request.data.get('items', [])

    if not items:
        return Response({"message": "Không có dữ liệu nhập hàng"}, status=status.HTTP_400_BAD_REQUEST)

    updated = []
    for item in items:
        variant_id = item.get('variant_id')
        quantity   = int(item.get('quantity', 0))

        if quantity <= 0:
            continue

        variant = ProductVariant.objects.filter(VariantID=variant_id).first()
        if variant:
            variant.StockQuantity += quantity
            variant.save()
            updated.append({"variant_id": variant_id, "new_stock": variant.StockQuantity})

    return Response({
        "message": f"Đã nhập hàng cho {len(updated)} biến thể",
        "updated": updated,
    }, status=status.HTTP_200_OK)


# ============================================
# API: TẠO DANH MỤC
# POST /api/product/category/create/
# Body: multipart/form-data { name, image? }
# ============================================
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
                image_file,
                folder        = "sellphone/categories",
                public_id     = f"category_{name.lower().replace(' ', '_')}",
                overwrite     = True,
                resource_type = "image",
                transformation = [{"width": 400, "height": 400, "crop": "fill"}],
            )
            image_url = result["secure_url"]
        except Exception as e:
            return Response({"message": f"Lỗi upload ảnh: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    cat = Category.objects.create(CategoryName=name, Image=image_url)
    return Response({
        "message": "Tạo danh mục thành công",
        "id":      cat.CategoryID,
        "name":    cat.CategoryName,
        "image":   image_url,
    }, status=status.HTTP_201_CREATED)


# ============================================
# API: CẬP NHẬT DANH MỤC
# POST /api/product/category/update/
# Body: multipart/form-data { id, name, image? }
# ============================================
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
                image_file,
                folder        = "sellphone/categories",
                public_id     = f"category_{cat_id}",
                overwrite     = True,
                resource_type = "image",
                transformation = [{"width": 400, "height": 400, "crop": "fill"}],
            )
            cat.Image = result["secure_url"]
        except Exception as e:
            return Response({"message": f"Lỗi upload ảnh: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    cat.save()
    return Response({"message": "Cập nhật danh mục thành công"}, status=status.HTTP_200_OK)


# ============================================
# API 26: CHI TIẾT SẢN PHẨM
# GET /api/product/<id>/detail/
# ============================================
@api_view(['GET'])
def get_product_detail(request, product_id):
    product = Product.objects.select_related('CategoryID').filter(ProductID=product_id).first()
    if not product:
        return Response({"message": "Không tìm thấy sản phẩm"}, status=status.HTTP_404_NOT_FOUND)

    variants = ProductVariant.objects.filter(ProductID=product)
    images   = ProductImage.objects.filter(ProductID=product)

    # Sản phẩm liên quan (cùng danh mục, khác ID, tối đa 5)
    related_products = Product.objects.filter(
        CategoryID=product.CategoryID
    ).exclude(ProductID=product_id).order_by('-CreatedAt')[:5]

    def variant_data(v):
        return {
            "id":             v.VariantID,
            "image":          v.Image or "" if hasattr(v, "Image") else "",
            "color":          v.Color or "",
            "storage":        v.Storage or "",
            "ram":            v.Ram or "",
            "price":          str(v.Price),
            "stock":          v.StockQuantity,
            "cpu":            v.Cpu or "",
            "os":             v.OperatingSystem or "",
            "screen_size":    v.ScreenSize or "",
            "screen_tech":    v.ScreenTechnology or "",
            "refresh_rate":   v.RefreshRate or "",
            "battery":        v.Battery or "",
            "charging_speed": v.ChargingSpeed or "",
            "front_camera":   v.FrontCamera or "",
            "rear_camera":    v.RearCamera or "",
            "weights":        v.Weights or "",
            "updates":        v.Updates or "",
        }

    def related_data(p):
        primary_img = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first()
        if not primary_img:
            primary_img = ProductImage.objects.filter(ProductID=p).first()
        min_v = ProductVariant.objects.filter(ProductID=p).order_by('Price').first()
        return {
            "id":        p.ProductID,
            "name":      p.ProductName,
            "brand":     p.Brand or "",
            "image":     primary_img.ImageUrl if primary_img else "",
            "min_price": str(min_v.Price) if min_v else "0",
        }

    # Ảnh chính trước
    images_sorted = list(images.filter(IsPrimary=True)) + list(images.filter(IsPrimary=False))

    # Lấy giá thấp nhất
    min_variant = variants.order_by('Price').first()

    return Response({
        "product": {
            "id":          product.ProductID,
            "name":        product.ProductName,
            "brand":       product.Brand or "",
            "description": product.Description or "",
            "category":    product.CategoryID.CategoryName,
            "category_id": product.CategoryID.CategoryID,
        },
        "variants": [variant_data(v) for v in variants],
        "images":   [{"url": img.ImageUrl, "is_primary": img.IsPrimary} for img in images_sorted],
        "related":  [related_data(p) for p in related_products],
    }, status=status.HTTP_200_OK)


# ============================================
# API 27: DANH SÁCH SẢN PHẨM (mở rộng - có min_price, image, rams, storages)
# GET /api/product/list/
# ============================================
@api_view(['GET'])
def list_products(request):
    products = Product.objects.select_related('CategoryID').all().order_by('-CreatedAt')
    data = []
    for p in products:
        variants      = ProductVariant.objects.filter(ProductID=p)
        variant_count = variants.count()
        min_v         = variants.order_by('Price').first()
        primary_img   = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first()
        if not primary_img:
            primary_img = ProductImage.objects.filter(ProductID=p).first()

        rams     = list(set(v.Ram     for v in variants if v.Ram))
        storages = list(set(v.Storage for v in variants if v.Storage))

        data.append({
            "id":            p.ProductID,
            "name":          p.ProductName,
            "brand":         p.Brand or "",
            "description":   p.Description or "",
            "category":      p.CategoryID.CategoryName,
            "category_id":   p.CategoryID.CategoryID,
            "variant_count": variant_count,
            "min_price":     str(min_v.Price) if min_v else "0",
            "image":         primary_img.ImageUrl if primary_img else "",
            "rams":          rams,
            "storages":      storages,
        })
    return Response({"products": data}, status=status.HTTP_200_OK)


# ============================================
# API 28: THÊM BIẾN THỂ VÀO SẢN PHẨM CÓ SẴN
# POST /api/product/add-variants/
# ============================================
@api_view(['POST'])
def add_variants(request):
    product_id = request.data.get('product_id') or request.POST.get('product_id')
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

    # Validate chi tiết từng biến thể
    variant_errors = _validate_variants(variants)
    all_errors = [e for e in variant_errors if e]
    if all_errors:
        messages = []
        for ve in all_errors:
            messages.extend(ve.values())
        return Response({"message": " | ".join(messages), "variant_errors": variant_errors}, status=status.HTTP_400_BAD_REQUEST)

    created = []
    for idx, v in enumerate(variants):
        variant_obj = ProductVariant.objects.create(
            ProductID        = product,
            Color            = v.get('color') or None,
            Storage          = v.get('storage') or None,
            Ram              = v.get('ram') or None,
            Price            = float(v.get('price', 0)),
            StockQuantity    = int(v.get('stock', 0)),
            Cpu              = v.get('cpu') or None,
            OperatingSystem  = v.get('os') or None,
            ScreenSize       = v.get('screenSize') or None,
            ScreenTechnology = v.get('screenTech') or None,
            RefreshRate      = v.get('refreshRate') or None,
            Battery          = v.get('battery') or None,
            ChargingSpeed    = v.get('chargingSpeed') or None,
            FrontCamera      = v.get('frontCamera') or None,
            RearCamera       = v.get('rearCamera') or None,
            Weights          = v.get('weights') or None,
            Updates          = v.get('updates') or None,
        )
        # Upload ảnh biến thể
        variant_img = request.FILES.get(f'variant_image_{idx}')
        if variant_img:
            try:
                result = cloudinary.uploader.upload(
                    variant_img,
                    folder        = f"sellphone/variants/{product.ProductID}",
                    public_id     = f"variant_{variant_obj.VariantID}",
                    overwrite     = True,
                    resource_type = "image",
                    transformation = [{"width": 800, "height": 800, "crop": "limit"}],
                )
                variant_obj.Image = result["secure_url"]
                variant_obj.save()
            except Exception:
                pass
        created.append(variant_obj.VariantID)

    return Response({
        "message": f"Đã thêm {len(created)} biến thể thành công",
        "variant_ids": created,
    }, status=status.HTTP_201_CREATED)


# ===========================================================
# MODEL VOUCHER (thêm vào models.py):
# class Voucher(models.Model):
#   VoucherID   = AutoField(primary_key=True)
#   Code        = CharField(max_length=50, unique=True)
#   Type        = CharField(max_length=10)  # 'percent' | 'fixed'
#   Value       = DecimalField(max_digits=12, decimal_places=2)
#   Scope       = CharField(max_length=20, default='all')  # 'all'|'category'|'product'
#   CategoryID  = ForeignKey(Category, null=True, blank=True, ...)
#   ProductID   = ForeignKey(Product, null=True, blank=True, ...)
#   MinOrder    = DecimalField(max_digits=12, decimal_places=2, default=0)
#   MaxDiscount = DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
#   StartDate   = DateField(null=True, blank=True)
#   EndDate     = DateField(null=True, blank=True)
#   UsageLimit  = IntegerField(null=True, blank=True)
#   UsedCount   = IntegerField(default=0)
#   IsActive    = BooleanField(default=True)
#   class Meta: db_table = 'Voucher'
# ===========================================================

# ===========================================================
# MODEL CUSTOMERADDRESS (thêm vào models.py):
# class CustomerAddress(models.Model):
#   AddressID  = AutoField(primary_key=True)
#   CustomerID = ForeignKey(Customer, on_delete=CASCADE, db_column='CustomerID')
#   Name       = CharField(max_length=100)
#   Phone      = CharField(max_length=20)
#   Address    = CharField(max_length=300)
#   class Meta: db_table = 'CustomerAddress'
# ===========================================================

# ===========================================================
# MODEL ORDER (thêm vào models.py):
# class Order(models.Model):
#   OrderID         = AutoField(primary_key=True)
#   CustomerID      = ForeignKey(Customer, on_delete=PROTECT, db_column='CustomerID')
#   ReceiverName    = CharField(max_length=100)
#   ReceiverPhone   = CharField(max_length=20)
#   ReceiverAddress = CharField(max_length=300)
#   Note            = CharField(max_length=500, blank=True, null=True)
#   VoucherCode     = CharField(max_length=50, blank=True, null=True)
#   Subtotal        = DecimalField(max_digits=14, decimal_places=2)
#   Discount        = DecimalField(max_digits=14, decimal_places=2, default=0)
#   Total           = DecimalField(max_digits=14, decimal_places=2)
#   Status          = CharField(max_length=30, default='pending')
#   CreatedAt       = DateTimeField(auto_now_add=True)
#   class Meta: db_table = 'Order'
#
# class OrderItem(models.Model):
#   OrderItemID = AutoField(primary_key=True)
#   OrderID     = ForeignKey(Order, on_delete=CASCADE, db_column='OrderID')
#   VariantID   = ForeignKey(ProductVariant, on_delete=PROTECT, db_column='VariantID')
#   Qty         = IntegerField()
#   Price       = DecimalField(max_digits=12, decimal_places=2)
#   class Meta: db_table = 'OrderItem'
# ===========================================================

from datetime import date as _date

# ============================================================
# API 29: DANH SÁCH VOUCHER (admin)
# GET /api/voucher/list/
# ============================================================
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
        data.append({
            "id":           v.VoucherID,
            "code":         v.Code,
            "type":         v.Type,
            "value":        str(v.Value),
            "scope":        v.Scope,
            "category_id":  v.CategoryID.CategoryID if v.CategoryID else None,
            "product_id":   v.ProductID.ProductID  if v.ProductID  else None,
            "min_order":    str(v.MinOrder),
            "max_discount": str(v.MaxDiscount) if v.MaxDiscount else None,
            "start_date":   str(v.StartDate) if v.StartDate else None,
            "end_date":     str(v.EndDate)   if v.EndDate   else None,
            "usage_limit":  v.UsageLimit,
            "used_count":   v.UsedCount,
            "is_active":    is_active,
        })
    return Response({"vouchers": data}, status=status.HTTP_200_OK)


# ============================================================
# API 30: TẠO VOUCHER (admin)
# POST /api/voucher/create/
# ============================================================
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

    cat_id  = request.data.get('category_id')
    prod_id = request.data.get('product_id')
    cat_obj = Category.objects.filter(CategoryID=cat_id).first() if cat_id else None
    prod_obj = Product.objects.filter(ProductID=prod_id).first() if prod_id else None

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
        MinOrder    = min_order,
        MaxDiscount = float(max_disc) if max_disc else None,
        StartDate   = start_date,
        EndDate     = end_date,
        UsageLimit  = int(usage_limit) if usage_limit else None,
        IsActive    = True,
    )
    return Response({"message": "Tạo voucher thành công", "id": v.VoucherID}, status=status.HTTP_201_CREATED)


# ============================================================
# API 31: VÔ HIỆU HÓA VOUCHER (admin)
# POST /api/voucher/deactivate/
# ============================================================
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


# ============================================================
# API 32: ÁP DỤNG VOUCHER (khách hàng)
# POST /api/voucher/apply/
# Body: { code }
# ============================================================
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

    return Response({
        "message": "Áp dụng voucher thành công",
        "voucher": {
            "id":           v.VoucherID,
            "code":         v.Code,
            "type":         v.Type,
            "value":        float(v.Value),
            "scope":        v.Scope,
            "category_id":  v.CategoryID.CategoryID if v.CategoryID else None,
            "product_id":   v.ProductID.ProductID  if v.ProductID  else None,
            "min_order":    float(v.MinOrder),
            "max_discount": float(v.MaxDiscount) if v.MaxDiscount else None,
        }
    }, status=status.HTTP_200_OK)


# ============================================================
# API 33: ĐẶT HÀNG
# POST /api/order/create/
# ============================================================
@api_view(['POST'])
def create_order(request):
    from .models import Voucher
    customer_id      = request.data.get('customer_id')
    items            = request.data.get('items', [])
    voucher_code     = request.data.get('voucher_code')
    subtotal         = float(request.data.get('subtotal', 0) or 0)
    discount         = float(request.data.get('discount', 0) or 0)
    total            = float(request.data.get('total', 0) or 0)
    payment_method   = request.data.get('payment_method', 'cod')  # 'cod' | 'momo'
    receiver_name    = request.data.get('receiver_name', '').strip()
    receiver_phone   = request.data.get('receiver_phone', '').strip()
    receiver_address = request.data.get('receiver_address', '').strip()
    note             = request.data.get('note', '').strip()

    if not customer_id or not items or not receiver_name or not receiver_phone or not receiver_address:
        return Response({"message": "Thiếu thông tin đặt hàng"}, status=status.HTTP_400_BAD_REQUEST)

    customer = Customer.objects.filter(CustomerID=customer_id).first()
    if not customer:
        return Response({"message": "Không tìm thấy tài khoản"}, status=status.HTTP_404_NOT_FOUND)

    # Kiểm tra stock đủ không
    for item in items:
        raw_vid = item.get('variant_id')
        try:
            vid = int(raw_vid)
        except (TypeError, ValueError):
            return Response({"message": f"variant_id không hợp lệ: '{raw_vid}'. Vui lòng chọn sản phẩm từ trang chi tiết."}, status=status.HTTP_400_BAD_REQUEST)
        variant = ProductVariant.objects.filter(VariantID=vid).first()
        if not variant:
            return Response({"message": f"Biến thể #{vid} không tồn tại"}, status=status.HTTP_400_BAD_REQUEST)
        qty = int(item.get('qty', 1))
        if variant.StockQuantity < qty:
            p = variant.ProductID
            return Response({"message": f"'{p.ProductName}' chỉ còn {variant.StockQuantity} sản phẩm"}, status=status.HTTP_400_BAD_REQUEST)

    shipping_address = f"{receiver_name} - {receiver_phone} - {receiver_address}"
    if note:
        shipping_address += f" | Ghi chú: {note}"

    # Tạo Order
    order_kwargs = dict(
        CustomerID      = customer,
        TotalAmount     = total,
        Status          = 'Processing',     # ← Bắt đầu bằng Processing (đang xử lý)
        ShippingAddress = shipping_address,
    )
    # Thêm field mới nếu model có hỗ trợ
    try:
        order = Order(**order_kwargs)
        order.PaymentMethod = payment_method
        order.Subtotal      = subtotal
        order.Discount      = discount
        order.StatusNote    = ""
        order.save()
    except Exception:
        order = Order.objects.create(**order_kwargs)

    # Tạo OrderDetail & trừ stock
    for item in items:
        variant = ProductVariant.objects.filter(VariantID=int(item.get('variant_id'))).first()
        if variant:
            qty = int(item.get('qty', 1))
            OrderDetail.objects.create(
                OrderID   = order,
                VariantID = variant,
                Quantity  = qty,
                UnitPrice = float(item.get('price', 0)),
            )
            # Trừ stock thủ công nếu signal/save không auto-trừ
            try:
                variant.StockQuantity = max(0, variant.StockQuantity - qty)
                variant.save()
            except Exception:
                pass

    # Tăng UsedCount voucher
    if voucher_code:
        v = Voucher.objects.filter(Code=voucher_code.upper()).first()
        if v:
            v.UsedCount += 1
            v.save()

    # Kết quả — nếu MoMo thì trả thêm URL thanh toán (placeholder)
    resp = {"message": "Đặt hàng thành công", "order_id": order.OrderID}
    if payment_method == "momo":
        # TODO: tích hợp MoMo API thực tế
        resp["momo_url"] = None   # None = không redirect, xử lý COD-like
    return Response(resp, status=status.HTTP_201_CREATED)


# ============================================================
# API 34: ĐỊA CHỈ KHÁCH HÀNG
# GET /api/customer/<id>/addresses/
# ============================================================
@api_view(['GET'])
def get_customer_addresses(request, customer_id):
    from .models import CustomerAddress
    addrs = CustomerAddress.objects.filter(CustomerID=customer_id)
    return Response({
        "addresses": [{"id": a.AddressID, "name": a.Name, "phone": a.Phone, "address": a.Address} for a in addrs]
    }, status=status.HTTP_200_OK)


# ============================================================
# API 35: TẠO ĐỊA CHỈ
# POST /api/customer/address/create/
# ============================================================
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


# ============================================================
# API 36: CẬP NHẬT ĐỊA CHỈ
# POST /api/customer/address/update/
# ============================================================
@api_view(['POST'])
def update_customer_address(request):
    from .models import CustomerAddress
    addr_id = request.data.get('id')
    a = CustomerAddress.objects.filter(AddressID=addr_id).first()
    if not a: return Response({"message": "Không tìm thấy địa chỉ"}, status=status.HTTP_404_NOT_FOUND)
    a.Name = request.data.get('name', a.Name).strip()
    a.Phone = request.data.get('phone', a.Phone).strip()
    a.Address = request.data.get('address', a.Address).strip()
    a.save()
    return Response({"message": "Đã cập nhật địa chỉ"}, status=status.HTTP_200_OK)


# ============================================================
# API 37: XÓA ĐỊA CHỈ
# POST /api/customer/address/delete/
# ============================================================
@api_view(['POST'])
def delete_customer_address(request):
    from .models import CustomerAddress
    addr_id = request.data.get('id')
    a = CustomerAddress.objects.filter(AddressID=addr_id).first()
    if not a: return Response({"message": "Không tìm thấy địa chỉ"}, status=status.HTTP_404_NOT_FOUND)
    a.delete()
    return Response({"message": "Đã xóa địa chỉ"}, status=status.HTTP_200_OK)


# ============================================================
# API: LẤY VOUCHER TỐT NHẤT ĐANG HIỆU LỰC
# GET /api/voucher/best/
# ============================================================
@api_view(['GET'])
def get_best_voucher(request):
    from .models import Voucher
    today = _date.today()
    vouchers = Voucher.objects.filter(IsActive=True)

    active = []
    for v in vouchers:
        if v.StartDate and v.StartDate > today: continue
        if v.EndDate   and v.EndDate   < today: continue
        if v.UsageLimit and v.UsedCount >= v.UsageLimit: continue
        active.append(v)

    if not active:
        return Response({"voucher": None}, status=status.HTTP_200_OK)

    # Ước tính giá trị giảm: percent dùng value, fixed dùng value trực tiếp
    # Sắp xếp: fixed theo value, percent theo value (% cao hơn = tốt hơn)
    def sort_key(v):
        if v.Type == 'fixed':   return float(v.Value)
        if v.Type == 'percent': return float(v.Value) * 1_000_000  # ưu tiên % cao
        return 0

    best = max(active, key=sort_key)

    return Response({
        "voucher": {
            "id":           best.VoucherID,
            "code":         best.Code,
            "type":         best.Type,
            "value":        float(best.Value),
            "scope":        best.Scope,
            "category_id":  best.CategoryID.CategoryID if best.CategoryID else None,
            "product_id":   best.ProductID.ProductID   if best.ProductID  else None,
            "min_order":    float(best.MinOrder),
            "max_discount": float(best.MaxDiscount) if best.MaxDiscount else None,
        }
    }, status=status.HTTP_200_OK)


# ============================================================
# API: DANH SÁCH ĐƠN HÀNG CỦA KHÁCH
# GET /api/order/list/?customer_id=KH001
# ============================================================
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
            v = d.VariantID
            p = v.ProductID
            primary_img = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first()
            items.append({
                "product_name": p.ProductName,
                "color":        v.Color or "",
                "storage":      v.Storage or "",
                "ram":          v.Ram or "",
                "quantity":     d.Quantity,
                "unit_price":   str(d.UnitPrice),
                "image":        v.Image or (primary_img.ImageUrl if primary_img else ""),
            })
        result.append({
            "id":              o.OrderID,
            "status":          o.Status,
            "total_amount":    str(o.TotalAmount),
            "shipping_address":o.ShippingAddress,
            "payment_method":  getattr(o, 'PaymentMethod', 'cod'),
            "status_note":     getattr(o, 'StatusNote', ''),
            "subtotal":        str(getattr(o, 'Subtotal', o.TotalAmount) or o.TotalAmount),
            "discount":        str(getattr(o, 'Discount', 0) or 0),
            "created_at":      o.OrderDate.isoformat(),
            "items":           items,
        })
    return Response({"orders": result}, status=status.HTTP_200_OK)


# ============================================================
# API: HỦY ĐƠN HÀNG (khách - chỉ khi Pending)
# POST /api/order/cancel/
# ============================================================
@api_view(['POST'])
def cancel_order(request):
    order_id    = request.data.get('order_id')
    customer_id = request.data.get('customer_id')
    o = Order.objects.filter(OrderID=order_id, CustomerID=customer_id).first()
    if not o:
        return Response({"message": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)
    if o.Status != 'Pending':
        return Response({"message": "Chỉ có thể hủy đơn hàng đang chờ xác nhận"}, status=status.HTTP_400_BAD_REQUEST)
    # Hoàn lại stock
    for d in OrderDetail.objects.filter(OrderID=o):
        d.VariantID.StockQuantity += d.Quantity
        d.VariantID.save()
    o.Status = 'Cancelled'
    o.save()
    return Response({"message": "Đã hủy đơn hàng"}, status=status.HTTP_200_OK)


# ============================================================
# API: ADMIN - DANH SÁCH TẤT CẢ ĐƠN HÀNG
# GET /api/order/admin/list/
# ============================================================
@api_view(['GET'])
def admin_list_orders(request):
    orders = Order.objects.all().order_by('-OrderDate')
    result = []
    for o in orders:
        details = OrderDetail.objects.filter(OrderID=o).select_related('VariantID__ProductID')
        items = []
        for d in details:
            v = d.VariantID
            p = v.ProductID
            primary_img = ProductImage.objects.filter(ProductID=p, IsPrimary=True).first()
            items.append({
                "product_name": p.ProductName,
                "color":        v.Color or "",
                "storage":      v.Storage or "",
                "ram":          v.Ram or "",
                "quantity":     d.Quantity,
                "unit_price":   str(d.UnitPrice),
                "image":        v.Image or (primary_img.ImageUrl if primary_img else ""),
            })
        cust = o.CustomerID
        result.append({
            "id":               o.OrderID,
            "status":           o.Status,
            "total_amount":     str(o.TotalAmount),
            "shipping_address": o.ShippingAddress,
            "payment_method":   getattr(o, 'PaymentMethod', 'cod'),
            "status_note":      getattr(o, 'StatusNote', ''),
            "subtotal":         str(getattr(o, 'Subtotal', o.TotalAmount) or o.TotalAmount),
            "discount":         str(getattr(o, 'Discount', 0) or 0),
            "created_at":       o.OrderDate.isoformat(),
            "customer_name":    cust.FullName,
            "customer_phone":   cust.PhoneNumber or "",
            "items":            items,
        })
    return Response({"orders": result}, status=status.HTTP_200_OK)


# ============================================================
# API: ADMIN - CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG
# POST /api/order/update-status/
# Body: { order_id, status, note }
# Các status hợp lệ: Pending → Processing → Shipping → Delivered | Cancelled
# ============================================================
@api_view(['POST'])
def update_order_status(request):
    VALID = ['Pending', 'Processing', 'Shipping', 'Delivered', 'Cancelled']
    FLOW  = { 'Pending': 'Processing', 'Processing': 'Shipping', 'Shipping': 'Delivered' }

    order_id   = request.data.get('order_id')
    new_status = request.data.get('status')
    note       = request.data.get('note', '').strip()

    if new_status not in VALID:
        return Response({"message": f"Trạng thái không hợp lệ. Chọn: {', '.join(VALID)}"}, status=status.HTTP_400_BAD_REQUEST)

    o = Order.objects.filter(OrderID=order_id).first()
    if not o:
        return Response({"message": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)

    # Kiểm tra luồng: chỉ cho phép tiến/hủy
    if new_status != 'Cancelled' and FLOW.get(o.Status) != new_status:
        return Response({"message": f"Không thể chuyển từ '{o.Status}' sang '{new_status}'"}, status=status.HTTP_400_BAD_REQUEST)

    if new_status == 'Cancelled' and o.Status in ['Shipping', 'Delivered']:
        return Response({"message": "Không thể hủy đơn đang giao hoặc đã giao"}, status=status.HTTP_400_BAD_REQUEST)

    # Hoàn stock nếu hủy
    if new_status == 'Cancelled' and o.Status not in ['Shipping', 'Delivered']:
        for d in OrderDetail.objects.filter(OrderID=o):
            d.VariantID.StockQuantity += d.Quantity
            d.VariantID.save()

    o.Status = new_status
    # Lưu note nếu model có field StatusNote
    try:
        o.StatusNote = note
    except Exception:
        pass
    o.save()

    return Response({"message": f"Đã cập nhật trạng thái sang '{new_status}'"}, status=status.HTTP_200_OK)