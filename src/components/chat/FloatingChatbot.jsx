import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axiosClient from '../../utils/axiosClient';
import { useAuth } from '../../context/AuthContext';
import './FloatingChatbot.css';

const FloatingChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Xin chào! Tôi là trợ lý mua hàng GHT. Tôi có thể giúp gì cho bạn?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Lấy productId nếu đang ở trang chi tiết
  const productId = window.location.pathname.includes('/products/') 
    ? parseInt(window.location.pathname.split('/').pop()) 
    : null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const payload = {
        message: userMsg,
        currentUrl: window.location.href,
        currentProductId: isNaN(productId) ? null : productId
      };

      const res = await axiosClient.post('/ai/chat', payload);
      setMessages(prev => [...prev, { role: 'ai', content: res.data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: err.response?.data?.message || 'Trợ lý tạm thời không khả dụng, thử lại sau' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="floating-chatbot">
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ti-sparkles" style={{ fontSize: '20px' }}></span>
              <span style={{ fontWeight: '600', fontSize: '15px' }}>Trợ lý GHT</span>
            </div>
            <button className="btn-close" onClick={() => setIsOpen(false)}>&times;</button>
          </div>
          
          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-bubble ${msg.role}`}>
                {msg.role === 'ai' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            ))}
            {isTyping && (
              <div className="message-bubble ai typing">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form className="chatbot-input-form" onSubmit={handleSend}>
            <input 
              type="text" 
              placeholder="Nhập câu hỏi..." 
              value={input} 
              onChange={e => setInput(e.target.value)}
              disabled={isTyping}
            />
            <button type="submit" disabled={!input.trim() || isTyping}>
              <span className="ti-location-arrow"></span>
            </button>
          </form>
        </div>
      )}

      <button className="chatbot-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <span className="ti-close"></span> : <span className="ti-sparkles"></span>}
      </button>
    </div>
  );
};

export default FloatingChatbot;
