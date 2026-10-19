namespace GhtBackend.DTOs.Ai
{
    public class ChatResult
    {
        public string Reply { get; set; } = string.Empty;
        public List<ProductSummaryDto> Products { get; set; } = new();
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
}
