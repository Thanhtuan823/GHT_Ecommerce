using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using System.IO;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Globalization;
using System.Text;
using GhtBackend.Data;
using GhtBackend.Services;

namespace GhtBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UploadController : ControllerBase
{
    private readonly CloudStorageService _storageService;
    private readonly AppDbContext _context;

    public UploadController(CloudStorageService storageService, AppDbContext context)
    {
        _storageService = storageService;
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> Upload(IFormFile file, [FromQuery] string type = "vault")
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Không tìm thấy file hợp lệ." });

        if (file.Length > 15 * 1024 * 1024)
            return BadRequest(new { message = "Dung lượng tệp tối đa là 15MB." });

        var allowedExtensions = new[] { 
            ".jpg", ".jpeg", ".png", ".webp", ".gif", 
            ".pdf", ".json", ".txt", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".rar" 
        };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
            return BadRequest(new { message = "Định dạng tệp không được hỗ trợ." });

        // NHÁNH 1: ẢNH SẢN PHẨM (PUBLIC)
        if (string.Equals(type, "product", StringComparison.OrdinalIgnoreCase))
        {
            if (!User.IsInRole("Admin") && !User.IsInRole("Staff"))
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Chỉ Admin và Staff mới có quyền đăng ảnh sản phẩm." });

            var rawBaseName = Path.GetFileNameWithoutExtension(file.FileName);
            var cleanName = Regex.Replace(rawBaseName, @"[^a-zA-Z0-9_-]", "_");
            if (cleanName.Length > 40) cleanName = cleanName.Substring(0, 40);
            var fileName = $"{Guid.NewGuid().ToString().Substring(0, 8)}_{cleanName}{ext}";

            var cdnUrl = await _storageService.UploadProductImageAsync(file, fileName);
            return Ok(new { 
                url = cdnUrl, 
                fileName = file.FileName, 
                fileSize = file.Length, 
                storage = "PUBLIC_CDN" 
            });
        }
        // NHÁNH 2: LIVE CHAT & TÀI LIỆU RIÊNG TƯ (PRIVATE VAULT)
        else
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(userIdClaim, out var userId);
            var user = userId > 0 ? await _context.Users.FindAsync(userId) : null;

            var userCode = (1000 + (userId > 0 ? userId : 0)).ToString("D4");
            var rawName = user?.Name ?? (userId > 0 ? "User" : "KhachVangLai");
            
            // Xóa dấu tiếng Việt cho tên thư mục
            var cleanUserName = RemoveVietnameseDiacritics(rawName);
            cleanUserName = Regex.Replace(cleanUserName, @"[^a-zA-Z0-9]", "");
            if (string.IsNullOrEmpty(cleanUserName)) cleanUserName = "User";

            var roleStr = user?.Role ?? "Customer";
            var roleCode = roleStr switch { "Admin" => "Ad", "Staff" => "Sta", _ => "Cus" };
            var userFolder = $"{userCode}-{cleanUserName}-{roleCode}";

            var rawFileName = Path.GetFileNameWithoutExtension(file.FileName);
            var cleanBaseName = Regex.Replace(rawFileName, @"[^a-zA-Z0-9_-]", "_");
            if (cleanBaseName.Length > 40) cleanBaseName = cleanBaseName.Substring(0, 40);

            var objectKey = await _storageService.ResolveUniqueVaultKeyAsync(userFolder, userCode, cleanBaseName, ext);
            await _storageService.UploadVaultFileAsync(file, objectKey);
            var tempUrl = _storageService.GetTemporaryViewUrl(objectKey, 15);

            return Ok(new { 
                key = objectKey, 
                url = tempUrl, 
                fileName = file.FileName, 
                fileSize = file.Length, 
                storage = "PRIVATE_VAULT" 
            });
        }
    }

    [HttpGet("vault-url")]
    public IActionResult GetVaultViewUrl([FromQuery] string key)
    {
        if (string.IsNullOrEmpty(key)) return BadRequest("Key không hợp lệ.");
        var url = _storageService.GetTemporaryViewUrl(key, 15);
        return Ok(new { url });
    }

    private static string RemoveVietnameseDiacritics(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            {
                sb.Append(c);
            }
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).Replace("đ", "d").Replace("Đ", "D");
    }
}
