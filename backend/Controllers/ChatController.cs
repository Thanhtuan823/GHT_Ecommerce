using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GhtBackend.Data;
using GhtBackend.Models;
using System.Security.Claims;

namespace GhtBackend.Controllers;

public class OpenInternalChatRequest
{
    public int TargetUserId { get; set; }
}

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

        // Find existing non-closed customer support conversation
        var existing = await _context.ChatConversations
            .Include(c => c.Staff)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync(c => c.CustomerId == userId && c.Type == "CUSTOMER_SUPPORT" && (c.Status == "WAITING" || c.Status == "ACTIVE"));

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
            Type = "CUSTOMER_SUPPORT",
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

        if (conv.Type == "INTERNAL_WORK")
        {
            if (conv.CustomerId != userId && conv.StaffId != userId)
            {
                return Forbid();
            }

            // Mark unread as read
            if (conv.CustomerId == userId)
            {
                conv.UnreadCustomerCount = 0;
            }
            else
            {
                conv.UnreadStaffCount = 0;
            }
            await _context.SaveChangesAsync();
        }
        else
        {
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
        }

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

        var isInternal = conv.Type == "INTERNAL_WORK";
        var peerUser = isInternal ? (conv.CustomerId == userId ? conv.Staff : conv.Customer) : null;

        return Ok(new
        {
            conversation = new
            {
                id = conv.Id,
                type = conv.Type,
                customerId = conv.CustomerId,
                customerName = conv.Customer?.Name,
                customerEmail = conv.Customer?.Email,
                customerAvatar = conv.Customer?.Avatar,
                customerPhone = conv.Customer?.Phone,
                staffId = conv.StaffId,
                staffName = conv.Staff?.Name,
                staffAvatar = conv.Staff?.Avatar,
                status = conv.Status,
                createdAt = conv.CreatedAt,
                closedAt = conv.ClosedAt,
                peer = peerUser != null ? new
                {
                    id = peerUser.Id,
                    name = peerUser.Name,
                    email = peerUser.Email,
                    role = peerUser.Role,
                    avatar = peerUser.Avatar,
                    phone = peerUser.Phone
                } : null
            },
            messages
        });
    }

    // Staff/Admin: Get conversations list for customer management
    [HttpGet("staff/conversations")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> GetStaffConversations([FromQuery] string? status)
    {
        var query = _context.ChatConversations
            .Include(c => c.Customer)
            .Include(c => c.Staff)
            .AsNoTracking()
            .Where(c => c.Type == "CUSTOMER_SUPPORT")
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
            waiting = await _context.ChatConversations.CountAsync(c => c.Type == "CUSTOMER_SUPPORT" && c.Status == "WAITING"),
            active = await _context.ChatConversations.CountAsync(c => c.Type == "CUSTOMER_SUPPORT" && c.Status == "ACTIVE"),
            closed = await _context.ChatConversations.CountAsync(c => c.Type == "CUSTOMER_SUPPORT" && c.Status == "CLOSED")
        };

        return Ok(new
        {
            data = list,
            summary
        });
    }

    // Staff/Admin: Get list of colleagues for autocomplete search
    [HttpGet("internal/colleagues")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> GetInternalColleagues([FromQuery] string? search)
    {
        var currentUserId = GetUserId();
        var query = _context.Users
            .AsNoTracking()
            .Where(u => u.Id != currentUserId && (u.Role == "Admin" || u.Role == "Staff") && u.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(u => EF.Functions.ILike(u.Name, term) || EF.Functions.ILike(u.Email, term));
        }

        var colleagues = await query
            .OrderBy(u => u.Name)
            .Select(u => new
            {
                id = u.Id,
                name = u.Name,
                email = u.Email,
                role = u.Role,
                avatar = u.Avatar,
                phone = u.Phone
            })
            .ToListAsync();

        return Ok(colleagues);
    }

    // Staff/Admin: Get internal 1-1 conversations
    [HttpGet("internal/conversations")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> GetInternalConversations()
    {
        var currentUserId = GetUserId();

        var conversations = await _context.ChatConversations
            .Include(c => c.Customer)
            .Include(c => c.Staff)
            .AsNoTracking()
            .Where(c => c.Type == "INTERNAL_WORK" && (c.CustomerId == currentUserId || c.StaffId == currentUserId))
            .OrderByDescending(c => c.LastMessageAt ?? c.CreatedAt)
            .ToListAsync();

        var result = conversations.Select(c =>
        {
            var isCustomer = c.CustomerId == currentUserId;
            var peer = isCustomer ? c.Staff : c.Customer;
            var unreadCount = isCustomer ? c.UnreadCustomerCount : c.UnreadStaffCount;

            return new
            {
                id = c.Id,
                type = c.Type,
                peer = peer != null ? new
                {
                    id = peer.Id,
                    name = peer.Name,
                    email = peer.Email,
                    role = peer.Role,
                    avatar = peer.Avatar,
                    phone = peer.Phone
                } : null,
                lastMessage = c.LastMessage,
                lastMessageAt = c.LastMessageAt,
                unreadCount = unreadCount,
                createdAt = c.CreatedAt,
                status = c.Status
            };
        });

        return Ok(result);
    }

    // Staff/Admin: Open or create 1-1 internal chat conversation with a colleague
    [HttpPost("internal/open")]
    [Authorize(Roles = "Admin,Staff")]
    public async Task<IActionResult> OpenInternalChat([FromBody] OpenInternalChatRequest request)
    {
        var currentUserId = GetUserId();
        if (request.TargetUserId <= 0 || request.TargetUserId == currentUserId)
        {
            return BadRequest(new { message = "Đối tượng trò chuyện không hợp lệ." });
        }

        var targetUser = await _context.Users.FindAsync(request.TargetUserId);
        if (targetUser == null || (targetUser.Role != "Admin" && targetUser.Role != "Staff") || !targetUser.IsActive)
        {
            return BadRequest(new { message = "Không tìm thấy đồng nghiệp hoặc tài khoản không hoạt động." });
        }

        // Check if conversation already exists between the two
        var existing = await _context.ChatConversations
            .Include(c => c.Customer)
            .Include(c => c.Staff)
            .FirstOrDefaultAsync(c => c.Type == "INTERNAL_WORK" &&
                ((c.CustomerId == currentUserId && c.StaffId == request.TargetUserId) ||
                 (c.CustomerId == request.TargetUserId && c.StaffId == currentUserId)));

        if (existing != null)
        {
            return Ok(new
            {
                conversationId = existing.Id,
                status = existing.Status,
                type = existing.Type
            });
        }

        var conv = new ChatConversation
        {
            Type = "INTERNAL_WORK",
            CustomerId = currentUserId,
            StaffId = request.TargetUserId,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            LastMessage = "Bắt đầu cuộc trò chuyện nội bộ",
            LastMessageAt = DateTime.UtcNow,
            UnreadCustomerCount = 0,
            UnreadStaffCount = 0
        };

        _context.ChatConversations.Add(conv);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            conversationId = conv.Id,
            status = conv.Status,
            type = conv.Type
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

        if (conv.Type == "INTERNAL_WORK")
        {
            return BadRequest(new { message = "Cuộc trò chuyện nội bộ duy trì xuyên suốt, không thể đóng." });
        }

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
