// Intent handlers - connect parsed intents to backend APIs
import { parseIntent, INTENTS } from './intentParser';
import * as fmt from './formatters';

// Use relative path to leverage Vite proxy
const API_BASE = '/api';

/**
 * Make API request with error handling
 */
async function api(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Handle OPEN_TRADE intent
 */
async function handleOpenTrade(data) {
  if (!data.asset) {
    return fmt.formatError("Please specify the asset (e.g., BTC, ETH)");
  }
  if (!data.direction) {
    return fmt.formatError("Please specify direction (long or short)");
  }

  const tradeData = {
    asset: data.asset,
    direction: data.direction,
    entry_price: data.entry_price,
    position_size: data.position_size || 0,
    leverage: data.leverage,
    status: 'open',
    entry_time: new Date().toISOString(),
  };

  const result = await api('/trades', {
    method: 'POST',
    body: JSON.stringify(tradeData),
  });

  return fmt.formatTradeConfirmation(result.data, 'opened');
}

/**
 * Handle CLOSE_TRADE intent
 */
async function handleCloseTrade(data) {
  // Get open trades to find which one to close
  const result = await api('/trades?status=open');
  const openTrades = result.data;

  if (openTrades.length === 0) {
    return fmt.formatError("No open trades to close.");
  }

  let tradeToClose;

  if (data.trade_id) {
    tradeToClose = openTrades.find(t => t.id === data.trade_id);
    if (!tradeToClose) {
      return fmt.formatError(`Trade T${data.trade_id} not found or already closed.`);
    }
  } else if (openTrades.length === 1) {
    tradeToClose = openTrades[0];
  } else {
    // Multiple open trades, need ID
    return fmt.formatError(
      `Multiple open trades. Please specify which one:\n` +
      openTrades.map(t => `- T${t.id}: ${t.asset} ${t.direction}`).join('\n')
    );
  }

  // Calculate PnL
  const exitPrice = data.exit_price || tradeToClose.entry_price;
  const pnl = tradeToClose.direction === 'long'
    ? (exitPrice - tradeToClose.entry_price) * (tradeToClose.position_size / tradeToClose.entry_price)
    : (tradeToClose.entry_price - exitPrice) * (tradeToClose.position_size / tradeToClose.entry_price);

  const pnlPercentage = (pnl / tradeToClose.position_size) * 100;

  const updateData = {
    exit_price: exitPrice,
    exit_time: new Date().toISOString(),
    pnl: pnl,
    pnl_percentage: pnlPercentage,
    status: 'closed',
  };

  const closeResult = await api(`/trades/${tradeToClose.id}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });

  return fmt.formatTradeConfirmation({ ...tradeToClose, ...closeResult.data }, 'closed');
}

/**
 * Handle SHOW_OPEN_TRADES intent
 */
async function handleShowOpenTrades() {
  const result = await api('/trades?status=open');
  return fmt.formatOpenTrades(result.data);
}

/**
 * Handle SHOW_TRADE_HISTORY intent
 */
async function handleShowTradeHistory(data) {
  const limit = data.limit || 10;
  const result = await api(`/trades?status=closed&limit=${limit}`);
  return fmt.formatTradeHistory(result.data, limit);
}

/**
 * Handle SHOW_STATS intent
 */
async function handleShowStats(data) {
  let endpoint = '/stats/overview';

  // Add period filter if specified
  if (data.period && data.period !== 'all') {
    const now = new Date();
    let startDate;

    if (data.period === 'today') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (data.period === 'week') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (data.period === 'month') {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    if (startDate) {
      endpoint += `?from=${startDate.toISOString().split('T')[0]}`;
    }
  }

  const result = await api(endpoint);
  return fmt.formatStats(result.data);
}

/**
 * Handle SHOW_TRADE intent
 */
async function handleShowTrade(data) {
  if (!data.trade_id) {
    return fmt.formatError("Please specify a trade ID (e.g., T1, T2)");
  }

  const result = await api(`/trades/${data.trade_id}`);
  return fmt.formatTrade(result.data);
}

/**
 * Handle ADD_LESSON intent
 */
async function handleAddLesson(data) {
  if (!data.content || data.content.length < 5) {
    return fmt.formatError("Please provide a lesson to save.");
  }

  const lessonData = {
    title: data.content.slice(0, 50) + (data.content.length > 50 ? '...' : ''),
    content: data.content,
    learned_at: new Date().toISOString(),
    status: 'active',
  };

  const result = await api('/lessons', {
    method: 'POST',
    body: JSON.stringify(lessonData),
  });

  return fmt.formatSuccess(`Lesson saved!\n\n"${data.content}"`);
}

/**
 * Handle SHOW_LESSONS intent
 */
async function handleShowLessons(data) {
  const limit = data.limit || 10;
  const result = await api(`/lessons?limit=${limit}`);
  return fmt.formatLessons(result.data);
}

/**
 * Handle SEARCH_LESSONS intent
 */
async function handleSearchLessons(data) {
  const result = await api(`/lessons?search=${encodeURIComponent(data.query)}`);
  const lessons = result.data || [];
  if (lessons.length === 0) {
    return `No lessons found for "${data.query}"`;
  }
  return fmt.formatLessons(lessons);
}

/**
 * Handle SHOW_SETUPS intent
 */
async function handleShowSetups() {
  const result = await api('/config/setups');
  return fmt.formatSetups(result.data);
}

/**
 * Handle SHOW_OUTLOOK intent
 */
async function handleShowOutlook() {
  const result = await api('/trading-days/today');
  return fmt.formatOutlook(result.data);
}

/**
 * Handle ANALYZE_SCREENSHOT intent
 */
async function handleAnalyzeScreenshot(imageFile) {
  if (!imageFile) {
    return fmt.formatError("No screenshot attached. Please paste or upload an image.");
  }

  const formData = new FormData();
  formData.append('file', imageFile);

  const response = await fetch(`${API_BASE}/screenshots/extract`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to analyze screenshot');
  }

  const result = await response.json();
  return fmt.formatExtraction(result.extracted_data);
}

/**
 * Handle LLM_QUERY intent (fallback)
 */
async function handleLLMQuery(data) {
  // For now, return a helpful message
  // This will be connected to the backend LLM endpoint later
  return `I understand you're asking: "${data.query}"\n\n` +
    `Complex analysis queries will be available soon. For now, try:\n` +
    `- "show my open trades"\n` +
    `- "what's my win rate?"\n` +
    `- "open BTC long at 97500"\n` +
    `- "lesson: [your insight]"`;
}

/**
 * Handle unknown intent
 */
function handleUnknown() {
  return `I'm not sure what you mean. Try:\n\n` +
    `**Trades:**\n` +
    `- "open BTC long at 97500"\n` +
    `- "close T1 at 98000"\n` +
    `- "show my open trades"\n` +
    `- "show trade history"\n\n` +
    `**Daily:**\n` +
    `- "what's my outlook for today?"\n` +
    `- "show key levels"\n\n` +
    `**Stats:**\n` +
    `- "what's my win rate?"\n` +
    `- "show my stats"\n\n` +
    `**Lessons:**\n` +
    `- "lesson: don't chase price"\n` +
    `- "show my lessons"\n\n` +
    `**Screenshots:**\n` +
    `- Paste a screenshot to extract trade data`;
}

/**
 * Main entry point - process a message and return response
 */
export async function processMessage(text, imageFile = null) {
  try {
    const hasImage = !!imageFile;
    const { intent, data, confidence } = parseIntent(text, hasImage);

    console.log('Parsed intent:', { intent, data, confidence });

    // Route to appropriate handler
    switch (intent) {
      case INTENTS.OPEN_TRADE:
        return await handleOpenTrade(data);

      case INTENTS.CLOSE_TRADE:
        return await handleCloseTrade(data);

      case INTENTS.SHOW_OPEN_TRADES:
        return await handleShowOpenTrades();

      case INTENTS.SHOW_TRADE_HISTORY:
        return await handleShowTradeHistory(data);

      case INTENTS.SHOW_STATS:
        return await handleShowStats(data);

      case INTENTS.SHOW_TRADE:
        return await handleShowTrade(data);

      case INTENTS.ADD_LESSON:
        return await handleAddLesson(data);

      case INTENTS.SHOW_LESSONS:
        return await handleShowLessons(data);

      case INTENTS.SEARCH_LESSONS:
        return await handleSearchLessons(data);

      case INTENTS.SHOW_SETUPS:
        return await handleShowSetups();

      case INTENTS.SHOW_OUTLOOK:
        return await handleShowOutlook();

      case INTENTS.ANALYZE_SCREENSHOT:
        return await handleAnalyzeScreenshot(imageFile);

      case INTENTS.LLM_QUERY:
        return await handleLLMQuery(data);

      case INTENTS.UNKNOWN:
      default:
        return handleUnknown();
    }
  } catch (error) {
    console.error('Intent handler error:', error);
    return fmt.formatError(error.message || 'Something went wrong. Please try again.');
  }
}

/**
 * Fetch open trades (for status bar)
 */
export async function fetchOpenTrades() {
  try {
    const result = await api('/trades?status=open');
    return result.data || [];
  } catch (error) {
    console.error('Error fetching open trades:', error);
    return [];
  }
}
