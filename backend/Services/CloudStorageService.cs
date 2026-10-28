using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace GhtBackend.Services;

public class CloudStorageService
{
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<CloudStorageService> _logger;
    private readonly IAmazonS3? _s3Client;

    private readonly string _accountId;
    private readonly string _publicBucketName;
    private readonly string _publicUrl;
    private readonly string _privateBucketName;

    public CloudStorageService(
        IConfiguration config, 
        IWebHostEnvironment env, 
        ILogger<CloudStorageService> logger)
    {
        _config = config;
        _env = env;
        _logger = logger;

        _accountId = _config["R2:AccountId"] ?? string.Empty;
        var accessKeyId = _config["R2:AccessKeyId"] ?? string.Empty;
        var secretAccessKey = _config["R2:SecretAccessKey"] ?? string.Empty;
        _publicBucketName = _config["R2:PublicBucket:BucketName"] ?? "ght-products-public";
        _publicUrl = _config["R2:PublicBucket:PublicUrl"] ?? "https://pub-ead62bf4fa7a4393b078968b9a71d0d7.r2.dev";
        _privateBucketName = _config["R2:PrivateBucket:BucketName"] ?? "ght-vault-private";

        if (!string.IsNullOrEmpty(_accountId) && !string.IsNullOrEmpty(accessKeyId) && !string.IsNullOrEmpty(secretAccessKey))
        {
            try
            {
                var s3Config = new AmazonS3Config
                {
                    ServiceURL = $"https://{_accountId}.r2.cloudflarestorage.com",
                    ForcePathStyle = true
                };
                _s3Client = new AmazonS3Client(accessKeyId, secretAccessKey, s3Config);
                _logger.LogInformation("CloudStorageService initialized with Cloudflare R2 endpoint: https://{AccountId}.r2.cloudflarestorage.com", _accountId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initialize AmazonS3Client for Cloudflare R2. Hybrid fallback to local disk will be used.");
                _s3Client = null;
            }
        }
        else
        {
            _logger.LogWarning("Cloudflare R2 credentials not fully configured. CloudStorageService is running in local disk fallback mode.");
            _s3Client = null;
        }
    }

    /// <summary>
    /// Upload ảnh sản phẩm lên Public Bucket (ght-products-public)
    /// Trả về link CDN vĩnh viễn: https://pub-xxx.r2.dev/images/{fileName}
    /// Fallback: lưu vào wwwroot/uploads/products/{fileName}
    /// </summary>
    public async Task<string> UploadProductImageAsync(IFormFile file, string fileName)
    {
        var key = $"images/{fileName}";

        if (_s3Client != null)
        {
            try
            {
                using var stream = file.OpenReadStream();
                var putRequest = new PutObjectRequest
                {
                    BucketName = _publicBucketName,
                    Key = key,
                    InputStream = stream,
                    ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "image/png" : file.ContentType,
                    DisablePayloadSigning = true
                };

                await _s3Client.PutObjectAsync(putRequest);
                _logger.LogInformation("Uploaded public product image to R2: {Key}", key);
                return $"{_publicUrl.TrimEnd('/')}/{key}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading to R2 Public Bucket {Bucket}, falling back to local disk for {File}", _publicBucketName, fileName);
            }
        }

        // Fallback lưu cục bộ
        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var targetDir = Path.Combine(webRoot, "uploads", "products");
        if (!Directory.Exists(targetDir)) Directory.CreateDirectory(targetDir);

        var filePath = Path.Combine(targetDir, fileName);
        using (var fs = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(fs);
        }

        return $"/uploads/products/{fileName}";
    }

    /// <summary>
    /// Kiểm tra file đã tồn tại trong Private Bucket (ght-vault-private) hay chưa
    /// </summary>
    public async Task<bool> VaultFileExistsAsync(string objectKey)
    {
        if (_s3Client != null)
        {
            try
            {
                await _s3Client.GetObjectMetadataAsync(new GetObjectMetadataRequest
                {
                    BucketName = _privateBucketName,
                    Key = objectKey
                });
                return true;
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound || ex.ErrorCode == "NotFound" || ex.ErrorCode == "NoSuchKey")
            {
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not check object metadata for {Key} on R2, checking local fallback disk.", objectKey);
            }
        }

        // Fallback kiểm tra đĩa cục bộ
        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var localPath = Path.Combine(webRoot, "uploads", "vault", objectKey.Replace('/', Path.DirectorySeparatorChar));
        return File.Exists(localPath);
    }

    /// <summary>
    /// Giải quyết chống trùng lặp tên file trong Vault, tăng dần: (2), (3)...
    /// Lần 1: {userFolder}/{userCode}-{cleanBaseName}{extension}
    /// Lần 2: {userFolder}/{userCode}-{cleanBaseName}(2){extension}
    /// </summary>
    public async Task<string> ResolveUniqueVaultKeyAsync(string userFolder, string userCode, string cleanBaseName, string extension)
    {
        var baseKey = $"{userFolder}/{userCode}-{cleanBaseName}{extension}";
        if (!await VaultFileExistsAsync(baseKey))
        {
            return baseKey;
        }

        int counter = 2;
        while (counter <= 1000)
        {
            var candidateKey = $"{userFolder}/{userCode}-{cleanBaseName}({counter}){extension}";
            if (!await VaultFileExistsAsync(candidateKey))
            {
                return candidateKey;
            }
            counter++;
        }

        return $"{userFolder}/{userCode}-{cleanBaseName}_{Guid.NewGuid().ToString().Substring(0, 6)}{extension}";
    }

    /// <summary>
    /// Đẩy stream tệp tin lên Private Vault (ght-vault-private)
    /// Trả về chính objectKey (hoặc fallback relative path)
    /// </summary>
    public async Task<string> UploadVaultFileAsync(IFormFile file, string objectKey)
    {
        if (_s3Client != null)
        {
            try
            {
                using var stream = file.OpenReadStream();
                var putRequest = new PutObjectRequest
                {
                    BucketName = _privateBucketName,
                    Key = objectKey,
                    InputStream = stream,
                    ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                    DisablePayloadSigning = true
                };

                await _s3Client.PutObjectAsync(putRequest);
                _logger.LogInformation("Uploaded private vault file to R2: {Key}", objectKey);
                return objectKey;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading to R2 Private Vault {Bucket}, falling back to local disk for {Key}", _privateBucketName, objectKey);
            }
        }

        // Fallback lưu cục bộ
        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var relativeFilePath = objectKey.Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.Combine(webRoot, "uploads", "vault", relativeFilePath);

        var dir = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }

        using (var fs = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(fs);
        }

        return objectKey;
    }

    /// <summary>
    /// Ký số cấp Presigned URL có thời hạn (mặc định 15 phút) để xem/tải tệp trong Vault
    /// </summary>
    public string GetTemporaryViewUrl(string? objectKey, int expiryMinutes = 15)
    {
        if (string.IsNullOrWhiteSpace(objectKey)) return string.Empty;

        // Nếu là file cũ trong wwwroot/uploads/
        if (objectKey.StartsWith("/uploads/") || objectKey.StartsWith("uploads/"))
        {
            return objectKey.StartsWith("/") ? objectKey : $"/{objectKey}";
        }

        if (_s3Client != null)
        {
            try
            {
                var request = new GetPreSignedUrlRequest
                {
                    BucketName = _privateBucketName,
                    Key = objectKey,
                    Expires = DateTime.UtcNow.AddMinutes(expiryMinutes),
                    Verb = HttpVerb.GET
                };

                return _s3Client.GetPreSignedURL(request);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate PreSigned URL for vault key: {Key}", objectKey);
            }
        }

        // Fallback URL nội bộ
        var cleanKey = objectKey.TrimStart('/');
        return $"/uploads/vault/{cleanKey}";
    }

    /// <summary>
    /// Tách lấy objectKey từ URL đầy đủ hoặc giữ nguyên nếu đã là key
    /// Bóc tách URL Presigned: https://...r2.cloudflarestorage.com/ght-vault-private/userFolder/file.ext?X-Amz-...
    /// Trả về: userFolder/file.ext
    /// </summary>
    public string ExtractVaultKey(string? urlOrKey)
    {
        if (string.IsNullOrWhiteSpace(urlOrKey)) return string.Empty;

        // Cắt bỏ Query String (?X-Amz-...) và Hash (#)
        var clean = urlOrKey.Split('?')[0].Split('#')[0].Trim();

        // Nếu là file upload tĩnh cũ -> không phải Vault key
        if (clean.StartsWith("/uploads/") || clean.StartsWith("uploads/"))
        {
            return string.Empty;
        }

        // Nếu là URL tuyệt đối http:// hoặc https://
        if (Uri.TryCreate(clean, UriKind.Absolute, out var uri))
        {
            var path = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'));

            // Nếu path có chứa bucket name ở đầu (ví dụ: ght-vault-private/userFolder/file.ext)
            if (path.StartsWith($"{_privateBucketName}/", StringComparison.OrdinalIgnoreCase))
            {
                path = path.Substring(_privateBucketName.Length + 1);
            }
            // Hoặc trường hợp fallback có /uploads/vault/
            else if (path.StartsWith("uploads/vault/", StringComparison.OrdinalIgnoreCase))
            {
                path = path.Substring("uploads/vault/".Length);
            }

            return path;
        }

        // Đã là dạng objectKey: {userFolder}/{file}
        return clean.TrimStart('/');
    }
}
