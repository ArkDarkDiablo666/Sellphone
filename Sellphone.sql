-- ============================================
-- PHONE SELLING WEBSITE DATABASE - SQL SERVER
-- ============================================

CREATE DATABASE Sellphone;
GO

USE Sellphone;
GO

-- ============================================
-- USER GROUP
-- ============================================

CREATE TABLE Customer (
    CustomerID      INT IDENTITY(1,1) PRIMARY KEY,
    FullName        NVARCHAR(100)   NOT NULL,
    Email           VARCHAR(150)    NOT NULL UNIQUE,
    Password        VARCHAR(255)    NOT NULL,
    PhoneNumber     VARCHAR(15),
    Address         NVARCHAR(255),
    CreatedAt       DATETIME        DEFAULT GETDATE()
);

CREATE TABLE Staff (
    StaffID         INT IDENTITY(1,1) PRIMARY KEY,
    FullName        NVARCHAR(100)   NOT NULL,
    Email           VARCHAR(150)    NOT NULL UNIQUE,
    Password        VARCHAR(255)    NOT NULL,
    Role            VARCHAR(50)     NOT NULL CHECK (Role IN ('Admin', 'Staff', 'Unentitled')),
    CreatedAt       DATETIME        DEFAULT GETDATE()
);

-- ============================================
-- PRODUCT GROUP
-- ============================================

CREATE TABLE Category (
    CategoryID      INT IDENTITY(1,1) PRIMARY KEY,
    CategoryName    NVARCHAR(100)   NOT NULL
);

CREATE TABLE Product (
    ProductID       INT IDENTITY(1,1) PRIMARY KEY,
    ProductName     NVARCHAR(200)   NOT NULL,
    Description     NVARCHAR(MAX),
    Brand           NVARCHAR(100),
    CategoryID      INT             NOT NULL,
    CreatedAt       DATETIME        DEFAULT GETDATE(),
    CONSTRAINT FK_Product_Category FOREIGN KEY (CategoryID) REFERENCES Category(CategoryID)
);

CREATE TABLE ProductVariant (
    VariantID           INT IDENTITY(1,1) PRIMARY KEY,
    ProductID           INT             NOT NULL,
    Cpu                 NVARCHAR(50),
    OperatingSystem     NVARCHAR(50),
    ScreenSize          NVARCHAR(50),   
    ScreenTechnology    NVARCHAR(50),
    RefreshRate         NVARCHAR(50),
    Battery             NVARCHAR(50),       
    ChargingSpeed       NVARCHAR(50), 
    Storage             NVARCHAR(50),
    Ram                 NVARCHAR(50),
    FrontCamera         NVARCHAR(500),
    RearCamera          NVARCHAR(500),
    Color               NVARCHAR(50),
    Weights             NVARCHAR(50),
    Updates             NVARCHAR(50),
    Price               DECIMAL(18,2)   NOT NULL,
    StockQuantity       INT             NOT NULL DEFAULT 0,
    CONSTRAINT FK_Variant_Product FOREIGN KEY (ProductID) REFERENCES Product(ProductID)
);

CREATE TABLE ProductImage (
    ImageID         INT IDENTITY(1,1) PRIMARY KEY,
    ProductID       INT             NOT NULL,
    ImageUrl        VARCHAR(500)    NOT NULL,
    IsPrimary       BIT             DEFAULT 0,
    CONSTRAINT FK_Image_Product FOREIGN KEY (ProductID) REFERENCES Product(ProductID)
);

-- ============================================
-- CART & ORDER GROUP
-- ============================================

CREATE TABLE Cart (
    CustomerID      INT             NOT NULL,
    VariantID       INT             NOT NULL,
    Quantity        INT             NOT NULL DEFAULT 1,
    CONSTRAINT PK_Cart PRIMARY KEY (CustomerID, VariantID),
    CONSTRAINT FK_Cart_Customer FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID),
    CONSTRAINT FK_Cart_Variant  FOREIGN KEY (VariantID)  REFERENCES ProductVariant(VariantID)
);

CREATE TABLE [Order] (
    OrderID         INT IDENTITY(1,1) PRIMARY KEY,
    CustomerID      INT             NOT NULL,
    OrderDate       DATETIME        DEFAULT GETDATE(),
    TotalAmount     DECIMAL(18,2)   NOT NULL,
    Status          NVARCHAR(50)    NOT NULL DEFAULT 'Pending'
                    CHECK (Status IN ('Pending', 'Processing', 'Shipping', 'Delivered', 'Cancelled')),
    ShippingAddress NVARCHAR(255)   NOT NULL,
    CONSTRAINT FK_Order_Customer FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID)
);

CREATE TABLE OrderDetail (
    OrderID         INT             NOT NULL,
    VariantID       INT             NOT NULL,
    Quantity        INT             NOT NULL,
    UnitPrice       DECIMAL(18,2)   NOT NULL,
    CONSTRAINT PK_OrderDetail PRIMARY KEY (OrderID, VariantID),
    CONSTRAINT FK_OrderDetail_Order   FOREIGN KEY (OrderID)   REFERENCES [Order](OrderID),
    CONSTRAINT FK_OrderDetail_Variant FOREIGN KEY (VariantID) REFERENCES ProductVariant(VariantID)
);

-- ============================================
-- PAYMENT & SHIPPING GROUP
-- ============================================

CREATE TABLE Payment (
    PaymentID       INT IDENTITY(1,1) PRIMARY KEY,
    OrderID         INT             NOT NULL,
    Method          VARCHAR(50)     NOT NULL CHECK (Method IN ('COD', 'Bank Transfer', 'E-Wallet')),
    Status          VARCHAR(50)     NOT NULL DEFAULT 'Pending'
                    CHECK (Status IN ('Pending', 'Paid', 'Failed')),
    PaidAt          DATETIME,
    CONSTRAINT FK_Payment_Order FOREIGN KEY (OrderID) REFERENCES [Order](OrderID)
);

CREATE TABLE Shipping (
    ShippingID          INT IDENTITY(1,1) PRIMARY KEY,
    OrderID             INT             NOT NULL,
    ShippingProvider    NVARCHAR(100),
    TrackingCode        VARCHAR(100),
    Status              VARCHAR(50)     NOT NULL DEFAULT 'Waiting'
                        CHECK (Status IN ('Waiting', 'In Transit', 'Delivered', 'Failed')),
    EstimatedDelivery   DATE,
    CONSTRAINT FK_Shipping_Order FOREIGN KEY (OrderID) REFERENCES [Order](OrderID)
);

