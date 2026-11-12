namespace GhtBackend.DTOs.Ai
{
    public class ChatResult
    {
        public string Reply { get; set; } = string.Empty;
        public List<ProductSummaryDto> Products { get; set; } = new();
        public CompareResultDto? CompareData { get; set; }
    }

    public class ProductSummaryDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Slug { get; set; }
        public decimal Price { get; set; }
        public decimal? OriginalPrice { get; set; }
        public string? Image { get; set; }
        public string? Brand { get; set; }
        public bool InStock { get; set; } = true;
    }

    public class CompareResultDto
    {
        public CompareProductItemDto? Product1 { get; set; }
        public CompareProductItemDto? Product2 { get; set; }
    }

    public class CompareProductItemDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Slug { get; set; }
        public string? Brand { get; set; }
        public decimal Price { get; set; }
        public decimal? OriginalPrice { get; set; }
        public string? Image { get; set; }
        public int InStock { get; set; }
        public string? Cpu { get; set; }
        public string? Ram { get; set; }
        public string? Storage { get; set; }
        public string? Screen { get; set; }
        public string? Gpu { get; set; }
        public string? Weight { get; set; }
        public string? Battery { get; set; }
    }
}
