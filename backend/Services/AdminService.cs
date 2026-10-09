using ClosedXML.Excel;
using GhtBackend.Data;
using GhtBackend.DTOs.Admin;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace GhtBackend.Services
{
    public class AdminService
    {
        private readonly AppDbContext _context;

        public AdminService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<DashboardDto> GetDashboardStatsAsync(DateTime? from, DateTime? to)
        {
            var validStatuses = new[] { "PAID", "DELIVERED", "COMPLETED" };

            var query = _context.Orders
                .Include(o => o.OrderItems)
                .Include(o => o.Discount)
                .Where(o => validStatuses.Contains(o.Status));

            if (from.HasValue) query = query.Where(o => o.CreatedAt >= from.Value);
            if (to.HasValue) query = query.Where(o => o.CreatedAt <= to.Value);

            var orders = await query.ToListAsync();

            var totalRevenue = orders.Sum(o => o.TotalPrice);
            var totalOrders = orders.Count;
            var productsSold = orders.SelectMany(o => o.OrderItems).Sum(i => i.Quantity);
            var lowStockCount = await _context.Products.CountAsync(p => p.InStock <= 10);
            var discountCost = orders.Sum(o => o.DiscountAmount);

            // Daily Revenue Chart
            var chart = orders
                .GroupBy(o => o.CreatedAt.Date)
                .Select(g => new DailyRevenueDto
                {
                    Date = g.Key.ToString("yyyy-MM-dd"),
                    Revenue = g.Sum(o => o.TotalPrice)
                })
                .OrderBy(d => d.Date)
                .ToList();

            // Discount Leaderboard
            var discounts = await _context.Discounts.ToListAsync();
            var topDiscounts = new List<DiscountRoiDto>();

            foreach (var d in discounts)
            {
                // Find all valid orders that used this discount
                var usedOrders = orders.Where(o => o.Discount?.Code == d.Code).ToList();
                
                decimal originalAmountSum = usedOrders.Sum(o => o.OriginalAmount);
                decimal discountAmountSum = usedOrders.Sum(o => o.DiscountAmount);
                
                decimal rawRoi = discountAmountSum > 0 ? (originalAmountSum / discountAmountSum) : 0;
                string roiStr = discountAmountSum > 0 ? $"{rawRoi.ToString("0.0", CultureInfo.InvariantCulture)}x" : "N/A";

                topDiscounts.Add(new DiscountRoiDto
                {
                    Code = d.Code,
                    Type = d.DiscountType,
                    Value = d.DiscountValue,
                    UsedCount = d.UsedCount,
                    TotalDiscountAmount = discountAmountSum,
                    RevenueFromCode = originalAmountSum,
                    ROI = roiStr,
                    RawRoi = rawRoi
                });
            }

            // Sắp xếp ROI giảm dần, "N/A" (RawRoi = 0) luôn xếp cuối cùng.
            topDiscounts = topDiscounts
                .OrderByDescending(d => d.RawRoi > 0 ? 1 : 0)
                .ThenByDescending(d => d.RawRoi)
                .Take(5)
                .ToList();

            return new DashboardDto
            {
                TotalRevenue = totalRevenue,
                TotalOrders = totalOrders,
                ProductsSold = productsSold,
                LowStockCount = lowStockCount,
                DiscountCost = discountCost,
                RevenueChart = chart,
                TopDiscounts = topDiscounts
            };
        }

        public async Task<byte[]> ExportExcelAsync(DateTime? from, DateTime? to)
        {
            var validStatuses = new[] { "PAID", "DELIVERED", "COMPLETED" };

            var query = _context.Orders
                .Include(o => o.Discount)
                .Where(o => validStatuses.Contains(o.Status));
            if (from.HasValue) query = query.Where(o => o.CreatedAt >= from.Value);
            if (to.HasValue) query = query.Where(o => o.CreatedAt <= to.Value);

            var orders = await query.ToListAsync();
            var discounts = await _context.Discounts.ToListAsync();

            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Khuyến mãi");

            // 7 cột cứng
            ws.Cell(1, 1).Value = "STT";
            ws.Cell(1, 2).Value = "Mã code";
            ws.Cell(1, 3).Value = "Loại & Giá trị";
            ws.Cell(1, 4).Value = "Tổng lượt đã dùng";
            ws.Cell(1, 5).Value = "Tổng tiền đã giảm";
            ws.Cell(1, 6).Value = "Doanh thu từ mã";
            ws.Cell(1, 7).Value = "ROI";

            // Make header bold
            var headerRange = ws.Range("A1:G1");
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;

            int row = 2;
            int stt = 1;

            var allDiscounts = new List<DiscountRoiDto>();
            foreach (var d in discounts)
            {
                var usedOrders = orders.Where(o => o.Discount?.Code == d.Code).ToList();
                decimal originalAmountSum = usedOrders.Sum(o => o.OriginalAmount);
                decimal discountAmountSum = usedOrders.Sum(o => o.DiscountAmount);
                
                decimal rawRoi = discountAmountSum > 0 ? (originalAmountSum / discountAmountSum) : 0;
                string roiStr = discountAmountSum > 0 ? $"{rawRoi.ToString("0.0", CultureInfo.InvariantCulture)}x" : "N/A";

                allDiscounts.Add(new DiscountRoiDto
                {
                    Code = d.Code,
                    Type = d.DiscountType,
                    Value = d.DiscountValue,
                    UsedCount = d.UsedCount,
                    TotalDiscountAmount = discountAmountSum,
                    RevenueFromCode = originalAmountSum,
                    ROI = roiStr,
                    RawRoi = rawRoi
                });
            }

            allDiscounts = allDiscounts
                .OrderByDescending(d => d.RawRoi > 0 ? 1 : 0)
                .ThenByDescending(d => d.RawRoi)
                .ToList();

            foreach (var d in allDiscounts)
            {
                ws.Cell(row, 1).Value = stt++;
                ws.Cell(row, 2).Value = d.Code;
                ws.Cell(row, 3).Value = d.Type == "PERCENTAGE" ? $"{d.Value}%" : $"{d.Value} đ";
                ws.Cell(row, 4).Value = d.UsedCount;
                ws.Cell(row, 5).Value = d.TotalDiscountAmount;
                ws.Cell(row, 6).Value = d.RevenueFromCode;
                ws.Cell(row, 7).Value = d.ROI;
                
                ws.Cell(row, 5).Style.NumberFormat.Format = "#,##0";
                ws.Cell(row, 6).Style.NumberFormat.Format = "#,##0";
                row++;
            }

            ws.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }
    }
}
