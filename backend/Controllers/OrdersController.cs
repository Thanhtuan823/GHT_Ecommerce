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
    private readonly IConfiguration _config;

    public OrdersController(AppDbContext context, DiscountService discountService, EmailService emailService, IConfiguration config)
    {
        _context = context;
        _discountService = discountService;
        _emailService = emailService;
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

        var order = new Order
        {
            UserId = userId,
            Status = "PENDING_PAYMENT",
            PaymentExpiredAt = DateTime.UtcNow.AddMinutes(15),
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
            _context.OrderItems.Add(new OrderItem
            {
                OrderId = order.Id,
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                Price = product!.Price
            });
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

        return Created($"/api/orders/{order.Id}", new { orderId = order.Id, totalPrice = order.TotalPrice, paymentExpiredAt = order.PaymentExpiredAt });
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
    [HttpPut("{id}/payment-confirm")]
    public async Task<IActionResult> PaymentConfirm(int id)
    {
        var userId = GetUserId();
        var order = await _context.Orders.FindAsync(id);
        
        if (order == null) return NotFound();
        if (order.UserId != userId) return Forbid();

        if (order.Status != "PENDING_PAYMENT")
            return BadRequest(new { message = "Đơn hàng không ở trạng thái chờ thanh toán" });

        order.Status = "PENDING_REVIEW";
        order.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { status = "PENDING_REVIEW" });
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
                discount.UsedCount++;
                _context.UserUsedDiscounts.Add(new UserUsedDiscount
                {
                    UserId = order.UserId,
                    DiscountId = discount.Id
                });
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
