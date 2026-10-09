using GhtBackend.Data;
using GhtBackend.Models;
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

        public DiscountsController(AppDbContext context)
        {
            _context = context;
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

            // Only delete if never used, or just deactivate? We will delete.
            _context.Discounts.Remove(discount);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
