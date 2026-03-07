from django.urls import path
from . import views

urlpatterns = [
    # Auth
    path('auth/check-email/',            views.check_email),
    path('auth/register/',               views.register_normal),
    path('auth/login/',                  views.login_normal),
    path('auth/google/register/',        views.register_google),
    path('auth/google/login/',           views.login_google),
    path('auth/facebook/register/',      views.register_facebook),
    path('auth/facebook/login/',         views.login_facebook),
    path('auth/admin/login/',            views.admin_login),
    path('auth/forgot-password/',        views.forgot_password),
    path('auth/verify-otp/',             views.verify_otp),
    path('auth/reset-password/',         views.reset_password),

    # Staff
    path('staff/list/',                  views.list_staff),
    path('staff/create/',                views.create_staff),
    path('staff/update-role/',           views.update_staff_role),
    path('staff/change-password/',       views.change_staff_password),
    path('staff/upload-avatar/',         views.upload_staff_avatar),
    path('staff/<int:staff_id>/',        views.get_staff),

    # Product
    path('product/categories/',          views.list_categories),
    path('category/list/',               views.list_categories),
    path('product/category/create/',     views.create_category),
    path('product/category/update/',     views.update_category),
    path('product/list/',                views.list_products),
    path('product/create/',              views.create_product),
    path('product/import/',              views.import_stock),
    path('product/add-variants/',        views.add_variants),
    path('product/<int:product_id>/variants/', views.get_product_variants),
    path('product/<int:product_id>/detail/',   views.get_product_detail),

    # Voucher
    path('voucher/list/',                views.list_vouchers),
    path('voucher/active/',              views.list_active_vouchers),
    path('voucher/create/',              views.create_voucher),
    path('voucher/apply/',               views.apply_voucher),
    path('voucher/deactivate/',          views.deactivate_voucher),
    path('voucher/best/',                views.get_best_voucher),
    path('voucher/best-for-cart/',       views.get_best_voucher_for_cart),
    path('voucher/best-for-product/',    views.get_best_voucher_for_product),

    # Order — static trước wildcard
    path('order/list/',                  views.list_orders),
    path('order/cancel/',                views.cancel_order),
    path('order/admin/list/',            views.admin_list_orders),
    path('order/update-status/',         views.update_order_status),
    path('order/create/',                views.create_order),
    path('order/return/request/',         views.create_return_request),
    path('order/return/list/',            views.list_return_requests),
    path('order/return/process/',         views.process_return_request),
    path('order/<int:order_id>/return/',  views.get_return_request),

    # Post / Blog
    path('post/list/',                   views.list_posts),
    path('post/create/',                 views.create_post),
    path('post/update/',                 views.update_post),
    path('post/delete/',                 views.delete_post),
    path('post/<int:post_id>/',          views.get_post),

    # Product Content (mô tả rich)
    path('product/content/save/',        views.save_product_content),
    path('product/<int:product_id>/content/', views.get_product_content),

    # Customer Address — static trước wildcard
    path('customer/upload-avatar/',      views.upload_avatar),
    path('customer/update/',             views.update_customer),
    path('customer/change-password/',    views.change_password),
    path('customer/address/create/',     views.create_customer_address),
    path('customer/address/update/',     views.update_customer_address),
    path('customer/address/delete/',     views.delete_customer_address),
    path('customer/<str:customer_id>/addresses/', views.get_customer_addresses),
    path('customer/<str:customer_id>/',  views.get_customer),
]