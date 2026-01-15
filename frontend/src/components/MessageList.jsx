import { useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import Message from './Message';
import '../styles/chat.css';

export function MessageList() {
  const { messages, isLoading } = useChat();
  const bottomRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="message-list">
      {messages.length === 0 && (
        <div className="empty-state">
          <h2>Trading Journal</h2>
          <p>Start by typing a message. Try:</p>
          <ul>
            <li>"show my open trades"</li>
            <li>"what's my win rate?"</li>
            <li>"open BTC long at 97500"</li>
            <li>"add lesson: wait for confirmation"</li>
          </ul>
        </div>
      )}

      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}

      {isLoading && (
        <div className="message message-assistant loading">
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

export default MessageList;
