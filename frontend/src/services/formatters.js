// Response formatters for markdown output

/**
 * Format a number as currency
 */
export function formatCurrency(value, showSign = false) {
  if (value == null) return '-';
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Format a percentage
 */
export function formatPercent(value, showSign = false) {
  if (value == null) return '-';
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Format a date for display
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format a single trade as markdown
 */
export function formatTrade(trade) {
  const direction = trade.direction === 'long' ? '🟢 Long' : '🔴 Short';
  const pnl = trade.pnl != null
    ? `${formatCurrency(trade.pnl, true)} (${formatPercent(trade.pnl_percentage, true)})`
    : 'Open';

  return `
## ${trade.asset} ${direction}

| Field | Value |
|-------|-------|
| Entry | ${formatCurrency(trade.entry_price)} |
| Size | ${formatCurrency(trade.position_size)} |
| Leverage | ${trade.leverage || '-'}x |
| Setup | ${trade.setup || '-'} |
| Session | ${trade.session || '-'} |
| Status | ${trade.status} |
| P&L | ${pnl} |
| Opened | ${formatDate(trade.entry_time)} |
${trade.exit_time ? `| Closed | ${formatDate(trade.exit_time)} |` : ''}
${trade.notes ? `\n**Notes:** ${trade.notes}` : ''}
`.trim();
}

/**
 * Format open trades as a markdown table
 */
export function formatOpenTrades(trades) {
  if (!trades || trades.length === 0) {
    return "No open trades right now.";
  }

  let md = `## Open Trades (${trades.length})\n\n`;
  md += "| # | Asset | Dir | Entry | Size | uPnL |\n";
  md += "|---|-------|-----|-------|------|------|\n";

  trades.forEach((trade, i) => {
    const dir = trade.direction === 'long' ? '🟢' : '🔴';
    const pnl = trade.unrealized_pnl != null
      ? formatCurrency(trade.unrealized_pnl, true)
      : '-';

    md += `| T${trade.id} | ${trade.asset} | ${dir} | ${formatCurrency(trade.entry_price)} | ${formatCurrency(trade.position_size)} | ${pnl} |\n`;
  });

  const totalPnl = trades.reduce((sum, t) => sum + (t.unrealized_pnl || 0), 0);
  md += `\n**Total Unrealized:** ${formatCurrency(totalPnl, true)}`;

  return md;
}

/**
 * Format trade history as a markdown table
 */
export function formatTradeHistory(trades, limit = 10) {
  if (!trades || trades.length === 0) {
    return "No trade history found.";
  }

  const shown = trades.slice(0, limit);
  let md = `## Recent Trades (${shown.length}/${trades.length})\n\n`;
  md += "| # | Asset | Dir | Entry | Exit | P&L | Date |\n";
  md += "|---|-------|-----|-------|------|-----|------|\n";

  shown.forEach(trade => {
    const dir = trade.direction === 'long' ? '🟢' : '🔴';
    const pnl = trade.pnl != null
      ? formatCurrency(trade.pnl, true)
      : '-';
    const pnlClass = trade.pnl > 0 ? '✅' : trade.pnl < 0 ? '❌' : '';

    md += `| ${trade.id} | ${trade.asset} | ${dir} | ${formatCurrency(trade.entry_price)} | ${formatCurrency(trade.exit_price)} | ${pnl} ${pnlClass} | ${formatDate(trade.exit_time || trade.entry_time)} |\n`;
  });

  return md;
}

/**
 * Format trading stats as markdown
 */
export function formatStats(stats) {
  if (!stats) {
    return "No stats available yet. Start trading to see your performance!";
  }

  const winRate = stats.total_trades > 0
    ? ((stats.winning_trades / stats.total_trades) * 100).toFixed(1)
    : 0;

  let md = `## Trading Statistics\n\n`;
  md += "| Metric | Value |\n";
  md += "|--------|-------|\n";
  md += `| Total Trades | ${stats.total_trades || 0} |\n`;
  md += `| Win Rate | ${winRate}% |\n`;
  md += `| Wins / Losses | ${stats.winning_trades || 0} / ${stats.losing_trades || 0} |\n`;
  md += `| Total P&L | ${formatCurrency(stats.total_pnl, true)} |\n`;
  md += `| Avg Win | ${formatCurrency(stats.avg_win)} |\n`;
  md += `| Avg Loss | ${formatCurrency(stats.avg_loss)} |\n`;
  md += `| Best Trade | ${formatCurrency(stats.best_trade, true)} |\n`;
  md += `| Worst Trade | ${formatCurrency(stats.worst_trade, true)} |\n`;

  if (stats.profit_factor) {
    md += `| Profit Factor | ${stats.profit_factor.toFixed(2)} |\n`;
  }

  return md;
}

/**
 * Format a lesson as markdown
 */
export function formatLesson(lesson) {
  const status = {
    active: '✅',
    validated: '🎯',
    invalidated: '⚠️',
    archived: '📦'
  }[lesson.status] || '';

  let md = `### ${status} ${lesson.title || 'Lesson'}\n\n`;
  md += `${lesson.content}\n\n`;

  if (lesson.category_name) {
    md += `**Category:** ${lesson.category_name}\n`;
  }

  if (lesson.conditions) {
    const conditions = typeof lesson.conditions === 'string'
      ? JSON.parse(lesson.conditions)
      : lesson.conditions;

    const parts = [];
    if (conditions.setup?.length) parts.push(`Setup: ${conditions.setup.join(', ')}`);
    if (conditions.session?.length) parts.push(`Session: ${conditions.session.join(', ')}`);
    if (conditions.trigger?.length) parts.push(`Trigger: ${conditions.trigger.join(', ')}`);
    if (conditions.emotion?.length) parts.push(`Emotion: ${conditions.emotion.join(', ')}`);

    if (parts.length) {
      md += `**Applies to:** ${parts.join(' | ')}\n`;
    }
  }

  md += `\n*Learned: ${formatDate(lesson.learned_at)}*`;

  return md;
}

/**
 * Format lessons list as markdown
 */
export function formatLessons(lessons) {
  if (!lessons || lessons.length === 0) {
    return "No lessons saved yet. Add lessons with: `lesson: [your insight]`";
  }

  let md = `## Your Lessons (${lessons.length})\n\n`;

  lessons.forEach((lesson, i) => {
    md += formatLesson(lesson);
    if (i < lessons.length - 1) md += '\n\n---\n\n';
  });

  return md;
}

/**
 * Format setups list as markdown
 */
export function formatSetups(setups) {
  if (!setups || setups.length === 0) {
    return "No setups configured yet.";
  }

  let md = `## Available Setups\n\n`;

  setups.forEach((setup, i) => {
    // Handle both string arrays and object arrays
    const name = typeof setup === 'string' ? setup : setup.name;
    md += `${i + 1}. ${name}\n`;
  });

  return md;
}

/**
 * Expand common trading abbreviations
 */
function expandAbbreviations(text) {
  if (!text) return text;
  return text
    .replace(/\bMR\b/g, 'Mean Reversion')
    .replace(/\bOI\b/g, 'Open Interest')
    .replace(/\bPA\b/g, 'Price Action')
    .replace(/\bHTF\b/g, 'Higher Timeframe')
    .replace(/\bLTF\b/g, 'Lower Timeframe')
    .replace(/\bSFP\b/g, 'Swing Failure Pattern');
}

/**
 * Format daily outlook as markdown
 */
export function formatOutlook(data) {
  if (!data || !data.outlook_data) {
    return "No daily outlook set for today. Create one with your bias and key levels!";
  }

  const outlook = data.outlook_data;
  const date = data.date;

  let md = `## Daily Outlook (${date})\n\n`;

  // Bias
  const biasEmoji = outlook.bias === 'bullish' ? '🟢' : outlook.bias === 'bearish' ? '🔴' : '⚪';
  md += `**Bias:** ${biasEmoji} ${outlook.bias?.toUpperCase() || 'Not set'}`;
  if (outlook.htf_bias) {
    md += ` (HTF: ${outlook.htf_bias})`;
  }
  md += '\n';

  if (outlook.bias_reasoning) {
    md += `> ${outlook.bias_reasoning}\n`;
  }
  md += '\n';

  // Key levels
  if (outlook.key_levels && Object.keys(outlook.key_levels).length > 0) {
    md += `### Key Levels\n`;
    md += `| Level | Price |\n|-------|-------|\n`;
    for (const [name, price] of Object.entries(outlook.key_levels)) {
      const displayName = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      md += `| ${displayName} | ${formatCurrency(price)} |\n`;
    }
    md += '\n';
  }

  // Planned setups
  if (outlook.setups && outlook.setups.length > 0) {
    md += `### Planned Setups\n`;
    outlook.setups.forEach((setup, i) => {
      const setupName = expandAbbreviations(setup.name);
      md += `${i + 1}. **${setupName}**`;
      if (setup.location) md += ` @ ${setup.location}`;
      if (setup.price) md += ` (${formatCurrency(setup.price)})`;
      if (setup.price_range) md += ` (${setup.price_range})`;
      md += '\n';
      if (setup.pa_trigger) md += `   - PA: ${expandAbbreviations(setup.pa_trigger)}\n`;
      if (setup.flow_trigger) md += `   - Flow: ${expandAbbreviations(setup.flow_trigger)}\n`;
      if (setup.size) md += `   - Size: ${setup.size}\n`;
    });
    md += '\n';
  }

  // No trade zone
  if (outlook.no_trade_zone) {
    md += `### No Trade Zone\n`;
    md += `**${outlook.no_trade_zone.level}**`;
    if (outlook.no_trade_zone.price) md += ` @ ${formatCurrency(outlook.no_trade_zone.price)}`;
    if (outlook.no_trade_zone.reason) md += ` - ${outlook.no_trade_zone.reason}`;
    md += '\n\n';
  }

  // Invalidation levels
  if (outlook.invalidation) {
    md += `### Invalidation\n`;
    if (outlook.invalidation.range_to_bearish) {
      md += `- Bearish below: ${formatCurrency(outlook.invalidation.range_to_bearish)}\n`;
    }
    if (outlook.invalidation.range_to_bullish) {
      md += `- Bullish above: ${formatCurrency(outlook.invalidation.range_to_bullish)}\n`;
    }
    md += '\n';
  }

  return md.trim();
}

/**
 * Format trade confirmation message
 */
export function formatTradeConfirmation(trade, action = 'opened') {
  const direction = trade.direction === 'long' ? '🟢 Long' : '🔴 Short';

  if (action === 'opened') {
    return `**Trade Opened** ${direction}\n\n` +
      `| | |\n|---|---|\n` +
      `| Asset | **${trade.asset}** |\n` +
      `| Entry | ${formatCurrency(trade.entry_price)} |\n` +
      `| Size | ${formatCurrency(trade.position_size)} |\n` +
      `| Leverage | ${trade.leverage || '-'}x |\n\n` +
      `Trade ID: T${trade.id}`;
  }

  if (action === 'closed') {
    const pnlColor = trade.pnl >= 0 ? '🟢' : '🔴';
    return `**Trade Closed** ${pnlColor}\n\n` +
      `| | |\n|---|---|\n` +
      `| Asset | **${trade.asset}** |\n` +
      `| Exit | ${formatCurrency(trade.exit_price)} |\n` +
      `| P&L | ${formatCurrency(trade.pnl, true)} (${formatPercent(trade.pnl_percentage, true)}) |\n`;
  }

  return formatTrade(trade);
}

/**
 * Format error message
 */
export function formatError(message) {
  return `**Error:** ${message}`;
}

/**
 * Format success message
 */
export function formatSuccess(message) {
  return `✅ ${message}`;
}

/**
 * Format screenshot extraction result
 */
export function formatExtraction(data) {
  if (!data) {
    return "Could not extract trade data from screenshot.";
  }

  let md = `## Extracted Trade Data\n\n`;
  md += "| Field | Value |\n";
  md += "|-------|-------|\n";

  if (data.exchange) md += `| Exchange | ${data.exchange} |\n`;
  if (data.asset) md += `| Asset | ${data.asset} |\n`;
  if (data.direction) md += `| Direction | ${data.direction} |\n`;
  if (data.entry_price) md += `| Entry Price | ${formatCurrency(data.entry_price)} |\n`;
  if (data.position_size) md += `| Position Size | ${formatCurrency(data.position_size)} |\n`;
  if (data.leverage) md += `| Leverage | ${data.leverage}x |\n`;
  if (data.unrealized_pnl != null) md += `| Unrealized P&L | ${formatCurrency(data.unrealized_pnl, true)} |\n`;
  if (data.liquidation_price) md += `| Liquidation | ${formatCurrency(data.liquidation_price)} |\n`;

  md += "\n*Would you like me to open this trade?*";

  return md;
}
