// Intent handlers - connect parsed intents to backend APIs
import * as fmt from './formatters';

// Use relative path to leverage Vite proxy
const API_BASE = '/api';

// Store last suggestions for numbered selection
let lastSuggestions = [];

// Intent constants (matching backend)
const INTENTS = {
  OPEN_TRADE: 'open_trade',
  CLOSE_TRADE: 'close_trade',
  UPDATE_TRADE: 'update_trade',
  SHOW_OPEN_TRADES: 'show_open_trades',
  SHOW_TRADE_HISTORY: 'show_trade_history',
  SHOW_STATS: 'show_stats',
  SHOW_TRADE: 'show_trade',
  ADD_LESSON: 'add_lesson',
  SHOW_LESSONS: 'show_lessons',
  SEARCH_LESSONS: 'search_lessons',
  ANALYZE_SCREENSHOT: 'analyze_screenshot',
  SHOW_SETUPS: 'show_setups',
  SHOW_OUTLOOK: 'show_outlook',
  LLM_QUERY: 'llm_query',
  UNKNOWN: 'unknown'
};

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
  return fmt.formatSetups(result.data.setups);
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
 * Handle LLM_QUERY intent (fallback) - be helpful and suggest options
 */
async function handleLLMQuery(data) {
  const query = (data.query || '').toLowerCase();

  // Try to understand what category they might be asking about
  let suggestions = [];
  let context = '';

  // Check for trade-related keywords
  if (/\b(trade|position|entry|exit|buy|sell|long|short)\b/.test(query)) {
    context = "It sounds like you're asking about trades.";
    suggestions = [
      { cmd: 'show open trades', desc: 'see your current positions' },
      { cmd: 'trade history', desc: 'see your past trades' },
      { cmd: 'open BTC long at 97500', desc: 'enter a new trade' },
      { cmd: 'close T1 at 98000', desc: 'close an existing trade' }
    ];
  }
  // Check for performance/stats keywords
  else if (/\b(performance|stats|win|loss|profit|pnl|how.*(doing|am i))\b/.test(query)) {
    context = "It sounds like you want to check your performance.";
    suggestions = [
      { cmd: 'show stats', desc: 'see overall statistics' },
      { cmd: 'win rate', desc: 'check your win rate' },
      { cmd: 'trade history', desc: 'review past trades' }
    ];
  }
  // Check for planning/outlook keywords
  else if (/\b(plan|outlook|today|tomorrow|bias|level|setup)\b/.test(query)) {
    context = "It sounds like you're asking about your trading plan.";
    suggestions = [
      { cmd: 'outlook', desc: "see today's trading plan" },
      { cmd: 'key levels', desc: 'view important price levels' },
      { cmd: 'show setups', desc: 'see available setup types' }
    ];
  }
  // Check for lesson/learning keywords
  else if (/\b(lesson|learn|remember|note|insight)\b/.test(query)) {
    context = "It sounds like you want to work with lessons.";
    suggestions = [
      { cmd: 'show lessons', desc: 'see saved lessons' },
      { cmd: 'lesson: [your insight]', desc: 'save a new lesson' },
      { cmd: 'lessons about FOMO', desc: 'search for specific lessons' }
    ];
  }
  // Generic helpful response
  else {
    context = "I'm not sure what you're looking for, but I can help with:";
    suggestions = [
      { cmd: 'open trades', desc: 'see current positions' },
      { cmd: 'outlook', desc: "today's trading plan" },
      { cmd: 'stats', desc: 'your performance' },
      { cmd: 'show lessons', desc: 'see saved lessons' }
    ];
  }

  // Store suggestions for numbered selection
  lastSuggestions = suggestions.map(s => s.cmd);

  let response = `${context}\n\nDid you mean one of these?\n`;
  suggestions.forEach((s, i) => {
    response += `**${i + 1}.** "${s.cmd}" - ${s.desc}\n`;
  });
  response += `\nType a number (1-${suggestions.length}) or rephrase your question!`;

  return response;
}

/**
 * Handle unknown intent - same as LLM query
 */
function handleUnknown(text = '') {
  return handleLLMQuery({ query: text });
}

/**
 * Parse intent using LLM backend
 */
async function parseIntentLLM(message, hasImage) {
  try {
    const response = await fetch(`${API_BASE}/chat/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, hasImage })
    });

    if (!response.ok) {
      throw new Error('Failed to parse intent');
    }

    return await response.json();
  } catch (error) {
    console.error('LLM parse error:', error);
    // Return fallback
    return { intent: 'llm_query', data: { query: message }, confidence: 0.3 };
  }
}

/**
 * Main entry point - process a message and return response
 */
export async function processMessage(text, imageFile = null) {
  try {
    // Check if user typed a number to select from suggestions
    const trimmed = (text || '').trim();
    if (/^[1-4]$/.test(trimmed) && lastSuggestions.length > 0) {
      const index = parseInt(trimmed) - 1;
      if (index < lastSuggestions.length) {
        const selectedCmd = lastSuggestions[index];
        console.log(`User selected option ${trimmed}: "${selectedCmd}"`);
        // Clear suggestions and process the selected command
        lastSuggestions = [];
        return processMessage(selectedCmd, imageFile);
      }
    }

    // Clear suggestions on new query (not a number selection)
    lastSuggestions = [];

    const hasImage = !!imageFile;
    const { intent, data, confidence } = await parseIntentLLM(text, hasImage);

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
        return handleUnknown(text);
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
