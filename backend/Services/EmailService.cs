using GhtBackend.Models;
using MimeKit;
using MailKit.Net.Smtp;

namespace GhtBackend.Services;

public class EmailService
{
    private readonly ILogger<EmailService> _logger;
    private readonly IConfiguration _config;
    private readonly PdfService _pdfService;

    public EmailService(ILogger<EmailService> logger, IConfiguration config, PdfService pdfService)
    {
        _logger = logger;
        _config = config;
        _pdfService = pdfService;
    }

    private async Task SendEmailAsync(string toEmail, string toName, string subject, string htmlBody, byte[]? attachmentBytes = null, string? attachmentName = null)
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
            message.From.Add(new MailboxAddress("GHT Ecom", user));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = subject;

            var bodyBuilder = new BodyBuilder { HtmlBody = htmlBody };

            if (attachmentBytes != null && attachmentName != null)
            {
                bodyBuilder.Attachments.Add(attachmentName, attachmentBytes, new ContentType("application", "pdf"));
            }

            message.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            await client.ConnectAsync("smtp.gmail.com", 587, MailKit.Security.SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(user, pass);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {email}", toEmail);
        }
    }

    public async Task SendOrderPlaced(Order order, User customer)
    {
        await SendEmailAsync(customer.Email, customer.Name, $"Xác nhận đặt hàng thành công - DH{order.Id}", $"<p>Chào {customer.Name},</p><p>Đơn hàng DH{order.Id} đã được đặt thành công.</p><p>Vui lòng thanh toán sớm để chúng tôi giao hàng.</p>");
    }

    public async Task SendPaymentConfirmed(Order order)
    {
        if (order.User == null) return;
        
        var pdfBytes = _pdfService.GenerateInvoice(order);
        await SendEmailAsync(order.User.Email, order.User.Name, $"Thanh toán thành công - DH{order.Id}", $"<p>Cảm ơn bạn đã thanh toán. Đính kèm là hóa đơn của bạn.</p>", pdfBytes, $"Invoice_DH{order.Id}.pdf");
    }

    public async Task SendOrderShipped(Order order)
    {
        if (order.User == null) return;
        await SendEmailAsync(order.User.Email, order.User.Name, $"Đơn hàng đang giao - DH{order.Id}", $"<p>Đơn hàng của bạn đang trên đường giao.</p>");
    }

    public async Task SendOrderCancelled(Order order)
    {
        if (order.User == null) return;
        await SendEmailAsync(order.User.Email, order.User.Name, $"Đơn hàng đã hủy - DH{order.Id}", $"<p>Đơn hàng của bạn đã bị hủy.</p>");
    }

    public async Task SendNewOrderNotify(Order order)
    {
        var staffEmail = _config["Staff:NotifyEmail"];
        if (string.IsNullOrEmpty(staffEmail)) return;
        await SendEmailAsync(staffEmail, "Staff", $"Có đơn hàng mới - DH{order.Id}", $"<p>Có đơn hàng mới cần xử lý: DH{order.Id}</p>");
    }

    public async Task SendPaidNotify(Order order)
    {
        var staffEmail = _config["Staff:NotifyEmail"];
        if (string.IsNullOrEmpty(staffEmail)) return;
        await SendEmailAsync(staffEmail, "Staff", $"Khách đã thanh toán - DH{order.Id}", $"<p>Đơn hàng DH{order.Id} đã được thanh toán.</p>");
    }

    public async Task SendReportEmail(string subject, string htmlBody)
    {
        var adminEmail = _config["Admin:ReportEmail"];
        if (string.IsNullOrEmpty(adminEmail)) return;
        await SendEmailAsync(adminEmail, "Admin", subject, htmlBody);
    }
}
