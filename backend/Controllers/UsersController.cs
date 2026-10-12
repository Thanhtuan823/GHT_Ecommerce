using Microsoft.AspNetCore.Mvc;
using GhtBackend.Data;
using GhtBackend.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using GhtBackend.Models;

namespace GhtBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;

    public UsersController(AppDbContext context)
    {
        _context = context;
    }

    private int GetCurrentUserId()
    {
        return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    }

    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var userId = GetCurrentUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound(new { message = "User không tồn tại" });

        ShippingAddressDto? defaultAddress = null;
        if (!string.IsNullOrEmpty(user.DefaultAddress))
        {
            try
            {
                defaultAddress = System.Text.Json.JsonSerializer.Deserialize<ShippingAddressDto>(user.DefaultAddress);
            }
            catch { }
        }

        return Ok(new UserDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role,
            Avatar = user.Avatar,
            Phone = user.Phone,
            DefaultAddress = defaultAddress,
            HasPassword = !string.IsNullOrEmpty(user.PasswordHash),
            IsGoogleLinked = !string.IsNullOrEmpty(user.GoogleId)
        });
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile(UpdateProfileRequest request)
    {
        var userId = GetCurrentUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound(new { message = "User không tồn tại" });

        user.Name = request.Name;
        user.Avatar = request.Avatar;
        user.Phone = request.Phone;
        if (request.DefaultAddress != null)
        {
            user.DefaultAddress = System.Text.Json.JsonSerializer.Serialize(request.DefaultAddress);
        }
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        ShippingAddressDto? savedAddress = null;
        if (!string.IsNullOrEmpty(user.DefaultAddress))
        {
            try
            {
                savedAddress = System.Text.Json.JsonSerializer.Deserialize<ShippingAddressDto>(user.DefaultAddress);
            }
            catch { }
        }

        return Ok(new UserDto
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            Role = user.Role,
            Avatar = user.Avatar,
            Phone = user.Phone,
            DefaultAddress = savedAddress,
            HasPassword = !string.IsNullOrEmpty(user.PasswordHash),
            IsGoogleLinked = !string.IsNullOrEmpty(user.GoogleId)
        });
    }

    [HttpPost("set-password")]
    public async Task<IActionResult> SetPassword(SetPasswordRequest request)
    {
        var userId = GetCurrentUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound(new { message = "User không tồn tại" });

        if (!string.IsNullOrEmpty(user.PasswordHash))
            return BadRequest(new { message = "Tài khoản đã có mật khẩu. Vui lòng sử dụng tính năng đổi mật khẩu." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Thiết lập mật khẩu thành công! Giờ đây bạn có thể đăng nhập bằng email và mật khẩu." });
    }

    [HttpPut("password")]
    public async Task<IActionResult> UpdatePassword(UpdatePasswordRequest request)
    {
        var userId = GetCurrentUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound(new { message = "User không tồn tại" });

        if (string.IsNullOrEmpty(user.PasswordHash))
            return BadRequest(new { message = "Tài khoản chưa có mật khẩu, vui lòng thiết lập mật khẩu trước" });

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            return BadRequest(new { message = "Mật khẩu hiện tại không đúng" });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Cập nhật mật khẩu thành công" });
    }

    [HttpGet("wishlist")]
    public async Task<IActionResult> GetWishlist()
    {
        var userId = GetCurrentUserId();
        var wishlists = await _context.Wishlists
            .Include(w => w.Product)
            .Where(w => w.UserId == userId)
            .Select(w => new {
                w.Product.Id,
                w.Product.Name,
                w.Product.Slug,
                w.Product.Price,
                w.Product.InStock,
                Image = w.Product.Images.FirstOrDefault()
            })
            .ToListAsync();

        return Ok(new { products = wishlists });
    }

    public class ToggleWishlistRequest { public int ProductId { get; set; } }

    [HttpPost("wishlist")]
    public async Task<IActionResult> ToggleWishlist([FromBody] ToggleWishlistRequest req)
    {
        var userId = GetCurrentUserId();
        var product = await _context.Products.FindAsync(req.ProductId);
        if (product == null) return NotFound(new { message = "Sản phẩm không tồn tại" });

        var wishlistItem = await _context.Wishlists
            .FirstOrDefaultAsync(w => w.UserId == userId && w.ProductId == req.ProductId);

        if (wishlistItem != null)
        {
            _context.Wishlists.Remove(wishlistItem);
            await _context.SaveChangesAsync();
            return Ok(new { wishlisted = false });
        }
        else
        {
            _context.Wishlists.Add(new Wishlist { UserId = userId, ProductId = req.ProductId });
            await _context.SaveChangesAsync();
            return Ok(new { wishlisted = true });
        }
    }
}
