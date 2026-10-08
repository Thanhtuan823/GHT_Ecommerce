using System.ComponentModel.DataAnnotations.Schema;

namespace GhtBackend.Models;

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PasswordHash { get; set; }
    public string Role { get; set; } = "Customer"; // Admin, Staff, Customer
    public string? GoogleId { get; set; }
    public string? Avatar { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class Category
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Image { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<Product> Products { get; set; } = new List<Product>();
}

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public string? Brand { get; set; }
    public int Price { get; set; }
    public int InStock { get; set; }
    public string[] Images { get; set; } = Array.Empty<string>();
    
    [Column(TypeName = "jsonb")]
    public string Specs { get; set; } = "{}"; // JSON string
    
    public string[] Tags { get; set; } = Array.Empty<string>();
    public int SoldCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
}

public class Cart
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<CartItem> CartItems { get; set; } = new List<CartItem>();
}

public class CartItem
{
    public int Id { get; set; }
    public int CartId { get; set; }
    public Cart Cart { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int Quantity { get; set; }
}

public class Order
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Status { get; set; } = "PENDING_PAYMENT";
    public int TotalPrice { get; set; }
    public DateTime PaymentExpiredAt { get; set; }
    public int OriginalAmount { get; set; }
    public int DiscountAmount { get; set; }
    public int ShippingFee { get; set; }
    public bool IsPaid { get; set; }
    public DateTime? PaidAt { get; set; }
    
    [Column(TypeName = "jsonb")]
    public string ShippingAddress { get; set; } = "{}"; // JSON string
    
    public int? DiscountId { get; set; }
    public Discount? Discount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}

public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int Quantity { get; set; }
    public int Price { get; set; }
}

public class Discount
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string DiscountType { get; set; } = "PERCENTAGE"; // PERCENTAGE, FIXED
    public int DiscountValue { get; set; }
    public int? MaxDiscountAmount { get; set; }
    public int MinOrderAmount { get; set; }
    public int? UsageLimit { get; set; }
    public int UsedCount { get; set; }
    public int PerUserLimit { get; set; } = 1;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsActive { get; set; } = true;
    public string Conditions { get; set; } = "ALL"; // ALL, CATEGORY, BRAND, NEW_ARRIVAL
    public string[] ConditionValues { get; set; } = Array.Empty<string>();
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class UserUsedDiscount
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int DiscountId { get; set; }
    public Discount Discount { get; set; } = null!;
    public DateTime UsedAt { get; set; } = DateTime.UtcNow;
}

public class Review
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class Wishlist
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
