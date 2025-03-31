import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import MarkdownBlock from '../common/MarkdownBlock'; // Import MarkdownBlock
import './ChatView.css';

// Add navigateTo prop type based on App.tsx
interface ChatViewProps {
  navigateTo: (view: 'welcome' | 'chat' | 'settings' | 'mcpSettings') => void;
}

const ChatView = ({ navigateTo }: ChatViewProps) => { // Add navigateTo prop
  const { messages, addMessage, isLoading, isExecutingTool } = useAppContext();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: input,
      timestamp: Date.now(),
    };

    addMessage(newMessage);
    setInput('');
  };

  const renderMessageContent = (content: string | any[]) => {
    // If content is a simple string, wrap it in MarkdownBlock
    if (typeof content === 'string') {
      return <MarkdownBlock markdown={content} />;
    }

    // If content is an array of blocks
    return content.map((block, index) => {
      if (block.type === 'text') {
        // Use MarkdownBlock for text blocks
        return <MarkdownBlock key={index} markdown={block.content} />;
      }
      if (block.type === 'tool_use') {
        // Keep tool_use rendering as is for now
        return (
          <div key={index} className="message-tool-use">
            <div className="tool-name">{block.tool_name}</div>
            <pre className="tool-params">{JSON.stringify(block.tool_params, null, 2)}</pre>
          </div>
        );
      }
      if (block.type === 'tool_result') {
        return (
          <div key={index} className="message-tool-result">
            <pre>{block.content}</pre>
          </div>
        );
      }
      if (block.type === 'image') {
        return <img key={index} src={block.content} alt="Content" className="message-image" />;
      }
      return null;
    });
  };

  return (
    <div className="chat-view">
      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-header">
              <div className="message-role">{message.role}</div>
              <div className="message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
            <div className="message-content">
              {renderMessageContent(message.content)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="message-input-form" onSubmit={handleSubmit}>
        <textarea
          className="message-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your task or question..."
          disabled={isLoading || isExecutingTool}
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={isLoading || isExecutingTool || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatView;
