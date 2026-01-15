import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../context/ChatContext';
import '../styles/chat.css';

export function ChatInput({ onSend }) {
  const [text, setText] = useState('');
  const { isLoading, pendingImage, setImage, clearImage } = useChat();
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();

          const reader = new FileReader();
          reader.onload = () => {
            setImage({
              file,
              preview: reader.result,
              type: item.type
            });
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [setImage]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [text]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage({
          file,
          preview: reader.result,
          type: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = useCallback(() => {
    if ((!text.trim() && !pendingImage) || isLoading) return;

    onSend(text.trim(), pendingImage);
    setText('');
    clearImage();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, pendingImage, isLoading, onSend, clearImage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-input-container">
      {pendingImage && (
        <div className="image-preview">
          <img src={pendingImage.preview} alt="Preview" />
          <button
            className="remove-image"
            onClick={clearImage}
            aria-label="Remove image"
          >
            X
          </button>
        </div>
      )}

      <div className="input-row">
        <button
          className="upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          title="Upload screenshot"
        >
          +
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message or paste a screenshot..."
          disabled={isLoading}
          rows={1}
        />

        <button
          className="send-btn"
          onClick={handleSend}
          disabled={isLoading || (!text.trim() && !pendingImage)}
        >
          {isLoading ? '...' : 'Send'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          hidden
        />
      </div>
    </div>
  );
}

export default ChatInput;
