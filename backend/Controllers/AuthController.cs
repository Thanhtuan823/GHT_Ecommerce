using Microsoft.AspNetCore.Mvc;
using GhtBackend.Data;
using GhtBackend.Models;
using GhtBackend.DTOs;
using GhtBackend.Services;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;

namespace GhtBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuthService _authService;
    private readonly IServiceScopeFactory _scopeFactory;

    public AuthController(AppDbContext context, IAuthService authService, IServiceScopeFactory scopeFactory)
    {
        _context = context;
        _authService = authService;
        _scopeFactory = scopeFactory;
    }

    private void SendVerificationOtpInBackground(string email, string name, string otp)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var emailSvc = scope.ServiceProvider.GetRequiredService<EmailService>();
                await emailSvc.SendEmailVerificationOtp(new User { Email = email, Name = name }, otp);
            }
            catch { }
        });
    }

    private void SendPasswordResetOtpInBackground(string email, string name, string otp)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var emailSvc = scope.ServiceProvider.GetRequiredService<EmailService>();
                await emailSvc.SendPasswordResetOtp(new User { Email = email, Name = name }, otp);
            }
            catch { }
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLower();
        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

        if (existingUser != null)
        {
            if (existingUser.EmailVerified)
            {
                return Conflict(new { message = "Email đã được sử dụng" });
            }

            // Nếu tài khoản đã tồn tại nhưng chưa xác thực email, cho phép cập nhật thông tin và cấp mã OTP mới
            existingUser.Name = request.Name;
            existingUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            var newOtp = Random.Shared.Next(100000, 999999).ToString();
            existingUser.EmailVerificationOtp = newOtp;
            existingUser.EmailVerificationOtpExpiresAt = DateTime.UtcNow.AddMinutes(10);
            existingUser.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            SendVerificationOtpInBackground(existingUser.Email, existingUser.Name, newOtp);

            return Ok(new
            {
                requireVerification = true,
                email = existingUser.Email,
                message = "Đăng ký thành công! Vui lòng nhập mã OTP gửi tới email của bạn để kích hoạt tài khoản."
            });
        }

        var otp = Random.Shared.Next(100000, 999999).ToString();
        var user = new User
        {
            Name = request.Name,
            Email = normalizedEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = "Customer",
            EmailVerified = false,
            EmailVerificationOtp = otp,
            EmailVerificationOtpExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        SendVerificationOtpInBackground(user.Email, user.Name, otp);

        return Ok(new
        {
            requireVerification = true,
            email = user.Email,
            message = "Đăng ký thành công! Vui lòng nhập mã OTP gửi tới email của bạn để kích hoạt tài khoản."
        });
    }

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Otp))
            return BadRequest(new { message = "Vui lòng nhập đầy đủ email và mã xác thực OTP." });

        var normalizedEmail = request.Email.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

        if (user == null || string.IsNullOrEmpty(user.EmailVerificationOtp) || user.EmailVerificationOtp != request.Otp.Trim())
        {
            return BadRequest(new { message = "Mã xác thực OTP không chính xác." });
        }

        if (!user.EmailVerificationOtpExpiresAt.HasValue || user.EmailVerificationOtpExpiresAt.Value < DateTime.UtcNow)
        {
            return BadRequest(new { message = "Mã xác thực đã hết hạn (chỉ có hiệu lực trong 10 phút). Vui lòng yêu cầu gửi lại mã mới." });
        }

        user.EmailVerified = true;
        user.EmailVerificationOtp = null;
        user.EmailVerificationOtpExpiresAt = null;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var token = _authService.GenerateJwtToken(user);
        return Ok(new AuthResponse
        {
            Token = token,
            User = new UserDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                Avatar = user.Avatar,
                Phone = user.Phone,
                DefaultAddress = ParseAddress(user.DefaultAddress),
                HasPassword = !string.IsNullOrEmpty(user.PasswordHash),
                IsGoogleLinked = !string.IsNullOrEmpty(user.GoogleId),
                EmailVerified = user.EmailVerified
            }
        });
    }

    [HttpPost("resend-verification-otp")]
    public async Task<IActionResult> ResendVerificationOtp([FromBody] ResendVerificationOtpRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { message = "Vui lòng cung cấp địa chỉ email." });

        var normalizedEmail = request.Email.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

        if (user == null)
        {
            return NotFound(new { message = "Không tìm thấy tài khoản tương ứng với email này." });
        }

        if (user.EmailVerified)
        {
            return BadRequest(new { message = "Tài khoản của bạn đã được xác thực email trước đó. Vui lòng đăng nhập." });
        }

        var otp = Random.Shared.Next(100000, 999999).ToString();
        user.EmailVerificationOtp = otp;
        user.EmailVerificationOtpExpiresAt = DateTime.UtcNow.AddMinutes(10);
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        SendVerificationOtpInBackground(user.Email, user.Name, otp);

        return Ok(new { message = "Mã xác thực OTP mới đã được gửi tới email của bạn." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);
        if (user == null || user.PasswordHash == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Email hoặc mật khẩu không đúng" });

        if (!user.EmailVerified)
        {
            // Tự động gia hạn/sinh mã OTP mới nếu đã hết hạn hoặc chưa có
            if (string.IsNullOrEmpty(user.EmailVerificationOtp) || !user.EmailVerificationOtpExpiresAt.HasValue || user.EmailVerificationOtpExpiresAt < DateTime.UtcNow)
            {
                var otp = Random.Shared.Next(100000, 999999).ToString();
                user.EmailVerificationOtp = otp;
                user.EmailVerificationOtpExpiresAt = DateTime.UtcNow.AddMinutes(10);
                await _context.SaveChangesAsync();
                SendVerificationOtpInBackground(user.Email, user.Name, otp);
            }

            return StatusCode(403, new
            {
                requireVerification = true,
                email = user.Email,
                message = "Tài khoản chưa được kích hoạt email. Vui lòng xác thực mã OTP gửi tới email của bạn."
            });
        }

        var token = _authService.GenerateJwtToken(user);
        return Ok(new AuthResponse
        {
            Token = token,
            User = new UserDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                Avatar = user.Avatar,
                Phone = user.Phone,
                DefaultAddress = ParseAddress(user.DefaultAddress),
                HasPassword = !string.IsNullOrEmpty(user.PasswordHash),
                IsGoogleLinked = !string.IsNullOrEmpty(user.GoogleId),
                EmailVerified = user.EmailVerified
            }
        });
    }

    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin(GoogleLoginRequest request)
    {
        try
        {
            var payload = await _authService.ValidateGoogleTokenAsync(request.IdToken);
            var normalizedEmail = payload.Email.Trim().ToLower();
            
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);
            if (user == null)
            {
                user = new User
                {
                    Name = payload.Name,
                    Email = normalizedEmail,
                    GoogleId = payload.Subject,
                    Avatar = payload.Picture,
                    Role = "Customer",
                    EmailVerified = true // Google emails are verified
                };
                _context.Users.Add(user);
            }
            else
            {
                user.EmailVerified = true;
                if (string.IsNullOrEmpty(user.GoogleId))
                {
                    user.GoogleId = payload.Subject;
                }
                if (string.IsNullOrEmpty(user.Avatar))
                {
                    user.Avatar = payload.Picture;
                }
            }
            
            await _context.SaveChangesAsync();

            var token = _authService.GenerateJwtToken(user);
            return Ok(new AuthResponse
            {
                Token = token,
                User = new UserDto
                {
                    Id = user.Id,
                    Name = user.Name,
                    Email = user.Email,
                    Role = user.Role,
                    Avatar = user.Avatar,
                    Phone = user.Phone,
                    DefaultAddress = ParseAddress(user.DefaultAddress),
                    HasPassword = !string.IsNullOrEmpty(user.PasswordHash),
                    IsGoogleLinked = !string.IsNullOrEmpty(user.GoogleId),
                    EmailVerified = user.EmailVerified
                }
            });
        }
        catch (Google.Apis.Auth.InvalidJwtException)
        {
            return Unauthorized(new { message = "Token Google không hợp lệ" });
        }
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { message = "Vui lòng nhập địa chỉ email." });

        var normalizedEmail = request.Email.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

        // Chống lộ thông tin tài khoản (User Enumeration Prevention)
        if (user == null)
        {
            return Ok(new { message = "Nếu email tồn tại trên hệ thống, mã xác nhận đã được gửi." });
        }

        // Sinh mã OTP ngẫu nhiên 6 chữ số
        var otp = Random.Shared.Next(100000, 999999).ToString();
        user.ResetPasswordOtp = otp;
        user.ResetPasswordOtpExpiresAt = DateTime.UtcNow.AddMinutes(10);
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        SendPasswordResetOtpInBackground(user.Email, user.Name, otp);

        return Ok(new { message = "Mã xác nhận đã được gửi đến email của bạn." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Otp) || string.IsNullOrWhiteSpace(request.NewPassword))
            return BadRequest(new { message = "Vui lòng nhập đầy đủ email, mã OTP và mật khẩu mới." });

        if (request.NewPassword.Length < 6)
            return BadRequest(new { message = "Mật khẩu mới phải có tối thiểu 6 ký tự." });

        var normalizedEmail = request.Email.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

        if (user == null || string.IsNullOrEmpty(user.ResetPasswordOtp) || user.ResetPasswordOtp != request.Otp.Trim())
        {
            return BadRequest(new { message = "Mã xác nhận không chính xác." });
        }

        if (!user.ResetPasswordOtpExpiresAt.HasValue || user.ResetPasswordOtpExpiresAt.Value < DateTime.UtcNow)
        {
            return BadRequest(new { message = "Mã xác nhận đã hết hạn, vui lòng yêu cầu mã mới." });
        }

        // Băm mật khẩu mới & Xóa OTP
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.ResetPasswordOtp = null;
        user.ResetPasswordOtpExpiresAt = null;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại." });
    }

    private static ShippingAddressDto? ParseAddress(string? json)
    {
        if (string.IsNullOrEmpty(json)) return null;
        try { return System.Text.Json.JsonSerializer.Deserialize<ShippingAddressDto>(json); }
        catch { return null; }
    }
}
