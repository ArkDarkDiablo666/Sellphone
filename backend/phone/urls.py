from django.urls import path
from . import views

urlpatterns = [
    # ===== ĐĂNG KÝ =====
    path('auth/register/',           views.register_normal),    # Đăng ký thường
    path('auth/google/register/',    views.register_google),    # Đăng ký Google
    path('auth/facebook/register/',  views.register_facebook),  # Đăng ký Facebook

    # ===== ĐĂNG NHẬP =====
    path('auth/login/',              views.login_normal),       # Đăng nhập thường
    path('auth/google/login/',       views.login_google),       # Đăng nhập Google
    path('auth/facebook/login/',     views.login_facebook),     # Đăng nhập Facebook
]