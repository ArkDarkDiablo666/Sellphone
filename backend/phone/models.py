from django.db import models


# ============================================
# USER GROUP
# ============================================

# ===== HÀM TẠO CUSTOMER ID TỰ ĐỘNG =====
# KH001, KH002, ... KH999
def generate_customer_id():
    last = Customer.objects.order_by('-CustomerID').first()
    if not last:
        return 'KH001'
    # Lấy số từ ID cuối, ví dụ 'KH001' → 1
    last_num = int(last.CustomerID[2:])
    if last_num >= 999:
        raise ValueError("Đã đạt giới hạn 999 khách hàng")
    return f"KH{str(last_num + 1).zfill(3)}"


class Customer(models.Model):
    LOGIN_TYPE_CHOICES = [
        ('normal',   'Normal'),
        ('google',   'Google'),
        ('facebook', 'Facebook'),
    ]

    CustomerID  = models.CharField(max_length=5, primary_key=True)  # KH001 → KH999
    FullName    = models.CharField(max_length=100)
    Email       = models.EmailField(max_length=150, unique=True)
    Password    = models.CharField(max_length=255, blank=True, null=True)
    PhoneNumber = models.CharField(max_length=15, blank=True, null=True)
    Address     = models.CharField(max_length=255, blank=True, null=True)
    Avatar      = models.TextField(blank=True, null=True)
    GoogleID    = models.CharField(max_length=100, blank=True, null=True)
    FacebookID  = models.CharField(max_length=100, blank=True, null=True)
    LoginType   = models.CharField(max_length=20, choices=LOGIN_TYPE_CHOICES, default='normal')
    CreatedAt   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Customer'

    def __str__(self):
        return f"{self.CustomerID} - {self.FullName}"


class Staff(models.Model):
    ROLE_CHOICES = [('Admin', 'Admin'), ('Staff', 'Staff'), ('Unentitled', 'Unentitled')]

    StaffID   = models.AutoField(primary_key=True)
    FullName  = models.CharField(max_length=100)
    Email     = models.EmailField(max_length=150, unique=True)
    Password  = models.CharField(max_length=255)
    Role      = models.CharField(max_length=50, choices=ROLE_CHOICES)
    Avatar    = models.CharField(max_length=500, blank=True, null=True)
    CreatedAt = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Staff'

    def __str__(self):
        return self.FullName


# ============================================
# PRODUCT GROUP
# ============================================

class Category(models.Model):
    CategoryID   = models.AutoField(primary_key=True)
    CategoryName = models.CharField(max_length=100)
    Image        = models.CharField(max_length=500, blank=True, null=True) 

    class Meta:
        db_table = 'Category'

    def __str__(self):
        return self.CategoryName


class Product(models.Model):
    ProductID   = models.AutoField(primary_key=True)
    ProductName = models.CharField(max_length=200)
    Description = models.TextField(blank=True, null=True)
    Brand       = models.CharField(max_length=100, blank=True, null=True)
    CategoryID  = models.ForeignKey(Category, on_delete=models.CASCADE, db_column='CategoryID')
    CreatedAt   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Product'

    def __str__(self):
        return self.ProductName


class ProductVariant(models.Model):
    VariantID        = models.AutoField(primary_key=True)
    ProductID        = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='ProductID')
    Image = models.CharField(max_length=500, blank=True, null=True)
    Cpu              = models.CharField(max_length=100, blank=True, null=True)
    OperatingSystem  = models.CharField(max_length=50, blank=True, null=True)
    ScreenSize       = models.CharField(max_length=50, blank=True, null=True)
    ScreenTechnology = models.CharField(max_length=50, blank=True, null=True)
    RefreshRate      = models.CharField(max_length=50, blank=True, null=True)
    Battery          = models.CharField(max_length=50, blank=True, null=True)
    ChargingSpeed    = models.CharField(max_length=50, blank=True, null=True)
    Storage          = models.CharField(max_length=50, blank=True, null=True)
    Ram              = models.CharField(max_length=50, blank=True, null=True)
    FrontCamera      = models.CharField(max_length=500, blank=True, null=True)
    RearCamera       = models.CharField(max_length=500, blank=True, null=True)
    Color            = models.CharField(max_length=50, blank=True, null=True)
    Weights          = models.CharField(max_length=50, blank=True, null=True)
    Updates          = models.CharField(max_length=50, blank=True, null=True)
    Price            = models.DecimalField(max_digits=18, decimal_places=2)
    StockQuantity    = models.IntegerField(default=0)

    class Meta:
        db_table = 'ProductVariant'

    def __str__(self):
        return f"{self.ProductID} - {self.Color} - {self.Storage}"


class ProductImage(models.Model):
    ImageID   = models.AutoField(primary_key=True)
    ProductID = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='ProductID')
    ImageUrl  = models.CharField(max_length=500)
    IsPrimary = models.BooleanField(default=False)

    class Meta:
        db_table = 'ProductImage'


# ============================================
# CART & ORDER GROUP
# ============================================

class Cart(models.Model):
    CustomerID = models.ForeignKey(Customer, on_delete=models.CASCADE, db_column='CustomerID')
    VariantID  = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, db_column='VariantID')
    Quantity   = models.IntegerField(default=1)

    class Meta:
        db_table = 'Cart'
        unique_together = ('CustomerID', 'VariantID')


class Order(models.Model):
    STATUS_CHOICES = [
        ('Pending',    'Pending'),
        ('Processing', 'Processing'),
        ('Shipping',   'Shipping'),
        ('Delivered',  'Delivered'),
        ('Cancelled',  'Cancelled'),
    ]

    OrderID         = models.AutoField(primary_key=True)
    CustomerID      = models.ForeignKey(Customer, on_delete=models.CASCADE, db_column='CustomerID')
    OrderDate       = models.DateTimeField(auto_now_add=True)
    TotalAmount     = models.DecimalField(max_digits=18, decimal_places=2)
    Status          = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Pending')
    ShippingAddress = models.CharField(max_length=255)
    PaymentMethod   = models.CharField(max_length=20, default='cod')
    StatusNote      = models.CharField(max_length=500, null=True, blank=True)
    Subtotal        = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    Discount        = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        db_table = 'Order'

    def __str__(self):
        return f"Order #{self.OrderID}"


class OrderDetail(models.Model):
    OrderID   = models.ForeignKey(Order, on_delete=models.CASCADE, db_column='OrderID')
    VariantID = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, db_column='VariantID')
    Quantity  = models.IntegerField()
    UnitPrice = models.DecimalField(max_digits=18, decimal_places=2)

    class Meta:
        db_table = 'OrderDetail'
        unique_together = ('OrderID', 'VariantID')

    def save(self, *args, **kwargs):
        if not self.pk:
            variant = self.VariantID
            variant.StockQuantity -= self.Quantity
            variant.save()
            Cart.objects.filter(
                CustomerID=self.OrderID.CustomerID,
                VariantID=self.VariantID
            ).delete()
        super().save(*args, **kwargs)


# ============================================
# PAYMENT & SHIPPING GROUP
# ============================================

class Payment(models.Model):
    METHOD_CHOICES = [
        ('COD',           'COD'),
        ('Bank Transfer', 'Bank Transfer'),
        ('E-Wallet',      'E-Wallet'),
    ]
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Paid',    'Paid'),
        ('Failed',  'Failed'),
    ]

    PaymentID = models.AutoField(primary_key=True)
    OrderID   = models.ForeignKey(Order, on_delete=models.CASCADE, db_column='OrderID')
    Method    = models.CharField(max_length=50, choices=METHOD_CHOICES)
    Status    = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Pending')
    PaidAt    = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'Payment'


class Shipping(models.Model):
    STATUS_CHOICES = [
        ('Waiting',    'Waiting'),
        ('In Transit', 'In Transit'),
        ('Delivered',  'Delivered'),
        ('Failed',     'Failed'),
    ]

    ShippingID        = models.AutoField(primary_key=True)
    OrderID           = models.ForeignKey(Order, on_delete=models.CASCADE, db_column='OrderID')
    ShippingProvider  = models.CharField(max_length=100, blank=True, null=True)
    TrackingCode      = models.CharField(max_length=100, blank=True, null=True)
    Status            = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Waiting')
    EstimatedDelivery = models.DateField(blank=True, null=True)

    class Meta:
        db_table = 'Shipping'

class Voucher(models.Model):
    VoucherID   = models.AutoField(primary_key=True)
    Code        = models.CharField(max_length=50, unique=True)
    Type        = models.CharField(max_length=10)       # 'percent' | 'fixed'
    Value       = models.DecimalField(max_digits=12, decimal_places=2)
    Scope       = models.CharField(max_length=20, default='all')  # 'all'|'category'|'product'
    CategoryID  = models.ForeignKey('Category', on_delete=models.SET_NULL, null=True, blank=True, db_column='CategoryID')
    ProductID   = models.ForeignKey('Product',  on_delete=models.SET_NULL, null=True, blank=True, db_column='ProductID')
    MinOrder    = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    MaxDiscount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    StartDate   = models.DateField(null=True, blank=True)
    EndDate     = models.DateField(null=True, blank=True)
    UsageLimit  = models.IntegerField(null=True, blank=True)
    UsedCount   = models.IntegerField(default=0)
    IsActive    = models.BooleanField(default=True)

    class Meta:
        db_table = 'Voucher'


class CustomerAddress(models.Model):
    AddressID  = models.AutoField(primary_key=True)
    CustomerID = models.ForeignKey('Customer', on_delete=models.CASCADE, db_column='CustomerID')
    Name       = models.CharField(max_length=100)
    Phone      = models.CharField(max_length=20)
    Address    = models.CharField(max_length=300)

    class Meta:
        db_table = 'CustomerAddress'

class ReturnRequest(models.Model):
    RETURN_STATUS = [
        ('Pending',   'Chờ xét duyệt'),
        ('Approved',  'Đã chấp nhận'),
        ('Rejected',  'Đã từ chối'),
        ('Returning', 'Đang nhận hàng hoàn về'),
        ('Completed', 'Hoàn tất'),
    ]
    ReturnID   = models.AutoField(primary_key=True)
    OrderID    = models.OneToOneField('Order', on_delete=models.CASCADE, db_column='OrderID')
    Reason     = models.TextField()
    Status     = models.CharField(max_length=20, choices=RETURN_STATUS, default='Pending')
    AdminNote  = models.CharField(max_length=500, null=True, blank=True)
    CreatedAt  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ReturnRequest'


class ReturnMedia(models.Model):
    MediaID   = models.AutoField(primary_key=True)
    ReturnID  = models.ForeignKey('ReturnRequest', on_delete=models.CASCADE, db_column='ReturnID')
    Url       = models.CharField(max_length=500)
    MediaType = models.CharField(max_length=10, default='image')  # 'image' | 'video'

    class Meta:
        db_table = 'ReturnMedia'

class Post(models.Model):
    CATEGORIES = [
        ('Mới nhất', 'Mới nhất'),
        ('Mẹo vặt',  'Mẹo vặt'),
        ('Đánh giá', 'Đánh giá'),
        ('Tin tức',  'Tin tức'),
    ]
    PostID    = models.AutoField(primary_key=True)
    Title     = models.CharField(max_length=300)
    Category  = models.CharField(max_length=50, default='Mẹo vặt')
    Blocks    = models.TextField(default='[]')   # JSON blocks
    Author    = models.CharField(max_length=100, default='Admin')
    CreatedAt = models.DateTimeField(auto_now_add=True)
    UpdatedAt = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'Post'


class ProductContent(models.Model):
    ContentID = models.AutoField(primary_key=True)
    ProductID = models.OneToOneField('Product', on_delete=models.CASCADE, db_column='ProductID')
    Blocks    = models.TextField(default='[]')   # JSON blocks
    UpdatedAt = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ProductContent'