import { useState, useEffect, useRef, useCallback } from 'react';
import axiosClient from '../../utils/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastContext';
import signalRService from '../../services/signalrService';
import './StaffChat.css';

const EMOJI_LIST = ['👍', '❤️', '😆', '😮', '😢', '😡'];

export default function StaffChat() {
  const { user } = useAuth();
  const toast = useToast();

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [filterTab, setFilterTab] = useState('ALL'); // ALL, WAITING, ACTIVE, CLOSED
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Form input state
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [activeEmojiPickerMsgId, setActiveEmojiPickerMsgId] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeConvIdRef = useRef(activeConvId);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Fetch conversations list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await axiosClient.get('/chat/staff/conversations');
      setConversations(res.data.data || []);
      if (!activeConvId && res.data.data?.length > 0) {
        setActiveConvId(res.data.data[0].id);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách hội thoại:', err);
    }
  }, [activeConvId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 2. Fetch history when activeConvId changes
  const fetchHistory = useCallback(async (convId) => {
    if (!convId) return;
    setLoading(true);
    try {
      const res = await axiosClient.get(`/chat/history/${convId}`);
      const convData = res.data.conversation;
      setActiveConv(convData);
      setMessages(res.data.messages || []);

      // Tự động gán Staff ngầm khi click vào hội thoại đang WAITING
      if (convData?.status === 'WAITING') {
        signalRService.staffClaim(convId).catch(() => {});
        setActiveConv((prev) =>
          prev
            ? {
                ...prev,
                status: 'ACTIVE',
                staffId: user?.id,
                staffName: user?.name
              }
            : prev
        );
        setConversations((prev) =>
          prev.map((c) =>
            Number(c.id) === Number(convId)
              ? {
                  ...c,
                  status: 'ACTIVE',
                  staffId: user?.id,
                  staffName: user?.name
                }
              : c
          )
        );
      }

      // Join room in SignalR (khối try/catch độc lập để không phá vỡ việc hiển thị lịch sử)
      try {
        await signalRService.joinConversation(convId);
      } catch (hubErr) {
        console.warn('Lỗi tham gia phòng chat SignalR:', hubErr);
      }

      // Reset unread count locally
      setConversations((prev) =>
        prev.map((c) => (Number(c.id) === Number(convId) ? { ...c, unreadStaffCount: 0 } : c))
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể tải lịch sử trò chuyện');
    } finally {
      setLoading(false);
    }
  }, [toast, user?.id, user?.name]);

  useEffect(() => {
    if (activeConvId) {
      fetchHistory(activeConvId);
    }
    return () => {
      if (activeConvId) {
        signalRService.leaveConversation(activeConvId);
      }
    };
  }, [activeConvId]);

  // 3. Setup SignalR global listeners
  useEffect(() => {
    const handleReceive = (msg) => {
      if (Number(msg.conversationId) === Number(activeConvIdRef.current)) {
        setMessages((prev) => {
          // Tránh duplicate nếu tin nhắn đã tồn tại
          if (prev.some((m) => m.id === msg.id)) return prev;

          // Thay thế tin nhắn tạm (optimistic message) nếu có
          const tempIdx = prev.findIndex(
            (m) =>
              typeof m.id === 'string' &&
              m.id.startsWith('temp-') &&
              Number(m.senderId) === Number(msg.senderId) &&
              m.content === msg.content
          );
          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = msg;
            return next;
          }

          return [...prev, msg];
        });

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }

      // Cập nhật danh sách hội thoại cột trái: đưa cuộc hội thoại lên đầu
      setConversations((prev) => {
        const target = prev.find((c) => Number(c.id) === Number(msg.conversationId));
        if (!target) return prev;
        const updated = {
          ...target,
          lastMessage: msg.content || '[Hình ảnh]',
          lastMessageAt: msg.createdAt,
          unreadStaffCount:
            Number(msg.conversationId) === Number(activeConvIdRef.current)
              ? 0
              : (target.unreadStaffCount || 0) + 1
        };
        return [updated, ...prev.filter((c) => Number(c.id) !== Number(msg.conversationId))];
      });
    };

    const handleEdited = (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, content: data.newContent, isEdited: true, updatedAt: data.updatedAt }
            : m
        )
      );
    };

    const handleRevoked = (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? {
                ...m,
                isRevoked: true,
                content: 'Tin nhắn đã được thu hồi',
                imageUrl: null,
                updatedAt: data.updatedAt
              }
            : m
        )
      );
    };

    const handleReaction = (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, reactions: data.reactions } : m
        )
      );
    };

    const handleStaffClaimed = (data) => {
      if (Number(activeConvIdRef.current) === Number(data.conversationId)) {
        setActiveConv((prev) => ({
          ...prev,
          status: 'ACTIVE',
          staffId: data.staff?.id || data.staffId,
          staffName: data.staff?.name || data.staffName,
          staffAvatar: data.staff?.avatar || data.staffAvatar
        }));
      }
      setConversations((prev) =>
        prev.map((c) =>
          Number(c.id) === Number(data.conversationId)
            ? {
                ...c,
                status: 'ACTIVE',
                staffId: data.staff?.id || data.staffId,
                staffName: data.staff?.name || data.staffName
              }
            : c
        )
      );
    };

    const handleConvClosed = (data) => {
      if (Number(activeConvIdRef.current) === Number(data.conversationId)) {
        setActiveConv((prev) => {
          if (prev && prev.status !== 'CLOSED') {
            toast.info('Phiên tư vấn đã kết thúc');
          }
          return prev ? { ...prev, status: 'CLOSED', closedAt: data.closedAt } : prev;
        });
      }
      setConversations((prev) =>
        prev.map((c) =>
          Number(c.id) === Number(data.conversationId) ? { ...c, status: 'CLOSED' } : c
        )
      );
    };

    const handleConvUpdated = (updatedConv) => {
      setConversations((prev) => {
        const exists = prev.some((c) => Number(c.id) === Number(updatedConv.id));
        if (exists) {
          return prev.map((c) =>
            Number(c.id) === Number(updatedConv.id) ? { ...c, ...updatedConv } : c
          );
        }
        return [updatedConv, ...prev];
      });
    };

    const initSignalR = async () => {
      try {
        await signalRService.startConnection();
        signalRService.onReceiveMessage(handleReceive);
        signalRService.onMessageEdited(handleEdited);
        signalRService.onMessageRevoked(handleRevoked);
        signalRService.onMessageReactionUpdated(handleReaction);
        signalRService.onStaffClaimed(handleStaffClaimed);
        signalRService.onConversationClosed(handleConvClosed);
        signalRService.onConversationUpdated(handleConvUpdated);
      } catch (err) {
        console.warn('SignalR start error:', err);
      }
    };

    initSignalR();

    return () => {
      signalRService.offReceiveMessage(handleReceive);
      signalRService.offMessageEdited(handleEdited);
      signalRService.offMessageRevoked(handleRevoked);
      signalRService.offMessageReactionUpdated(handleReaction);
      signalRService.offStaffClaimed(handleStaffClaimed);
      signalRService.offConversationClosed(handleConvClosed);
      signalRService.offConversationUpdated(handleConvUpdated);
      signalRService.stopConnection();
    };
  }, []);

  // 4. Send message handler
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage) || !activeConvId || isSending) return;

    const messageContent = input.trim();
    const currentReplying = replyingTo;
    const tempId = `temp-${Date.now()}`;
    const localPreviewUrl = imagePreview;
    setIsSending(true);

    let uploadedImageUrl = null;

    try {
      // If there's an image to upload first
      if (selectedImage) {
        const formData = new FormData();
        formData.append('file', selectedImage);
        const res = await axiosClient.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedImageUrl = res.data?.url;
      }

      // Optimistic update: Append tin nhắn mới vào mảng messages ngay lập tức
      const optimisticMsg = {
        id: tempId,
        conversationId: activeConvId,
        senderId: user?.id,
        senderName: user?.name || 'Nhân sự',
        senderRole: 'Staff',
        senderAvatar: user?.avatar,
        content: messageContent,
        imageUrl: uploadedImageUrl || localPreviewUrl,
        replyTo: currentReplying
          ? {
              id: currentReplying.id,
              senderName: currentReplying.senderName,
              senderRole: currentReplying.senderRole,
              content: currentReplying.isRevoked
                ? 'Tin nhắn đã được thu hồi'
                : currentReplying.content,
              imageUrl: currentReplying.imageUrl
            }
          : null,
        reactions: [],
        isEdited: false,
        isRevoked: false,
        isRead: false,
        createdAt: new Date().toISOString()
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setInput('');
      setSelectedImage(null);
      setImagePreview(null);
      setReplyingTo(null);
      if (fileInputRef.current) fileInputRef.current.value = null;

      // Tự động cuộn khung chat xuống đáy
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);

      // Cập nhật danh sách hội thoại cột trái: đưa cuộc hội thoại vừa chat lên vị trí đầu tiên
      setConversations((prev) => {
        const currentConv = prev.find((c) => Number(c.id) === Number(activeConvId));
        if (!currentConv) return prev;
        const updated = {
          ...currentConv,
          status: 'ACTIVE',
          lastMessage: optimisticMsg.content || '[Hình ảnh]',
          lastMessageAt: optimisticMsg.createdAt,
          unreadStaffCount: 0
        };
        return [updated, ...prev.filter((c) => Number(c.id) !== Number(activeConvId))];
      });

      // Tự động chuyển activeConv sang ACTIVE
      if (activeConv?.status === 'WAITING') {
        setActiveConv((prev) =>
          prev
            ? {
                ...prev,
                status: 'ACTIVE',
                staffId: user?.id,
                staffName: user?.name
              }
            : prev
        );
      }

      await signalRService.sendMessage(
        activeConvId,
        messageContent,
        uploadedImageUrl,
        currentReplying ? currentReplying.id : null
      );
    } catch (err) {
      toast.error(err.message || 'Lỗi gửi tin nhắn');
      // Gỡ bỏ tin nhắn tạm nếu gửi thất bại
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  // Image select handler
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 5MB');
      return;
    }
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Edit message submit
  const handleSaveEdit = async () => {
    if (!editingMsg || !editingMsg.newContent.trim()) return;
    try {
      await signalRService.editMessage(editingMsg.id, editingMsg.newContent.trim());
      setEditingMsg(null);
      toast.success('Đã cập nhật tin nhắn');
    } catch (err) {
      toast.error(err.message || 'Lỗi sửa tin nhắn');
    }
  };

  // Revoke message handler
  const handleRevoke = async (msgId) => {
    if (!window.confirm('Bạn có chắc muốn thu hồi tin nhắn này?')) return;
    try {
      await signalRService.revokeMessage(msgId);
      toast.info('Đã thu hồi tin nhắn');
    } catch (err) {
      toast.error(err.message || 'Lỗi thu hồi tin nhắn');
    }
  };

  // React emoji handler
  const handleReact = async (msgId, emoji) => {
    setActiveEmojiPickerMsgId(null);
    try {
      await signalRService.reactMessage(msgId, emoji);
    } catch (err) {
      toast.error(err.message || 'Lỗi thả emoji');
    }
  };



  // Close Conversation
  const handleClose = async () => {
    if (!activeConvId) return;
    try {
      await signalRService.closeConversation(activeConvId);
      setActiveConv((prev) => (prev ? { ...prev, status: 'CLOSED', closedAt: new Date().toISOString() } : prev));
      setConversations((prev) =>
        prev.map((c) =>
          Number(c.id) === Number(activeConvId) ? { ...c, status: 'CLOSED' } : c
        )
      );
      toast.info('Đã kết thúc phiên tư vấn');
    } catch (err) {
      toast.error(err.message || 'Lỗi kết thúc phiên');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'KH';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Filtered conversations
  const filteredConversations = conversations.filter((c) => {
    if (filterTab !== 'ALL' && c.status !== filterTab) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = c.customerName?.toLowerCase().includes(q);
      const matchEmail = c.customerEmail?.toLowerCase().includes(q);
      if (!matchName && !matchEmail) return false;
    }
    return true;
  });

  return (
    <div className="staff-chat-page">
      {/* 1. LEFT SIDEBAR: CONVERSATIONS */}
      <div className="staff-chat-sidebar">
        <div className="staff-chat-side-header">
          <h2 className="staff-chat-side-title">
            <i className="ti ti-messages"></i> Tư vấn Trực tuyến
          </h2>
          <div className="staff-chat-filter-tabs">
            {['ALL', 'WAITING', 'ACTIVE', 'CLOSED'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={`staff-chat-tab-btn ${filterTab === tab ? 'active' : ''}`}
                onClick={() => setFilterTab(tab)}
              >
                {tab === 'ALL'
                  ? 'Tất cả'
                  : tab === 'WAITING'
                  ? 'Chờ nhận'
                  : tab === 'ACTIVE'
                  ? 'Đang chat'
                  : 'Đã đóng'}
              </button>
            ))}
          </div>
        </div>

        <div className="staff-chat-search-wrap">
          <i className="ti ti-search staff-chat-search-icon"></i>
          <input
            type="text"
            className="staff-chat-search-input"
            placeholder="Tìm theo tên, email khách hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="staff-chat-conversations-list">
          {filteredConversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: '13px' }}>
              Không tìm thấy cuộc trò chuyện nào
            </div>
          ) : (
            filteredConversations.map((c) => (
              <div
                key={c.id}
                className={`staff-chat-conv-item ${activeConvId === c.id ? 'active' : ''}`}
                onClick={() => setActiveConvId(c.id)}
              >
                <div className="staff-chat-conv-avatar">
                  {c.customerAvatar ? (
                    <img src={c.customerAvatar} alt={c.customerName} />
                  ) : (
                    <span>{getInitials(c.customerName || c.customerEmail)}</span>
                  )}
                </div>

                <div className="staff-chat-conv-info">
                  <div className="staff-chat-conv-top">
                    <span className="staff-chat-conv-name">{c.customerName || c.customerEmail}</span>
                    <span className="staff-chat-conv-time">{formatTime(c.lastMessageAt || c.createdAt)}</span>
                  </div>
                  <div className="staff-chat-conv-bottom">
                    <span className="staff-chat-conv-snippet">{c.lastMessage || 'Bắt đầu cuộc trò chuyện'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className={`staff-chat-status-pill ${c.status?.toLowerCase()}`}>
                        {c.status === 'WAITING' ? 'Chờ' : c.status === 'ACTIVE' ? 'Chat' : 'Đóng'}
                      </span>
                      {c.unreadStaffCount > 0 && (
                        <span className="staff-chat-unread-badge">{c.unreadStaffCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. RIGHT PANEL: CHAT WINDOW */}
      <div className="staff-chat-main">
        {!activeConv ? (
          <div className="staff-chat-empty-state">
            <i className="ti ti-message-circle"></i>
            <p>Chọn một cuộc trò chuyện từ danh sách bên trái để bắt đầu tư vấn</p>
          </div>
        ) : (
          <>
            {/* Topbar */}
            <div className="staff-chat-header">
              <div className="staff-chat-user-meta">
                <div className="staff-chat-user-header-avatar">
                  {activeConv.customerAvatar ? (
                    <img src={activeConv.customerAvatar} alt={activeConv.customerName} />
                  ) : (
                    <span>{getInitials(activeConv.customerName)}</span>
                  )}
                </div>
                <div>
                  <div className="staff-chat-user-header-name">
                    {activeConv.customerName || 'Khách hàng'}
                  </div>
                  <div className="staff-chat-user-header-sub">
                    <span>{activeConv.customerEmail}</span>
                    {activeConv.customerPhone && <span>• {activeConv.customerPhone}</span>}
                    <span>
                      •{' '}
                      <strong style={{ color: activeConv.status === 'CLOSED' ? '#d97706' : '#16a34a' }}>
                        {activeConv.status === 'CLOSED'
                          ? 'Đã kết thúc'
                          : `Đang phục vụ (${activeConv.staffName || user?.name || 'Bạn'})`}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="staff-chat-actions-header">
                {activeConv.status !== 'CLOSED' && (
                  <button type="button" className="staff-chat-btn-close" onClick={handleClose}>
                    <i className="ti ti-lock"></i> Kết thúc phiên
                  </button>
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div className="staff-chat-messages-area">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                  Đang tải tin nhắn...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>
                  Chưa có tin nhắn nào trong cuộc trò chuyện này. Hãy gửi lời chào đầu tiên!
                </div>
              ) : (
                messages.map((m) => {
                  const isStaff = m.senderRole === 'Staff';
                  const isMine = m.senderId === user?.id;

                  return (
                    <div
                      key={m.id}
                      className={`staff-chat-msg-row ${isStaff ? 'staff' : 'customer'}`}
                    >
                      {!isStaff && (
                        <div className="staff-chat-msg-avatar" title={m.senderName}>
                          {m.senderAvatar ? (
                            <img src={m.senderAvatar} alt={m.senderName} />
                          ) : (
                            <span>{getInitials(m.senderName)}</span>
                          )}
                        </div>
                      )}

                      <div className="staff-chat-msg-bubble-wrap">
                        {/* Reply reference */}
                        {m.replyTo && (
                          <div className="staff-chat-reply-quote">
                            <span className="staff-chat-reply-quote-name">{m.replyTo.senderName}:</span>{' '}
                            {m.replyTo.content || '[Hình ảnh]'}
                          </div>
                        )}

                        {/* Message content */}
                        <div className={`staff-chat-bubble ${m.isRevoked ? 'revoked' : ''}`}>
                          {m.imageUrl && !m.isRevoked && (
                            <img
                              src={m.imageUrl.startsWith('http') ? m.imageUrl : `http://localhost:5000${m.imageUrl}`}
                              alt="Đính kèm"
                              className="staff-chat-bubble-img"
                              onClick={() => setLightboxImg(m.imageUrl)}
                            />
                          )}

                          {m.content && <div>{m.content}</div>}
                        </div>

                        {/* Meta info (timestamp + edited) */}
                        <div className="staff-chat-msg-meta">
                          <span>{formatTime(m.createdAt)}</span>
                          {m.isEdited && !m.isRevoked && <span>(đã sửa)</span>}
                        </div>

                        {/* Reactions List */}
                        {m.reactions && m.reactions.length > 0 && (
                          <div className="staff-chat-reactions-wrap">
                            {m.reactions.map((r, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className={`staff-chat-reaction-pill ${r.hasReacted ? 'reacted' : ''}`}
                                onClick={() => handleReact(m.id, r.emoji)}
                                title={r.users.map((u) => u.name).join(', ')}
                              >
                                <span>{r.emoji}</span>
                                <span>{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Hover Quick Actions */}
                        {!m.isRevoked && (
                          <div className="staff-chat-msg-toolbar">
                            <button
                              type="button"
                              className="staff-chat-tool-btn"
                              title="Thả cảm xúc"
                              onClick={() =>
                                setActiveEmojiPickerMsgId(
                                  activeEmojiPickerMsgId === m.id ? null : m.id
                                )
                              }
                            >
                              <i className="ti ti-mood-smile"></i>
                            </button>

                            <button
                              type="button"
                              className="staff-chat-tool-btn"
                              title="Trả lời"
                              onClick={() => setReplyingTo(m)}
                            >
                              <i className="ti ti-arrow-back-up"></i>
                            </button>

                            {isMine && (
                              <>
                                <button
                                  type="button"
                                  className="staff-chat-tool-btn"
                                  title="Chỉnh sửa"
                                  onClick={() =>
                                    setEditingMsg({ id: m.id, newContent: m.content })
                                  }
                                >
                                  <i className="ti ti-pencil"></i>
                                </button>
                                <button
                                  type="button"
                                  className="staff-chat-tool-btn"
                                  title="Thu hồi tin nhắn"
                                  onClick={() => handleRevoke(m.id)}
                                >
                                  <i className="ti ti-trash"></i>
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Emoji Picker Popup */}
                        {activeEmojiPickerMsgId === m.id && (
                          <div className="staff-chat-emoji-picker">
                            {EMOJI_LIST.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className="staff-chat-emoji-pick-btn"
                                onClick={() => handleReact(m.id, emoji)}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {isStaff && (
                        <div className="staff-chat-msg-avatar" title={m.senderName}>
                          {m.senderAvatar ? (
                            <img src={m.senderAvatar} alt={m.senderName} />
                          ) : (
                            <span>{getInitials(m.senderName)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form Footer */}
            <div className="staff-chat-footer-wrap">
              {/* Replying banner */}
              {replyingTo && (
                <div className="staff-chat-preview-banner">
                  <span>
                    Đang trả lời <strong>{replyingTo.senderName}</strong>: "
                    {replyingTo.content || '[Hình ảnh]'}"
                  </span>
                  <button
                    type="button"
                    className="staff-chat-preview-close"
                    onClick={() => setReplyingTo(null)}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Image preview banner */}
              {imagePreview && (
                <div className="staff-chat-preview-banner">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover' }}
                    />
                    <span>Ảnh đã chọn: {selectedImage?.name}</span>
                  </div>
                  <button
                    type="button"
                    className="staff-chat-preview-close"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = null;
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <form className="staff-chat-input-form" onSubmit={handleSendMessage}>
                <label className="staff-chat-attach-btn" title="Đính kèm ảnh">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleImageChange}
                    disabled={activeConv.status === 'CLOSED'}
                  />
                  <i className="ti ti-paperclip"></i>
                </label>

                <input
                  type="text"
                  className="staff-chat-input-field"
                  placeholder={
                    activeConv.status === 'CLOSED'
                      ? 'Phiên tư vấn đã kết thúc, không thể gửi thêm tin nhắn'
                      : 'Nhập nội dung tin nhắn tư vấn...'
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={activeConv.status === 'CLOSED' || isSending}
                />

                <button
                  type="submit"
                  className="staff-chat-send-btn"
                  disabled={(!input.trim() && !selectedImage) || activeConv.status === 'CLOSED' || isSending}
                >
                  <i className="ti ti-send"></i> Gửi
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Edit Message Inline Modal */}
      {editingMsg && (
        <div className="chat-lightbox-overlay" onClick={() => setEditingMsg(null)}>
          <div
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '12px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700 }}>Chỉnh sửa tin nhắn</h4>
            <textarea
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                minHeight: '80px',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
              value={editingMsg.newContent}
              onChange={(e) => setEditingMsg({ ...editingMsg, newContent: e.target.value })}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditingMsg(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveEdit}
                disabled={!editingMsg.newContent.trim()}
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImg && (
        <div className="chat-lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <button type="button" className="chat-lightbox-close" onClick={() => setLightboxImg(null)}>
            ✕
          </button>
          <img
            src={lightboxImg.startsWith('http') ? lightboxImg : `http://localhost:5000${lightboxImg}`}
            alt="Enlarged"
            className="chat-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
