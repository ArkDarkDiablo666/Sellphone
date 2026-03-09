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

    # ── Review ──────────────────────────────────────────────────
    path('review/list/',          views.list_reviews),          # GET  ?product_id=&customer_id=
    path('review/create/',        views.create_review),         # POST
    path('review/update/',        views.update_review),         # POST
    path('review/delete/',        views.delete_review),         # POST
    path('review/upload-media/',  views.upload_review_media),   # POST multipart

    # ── Comment ─────────────────────────────────────────────────
    path('comment/list/',         views.list_comments),         # GET  ?product_id=&customer_id=
    path('comment/create/',       views.create_comment),        # POST
    path('comment/delete/',       views.delete_comment),        # POST

    # ── Like ────────────────────────────────────────────────────
    path('like/toggle/',          views.toggle_like),           # POST { customer_id, type, target_id }

    # ── Admin: review & comment management ──────────────────────
    path('admin/reviews/',        views.admin_list_reviews),    # GET  ?count_only=1
    path('admin/reply/',          views.admin_reply),           # POST { type, target_id, content }
    path('admin/reply/delete/',   views.admin_delete_reply),    # POST { type, target_id }

    path('search/text/',          views.search_text),
    path('search/image/',         views.search_image),
    path('search/suggestions/',   views.search_suggestions),
    path('search/rebuild-index/', views.rebuild_search_index),
    path('search/model-info/',    views.search_model_info),

    path("payment/momo/create/",   views.momo_create,    name="momo_create"),
    path("payment/momo/ipn/",      views.momo_ipn,       name="momo_ipn"),
    path("payment/momo/return/",   views.momo_return,    name="momo_return"),

    # ── VNPay ─────────────────────────────────────────────────
    path("payment/vnpay/create/",  views.vnpay_create,   name="vnpay_create"),
    path("payment/vnpay/return/",  views.vnpay_return,   name="vnpay_return"),

    # ── Dashboard doanh thu ───────────────────────────────────
    path("admin/dashboard/overview/",           views.dashboard_overview,           name="dashboard_overview"),
    path("admin/dashboard/revenue/day/",        views.dashboard_revenue_by_day,     name="dashboard_revenue_day"),
    path("admin/dashboard/revenue/month/",      views.dashboard_revenue_by_month,   name="dashboard_revenue_month"),
    path("admin/dashboard/revenue/year/",       views.dashboard_revenue_by_year,    name="dashboard_revenue_year"),
    path("admin/dashboard/revenue/product/",    views.dashboard_revenue_by_product, name="dashboard_revenue_product"),
    path("admin/dashboard/revenue/brand/",      views.dashboard_revenue_by_brand,   name="dashboard_revenue_brand"),
    path("admin/dashboard/revenue/compare/",    views.dashboard_revenue_compare,    name="dashboard_revenue_compare"),
]