from django.db import models


# ============================================
# USER GROUP
# ============================================

class Customer(models.Model):
    CustomerID   = models.AutoField(primary_key=True)
    FullName     = models.CharField(max_length=100)
    Email        = models.EmailField(max_length=150, unique=True)
    Password     = models.CharField(max_length=255)
    PhoneNumber  = models.CharField(max_length=15, blank=True, null=True)
    Address      = models.CharField(max_length=255, blank=True, null=True)
    CreatedAt    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'Customer'

    def __str__(self):
        return self.FullName


class Staff(models.Model):
    ROLE_CHOICES = [('Admin', 'Admin'), ('Staff', 'Staff')]

    StaffID    = models.AutoField(primary_key=True)
    FullName   = models.CharField(max_length=100)
    Email      = models.EmailField(max_length=150, unique=True)
    Password   = models.CharField(max_length=255)
    Role       = models.CharField(max_length=50, choices=ROLE_CHOICES)
    CreatedAt  = models.DateTimeField(auto_now_add=True)

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
        unique_together = ('CustomerID', 'VariantID')  # Composite PK


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
        unique_together = ('OrderID', 'VariantID')  # Composite PK

    def save(self, *args, **kwargs):
        # Tự động trừ tồn kho khi tạo OrderDetail
        if not self.pk:
            variant = self.VariantID
            variant.StockQuantity -= self.Quantity
            variant.save()
            # Xóa khỏi giỏ hàng sau khi mua
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
