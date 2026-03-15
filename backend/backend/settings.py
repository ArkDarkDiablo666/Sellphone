"""
Django settings for backend project.
"""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "django-insecure-xe2*6jbhlh%wtqoxb(w1f*kogxh55n9hlhlw%f0zj6rb@7)57^"

DEBUG = True

ALLOWED_HOSTS = []

INSTALLED_APPS = [
    'corsheaders',
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "phone",
    "rest_framework",
    # [REMOVED] rest_framework_simplejwt — không dùng SimpleJWT
    # [REMOVED] rest_framework_simplejwt.token_blacklist
]

REST_FRAMEWORK = {
    # [FIX] Xóa JWTAuthentication — dùng PyJWT thủ công qua permissions.py
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# [REMOVED] SIMPLE_JWT config — không còn dùng SimpleJWT

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.wsgi.application"

DATABASES = {
    'default': {
        'ENGINE':   'mssql',
        'NAME':     'Sellphone',
        'HOST':     'ARK\\ARK',
        'PORT':     '',
        'USER':     'ARK',
        'PASSWORD': 'Ark40029071@',
        'OPTIONS': {
            'driver': 'ODBC Driver 17 for SQL Server',
        },
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

# [FIX] Thêm django.server logger để hiển thị API request logs trong terminal
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'django.server': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

LANGUAGE_CODE = "en-us"
# [FIX #TIMESTAMP] Đổi sang múi giờ Việt Nam để log hiển thị đúng giờ
TIME_ZONE     = "Asia/Ho_Chi_Minh"
USE_I18N      = True
USE_TZ        = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOW_ALL_ORIGINS = True

EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = 'smtp.gmail.com'
EMAIL_PORT          = 587
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = 'ark666diablo@gmail.com'
EMAIL_HOST_PASSWORD = 'jcxkdrngdwcvaxse'
DEFAULT_FROM_EMAIL  = 'ark666diablo@gmail.com'

# ══════════════════════════════════════════════════════════════
# PAYMENT CONFIG
# ══════════════════════════════════════════════════════════════

# ── MoMo Sandbox ─────────────────────────────────────────────
# Thông tin test MoMo (môi trường sandbox):
#   Không cần thẻ thật — MoMo sandbox tự mô phỏng thanh toán thành công/thất bại
#   Sau khi redirect sang MoMo test, chọn "Thanh toán thành công" hoặc "Thất bại"
MOMO_CONFIG = {
    "partner_code": "MOMO",
    "access_key":   "F8BBA842ECF85",
    "secret_key":   "K951B6PE1waDMi640xX08PD3vg6EkVlz",
    "endpoint":     "https://test-payment.momo.vn/v2/gateway/api/create",
    "redirect_url": "http://localhost:3000/payment/momo-return",
    "ipn_url":      "http://localhost:8000/api/payment/momo/ipn/",
}

# ── VNPAY Sandbox ─────────────────────────────────────────────
# [FIX] Cập nhật TMN Code và Hash Secret thật từ portal VNPAY sandbox
# Thông tin thẻ test VNPAY:
#   Ngân hàng   : NCB
#   Số thẻ      : 9704198526191432198
#   Tên chủ thẻ : NGUYEN VAN A
#   Ngày PH     : 07/15
#   Mật khẩu OTP: 123456
VNPAY_CONFIG = {
    "tmn_code":    "SQIUFSBH",
    "hash_secret": "AG0866KYZ7XEOJ5IEYBNJ9595KT4Y4UB",
    "url":         "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    "return_url":  "http://localhost:3000/payment/vnpay-return",
}
# ── Upload size limits ────────────────────────────────────────
# [FIX #413] Cho phép upload file lớn (video review, banner...)
DATA_UPLOAD_MAX_MEMORY_SIZE = 524288000   # 500MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 524288000   # 500MB
DATA_UPLOAD_MAX_NUMBER_FIELDS = 10000
ANTHROPIC_API_KEY = "sk-ant-api03-..."