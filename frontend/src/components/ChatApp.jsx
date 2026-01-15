import { useCallback } from 'react';
import { ChatProvider, useChat } from '../context/ChatContext';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import StatusBar from './StatusBar';
import { processMessage } from '../services/intentHandlers';
import '../styles/chat.css';

function ChatContainer() {
  const { addMessage, setLoading, refreshOpenTrades } = useChat();

  const handleSend = useCallback(async (text, image) => {
    // Add user message
    addMessage('user', text || '(screenshot)', image ? { image: image.preview } : null);

    setLoading(true);

    try {
      // Process the message through intent system
      const response = await processMessage(text, image?.file);

      // Add assistant response
      addMessage('assistant', response);

      // Refresh open trades if trade-related action
      if (text.toLowerCase().includes('open') ||
          text.toLowerCase().includes('close') ||
          image) {
        refreshOpenTrades();
      }
    } catch (error) {
      console.error('Error processing message:', error);
      addMessage('assistant', `Error: ${error.message || 'Something went wrong. Please try again.'}`);
    } finally {
      setLoading(false);
    }
  }, [addMessage, setLoading, refreshOpenTrades]);

  return (
    <div className="chat-app">
      <StatusBar />
      <MessageList />
      <ChatInput onSend={handleSend} />
    </div>
  );
}

export function ChatApp() {
  return (
    <ChatProvider>
      <ChatContainer />
    </ChatProvider>
  );
}

export default ChatApp;
