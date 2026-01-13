# Trading Journal MVP - Product Requirements Document

## Executive Summary

An AI-powered trading journal application that automatically logs crypto trades from screenshots, tracks emotional states, calculates performance metrics, and provides intelligent feedback. Built as a local Node.js web application with React frontend, SQLite database, and Claude API integration.

**Target User:** Solo crypto trader (initial user: Kenji) trading BTC and crypto majors on PerpDEXs (Hyperliquid, Variational) and Binance.

**Core Value Proposition:** Eliminates journaling friction by auto-logging trades from screenshots while forcing disciplined planning, execution tracking, and emotional awareness.

---

## Product Goals

1. **Reduce friction** - Auto-log trades from screenshots instead of manual data entry
2. **Force discipline** - Require daily outlook planning before trading
3. **Track emotions** - Capture and analyze emotional states to identify tilt patterns
4. **Calculate expectancy** - Automatically compute win rate, profit ratio, and other metrics per setup
5. **Enable learning** - Provide AI-powered feedback based on trading history
6. **Support reflection** - Maintain human-readable journal entries with screenshots for review

---

## Technical Architecture

### Stack Decisions

**Backend:**
- Node.js with Express.js
- SQLite database (single file, local storage)
- Claude API (Anthropic) for AI features
- OCR library (tesseract.js or similar) for screenshot text extraction

**Frontend:**
- React with modern hooks
- React Router for navigation
- Markdown editor component (react-markdown or similar)
- Drag-and-drop file upload (react-dropzone)
- Chart library for stats dashboard (recharts or chart.js)

**Architecture:**
- Local web app (runs on localhost:3000)
- No authentication (single-user, local only)
- REST API between frontend and backend
- WebSocket for real-time chat updates (optional, can use polling)

**Key Dependencies:**
```json
{
  "backend": [
    "express",
    "better-sqlite3",
    "@anthropic-ai/sdk",
    "tesseract.js",
    "multer",
    "cors"
  ],
  "frontend": [
    "react",
    "react-router-dom",
    "react-dropzone",
    "react-markdown",
    "recharts",
    "axios"
  ]
}
```

---

## Data Model

### Database Schema (SQLite)

#### Table: `trading_days`
```sql
CREATE TABLE trading_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD
  has_outlook BOOLEAN DEFAULT 0,
  has_review BOOLEAN DEFAULT 0,
  outlook_data TEXT, -- JSON blob
  review_data TEXT, -- JSON blob
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### Table: `trades`
```sql
CREATE TABLE trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_number TEXT NOT NULL UNIQUE, -- e.g., "2026-01-14-T1"
  trading_day_id INTEGER,

  -- Trade basics
  asset TEXT NOT NULL, -- e.g., "BTC/USD"
  direction TEXT NOT NULL, -- "long" or "short"
  entry_price REAL,
  exit_price REAL,
  position_size REAL,
  leverage REAL,
  liquidation_price REAL,

  -- Trading classification
  setup TEXT, -- e.g., "Breakout", "Mean Reversion"
  location TEXT, -- e.g., "dVWAP VAH", "wVWAP VAL 2SD"
  trigger TEXT, -- e.g., "rejection", "AGGR climax"

  -- Performance metrics
  pnl REAL,
  pnl_percentage REAL,
  outcome TEXT, -- "win", "loss", "breakeven"

  -- Context and emotions
  initial_emotion TEXT,
  planned_in_outlook BOOLEAN DEFAULT 0,
  is_scaled_trade BOOLEAN DEFAULT 0, -- true if part of multi-entry trade
  parent_trade_id INTEGER, -- links sub-trades to parent

  -- Status
  status TEXT DEFAULT 'open', -- "open", "closed"

  -- Timestamps
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (trading_day_id) REFERENCES trading_days(id),
  FOREIGN KEY (parent_trade_id) REFERENCES trades(id)
);
```

#### Table: `trade_updates`
```sql
CREATE TABLE trade_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id INTEGER NOT NULL,
  update_type TEXT NOT NULL, -- "emotion", "note", "screenshot", "price_change"
  content TEXT, -- JSON blob with update details
  emotion TEXT, -- emotion at time of update
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (trade_id) REFERENCES trades(id)
);
```

#### Table: `screenshots`
```sql
CREATE TABLE screenshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL, -- "trade", "trade_update", "outlook", "review"
  entity_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  extracted_data TEXT, -- JSON blob from OCR
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### Table: `journal_entries`
```sql
CREATE TABLE journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL, -- "trade", "trading_day"
  entity_id INTEGER NOT NULL,
  markdown_content TEXT, -- Human-readable markdown notes
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### Table: `chat_sessions`
```sql
CREATE TABLE chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_type TEXT NOT NULL, -- "daily_outlook", "new_trade", "trade_update", "daily_review"
  entity_id INTEGER, -- links to trading_day or trade
  messages TEXT, -- JSON array of chat messages
  status TEXT DEFAULT 'active', -- "active", "completed"
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
```

#### Table: `system_config`
```sql
CREATE TABLE system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL, -- JSON blob for complex configs
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Config Keys:**
- `trading_style` - User's trading style description
- `setups` - Array of setup names
- `locations` - Array of location definitions
- `triggers` - Array of trigger types
- `vocabulary` - Trading vocabulary shortcuts
- `current_quarter_start` - Date when current quarter started (for trade numbering)

---

## Core Features

### Feature 1: First-Time Setup Wizard

**Purpose:** Configure trading style, setups, locations, triggers before first use

**User Flow:**
1. On first launch, show welcome screen
2. Step 1: Enter trading style summary (textarea, pre-filled with template)
3. Step 2: Configure setups (checkboxes for defaults, add custom)
4. Step 3: Configure locations (auto-populated from trading style doc)
5. Step 4: Review vocabulary shortcuts
6. Save to `system_config` table
7. Redirect to main app

**Implementation:**
- React multi-step form component
- Backend endpoint: `POST /api/config/setup`
- Saves to SQLite `system_config` table

---

### Feature 2: Daily Outlook (Planning Session)

**Purpose:** Force user to plan trading day, identify setups, articulate bias

**User Flow:**
1. Click "New Daily Outlook" button
2. Opens chat interface with Claude AI
3. AI greets: "Let's plan your trading day. What's your daily bias?"
4. User types thoughts, pastes screenshots
5. AI processes input and asks follow-up questions per sections:
   - Daily Bias and why
   - Setups and Plans (if/then format)
   - Bull and Bear arguments
   - Where am I wrong? (invalidation levels)
6. AI shows historical win rate for each setup mentioned
7. AI formats response in structured markdown
8. User confirms, AI saves to `trading_days` table
9. Chat session completed, outlook visible on dashboard

**AI Behavior:**
- Uses Claude API with system prompt containing:
  - User's trading style
  - Vocabulary shortcuts (maps user input to standard terms)
  - Expected sections to fill
  - Instructions to consolidate circular thoughts
- Analyzes screenshots for context (vision API)
- Queries database for historical stats per setup
- Prompts for missing sections
- Consolidates duplicate references (e.g., "1D Trend" = "Daily Trend")

**Edge Cases:**
- If user tries to create new outlook before completing yesterday's review, AI prompts: "You haven't reviewed yesterday (YYYY-MM-DD). Would you like to review now or skip?"
- Can save partial outlook and resume later

---

### Feature 3: New Trade Logging

**Purpose:** Quickly log new trade entry with screenshot, AI extracts data

**User Flow:**
1. Click "Log New Trade" button
2. Opens chat interface
3. AI asks: "What trade did you open? Upload screenshot and tell me about it."
4. User drags screenshot into chat, types thoughts
5. AI extracts from screenshot via OCR:
   - Entry price
   - Position size
   - Leverage
   - Liquidation price
6. AI extracts from user text:
   - Setup (matches to predefined list)
   - Location (matches to predefined list)
   - Trigger (free-form or matched)
   - Asset (e.g., BTC/USD)
7. AI asks: "How are you feeling right now?" (emotion capture)
8. AI checks if this setup was mentioned in today's Daily Outlook
   - If yes: "Great! This matches your plan from this morning."
   - If no: "This wasn't in your plan. Is this a reaction trade or FOMO?"
9. AI shows historical stats for this setup:
   - Win rate: X%
   - Avg profit ratio: X:1
   - Avg position size: $X
10. AI generates trade number (e.g., "2026-01-14-T1")
11. AI summarizes trade and asks for confirmation
12. User confirms, trade saved to database
13. Can choose: "Log as single trade" or "This is a scaled entry" (sub-trade)

**AI Behavior:**
- OCR on screenshot to extract visible text
- Vision API to understand chart context
- NLP to extract setup/location/trigger from free-form text
- Database query to calculate historical stats
- Trade numbering logic: YYYY-MM-DD-T{sequence} where sequence increments per day

**Edge Cases:**
- **Scaled trades:** If "scaled entry", create parent trade and link subsequent entries
- **OCR failure:** If can't extract data, ask user to type manually
- **Ambiguous setup:** If can't determine setup, show options: "Is this Breakout or Mean to Edge?"
- **No matching location:** Allow free-form entry, suggest adding to config

**Screenshot Upload:**
- Drag-and-drop or paste from clipboard
- Files saved to `uploads/screenshots/` directory
- Path stored in `screenshots` table

---

### Feature 4: Trade Updates

**Purpose:** Log thoughts, emotions, and screenshots while trade is open

**User Flow:**
1. From trade list, click "Update Trade"
2. Opens chat interface with context: "Updating Trade 2026-01-14-T1 (BTC Long from dVWAP VAH)"
3. User types update, uploads new screenshots
4. AI asks: "How are you feeling now?"
5. AI saves update to `trade_updates` table
6. Update is linked to original trade

**Multiple Updates Handling:**
- Each update creates new row in `trade_updates`
- All updates displayed chronologically in trade detail view
- If multiple trades open simultaneously, AI confirms: "Are you updating Trade T1 or Trade T2?"
- Trade identification by:
  1. Most recent trade (if obvious)
  2. Explicit mention in user text ("update my BTC long")
  3. AI asks for clarification if ambiguous

**Emotional Tracking:**
- Each update includes emotion field
- If multiple updates in short time span → flag as "potentially over-emotional"
- AI note: "You've updated this trade 5 times in 30 minutes. Are you feeling anxious?"

---

### Feature 5: Close Trade

**Purpose:** Record trade outcome, update stats

**User Flow:**
1. User says in chat: "Closed Trade T1" or clicks "Close" button on trade
2. AI asks for screenshot or manual entry:
   - Exit price
   - Final PnL
3. AI calculates:
   - PnL percentage
   - Outcome (win/loss/breakeven)
4. AI asks: "How do you feel about this trade outcome?"
5. Updates `trades` table: status = "closed"
6. Automatically recalculates all stats for that setup

**Consolidation Rule:**
- Main trade record contains final entry/exit prices
- All screenshots from updates linked to main trade
- Journal entry consolidates all updates into single view

---

### Feature 6: Daily Review

**Purpose:** Close the loop, analyze day's performance

**User Flow:**
1. Click "Daily Review" or chat: "Review today"
2. AI infers which day to review (usually "today" or if next morning, "yesterday")
3. AI presents summary:
   - Daily outlook you created
   - Trades you took (list with outcomes)
   - Open trades (not closed yet)
4. AI asks for screenshots of closed trades (if not already provided)
5. AI updates any missing PnL data
6. User reflects on day in free-form chat
7. AI structures review with sections:
   - Was daily bias correct?
   - Did you follow your plan?
   - Performance on planned vs deviated trades
   - Emotional state throughout day
   - What would you do differently?
8. AI assigns scores (A-F or 1-10) for:
   - Analysis accuracy
   - Execution discipline
   - Emotional control
9. Saves to `trading_days.review_data`

**AI Behavior:**
- Auto-links to correct trading day by date inference
- Cross-references outlook setups with actual trades taken
- Calculates deviation metrics (planned vs actual)
- Flags emotional patterns from trade updates

---

### Feature 7: Trade List & Search

**Purpose:** Browse, filter, and search historical trades

**UI Layout:**
```
┌─────────────────────────────────────────────────┐
│ Smart Search: [________________________] 🔍     │
│ Quick Filters: [All] [Wins] [Losses] [Open]    │
│ Setup: [All ▾] Location: [All ▾] Date: [▾]     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 📊 Filtered Stats: Win Rate: 65% | PnL: +$1,234 │
└─────────────────────────────────────────────────┘

Trade List:
┌─────────────────────────────────────────────────┐
│ 2026-01-14-T2  BTC Long  Breakout  ✅ +2.3%    │
│ dVWAP VAH | rejection                            │
│ Opened: 2:34 PM | Closed: 4:12 PM                │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ 2026-01-14-T1  BTC Short  Mean Reversion  ❌ -1.2% │
│ wVWAP VAL 2SD | AGGR climax                      │
│ Opened: 10:15 AM | Closed: 11:03 AM              │
└─────────────────────────────────────────────────┘
```

**Search Functionality:**
- Natural language search: "BTC wins from last week"
- Filters by: W/L, setup, location, asset, date range, week, emotion
- Results update stats bar at top
- Click trade to open detail view

---

### Feature 8: Trade Detail View

**Purpose:** View complete trade history and edit journal notes

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Trade 2026-01-14-T1                    [Edit ▾] │
│ BTC/USD Long - Mean Reversion                    │
│ Status: Closed ✅ | PnL: +$245 (+2.3%)          │
├─────────────────────────────────────────────────┤
│ Trade Data:                                      │
│ Entry: $42,150 | Exit: $43,120                   │
│ Size: $10,000 | Leverage: 5x                     │
│ Location: dVWAP VAH | Trigger: rejection         │
│ Opened: 2026-01-14 2:34 PM                       │
│ Closed: 2026-01-14 4:12 PM                       │
│                                                   │
│ Emotions: Confident (entry) → Anxious (update)  │
│ → Relieved (exit)                                │
├─────────────────────────────────────────────────┤
│ Journal Notes (Markdown Editor):                │
│ [Edit mode available]                            │
│                                                   │
│ Strong rejection at dVWAP after overnight pump.  │
│ Entry was clean...                               │
│                                                   │
│ Screenshots: [img] [img] [img]                   │
├─────────────────────────────────────────────────┤
│ Trade Updates Timeline:                          │
│ 2:34 PM - Trade opened                           │
│ 2:41 PM - Update: "Price bouncing perfectly"    │
│ 3:15 PM - Update: "Getting nervous, small wick" │
│ 4:12 PM - Trade closed at target                │
└─────────────────────────────────────────────────┘
```

**Edit Capabilities:**
- Click [Edit] dropdown:
  - "Edit trade data" - Opens form to manually correct prices, setup, location
  - "Edit via chat" - Opens AI chat to make complex changes
- Markdown editor for journal notes (separate from trade data)
- All screenshots displayed inline, can add more

---

### Feature 9: Statistics Dashboard

**Purpose:** Visualize performance metrics over time

**Sections:**

1. **Overview Card:**
   - Total PnL
   - Win rate (overall)
   - Total trades
   - Best/worst trade

2. **Performance by Setup:**
   - Table: Setup | Trades | Win Rate | Avg Profit Ratio | Total PnL
   - Sort by any column

3. **Performance by Location:**
   - Similar table for locations

4. **Emotional Correlation:**
   - Chart: Emotion vs Win Rate
   - "You win 70% when 'confident' but only 45% when 'anxious'"

5. **Timeline Charts:**
   - PnL over time (line chart)
   - Win rate over time (moving average)

6. **Quick Filters:**
   - Last 7 days, 30 days, This quarter, All time
   - Filter by setup, location, asset

---

### Feature 10: Settings Page

**Purpose:** Update trading configuration anytime

**Sections:**

1. **Trading Style:**
   - Edit system prompt / trading style description
   - Textarea with save button

2. **Setups:**
   - List with add/remove buttons
   - Current: Breakout, Breakdown, Mean Reversion, CME Gap Fills, Mean to Edge, FOMO

3. **Locations:**
   - Auto-generated from VWAP timeframes
   - Can add custom locations

4. **Triggers:**
   - List with add/remove buttons
   - Can add as needed (per user's request)

5. **Vocabulary:**
   - Edit shortcuts (e.g., "1D Trend" = "Daily Trend" = "Daily Clinic Trend")

6. **Export/Backup:**
   - Button: "Export all trades to CSV"
   - Button: "Export all trades to JSON"
   - Shows database file location for manual backup

---

## Trading Configuration (Initial Setup)

### Setups
```json
[
  "Breakout",
  "Breakdown",
  "Mean Reversion",
  "CME Gap Fills",
  "Mean to Edge",
  "FOMO"
]
```

### Locations (Auto-generated from VWAP timeframes)

**VWAP Timeframes:**
- Daily (d), Weekly (w), Monthly (m), Quarterly (q), Yearly (y), Comp (c)

**Levels per VWAP (except Comp):**
- VAH 2SD (external range high)
- VAH (value area high / range high)
- vWAP (mean / center)
- VAL (value area low / range low)
- VAL 2SD (external range low)

**Comp Levels:**
- cVAH (comp value area high)
- cVAL (comp value area low)
- POC (point of control)

**Clinic Trends:**
- H4 Clinic Trend (H4 EMA 100 + EMA 200)
- 1D Clinic Trend (Daily EMA 100 + EMA 200)
- 1W Clinic Trend (Weekly EMA 100 + EMA 200)

**Total Locations:** ~40 auto-generated combinations

**Location Format Examples:**
- "dVWAP VAH"
- "wVWAP VAL 2SD"
- "mVWAP" (center)
- "cVAH"
- "H4 Clinic Trend"

### Triggers (Initial List)

**Price Action:**
- rejection
- reclaim
- failure to reclaim
- expansion candle
- breaking through
- re-testing
- retesting from underside

**Orderflow:**
- AGGR climax
- OI flush
- OI surge
- OI puke

**Note:** User will add more triggers as they trade (triggers can be free-form or matched to list)

### Vocabulary Shortcuts

Stored as key-value pairs for AI to normalize input:

```json
{
  "1D Trend": "Daily Clinic Trend",
  "Daily Trend": "Daily Clinic Trend",
  "Clinic Daily Trend": "Daily Clinic Trend",
  "H4 Trend": "H4 Clinic Trend",
  "Four Hour Trend": "H4 Clinic Trend",
  "4 hour trend": "H4 Clinic Trend",
  "1W Trend": "1W Clinic Trend",
  "Weekly Trend": "1W Clinic Trend",
  "dVAP": "dVWAP",
  "daily vWAP": "dVWAP",
  "comp VAL": "cVAL",
  "comp VAH": "cVAH"
}
```

### User's Trading Style (System Prompt Context)

```
I'm a crypto day/swing trader focusing on BTC and major altcoins. I trade on PerpDEXs (Hyperliquid, Variational) and Binance.

My approach is VWAP-based using fixed time interval VWAPs as dynamic ranges. I identify market regime by VWAP slope (trending vs range-bound) and use Clinic Trends (EMA 100 + EMA 200 on various timeframes) as momentum indicators.

Key concepts:
- Value = Value Area (inside the range)
- Edge = VAH/VAL (range boundaries)
- Mean = vWAP/POC (center of range)
- External ranges = 2SD levels

I monitor orderflow via AGGR (real-time buyer/seller data) and Open Interest (OI) to identify climax/exhaustion.

My setups:
1. Breakout/Breakdown - price leaving value and accepting outside
2. Mean Reversion - price returning from external ranges to center
3. CME Gap Fills - price revisiting gaps from CME closures
4. Mean to Edge - strong triggers in middle of range (higher risk)

I'm working on emotional discipline and avoiding FOMO trades.
```

---

## AI Integration Details

### Claude API System Prompt (Dynamic)

**Components:**
1. User's trading style (from config)
2. Current session type (Daily Outlook, New Trade, etc.)
3. Vocabulary shortcuts for normalization
4. Instructions specific to session type
5. Historical context (recent trades, stats)

**Example System Prompt for "New Trade" Session:**

```
You are an AI trading journal assistant helping a crypto trader log a new trade.

TRADER'S STYLE:
{user's trading style from config}

VOCABULARY:
{vocabulary shortcuts - always normalize to standard terms}

SETUPS: {list of setups}
LOCATIONS: {list of locations}
TRIGGERS: {list of triggers}

TODAY'S OUTLOOK:
{if exists, include today's daily outlook to check if trade was planned}

YOUR TASK:
1. Ask user to upload trade screenshot and describe the trade
2. Extract from screenshot: entry price, position size, leverage, liquidation price
3. Extract from user text: asset, direction, setup, location, trigger
4. Ask about emotional state: "How are you feeling right now?"
5. Check if this setup was mentioned in today's outlook - provide feedback
6. Query historical stats for this setup and present:
   - Win rate
   - Avg profit ratio
   - Avg position size
7. Generate trade number: YYYY-MM-DD-T{sequence}
8. Ask if this is a single trade or scaled entry
9. Summarize and ask for confirmation
10. If confirmed, respond with JSON for database insertion

RULES:
- Always normalize terminology using vocabulary shortcuts
- If ambiguous, ask for clarification (don't guess)
- Be encouraging but honest about stats
- Flag if trade seems emotional or wasn't planned
- Keep conversation focused and concise

RESPONSE FORMAT for confirmed trade:
{
  "action": "save_trade",
  "data": {
    "asset": "BTC/USD",
    "direction": "long",
    "entry_price": 42150,
    "position_size": 10000,
    ...
  }
}
```

### API Endpoints for AI Integration

```
POST /api/ai/chat
- Send user message, get AI response
- Handles context from chat_sessions table
- Streams response for real-time feel

POST /api/ai/extract-screenshot
- Upload screenshot
- Returns OCR results + AI interpretation

GET /api/ai/stats/{setup}
- Get historical stats for a specific setup
- Used by AI to provide expectancy data
```

---

## Edge Cases & Error Handling

### 1. Multiple Trade Updates - Matching Correct Trade

**Problem:** User has 3 open trades, says "update trade"

**Solution:**
- AI checks how many trades are open
- If 1 open: auto-select
- If multiple: AI asks "Which trade? (T1: BTC Long Breakout, T2: ETH Short Mean Reversion, T3: BTC Long CME Gap)"
- User can refer to trade by number, asset, or description
- AI matches using fuzzy text matching

### 2. Emotional Over-Trading Detection

**Problem:** User updates same trade many times in short period

**Solution:**
- Track update frequency in `trade_updates` table
- If 3+ updates within 30 minutes: flag trade as "high_emotion"
- AI gently notes: "You've checked this trade several times. Take a breath. Your plan was solid."
- Display flag in trade detail view for later review

### 3. Closing Multiple Trades Simultaneously

**Problem:** User closes 3 trades at once

**Solution:**
- AI processes sequentially: "Let's close Trade T1 first..."
- After each close, asks: "Any others to close?"
- Can also say "Close all my trades" and AI walks through each one

### 4. Forgotten Daily Review

**Problem:** User starts new day without reviewing previous day

**Solution:**
- On "New Daily Outlook", AI checks if yesterday has review
- If missing: "You haven't reviewed yesterday (Jan 13). Would you like to do that now, or skip?"
- User can choose to:
  - Review now (AI switches to Daily Review session for yesterday)
  - Skip (AI notes in system that review was skipped)
  - Remind me later (AI will prompt again)

### 5. Next-Day Review

**Problem:** User creates review the next morning for previous day

**Solution:**
- AI is context-aware: if user says "review today" but it's morning with no trades yet, AI infers: "Do you mean yesterday (Jan 13)?"
- Explicit date mentions override: "review january 13"
- Daily Review session stores `trading_day_id` to link correctly

### 6. Consolidating Multiple Updates into One Entry

**Problem:** Trade has 10 updates scattered across 2 hours

**Solution:**
- Database keeps all updates separate in `trade_updates` table
- UI displays timeline of all updates in trade detail view
- Journal entry (markdown) is SEPARATE from updates
- After closing trade, user can write consolidated reflection in journal notes
- AI can offer: "Would you like me to summarize all your updates into your journal notes?"

### 7. Screenshots from Multiple Updates

**Problem:** 5 screenshots across multiple updates, need all in final entry

**Solution:**
- All screenshots linked to trade_id in `screenshots` table
- Trade detail view shows ALL screenshots in chronological order
- Can be reorganized in journal markdown editor
- Export/backup includes all screenshots

### 8. Scaled Trades (Multiple Entries/Exits)

**Problem:** User enters trade 3 times at different prices

**Solution:**
- First entry creates main trade record (status: "open")
- Subsequent entries:
  - Option 1: "Add to existing trade" → creates sub-trade with `parent_trade_id`
  - Option 2: "Log as separate trade" → creates new independent trade
- UI shows parent trade with linked sub-trades
- Stats calculated on parent trade (weighted avg entry, total position size)

### 9. OCR Extraction Failure

**Problem:** Screenshot doesn't have clear text or OCR fails

**Solution:**
- AI attempts OCR, if confidence < 70%, AI says: "I couldn't read the numbers clearly. Can you tell me your entry price and position size?"
- User types manually
- Falls back to pure manual entry

### 10. Ambiguous Setup Classification

**Problem:** User says "I longed the breakout" but description matches multiple setups

**Solution:**
- AI asks: "This sounds like a Breakout setup, but you mentioned mean reversion earlier. Which is it?"
- Shows options with radio buttons
- User selects, AI saves

### 11. New Setup Not in List

**Problem:** User trades new setup not in predefined list

**Solution:**
- AI notes: "I don't recognize this setup. Should I add 'EMA Gap Fill' to your setup list?"
- User confirms
- Backend endpoint: `POST /api/config/add-setup`
- Future trades can use new setup
- Backwards compatible: old trades keep their classifications

### 12. Database Migration for New Fields

**Problem:** User adds new metric to track (e.g., "time of day")

**Solution:**
- SQLite schema allows NULL for new columns
- Add column via migration
- Existing trades show NULL / "not tracked"
- New trades populate new field
- Stats calculations handle NULL gracefully

---

## MVP Scope Definition

### IN SCOPE (Must Have for MVP)

✅ **Core Workflows:**
- First-time setup wizard
- Daily Outlook creation
- New Trade logging with screenshot upload
- Trade Updates (notes, emotions, screenshots)
- Close Trade (PnL entry)
- Daily Review

✅ **AI Features:**
- Claude API integration for conversational logging
- OCR for screenshot text extraction
- Vocabulary normalization
- Historical stats lookup
- Setup/location/trigger extraction

✅ **Data Management:**
- SQLite database with full schema
- Auto trade numbering (date-based: YYYY-MM-DD-T#)
- Stats calculation (win rate, profit ratio, PnL)
- Emotion tracking per trade

✅ **UI Components:**
- Chat interface (Daily Outlook, New Trade, etc.)
- Trade list with smart search
- Trade detail view
- Settings page
- Basic dashboard (simple stats)

✅ **Edge Case Handling:**
- Multiple trade updates matching
- Forgotten review prompts
- Next-day review support
- Scaled trade options

✅ **Export:**
- Export trades to CSV/JSON

### OUT OF SCOPE (Post-MVP / Phase 2)

❌ **Historical Data Import:**
- Import old trades from markdown journal (Phase 2)
- Automatic renumbering to fit historical context

❌ **Advanced Dashboard:**
- Interactive charts with drill-down
- Emotion correlation analysis
- Complex filters and saved views

❌ **Lesson Tracking:**
- Separate "Lesson" entry type for key learnings
- Link lessons to specific trades

❌ **Advanced AI Features:**
- Proactive suggestions ("You're tilting, take a break")
- Pattern recognition across trades
- Predictive modeling

❌ **Collaboration Features:**
- Multi-user support
- Sharing trades/journals

❌ **Mobile App:**
- Native iOS/Android apps

❌ **Cloud Sync:**
- Remote backup
- Access from multiple devices

❌ **Integration:**
- Direct broker API integration (auto-import trades)
- Real-time price feeds

❌ **Notion Block System:**
- Full drag-and-drop block editor
- MVP uses simple markdown editor instead

---

## User Flows (Detailed Step-by-Step)

### Flow 1: Complete First Day Journey

**Morning - Daily Outlook:**
1. User opens app (localhost:3000)
2. Dashboard shows "No outlook for today" with [Create Daily Outlook] button
3. User clicks button → Opens chat interface
4. AI: "Good morning! Let's plan your day. What's your daily bias?"
5. User: "Bullish on BTC. Price held wVWAP overnight, expecting continuation to cVAH"
6. User pastes chart screenshot
7. AI processes screenshot, sees levels marked
8. AI: "Got it. What's your bull plan? Where would you long?"
9. User describes bull setup
10. AI: "And your bear plan? What if you're wrong?"
11. User describes bear scenario
12. AI queries database: "Your 'Breakout from wVWAP' setup has 68% win rate with 2.1:1 profit ratio"
13. AI: "What level invalidates your bullish bias?"
14. User provides invalidation
15. AI formats everything into structured Daily Outlook with sections
16. AI: "Here's your plan for today. Confirm?"
17. User: "Looks good"
18. Saves to database, returns to dashboard
19. Dashboard now shows today's outlook in summary card

**Afternoon - New Trade:**
20. User enters trade on Hyperliquid
21. Takes screenshot showing position
22. Opens app, clicks [Log New Trade]
23. AI: "What trade did you just open? Upload screenshot and tell me about it"
24. User drags screenshot into chat
25. User: "Longed BTC at 42,150 from dVWAP VAH, saw rejection and AGGR climax"
26. AI runs OCR, extracts: Entry 42150, Size $10,000, Leverage 5x, Liq 39,500
27. AI: "Looks like a Breakout from dVWAP VAH, triggered by rejection? Is that right?"
28. User: "Yes"
29. AI: "Great! This matches your bull plan from this morning. How are you feeling?"
30. User: "Confident, entry was clean"
31. AI: "Your Breakout setup has 68% win rate. You typically size $8,500 on these. You're at $10k."
32. AI: "Logging as Trade 2026-01-14-T1. Single trade or scaled entry?"
33. User: "Single"
34. AI summarizes trade
35. User: "Confirm"
36. Trade saved, chat closes, redirected to trade list showing new trade

**Later - Trade Update:**
37. Price moves against user
38. User feels nervous, opens app
39. Clicks on Trade T1 in list
40. Trade detail view opens
41. Clicks [Update] button
42. Chat opens with context: "Updating Trade 2026-01-14-T1"
43. User: "Price came back to entry, getting nervous, small wick down"
44. User pastes new screenshot
45. AI: "How are you feeling now?"
46. User: "Anxious"
47. AI: "Noted. Your stop is at 40,800. Still valid. Trust your plan."
48. Update saved, view returns to trade detail
49. Timeline now shows: "2:45 PM - Update: anxious - 'Price came back to entry...'"

**Evening - Close Trade:**
50. Trade hits target, user exits at 43,120
51. User takes exit screenshot
52. Opens Trade T1 detail, clicks [Close Trade]
53. AI: "Nice! What was your exit price?"
54. User pastes screenshot: "43,120"
55. AI reads screenshot, calculates: PnL = +$970, +2.3%
56. AI: "Congrats on the win! How do you feel about this trade?"
57. User: "Relieved, was stressful but stuck to plan"
58. AI updates trade: status = closed, outcome = win
59. Trade detail now shows "Closed ✅ +$970 (+2.3%)"
60. All stats auto-update (Breakout setup win rate now 69%)

**Night - Daily Review:**
61. User clicks [Daily Review]
62. AI: "Let's review today. You had 1 trade (T1: BTC Long Breakout - Win +2.3%)"
63. AI: "Your bias was bullish and price went up. Bias was correct ✓"
64. AI: "You took your planned Breakout setup. Execution aligned ✓"
65. AI: "You updated the trade showing some anxiety. How was your emotional control overall?"
66. User: "I was nervous mid-trade but didn't panic close, so good"
67. AI structures review with scores:
    - Analysis: A (bias correct)
    - Execution: A (followed plan)
    - Emotion: B+ (slight anxiety but maintained discipline)
68. AI: "What would you do differently?"
69. User: "Maybe size smaller to reduce stress"
70. AI: "Noted. Great day overall!"
71. Review saved, linked to today's outlook and trades

**Flow Complete:** User has full daily loop documented

---

### Flow 2: Multiple Simultaneous Trades

1. User has opened 3 trades within 10 minutes
2. Logs each via "New Trade" chat (3 separate sessions)
   - Trade T1: BTC Long Breakout
   - Trade T2: ETH Short Mean Reversion
   - Trade T3: BTC Long CME Gap Fill
3. All show as "Open" in trade list
4. User wants to update T2
5. Opens app, clicks [Update Trade T2] from list (directly)
6. OR: Clicks general [Update Trade] button from dashboard
7. AI sees 3 open trades, asks: "Which trade? T1 (BTC Long Breakout), T2 (ETH Short Mean Reversion), or T3 (BTC Long CME Gap)?"
8. User: "T2" or "ETH short"
9. AI matches to Trade T2
10. Proceeds with update flow
11. Later, closes T1 and T3 in sequence
12. Daily Review shows all 3 trades with individual analysis

---

## Technical Implementation Notes

### Project Structure

```
trading-journal/
├── backend/
│   ├── src/
│   │   ├── server.js           # Express app entry
│   │   ├── db/
│   │   │   ├── database.js      # SQLite connection
│   │   │   ├── schema.sql       # Database schema
│   │   │   └── migrations/      # Schema migrations
│   │   ├── routes/
│   │   │   ├── trades.js        # Trade CRUD endpoints
│   │   │   ├── trading-days.js  # Outlook/Review endpoints
│   │   │   ├── chat.js          # AI chat endpoints
│   │   │   ├── stats.js         # Statistics endpoints
│   │   │   └── config.js        # Configuration endpoints
│   │   ├── services/
│   │   │   ├── ai.js            # Claude API integration
│   │   │   ├── ocr.js           # Screenshot OCR
│   │   │   ├── stats.js         # Stats calculation logic
│   │   │   └── trade-numbering.js  # Auto-numbering logic
│   │   └── utils/
│   │       ├── vocabulary.js    # Normalize trading terms
│   │       └── validators.js    # Input validation
│   ├── uploads/
│   │   └── screenshots/         # User uploaded images
│   ├── data/
│   │   └── trading.db           # SQLite database file
│   ├── package.json
│   └── .env                     # ANTHROPIC_API_KEY
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main app component
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── TradeList.jsx
│   │   │   ├── TradeDetail.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── Setup.jsx        # First-time setup
│   │   ├── components/
│   │   │   ├── ChatInterface.jsx
│   │   │   ├── TradeCard.jsx
│   │   │   ├── MarkdownEditor.jsx
│   │   │   ├── StatsDashboard.jsx
│   │   │   └── SearchBar.jsx
│   │   ├── api/
│   │   │   └── client.js        # Axios API client
│   │   └── utils/
│   │       └── formatters.js    # Price, date formatting
│   ├── public/
│   ├── package.json
│   └── vite.config.js           # Vite bundler config
├── package.json                 # Root package for scripts
└── README.md
```

### API Routes Reference

**Trades:**
- `GET /api/trades` - List trades with filters
- `GET /api/trades/:id` - Get single trade
- `POST /api/trades` - Create trade
- `PUT /api/trades/:id` - Update trade
- `DELETE /api/trades/:id` - Delete trade
- `POST /api/trades/:id/close` - Close trade
- `POST /api/trades/:id/updates` - Add update to trade

**Trading Days:**
- `GET /api/trading-days` - List days
- `GET /api/trading-days/:date` - Get specific day
- `POST /api/trading-days/:date/outlook` - Save outlook
- `POST /api/trading-days/:date/review` - Save review

**Chat:**
- `POST /api/chat/start` - Start new chat session
- `POST /api/chat/message` - Send message, get AI response
- `GET /api/chat/sessions/:id` - Get session history

**Statistics:**
- `GET /api/stats/overview` - Overall stats
- `GET /api/stats/by-setup` - Stats per setup
- `GET /api/stats/by-location` - Stats per location
- `GET /api/stats/emotions` - Emotion correlations
- `GET /api/stats/setup/:name` - Historical stats for specific setup

**Configuration:**
- `GET /api/config` - Get all config
- `PUT /api/config/trading-style` - Update trading style
- `POST /api/config/setups` - Add setup
- `DELETE /api/config/setups/:name` - Remove setup
- `POST /api/config/triggers` - Add trigger
- `GET /api/config/locations` - Get all locations (computed)

**Screenshots:**
- `POST /api/screenshots/upload` - Upload screenshot
- `GET /api/screenshots/:id` - Get screenshot file

**Export:**
- `GET /api/export/csv` - Export all trades as CSV
- `GET /api/export/json` - Export all trades as JSON

### Stats Calculation Logic

**Win Rate:**
```javascript
function calculateWinRate(trades) {
  const closedTrades = trades.filter(t => t.status === 'closed');
  const wins = closedTrades.filter(t => t.outcome === 'win').length;
  return (wins / closedTrades.length) * 100;
}
```

**Profit Ratio:**
```javascript
function calculateProfitRatio(trades) {
  const wins = trades.filter(t => t.outcome === 'win');
  const losses = trades.filter(t => t.outcome === 'loss');

  const avgWin = wins.reduce((sum, t) => sum + Math.abs(t.pnl_percentage), 0) / wins.length;
  const avgLoss = losses.reduce((sum, t) => sum + Math.abs(t.pnl_percentage), 0) / losses.length;

  return avgWin / avgLoss; // e.g., 2.1 means 2.1:1
}
```

**Trade Expectancy:**
```javascript
function calculateExpectancy(trades) {
  const winRate = calculateWinRate(trades) / 100;
  const profitRatio = calculateProfitRatio(trades);

  return (winRate * profitRatio) - ((1 - winRate) * 1);
  // Positive = profitable setup, Negative = unprofitable
}
```

---

## Success Criteria (How to Verify MVP)

### Functional Testing Checklist

**Setup:**
- [ ] First launch shows setup wizard
- [ ] Can configure trading style, setups, locations
- [ ] Settings saved to database
- [ ] Settings page loads configuration correctly

**Daily Outlook:**
- [ ] Can create daily outlook via chat
- [ ] AI asks for all required sections
- [ ] AI shows historical stats for mentioned setups
- [ ] Screenshot upload works (drag & drop, paste)
- [ ] Outlook saved with correct date
- [ ] Outlook visible on dashboard

**New Trade:**
- [ ] Can log new trade via chat
- [ ] Screenshot OCR extracts entry price, size, leverage
- [ ] AI extracts setup, location, trigger from text
- [ ] AI checks if trade matches daily outlook
- [ ] AI shows historical stats for setup
- [ ] Trade number auto-generated (YYYY-MM-DD-T#)
- [ ] Emotion captured
- [ ] Trade appears in trade list immediately

**Trade Updates:**
- [ ] Can update open trade
- [ ] If multiple trades open, AI asks for clarification
- [ ] Update includes emotion and notes
- [ ] Screenshot can be added
- [ ] Multiple updates saved to same trade
- [ ] High-frequency updates flagged as emotional

**Close Trade:**
- [ ] Can close trade with PnL
- [ ] Stats recalculated automatically
- [ ] Trade status changes to "closed"
- [ ] All screenshots consolidated in trade detail

**Daily Review:**
- [ ] Can create review via chat
- [ ] AI auto-links to correct day (handles next-day review)
- [ ] AI compares planned vs actual trades
- [ ] Review saved and linked to outlook

**Trade List & Search:**
- [ ] Trade list displays all trades
- [ ] Smart search works (natural language)
- [ ] Filters work (W/L, setup, location, date)
- [ ] Stats bar updates based on filter
- [ ] Click trade opens detail view

**Trade Detail:**
- [ ] All trade data displayed correctly
- [ ] Timeline shows all updates chronologically
- [ ] All screenshots displayed
- [ ] Can edit trade data via form
- [ ] Can edit via AI chat
- [ ] Markdown editor works for journal notes

**Statistics Dashboard:**
- [ ] Overall stats displayed (PnL, win rate, total trades)
- [ ] Stats by setup table accurate
- [ ] Stats by location table accurate
- [ ] Can filter by date range

**Settings:**
- [ ] Can edit trading style
- [ ] Can add/remove setups
- [ ] Can add/remove triggers
- [ ] Changes reflected in AI behavior

**Export:**
- [ ] CSV export includes all trades with correct data
- [ ] JSON export valid and complete

**Edge Cases:**
- [ ] Forgotten review prompts before new outlook
- [ ] Next-day review links correctly
- [ ] Multiple updates match correct trade
- [ ] Scaled trade creates sub-trades
- [ ] OCR failure falls back to manual entry
- [ ] New setup can be added mid-session

---

## Post-MVP: Phase 2 Features

**Phase 2 (Historical Data Import):**
- Import old trades from markdown journal entries
- AI parses unstructured text to extract trade data
- Renumber existing trades to accommodate history
- Recalculate all stats with full historical context
- Migration tool to update database schema if needed

**Phase 3 (Advanced Analytics):**
- Emotion correlation charts (win rate by emotion)
- Pattern detection (e.g., "You lose more on Fridays")
- Proactive AI suggestions ("You're trading more than usual, are you tilting?")
- Custom metrics and filters
- Export to external analytics tools

**Phase 4 (Enhanced UX):**
- Full Notion-like block editor for journal notes
- Advanced screenshot annotation
- Voice-to-text for quick logging
- Dark mode
- Mobile-responsive design

**Phase 5 (Integration):**
- Direct broker API integration (auto-import trades from Hyperliquid/Binance)
- Real-time price feeds
- Webhook notifications (trade opened/closed)
- Telegram bot integration for mobile logging

---

## Conclusion

This PRD defines a complete, unambiguous MVP for a solo trader's AI-powered trading journal. The scope is realistic for a Node.js/React application with Claude API integration, focusing on:

1. **Core loop:** Plan (Outlook) → Execute (Log Trades) → Reflect (Review)
2. **AI automation:** Screenshot processing, stats calculation, conversational logging
3. **Emotional awareness:** Track feelings throughout trading day
4. **Data integrity:** Backwards-compatible schema, robust edge case handling

**Next Steps:**
1. Set up project structure (Node.js + React)
2. Initialize SQLite database with schema
3. Implement first-time setup wizard
4. Build chat interface with Claude API
5. Implement Daily Outlook flow end-to-end
6. Add New Trade flow with OCR
7. Complete remaining workflows (Updates, Close, Review)
8. Build trade list and search
9. Add statistics dashboard
10. Test all edge cases

**Estimated Development Time:** 4-6 weeks for solo developer with moderate experience in Node.js, React, and AI APIs.
