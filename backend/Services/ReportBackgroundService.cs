using GhtBackend.Data;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace GhtBackend.Services;

public class ReportBackgroundService
{
    private readonly AppDbContext _context;
    private readonly EmailService _emailService;
    private readonly ILogger<ReportBackgroundService> _logger;

    public ReportBackgroundService(AppDbContext context, EmailService emailService, ILogger<ReportBackgroundService> logger)
    {
        _context = context;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task GenerateDailyReport()
    {
        try
        {
            var yesterday = DateTime.UtcNow.Date.AddDays(-1);
            var today = DateTime.UtcNow.Date;

            var validStatuses = new[] { "PAID", "DELIVERED", "COMPLETED" };

            var orders = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
                .Where(o => o.CreatedAt >= yesterday && o.CreatedAt < today && validStatuses.Contains(o.Status))
                .ToListAsync();

            int totalRevenue = orders.Sum(o => o.TotalPrice);
            int totalOrders = orders.Count;

            var topProducts = orders
                .SelectMany(o => o.OrderItems)
                .GroupBy(oi => oi.Product?.Name)
                .Select(g => new { Name = g.Key, Qty = g.Sum(x => x.Quantity) })
                .OrderByDescending(x => x.Qty)
                .Take(3)
                .ToList();

            var sb = new StringBuilder();
            sb.Append($"<h2>Báo cáo ngày {yesterday:dd/MM/yyyy}</h2>");
            sb.Append($"<p>Doanh thu: {totalRevenue:N0} đ</p>");
            sb.Append($"<p>Số đơn hàng: {totalOrders}</p>");
            sb.Append("<h3>Top 3 sản phẩm bán chạy:</h3><ul>");
            foreach (var p in topProducts)
            {
                sb.Append($"<li>{p.Name}: {p.Qty}</li>");
            }
            sb.Append("</ul>");

            await _emailService.SendReportEmail($"Báo cáo ngày {yesterday:dd/MM/yyyy}", sb.ToString());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate daily report");
        }
    }

    public async Task GenerateWeeklyReport()
    {
        try
        {
            var lastWeek = DateTime.UtcNow.Date.AddDays(-7);
            var today = DateTime.UtcNow.Date;

            var validStatuses = new[] { "PAID", "DELIVERED", "COMPLETED" };

            var orders = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
                .Where(o => o.CreatedAt >= lastWeek && o.CreatedAt < today && validStatuses.Contains(o.Status))
                .ToListAsync();

            int totalRevenue = orders.Sum(o => o.TotalPrice);
            int totalOrders = orders.Count;
            int aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            var topProducts = orders
                .SelectMany(o => o.OrderItems)
                .GroupBy(oi => oi.Product?.Name)
                .Select(g => new { Name = g.Key, Qty = g.Sum(x => x.Quantity) })
                .OrderByDescending(x => x.Qty)
                .Take(5)
                .ToList();

            var sb = new StringBuilder();
            sb.Append($"<h2>Báo cáo tuần {lastWeek:dd/MM/yyyy} - {today:dd/MM/yyyy}</h2>");
            sb.Append($"<p>Doanh thu: {totalRevenue:N0} đ</p>");
            sb.Append($"<p>Số đơn hàng: {totalOrders}</p>");
            sb.Append($"<p>AOV (Giá trị ĐB/Đơn): {aov:N0} đ</p>");
            sb.Append("<h3>Top 5 sản phẩm bán chạy:</h3><ul>");
            foreach (var p in topProducts)
            {
                sb.Append($"<li>{p.Name}: {p.Qty}</li>");
            }
            sb.Append("</ul>");

            await _emailService.SendReportEmail($"Báo cáo tuần", sb.ToString());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate weekly report");
        }
    }

    public async Task CheckLowStock()
    {
        try
        {
            var lowStockThreshold = 10;
            var products = await _context.Products
                .Where(p => p.InStock <= lowStockThreshold)
                .ToListAsync();

            if (products.Any())
            {
                var sb = new StringBuilder();
                sb.Append($"<h2>Cảnh báo: Tồn kho thấp (<= {lowStockThreshold})</h2><ul>");
                foreach (var p in products)
                {
                    sb.Append($"<li>{p.Name}: Còn {p.InStock}</li>");
                }
                sb.Append("</ul>");

                await _emailService.SendReportEmail($"Cảnh báo tồn kho", sb.ToString());
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check low stock");
        }
    }
}
