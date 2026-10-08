using GhtBackend.Models;

namespace GhtBackend.Services;

public class EmailService
{
    private readonly ILogger<EmailService> _logger;

    public EmailService(ILogger<EmailService> logger)
    {
        _logger = logger;
    }

    public async Task SendOrderPlaced(Order order, User customer)
    {
        _logger.LogInformation("Sending Order Placed email to {email}", customer.Email);
        await Task.CompletedTask;
    }

    public async Task SendNewOrderNotify(Order order)
    {
        _logger.LogInformation("Sending New Order Notify to Staff");
        await Task.CompletedTask;
    }

    public async Task SendPaymentConfirmed(Order order)
    {
        _logger.LogInformation("Sending Payment Confirmed email");
        await Task.CompletedTask;
    }

    public async Task SendPaidNotify(Order order)
    {
        _logger.LogInformation("Sending Paid Notify to Staff");
        await Task.CompletedTask;
    }
}
