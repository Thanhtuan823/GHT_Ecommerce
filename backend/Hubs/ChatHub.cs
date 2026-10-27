using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using GhtBackend.Data;
using GhtBackend.Models;
using System.Security.Claims;

namespace GhtBackend.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly AppDbContext _context;

    public ChatHub(AppDbContext context)
    {
        _context = context;
    }

    private int GetUserId() => int.Parse(Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private string GetUserRole() => Context.User?.FindFirst(ClaimTypes.Role)?.Value ?? "Customer";

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        var role = GetUserRole();
        if (role == "Staff" || role == "Admin")
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "staff_channel");
        }
        if (userId > 0)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        }
        await base.OnConnectedAsync();
    }

    // Join a specific conversation room
    public async Task JoinConversation(int conversationId)
    {
        var userId = GetUserId();
        var role = GetUserRole();

        var conv = await _context.ChatConversations.FindAsync(conversationId);
        if (conv == null)
        {
            throw new HubException("Cuộc trò chuyện không tồn tại.");
        }

        if (conv.Type == "INTERNAL_WORK")
        {
            if (conv.CustomerId != userId && conv.StaffId != userId)
            {
                throw new HubException("Bạn không có quyền tham gia cuộc trò chuyện nội bộ này.");
            }
        }
        else
        {
            // Only conversation customer or Staff/Admin can join
            if (conv.CustomerId != userId && role != "Staff" && role != "Admin")
            {
                throw new HubException("Bạn không có quyền tham gia cuộc trò chuyện này.");
            }
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"conversation_{conversationId}");
    }

    public async Task LeaveConversation(int conversationId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"conversation_{conversationId}");
    }

    // Send a message
    public async Task SendMessage(int conversationId, string content, string? imageUrl, int? replyToId)
    {
        var userId = GetUserId();
        var userRole = GetUserRole();

        if (string.IsNullOrWhiteSpace(content) && string.IsNullOrWhiteSpace(imageUrl))
        {
            throw new HubException("Nội dung tin nhắn hoặc hình ảnh không được để trống.");
        }

        var conv = await _context.ChatConversations
            .Include(c => c.Customer)
            .Include(c => c.Staff)
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conv == null)
        {
            throw new HubException("Cuộc trò chuyện không tồn tại.");
        }

        if (conv.Status == "CLOSED")
        {
            throw new HubException("Phiên hỗ trợ này đã kết thúc.");
        }

        // Check sender
        if (conv.Type == "INTERNAL_WORK")
        {
            if (conv.CustomerId != userId && conv.StaffId != userId)
            {
                throw new HubException("Bạn không có quyền gửi tin nhắn trong phiên trao đổi nội bộ này.");
            }
        }
        else
        {
            if (conv.CustomerId != userId && userRole != "Staff" && userRole != "Admin")
            {
                throw new HubException("Bạn không có quyền gửi tin nhắn trong phiên này.");
            }
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null) throw new HubException("Không tìm thấy người dùng.");

        // Check reply message if specified
        ChatMessage? replyMsg = null;
        if (replyToId.HasValue)
        {
            replyMsg = await _context.ChatMessages
                .Include(m => m.Sender)
                .FirstOrDefaultAsync(m => m.Id == replyToId.Value && m.ConversationId == conversationId);
        }

        var senderRole = conv.Type == "INTERNAL_WORK" ? user.Role : (userRole == "Admin" ? "Staff" : userRole);

        var message = new ChatMessage
        {
            ConversationId = conversationId,
            SenderId = userId,
            SenderRole = senderRole,
            Content = content?.Trim() ?? string.Empty,
            ImageUrl = imageUrl?.Trim(),
            ReplyToMessageId = replyMsg?.Id,
            IsEdited = false,
            IsRevoked = false,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.ChatMessages.Add(message);

        // Update conversation summary
        var previewText = !string.IsNullOrWhiteSpace(content) ? content : "[Tệp đính kèm]";
        conv.LastMessage = previewText;
        conv.LastMessageAt = DateTime.UtcNow;

        if (conv.Type == "INTERNAL_WORK")
        {
            var isCustomer = conv.CustomerId == userId;
            var targetUserId = isCustomer ? conv.StaffId : conv.CustomerId;

            if (isCustomer)
            {
                conv.UnreadStaffCount += 1;
            }
            else
            {
                conv.UnreadCustomerCount += 1;
            }

            await _context.SaveChangesAsync();

            var messageDto = new
            {
                id = message.Id,
                conversationId = message.ConversationId,
                senderId = message.SenderId,
                senderName = user.Name,
                senderRole = message.SenderRole,
                senderAvatar = user.Avatar,
                content = message.Content,
                imageUrl = message.ImageUrl,
                replyTo = replyMsg != null ? new
                {
                    id = replyMsg.Id,
                    senderName = replyMsg.Sender.Name,
                    senderRole = replyMsg.SenderRole,
                    content = replyMsg.IsRevoked ? "Tin nhắn đã được thu hồi" : replyMsg.Content,
                    imageUrl = replyMsg.ImageUrl
                } : null,
                reactions = new object[] { },
                isEdited = false,
                isRevoked = false,
                isRead = false,
                createdAt = message.CreatedAt
            };

            // Broadcast to conversation room
            await Clients.Group($"conversation_{conversationId}").SendAsync("ReceiveMessage", messageDto);

            // Notify staff list channel for realtime queue update
            await Clients.Group("staff_channel").SendAsync("InternalConversationUpdated", new
            {
                conversationId = conv.Id,
                senderId = userId,
                targetUserId = targetUserId,
                lastMessage = conv.LastMessage,
                lastMessageAt = conv.LastMessageAt
            });

            if (targetUserId.HasValue)
            {
                await Clients.Group($"user_{targetUserId.Value}").SendAsync("InternalConversationUpdated", new
                {
                    conversationId = conv.Id,
                    senderId = userId,
                    targetUserId = targetUserId,
                    lastMessage = conv.LastMessage,
                    lastMessageAt = conv.LastMessageAt
                });
            }
        }
        else
        {
            if (userRole == "Customer")
            {
                conv.UnreadStaffCount += 1;
            }
            else
            {
                conv.UnreadCustomerCount += 1;
                if (conv.StaffId == null)
                {
                    conv.StaffId = userId;
                    conv.Staff = user;
                    conv.Status = "ACTIVE";

                    await Clients.Group($"conversation_{conversationId}").SendAsync("StaffClaimed", new
                    {
                        conversationId = conv.Id,
                        staffId = user.Id,
                        staffName = user.Name,
                        staffAvatar = user.Avatar,
                        staff = new
                        {
                            id = user.Id,
                            name = user.Name,
                            avatar = user.Avatar,
                            email = user.Email
                        }
                    });
                }
            }

            await _context.SaveChangesAsync();

            var messageDto = new
            {
                id = message.Id,
                conversationId = message.ConversationId,
                senderId = message.SenderId,
                senderName = user.Name,
                senderRole = message.SenderRole,
                senderAvatar = user.Avatar,
                content = message.Content,
                imageUrl = message.ImageUrl,
                replyTo = replyMsg != null ? new
                {
                    id = replyMsg.Id,
                    senderName = replyMsg.Sender.Name,
                    senderRole = replyMsg.SenderRole,
                    content = replyMsg.IsRevoked ? "Tin nhắn đã được thu hồi" : replyMsg.Content,
                    imageUrl = replyMsg.ImageUrl
                } : null,
                reactions = new object[] { },
                isEdited = false,
                isRevoked = false,
                isRead = false,
                createdAt = message.CreatedAt
            };

            // Broadcast to conversation room
            await Clients.Group($"conversation_{conversationId}").SendAsync("ReceiveMessage", messageDto);

            // Notify staff list channel for realtime queue update
            await Clients.Group("staff_channel").SendAsync("ConversationUpdated", new
            {
                id = conv.Id,
                customerId = conv.CustomerId,
                customerName = conv.Customer.Name,
                customerEmail = conv.Customer.Email,
                customerAvatar = conv.Customer.Avatar,
                staffId = conv.StaffId,
                staffName = conv.Staff?.Name,
                status = conv.Status,
                lastMessage = conv.LastMessage,
                lastMessageAt = conv.LastMessageAt,
                unreadStaffCount = conv.UnreadStaffCount
            });
        }
    }

    // Edit message content
    public async Task EditMessage(int messageId, string newContent)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(newContent))
        {
            throw new HubException("Nội dung tin nhắn không được để trống.");
        }

        var message = await _context.ChatMessages.FindAsync(messageId);
        if (message == null) throw new HubException("Không tìm thấy tin nhắn.");
        if (message.SenderId != userId) throw new HubException("Bạn chỉ có thể chỉnh sửa tin nhắn của chính mình.");
        if (message.IsRevoked) throw new HubException("Không thể chỉnh sửa tin nhắn đã thu hồi.");

        message.Content = newContent.Trim();
        message.IsEdited = true;
        message.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await Clients.Group($"conversation_{message.ConversationId}").SendAsync("MessageEdited", new
        {
            messageId = message.Id,
            conversationId = message.ConversationId,
            newContent = message.Content,
            updatedAt = message.UpdatedAt
        });
    }

    // Revoke (unsend) message
    public async Task RevokeMessage(int messageId)
    {
        var userId = GetUserId();
        var userRole = GetUserRole();

        var message = await _context.ChatMessages.FindAsync(messageId);
        if (message == null) throw new HubException("Không tìm thấy tin nhắn.");

        // Owner or Admin/Staff can revoke
        if (message.SenderId != userId && userRole != "Admin")
        {
            throw new HubException("Bạn không có quyền thu hồi tin nhắn này.");
        }

        message.IsRevoked = true;
        message.Content = "Tin nhắn đã được thu hồi";
        message.ImageUrl = null;
        message.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await Clients.Group($"conversation_{message.ConversationId}").SendAsync("MessageRevoked", new
        {
            messageId = message.Id,
            conversationId = message.ConversationId,
            updatedAt = message.UpdatedAt
        });
    }

    // React with Emoji
    public async Task ReactMessage(int messageId, string emoji)
    {
        var userId = GetUserId();
        var allowedEmojis = new[] { "👍", "❤️", "😆", "😮", "😢", "😡" };

        if (!allowedEmojis.Contains(emoji))
        {
            throw new HubException("Emoji không hợp lệ.");
        }

        var message = await _context.ChatMessages.FindAsync(messageId);
        if (message == null) throw new HubException("Không tìm thấy tin nhắn.");

        var existingReaction = await _context.ChatMessageReactions
            .FirstOrDefaultAsync(r => r.MessageId == messageId && r.UserId == userId);

        if (existingReaction != null)
        {
            if (existingReaction.Emoji == emoji)
            {
                // Clicked same emoji -> remove reaction
                _context.ChatMessageReactions.Remove(existingReaction);
            }
            else
            {
                // Clicked different emoji -> switch emoji
                existingReaction.Emoji = emoji;
                existingReaction.CreatedAt = DateTime.UtcNow;
            }
        }
        else
        {
            _context.ChatMessageReactions.Add(new ChatMessageReaction
            {
                MessageId = messageId,
                UserId = userId,
                Emoji = emoji,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();

        // Query grouped reactions
        var allReactions = await _context.ChatMessageReactions
            .Include(r => r.User)
            .Where(r => r.MessageId == messageId)
            .ToListAsync();

        var reactionGroups = allReactions
            .GroupBy(r => r.Emoji)
            .Select(g => new
            {
                emoji = g.Key,
                count = g.Count(),
                users = g.Select(u => new { id = u.UserId, name = u.User.Name }).ToList(),
                hasReacted = g.Any(u => u.UserId == userId)
            })
            .ToList();

        await Clients.Group($"conversation_{message.ConversationId}").SendAsync("MessageReactionUpdated", new
        {
            messageId = message.Id,
            conversationId = message.ConversationId,
            reactions = reactionGroups
        });
    }

    // Staff accepts / claims a waiting conversation
    public async Task StaffClaim(int conversationId)
    {
        var userId = GetUserId();
        var userRole = GetUserRole();

        if (userRole != "Staff" && userRole != "Admin")
        {
            throw new HubException("Chỉ nhân viên mới có quyền tiếp nhận phiên hỗ trợ.");
        }

        var conv = await _context.ChatConversations
            .Include(c => c.Customer)
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conv == null) throw new HubException("Cuộc trò chuyện không tồn tại.");
        if (conv.Type == "INTERNAL_WORK") throw new HubException("Không thể tiếp nhận phiên trao đổi nội bộ.");

        var staff = await _context.Users.FindAsync(userId);
        if (staff == null) throw new HubException("Không tìm thấy thông tin nhân viên.");

        conv.StaffId = userId;
        conv.Status = "ACTIVE";
        conv.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await Clients.Group($"conversation_{conversationId}").SendAsync("StaffClaimed", new
        {
            conversationId = conv.Id,
            staffId = staff.Id,
            staffName = staff.Name,
            staffAvatar = staff.Avatar,
            staff = new
            {
                id = staff.Id,
                name = staff.Name,
                avatar = staff.Avatar,
                email = staff.Email
            }
        });

        await Clients.Group("staff_channel").SendAsync("ConversationUpdated", new
        {
            id = conv.Id,
            customerId = conv.CustomerId,
            customerName = conv.Customer.Name,
            customerEmail = conv.Customer.Email,
            customerAvatar = conv.Customer.Avatar,
            staffId = conv.StaffId,
            staffName = staff.Name,
            status = conv.Status,
            lastMessage = conv.LastMessage,
            lastMessageAt = conv.LastMessageAt,
            unreadStaffCount = conv.UnreadStaffCount
        });
    }

    // Close conversation
    public async Task CloseConversation(int conversationId)
    {
        var userId = GetUserId();
        var userRole = GetUserRole();

        var conv = await _context.ChatConversations.FindAsync(conversationId);
        if (conv == null) throw new HubException("Cuộc trò chuyện không tồn tại.");

        if (conv.Type == "INTERNAL_WORK")
        {
            throw new HubException("Cuộc trò chuyện nội bộ duy trì xuyên suốt, không thể kết thúc.");
        }

        if (conv.CustomerId != userId && userRole != "Staff" && userRole != "Admin")
        {
            throw new HubException("Bạn không có quyền đóng phiên hỗ trợ này.");
        }

        conv.Status = "CLOSED";
        conv.ClosedAt = DateTime.UtcNow;
        conv.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await Clients.Group($"conversation_{conversationId}").SendAsync("ConversationClosed", new
        {
            conversationId = conv.Id,
            closedAt = conv.ClosedAt
        });

        await Clients.Group("staff_channel").SendAsync("ConversationClosed", new
        {
            conversationId = conv.Id,
            closedAt = conv.ClosedAt
        });
    }
}
