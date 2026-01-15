// Rule-based intent parser for trading journal commands
// Falls back to LLM for complex queries

const INTENTS = {
  // Trade actions
  OPEN_TRADE: 'open_trade',
  CLOSE_TRADE: 'close_trade',
  UPDATE_TRADE: 'update_trade',

  // Queries
  SHOW_OPEN_TRADES: 'show_open_trades',
  SHOW_TRADE_HISTORY: 'show_trade_history',
  SHOW_STATS: 'show_stats',
  SHOW_TRADE: 'show_trade',

  // Lessons
  ADD_LESSON: 'add_lesson',
  SHOW_LESSONS: 'show_lessons',
  SEARCH_LESSONS: 'search_lessons',

  // Screenshots
  ANALYZE_SCREENSHOT: 'analyze_screenshot',

  // Config
  SHOW_SETUPS: 'show_setups',
  ADD_SETUP: 'add_setup',

  // Fallback
  LLM_QUERY: 'llm_query',
  UNKNOWN: 'unknown'
};

// Asset aliases
const ASSET_ALIASES = {
  'bitcoin': 'BTC',
  'btc': 'BTC',
  'ethereum': 'ETH',
  'eth': 'ETH',
  'solana': 'SOL',
  'sol': 'SOL',
};

// Direction aliases
const DIRECTION_ALIASES = {
  'long': 'long',
  'buy': 'long',
  'bought': 'long',
  'short': 'short',
  'sell': 'short',
  'sold': 'short',
};

// Parse numbers from text (handles k suffix)
function parseNumber(str) {
  if (!str) return null;
  str = str.toLowerCase().replace(/,/g, '').replace(/\$/g, '');
  if (str.endsWith('k')) {
    return parseFloat(str) * 1000;
  }
  return parseFloat(str);
}

// Extract asset from text
function extractAsset(text) {
  const lower = text.toLowerCase();

  // Check aliases first
  for (const [alias, asset] of Object.entries(ASSET_ALIASES)) {
    if (lower.includes(alias)) return asset;
  }

  // Match common patterns like "BTC-PERP", "BTCUSDT", etc
  const assetMatch = text.match(/\b([A-Z]{2,5})(?:-?PERP|-?USDT?|-?USD)?\b/i);
  if (assetMatch) {
    return assetMatch[1].toUpperCase();
  }

  return null;
}

// Extract direction from text
function extractDirection(text) {
  const lower = text.toLowerCase();
  for (const [alias, direction] of Object.entries(DIRECTION_ALIASES)) {
    if (lower.includes(alias)) return direction;
  }
  return null;
}

// Extract price from text
function extractPrice(text, keyword = 'at') {
  // Match "at 97500" or "at $97,500" or "at 97.5k"
  const priceRegex = new RegExp(`${keyword}\\s*\\$?([\\d,]+\\.?\\d*k?)`, 'i');
  const match = text.match(priceRegex);
  if (match) return parseNumber(match[1]);

  // Fallback: any number that looks like a price (> 100)
  const numbers = text.match(/\$?([\d,]+\.?\d*k?)/g);
  if (numbers) {
    for (const num of numbers) {
      const parsed = parseNumber(num);
      if (parsed > 100) return parsed;
    }
  }

  return null;
}

// Extract trade ID from text (T1, T2, trade 1, etc)
function extractTradeId(text) {
  // Match T1, T2, etc
  const tMatch = text.match(/\bT(\d+)\b/i);
  if (tMatch) return parseInt(tMatch[1]);

  // Match "trade 1", "trade #1"
  const tradeMatch = text.match(/trade\s*#?(\d+)/i);
  if (tradeMatch) return parseInt(tradeMatch[1]);

  return null;
}

// Extract size/amount from text
function extractSize(text) {
  // Match "$1000", "1k", "5000 usd", etc
  const sizeMatch = text.match(/\$?([\d,]+\.?\d*k?)\s*(?:usd|usdt|usdc|dollars?)?(?:\s+(?:size|position))?/i);
  if (sizeMatch) {
    const size = parseNumber(sizeMatch[1]);
    if (size && size < 1000000) return size; // Sanity check
  }
  return null;
}

// Extract leverage from text
function extractLeverage(text) {
  const levMatch = text.match(/(\d+)x/i);
  if (levMatch) return parseInt(levMatch[1]);
  return null;
}

// Intent patterns with matchers
const PATTERNS = [
  // Open trade patterns
  {
    intent: INTENTS.OPEN_TRADE,
    patterns: [
      /\b(open|enter|buy|long|short|bought|sold)\b/i,
      /\bnew trade\b/i,
      /\bopened?\s+(?:a\s+)?(?:new\s+)?(long|short)/i,
    ],
    extract: (text) => ({
      asset: extractAsset(text),
      direction: extractDirection(text),
      entry_price: extractPrice(text, 'at') || extractPrice(text, 'entry'),
      position_size: extractSize(text),
      leverage: extractLeverage(text),
    }),
    validate: (data) => data.asset && data.direction,
  },

  // Close trade patterns
  {
    intent: INTENTS.CLOSE_TRADE,
    patterns: [
      /\b(close|closed|exit|exited|tp|sl|stopped)\b.*\b(trade|position|T\d+)/i,
      /\bclose\s+(T\d+|trade\s*#?\d+)/i,
      /\b(T\d+|trade\s*#?\d+)\s+(?:hit\s+)?(tp|sl|stopped|closed)/i,
    ],
    extract: (text) => ({
      trade_id: extractTradeId(text),
      exit_price: extractPrice(text, 'at') || extractPrice(text, 'exit'),
      pnl: (() => {
        const pnlMatch = text.match(/[+-]?\$?([\d,]+\.?\d*)/);
        return pnlMatch ? parseNumber(pnlMatch[1]) : null;
      })(),
    }),
    validate: (data) => data.trade_id || data.exit_price,
  },

  // Show open trades
  {
    intent: INTENTS.SHOW_OPEN_TRADES,
    patterns: [
      /\b(show|list|get|what(?:'s| is| are)?|display)\s+(?:my\s+)?open\s+(?:trades?|positions?)/i,
      /\bopen\s+(?:trades?|positions?)\b/i,
      /\bcurrent\s+(?:trades?|positions?)\b/i,
      /\bwhat(?:'s| am i)?\s+(?:in|holding|trading)/i,
    ],
    extract: () => ({}),
    validate: () => true,
  },

  // Show trade history
  {
    intent: INTENTS.SHOW_TRADE_HISTORY,
    patterns: [
      /\b(show|list|get|display)\s+(?:my\s+)?(?:trade\s+)?history/i,
      /\b(show|list|get|display)\s+(?:my\s+)?(?:past|closed|recent)\s+trades?/i,
      /\blast\s+(\d+)?\s*trades?/i,
      /\brecent\s+trades?\b/i,
    ],
    extract: (text) => {
      const limitMatch = text.match(/last\s+(\d+)/i);
      return { limit: limitMatch ? parseInt(limitMatch[1]) : 10 };
    },
    validate: () => true,
  },

  // Show stats
  {
    intent: INTENTS.SHOW_STATS,
    patterns: [
      /\b(show|get|what(?:'s| is| are)?)\s+(?:my\s+)?(?:stats?|statistics?|performance|metrics?)/i,
      /\bwin\s*rate\b/i,
      /\bpnl\b/i,
      /\bp&l\b/i,
      /\bhow\s+(?:am i|did i)\s+(?:doing|perform)/i,
      /\boverall\s+(?:stats?|performance)\b/i,
    ],
    extract: (text) => {
      // Check for time filters
      const today = text.match(/\btoday\b/i);
      const week = text.match(/\b(?:this\s+)?week\b/i);
      const month = text.match(/\b(?:this\s+)?month\b/i);
      return {
        period: today ? 'today' : week ? 'week' : month ? 'month' : 'all',
      };
    },
    validate: () => true,
  },

  // Show specific trade
  {
    intent: INTENTS.SHOW_TRADE,
    patterns: [
      /\bshow\s+(?:me\s+)?(?:trade\s+)?#?(\d+)\b/i,
      /\bT(\d+)\s+(?:details?|info)\b/i,
      /\bdetails?\s+(?:for\s+)?(?:trade\s+)?#?(\d+)\b/i,
    ],
    extract: (text) => ({ trade_id: extractTradeId(text) }),
    validate: (data) => data.trade_id,
  },

  // Add lesson
  {
    intent: INTENTS.ADD_LESSON,
    patterns: [
      /\b(?:add|save|create|new)\s+(?:a\s+)?lesson\b/i,
      /\blesson\s*:\s*/i,
      /\blearned?\s*:\s*/i,
      /\bnote\s+to\s+self\b/i,
      /\bremember\s*:\s*/i,
    ],
    extract: (text) => {
      // Extract the lesson content after the keyword
      const contentMatch = text.match(/(?:lesson|learned?|note to self|remember)\s*:?\s*(.+)/i);
      return { content: contentMatch ? contentMatch[1].trim() : text };
    },
    validate: (data) => data.content && data.content.length > 3,
  },

  // Show lessons
  {
    intent: INTENTS.SHOW_LESSONS,
    patterns: [
      /\b(show|list|get|display)\s+(?:my\s+)?lessons?\b/i,
      /\bwhat\s+(?:have i|did i)\s+learn/i,
      /\bmy\s+lessons?\b/i,
    ],
    extract: (text) => {
      const limitMatch = text.match(/last\s+(\d+)/i);
      return { limit: limitMatch ? parseInt(limitMatch[1]) : 10 };
    },
    validate: () => true,
  },

  // Search lessons
  {
    intent: INTENTS.SEARCH_LESSONS,
    patterns: [
      /\b(?:search|find)\s+lessons?\s+(?:about|for|on)\s+(.+)/i,
      /\blessons?\s+(?:about|for|on)\s+(.+)/i,
    ],
    extract: (text) => {
      const searchMatch = text.match(/(?:about|for|on)\s+(.+)/i);
      return { query: searchMatch ? searchMatch[1].trim() : '' };
    },
    validate: (data) => data.query && data.query.length > 2,
  },

  // Show setups
  {
    intent: INTENTS.SHOW_SETUPS,
    patterns: [
      /\b(show|list|get|display)\s+(?:my\s+)?setups?\b/i,
      /\bwhat\s+setups?\b/i,
      /\bavailable\s+setups?\b/i,
    ],
    extract: () => ({}),
    validate: () => true,
  },

  // Analyze screenshot (when image is attached)
  {
    intent: INTENTS.ANALYZE_SCREENSHOT,
    patterns: [
      /\b(analyze|extract|read|parse)\s+(?:this\s+)?(?:screenshot|image|chart)/i,
    ],
    extract: () => ({}),
    validate: () => true,
    requiresImage: true,
  },
];

// Complex queries that should go to LLM
const LLM_TRIGGERS = [
  /\bwhy\s+did\s+i\b/i,
  /\bwhat\s+(?:setups?|patterns?)\s+work\b/i,
  /\bwhen\s+(?:do i|should i)\b/i,
  /\banalyze\s+my\b/i,
  /\bcompare\b/i,
  /\bcorrelation\b/i,
  /\bpattern\b/i,
  /\btrend\s+in\s+my\b/i,
  /\badvice\b/i,
  /\bsuggest\b/i,
  /\bhelp\s+me\s+understand\b/i,
];

/**
 * Parse user input and determine intent
 * @param {string} text - User input text
 * @param {boolean} hasImage - Whether an image is attached
 * @returns {{ intent: string, data: object, confidence: number }}
 */
export function parseIntent(text, hasImage = false) {
  if (!text || text.trim().length === 0) {
    if (hasImage) {
      return {
        intent: INTENTS.ANALYZE_SCREENSHOT,
        data: {},
        confidence: 0.9,
      };
    }
    return { intent: INTENTS.UNKNOWN, data: {}, confidence: 0 };
  }

  const normalizedText = text.trim();

  // Check if this should go to LLM
  for (const trigger of LLM_TRIGGERS) {
    if (trigger.test(normalizedText)) {
      return {
        intent: INTENTS.LLM_QUERY,
        data: { query: normalizedText },
        confidence: 0.8,
      };
    }
  }

  // Try each pattern
  for (const pattern of PATTERNS) {
    // Skip image-only patterns if no image
    if (pattern.requiresImage && !hasImage) continue;

    for (const regex of pattern.patterns) {
      if (regex.test(normalizedText)) {
        const data = pattern.extract(normalizedText);

        if (pattern.validate(data)) {
          return {
            intent: pattern.intent,
            data,
            confidence: 0.9,
          };
        }
      }
    }
  }

  // Screenshot without specific command
  if (hasImage) {
    return {
      intent: INTENTS.ANALYZE_SCREENSHOT,
      data: { text: normalizedText },
      confidence: 0.8,
    };
  }

  // Default to LLM for unmatched queries
  return {
    intent: INTENTS.LLM_QUERY,
    data: { query: normalizedText },
    confidence: 0.5,
  };
}

export { INTENTS };
