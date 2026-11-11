using GhtBackend.Data;
using GhtBackend.Models;
using GhtBackend.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace GhtBackend.Services;

public class ReportBackgroundService
{
    private readonly AppDbContext _context;
    private readonly EmailService _emailService;
    private readonly ILogger<ReportBackgroundService> _logger;
    private readonly IHubContext<ChatHub> _chatHub;

    public ReportBackgroundService(
        AppDbContext context,
        EmailService emailService,
        ILogger<ReportBackgroundService> logger,
        IHubContext<ChatHub> chatHub)
    {
        _context = context;
        _emailService = emailService;
        _logger = logger;
        _chatHub = chatHub;
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

                // Tạo record Notification trong DB cho Admin và Staff
                var adminStaffUsers = await _context.Users
                    .AsNoTracking()
                    .Where(u => (u.Role == "Admin" || u.Role == "Staff") && u.IsActive)
                    .ToListAsync();

                var now = DateTime.UtcNow;
                var notifs = new List<Notification>();

                foreach (var p in products)
                {
                    foreach (var u in adminStaffUsers)
                    {
                        notifs.Add(new Notification
                        {
                            UserId = u.Id,
                            Title = "Cảnh báo tồn kho",
                            Message = $"Sản phẩm {p.Name} chỉ còn {p.InStock} sản phẩm",
                            Type = "LOW_STOCK",
                            TargetUrl = $"/admin/products?editId={p.Id}",
                            Metadata = $"{{\"productId\": {p.Id}, \"inStock\": {p.InStock}}}",
                            IsRead = false,
                            CreatedAt = now
                        });
                    }
                }

                if (notifs.Any())
                {
                    _context.Notifications.AddRange(notifs);
                    await _context.SaveChangesAsync();

                    await _chatHub.Clients.Group("staff_channel").SendAsync("ReceiveNotification", new
                    {
                        id = notifs.FirstOrDefault()?.Id ?? 0,
                        title = "Cảnh báo tồn kho",
                        message = $"Có {products.Count} sản phẩm sắp hết hàng trong kho",
                        type = "LOW_STOCK",
                        targetUrl = products.Count == 1 ? notifs.First().TargetUrl : "/admin/products",
                        metadata = products.Count == 1 ? notifs.First().Metadata : null,
                        isRead = false,
                        createdAt = now
                    });
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check low stock");
        }
    }
}
