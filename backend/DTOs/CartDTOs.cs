using System.ComponentModel.DataAnnotations;

namespace GhtBackend.DTOs;

public class CartDto
{
    public int CartId { get; set; }
    public List<CartItemDto> Items { get; set; } = new();
    public int TotalPrice { get; set; }
}

public class CartItemDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string ProductSlug { get; set; } = string.Empty;
    public int Price { get; set; }
    public int InStock { get; set; }
    public string? Image { get; set; }
    public int Quantity { get; set; }
}

public class AddToCartRequest
{
    [Required]
    public int ProductId { get; set; }
    
    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "Số lượng phải lớn hơn 0")]
    public int Quantity { get; set; }
}

public class SyncCartRequest
{
    public List<AddToCartRequest> Items { get; set; } = new();
}
