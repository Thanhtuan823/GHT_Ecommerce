using GhtBackend.Data;
using GhtBackend.Models;
using GhtBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GhtBackend.Controllers
{
    [ApiController]
    [Route("api/admin")]
    public class AdminController : ControllerBase
    {
        private readonly AdminService _adminService;
        private readonly AppDbContext _context;

        public AdminController(AdminService adminService, AppDbContext context)
        {
            _adminService = adminService;
            _context = context;
        }

        [HttpGet("dashboard")]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<IActionResult> GetDashboard([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            var stats = await _adminService.GetDashboardStatsAsync(from, to);
            return Ok(stats);
        }

        [HttpGet("export-excel")]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<IActionResult> ExportExcel([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            var excelBytes = await _adminService.ExportExcelAsync(from, to);
            
            var fileName = $"GHT_Revenue_{(from.HasValue ? from.Value.ToString("yyyy-MM-dd") : "All")}_{(to.HasValue ? to.Value.ToString("yyyy-MM-dd") : "All")}.xlsx";
            
            return File(excelBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }

        [HttpGet("users")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetUsers(
            [FromQuery] int page = 1,
            [FromQuery] int limit = 10,
            [FromQuery] string? search = null,
            [FromQuery] string? role = null)
        {
            if (page < 1) page = 1;
            if (limit < 1) limit = 10;

            var query = _context.Users.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = $"%{search.Trim()}%";
                query = query.Where(u =>
                    EF.Functions.ILike(u.Name, s) ||
                    EF.Functions.ILike(u.Email, s) ||
                    (u.Phone != null && EF.Functions.ILike(u.Phone, s)));
            }

            if (!string.IsNullOrWhiteSpace(role) && role != "ALL")
            {
                query = query.Where(u => u.Role == role);
            }

            var total = await query.CountAsync();
            var totalPages = (int)Math.Ceiling((double)total / limit);

            var users = await query
                .OrderByDescending(u => u.CreatedAt)
                .Skip((page - 1) * limit)
                .Take(limit)
                .Select(u => new
                {
                    u.Id,
                    u.Name,
                    u.Email,
                    u.Role,
                    u.Phone,
                    u.Avatar,
                    u.IsActive,
                    u.CreatedAt,
                    u.UpdatedAt
                })
                .ToListAsync();

            // Role summary statistics for quick card stats
            var counts = await _context.Users
                .GroupBy(u => u.Role)
                .Select(g => new { Role = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Role, x => x.Count);

            var stats = new
            {
                totalUsers = await _context.Users.CountAsync(),
                adminCount = counts.GetValueOrDefault("Admin", 0),
                staffCount = counts.GetValueOrDefault("Staff", 0),
                customerCount = counts.GetValueOrDefault("Customer", 0),
                activeCount = await _context.Users.CountAsync(u => u.IsActive),
                lockedCount = await _context.Users.CountAsync(u => !u.IsActive)
            };

            return Ok(new
            {
                data = users,
                pagination = new
                {
                    page,
                    limit,
                    total,
                    totalPages
                },
                stats
            });
        }

        public class UpdateRoleRequest
        {
            public string Role { get; set; } = string.Empty;
        }

        [HttpPut("users/{id}/role")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateUserRole(int id, [FromBody] UpdateRoleRequest req)
        {
            var validRoles = new[] { "Admin", "Staff", "Customer" };
            if (!validRoles.Contains(req.Role))
            {
                return BadRequest(new { message = "Vai trò không hợp lệ (chỉ chấp nhận: Admin, Staff, Customer)" });
            }

            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
            if (id == currentUserId && req.Role != "Admin")
            {
                return BadRequest(new { message = "Bạn không thể tự hạ quyền Admin của chính mình!" });
            }

            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "Không tìm thấy người dùng" });

            user.Role = req.Role;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Đã cập nhật vai trò thành công cho {user.Email}", role = user.Role });
        }

        [HttpPut("users/{id}/toggle-status")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ToggleUserStatus(int id)
        {
            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
            if (id == currentUserId)
            {
                return BadRequest(new { message = "Bạn không thể tự khóa tài khoản của chính mình!" });
            }

            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "Không tìm thấy người dùng" });

            user.IsActive = !user.IsActive;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = user.IsActive ? $"Đã mở khóa tài khoản {user.Email}" : $"Đã khóa tài khoản {user.Email}",
                isActive = user.IsActive
            });
        }

        public class AdminResetPasswordDto
        {
            [System.ComponentModel.DataAnnotations.Required(ErrorMessage = "Mật khẩu mới là bắt buộc")]
            [System.ComponentModel.DataAnnotations.MinLength(6, ErrorMessage = "Mật khẩu mới phải có tối thiểu 6 ký tự")]
            public string NewPassword { get; set; } = string.Empty;
        }

        [HttpPut("users/{id}/password")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ResetUserPassword(int id, [FromBody] AdminResetPasswordDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
            {
                return BadRequest(new { message = "Mật khẩu mới phải có tối thiểu 6 ký tự" });
            }

            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "Không tìm thấy người dùng" });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"Đã cập nhật mật khẩu mới cho tài khoản {user.Email}" });
        }

        [HttpGet("test-brand-email")]
        [AllowAnonymous]
        public async Task<IActionResult> TestBrandEmail(
            [FromServices] EmailService emailService,
            [FromQuery] string email = "thanhnguyen10988@gmail.com",
            [FromQuery] string type = "payment")
        {
            var order = await _context.Orders
                .Include(o => o.User)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .OrderByDescending(o => o.Id)
                .FirstOrDefaultAsync();

            if (order == null)
            {
                order = new Order
                {
                    Id = 9999,
                    UserId = 1,
                    TotalPrice = 32500000,
                    OriginalAmount = 33000000,
                    DiscountAmount = 500000,
                    ShippingFee = 0,
                    PaymentMethod = "SEPAY_QR",
                    TrackingNumber = "GHN88392109VN",
                    ShippingAddress = "{\"Name\":\"Nguyễn Văn A\",\"Phone\":\"0909123456\",\"Address\":\"123 Lê Duẩn, Bến Nghé, Quận 1, TP. Hồ Chí Minh\"}",
                    CreatedAt = DateTime.UtcNow,
                    User = new User
                    {
                        Id = 1,
                        Name = "Nguyễn Văn A",
                        Email = email,
                        Phone = "0909123456"
                    },
                    OrderItems = new List<OrderItem>
                    {
                        new OrderItem
                        {
                            Id = 1,
                            OrderId = 9999,
                            ProductId = 1,
                            Quantity = 1,
                            Price = 32500000,
                            Product = new Product
                            {
                                Id = 1,
                                Name = "iPhone 15 Pro Max 256GB - Titan Tự Nhiên",
                                Price = 32500000
                            }
                        }
                    }
                };
            }
            else
            {
                order.User.Email = email;
                if (string.IsNullOrEmpty(order.TrackingNumber))
                {
                    order.TrackingNumber = "GHN88392109VN";
                }
            }

            if (type.ToLower() == "shipped")
            {
                await emailService.SendOrderShipped(order);
            }
            else
            {
                await emailService.SendPaymentConfirmed(order);
            }

            return Ok(new
            {
                success = true,
                message = $"Đã gửi email kiểm thử thương hiệu ({type}) tới {email}",
                orderId = order.Id,
                recipient = email,
                type = type,
                trackingNumber = order.TrackingNumber
            });
        }
    }
}
