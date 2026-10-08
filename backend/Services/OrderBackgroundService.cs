using GhtBackend.Data;
using Microsoft.EntityFrameworkCore;

namespace GhtBackend.Services;

public class OrderBackgroundService
{
    private readonly AppDbContext _context;
    private readonly ILogger<OrderBackgroundService> _logger;

    public OrderBackgroundService(AppDbContext context, ILogger<OrderBackgroundService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task ExpireOrders()
    {
        var now = DateTime.UtcNow;
        var expiredOrders = await _context.Orders
            .Where(o => o.Status == "PENDING_PAYMENT" && o.PaymentExpiredAt < now)
            .ToListAsync();

        if (expiredOrders.Any())
        {
            foreach (var order in expiredOrders)
            {
                order.Status = "EXPIRED";
                order.UpdatedAt = now;
                _logger.LogInformation("Order {id} expired.", order.Id);
            }
            await _context.SaveChangesAsync();
        }
    }
}
