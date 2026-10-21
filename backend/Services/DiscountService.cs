using GhtBackend.Data;
using GhtBackend.DTOs;
using Microsoft.EntityFrameworkCore;

namespace GhtBackend.Services;

public class DiscountService
{
    private readonly AppDbContext _context;

    public DiscountService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ApplyDiscountResponse> ValidateAndApply(string code, int userId, List<OrderItemRequest> orderItems, int originalAmount)
    {
        var discount = await _context.Discounts.FirstOrDefaultAsync(d => d.Code == code);
        if (discount == null)
            throw new Exception("Mã giảm giá không tồn tại");

        if (!discount.IsActive)
            throw new Exception("Mã giảm giá này hiện đang tạm khóa");

        var now = DateTime.UtcNow;
        if (now < discount.StartDate)
            throw new Exception("Mã giảm giá chưa đến thời gian áp dụng");
        if (now > discount.EndDate)
            throw new Exception("Mã giảm giá đã hết hạn sử dụng");

        if (discount.UsageLimit.HasValue && discount.UsedCount >= discount.UsageLimit.Value)
            throw new Exception("Mã giảm giá đã hết lượt sử dụng");

        if (userId > 0)
        {
            var hasInWallet = await _context.UserUsedDiscounts.AnyAsync(u => u.UserId == userId && u.DiscountId == discount.Id && !u.IsUsed);
            if (!hasInWallet)
            {
                throw new Exception("Bạn chưa lưu mã ưu đãi này vào ví. Vui lòng nhận mã vào ví trước khi áp dụng!");
            }

            var userUsedCount = await _context.UserUsedDiscounts.CountAsync(u => u.UserId == userId && u.DiscountId == discount.Id && u.IsUsed);
            if (userUsedCount >= discount.PerUserLimit)
                throw new Exception("Bạn đã dùng hết lượt sử dụng mã này");
        }

        if (originalAmount < discount.MinOrderAmount)
            throw new Exception($"Đơn hàng tối thiểu phải từ {discount.MinOrderAmount:N0}đ để áp dụng mã này");

        // Validate conditions
        if (orderItems != null && orderItems.Any())
        {
            var productIds = orderItems.Select(i => i.ProductId).ToList();
            var products = await _context.Products.Where(p => productIds.Contains(p.Id)).ToListAsync();

            if (discount.Conditions == "CATEGORY")
            {
                bool hasValidProduct = products.Any(p => discount.ConditionValues.Contains(p.CategoryId.ToString()));
                if (!hasValidProduct) throw new Exception("Không có sản phẩm nào thoả điều kiện của mã này");
            }
            else if (discount.Conditions == "BRAND")
            {
                bool hasValidProduct = products.Any(p => p.Brand != null && discount.ConditionValues.Contains(p.Brand));
                if (!hasValidProduct) throw new Exception("Không có sản phẩm nào thoả điều kiện của mã này");
            }
            else if (discount.Conditions == "NEW_ARRIVAL")
            {
                int days = 30; // default
                if (discount.ConditionValues.Length > 0 && int.TryParse(discount.ConditionValues[0], out int parsedDays))
                    days = parsedDays;
                    
                bool hasValidProduct = products.Any(p => p.CreatedAt >= DateTime.UtcNow.AddDays(-days));
                if (!hasValidProduct) throw new Exception("Không có sản phẩm nào thoả điều kiện của mã này");
            }
        }

        // Calculate discount
        int discountAmount = 0;
        if (discount.DiscountType == "PERCENTAGE")
        {
            discountAmount = (int)((long)originalAmount * discount.DiscountValue / 100);
            if (discount.MaxDiscountAmount.HasValue)
                discountAmount = Math.Min(discountAmount, discount.MaxDiscountAmount.Value);
        }
        else if (discount.DiscountType == "FIXED")
        {
            discountAmount = Math.Min(discount.DiscountValue, originalAmount);
        }

        int finalAmount = Math.Max(0, originalAmount - discountAmount);

        return new ApplyDiscountResponse
        {
            Success = true,
            DiscountId = discount.Id,
            Code = discount.Code,
            DiscountAmount = discountAmount,
            FinalAmount = finalAmount,
            Message = "Áp dụng mã thành công!"
        };
    }
}
