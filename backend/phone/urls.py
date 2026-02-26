from django.urls import path
from . import views

urlpatterns = [
    # Kiểm tra email
    path('auth/check-email/',        views.check_email),

    # Đăng ký / Đăng nhập thường
    path('auth/register/',           views.register_normal),
    path('auth/login/',              views.login_normal),

    # Google
    path('auth/google/register/',    views.register_google),
    path('auth/google/login/',       views.login_google),

    # Facebook
    path('auth/facebook/register/',  views.register_facebook),
    path('auth/facebook/login/',     views.login_facebook),

    # Quên mật khẩu
    path('auth/forgot-password/',    views.forgot_password),
    path('auth/verify-otp/',         views.verify_otp),
    path('auth/reset-password/',     views.reset_password),

    # Thông tin customer
    path('customer/update/',                views.update_customer),
    path('customer/change-password/',       views.change_password),
    path('customer/<str:customer_id>/',     views.get_customer),
]