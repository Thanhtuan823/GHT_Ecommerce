namespace GhtBackend.DTOs.Ai
{
    public class ChatMessageItemDto
    {
        public string Role { get; set; } = "user"; // "user" hoặc "ai"/"model"
        public string Content { get; set; } = string.Empty;
    }

    public class ChatRequestDto
    {
        public string Message { get; set; } = string.Empty;
        public string? CurrentUrl { get; set; }
        public int? CurrentProductId { get; set; }
        public string? CurrentProductSlug { get; set; }
        public List<ChatMessageItemDto>? History { get; set; }
    }
}
