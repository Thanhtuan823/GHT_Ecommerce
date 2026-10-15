using GhtBackend.Models;

namespace GhtBackend.Data;

public static class DbSeeder
{
    public static void Seed(AppDbContext context)
    {
        context.Database.EnsureCreated();

        if (!context.Categories.Any())
        {
            var laptops = new Category { Name = "Laptop", Slug = "laptop", Description = "Máy tính xách tay" };
            context.Categories.Add(laptops);
            context.SaveChanges();

            if (!context.Products.Any())
            {
                context.Products.AddRange(
                    new Product { 
                        Name = "MacBook Pro 16 Space Black", Slug = "macbook-pro-16-space-black", 
                        CategoryId = laptops.Id, Brand = "Apple", Price = 60000000, InStock = 10,
                        Images = new[] { "/images/macbook-space-black.png" },
                        Specs = "{\"CPU\": \"M3 Max\", \"RAM\": \"36GB\"}"
                    },
                    new Product { 
                        Name = "MacBook Air M3 Silver", Slug = "macbook-air-m3-silver", 
                        CategoryId = laptops.Id, Brand = "Apple", Price = 27000000, InStock = 20,
                        Images = new[] { "/images/macbook-silver.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "Dell XPS 15 Silver", Slug = "dell-xps-15-silver", 
                        CategoryId = laptops.Id, Brand = "Dell", Price = 45000000, InStock = 15,
                        Images = new[] { "/images/dell-xps-silver.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "ROG Zephyrus G14 Eclipse Gray", Slug = "rog-zephyrus-g14-eclipse-gray", 
                        CategoryId = laptops.Id, Brand = "ASUS", Price = 42000000, InStock = 5,
                        Images = new[] { "/images/rog-eclipse-gray.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "ROG Zephyrus G14 Moonlight White", Slug = "rog-zephyrus-g14-moonlight-white", 
                        CategoryId = laptops.Id, Brand = "ASUS", Price = 42000000, InStock = 8,
                        Images = new[] { "/images/rog-moonlight-white.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "LG Gram 16 Black", Slug = "lg-gram-16-black", 
                        CategoryId = laptops.Id, Brand = "LG", Price = 32000000, InStock = 12,
                        Images = new[] { "/images/lg-gram-black.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "LG Gram 16 White", Slug = "lg-gram-16-white", 
                        CategoryId = laptops.Id, Brand = "LG", Price = 32000000, InStock = 10,
                        Images = new[] { "/images/lg-gram-white.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "HP Spectre x360 Black", Slug = "hp-spectre-x360-black", 
                        CategoryId = laptops.Id, Brand = "HP", Price = 40000000, InStock = 7,
                        Images = new[] { "/images/spectre-black.png" },
                        Specs = "{}"
                    },
                    new Product { 
                        Name = "Lenovo ThinkPad X1 Carbon Black", Slug = "lenovo-thinkpad-x1-carbon-black", 
                        CategoryId = laptops.Id, Brand = "Lenovo", Price = 48000000, InStock = 4,
                        Images = new[] { "/images/thinkpad-black.png" },
                        Specs = "{}"
                    }
                );
                context.SaveChanges();
            }
        }

        SeedUsers(context);
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
