using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using GhtBackend.Data;
using GhtBackend.Models;
using GhtBackend.DTOs;
using GhtBackend.Helpers;

namespace GhtBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly AppDbContext _context;

    public CategoriesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var categories = await _context.Categories
            .AsNoTracking()
            .Select(c => new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Slug = c.Slug,
                Description = c.Description
            })
            .ToListAsync();
        return Ok(categories);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create(CreateCategoryRequest request)
    {
        var slug = SlugHelper.GenerateSlug(request.Name);
        if (await _context.Categories.AnyAsync(c => c.Slug == slug))
            return Conflict(new { message = "Danh mục với tên này (hoặc slug tương tự) đã tồn tại" });

        var category = new Category
        {
            Name = request.Name,
            Slug = slug,
            Description = request.Description
        };

        _context.Categories.Add(category);
        await _context.SaveChangesAsync();

        return StatusCode(201, new CategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            Slug = category.Slug,
            Description = category.Description
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, CreateCategoryRequest request)
    {
        var category = await _context.Categories.FindAsync(id);
        if (category == null) return NotFound(new { message = "Danh mục không tồn tại" });

        var newSlug = SlugHelper.GenerateSlug(request.Name);
        if (newSlug != category.Slug && await _context.Categories.AnyAsync(c => c.Slug == newSlug))
            return Conflict(new { message = "Danh mục với tên này đã tồn tại" });

        category.Name = request.Name;
        category.Slug = newSlug;
        category.Description = request.Description;

        await _context.SaveChangesAsync();
        return Ok(new CategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            Slug = category.Slug,
            Description = category.Description
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await _context.Categories.FindAsync(id);
        if (category == null) return NotFound(new { message = "Danh mục không tồn tại" });

        if (await _context.Products.AnyAsync(p => p.CategoryId == id))
            return BadRequest(new { message = "Không thể xóa danh mục đang có sản phẩm" });

        _context.Categories.Remove(category);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
