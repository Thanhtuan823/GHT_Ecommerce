namespace GhtBackend.DTOs.Admin
{
    public class DashboardDto
    {
        public decimal TotalRevenue { get; set; }
        public int TotalOrders { get; set; }
        public int ProductsSold { get; set; }
        public int LowStockCount { get; set; }
        public decimal DiscountCost { get; set; }
        public List<DailyRevenueDto> RevenueChart { get; set; } = new();
        public List<DiscountRoiDto> TopDiscounts { get; set; } = new();
    }

    public class DailyRevenueDto
    {
        public string Date { get; set; } = string.Empty;
        public decimal Revenue { get; set; }
    }
}
