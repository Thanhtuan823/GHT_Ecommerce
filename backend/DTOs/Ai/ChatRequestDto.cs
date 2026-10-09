namespace GhtBackend.DTOs.Ai
{
    public class ChatRequestDto
    {
        public string Message { get; set; } = string.Empty;
        public string? CurrentUrl { get; set; }
        public int? CurrentProductId { get; set; }
    }
}
