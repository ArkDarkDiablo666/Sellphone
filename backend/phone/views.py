import hashlib
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Customer, generate_customer_id


# ===== HASH MẬT KHẨU =====
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


# ===== FORMAT DỮ LIỆU TRẢ VỀ =====
def customer_data(customer):
    return {
        "id":         customer.CustomerID,   # VD: KH001
        "full_name":  customer.FullName,
        "email":      customer.Email,
        "avatar":     customer.Avatar or "",
        "login_type": customer.LoginType,
    }


# ===== HÀM TẠO CUSTOMER DÙNG CHUNG =====
def create_customer(**kwargs):
    customer_id = generate_customer_id()
    return Customer.objects.create(CustomerID=customer_id, **kwargs)


# ============================================
# API 1: ĐĂNG KÝ THƯỜNG
# POST /api/auth/register/
# Body: { full_name, email, password }
# ============================================
@api_view(['POST'])
def register_normal(request):
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()
    password  = request.data.get('password', '').strip()

    if not full_name or not email or not password:
        return Response(
            {"message": "Vui lòng điền đầy đủ họ tên, email và mật khẩu"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if len(password) < 6:
        return Response(
            {"message": "Mật khẩu phải có ít nhất 6 ký tự"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if Customer.objects.filter(Email=email).exists():
        return Response(
            {"message": "Email này đã được đăng ký"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        customer = create_customer(
            FullName  = full_name,
            Email     = email,
            Password  = hash_password(password),
            LoginType = 'normal',
        )
    except ValueError as e:
        return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        "message":  "Đăng ký thành công",
        "customer": customer_data(customer),
    }, status=status.HTTP_201_CREATED)


# ============================================
# API 2: ĐĂNG NHẬP THƯỜNG
# POST /api/auth/login/
# Body: { email, password }
# ============================================
@api_view(['POST'])
def login_normal(request):
    email    = request.data.get('email', '').strip()
    password = request.data.get('password', '').strip()

    if not email or not password:
        return Response(
            {"message": "Vui lòng nhập email và mật khẩu"},
            status=status.HTTP_400_BAD_REQUEST
        )

    customer = Customer.objects.filter(Email=email, LoginType='normal').first()

    if not customer:
        return Response(
            {"message": "Email không tồn tại"},
            status=status.HTTP_404_NOT_FOUND
        )

    if customer.Password != hash_password(password):
        return Response(
            {"message": "Mật khẩu không đúng"},
            status=status.HTTP_401_UNAUTHORIZED
        )

    return Response({
        "message":  "Đăng nhập thành công",
        "customer": customer_data(customer),
    }, status=status.HTTP_200_OK)


# ============================================
# API 3: ĐĂNG KÝ GOOGLE
# POST /api/auth/google/register/
# Body: { google_id, full_name, email, avatar }
# ============================================
@api_view(['POST'])
def register_google(request):
    google_id = request.data.get('google_id', '').strip()
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()
    avatar    = request.data.get('avatar', '')

    if not google_id or not email or not full_name:
        return Response(
            {"message": "Thiếu thông tin từ Google"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if Customer.objects.filter(Email=email).exists():
        return Response(
            {"message": "Email này đã được đăng ký, vui lòng đăng nhập"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        customer = create_customer(
            FullName  = full_name,
            Email     = email,
            Password  = None,
            GoogleID  = google_id,
            Avatar    = avatar,
            LoginType = 'google',
        )
    except ValueError as e:
        return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        "message":  "Đăng ký Google thành công",
        "customer": customer_data(customer),
    }, status=status.HTTP_201_CREATED)


# ============================================
# API 4: ĐĂNG NHẬP GOOGLE
# POST /api/auth/google/login/
# Body: { full_name, email }
# ============================================
@api_view(['POST'])
def login_google(request):
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()

    if not full_name or not email:
        return Response(
            {"message": "Thiếu họ tên hoặc email"},
            status=status.HTTP_400_BAD_REQUEST
        )

    customer = Customer.objects.filter(
        Email     = email,
        FullName  = full_name,
        LoginType = 'google'
    ).first()

    if not customer:
        return Response(
            {"message": "Tài khoản Google chưa được đăng ký"},
            status=status.HTTP_404_NOT_FOUND
        )

    return Response({
        "message":  "Đăng nhập Google thành công",
        "customer": customer_data(customer),
    }, status=status.HTTP_200_OK)


# ============================================
# API 5: ĐĂNG KÝ FACEBOOK
# POST /api/auth/facebook/register/
# Body: { facebook_id, full_name, email, avatar }
# ============================================
@api_view(['POST'])
def register_facebook(request):
    facebook_id = request.data.get('facebook_id', '').strip()
    full_name   = request.data.get('full_name', '').strip()
    email       = request.data.get('email', '')
    avatar      = request.data.get('avatar', '')

    if not facebook_id or not full_name:
        return Response(
            {"message": "Thiếu thông tin từ Facebook"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if email and Customer.objects.filter(Email=email).exists():
        return Response(
            {"message": "Email này đã được đăng ký, vui lòng đăng nhập"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        customer = create_customer(
            FullName   = full_name,
            Email      = email if email else f"fb_{facebook_id}@noemail.com",
            Password   = None,
            FacebookID = facebook_id,
            Avatar     = avatar,
            LoginType  = 'facebook',
        )
    except ValueError as e:
        return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        "message":  "Đăng ký Facebook thành công",
        "customer": customer_data(customer),
    }, status=status.HTTP_201_CREATED)


# ============================================
# API 6: ĐĂNG NHẬP FACEBOOK
# POST /api/auth/facebook/login/
# Body: { full_name, email }
# ============================================
@api_view(['POST'])
def login_facebook(request):
    full_name = request.data.get('full_name', '').strip()
    email     = request.data.get('email', '').strip()

    if not full_name or not email:
        return Response(
            {"message": "Thiếu họ tên hoặc email"},
            status=status.HTTP_400_BAD_REQUEST
        )

    customer = Customer.objects.filter(
        Email     = email,
        FullName  = full_name,
        LoginType = 'facebook'
    ).first()

    if not customer:
        return Response(
            {"message": "Tài khoản Facebook chưa được đăng ký"},
            status=status.HTTP_404_NOT_FOUND
        )

    return Response({
        "message":  "Đăng nhập Facebook thành công",
        "customer": customer_data(customer),
    }, status=status.HTTP_200_OK)