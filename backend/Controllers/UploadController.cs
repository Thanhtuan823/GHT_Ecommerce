using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using System.IO;

namespace GhtBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UploadController : ControllerBase
{
    private readonly IWebHostEnvironment _env;

    public UploadController(IWebHostEnvironment env)
    {
        _env = env;
    }

    [HttpPost]
    public async Task<IActionResult> UploadImage(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Không tìm thấy file hợp lệ." });
        }

        // Validate size (15MB = 15 * 1024 * 1024 bytes)
        if (file.Length > 15 * 1024 * 1024)
        {
            return BadRequest(new { message = "Dung lượng tệp tối đa là 15MB." });
        }

        // Validate extension
        var allowedExtensions = new[] { 
            ".jpg", ".jpeg", ".png", ".webp", ".gif",
            ".pdf", ".json", ".txt", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".rar" 
        };
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();

        if (!allowedExtensions.Contains(extension))
        {
            return BadRequest(new { message = "Định dạng tệp không được hỗ trợ." });
        }

        // Ensure wwwroot/uploads exists
        var webRootPath = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var uploadsFolder = Path.Combine(webRootPath, "uploads");

        if (!Directory.Exists(uploadsFolder))
        {
            Directory.CreateDirectory(uploadsFolder);
        }

        // Generate unique filename with original name
        var cleanOriginalName = Path.GetFileNameWithoutExtension(file.FileName)
            .Replace(" ", "_")
            .Replace("/", "_")
            .Replace("\\", "_");
        if (cleanOriginalName.Length > 50) cleanOriginalName = cleanOriginalName.Substring(0, 50);

        var uniqueFileName = $"{Guid.NewGuid().ToString()}_{cleanOriginalName}{extension}";
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);

        using (var fileStream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(fileStream);
        }

        // Return the relative URL to access the file
        var fileUrl = $"/uploads/{uniqueFileName}";

        return Ok(new { 
            url = fileUrl, 
            fileName = file.FileName,
            fileSize = file.Length 
        });
    }
}
