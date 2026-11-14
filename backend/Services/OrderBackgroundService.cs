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
            .Include(o => o.OrderItems)
            .Where(o => o.Status == "PENDING_PAYMENT" && o.PaymentExpiredAt < now)
            .ToListAsync();

        if (expiredOrders.Any())
        {
            foreach (var order in expiredOrders)
            {
                order.Status = "EXPIRED";
                order.CancelReason = "Đơn hàng quá thời hạn thanh toán (30 phút)";
                order.UpdatedAt = now;

                // 1. Hoàn trả tồn kho sản phẩm
                foreach (var item in order.OrderItems)
                {
                    var product = await _context.Products.FindAsync(item.ProductId);
                    if (product != null)
                    {
                        product.InStock += item.Quantity;
                    }
                }

                // 2. Hoàn trả lượt dùng voucher vào ví (nếu có)
                if (order.DiscountId.HasValue)
                {
                    var discount = await _context.Discounts.FindAsync(order.DiscountId.Value);
                    if (discount != null && discount.UsedCount > 0)
                    {
                        discount.UsedCount -= 1;
                    }

                    var usedVoucher = await _context.UserUsedDiscounts
                        .FirstOrDefaultAsync(u => u.OrderId == order.Id && u.UserId == order.UserId);
                    if (usedVoucher != null)
                    {
                        usedVoucher.IsUsed = false;
                        usedVoucher.OrderId = null;
                        usedVoucher.UsedAt = null;
                    }
                }

                _logger.LogInformation("Order {id} expired. Inventory and vouchers restocked.", order.Id);
            }
            await _context.SaveChangesAsync();
        }
    }
}
