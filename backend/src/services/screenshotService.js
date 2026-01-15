const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Extract trade data from a screenshot using Claude Vision
 * @param {string} imagePath - Path to the image file
 * @returns {Object} Extracted trade data
 */
async function extractTradeData(imagePath) {
  try {
    // Read the image file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // Determine media type from extension
    const ext = path.extname(imagePath).toLowerCase();
    const mediaTypeMap = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };
    const mediaType = mediaTypeMap[ext] || 'image/png';

    const prompt = `Analyze this trading exchange screenshot and extract the OPEN POSITION data.
Look for the positions table (usually at bottom of screen, ignore charts).

Return ONLY valid JSON with these fields:
{
  "exchange": "hyperliquid|variational|binance|unknown",
  "asset": "BTC|ETH|SOL|etc (base asset only, no -PERP suffix)",
  "direction": "long|short (infer from quantity sign or explicit label)",
  "entry_price": number,
  "position_size": number (total position value in USD),
  "collateral": number (margin/collateral in USD),
  "leverage": number (e.g., 10 for 10x),
  "liquidation_price": number,
  "unrealized_pnl": number (can be negative),
  "pnl_percentage": number (can be negative),
  "mark_price": number (current price)
}

If a field is not visible, set to null. Numbers should be raw (no $ or commas).
Return ONLY the JSON object, no markdown formatting or explanation.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    });

    // Parse the response
    const responseText = response.content[0].text;

    // Try to extract JSON from the response
    let extractedData;
    try {
      // First try direct parse
      extractedData = JSON.parse(responseText);
    } catch {
      // Try to find JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse JSON from response');
      }
    }

    logger.info(`Screenshot extracted: ${extractedData.asset} ${extractedData.direction} on ${extractedData.exchange}`);
    return {
      success: true,
      data: extractedData,
      raw_response: responseText
    };

  } catch (error) {
    logger.error('Error extracting trade data from screenshot:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * Map extracted screenshot data to trade database fields
 * @param {Object} extractedData - Data from Claude Vision extraction
 * @returns {Object} Mapped trade fields
 */
function mapToTradeFields(extractedData) {
  return {
    asset: extractedData.asset,
    direction: extractedData.direction,
    entry_price: extractedData.entry_price,
    position_size: extractedData.position_size,
    collateral: extractedData.collateral,
    leverage: extractedData.leverage,
    liquidation_price: extractedData.liquidation_price,
    // Note: pnl fields are for display, not stored on open trade
    _current_pnl: extractedData.unrealized_pnl,
    _current_pnl_percentage: extractedData.pnl_percentage,
    _mark_price: extractedData.mark_price,
    _exchange: extractedData.exchange
  };
}

module.exports = {
  extractTradeData,
  mapToTradeFields
};
