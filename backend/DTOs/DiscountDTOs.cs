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
    public bool Success { get; set; } = true;
    public int DiscountId { get; set; }
    public string Code { get; set; } = string.Empty;
    public int DiscountAmount { get; set; }
    public int FinalAmount { get; set; }
    public string Message { get; set; } = "Áp dụng mã thành công!";
}
