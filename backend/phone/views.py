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
from .models import Customer, Staff, Product, ProductVariant, ProductImage, Category, generate_customer_id

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
        "categories": [{"id": c.CategoryID, "name": c.CategoryName} for c in cats]
    }, status=status.HTTP_200_OK)


# ============================================
# API 22: DANH SÁCH SẢN PHẨM
# GET /api/product/list/
# ============================================
@api_view(['GET'])
def list_products(request):
    products = Product.objects.select_related('CategoryID').all().order_by('-CreatedAt')
    data = []
    for p in products:
        variant_count = ProductVariant.objects.filter(ProductID=p).count()
        data.append({
            "id":            p.ProductID,
            "name":          p.ProductName,
            "brand":         p.Brand or "",
            "description":   p.Description or "",
            "category":      p.CategoryID.CategoryName,
            "category_id":   p.CategoryID.CategoryID,
            "variant_count": variant_count,
        })
    return Response({"products": data}, status=status.HTTP_200_OK)


# ============================================
# API 23: TẠO SẢN PHẨM + BIẾN THỂ + ẢNH
# POST /api/product/create/
# Body: multipart/form-data
#   product_name, brand, description, category_id
#   variants (JSON string)
#   images (files, nhiều file)
# ============================================
@api_view(['POST'])
def create_product(request):
    import json

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

    for v in variants:
        if not v.get('price') or not v.get('stock'):
            return Response({"message": "Mỗi biến thể cần có giá và số lượng"}, status=status.HTTP_400_BAD_REQUEST)

    # Tạo Product
    product = Product.objects.create(
        ProductName = product_name,
        Brand       = brand or None,
        Description = description or None,
        CategoryID  = category,
    )

    # Tạo Variants
    for v in variants:
        ProductVariant.objects.create(
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