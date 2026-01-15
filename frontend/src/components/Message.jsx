import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../styles/message.css';

export function Message({ message }) {
  const { role, content, attachments, timestamp } = message;
  const isUser = role === 'user';

  return (
    <div className={`message ${isUser ? 'message-user' : 'message-assistant'}`}>
      {attachments?.image && (
        <div className="message-image">
          <img src={attachments.image} alt="Attached screenshot" />
        </div>
      )}
      <div className="message-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Custom table styling
            table: ({ children }) => (
              <div className="table-wrapper">
                <table>{children}</table>
              </div>
            ),
            // Custom code block
            code: ({ inline, children, ...props }) => (
              inline
                ? <code className="inline-code" {...props}>{children}</code>
                : <pre className="code-block"><code {...props}>{children}</code></pre>
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      <div className="message-time">
        {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

export default Message;
