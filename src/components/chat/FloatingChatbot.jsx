import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axiosClient from '../../utils/axiosClient';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/ToastContext';
import signalRService from '../../services/signalrService';
import './FloatingChatbot.css';

const EMOJI_LIST = ['👍', '❤️', '😆', '😮', '😢', '😡'];

const FloatingChatbot = () => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [showPromptBubble, setShowPromptBubble] = useState(false);

  // Mode: 'AI' or 'STAFF'
  const [chatMode, setChatMode] = useState('AI');

  // AI Chat states
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Xin chào! Tôi là trợ lý mua hàng GHT. Tôi có thể giúp gì cho bạn?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Staff Live Chat states
  const [staffConvId, setStaffConvId] = useState(null);
  const [staffConv, setStaffConv] = useState(null);
  const [staffMessages, setStaffMessages] = useState([]);
  const [staffInput, setStaffInput] = useState('');
  const [isStaffSending, setIsStaffSending] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [activeEmojiMsgId, setActiveEmojiMsgId] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  const messagesEndRef = useRef(null);
  const staffMessagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPromptBubble(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // Extract product slug or Id if currently on a detail page (/products/:slug)
  const isProductDetailPage =
    window.location.pathname.startsWith('/products/') &&
    window.location.pathname !== '/products' &&
    window.location.pathname !== '/products/';
  const urlParam = isProductDetailPage ? window.location.pathname.split('/products/')[1]?.split('/')[0] : null;
  const productId = urlParam && !isNaN(urlParam) ? parseInt(urlParam, 10) : null;
  const productSlug = urlParam && isNaN(urlParam) ? urlParam : null;

  const scrollToBottom = () => {
    if (chatMode === 'AI') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      staffMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, staffMessages, chatMode]);

  useEffect(() => {
    const handleOpenChat = (e) => {
      setIsOpen(true);
      if (e?.detail?.message) {
        if (chatMode === 'AI') {
          setInput(e.detail.message);
        } else {
          setStaffInput(e.detail.message);
        }
      }
    };
    window.addEventListener('open-ght-chatbot', handleOpenChat);
    return () => window.removeEventListener('open-ght-chatbot', handleOpenChat);
  }, [chatMode]);

  // Connect to Staff Live Chat session
  const initStaffChat = useCallback(async () => {
    if (!user) {
      toast.warning('Vui lòng đăng nhập để kết nối với nhân viên tư vấn!');
      navigate('/login');
      return;
    }

    setLoadingStaff(true);
    try {
      const res = await axiosClient.post('/chat/request');
      const convId = res.data.conversationId;
      setStaffConvId(convId);

      // Join room in SignalR
      await signalRService.joinConversation(convId);

      // Fetch history
      const hist = await axiosClient.get(`/chat/history/${convId}`);
      setStaffMessages(hist.data.messages || []);
      setStaffConv(hist.data.conversation);
    } catch (err) {
      console.error('Lỗi kết nối phiên tư vấn:', err);
      toast.error(err.response?.data?.message || 'Không thể kết nối với trung tâm hỗ trợ.');
    } finally {
      setLoadingStaff(false);
    }
  }, [user, navigate, toast]);

  // Setup SignalR event listeners for Staff Live Chat
  useEffect(() => {
    if (chatMode !== 'STAFF' || !staffConvId) return;

    const handleReceiveMsg = (msg) => {
      if (msg.conversationId === staffConvId) {
        setStaffMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const handleMsgEdited = (data) => {
      setStaffMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, content: data.newContent, isEdited: true }
            : m
        )
      );
    };

    const handleMsgRevoked = (data) => {
      setStaffMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, content: 'Tin nhắn đã được thu hồi', imageUrl: null, isRevoked: true }
            : m
        )
      );
    };

    const handleMsgReaction = (data) => {
      setStaffMessages((prev) =>
        prev.map((m) => {
          if (m.id !== data.messageId) return m;
          const mapped = data.reactions.map((r) => ({
            ...r,
            hasReacted: r.users?.some((u) => u.id === user?.id)
          }));
          return { ...m, reactions: mapped };
        })
      );
    };

    const handleStaffClaim = (data) => {
      if (data.conversationId === staffConvId) {
        setStaffConv((prev) => ({
          ...prev,
          staffId: data.staffId,
          staffName: data.staffName,
          status: 'ACTIVE'
        }));
        toast.info(`Nhân viên ${data.staffName} đã tiếp nhận hỗ trợ!`);
      }
    };

    const handleConvClosed = (data) => {
      if (data.conversationId === staffConvId) {
        setStaffConv((prev) => ({ ...prev, status: 'CLOSED' }));
        toast.info('Phiên hỗ trợ này đã kết thúc.');
      }
    };

    signalRService.onReceiveMessage(handleReceiveMsg);
    signalRService.onMessageEdited(handleMsgEdited);
    signalRService.onMessageRevoked(handleMsgRevoked);
    signalRService.onMessageReactionUpdated(handleMsgReaction);
    signalRService.onStaffClaimed(handleStaffClaim);
    signalRService.onConversationClosed(handleConvClosed);

    return () => {
      signalRService.offReceiveMessage(handleReceiveMsg);
      signalRService.offMessageEdited(handleMsgEdited);
      signalRService.offMessageRevoked(handleMsgRevoked);
      signalRService.offMessageReactionUpdated(handleMsgReaction);
      signalRService.offStaffClaimed(handleStaffClaim);
      signalRService.offConversationClosed(handleConvClosed);
    };
  }, [chatMode, staffConvId, user?.id, toast]);

  const handleSwitchToStaff = async () => {
    if (!user) {
      toast.warning('Vui lòng đăng nhập để kết nối với nhân viên tư vấn!');
      navigate('/login');
      return;
    }
    setChatMode('STAFF');
    await initStaffChat();
  };

  const handleSwitchToAI = () => {
    setChatMode('AI');
    setReplyingTo(null);
    setEditingMsg(null);
    setSelectedImage(null);
    setImagePreview(null);
  };

  // AI Chat send handler
  const handleSendAI = async (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role === 'ai' ? 'model' : 'user',
        content: m.content
      }));

      const payload = {
        message: userMsg,
        currentUrl: window.location.href,
        currentProductId: productId,
        currentProductSlug: productSlug,
        history: historyPayload
      };

      const res = await axiosClient.post('/ai/chat', payload);
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: res.data.reply,
          products: res.data.products || []
        }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: err.response?.data?.message || 'Trợ lý tạm thời không khả dụng, thử lại sau'
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Staff Live Chat send handler
  const handleSendStaff = async (e) => {
    e.preventDefault();
    if ((!staffInput.trim() && !selectedImage) || isStaffSending) return;

    if (!staffConvId) {
      toast.warning('Phiên trò chuyện chưa sẵn sàng, đang thử kết nối lại...');
      await initStaffChat();
      return;
    }

    if (staffConv?.status === 'CLOSED') {
      toast.warning('Phiên trò chuyện này đã kết thúc. Vui lòng mở lại phiên mới.');
      return;
    }

    setIsStaffSending(true);
    try {
      // 1. If editing existing message
      if (editingMsg) {
        await signalRService.editMessage(editingMsg.id, staffInput.trim());
        setEditingMsg(null);
        setStaffInput('');
        return;
      }

      // 2. Upload image first if attached
      let uploadedUrl = null;
      if (selectedImage) {
        const formData = new FormData();
        formData.append('file', selectedImage);
        const upRes = await axiosClient.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedUrl = upRes.data.url;
      }

      // 3. Send message via SignalR
      await signalRService.sendMessage(
        staffConvId,
        staffInput.trim(),
        uploadedUrl,
        replyingTo?.id || null
      );

      setStaffInput('');
      setSelectedImage(null);
      setImagePreview(null);
      setReplyingTo(null);
    } catch (err) {
      console.error('Lỗi gửi tin nhắn:', err);
      toast.error('Không thể gửi tin nhắn. Vui lòng thử lại!');
    } finally {
      setIsStaffSending(false);
    }
  };

  // Staff image selection handler
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ được chọn tệp hình ảnh (PNG, JPG, WebP...)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 5MB');
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  // Revoke message handler
  const handleRevokeMessage = async (msgId) => {
    if (!window.confirm('Bạn có chắc chắn muốn thu hồi tin nhắn này không?')) return;
    try {
      await signalRService.revokeMessage(msgId);
      toast.success('Đã thu hồi tin nhắn');
    } catch {
      toast.error('Không thể thu hồi tin nhắn');
    }
  };

  // React to message handler
  const handleReactMessage = async (msgId, emoji) => {
    try {
      await signalRService.reactMessage(msgId, emoji);
      setActiveEmojiMsgId(null);
    } catch {
      toast.error('Không thể thả cảm xúc');
    }
  };

  const isAdminOrStaff = user?.role === 'Admin' || user?.role === 'Staff';
  if (isAdminOrStaff) {
    return null; // Don't show floating customer chatbot for Admin/Staff
  }

  return (
    <div className="floating-chatbot">
      {isOpen && (
        <div className={`chatbot-window ${chatMode === 'STAFF' ? 'staff-mode-window' : ''}`}>
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-title">
              {chatMode === 'AI' ? (
                <>
                  <img
                    src="/images/Logo_GHT.png"
                    alt="GHT AI Avatar"
                    className="chatbot-avatar-img"
                  />
                  <div>
                    <span className="chatbot-title-main">Trợ lý GHT</span>
                    <span className="chatbot-title-sub">Tư vấn chọn sản phẩm</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="chatbot-staff-header-avatar">
                    {staffConv?.staffAvatar ? (
                      <img src={staffConv.staffAvatar} alt="Staff" />
                    ) : (
                      <span>💬</span>
                    )}
                  </div>
                  <div>
                    <span className="chatbot-title-main">
                      {staffConv?.staffName ? `${staffConv.staffName} (NV GHT)` : 'Tư vấn trực tuyến'}
                    </span>
                    <span className="chatbot-title-sub">
                      {staffConv?.status === 'ACTIVE'
                        ? 'Đang trực tuyến'
                        : staffConv?.status === 'CLOSED'
                          ? 'Kết thúc phiên'
                          : 'Chờ nhân viên tiếp nhận...'}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="chatbot-header-actions">
              {chatMode === 'AI' ? (
                <button
                  type="button"
                  className="chatbot-mode-switch-btn"
                  onClick={handleSwitchToStaff}
                  title="Gặp nhân viên tư vấn trực tiếp"
                >
                  Gặp nhân viên
                </button>
              ) : (
                <button
                  type="button"
                  className="chatbot-mode-switch-btn back-ai"
                  onClick={handleSwitchToAI}
                  title="Quay lại trợ lý AI"
                >
                  Quay lại AI
                </button>
              )}

              <button
                type="button"
                className="chatbot-header-btn"
                onClick={() => setIsOpen(false)}
                title="Đóng chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* CHAT MODE: AI ASSISTANT */}
          {chatMode === 'AI' && (
            <>
              {/* Messages */}
              <div className="chatbot-messages">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`message-bubble ${msg.role}`}>
                    {msg.role === 'ai' ? (
                      <>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        {msg.products && msg.products.length > 0 && (
                          <div className="chatbot-product-list">
                            {msg.products.map((prod) => (
                              <div
                                key={prod.id}
                                className="chatbot-product-card"
                                onClick={() => {
                                  navigate(`/products/${prod.slug || prod.id}`);
                                  setIsOpen(false);
                                }}
                              >
                                <img
                                  src={prod.image || '/images/premium.png'}
                                  alt={prod.name}
                                  className="chatbot-prod-img"
                                />
                                <div className="chatbot-prod-details">
                                  <span className="chatbot-prod-brand">{prod.brand || 'GHT'}</span>
                                  <h4 className="chatbot-prod-name" title={prod.name}>
                                    {prod.name}
                                  </h4>
                                  <div className="chatbot-prod-price-box">
                                    <span className="chatbot-prod-price">
                                      {Number(prod.price).toLocaleString('vi-VN')} đ
                                    </span>
                                    {prod.originalPrice && prod.originalPrice > prod.price && (
                                      <span className="chatbot-prod-old-price">
                                        {Number(prod.originalPrice).toLocaleString('vi-VN')} đ
                                      </span>
                                    )}
                                  </div>

                                  <div className="chatbot-prod-actions">
                                    <button
                                      type="button"
                                      className="btn-chat-cart"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const ok = await addToCart(
                                          {
                                            id: prod.id,
                                            name: prod.name,
                                            slug: prod.slug,
                                            price: prod.price,
                                            inStock: prod.inStock ? 10 : 0,
                                            images: prod.image ? [prod.image] : []
                                          },
                                          1
                                        );
                                        if (ok) toast.success(`Đã thêm ${prod.name} vào giỏ hàng!`);
                                      }}
                                    >
                                      <i className="ti ti-shopping-cart-plus"></i> Thêm giỏ
                                    </button>

                                    <button
                                      type="button"
                                      className="btn-chat-buy"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await addToCart(
                                          {
                                            id: prod.id,
                                            name: prod.name,
                                            slug: prod.slug,
                                            price: prod.price,
                                            inStock: prod.inStock ? 10 : 0,
                                            images: prod.image ? [prod.image] : []
                                          },
                                          1
                                        );
                                        setIsOpen(false);
                                        navigate('/cart');
                                      }}
                                    >
                                      ⚡ Mua ngay
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      msg.content
                    )}
                  </div>
                ))}
                {isTyping && (
                  <div className="message-bubble ai typing-indicator">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Form */}
              <form className="chatbot-input-form" onSubmit={handleSendAI}>
                <input
                  type="text"
                  className="chatbot-input-field"
                  placeholder="Hỏi trợ lý AI..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isTyping}
                />
                <button
                  type="submit"
                  className="chatbot-send-btn"
                  disabled={!input.trim() || isTyping}
                  title="Gửi"
                >
                  <i className="ti ti-send"></i>
                </button>
              </form>
            </>
          )}

          {/* CHAT MODE: LIVE STAFF MESSENGER */}
          {chatMode === 'STAFF' && (
            <div className="chatbot-staff-container">
              {/* Messages Area */}
              <div className="chatbot-staff-messages">
                {loadingStaff && (
                  <div className="chatbot-staff-loading">
                    <span className="spinner-border-sm"></span> Đang kết nối phiên tư vấn...
                  </div>
                )}

                {!loadingStaff && staffMessages.length === 0 && (
                  <div className="chatbot-staff-empty">
                    <div className="staff-empty-icon">💬</div>
                    <p>Chào bạn! Bạn cần tư vấn hoặc giải đáp thông tin gì về sản phẩm và đơn hàng?</p>
                    <span className="staff-empty-sub">
                      Nhân viên chăm sóc khách hàng GHT sẽ trả lời bạn ngay bây giờ.
                    </span>
                  </div>
                )}

                {staffMessages.map((msg) => {
                  const isCustomerMsg =
                    msg.senderId === user?.id || msg.senderRole === 'Customer';
                  const showEmojiPicker = activeEmojiMsgId === msg.id;

                  return (
                    <div
                      key={msg.id}
                      className={`cust-msg-row ${isCustomerMsg ? 'cust-self' : 'cust-staff'}`}
                    >
                      {/* Avatar for staff */}
                      {!isCustomerMsg && (
                        <div className="cust-msg-avatar" title={msg.senderName}>
                          {msg.senderAvatar ? (
                            <img src={msg.senderAvatar} alt={msg.senderName} />
                          ) : (
                            <span>NV</span>
                          )}
                        </div>
                      )}

                      <div className="cust-msg-bubble-wrap">
                        {/* Sender name for staff messages */}
                        {!isCustomerMsg && (
                          <span className="cust-msg-sender-name">{msg.senderName}</span>
                        )}

                        {/* Reply Quote preview */}
                        {msg.replyTo && (
                          <div className="cust-reply-quote-preview">
                            <span className="cust-reply-quote-name">{msg.replyTo.senderName}:</span>
                            <span className="cust-reply-quote-text">
                              {msg.replyTo.imageUrl && !msg.replyTo.content
                                ? '[Hình ảnh]'
                                : msg.replyTo.content}
                            </span>
                          </div>
                        )}

                        {/* Bubble Content */}
                        <div className={`cust-msg-bubble ${msg.isRevoked ? 'revoked' : ''}`}>
                          {msg.isRevoked ? (
                            <span className="cust-msg-revoked-text">
                              <i className="ti ti-ban"></i> Tin nhắn đã được thu hồi
                            </span>
                          ) : (
                            <>
                              {msg.content && <p className="cust-msg-text">{msg.content}</p>}
                              {msg.imageUrl && (
                                <img
                                  src={msg.imageUrl}
                                  alt="Đính kèm"
                                  className="cust-msg-img"
                                  onClick={() => setLightboxImg(msg.imageUrl)}
                                  title="Bấm để xem ảnh phóng to"
                                />
                              )}
                            </>
                          )}
                        </div>

                        {/* Message Meta & Action Toolbar */}
                        <div className="cust-msg-footer">
                          <span className="cust-msg-time">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {msg.isEdited && <span className="cust-msg-edited"> (đã sửa)</span>}
                          </span>

                          {!msg.isRevoked && (
                            <div className="cust-msg-actions">
                              <button
                                type="button"
                                className="cust-action-btn"
                                onClick={() =>
                                  setActiveEmojiMsgId(showEmojiPicker ? null : msg.id)
                                }
                                title="Thả cảm xúc"
                              >
                                😊
                              </button>

                              <button
                                type="button"
                                className="cust-action-btn"
                                onClick={() => setReplyingTo(msg)}
                                title="Trả lời tin này"
                              >
                                <i className="ti ti-arrow-back-up"></i>
                              </button>

                              {isCustomerMsg && (
                                <>
                                  <button
                                    type="button"
                                    className="cust-action-btn"
                                    onClick={() => {
                                      setEditingMsg(msg);
                                      setStaffInput(msg.content);
                                    }}
                                    title="Chỉnh sửa tin nhắn"
                                  >
                                    <i className="ti ti-edit"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="cust-action-btn delete"
                                    onClick={() => handleRevokeMessage(msg.id)}
                                    title="Thu hồi tin nhắn"
                                  >
                                    <i className="ti ti-trash"></i>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quick Emoji Picker */}
                        {showEmojiPicker && (
                          <div className="cust-emoji-picker">
                            {EMOJI_LIST.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className="cust-emoji-pick-btn"
                                onClick={() => handleReactMessage(msg.id, emoji)}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Reactions Pills */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="cust-reactions-wrap">
                            {msg.reactions.map((r) => (
                              <button
                                key={r.emoji}
                                type="button"
                                className={`cust-reaction-pill ${r.hasReacted ? 'active' : ''}`}
                                onClick={() => handleReactMessage(msg.id, r.emoji)}
                                title={r.users?.map((u) => u.name).join(', ')}
                              >
                                <span>{r.emoji}</span>
                                <span>{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={staffMessagesEndRef} />
              </div>

              {/* Status Warning Banner if closed */}
              {staffConv?.status === 'CLOSED' && (
                <div className="chatbot-staff-closed-banner">
                  <i className="ti ti-lock"></i> Cuộc trò chuyện này đã kết thúc.
                </div>
              )}

              {/* Staff Input Area */}
              {staffConv?.status !== 'CLOSED' && (
                <div className="chatbot-staff-input-wrap">
                  {/* Reply banner */}
                  {replyingTo && (
                    <div className="chatbot-staff-banner-active">
                      <div className="banner-active-content">
                        <span className="banner-title">
                          <i className="ti ti-arrow-back-up"></i> Trả lời {replyingTo.senderName}:
                        </span>
                        <span className="banner-preview">
                          {replyingTo.content || '[Hình ảnh]'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="banner-close-btn"
                        onClick={() => setReplyingTo(null)}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Editing banner */}
                  {editingMsg && (
                    <div className="chatbot-staff-banner-active edit">
                      <div className="banner-active-content">
                        <span className="banner-title">
                          <i className="ti ti-edit"></i> Đang chỉnh sửa tin nhắn
                        </span>
                      </div>
                      <button
                        type="button"
                        className="banner-close-btn"
                        onClick={() => {
                          setEditingMsg(null);
                          setStaffInput('');
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Image attachment preview */}
                  {imagePreview && (
                    <div className="chatbot-staff-banner-active image-preview">
                      <img src={imagePreview} alt="Preview" className="img-attachment-thumb" />
                      <button
                        type="button"
                        className="banner-close-btn"
                        onClick={() => {
                          setSelectedImage(null);
                          setImagePreview(null);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <form className="chatbot-staff-form" onSubmit={handleSendStaff}>
                    {/* Attachment file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      accept="image/*"
                      onChange={handleImageSelect}
                    />

                    <button
                      type="button"
                      className="chatbot-staff-btn-attach"
                      onClick={() => fileInputRef.current?.click()}
                      title="Gửi hình ảnh"
                      disabled={isStaffSending || Boolean(editingMsg)}
                    >
                      <i className="ti ti-paperclip"></i>
                    </button>

                    <input
                      type="text"
                      className="chatbot-staff-input"
                      placeholder={
                        editingMsg
                          ? 'Chỉnh sửa nội dung...'
                          : 'Nhập tin nhắn tư vấn...'
                      }
                      value={staffInput}
                      onChange={(e) => setStaffInput(e.target.value)}
                      disabled={isStaffSending}
                    />

                    <button
                      type="submit"
                      className="chatbot-send-btn"
                      disabled={
                        (!staffInput.trim() && !selectedImage) || isStaffSending
                      }
                      title="Gửi tin nhắn"
                    >
                      {isStaffSending ? (
                        <span className="spinner-border-sm"></span>
                      ) : (
                        <i className="ti ti-send"></i>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lightbox for zooming attached photos */}
      {lightboxImg && (
        <div className="chatbot-lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <div className="chatbot-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImg} alt="Phóng to" className="chatbot-lightbox-img" />
            <button
              type="button"
              className="chatbot-lightbox-close"
              onClick={() => setLightboxImg(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Popup prompt speech bubble */}
      {!isOpen && showPromptBubble && (
        <div
          className="chatbot-prompt-bubble"
          onClick={() => {
            setIsOpen(true);
            setShowPromptBubble(false);
          }}
        >
          <span className="chatbot-prompt-icon">✨</span>
          <span className="chatbot-prompt-text">
            Hãy để tôi tư vấn chọn lựa cùng bạn!
          </span>
          <button
            type="button"
            className="chatbot-prompt-close"
            title="Đóng lời nhắc"
            onClick={(e) => {
              e.stopPropagation();
              setShowPromptBubble(false);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Round floating trigger button */}
      <button
        type="button"
        className="chatbot-toggle"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setShowPromptBubble(false);
        }}
        title="Trợ lý GHT & Tư vấn trực tuyến"
      >
        {isOpen ? (
          <i className="ti ti-x"></i>
        ) : (
          <img
            src="/images/Logo_GHT.png"
            alt="AI & Staff Live Chat"
            className="chatbot-toggle-img"
          />
        )}
      </button>
    </div>
  );
};

export default FloatingChatbot;
