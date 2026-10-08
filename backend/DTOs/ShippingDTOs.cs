using System.ComponentModel.DataAnnotations;

namespace GhtBackend.DTOs;

public class CalculateFeeRequest
{
    [Required]
    public string ProvinceId { get; set; } = string.Empty;
    [Required]
    public string DistrictId { get; set; } = string.Empty;
    [Required]
    public string WardCode { get; set; } = string.Empty;
    [Required]
    public int Weight { get; set; }
    public List<OrderItemRequest> Items { get; set; } = new();
}
