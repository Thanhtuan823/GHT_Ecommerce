using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using GhtBackend.Data;
using GhtBackend.Hubs;
using GhtBackend.Models;
using System.Security.Claims;

namespace GhtBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IHubContext<ChatHub> _hubContext;

    public NotificationsController(AppDbContext context, IHubContext<ChatHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    private int GetUserId() => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

    // GET /api/notifications
    [HttpGet]
    public async Task<IActionResult> GetNotifications()
    {
        var currentUserId = GetUserId();
        if (currentUserId <= 0) return Unauthorized();

        var notifications = await _context.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == currentUserId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(30)
            .Select(n => new
            {
                id = n.Id,
                userId = n.UserId,
                title = n.Title,
                message = n.Message,
                type = n.Type,
                targetUrl = n.TargetUrl,
                metadata = n.Metadata,
                isRead = n.IsRead,
                createdAt = n.CreatedAt
            })
            .ToListAsync();

        var unreadCount = await _context.Notifications
            .Where(n => n.UserId == currentUserId && !n.IsRead)
            .CountAsync();

        return Ok(new
        {
            data = notifications,
            unreadCount
        });
    }

    // PUT /api/notifications/{id}/read
    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkAsRead(int id)
    {
        var currentUserId = GetUserId();
        if (currentUserId <= 0) return Unauthorized();

        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == currentUserId);

        if (notification == null) return NotFound(new { message = "Không tìm thấy thông báo" });

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            await _context.SaveChangesAsync();
        }

        var unreadCount = await _context.Notifications
            .Where(n => n.UserId == currentUserId && !n.IsRead)
            .CountAsync();

        return Ok(new
        {
            success = true,
            id = notification.Id,
            unreadCount
        });
    }

    // PUT /api/notifications/read-all
    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var currentUserId = GetUserId();
        if (currentUserId <= 0) return Unauthorized();

        var unreadNotifications = await _context.Notifications
            .Where(n => n.UserId == currentUserId && !n.IsRead)
            .ToListAsync();

        if (unreadNotifications.Any())
        {
            foreach (var n in unreadNotifications)
            {
                n.IsRead = true;
            }
            await _context.SaveChangesAsync();
        }

        return Ok(new
        {
            success = true,
            unreadCount = 0
        });
    }
}
