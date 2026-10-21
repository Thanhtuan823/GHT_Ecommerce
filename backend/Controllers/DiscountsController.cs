using System.Security.Claims;
using GhtBackend.Data;
using GhtBackend.DTOs;
using GhtBackend.Models;
using GhtBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GhtBackend.Controllers
{
    [ApiController]
    [Route("api/discounts")]
    public class DiscountsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly DiscountService _discountService;

        public DiscountsController(AppDbContext context, DiscountService discountService)
        {
            _context = context;
            _discountService = discountService;
        }

        [HttpGet("available")]
        [AllowAnonymous]
        public async Task<IActionResult> GetAvailable()
        {
            var now = DateTime.UtcNow;

            var claimedIds = new List<int>();
            if (User?.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (int.TryParse(userIdClaim, out var uid) && uid > 0)
                {
                    claimedIds = await _context.UserUsedDiscounts
                        .Where(u => u.UserId == uid && !u.IsUsed)
                        .Select(u => u.DiscountId)
                        .ToListAsync();
                }
            }

            var discounts = await _context.Discounts
                .Where(d => d.IsActive && d.StartDate <= now && d.EndDate >= now && (!d.UsageLimit.HasValue || d.UsedCount < d.UsageLimit.Value))
                .OrderByDescending(d => d.CreatedAt)
                .ThenByDescending(d => d.DiscountValue)
                .Select(d => new
                {
                    d.Id,
                    d.Code,
                    d.Description,
                    d.DiscountType,
                    d.DiscountValue,
                    d.MaxDiscountAmount,
                    d.MinOrderAmount,
                    d.StartDate,
                    d.EndDate,
                    d.UsageLimit,
                    d.UsedCount,
                    d.PerUserLimit,
                    d.Conditions,
                    d.ConditionValues,
                    IsClaimed = claimedIds.Contains(d.Id)
                })
                .ToListAsync();

            return Ok(discounts);
        }

        [Authorize]
        [HttpPost("claim/{id}")]
        public async Task<IActionResult> Claim(int id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId) || userId <= 0)
            {
                return Unauthorized(new { message = "Vui lòng đăng nhập để lưu mã ưu đãi." });
            }

            var now = DateTime.UtcNow;
            var discount = await _context.Discounts.FindAsync(id);
            if (discount == null)
            {
                return NotFound(new { message = "Mã ưu đãi không tồn tại." });
            }

            if (!discount.IsActive)
            {
                return BadRequest(new { message = "Mã ưu đãi này hiện đang tạm khóa." });
            }

            if (now < discount.StartDate)
            {
                return BadRequest(new { message = "Mã ưu đãi chưa đến thời gian áp dụng." });
            }

            if (now > discount.EndDate)
            {
                return BadRequest(new { message = "Mã ưu đãi đã hết hạn sử dụng." });
            }

            if (discount.UsageLimit.HasValue && discount.UsedCount >= discount.UsageLimit.Value)
            {
                return BadRequest(new { message = "Mã ưu đãi đã hết lượt sử dụng trên toàn hệ thống." });
            }

            var existing = await _context.UserUsedDiscounts
                .FirstOrDefaultAsync(u => u.UserId == userId && u.DiscountId == id && !u.IsUsed);

            if (existing != null)
            {
                return BadRequest(new { message = "Mã ưu đãi này đã có sẵn trong ví của bạn." });
            }

            var userUsedTotal = await _context.UserUsedDiscounts
                .CountAsync(u => u.UserId == userId && u.DiscountId == id);
            if (userUsedTotal >= discount.PerUserLimit)
            {
                return BadRequest(new { message = "Bạn đã đạt giới hạn sử dụng mã ưu đãi này." });
            }

            var newVoucher = new UserUsedDiscount
            {
                UserId = userId,
                DiscountId = id,
                SavedAt = DateTime.UtcNow,
                IsUsed = false
            };

            _context.UserUsedDiscounts.Add(newVoucher);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Đã lưu mã {discount.Code} vào ví ưu đãi!",
                isClaimed = true,
                voucherId = newVoucher.Id
            });
        }

        [Authorize]
        [HttpGet("my-vouchers")]
        public async Task<IActionResult> GetMyVouchers()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId) || userId <= 0)
            {
                return Unauthorized(new { message = "Vui lòng đăng nhập để xem ví ưu đãi." });
            }

            var now = DateTime.UtcNow;
            var myVouchers = await _context.UserUsedDiscounts
                .Include(u => u.Discount)
                .Where(u => u.UserId == userId && !u.IsUsed && u.Discount.IsActive && u.Discount.EndDate >= now)
                .OrderByDescending(u => u.SavedAt)
                .Select(u => new
                {
                    u.Discount.Id,
                    u.Discount.Code,
                    u.Discount.Description,
                    u.Discount.DiscountType,
                    u.Discount.DiscountValue,
                    u.Discount.MaxDiscountAmount,
                    u.Discount.MinOrderAmount,
                    u.Discount.StartDate,
                    u.Discount.EndDate,
                    u.Discount.Conditions,
                    u.Discount.ConditionValues,
                    u.SavedAt,
                    IsClaimed = true
                })
                .ToListAsync();

            return Ok(myVouchers);
        }

        [HttpPost("apply")]
        [AllowAnonymous]
        public async Task<IActionResult> Apply([FromBody] ApplyDiscountRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Code))
            {
                return BadRequest(new { message = "Vui lòng nhập mã ưu đãi" });
            }

            var userId = 0;
            if (User?.Identity?.IsAuthenticated == true)
            {
                int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out userId);
            }

            try
            {
                var result = await _discountService.ValidateAndApply(
                    req.Code.Trim().ToUpper(),
                    userId,
                    req.Items,
                    req.OriginalAmount
                );

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<IActionResult> GetAll()
        {
            var discounts = await _context.Discounts.OrderByDescending(d => d.CreatedAt).ToListAsync();
            return Ok(discounts);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<IActionResult> Create([FromBody] Discount dto)
        {
            if (await _context.Discounts.AnyAsync(d => d.Code == dto.Code))
            {
                return BadRequest(new { message = "Mã giảm giá đã tồn tại" });
            }

            dto.CreatedAt = DateTime.UtcNow;
            dto.UpdatedAt = DateTime.UtcNow;

            _context.Discounts.Add(dto);
            await _context.SaveChangesAsync();

            return Ok(dto);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<IActionResult> Update(int id, [FromBody] Discount dto)
        {
            var discount = await _context.Discounts.FindAsync(id);
            if (discount == null) return NotFound(new { message = "Không tìm thấy mã" });

            if (discount.Code != dto.Code && await _context.Discounts.AnyAsync(d => d.Code == dto.Code))
            {
                return BadRequest(new { message = "Mã giảm giá mới đã tồn tại" });
            }

            discount.Code = dto.Code;
            discount.Description = dto.Description;
            discount.DiscountType = dto.DiscountType;
            discount.DiscountValue = dto.DiscountValue;
            discount.MaxDiscountAmount = dto.MaxDiscountAmount;
            discount.MinOrderAmount = dto.MinOrderAmount;
            discount.UsageLimit = dto.UsageLimit;
            discount.PerUserLimit = dto.PerUserLimit;
            discount.StartDate = dto.StartDate;
            discount.EndDate = dto.EndDate;
            discount.IsActive = dto.IsActive;
            discount.Conditions = dto.Conditions;
            discount.ConditionValues = dto.ConditionValues;
            discount.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(discount);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var discount = await _context.Discounts.FindAsync(id);
            if (discount == null) return NotFound();

            _context.Discounts.Remove(discount);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
