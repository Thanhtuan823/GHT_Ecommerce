using GhtBackend.Data;
using GhtBackend.DTOs;
using GhtBackend.Models;
using GhtBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace GhtBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly DiscountService _discountService;
    private readonly EmailService _emailService;
    private readonly PdfService _pdfService;
    private readonly IConfiguration _config;

    public OrdersController(AppDbContext context, DiscountService discountService, EmailService emailService, PdfService pdfService, IConfiguration config)
    {
        _context = context;
        _discountService = discountService;
        _emailService = emailService;
        _pdfService = pdfService;
        _config = config;
    }

    private int GetUserId() => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest req)
    {
        var userId = GetUserId();
        var user = await _context.Users.FindAsync(userId);
        
        // Validate Items
        int originalAmount = 0;
        foreach (var item in req.Items)
        {
            var product = await _context.Products.FindAsync(item.ProductId);
            if (product == null || product.InStock < item.Quantity)
                return BadRequest(new { message = $"Sản phẩm {(product?.Name ?? item.ProductId.ToString())} không đủ hàng" });
            
            originalAmount += product.Price * item.Quantity;
        }

        int discountAmount = 0;
        int? discountId = null;

        if (!string.IsNullOrEmpty(req.DiscountCode))
        {
            try
            {
                var discountRes = await _discountService.ValidateAndApply(req.DiscountCode, userId, req.Items, originalAmount);
                discountAmount = discountRes.DiscountAmount;
                discountId = discountRes.DiscountId;
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        int totalPrice = originalAmount - discountAmount + req.ShippingFee;

        var paymentMethod = (req.PaymentMethod ?? "BANK_TRANSFER").ToUpper();
        var initialStatus = paymentMethod == "COD" ? "PROCESSING" : "PENDING_PAYMENT";

        var order = new Order
        {
            UserId = userId,
            Status = initialStatus,
            PaymentMethod = paymentMethod,
            PaymentExpiredAt = paymentMethod == "COD" ? DateTime.UtcNow.AddDays(7) : DateTime.UtcNow.AddMinutes(15),
            OriginalAmount = originalAmount,
            DiscountAmount = discountAmount,
            ShippingFee = req.ShippingFee,
            TotalPrice = totalPrice,
            IsPaid = false,
            ShippingAddress = System.Text.Json.JsonSerializer.Serialize(req.ShippingAddress),
            DiscountId = discountId
        };

        _context.Orders.Add(order);
        await _context.SaveChangesAsync(); // save to get OrderId

        foreach (var item in req.Items)
        {
            var product = await _context.Products.FindAsync(item.ProductId);
            if (product != null)
            {
                product.InStock = Math.Max(0, product.InStock - item.Quantity);
            }
            _context.OrderItems.Add(new OrderItem
            {
                OrderId = order.Id,
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                Price = product?.Price ?? 0
            });
        }

        if (discountId.HasValue)
        {
            var discount = await _context.Discounts.FindAsync(discountId.Value);
            if (discount != null)
            {
                var userVoucher = await _context.UserUsedDiscounts
                    .FirstOrDefaultAsync(u => u.UserId == userId && u.DiscountId == discount.Id && !u.IsUsed);
                if (userVoucher != null)
                {
                    userVoucher.IsUsed = true;
                    userVoucher.OrderId = order.Id;
                    userVoucher.UsedAt = DateTime.UtcNow;
                }
                else
                {
                    _context.UserUsedDiscounts.Add(new UserUsedDiscount
                    {
                        UserId = userId,
                        DiscountId = discount.Id,
                        OrderId = order.Id,
                        IsUsed = true,
                        UsedAt = DateTime.UtcNow
                    });
                }
                discount.UsedCount++;
            }
        }

        // Clear Cart
        var cart = await _context.Carts.Include(c => c.CartItems).FirstOrDefaultAsync(c => c.UserId == userId);
        if (cart != null)
        {
            _context.CartItems.RemoveRange(cart.CartItems);
        }

        await _context.SaveChangesAsync();

        // Fire-and-forget email
        _ = Task.Run(async () => {
            try {
                using var scope = HttpContext.RequestServices.CreateScope();
                var emailSvc = scope.ServiceProvider.GetRequiredService<EmailService>();
                await emailSvc.SendOrderPlaced(order, user!);
                await emailSvc.SendNewOrderNotify(order);
            } catch { }
        });

        return Created($"/api/orders/{order.Id}", new { orderId = order.Id, totalPrice = order.TotalPrice, status = order.Status, paymentMethod = order.PaymentMethod, paymentExpiredAt = order.PaymentExpiredAt });
    }

    [Authorize(Roles = "Admin,Staff")]
    [HttpGet]
    public async Task<IActionResult> GetAllOrders([FromQuery] string? status)
    {
        var query = _context.Orders
            .Include(o => o.User)
            .Include(o => o.OrderItems).ThenInclude(oi => oi.Product)
            .Include(o => o.Discount)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status) && status != "ALL")
        {
            query = query.Where(o => o.Status == status);
        }

        var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
        return Ok(orders);
    }

    [Authorize]
    [HttpGet("myorders")]
    public async Task<IActionResult> GetMyOrders()
    {
        var userId = GetUserId();
        var orders = await _context.Orders
            .Include(o => o.OrderItems).ThenInclude(oi => oi.Product)
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
        
        return Ok(orders);
    }

    [Authorize]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetOrder(int id)
    {
        var userId = GetUserId();
        var order = await _context.Orders
            .Include(o => o.OrderItems).ThenInclude(oi => oi.Product)
            .Include(o => o.Discount)
            .FirstOrDefaultAsync(o => o.Id == id);
            
        if (order == null) return NotFound();
        if (order.UserId != userId && !User.IsInRole("Admin") && !User.IsInRole("Staff"))
            return Forbid();

        return Ok(order);
    }

    [Authorize]
    [HttpGet("{id}/invoice")]
    public async Task<IActionResult> GetInvoice(int id)
    {
        var userId = GetUserId();
        var order = await _context.Orders
            .Include(o => o.OrderItems).ThenInclude(oi => oi.Product)
            .Include(o => o.User)
            .FirstOrDefaultAsync(o => o.Id == id);
            
        if (order == null) return NotFound();
        if (order.UserId != userId && !User.IsInRole("Admin") && !User.IsInRole("Staff"))
            return Forbid();

        var pdfBytes = _pdfService.GenerateInvoice(order);
        return File(pdfBytes, "application/pdf", $"Invoice_DH{order.Id}.pdf");
    }

    [Authorize]
    [HttpPut("{id}/payment-confirm")]
    public async Task<IActionResult> PaymentConfirm(int id)
    {
        var userId = GetUserId();
        var order = await _context.Orders.FindAsync(id);
        
        if (order == null) return NotFound();
        if (order.UserId != userId) return Forbid();

        if (order.Status != "PENDING_PAYMENT")
            return BadRequest(new { message = "Đơn hàng không ở trạng thái chờ thanh toán" });

        var isTestMode = _config.GetValue<bool>("SePay:TestMode");

        if (isTestMode)
        {
            order.Status = "PAID";
            order.IsPaid = true;
            order.PaidAt = DateTime.UtcNow;
            order.UpdatedAt = DateTime.UtcNow;

            if (order.DiscountId.HasValue)
            {
                var discount = await _context.Discounts.FindAsync(order.DiscountId.Value);
                if (discount != null)
                {
                    var userVoucher = await _context.UserUsedDiscounts.FirstOrDefaultAsync(u => u.OrderId == order.Id && u.UserId == order.UserId);
                    if (userVoucher == null)
                    {
                        discount.UsedCount++;
                        _context.UserUsedDiscounts.Add(new UserUsedDiscount
                        {
                            UserId = order.UserId,
                            DiscountId = discount.Id,
                            OrderId = order.Id,
                            IsUsed = true,
                            UsedAt = DateTime.UtcNow
                        });
                    }
                }
            }

            await _context.SaveChangesAsync();

            // Trigger background emails for confirmed payment
            _ = Task.Run(async () => {
                try {
                    using var scope = HttpContext.RequestServices.CreateScope();
                    var emailSvc = scope.ServiceProvider.GetRequiredService<EmailService>();
                    await emailSvc.SendPaymentConfirmed(order);
                    await emailSvc.SendPaidNotify(order);
                } catch { }
            });

            return Ok(new 
            { 
                status = "PAID", 
                testMode = true, 
                message = "Thanh toán giả lập thành công (Test Mode)!" 
            });
        }

        order.Status = "PENDING_REVIEW";
        order.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { status = "PENDING_REVIEW", testMode = false });
    }

    [Authorize]
    [HttpPut("{id}/cancel")]
    public async Task<IActionResult> CancelOrder(int id, [FromBody] CancelOrderRequest? req)
    {
        var userId = GetUserId();
        var order = await _context.Orders
            .Include(o => o.OrderItems)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null) return NotFound(new { message = "Đơn hàng không tồn tại" });
        if (order.UserId != userId && !User.IsInRole("Admin") && !User.IsInRole("Staff")) return Forbid();

        var cancellableStatuses = new[] { "PENDING_PAYMENT", "PENDING_REVIEW", "CONFIRMED", "PROCESSING" };
        if (!cancellableStatuses.Contains(order.Status))
        {
            return BadRequest(new { message = "Đơn hàng đã được bàn giao vận chuyển hoặc hoàn thành, không thể hủy" });
        }

        order.Status = "CANCELLED";
        order.CancelReason = string.IsNullOrWhiteSpace(req?.Reason)
            ? (User.IsInRole("Staff") || User.IsInRole("Admin") ? "Nhân viên vận hành hủy đơn" : "Khách hàng yêu cầu hủy đơn")
            : req.Reason.Trim();
        order.UpdatedAt = DateTime.UtcNow;

        foreach (var item in order.OrderItems)
        {
            var product = await _context.Products.FindAsync(item.ProductId);
            if (product != null)
            {
                product.InStock += item.Quantity;
            }
        }

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

        await _context.SaveChangesAsync();

        // Trigger background email thông báo hủy đơn kèm lý do
        _ = Task.Run(async () => {
            try {
                using var scope = HttpContext.RequestServices.CreateScope();
                var emailSvc = scope.ServiceProvider.GetRequiredService<EmailService>();
                await emailSvc.SendOrderCancelled(order, order.CancelReason);
            } catch { }
        });

        return Ok(new { message = "Đã hủy đơn hàng thành công", status = "CANCELLED", cancelReason = order.CancelReason });
    }

    [Authorize(Roles = "Admin,Staff")]
    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateOrderStatusRequest req)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound();

        order.Status = req.Status;
        if (req.Status == "PAID")
        {
            order.IsPaid = true;
            order.PaidAt = DateTime.UtcNow;
        }
        order.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { status = order.Status });
    }

    [HttpPost("webhook/sepay")]
    public async Task<IActionResult> SePayWebhook([FromBody] SePayWebhookRequest req)
    {
        var authHeader = Request.Headers["Authorization"].ToString();
        var apiKey = _config["SePay:ApiKey"];
        
        if (string.IsNullOrEmpty(apiKey) || authHeader != $"Bearer {apiKey}")
            return Unauthorized();

        var match = Regex.Match(req.content, @"DH([A-Za-z0-9]+)", RegexOptions.IgnoreCase);
        if (!match.Success) return Ok();

        if (!int.TryParse(match.Groups[1].Value, out int orderId))
            return Ok();

        var order = await _context.Orders
            .Include(o => o.User)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null || order.IsPaid) return Ok();

        if (req.transferAmount < order.TotalPrice)
        {
            order.Status = "PAYMENT_FAILED";
            order.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok();
        }

        // Set PAID
        order.Status = "PAID";
        order.IsPaid = true;
        order.PaidAt = DateTime.UtcNow;
        order.UpdatedAt = DateTime.UtcNow;

        if (order.DiscountId.HasValue)
        {
            var discount = await _context.Discounts.FindAsync(order.DiscountId.Value);
            if (discount != null)
            {
                var userVoucher = await _context.UserUsedDiscounts.FirstOrDefaultAsync(u => u.OrderId == order.Id && u.UserId == order.UserId);
                if (userVoucher == null)
                {
                    discount.UsedCount++;
                    _context.UserUsedDiscounts.Add(new UserUsedDiscount
                    {
                        UserId = order.UserId,
                        DiscountId = discount.Id,
                        OrderId = order.Id,
                        IsUsed = true,
                        UsedAt = DateTime.UtcNow
                    });
                }
            }
        }

        await _context.SaveChangesAsync();

        // Emails
        _ = Task.Run(async () => {
            try {
                using var scope = HttpContext.RequestServices.CreateScope();
                var emailSvc = scope.ServiceProvider.GetRequiredService<EmailService>();
                await emailSvc.SendPaymentConfirmed(order);
                await emailSvc.SendPaidNotify(order);
            } catch { }
        });

        return Ok();
    }
}
