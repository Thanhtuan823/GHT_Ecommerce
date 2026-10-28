using GhtBackend.Models;

namespace GhtBackend.Data;

public static class DbSeeder
{
    private const string R2ProductCdn = "https://pub-ead62bf4fa7a4393b078968b9a71d0d7.r2.dev/images";

    public static void Seed(AppDbContext context)
    {
        context.Database.EnsureCreated();

        SeedCategories(context);

        if (!context.Products.Any())
        {
            var laptops = context.Categories.FirstOrDefault(c => c.Slug == "laptop");
            if (laptops != null)
            {
                context.Products.AddRange(
                    new Product { 
                        Name = "MacBook Pro 16 Space Black", Slug = "macbook-pro-16-space-black", 
                        CategoryId = laptops.Id, Brand = "Apple", Price = 60000000, InStock = 10,
                        Images = new[] { $"{R2ProductCdn}/macbook-space-black.png" },
                        Specs = "{\"CPU\": \"M3 Max\", \"RAM\": \"36GB\"}"
                    },
                    new Product { 
                        Name = "MacBook Air M3 Silver", Slug = "macbook-air-m3-silver", 
                        CategoryId = laptops.Id, Brand = "Apple", Price = 27000000, InStock = 20,
                        Images = new[] { $"{R2ProductCdn}/macbook-silver.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "Dell XPS 15 Silver", Slug = "dell-xps-15-silver", 
                        CategoryId = laptops.Id, Brand = "Dell", Price = 45000000, InStock = 15,
                        Images = new[] { $"{R2ProductCdn}/dell-xps-silver.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "ROG Zephyrus G14 Eclipse Gray", Slug = "rog-zephyrus-g14-eclipse-gray", 
                        CategoryId = laptops.Id, Brand = "ASUS", Price = 42000000, InStock = 5,
                        Images = new[] { $"{R2ProductCdn}/rog-eclipse-gray.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "ROG Zephyrus G14 Moonlight White", Slug = "rog-zephyrus-g14-moonlight-white", 
                        CategoryId = laptops.Id, Brand = "ASUS", Price = 42000000, InStock = 8,
                        Images = new[] { $"{R2ProductCdn}/rog-moonlight-white.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "LG Gram 16 Black", Slug = "lg-gram-16-black", 
                        CategoryId = laptops.Id, Brand = "LG", Price = 32000000, InStock = 12,
                        Images = new[] { $"{R2ProductCdn}/lg-gram-black.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "LG Gram 16 White", Slug = "lg-gram-16-white", 
                        CategoryId = laptops.Id, Brand = "LG", Price = 32000000, InStock = 10,
                        Images = new[] { $"{R2ProductCdn}/lg-gram-white.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "HP Spectre x360 Black", Slug = "hp-spectre-x360-black", 
                        CategoryId = laptops.Id, Brand = "HP", Price = 40000000, InStock = 7,
                        Images = new[] { $"{R2ProductCdn}/spectre-black.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "Lenovo ThinkPad X1 Carbon Black", Slug = "lenovo-thinkpad-x1-carbon-black", 
                        CategoryId = laptops.Id, Brand = "Lenovo", Price = 48000000, InStock = 4,
                        Images = new[] { $"{R2ProductCdn}/thinkpad-black.png" },
                        Specs = "{}"
                    }
                );
                context.SaveChanges();
            }
        }

        SeedUsers(context);
        SeedDiscounts(context);
        UpdateProductMetrics(context);
    }

    private static void SeedCategories(AppDbContext context)
    {
        var defaultCategories = new[]
        {
            new Category { Name = "Laptop", Slug = "laptop", Description = "Máy tính xách tay" },
            new Category { Name = "PC & Màn hình", Slug = "pc", Description = "Dàn PC hiệu năng cao & màn hình đồ họa" },
            new Category { Name = "Điện thoại", Slug = "dienthoai", Description = "Smartphone flagship & gaming phone chính hãng" },
            new Category { Name = "Phụ kiện", Slug = "phukien", Description = "Chuột, bàn phím cơ, tai nghe & củ cáp sạc" }
        };

        bool changed = false;
        foreach (var cat in defaultCategories)
        {
            if (!context.Categories.Any(c => c.Slug == cat.Slug))
            {
                context.Categories.Add(cat);
                changed = true;
            }
        }

        if (changed)
        {
            context.SaveChanges();
        }
    }

    private static void UpdateProductMetrics(AppDbContext context)
    {
        var products = context.Products.ToList();
        if (!products.Any()) return;

        bool changed = false;
        foreach (var p in products)
        {
            if (p.OriginalPrice == null || p.OriginalPrice == 0)
            {
                // Add 10% - 20% to price as original price for on-sale items
                p.OriginalPrice = (int)Math.Round(p.Price * 1.15 / 100000) * 100000;
                changed = true;
            }

            if (p.SoldCount == 0)
            {
                if (p.Slug.Contains("master")) p.SoldCount = 120;
                else if (p.Slug.Contains("macbook")) p.SoldCount = 89;
                else if (p.Slug.Contains("zephyrus")) p.SoldCount = 52;
                else if (p.Slug.Contains("thinkpad")) p.SoldCount = 42;
                else if (p.Slug.Contains("xps")) p.SoldCount = 38;
                else if (p.Slug.Contains("spectre")) p.SoldCount = 31;
                else if (p.Slug.Contains("gram")) p.SoldCount = 18;
                else p.SoldCount = 10;
                changed = true;
            }

            if (p.ViewCount == 0)
            {
                p.ViewCount = p.SoldCount * 8 + 45;
                changed = true;
            }
        }

        if (changed)
        {
            context.SaveChanges();
        }
    }

    private static void SeedDiscounts(AppDbContext context)
    {
        var discounts = new List<Discount>
        {
            new Discount
            {
                Code = "GHTSALE10",
                Description = "Giảm 10% tối đa 500.000đ cho đơn hàng từ 1.000.000đ (Khuyến mãi toàn sàn)",
                DiscountType = "PERCENTAGE",
                DiscountValue = 10,
                MaxDiscountAmount = 500000,
                MinOrderAmount = 1000000,
                UsageLimit = 1000,
                UsedCount = 0,
                PerUserLimit = 1,
                StartDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2026, 12, 31, 23, 59, 59, DateTimeKind.Utc),
                IsActive = true,
                Conditions = "ALL",
                ConditionValues = Array.Empty<string>(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Discount
            {
                Code = "TECHFEST20",
                Description = "Đại tiệc công nghệ: Giảm 20% tối đa 300.000đ cho đơn từ 500.000đ",
                DiscountType = "PERCENTAGE",
                DiscountValue = 20,
                MaxDiscountAmount = 300000,
                MinOrderAmount = 500000,
                UsageLimit = 500,
                UsedCount = 0,
                PerUserLimit = 1,
                StartDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2026, 12, 31, 23, 59, 59, DateTimeKind.Utc),
                IsActive = true,
                Conditions = "ALL",
                ConditionValues = Array.Empty<string>(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Discount
            {
                Code = "LAPTOP500",
                Description = "Giảm trực tiếp 500.000đ khi mua laptop cao cấp từ 15.000.000đ",
                DiscountType = "FIXED",
                DiscountValue = 500000,
                MaxDiscountAmount = null,
                MinOrderAmount = 15000000,
                UsageLimit = 200,
                UsedCount = 0,
                PerUserLimit = 1,
                StartDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2026, 12, 31, 23, 59, 59, DateTimeKind.Utc),
                IsActive = true,
                Conditions = "ALL",
                ConditionValues = Array.Empty<string>(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Discount
            {
                Code = "FREESHIP",
                Description = "Hỗ trợ 30.000đ phí vận chuyển cho đơn hàng từ 2.000.000đ",
                DiscountType = "FIXED",
                DiscountValue = 30000,
                MaxDiscountAmount = null,
                MinOrderAmount = 2000000,
                UsageLimit = 1000,
                UsedCount = 0,
                PerUserLimit = 1,
                StartDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2026, 12, 31, 23, 59, 59, DateTimeKind.Utc),
                IsActive = true,
                Conditions = "ALL",
                ConditionValues = Array.Empty<string>(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Discount
            {
                Code = "NEWBIE10",
                Description = "Ưu đãi chào bạn mới: Giảm 10% tối đa 200.000đ cho đơn từ 500.000đ",
                DiscountType = "PERCENTAGE",
                DiscountValue = 10,
                MaxDiscountAmount = 200000,
                MinOrderAmount = 500000,
                UsageLimit = 500,
                UsedCount = 0,
                PerUserLimit = 1,
                StartDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2026, 12, 31, 23, 59, 59, DateTimeKind.Utc),
                IsActive = true,
                Conditions = "ALL",
                ConditionValues = Array.Empty<string>(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Discount
            {
                Code = "VIPOFF",
                Description = "Đặc quyền khách hàng VIP: Giảm 15% tối đa 1.000.000đ cho đơn từ 5.000.000đ (Tạm khóa)",
                DiscountType = "PERCENTAGE",
                DiscountValue = 15,
                MaxDiscountAmount = 1000000,
                MinOrderAmount = 5000000,
                UsageLimit = 100,
                UsedCount = 0,
                PerUserLimit = 1,
                StartDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2026, 12, 31, 23, 59, 59, DateTimeKind.Utc),
                IsActive = false,
                Conditions = "ALL",
                ConditionValues = Array.Empty<string>(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };

        foreach (var d in discounts)
        {
            var existing = context.Discounts.FirstOrDefault(x => x.Code == d.Code);
            if (existing == null)
            {
                context.Discounts.Add(d);
            }
        }
        context.SaveChanges();
    }

    private static void SeedUsers(AppDbContext context)
    {
        SeedUser(context, "Quản trị viên", "admin@ght.vn", "Admin@123", "Admin", "0988888888");
        SeedUser(context, "Quản trị viên", "admin@ght.com", "Admin@123456", "Admin", "0988888888");
        SeedUser(context, "Nhân viên GHT", "staff@ght.vn", "Staff@123", "Staff", "0988888888");
        SeedUser(context, "Nhân viên GHT", "staff@ght.com", "Staff@123456", "Staff", "0988888888");
        SeedUser(context, "Khách hàng mẫu", "customer@ght.vn", "Customer@123", "Customer", "0988888888");
        SeedUser(context, "Khách hàng mẫu", "customer@ght.com", "Customer@123456", "Customer", "0988888888");
    }

    private static void SeedUser(AppDbContext context, string name, string email, string password, string role, string phone = "0988888888")
    {
        var existing = context.Users.FirstOrDefault(u => u.Email == email);
        if (existing == null)
        {
            context.Users.Add(new User
            {
                Name = name,
                Email = email,
                Phone = phone,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                Role = role,
                IsActive = true,
                EmailVerified = true
            });
            context.SaveChanges();
        }
        else
        {
            if (string.IsNullOrEmpty(existing.Phone))
            {
                existing.Phone = phone;
            }
            existing.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
            existing.Role = role;
            existing.IsActive = true;
            existing.EmailVerified = true;
            context.SaveChanges();
        }
    }
}

