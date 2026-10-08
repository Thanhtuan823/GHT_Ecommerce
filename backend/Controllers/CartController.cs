using System.Security.Claims;
using GhtBackend.Data;
using GhtBackend.DTOs;
using GhtBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GhtBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CartController : ControllerBase
{
    private readonly AppDbContext _context;

    public CartController(AppDbContext context)
    {
        _context = context;
    }

    private int GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (claim == null || !int.TryParse(claim.Value, out int userId))
            throw new UnauthorizedAccessException("Invalid token.");
        return userId;
    }

    [HttpGet]
    public async Task<IActionResult> GetCart()
    {
        var userId = GetUserId();
        var cart = await _context.Carts
            .Include(c => c.CartItems)
            .ThenInclude(ci => ci.Product)
            .FirstOrDefaultAsync(c => c.UserId == userId);

        if (cart == null)
        {
            cart = new Cart { UserId = userId };
            _context.Carts.Add(cart);
            await _context.SaveChangesAsync();
        }

        var dto = new CartDto
        {
            CartId = cart.Id,
            Items = cart.CartItems.Select(ci => new CartItemDto
            {
                ProductId = ci.ProductId,
                ProductName = ci.Product.Name,
                ProductSlug = ci.Product.Slug,
                Price = ci.Product.Price,
                InStock = ci.Product.InStock,
                Image = ci.Product.Images.FirstOrDefault(),
                Quantity = ci.Quantity
            }).ToList()
        };

        dto.TotalPrice = dto.Items.Sum(i => i.Price * i.Quantity);

        return Ok(dto);
    }

    [HttpPost("add")]
    public async Task<IActionResult> AddItem([FromBody] AddToCartRequest req)
    {
        var userId = GetUserId();
        
        var product = await _context.Products.FindAsync(req.ProductId);
        if (product == null)
            return NotFound(new { message = "Sản phẩm không tồn tại" });

        if (product.InStock < req.Quantity)
            return BadRequest(new { message = $"Sản phẩm {product.Name} không đủ hàng (chỉ còn {product.InStock})" });

        var cart = await _context.Carts
            .Include(c => c.CartItems)
            .FirstOrDefaultAsync(c => c.UserId == userId);

        if (cart == null)
        {
            cart = new Cart { UserId = userId };
            _context.Carts.Add(cart);
        }

        var cartItem = cart.CartItems.FirstOrDefault(ci => ci.ProductId == req.ProductId);
        if (cartItem != null)
        {
            if (product.InStock < cartItem.Quantity + req.Quantity)
                return BadRequest(new { message = $"Sản phẩm {product.Name} không đủ hàng để thêm thêm" });
            cartItem.Quantity += req.Quantity;
        }
        else
        {
            cart.CartItems.Add(new CartItem
            {
                ProductId = req.ProductId,
                Quantity = req.Quantity
            });
        }

        cart.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return await GetCart();
    }

    [HttpDelete("{productId}")]
    public async Task<IActionResult> RemoveItem(int productId)
    {
        var userId = GetUserId();
        var cart = await _context.Carts
            .Include(c => c.CartItems)
            .FirstOrDefaultAsync(c => c.UserId == userId);

        if (cart == null) return NotFound();

        var cartItem = cart.CartItems.FirstOrDefault(ci => ci.ProductId == productId);
        if (cartItem != null)
        {
            cart.CartItems.Remove(cartItem);
            cart.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return await GetCart();
    }

    [HttpPost("sync")]
    public async Task<IActionResult> SyncCart([FromBody] SyncCartRequest req)
    {
        var userId = GetUserId();
        
        var cart = await _context.Carts
            .Include(c => c.CartItems)
            .FirstOrDefaultAsync(c => c.UserId == userId);

        if (cart == null)
        {
            cart = new Cart { UserId = userId };
            _context.Carts.Add(cart);
        }

        foreach (var item in req.Items)
        {
            var product = await _context.Products.FindAsync(item.ProductId);
            if (product == null || product.InStock < 1) continue;

            var qtyToSync = Math.Min(item.Quantity, product.InStock);

            var cartItem = cart.CartItems.FirstOrDefault(ci => ci.ProductId == item.ProductId);
            if (cartItem != null)
            {
                // Lấy quantity lớn hơn giữa db và local (không cộng dồn để tránh quá lố)
                var newQty = Math.Max(cartItem.Quantity, qtyToSync);
                cartItem.Quantity = Math.Min(newQty, product.InStock);
            }
            else
            {
                cart.CartItems.Add(new CartItem
                {
                    ProductId = item.ProductId,
                    Quantity = qtyToSync
                });
            }
        }

        cart.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return await GetCart();
    }

    public class UpdateQuantityRequest { public int Quantity { get; set; } }

    [HttpPut("{productId}")]
    public async Task<IActionResult> UpdateQuantity(int productId, [FromBody] UpdateQuantityRequest req)
    {
        var userId = GetUserId();
        var cart = await _context.Carts
            .Include(c => c.CartItems)
            .FirstOrDefaultAsync(c => c.UserId == userId);

        if (cart == null) return NotFound();

        var cartItem = cart.CartItems.FirstOrDefault(ci => ci.ProductId == productId);
        if (cartItem != null)
        {
            var product = await _context.Products.FindAsync(productId);
            if (product != null && product.InStock >= req.Quantity)
            {
                cartItem.Quantity = req.Quantity;
                cart.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            else
            {
                return BadRequest(new { message = "Không đủ số lượng trong kho" });
            }
        }

        return await GetCart();
    }
}
