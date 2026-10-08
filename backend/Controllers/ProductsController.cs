using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using GhtBackend.Data;
using GhtBackend.Models;
using GhtBackend.DTOs;
using GhtBackend.Helpers;
using System.Security.Claims;
using System.Text.Json;

namespace GhtBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProductsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] int? category,
        [FromQuery] string? brand,
        [FromQuery] int? minPrice,
        [FromQuery] int? maxPrice,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 12)
    {
        if (page < 1) page = 1;
        if (limit < 1) limit = 12;

        var query = _context.Products.AsNoTracking().AsQueryable();

        if (!string.IsNullOrEmpty(search))
        {
            var searchPattern = $"%{search}%";
            query = query.Where(p => EF.Functions.ILike(p.Name, searchPattern));
        }

        if (category.HasValue)
            query = query.Where(p => p.CategoryId == category.Value);

        if (!string.IsNullOrEmpty(brand))
            query = query.Where(p => p.Brand == brand);

        if (minPrice.HasValue)
            query = query.Where(p => p.Price >= minPrice.Value);

        if (maxPrice.HasValue)
            query = query.Where(p => p.Price <= maxPrice.Value);

        var total = await query.CountAsync();

        // Sort: price_asc, price_desc, newest, bestseller
        query = sort switch
        {
            "price_asc" => query.OrderBy(p => p.Price),
            "price_desc" => query.OrderByDescending(p => p.Price),
            "newest" => query.OrderByDescending(p => p.CreatedAt),
            "bestseller" => query.OrderByDescending(p => p.SoldCount),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };

        var productsDb = await query
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        var productIds = productsDb.Select(p => p.Id).ToList();
        
        var reviewsStats = await _context.Reviews
            .AsNoTracking()
            .Where(r => productIds.Contains(r.ProductId))
            .GroupBy(r => r.ProductId)
            .Select(g => new { 
                ProductId = g.Key, 
                AvgRating = g.Average(r => (double?)r.Rating) ?? 0, 
                ReviewCount = g.Count() 
            })
            .ToDictionaryAsync(x => x.ProductId);

        var products = productsDb.Select(p => new ProductDto
        {
            Id = p.Id,
            Name = p.Name,
            Slug = p.Slug,
            Price = p.Price,
            InStock = p.InStock,
            CategoryId = p.CategoryId,
            Brand = p.Brand,
            Images = p.Images,
            Specs = string.IsNullOrEmpty(p.Specs) ? null : JsonSerializer.Deserialize<JsonElement>(p.Specs),
            Tags = p.Tags,
            SoldCount = p.SoldCount,
            CreatedAt = p.CreatedAt,
            AvgRating = reviewsStats.ContainsKey(p.Id) ? reviewsStats[p.Id].AvgRating : 0,
            ReviewCount = reviewsStats.ContainsKey(p.Id) ? reviewsStats[p.Id].ReviewCount : 0
        });

        return Ok(new PaginationDto<ProductDto>
        {
            Data = products,
            Pagination = new PaginationMetadata
            {
                Page = page,
                Limit = limit,
                Total = total,
                TotalPages = (int)Math.Ceiling(total / (double)limit)
            }
        });
    }

    [HttpGet("slug/{slug}")]
    public async Task<IActionResult> GetBySlug(string slug)
    {
        var product = await _context.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .FirstOrDefaultAsync(p => p.Slug == slug);

        if (product == null) return NotFound(new { message = "Sản phẩm không tồn tại" });

        var reviews = await _context.Reviews
            .AsNoTracking()
            .Include(r => r.User)
            .Where(r => r.ProductId == product.Id)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReviewDto
            {
                Id = r.Id,
                UserId = r.UserId,
                UserName = r.User.Name,
                UserAvatar = r.User.Avatar,
                ProductId = r.ProductId,
                Rating = r.Rating,
                Comment = r.Comment,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync();

        var avgRating = reviews.Any() ? reviews.Average(r => r.Rating) : 0;

        var productDto = new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Slug = product.Slug,
            Price = product.Price,
            InStock = product.InStock,
            CategoryId = product.CategoryId,
            Brand = product.Brand,
            Images = product.Images,
            Specs = string.IsNullOrEmpty(product.Specs) ? null : JsonSerializer.Deserialize<JsonElement>(product.Specs),
            Tags = product.Tags,
            SoldCount = product.SoldCount,
            CreatedAt = product.CreatedAt,
            Category = product.Category != null ? new CategoryDto
            {
                Id = product.Category.Id,
                Name = product.Category.Name,
                Slug = product.Category.Slug
            } : null,
            AvgRating = avgRating,
            ReviewCount = reviews.Count
        };

        return Ok(new
        {
            product = productDto,
            reviews,
            avgRating,
            reviewCount = reviews.Count
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var product = await _context.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
        if (product == null) return NotFound(new { message = "Sản phẩm không tồn tại" });
        return Ok(product);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> Create(CreateProductRequest request)
    {
        if (!await _context.Categories.AnyAsync(c => c.Id == request.CategoryId))
            return BadRequest(new { message = "Danh mục không tồn tại" });

        var slug = SlugHelper.GenerateSlug(request.Name);
        if (await _context.Products.AnyAsync(p => p.Slug == slug))
            return Conflict(new { message = "Sản phẩm với tên này (hoặc slug tương tự) đã tồn tại" });

        var product = new Product
        {
            Name = request.Name,
            Slug = slug,
            Price = request.Price,
            InStock = request.InStock,
            CategoryId = request.CategoryId,
            Brand = request.Brand,
            Images = request.Images ?? Array.Empty<string>(),
            Specs = request.Specs.HasValue ? JsonSerializer.Serialize(request.Specs.Value) : "{}",
            Tags = request.Tags ?? Array.Empty<string>()
        };

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        return StatusCode(201, new { product });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> Update(int id, CreateProductRequest request)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null) return NotFound(new { message = "Sản phẩm không tồn tại" });

        if (!await _context.Categories.AnyAsync(c => c.Id == request.CategoryId))
            return BadRequest(new { message = "Danh mục không tồn tại" });

        var newSlug = SlugHelper.GenerateSlug(request.Name);
        if (newSlug != product.Slug && await _context.Products.AnyAsync(p => p.Slug == newSlug))
            return Conflict(new { message = "Sản phẩm với tên này đã tồn tại" });

        product.Name = request.Name;
        product.Slug = newSlug;
        product.Price = request.Price;
        product.InStock = request.InStock;
        product.CategoryId = request.CategoryId;
        product.Brand = request.Brand;
        product.Images = request.Images ?? Array.Empty<string>();
        product.Specs = request.Specs.HasValue ? JsonSerializer.Serialize(request.Specs.Value) : "{}";
        product.Tags = request.Tags ?? Array.Empty<string>();
        product.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(new { product });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null) return NotFound(new { message = "Sản phẩm không tồn tại" });

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id}/reviews")]
    [Authorize]
    public async Task<IActionResult> CreateReview(int id, CreateReviewRequest request)
    {
        if (!await _context.Products.AnyAsync(p => p.Id == id))
            return NotFound(new { message = "Sản phẩm không tồn tại" });

        var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdString) || !int.TryParse(userIdString, out var userId))
            return Unauthorized();

        if (await _context.Reviews.AnyAsync(r => r.ProductId == id && r.UserId == userId))
            return Conflict(new { message = "Bạn đã đánh giá sản phẩm này rồi" });

        var review = new Review
        {
            ProductId = id,
            UserId = userId,
            Rating = request.Rating,
            Comment = request.Comment
        };

        _context.Reviews.Add(review);
        await _context.SaveChangesAsync();

        return StatusCode(201, new { message = "Đánh giá thành công" });
    }
}
