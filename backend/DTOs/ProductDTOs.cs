using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace GhtBackend.DTOs;

public class CategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class CreateCategoryRequest
{
    [Required, StringLength(100)]
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class ProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public int Price { get; set; }
    public int InStock { get; set; }
    public int CategoryId { get; set; }
    public string? Brand { get; set; }
    public string[]? Images { get; set; }
    public JsonElement? Specs { get; set; }
    public string[]? Tags { get; set; }
    public int SoldCount { get; set; }
    public DateTime CreatedAt { get; set; }
    
    // Virtual fields added in DTO
    public double AvgRating { get; set; }
    public int ReviewCount { get; set; }
    public CategoryDto? Category { get; set; }
}

public class CreateProductRequest
{
    [Required, StringLength(200)]
    public string Name { get; set; } = string.Empty;
    [Range(0, int.MaxValue)]
    public int Price { get; set; }
    [Range(0, int.MaxValue)]
    public int InStock { get; set; }
    public int CategoryId { get; set; }
    public string? Brand { get; set; }
    public string[]? Images { get; set; }
    public JsonElement? Specs { get; set; }
    public string[]? Tags { get; set; }
}

public class ReviewDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string? UserAvatar { get; set; }
    public int ProductId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateReviewRequest
{
    [Required, Range(1, 5)]
    public int Rating { get; set; }
    public string? Comment { get; set; }
}

public class PaginationDto<T>
{
    public IEnumerable<T> Data { get; set; } = new List<T>();
    public PaginationMetadata Pagination { get; set; } = new();
}

public class PaginationMetadata
{
    public int Page { get; set; }
    public int Limit { get; set; }
    public int Total { get; set; }
    public int TotalPages { get; set; }
}
