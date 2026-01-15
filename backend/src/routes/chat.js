const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

// Initialize Anthropic client
const anthropic = new Anthropic();

// Available intents with descriptions
const INTENT_SCHEMA = `
You are an intent parser for a trading journal application. Parse the user's message and return a JSON object with the intent and extracted data.

AVAILABLE INTENTS:

1. "open_trade" - User wants to open/enter a new trade
   Data: { asset: string, direction: "long"|"short", entry_price?: number, position_size?: number, leverage?: number }
   Examples: "open BTC long at 97500", "bought ETH", "entered a short on SOL"

2. "close_trade" - User wants to close/exit a trade
   Data: { trade_id?: number, exit_price?: number }
   Examples: "close T1 at 98000", "closed my BTC trade", "exited at 95k"

3. "show_open_trades" - User wants to see current open positions
   Data: {}
   Examples: "show open trades", "what am I holding?", "my positions", "open trades?"

4. "show_trade_history" - User wants to see past closed trades
   Data: { limit?: number }
   Examples: "trade history", "last 5 trades", "recent trades"

5. "show_stats" - User wants to see trading statistics/performance
   Data: { period?: "today"|"week"|"month"|"all" }
   Examples: "what's my win rate?", "show stats", "how am I doing?", "performance this week"

6. "show_trade" - User wants details on a specific trade
   Data: { trade_id: number }
   Examples: "show T1", "details for trade 5", "T3 info"

7. "add_lesson" - User wants to save a trading lesson/insight
   Data: { content: string }
   Examples: "lesson: don't chase price", "remember: wait for confirmation", "note to self: size down when anxious"

8. "show_lessons" - User wants to see saved lessons
   Data: { limit?: number }
   Examples: "show my lessons", "what have I learned?", "lessons"

9. "search_lessons" - User wants to find specific lessons
   Data: { query: string }
   Examples: "lessons about FOMO", "find lessons on breakouts"

10. "show_setups" - User wants to see available trading setups
    Data: {}
    Examples: "show setups", "available setups", "what setups do I have?"

11. "show_outlook" - User wants to see daily trading outlook/plan
    Data: {}
    Examples: "daily outlook", "outlook?", "what's my plan today?", "today's bias", "key levels"

12. "analyze_screenshot" - User wants to analyze a trading screenshot (when image attached)
    Data: {}
    Examples: "analyze this", "extract trade data", "what's in this screenshot?"

13. "llm_query" - Complex analysis question that needs AI reasoning
    Data: { query: string }
    Examples: "why do I keep losing on breakouts?", "what setups work best for me?", "analyze my trading patterns"

14. "unknown" - Cannot determine intent
    Data: {}

PARSING RULES:
- Asset codes: BTC, ETH, SOL, etc. Expand "bitcoin" to BTC, "ethereum" to ETH
- Direction: "long"/"buy"/"bought" = long, "short"/"sell"/"sold" = short
- Price: Parse "97.5k" as 97500, remove $ and commas
- Trade IDs: "T1", "trade 1", "#1" all mean trade_id: 1
- Be generous with matching - "outlook?" should match "show_outlook", "stats?" should match "show_stats"
- If the user asks a complex analytical question, use "llm_query"

RESPOND WITH ONLY valid JSON in this format:
{
  "intent": "intent_name",
  "data": { ... },
  "confidence": 0.0-1.0
}
`;

/**
 * POST /api/chat/parse
 * Parse user message into intent using LLM
 */
router.post('/chat/parse', async (req, res) => {
  try {
    const { message, hasImage } = req.body;

    if (!message && !hasImage) {
      return res.status(400).json({
        error: 'Message or image required'
      });
    }

    // If only image, default to analyze
    if (!message && hasImage) {
      return res.json({
        intent: 'analyze_screenshot',
        data: {},
        confidence: 0.9
      });
    }

    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
      logger.warn('ANTHROPIC_API_KEY not configured, using fallback parsing');
      return res.json(fallbackParse(message));
    }

    // Call Claude to parse intent
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: INTENT_SCHEMA,
      messages: [
        {
          role: 'user',
          content: `Parse this message: "${message}"${hasImage ? ' (user has attached an image)' : ''}`
        }
      ]
    });

    // Extract JSON from response
    const text = response.content[0].text;
    let parsed;

    try {
      // Try to parse the entire response as JSON
      parsed = JSON.parse(text);
    } catch {
      // Try to extract JSON from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try to find JSON object in the text
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch) {
          parsed = JSON.parse(objMatch[0]);
        } else {
          throw new Error('Could not parse LLM response as JSON');
        }
      }
    }

    logger.info(`Parsed intent: ${parsed.intent} (confidence: ${parsed.confidence})`);

    res.json(parsed);

  } catch (error) {
    logger.error('Chat parse error:', error);

    // Return fallback on error
    res.json(fallbackParse(req.body.message));
  }
});

/**
 * Simple fallback parser when LLM is unavailable
 */
function fallbackParse(message) {
  if (!message) {
    return { intent: 'unknown', data: {}, confidence: 0 };
  }

  const lower = message.toLowerCase();

  // Simple keyword matching as fallback
  if (/\b(open|buy|bought|long|short|enter)\b/i.test(lower)) {
    return { intent: 'open_trade', data: {}, confidence: 0.5 };
  }
  if (/\bclose|exit|sold\b/i.test(lower)) {
    return { intent: 'close_trade', data: {}, confidence: 0.5 };
  }
  if (/\bopen\s+(trades?|positions?)\b/i.test(lower)) {
    return { intent: 'show_open_trades', data: {}, confidence: 0.7 };
  }
  if (/\bhistory|past\s+trades?\b/i.test(lower)) {
    return { intent: 'show_trade_history', data: {}, confidence: 0.7 };
  }
  if (/\b(stats?|win\s*rate|performance|pnl|p&l)\b/i.test(lower)) {
    return { intent: 'show_stats', data: {}, confidence: 0.7 };
  }
  if (/\b(outlook|plans?|bias|levels?)\b/i.test(lower)) {
    return { intent: 'show_outlook', data: {}, confidence: 0.7 };
  }
  // "setups/plans for today/later" = daily outlook
  if (/\b(setups?|plans?)\s+(for|today|later|planned)\b/i.test(lower)) {
    return { intent: 'show_outlook', data: {}, confidence: 0.7 };
  }
  if (/\b(lesson|learned?|remember|note)\b/i.test(lower)) {
    if (/\bshow|list|my\b/i.test(lower)) {
      return { intent: 'show_lessons', data: {}, confidence: 0.6 };
    }
    return { intent: 'add_lesson', data: { content: message }, confidence: 0.6 };
  }
  if (/\b(show|available|list|my)?\s*setups?\b/i.test(lower)) {
    return { intent: 'show_setups', data: {}, confidence: 0.7 };
  }

  return { intent: 'llm_query', data: { query: message }, confidence: 0.5 };
}

module.exports = router;
