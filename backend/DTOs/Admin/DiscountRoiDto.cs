namespace GhtBackend.DTOs.Admin
{
    public class DiscountRoiDto
    {
        public string Code { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public decimal Value { get; set; }
        public int UsedCount { get; set; }
        public decimal TotalDiscountAmount { get; set; }
        public decimal RevenueFromCode { get; set; }
        public string ROI { get; set; } = string.Empty;
        // Used for sorting before taking top 5
        public decimal RawRoi { get; set; }
    }
}
