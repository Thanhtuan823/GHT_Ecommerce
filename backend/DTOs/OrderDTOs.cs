using System.ComponentModel.DataAnnotations;

namespace GhtBackend.DTOs;

public class CreateOrderRequest
{
    [Required]
    public List<OrderItemRequest> Items { get; set; } = new();

    [Required]
    public ShippingAddressDto ShippingAddress { get; set; } = null!;

    public string? DiscountCode { get; set; }

    [Required]
    public int ShippingFee { get; set; }
}

public class OrderItemRequest
{
    public int ProductId { get; set; }
    public int Quantity { get; set; }
}

public class ShippingAddressDto
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string ProvinceId { get; set; } = string.Empty;
    public string DistrictId { get; set; } = string.Empty;
    public string WardCode { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
}

public class SePayWebhookRequest
{
    public int id { get; set; }
    public string gateway { get; set; } = string.Empty;
    public string transactionDate { get; set; } = string.Empty;
    public string accountNumber { get; set; } = string.Empty;
    public string subAccount { get; set; } = string.Empty;
    public int transferAmount { get; set; }
    public string transferType { get; set; } = string.Empty;
    public int accumulated { get; set; }
    public string content { get; set; } = string.Empty;
    public string referenceCode { get; set; } = string.Empty;
}
