using GhtBackend.DTOs.Ai;
using GhtBackend.Services;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GhtBackend.Controllers
{
    [ApiController]
    [Route("api/ai")]
    public class AiController : ControllerBase
    {
        private readonly AiService _aiService;
        private readonly ILogger<AiController> _logger;

        public AiController(AiService aiService, ILogger<AiController> logger)
        {
            _aiService = aiService;
            _logger = logger;
        }

        [HttpPost("chat")]
        // Hỗ trợ cả User đăng nhập và Guest
        public async Task<IActionResult> Chat([FromBody] ChatRequestDto request)
        {
            var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "Guest";
            
            try
            {
                var reply = await _aiService.ProcessChatAsync(request, role);
                return Ok(new { reply });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Chatbot error: {msg}", ex.Message);
                return StatusCode(503, new { message = "Trợ lý tạm thời không khả dụng, thử lại sau", detail = ex.Message });
            }
        }
    }
}
