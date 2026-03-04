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

    # Admin / Staff login
    path('auth/admin/login/',            views.admin_login),

    # Staff management
    path('staff/list/',                  views.list_staff),
    path('staff/create/',               views.create_staff),
    path('staff/update-role/',          views.update_staff_role),
    path('staff/change-password/',      views.change_staff_password),
    path('staff/upload-avatar/',        views.upload_staff_avatar),
    path('staff/<int:staff_id>/',       views.get_staff),

    # Quên mật khẩu
    path('auth/forgot-password/',    views.forgot_password),
    path('auth/verify-otp/',         views.verify_otp),
    path('auth/reset-password/',     views.reset_password),

    # Product
    path('product/categories/',          views.list_categories),
    path('product/category/create/',    views.create_category),
    path('product/category/update/',    views.update_category),
    path('product/list/',               views.list_products),
    path('product/create/',             views.create_product),
    path('product/import/',             views.import_stock),
    path('product/add-variants/',       views.add_variants),
    path('product/<int:product_id>/variants/', views.get_product_variants),
    path('product/<int:product_id>/detail/',   views.get_product_detail),

    # Thông tin customer
    path('customer/upload-avatar/',          views.upload_avatar),
    path('customer/update/',                views.update_customer),
    path('customer/change-password/',       views.change_password),
    path('customer/<str:customer_id>/',     views.get_customer),
]