using System.ComponentModel.DataAnnotations;

namespace GhtBackend.DTOs;

public class ApplyDiscountRequest
{
    [Required]
    public string Code { get; set; } = string.Empty;
    [Required]
    public int OriginalAmount { get; set; }
    [Required]
    public List<OrderItemRequest> Items { get; set; } = new();
}

public class ApplyDiscountResponse
{
    public int DiscountAmount { get; set; }
    public int DiscountId { get; set; }
}
