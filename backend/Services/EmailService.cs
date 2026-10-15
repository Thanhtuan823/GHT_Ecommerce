using System.Globalization;
using System.Text.Json;
using GhtBackend.Data;
using GhtBackend.DTOs;
using GhtBackend.Models;
using MailKit.Net.Smtp;
using Microsoft.EntityFrameworkCore;
using MimeKit;

namespace GhtBackend.Services;

public class EmailService
{
    private readonly ILogger<EmailService> _logger;
    private readonly IConfiguration _config;
    private readonly PdfService _pdfService;
    private readonly AppDbContext _context;

    public EmailService(
        ILogger<EmailService> logger,
        IConfiguration config,
        PdfService pdfService,
        AppDbContext context)
    {
        _logger = logger;
        _config = config;
        _pdfService = pdfService;
        _context = context;
    }

    private string? GetLogoPath()
    {
        var candidates = new[]
        {
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Resources", "logo_ght.jpg"),
            Path.Combine(Directory.GetCurrentDirectory(), "Resources", "logo_ght.jpg"),
            Path.Combine(Directory.GetCurrentDirectory(), "backend", "Resources", "logo_ght.jpg"),
            Path.Combine(Directory.GetCurrentDirectory(), "public", "images", "logo_ght.jpg"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "public", "images", "logo_ght.jpg"),
            Path.Combine(Directory.GetCurrentDirectory(), "dist", "images", "logo_ght.jpg"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "dist", "images", "logo_ght.jpg")
        };

        foreach (var path in candidates)
        {
            try
            {
                if (File.Exists(path))
                {
                    return Path.GetFullPath(path);
                }
            }
            catch { }
        }
        return null;
    }

    private async Task EnsureOrderLoadedAsync(Order order)
    {
        if (order.User == null || order.OrderItems == null || !order.OrderItems.Any())
        {
            try
            {
                var fullOrder = await _context.Orders
                    .AsNoTracking()
                    .Include(o => o.User)
                    .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Product)
                    .FirstOrDefaultAsync(o => o.Id == order.Id);

                if (fullOrder != null)
                {
                    order.User ??= fullOrder.User;
                    if (order.OrderItems == null || !order.OrderItems.Any())
                    {
                        order.OrderItems = fullOrder.OrderItems;
                    }
                    if (string.IsNullOrEmpty(order.ShippingAddress) || order.ShippingAddress == "{}")
                    {
                        order.ShippingAddress = fullOrder.ShippingAddress;
                    }
                    if (string.IsNullOrEmpty(order.TrackingNumber))
                    {
                        order.TrackingNumber = fullOrder.TrackingNumber;
                    }
                    if (string.IsNullOrEmpty(order.CancelReason))
                    {
                        order.CancelReason = fullOrder.CancelReason;
                    }
                    if (order.TotalPrice == 0 && fullOrder.TotalPrice > 0)
                    {
                        order.TotalPrice = fullOrder.TotalPrice;
                        order.OriginalAmount = fullOrder.OriginalAmount;
                        order.DiscountAmount = fullOrder.DiscountAmount;
                        order.ShippingFee = fullOrder.ShippingFee;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not load full order details for order #{OrderId}", order.Id);
            }
        }
    }

    private async Task SendEmailAsync(
        string toEmail,
        string toName,
        string subject,
        string htmlBody,
        byte[]? attachmentBytes = null,
        string? attachmentName = null)
    {
        try
        {
            var user = _config["Email:User"];
            var pass = _config["Email:AppPassword"];

            if (string.IsNullOrEmpty(user) || string.IsNullOrEmpty(pass))
            {
                _logger.LogWarning("Email credentials not configured.");
                return;
            }

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress("GHT E-Commerce", user));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = subject;

            var bodyBuilder = new BodyBuilder();

            // Nhúng logo CID nội bộ
            var logoPath = GetLogoPath();
            if (!string.IsNullOrEmpty(logoPath) && File.Exists(logoPath))
            {
                var image = bodyBuilder.LinkedResources.Add(logoPath);
                image.ContentId = "ght_logo_cid";
            }

            // Đính kèm file nếu có (ví dụ: Hóa đơn PDF)
            if (attachmentBytes != null && !string.IsNullOrEmpty(attachmentName))
            {
                bodyBuilder.Attachments.Add(attachmentName, attachmentBytes, new ContentType("application", "pdf"));
            }

            bodyBuilder.HtmlBody = htmlBody;
            message.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            await client.ConnectAsync("smtp.gmail.com", 587, MailKit.Security.SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(user, pass);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            _logger.LogInformation("Successfully sent email '{Subject}' to {Email}", subject, toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email '{Subject}' to {Email}", subject, toEmail);
        }
    }

    private (string Name, string Phone, string FullAddress) ParseShippingAddress(Order order)
    {
        var name = order.User?.Name ?? "Quý khách";
        var phone = order.User?.Phone ?? "Chưa cung cấp";
        var address = "Chưa cung cấp";

        if (!string.IsNullOrEmpty(order.ShippingAddress) && order.ShippingAddress != "{}")
        {
            try
            {
                var dto = JsonSerializer.Deserialize<ShippingAddressDto>(
                    order.ShippingAddress,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (dto != null)
                {
                    if (!string.IsNullOrWhiteSpace(dto.Name)) name = dto.Name;
                    if (!string.IsNullOrWhiteSpace(dto.Phone)) phone = dto.Phone;

                    if (!string.IsNullOrWhiteSpace(dto.FullAddress))
                    {
                        address = dto.FullAddress;
                    }
                    else
                    {
                        var parts = new List<string>();
                        if (!string.IsNullOrWhiteSpace(dto.Address)) parts.Add(dto.Address);
                        if (!string.IsNullOrWhiteSpace(dto.WardName)) parts.Add(dto.WardName);
                        if (!string.IsNullOrWhiteSpace(dto.DistrictName)) parts.Add(dto.DistrictName);
                        if (!string.IsNullOrWhiteSpace(dto.ProvinceName)) parts.Add(dto.ProvinceName);
                        address = parts.Count > 0 ? string.Join(", ", parts) : dto.Address;
                    }
                }
            }
            catch
            {
                address = order.ShippingAddress;
            }
        }

        return (name, phone, address);
    }

    private string FormatVnd(int amount)
    {
        return amount.ToString("#,##0", new CultureInfo("vi-VN")) + " đ";
    }

    private string WrapWithGhtLayout(string title, string contentHtml)
    {
        return $@"
<!DOCTYPE html>
<html lang=""vi"">
<head>
  <meta charset=""UTF-8"" />
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"" />
  <title>{title}</title>
</head>
<body style=""margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1F2937; line-height: 1.5;"">
  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""background-color: #F3F4F6; padding: 24px 12px;"">
    <tr>
      <td align=""center"">
        <!-- Main Container -->
        <table role=""presentation"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden; text-align: left;"">
          
          <!-- Header Banner -->
          <tr>
            <td style=""background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%); padding: 24px 20px; text-align: center; color: #ffffff;"">
              <div style=""display: inline-block; background-color: #ffffff; padding: 6px 14px; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.12);"">
                <img src=""cid:ght_logo_cid"" alt=""GHT E-Commerce"" style=""height: 44px; max-height: 44px; display: block; object-fit: contain; margin: 0 auto;"" />
              </div>
              <h1 style=""margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 1px; color: #ffffff; text-transform: uppercase;"">GHT E-COMMERCE</h1>
              <p style=""margin: 4px 0 0 0; font-size: 13px; color: #DBEAFE; font-weight: 400;"">Công nghệ tiên phong - Trải nghiệm vượt trội</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style=""padding: 28px 24px;"">
              {contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style=""background-color: #F9FAFB; border-top: 1px solid #E5E7EB; padding: 20px 24px; text-align: center; font-size: 12px; color: #6B7280; line-height: 1.6;"">
              <p style=""margin: 0 0 4px 0; font-weight: 700; color: #374151; font-size: 13px;"">HỆ THỐNG THƯƠNG MẠI ĐIỆN TỬ GHT E-COMMERCE</p>
              <p style=""margin: 0 0 4px 0;"">
                Hotline hỗ trợ: <strong style=""color: #2563EB;"">1900 8888</strong> &bull; Email: <strong style=""color: #2563EB;"">support@ghtecom.vn</strong>
              </p>
              <p style=""margin: 0 0 6px 0;"">Địa chỉ: Tòa nhà GHT Innovation, Khu Công Nghệ Cao, TP. Hồ Chí Minh</p>
              <p style=""margin: 8px 0 0 0; font-size: 11px; color: #9CA3AF;"">
                Email này được gửi tự động từ hệ thống GHT E-Commerce. Quý khách vui lòng không trả lời trực tiếp email này.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";
    }

    private string BuildOrderItemsTableHtml(Order order)
    {
        var itemsHtml = string.Empty;
        if (order.OrderItems != null && order.OrderItems.Any())
        {
            foreach (var item in order.OrderItems)
            {
                var productName = item.Product?.Name ?? $"Sản phẩm #{item.ProductId}";
                var subtotal = item.Price * item.Quantity;
                itemsHtml += $@"
            <tr style=""border-bottom: 1px solid #F3F4F6;"">
              <td style=""padding: 10px 8px; font-weight: 500; color: #1F2937;"">{productName}</td>
              <td style=""padding: 10px 8px; text-align: center; color: #4B5563;"">{item.Quantity}</td>
              <td style=""padding: 10px 8px; text-align: right; color: #4B5563;"">{FormatVnd(item.Price)}</td>
              <td style=""padding: 10px 8px; text-align: right; font-weight: 600; color: #111827;"">{FormatVnd(subtotal)}</td>
            </tr>";
            }
        }
        else
        {
            itemsHtml = @"
            <tr>
              <td colspan=""4"" style=""padding: 12px; text-align: center; color: #9CA3AF;"">Đơn hàng không có danh mục sản phẩm</td>
            </tr>";
        }

        var discountRow = string.Empty;
        if (order.DiscountAmount > 0)
        {
            discountRow = $@"
            <tr>
              <td colspan=""3"" style=""padding: 4px 8px; text-align: right; color: #16A34A;"">Mã giảm giá áp dụng:</td>
              <td style=""padding: 4px 8px; text-align: right; font-weight: 600; color: #16A34A;"">-{FormatVnd(order.DiscountAmount)}</td>
            </tr>";
        }

        var shippingFeeText = order.ShippingFee > 0 ? FormatVnd(order.ShippingFee) : "Miễn phí";

        return $@"
        <div style=""margin-top: 20px; margin-bottom: 20px;"">
          <h3 style=""margin: 0 0 10px 0; font-size: 15px; font-weight: 700; color: #111827; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px;"">
            Chi tiết đơn hàng #{order.Id}
          </h3>
          <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""border-collapse: collapse; font-size: 14px;"">
            <thead>
              <tr style=""background-color: #F9FAFB; border-bottom: 2px solid #E5E7EB; color: #4B5563;"">
                <th style=""padding: 10px 8px; text-align: left; font-weight: 600;"">Sản phẩm</th>
                <th style=""padding: 10px 8px; text-align: center; font-weight: 600; width: 45px;"">SL</th>
                <th style=""padding: 10px 8px; text-align: right; font-weight: 600; width: 100px;"">Đơn giá</th>
                <th style=""padding: 10px 8px; text-align: right; font-weight: 600; width: 110px;"">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan=""3"" style=""padding: 10px 8px 4px 8px; text-align: right; color: #6B7280;"">Tạm tính:</td>
                <td style=""padding: 10px 8px 4px 8px; text-align: right; font-weight: 500; color: #374151;"">{FormatVnd(order.OriginalAmount)}</td>
              </tr>
              <tr>
                <td colspan=""3"" style=""padding: 4px 8px; text-align: right; color: #6B7280;"">Phí vận chuyển (GHN Express):</td>
                <td style=""padding: 4px 8px; text-align: right; font-weight: 500; color: #374151;"">{shippingFeeText}</td>
              </tr>
              {discountRow}
              <tr style=""border-top: 1px solid #E5E7EB;"">
                <td colspan=""3"" style=""padding: 12px 8px 4px 8px; text-align: right; font-weight: 700; font-size: 15px; color: #111827;"">Tổng thanh toán:</td>
                <td style=""padding: 12px 8px 4px 8px; text-align: right; font-weight: 700; font-size: 18px; color: #2563EB;"">{FormatVnd(order.TotalPrice)}</td>
              </tr>
            </tfoot>
          </table>
        </div>";
    }

    private string BuildShippingInfoHtml(Order order)
    {
        var (name, phone, address) = ParseShippingAddress(order);

        string paymentMethodText = order.PaymentMethod switch
        {
            "COD" => "Thanh toán khi nhận hàng (COD)",
            "SEPAY_QR" or "BANK_TRANSFER" => "Chuyển khoản QR SePay (Đã xác nhận tự động)",
            _ => order.PaymentMethod
        };

        var trackingRow = string.Empty;
        if (!string.IsNullOrWhiteSpace(order.TrackingNumber))
        {
            trackingRow = $@"
            <tr>
              <td style=""color: #6B7280; padding: 4px 0; font-weight: 500;"">Mã vận đơn GHN:</td>
              <td style=""padding: 4px 0;"">
                <span style=""display: inline-block; background-color: #E0E7FF; color: #3730A3; font-weight: 700; font-family: monospace; padding: 3px 8px; border-radius: 4px; font-size: 13px;"">
                  {order.TrackingNumber}
                </span>
              </td>
            </tr>";
        }

        return $@"
        <div style=""background-color: #F9FAFB; border-radius: 8px; border: 1px solid #E5E7EB; padding: 14px 16px; margin: 18px 0;"">
          <div style=""font-weight: 700; font-size: 13px; text-transform: uppercase; color: #374151; margin-bottom: 8px; letter-spacing: 0.5px;"">
            Thông tin giao hàng
          </div>
          <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""font-size: 14px; line-height: 1.6;"">
            <tr>
              <td style=""width: 140px; color: #6B7280; padding: 3px 0;"">Người nhận:</td>
              <td style=""color: #111827; font-weight: 600; padding: 3px 0;"">{name}</td>
            </tr>
            <tr>
              <td style=""color: #6B7280; padding: 3px 0;"">Số điện thoại:</td>
              <td style=""color: #111827; font-weight: 500; padding: 3px 0;"">{phone}</td>
            </tr>
            <tr>
              <td style=""color: #6B7280; padding: 3px 0; vertical-align: top;"">Địa chỉ:</td>
              <td style=""color: #111827; padding: 3px 0;"">{address}</td>
            </tr>
            <tr>
              <td style=""color: #6B7280; padding: 3px 0;"">Phương thức:</td>
              <td style=""color: #111827; padding: 3px 0;"">{paymentMethodText}</td>
            </tr>
            {trackingRow}
          </table>
        </div>";
    }

    private string BuildActionButtonsHtml(Order order, bool isShipped = false)
    {
        var frontendUrl = _config["Frontend:BaseUrl"] ?? "http://localhost:5173";
        var orderDetailUrl = $"{frontendUrl}/orders/{order.Id}";

        var buttons = $@"
        <div style=""text-align: center; margin: 26px 0 16px 0;"">
          <a href=""{orderDetailUrl}"" style=""display: inline-block; background-color: #2563EB; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);"">
            Xem chi tiết đơn hàng
          </a>";

        if (isShipped && !string.IsNullOrWhiteSpace(order.TrackingNumber))
        {
            var ghnTrackingUrl = $"https://donhang.ghn.vn/?order_code={order.TrackingNumber}";
            buttons += $@"
          <span style=""display: inline-block; width: 10px;""></span>
          <a href=""{ghnTrackingUrl}"" style=""display: inline-block; background-color: #EA580C; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(234, 88, 12, 0.25);"">
            Tra cứu hành trình GHN
          </a>";
        }

        buttons += "</div>";
        return buttons;
    }

    // =========================================================================
    // CÁC PHƯƠNG THỨC GỬI EMAIL CỤ THỂ
    // =========================================================================

    public async Task SendOrderPlaced(Order order, User? customer = null)
    {
        await EnsureOrderLoadedAsync(order);
        var targetUser = customer ?? order.User;
        if (targetUser == null || string.IsNullOrEmpty(targetUser.Email)) return;

        var (name, _, _) = ParseShippingAddress(order);

        string paymentInstruction = order.PaymentMethod switch
        {
            "COD" => "Đơn hàng của bạn sẽ được nhân viên GHT xác nhận và bàn giao cho đơn vị vận chuyển GHN Express trong thời gian sớm nhất.",
            _ => "Vui lòng hoàn tất thanh toán chuyển khoản qua mã QR SePay để hệ thống tự động xác nhận và đóng gói giao hàng."
        };

        var contentHtml = $@"
        <div style=""text-align: center; margin-bottom: 20px;"">
          <span style=""display: inline-block; background-color: #DBEAFE; color: #1E40AF; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;"">
            Xác nhận đặt hàng thành công
          </span>
          <h2 style=""margin: 12px 0 6px 0; font-size: 20px; color: #111827;"">Cảm ơn bạn đã đặt hàng tại GHT E-Commerce!</h2>
          <p style=""margin: 0; color: #4B5563; font-size: 14px;"">
            Đơn hàng <strong>#DH{order.Id}</strong> đã được khởi tạo thành công vào lúc {order.CreatedAt.ToLocalTime():HH:mm, dd/MM/yyyy}.
          </p>
        </div>

        <p style=""font-size: 14px; color: #374151; margin-bottom: 16px;"">
          Xin chào <strong>{name}</strong>, {paymentInstruction}
        </p>

        {BuildOrderItemsTableHtml(order)}
        {BuildShippingInfoHtml(order)}
        {BuildActionButtonsHtml(order)}";

        var fullHtml = WrapWithGhtLayout($"Xác nhận đặt hàng thành công - DH{order.Id}", contentHtml);
        await SendEmailAsync(targetUser.Email, targetUser.Name, $"[GHT E-Commerce] Xác nhận đặt hàng thành công - #DH{order.Id}", fullHtml);
    }

    public async Task SendPaymentConfirmed(Order order)
    {
        await EnsureOrderLoadedAsync(order);
        if (order.User == null || string.IsNullOrEmpty(order.User.Email)) return;

        var (name, _, _) = ParseShippingAddress(order);

        var contentHtml = $@"
        <div style=""text-align: center; margin-bottom: 20px;"">
          <span style=""display: inline-block; background-color: #DCFCE7; color: #166534; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;"">
            Thanh toán thành công
          </span>
          <h2 style=""margin: 12px 0 6px 0; font-size: 20px; color: #111827;"">Xác nhận thanh toán đơn hàng #DH{order.Id}</h2>
          <p style=""margin: 0; color: #4B5563; font-size: 14px;"">
            Hệ thống đã nhận được số tiền <strong>{FormatVnd(order.TotalPrice)}</strong> qua cổng SePay.
          </p>
        </div>

        <p style=""font-size: 14px; color: #374151; margin-bottom: 16px;"">
          Xin chào <strong>{name}</strong>, cảm ơn quý khách đã thanh toán. Đơn hàng của bạn đã được chuyển sang trạng thái chuẩn bị đóng gói và bàn giao cho đơn vị vận chuyển GHN Express.
        </p>
        <p style=""font-size: 14px; color: #2563EB; font-weight: 500; background-color: #EFF6FF; border-left: 4px solid #2563EB; padding: 10px 14px; border-radius: 4px; margin-bottom: 16px;"">
          📄 <strong>Hóa đơn điện tử PDF</strong> của đơn hàng đã được đính kèm trực tiếp trong email này để bạn tiện lưu trữ và theo dõi bảo hành.
        </p>

        {BuildOrderItemsTableHtml(order)}
        {BuildShippingInfoHtml(order)}
        {BuildActionButtonsHtml(order)}";

        var fullHtml = WrapWithGhtLayout($"Thanh toán thành công - DH{order.Id}", contentHtml);

        byte[]? pdfBytes = null;
        try
        {
            pdfBytes = _pdfService.GenerateInvoice(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate invoice PDF for order #{OrderId}", order.Id);
        }

        await SendEmailAsync(
            order.User.Email,
            order.User.Name,
            $"[GHT E-Commerce] Xác nhận thanh toán thành công - #DH{order.Id}",
            fullHtml,
            pdfBytes,
            $"HoaDon_DH{order.Id}.pdf");
    }

    public async Task SendOrderShipped(Order order)
    {
        await EnsureOrderLoadedAsync(order);
        if (order.User == null || string.IsNullOrEmpty(order.User.Email)) return;

        var (name, _, _) = ParseShippingAddress(order);

        var contentHtml = $@"
        <div style=""text-align: center; margin-bottom: 20px;"">
          <span style=""display: inline-block; background-color: #E0E7FF; color: #3730A3; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;"">
            Đơn hàng đang trên đường giao
          </span>
          <h2 style=""margin: 12px 0 6px 0; font-size: 20px; color: #111827;"">Bàn giao shipper GHN thành công!</h2>
          <p style=""margin: 0; color: #4B5563; font-size: 14px;"">
            Mã vận đơn GHN Express: <strong>{order.TrackingNumber ?? "Đang cập nhật"}</strong>
          </p>
        </div>

        <p style=""font-size: 14px; color: #374151; margin-bottom: 16px;"">
          Xin chào <strong>{name}</strong>, đơn hàng <strong>#DH{order.Id}</strong> của bạn đã được đóng gói cẩn thận và bàn giao cho nhân viên giao hàng GHN Express. Vui lòng để ý điện thoại để nhận hàng.
        </p>
        <p style=""font-size: 14px; color: #15803D; font-weight: 500; background-color: #F0FDF4; border-left: 4px solid #16A34A; padding: 10px 14px; border-radius: 4px; margin-bottom: 16px;"">
          📦 Quý khách có thể bấm nút <strong>""Tra cứu hành trình GHN""</strong> bên dưới để xem vị trí bưu phẩm theo thời gian thực. Hóa đơn PDF mua hàng cũng được đính kèm trong email này.
        </p>

        {BuildOrderItemsTableHtml(order)}
        {BuildShippingInfoHtml(order)}
        {BuildActionButtonsHtml(order, isShipped: true)}";

        var fullHtml = WrapWithGhtLayout($"Đơn hàng đang giao - DH{order.Id}", contentHtml);

        byte[]? pdfBytes = null;
        try
        {
            pdfBytes = _pdfService.GenerateInvoice(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate invoice PDF for order #{OrderId}", order.Id);
        }

        await SendEmailAsync(
            order.User.Email,
            order.User.Name,
            $"[GHT E-Commerce] Đơn hàng đang được giao - #DH{order.Id} (Mã GHN: {order.TrackingNumber})",
            fullHtml,
            pdfBytes,
            $"HoaDon_DH{order.Id}.pdf");
    }

    public async Task SendOrderCancelled(Order order, string? cancelReason = null)
    {
        await EnsureOrderLoadedAsync(order);
        if (order.User == null || string.IsNullOrEmpty(order.User.Email)) return;

        var (name, _, _) = ParseShippingAddress(order);
        var reasonText = !string.IsNullOrWhiteSpace(cancelReason)
            ? cancelReason
            : (!string.IsNullOrWhiteSpace(order.CancelReason) ? order.CancelReason : "Khách hàng yêu cầu hủy đơn");

        var contentHtml = $@"
        <div style=""text-align: center; margin-bottom: 20px;"">
          <span style=""display: inline-block; background-color: #FEE2E2; color: #991B1B; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;"">
            Thông báo hủy đơn hàng
          </span>
          <h2 style=""margin: 12px 0 6px 0; font-size: 20px; color: #111827;"">Đơn hàng #DH{order.Id} đã được hủy</h2>
        </div>

        <p style=""font-size: 14px; color: #374151; margin-bottom: 12px;"">
          Xin chào <strong>{name}</strong>, đơn hàng <strong>#DH{order.Id}</strong> của bạn trên hệ thống GHT E-Commerce đã được hủy thành công.
        </p>
        <div style=""background-color: #FFF1F2; border-left: 4px solid #E11D48; padding: 12px 14px; border-radius: 4px; margin-bottom: 16px;"">
          <div style=""font-size: 13px; color: #9F1239; font-weight: 600;"">Lý do hủy đơn:</div>
          <div style=""font-size: 14px; color: #BE123C; margin-top: 2px;"">{reasonText}</div>
        </div>
        <p style=""font-size: 13px; color: #6B7280; margin-bottom: 16px;"">
          Nếu đơn hàng đã được thanh toán trước, bộ phận chăm sóc khách hàng của GHT E-Commerce sẽ liên hệ với bạn trong vòng 24 giờ làm việc để hoàn tất thủ tục hoàn tiền.
        </p>

        {BuildOrderItemsTableHtml(order)}
        {BuildShippingInfoHtml(order)}
        {BuildActionButtonsHtml(order)}";

        var fullHtml = WrapWithGhtLayout($"Đơn hàng đã hủy - DH{order.Id}", contentHtml);
        await SendEmailAsync(
            order.User.Email,
            order.User.Name,
            $"[GHT E-Commerce] Thông báo hủy đơn hàng - #DH{order.Id}",
            fullHtml);
    }

    public async Task SendNewOrderNotify(Order order)
    {
        var staffEmail = _config["Staff:NotifyEmail"];
        if (string.IsNullOrEmpty(staffEmail)) return;

        await EnsureOrderLoadedAsync(order);
        var (name, phone, _) = ParseShippingAddress(order);

        var contentHtml = $@"
        <div style=""margin-bottom: 16px;"">
          <span style=""display: inline-block; background-color: #FEF3C7; color: #92400E; padding: 4px 12px; border-radius: 16px; font-weight: 700; font-size: 12px; text-transform: uppercase;"">
            Đơn hàng mới chờ xử lý
          </span>
          <h2 style=""margin: 10px 0 4px 0; font-size: 18px; color: #111827;"">Đơn hàng mới: #DH{order.Id}</h2>
          <p style=""margin: 0; font-size: 14px; color: #4B5563;"">
            Khách hàng: <strong>{name}</strong> - SĐT: <strong>{phone}</strong> - Tổng tiền: <strong style=""color: #2563EB;"">{FormatVnd(order.TotalPrice)}</strong>
          </p>
        </div>

        {BuildOrderItemsTableHtml(order)}
        {BuildShippingInfoHtml(order)}
        {BuildActionButtonsHtml(order)}";

        var fullHtml = WrapWithGhtLayout($"Đơn hàng mới - DH{order.Id}", contentHtml);
        await SendEmailAsync(staffEmail, "Staff GHT", $"[Vận hành GHT] Có đơn hàng mới - #DH{order.Id}", fullHtml);
    }

    public async Task SendPaidNotify(Order order)
    {
        var staffEmail = _config["Staff:NotifyEmail"];
        if (string.IsNullOrEmpty(staffEmail)) return;

        await EnsureOrderLoadedAsync(order);
        var (name, phone, _) = ParseShippingAddress(order);

        var contentHtml = $@"
        <div style=""margin-bottom: 16px;"">
          <span style=""display: inline-block; background-color: #DCFCE7; color: #166534; padding: 4px 12px; border-radius: 16px; font-weight: 700; font-size: 12px; text-transform: uppercase;"">
            Đã thanh toán Online
          </span>
          <h2 style=""margin: 10px 0 4px 0; font-size: 18px; color: #111827;"">Khách hàng đã thanh toán đơn: #DH{order.Id}</h2>
          <p style=""margin: 0; font-size: 14px; color: #4B5563;"">
            Khách hàng: <strong>{name}</strong> - Số tiền: <strong style=""color: #16A34A;"">{FormatVnd(order.TotalPrice)}</strong>
          </p>
        </div>

        <p style=""font-size: 14px; color: #374151;"">
          Đơn hàng đã được xác nhận thanh toán hợp lệ. Vui lòng chuẩn bị hàng và tạo vận đơn GHN Express trên hệ thống.
        </p>

        {BuildOrderItemsTableHtml(order)}
        {BuildShippingInfoHtml(order)}
        {BuildActionButtonsHtml(order)}";

        var fullHtml = WrapWithGhtLayout($"Khách đã thanh toán - DH{order.Id}", contentHtml);
        await SendEmailAsync(staffEmail, "Staff GHT", $"[Vận hành GHT] Khách hàng đã thanh toán đơn #DH{order.Id}", fullHtml);
    }

    public async Task SendReportEmail(string subject, string htmlBody)
    {
        var adminEmail = _config["Admin:ReportEmail"];
        if (string.IsNullOrEmpty(adminEmail)) return;

        var contentHtml = $@"
        <div style=""margin-bottom: 16px;"">
          <span style=""display: inline-block; background-color: #EEF2FF; color: #4338CA; padding: 4px 12px; border-radius: 16px; font-weight: 700; font-size: 12px; text-transform: uppercase;"">
            Báo cáo hệ thống định kỳ
          </span>
          <h2 style=""margin: 10px 0 6px 0; font-size: 18px; color: #111827;"">{subject}</h2>
        </div>
        <div style=""font-size: 14px; color: #374151; line-height: 1.6;"">
          {htmlBody}
        </div>";

        var fullHtml = WrapWithGhtLayout(subject, contentHtml);
        await SendEmailAsync(adminEmail, "Admin GHT", $"[Báo cáo GHT] {subject}", fullHtml);
    }

    public async Task SendPasswordResetOtp(User user, string otp)
    {
        if (string.IsNullOrEmpty(user.Email)) return;

        var userName = !string.IsNullOrWhiteSpace(user.Name) ? user.Name : "Quý khách";

        var contentHtml = $@"
        <div style=""margin-bottom: 20px;"">
          <span style=""display: inline-block; background-color: #FEF3C7; color: #92400E; padding: 4px 12px; border-radius: 16px; font-weight: 700; font-size: 12px; text-transform: uppercase;"">
            Xác thực bảo mật tài khoản
          </span>
          <h2 style=""margin: 12px 0 6px 0; font-size: 20px; color: #111827;"">Yêu cầu đặt lại mật khẩu</h2>
          <p style=""margin: 0; font-size: 14px; color: #4B5563; line-height: 1.5;"">
            Xin chào <strong>{userName}</strong>, chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với email <strong>{user.Email}</strong> trên hệ thống GHT E-Commerce.
          </p>
        </div>

        <div style=""background-color: #EFF6FF; border: 2px dashed #BFDBFE; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;"">
          <div style=""font-size: 13px; font-weight: 600; color: #1D4ED8; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px;"">
            Mã xác thực OTP của bạn
          </div>
          <div style=""font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; color: #1E40AF; letter-spacing: 8px; margin: 8px 0;"">
            {otp}
          </div>
          <div style=""font-size: 13px; color: #60A5FA; margin-top: 6px;"">
            (Mã này chỉ có hiệu lực trong vòng <strong>10 phút</strong>)
          </div>
        </div>

        <div style=""background-color: #FFFBEB; border-left: 4px solid #F59E0B; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;"">
          <div style=""font-size: 13px; color: #B45309; font-weight: 600;"">Lưu ý quan trọng:</div>
          <div style=""font-size: 13px; color: #92400E; line-height: 1.5; margin-top: 2px;"">
            Tuyệt đối không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên của GHT. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc đổi mật khẩu ngay để bảo vệ tài khoản.
          </div>
        </div>

        <p style=""font-size: 13px; color: #6B7280; line-height: 1.5; margin: 0;"">
          Trân trọng,<br />
          <strong>Đội ngũ Kỹ thuật & Bảo mật GHT E-Commerce</strong>
        </p>";

        var fullHtml = WrapWithGhtLayout("Đặt lại mật khẩu - GHT E-Commerce", contentHtml);
        await SendEmailAsync(
            user.Email,
            userName,
            "[GHT E-Commerce] Mã xác nhận đặt lại mật khẩu của bạn",
            fullHtml);
    }

    public async Task SendEmailVerificationOtp(User user, string otp)
    {
        if (string.IsNullOrEmpty(user.Email)) return;

        var userName = !string.IsNullOrWhiteSpace(user.Name) ? user.Name : "Quý khách";

        var contentHtml = $@"
        <div style=""margin-bottom: 20px;"">
          <span style=""display: inline-block; background-color: #DCFCE7; color: #15803D; padding: 4px 12px; border-radius: 16px; font-weight: 700; font-size: 12px; text-transform: uppercase;"">
            Kích hoạt tài khoản mới
          </span>
          <h2 style=""margin: 12px 0 6px 0; font-size: 20px; color: #111827;"">Xác thực địa chỉ email của bạn</h2>
          <p style=""margin: 0; font-size: 14px; color: #4B5563; line-height: 1.5;"">
            Xin chào <strong>{userName}</strong>, cảm ơn bạn đã đăng ký tài khoản tại <strong>GHT E-Commerce</strong>. Để kích hoạt tài khoản và nhận thông báo đơn hàng, hóa đơn điện tử cũng như các ưu đãi độc quyền, vui lòng nhập mã xác thực OTP bên dưới:
          </p>
        </div>

        <div style=""background-color: #F0FDF4; border: 2px dashed #86EFAC; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;"">
          <div style=""font-size: 13px; font-weight: 600; color: #16A34A; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px;"">
            Mã OTP kích hoạt tài khoản
          </div>
          <div style=""font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; color: #15803D; letter-spacing: 8px; margin: 8px 0;"">
            {otp}
          </div>
          <div style=""font-size: 13px; color: #16A34A; margin-top: 6px;"">
            (Mã xác thực có hiệu lực trong vòng <strong>10 phút</strong>)
          </div>
        </div>

        <div style=""background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;"">
          <div style=""font-size: 13px; color: #1D4ED8; font-weight: 600;"">Lợi ích sau khi kích hoạt:</div>
          <div style=""font-size: 13px; color: #2563EB; line-height: 1.5; margin-top: 2px;"">
            ✓ Nhận thông báo xác nhận đơn hàng và mã vận đơn GHN Express tức thì.<br />
            ✓ Tự động nhận hóa đơn điện tử PDF sau khi thanh toán.<br />
            ✓ Bảo vệ tài khoản và dễ dàng khôi phục mật khẩu khi cần thiết.
          </div>
        </div>

        <p style=""font-size: 13px; color: #6B7280; line-height: 1.5; margin: 0;"">
          Trân trọng,<br />
          <strong>Đội ngũ GHT E-Commerce</strong>
        </p>";

        var fullHtml = WrapWithGhtLayout("Xác thực email - GHT E-Commerce", contentHtml);
        await SendEmailAsync(
            user.Email,
            userName,
            "[GHT E-Commerce] Xác thực địa chỉ email kích hoạt tài khoản của bạn",
            fullHtml);
    }
}

