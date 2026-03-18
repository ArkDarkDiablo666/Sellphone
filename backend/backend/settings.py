"""
Django settings for backend project.

QUAN TRỌNG: Tạo file .env ở thư mục gốc project với nội dung:
  DJANGO_SECRET_KEY=your-very-long-random-secret-key-here
  DJANGO_DEBUG=True
  DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
  DB_NAME=Sellphone
  DB_HOST=ARK\ARK
  DB_USER=ARK
  DB_PASSWORD=your_db_password
  CLOUDINARY_CLOUD_NAME=dag3scrwl
  CLOUDINARY_API_KEY=997941784142674
  CLOUDINARY_API_SECRET=5QXdjv-HeiJEPPhEUcukPFIRyFU
  EMAIL_HOST_USER=ark666diablo@gmail.com
  EMAIL_HOST_PASSWORD=your_gmail_app_password
  MOMO_PARTNER_CODE=MOMO
  MOMO_ACCESS_KEY=F8BBA842ECF85
  MOMO_SECRET_KEY=your_momo_secret_key
  MOMO_REDIRECT_URL=http://localhost:3000/payment/momo-return
  MOMO_IPN_URL=http://localhost:8000/api/payment/momo/ipn/
  VNPAY_TMN_CODE=SQIUFSBH
  VNPAY_HASH_SECRET=your_vnpay_hash_secret
  VNPAY_RETURN_URL=http://localhost:3000/payment/vnpay-return
  ANTHROPIC_API_KEY=sk-ant-api03-...
  FRONTEND_URL=http://localhost:3000
  BACKEND_URL=http://localhost:8000
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Đọc .env nếu có (dùng python-dotenv hoặc đặt tay vào shell) ──
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass  # pip install python-dotenv nếu muốn dùng .env file

# ── Bảo mật: KHÔNG được hardcode secret ───────────────────────
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "Thiếu biến môi trường DJANGO_SECRET_KEY. "
        "Hãy tạo file .env hoặc set biến môi trường."
    )

# ── Debug: mặc định False khi production ─────────────────────
DEBUG = os.environ.get("DJANGO_DEBUG", "False").lower() in ("true", "1", "yes")

# ── Allowed hosts từ env (phân cách bằng dấu phẩy) ───────────
_allowed = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
ALLOWED_HOSTS = [h.strip() for h in _allowed.split(",") if h.strip()]

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
]

REST_FRAMEWORK = {
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
        'NAME':     os.environ.get("DB_NAME", "Sellphone"),
        'HOST':     os.environ.get("DB_HOST", r"ARK\ARK"),
        'PORT':     os.environ.get("DB_PORT", ""),
        'USER':     os.environ.get("DB_USER", ""),
        'PASSWORD': os.environ.get("DB_PASSWORD", ""),
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
        'LOCATION': os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/1"),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

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
TIME_ZONE     = "Asia/Ho_Chi_Minh"
USE_I18N      = True
USE_TZ        = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── CORS: chỉ cho phép các origin được cấu hình ──────────────
# Development: set CORS_ALLOW_ALL=True trong .env
# Production:  set CORS_ALLOWED_ORIGINS=https://yourdomain.com
if os.environ.get("CORS_ALLOW_ALL", "False").lower() in ("true", "1"):
    CORS_ALLOW_ALL_ORIGINS = True
else:
    _cors_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins.split(",") if o.strip()]

# ── Email ─────────────────────────────────────────────────────
EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = 'smtp.gmail.com'
EMAIL_PORT          = 587
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL  = os.environ.get("EMAIL_HOST_USER", "")

# ══════════════════════════════════════════════════════════════
# PAYMENT CONFIG — đọc từ env, KHÔNG hardcode
# ══════════════════════════════════════════════════════════════
_backend_url  = os.environ.get("BACKEND_URL",  "http://localhost:8000")
_frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")

MOMO_CONFIG = {
    "partner_code": os.environ.get("MOMO_PARTNER_CODE", "MOMO"),
    "access_key":   os.environ.get("MOMO_ACCESS_KEY", ""),
    "secret_key":   os.environ.get("MOMO_SECRET_KEY", ""),
    "endpoint":     "https://test-payment.momo.vn/v2/gateway/api/create",
    "redirect_url": os.environ.get("MOMO_REDIRECT_URL", f"{_frontend_url}/payment/momo-return"),
    "ipn_url":      os.environ.get("MOMO_IPN_URL",      f"{_backend_url}/api/payment/momo/ipn/"),
}

VNPAY_CONFIG = {
    "tmn_code":    os.environ.get("VNPAY_TMN_CODE", ""),
    "hash_secret": os.environ.get("VNPAY_HASH_SECRET", ""),
    "url":         "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    "return_url":  os.environ.get("VNPAY_RETURN_URL", f"{_frontend_url}/payment/vnpay-return"),
}

# ── Anthropic API key ─────────────────────────────────────────
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# ── Cloudinary (đọc bởi views.py qua env — không cần đặt ở đây) ──
# views.py đọc: os.environ.get("CLOUDINARY_CLOUD_NAME"), v.v.

# ── Upload size limits ────────────────────────────────────────
DATA_UPLOAD_MAX_MEMORY_SIZE   = 524288000   # 500MB
FILE_UPLOAD_MAX_MEMORY_SIZE   = 524288000   # 500MB
DATA_UPLOAD_MAX_NUMBER_FIELDS = 10000