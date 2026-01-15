import { useChat } from '../context/ChatContext';
import '../styles/chat.css';

// Detect current session based on UTC time
function getCurrentSession() {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const time = hour + minute / 60;

  if (time >= 14.5 && time < 16) return 'NY Open';
  if (time >= 12 && time < 14.5) return 'Pre-NY';
  if (time >= 7 && time < 12) return 'London';
  if (time >= 0 && time < 7) return 'Asia';
  if (time >= 16 && time < 21) return 'NY Session';
  return 'After Hours';
}

export function StatusBar() {
  const { openTrades } = useChat();
  const session = getCurrentSession();

  const totalPnl = openTrades.reduce((sum, t) => sum + (t.unrealized_pnl || 0), 0);

  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="status-label">Session</span>
        <span className="status-value">{session}</span>
      </div>

      <div className="status-item">
        <span className="status-label">Open</span>
        <span className="status-value">{openTrades.length} trade{openTrades.length !== 1 ? 's' : ''}</span>
      </div>

      {openTrades.length > 0 && (
        <div className="status-item">
          <span className="status-label">Unrealized</span>
          <span className={`status-value ${totalPnl >= 0 ? 'positive' : 'negative'}`}>
            ${totalPnl.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

export default StatusBar;
