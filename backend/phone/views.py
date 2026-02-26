import hashlib
import random
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Customer, generate_customer_id

# Lưu OTP tạm thời trong memory { email: otp_code }
otp_storage = {}


# ===== HASH MẬT KHẨU =====
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


# ===== FORMAT DỮ LIỆU TRẢ VỀ =====
def customer_data(customer):
    return {
        "id":         customer.CustomerID,
        "full_name":  customer.FullName,
        "email":      customer.Email,
        "avatar":     customer.Avatar or "",
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

    if existing.Password != hash_password(password):
        return Response({"message": "Mật khẩu không đúng", "field": "password"}, status=status.HTTP_401_UNAUTHORIZED)

    return Response({"message": "Đăng nhập thành công", "customer": customer_data(existing)}, status=status.HTTP_200_OK)


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

    return Response({"message": "Đăng nhập Google thành công", "customer": customer_data(existing)}, status=status.HTTP_200_OK)


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

    return Response({"message": "Đăng nhập Facebook thành công", "customer": customer_data(existing)}, status=status.HTTP_200_OK)


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