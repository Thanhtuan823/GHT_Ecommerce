import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axiosClient from '../../utils/axiosClient';
import { useCart } from '../../context/CartContext';
import { useToast } from '../common/ToastContext';
import './FloatingChatbot.css';

const FloatingChatbot = () => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [showPromptBubble, setShowPromptBubble] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Xin chào! Tôi là trợ lý mua hàng GHT. Tôi có thể giúp gì cho bạn?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPromptBubble(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // Extract product slug or Id if currently on a detail page (/products/:slug)
  const isProductDetailPage = window.location.pathname.startsWith('/products/') && 
                              window.location.pathname !== '/products' && 
                              window.location.pathname !== '/products/';
  const urlParam = isProductDetailPage ? window.location.pathname.split('/products/')[1]?.split('/')[0] : null;
  const productId = urlParam && !isNaN(urlParam) ? parseInt(urlParam, 10) : null;
  const productSlug = urlParam && isNaN(urlParam) ? urlParam : null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    const handleOpenChat = (e) => {
      setIsOpen(true);
      if (e?.detail?.message) {
        setInput(e.detail.message);
      }
    };
    window.addEventListener('open-ght-chatbot', handleOpenChat);
    return () => window.removeEventListener('open-ght-chatbot', handleOpenChat);
  }, []);

  const handleSend = async (e) => {
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

  return (
    <div className="floating-chatbot">
      {isOpen && (
        <div className="chatbot-window">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-title">
              <img
                src="/images/logo_GHT_tron.jpg"
                alt="GHT AI Avatar"
                className="chatbot-avatar-img"
              />
              <div>
                <span className="chatbot-title-main">Trợ lý GHT</span>
                <span className="chatbot-title-sub">Tư vấn chọn sản phẩm</span>
              </div>
            </div>
          </div>

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
                              <h4 className="chatbot-prod-name" title={prod.name}>{prod.name}</h4>
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
                                    const ok = await addToCart({
                                      id: prod.id,
                                      name: prod.name,
                                      slug: prod.slug,
                                      price: prod.price,
                                      inStock: prod.inStock ? 10 : 0,
                                      images: prod.image ? [prod.image] : []
                                    }, 1);
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
                                    await addToCart({
                                      id: prod.id,
                                      name: prod.name,
                                      slug: prod.slug,
                                      price: prod.price,
                                      inStock: prod.inStock ? 10 : 0,
                                      images: prod.image ? [prod.image] : []
                                    }, 1);
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
          <form className="chatbot-input-form" onSubmit={handleSend}>
            <input
              type="text"
              className="chatbot-input-field"
              placeholder="Nhập câu hỏi..."
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
        </div>
      )}

      {/* Popup bong bóng lời thoại chào mời tư vấn */}
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
              e.stopPropagation(); // Ngăn mở chat khi chỉ muốn tắt bóng thoại
              setShowPromptBubble(false);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Nút bấm tròn mở/đóng Chatbot */}
      <button
        type="button"
        className="chatbot-toggle"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setShowPromptBubble(false);
        }}
        title="Trợ lý AI"
      >
        {isOpen ? (
          <i className="ti ti-x"></i>
        ) : (
          <img
            src="/images/logo_GHT_tron.jpg"
            alt="AI Assistant"
            className="chatbot-toggle-img"
          />
        )}
      </button>
    </div>
  );
};

export default FloatingChatbot;

