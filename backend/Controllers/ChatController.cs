using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GhtBackend.Data;
using GhtBackend.Models;
using System.Security.Claims;

namespace GhtBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly AppDbContext _context;

    public ChatController(AppDbContext context)
    {
        _context = context;
    }

    private int GetUserId() => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private string GetUserRole() => User.FindFirst(ClaimTypes.Role)?.Value ?? "Customer";

    // Customer requests or resumes a live chat session
    [HttpPost("request")]
    public async Task<IActionResult> RequestChat()
    {
        var userId = GetUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return Unauthorized(new { message = "Không tìm thấy người dùng" });

        // Find existing non-closed conversation
        var existing = await _context.ChatConversations
            .Include(c => c.Staff)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync(c => c.CustomerId == userId && (c.Status == "WAITING" || c.Status == "ACTIVE"));

        if (existing != null)
        {
            return Ok(new
            {
                conversationId = existing.Id,
                status = existing.Status,
                createdAt = existing.CreatedAt,
                staff = existing.Staff != null ? new
                {
                    id = existing.Staff.Id,
                    name = existing.Staff.Name,
                    avatar = existing.Staff.Avatar,
                    email = existing.Staff.Email
                } : null
            });
        }

        // Create new conversation
        var conv = new ChatConversation
        {
            CustomerId = userId,
            Status = "WAITING",
            CreatedAt = DateTime.UtcNow,
            LastMessage = "Khách hàng yêu cầu hỗ trợ",
            LastMessageAt = DateTime.UtcNow,
            UnreadStaffCount = 1
        };

        _context.ChatConversations.Add(conv);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            conversationId = conv.Id,
            status = conv.Status,
            createdAt = conv.CreatedAt,
            staff = (object?)null
        });
    }

    // Get message history for a conversation
    [HttpGet("history/{conversationId}")]
    public async Task<IActionResult> GetHistory(int conversationId)
    {
        var userId = GetUserId();
        var role = GetUserRole();

        var conv = await _context.ChatConversations
            .Include(c => c.Customer)
            .Include(c => c.Staff)
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conv == null) return NotFound(new { message = "Không tìm thấy cuộc trò chuyện" });

        if (conv.CustomerId != userId && role != "Staff" && role != "Admin")
        {
            return Forbid();
        }

        // Mark unread as read
        if (role == "Customer")
        {
            conv.UnreadCustomerCount = 0;
        }
        else
        {
            conv.UnreadStaffCount = 0;
        }
        await _context.SaveChangesAsync();

        var messages = await _context.ChatMessages
            .AsNoTracking()
            .Where(m => m.ConversationId == conversationId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new
            {
                id = m.Id,
                conversationId = m.ConversationId,
                senderId = m.SenderId,
                senderName = m.Sender.Name,
                senderRole = m.SenderRole,
                senderAvatar = m.Sender.Avatar,
                content = m.Content,
                imageUrl = m.ImageUrl,
                replyTo = m.ReplyToMessage != null ? new
                {
                    id = m.ReplyToMessage.Id,
                    senderName = m.ReplyToMessage.Sender.Name,
                    senderRole = m.ReplyToMessage.SenderRole,
                    content = m.ReplyToMessage.IsRevoked ? "Tin nhắn đã được thu hồi" : m.ReplyToMessage.Content,
                    imageUrl = m.ReplyToMessage.ImageUrl
                } : null,
                reactions = m.Reactions
                    .GroupBy(r => r.Emoji)
                    .Select(g => new
                    {
                        emoji = g.Key,
                        count = g.Count(),
                        users = g.Select(u => new { id = u.UserId, name = u.User.Name }).ToList(),
                        hasReacted = g.Any(u => u.UserId == userId)
                    }).ToList(),
                isEdited = m.IsEdited,
                isRevoked = m.IsRevoked,
                isRead = m.IsRead,
                createdAt = m.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            conversation = new
            {
                id = conv.Id,
                customerId = conv.CustomerId,
                customerName = conv.Customer.Name,
                customerEmail = conv.Customer.Email,
                customerAvatar = conv.Customer.Avatar,
                customerPhone = conv.Customer.Phone,
                staffId = conv.StaffId,
                staffName = conv.Staff?.Name,
                staffAvatar = conv.Staff?.Avatar,
                status = conv.Status,
                createdAt = conv.CreatedAt,
                closedAt = conv.ClosedAt
            },
            messages
        });
    }

    // Staff/Admin: Get conversations list for management
    [HttpGet("staff/conversations")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> GetStaffConversations([FromQuery] string? status)
    {
        var query = _context.ChatConversations
            .Include(c => c.Customer)
            .Include(c => c.Staff)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
        {
            query = query.Where(c => c.Status == status);
        }

        var list = await query
            .OrderByDescending(c => c.LastMessageAt ?? c.CreatedAt)
            .Select(c => new
            {
                id = c.Id,
                customerId = c.CustomerId,
                customerName = c.Customer.Name,
                customerEmail = c.Customer.Email,
                customerAvatar = c.Customer.Avatar,
                customerPhone = c.Customer.Phone,
                staffId = c.StaffId,
                staffName = c.Staff != null ? c.Staff.Name : null,
                staffAvatar = c.Staff != null ? c.Staff.Avatar : null,
                status = c.Status,
                lastMessage = c.LastMessage,
                lastMessageAt = c.LastMessageAt,
                unreadStaffCount = c.UnreadStaffCount,
                createdAt = c.CreatedAt,
                closedAt = c.ClosedAt
            })
            .ToListAsync();

        var summary = new
        {
            waiting = await _context.ChatConversations.CountAsync(c => c.Status == "WAITING"),
            active = await _context.ChatConversations.CountAsync(c => c.Status == "ACTIVE"),
            closed = await _context.ChatConversations.CountAsync(c => c.Status == "CLOSED")
        };

        return Ok(new
        {
            data = list,
            summary
        });
    }

    // Close conversation via REST API
    [HttpPost("close/{conversationId}")]
    public async Task<IActionResult> CloseChat(int conversationId)
    {
        var userId = GetUserId();
        var role = GetUserRole();

        var conv = await _context.ChatConversations.FindAsync(conversationId);
        if (conv == null) return NotFound(new { message = "Không tìm thấy cuộc trò chuyện" });

        if (conv.CustomerId != userId && role != "Staff" && role != "Admin")
        {
            return Forbid();
        }

        conv.Status = "CLOSED";
        conv.ClosedAt = DateTime.UtcNow;
        conv.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Đã kết thúc phiên hỗ trợ", conversationId = conv.Id, closedAt = conv.ClosedAt });
    }
}
