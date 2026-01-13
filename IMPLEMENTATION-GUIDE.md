# Trading Journal MVP - Quick Implementation Guide

**Purpose:** Fast reference for building the MVP. See PRD.md for complete details.

---

## Quick Start

### Tech Stack
- **Backend:** Node.js + Express + SQLite + Claude API + Tesseract.js (OCR)
- **Frontend:** React + Vite + React Router + react-dropzone + recharts
- **Local app:** localhost:3000 (no auth, single user)

### First Steps
```bash
# 1. Create project structure
npm init -y
mkdir -p backend/src/{db,routes,services,utils} backend/uploads/screenshots backend/data
mkdir -p frontend/src/{pages,components,api,utils}

# 2. Backend dependencies
cd backend
npm install express better-sqlite3 @anthropic-ai/sdk tesseract.js multer cors dotenv

# 3. Frontend dependencies
cd ../frontend
npm create vite@latest . -- --template react
npm install react-router-dom react-dropzone react-markdown recharts axios

# 4. Create .env
echo "ANTHROPIC_API_KEY=your_key_here" > backend/.env
```

---

## Database Schema (SQLite)

### 8 Tables Overview

1. **`trading_days`** - Daily outlook & review data
2. **`trades`** - Core trade records
3. **`trade_updates`** - Updates while trade is open
4. **`screenshots`** - All uploaded images
5. **`journal_entries`** - Human-readable markdown notes
6. **`chat_sessions`** - AI conversation history
7. **`system_config`** - User settings (setups, locations, triggers, vocabulary)

### Critical Fields

**trades table:**
- `trade_number` (UNIQUE): "2026-01-14-T1" format
- `setup`, `location`, `trigger`: Trading classification
- `initial_emotion`: Emotion at entry
- `planned_in_outlook`: Boolean - was this trade planned?
- `parent_trade_id`: For scaled trades

**system_config table:**
- Key-value store for: `trading_style`, `setups`, `locations`, `triggers`, `vocabulary`

---

## Core Features (10 Features)

### 1. Setup Wizard (First Launch)
- Multi-step form
- Pre-populate with user's trading style
- Save to `system_config`

### 2. Daily Outlook
- Chat interface with Claude
- Ask for: bias, bull/bear plans, setups, invalidation levels
- Show historical stats for mentioned setups
- Save to `trading_days.outlook_data` (JSON)

### 3. New Trade Logging
- Upload screenshot → OCR extracts entry, size, leverage
- AI extracts setup/location/trigger from text
- Capture emotion
- Check if planned in outlook
- Auto-generate trade number
- Save to `trades` table

### 4. Trade Updates
- Multiple updates per trade
- Each update captures emotion + notes + screenshot
- If multiple trades open, AI asks which one
- Flag high-frequency updates as emotional

### 5. Close Trade
- Upload exit screenshot or manual entry
- Calculate PnL, outcome (win/loss/breakeven)
- Auto-recalculate all stats
- Update `trades.status = 'closed'`

### 6. Daily Review
- AI infers date (handles next-day review)
- Compare planned vs actual trades
- Grade: analysis, execution, emotion
- Save to `trading_days.review_data` (JSON)

### 7. Trade List & Search
- Smart search (natural language)
- Filters: W/L, setup, location, date, emotion
- Show aggregated stats for filtered results
- Click trade → detail view

### 8. Trade Detail View
- All trade data + timeline of updates
- All screenshots chronologically
- Markdown editor for journal notes
- Edit via form or AI chat

### 9. Stats Dashboard
- Overall: PnL, win rate, total trades
- Tables: stats by setup, by location
- Charts: PnL timeline, emotion correlation
- Filters: 7d, 30d, quarter, all time

### 10. Settings
- Edit trading style, setups, locations, triggers
- Export to CSV/JSON
- Show database file path for backup

---

## API Routes (Quick Reference)

### Trades
- `GET /api/trades` - List with filters
- `POST /api/trades` - Create
- `PUT /api/trades/:id` - Update
- `POST /api/trades/:id/close` - Close
- `POST /api/trades/:id/updates` - Add update

### Trading Days
- `GET /api/trading-days/:date` - Get day
- `POST /api/trading-days/:date/outlook` - Save outlook
- `POST /api/trading-days/:date/review` - Save review

### Chat
- `POST /api/chat/start` - New session
- `POST /api/chat/message` - Send message, get AI response

### Stats
- `GET /api/stats/overview` - Overall
- `GET /api/stats/by-setup` - Per setup
- `GET /api/stats/setup/:name` - Historical for specific setup

### Config
- `GET /api/config` - Get all
- `PUT /api/config/trading-style` - Update style
- `POST /api/config/setups` - Add setup

### Export
- `GET /api/export/csv` - Export CSV
- `GET /api/export/json` - Export JSON

---

## AI Integration (Claude API)

### System Prompt Components
1. User's trading style (from `system_config.trading_style`)
2. Session type (outlook, new_trade, update, review)
3. Vocabulary shortcuts (normalize user input)
4. Session-specific instructions
5. Historical context (recent trades, stats)

### Key AI Tasks
- **Daily Outlook:** Guide through sections, show historical stats
- **New Trade:** Extract data from screenshot + text, check if planned, show expectancy
- **Update:** Identify which trade, capture emotion
- **Close:** Calculate PnL, assess outcome
- **Review:** Cross-reference outlook vs actual, grade performance

### Claude API Calls
```javascript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4096,
  system: systemPrompt, // Dynamic based on session type
  messages: [
    { role: 'user', content: userMessage }
  ]
});
```

---

## Trading Configuration

### Setups (Initial)
```javascript
["Breakout", "Breakdown", "Mean Reversion", "CME Gap Fills", "Mean to Edge", "FOMO"]
```

### Locations (Auto-generated)
**Pattern:** `{timeframe}VWAP {level}`
- Timeframes: d, w, m, q, y, c (comp)
- Levels: VAH 2SD, VAH, vWAP, VAL, VAL 2SD
- Comp: cVAH, cVAL, POC
- Clinic Trends: H4/1D/1W Clinic Trend

**Examples:** "dVWAP VAH", "wVWAP VAL 2SD", "H4 Clinic Trend"

### Triggers (Initial)
**Price Action:** rejection, reclaim, failure to reclaim, expansion candle, breaking through, re-testing

**Orderflow:** AGGR climax, OI flush, OI surge, OI puke

### Vocabulary (Normalize User Input)
```javascript
{
  "1D Trend": "Daily Clinic Trend",
  "H4 Trend": "H4 Clinic Trend",
  "dVAP": "dVWAP",
  "comp VAL": "cVAL"
}
```

---

## Stats Calculation

### Win Rate
```javascript
const closedTrades = trades.filter(t => t.status === 'closed');
const wins = closedTrades.filter(t => t.outcome === 'win').length;
return (wins / closedTrades.length) * 100;
```

### Profit Ratio
```javascript
const avgWin = wins.reduce((sum, t) => sum + Math.abs(t.pnl_percentage), 0) / wins.length;
const avgLoss = losses.reduce((sum, t) => sum + Math.abs(t.pnl_percentage), 0) / losses.length;
return avgWin / avgLoss; // e.g., 2.1 means 2.1:1
```

### Trade Expectancy
```javascript
return (winRate * profitRatio) - ((1 - winRate) * 1);
// Positive = profitable, Negative = unprofitable
```

---

## Critical Edge Cases

### 1. Multiple Open Trades
- AI checks count: if > 1, ask "Which trade?"
- User can refer by number (T1), asset (BTC), or description

### 2. Emotional Over-Trading
- Track update frequency
- If 3+ updates in 30 min → flag as "high_emotion"
- AI gently notes to trust the plan

### 3. Forgotten Review
- Before new outlook, check if yesterday has review
- Prompt: "Review yesterday first?" (review / skip / later)

### 4. Next-Day Review
- AI infers date based on context
- Morning with no trades yet → asks "You mean yesterday?"

### 5. Consolidating Updates
- Keep all updates separate in `trade_updates` table
- UI shows timeline chronologically
- Journal notes are SEPARATE (markdown editor)
- After close, can summarize updates into journal

### 6. Scaled Trades
- First entry = main trade
- Subsequent: "Add to existing" (sub-trade) or "Separate trade"
- Link via `parent_trade_id`

### 7. OCR Failure
- If confidence < 70%: "Can't read clearly, please type"
- Fall back to manual entry

### 8. New Setup Not in List
- AI asks: "Add 'XYZ' to your setups?"
- POST to `/api/config/setups`
- Backwards compatible

---

## Development Sequence

### Phase 1: Foundation (Week 1)
1. Project setup (backend + frontend structure)
2. SQLite database + schema
3. Basic Express server
4. React app with routing

### Phase 2: Core Backend (Week 2)
5. Database CRUD operations
6. Claude API integration
7. OCR setup (Tesseract.js)
8. Stats calculation functions

### Phase 3: Setup & Config (Week 2-3)
9. First-time setup wizard (frontend + backend)
10. Settings page
11. Config API endpoints

### Phase 4: Main Workflows (Week 3-4)
12. Chat interface component
13. Daily Outlook flow
14. New Trade flow
15. Trade Updates flow
16. Close Trade flow
17. Daily Review flow

### Phase 5: Views & UX (Week 4-5)
18. Trade list with search
19. Trade detail view
20. Dashboard with stats
21. Markdown editor for journal notes

### Phase 6: Polish & Testing (Week 5-6)
22. All edge cases
23. Export functionality
24. End-to-end testing
25. Bug fixes and refinements

---

## File Structure

```
trading-journal/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── db/
│   │   │   ├── database.js       # SQLite connection
│   │   │   └── schema.sql        # CREATE TABLE statements
│   │   ├── routes/
│   │   │   ├── trades.js
│   │   │   ├── trading-days.js
│   │   │   ├── chat.js
│   │   │   ├── stats.js
│   │   │   └── config.js
│   │   ├── services/
│   │   │   ├── ai.js             # Claude API
│   │   │   ├── ocr.js            # Tesseract
│   │   │   ├── stats.js          # Calculations
│   │   │   └── trade-numbering.js
│   │   └── utils/
│   │       ├── vocabulary.js     # Normalize terms
│   │       └── validators.js
│   ├── uploads/screenshots/
│   ├── data/trading.db
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── TradeList.jsx
│   │   │   ├── TradeDetail.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── Setup.jsx
│   │   ├── components/
│   │   │   ├── ChatInterface.jsx
│   │   │   ├── TradeCard.jsx
│   │   │   ├── MarkdownEditor.jsx
│   │   │   ├── StatsDashboard.jsx
│   │   │   └── SearchBar.jsx
│   │   ├── api/client.js
│   │   └── utils/formatters.js
│   ├── package.json
│   └── vite.config.js
└── PRD.md (full documentation)
```

---

## MVP Checklist

**Must Have:**
- ✅ All 10 core features
- ✅ Chat-based AI interaction
- ✅ OCR screenshot processing
- ✅ Stats auto-calculation
- ✅ Emotion tracking
- ✅ 8 edge cases handled
- ✅ Export to CSV/JSON

**Out of Scope (Phase 2):**
- ❌ Historical data import
- ❌ Advanced charts/analytics
- ❌ Notion-like block editor (using simple markdown instead)
- ❌ Mobile app
- ❌ Cloud sync

---

## Key Design Decisions

1. **Trade Numbering:** Date-based (YYYY-MM-DD-T1, T2, etc.) instead of quarter-based for MVP simplicity
2. **Screenshot Storage:** Files in `uploads/screenshots/`, paths in database
3. **Journal Notes:** Separate from trade data, use markdown editor
4. **Updates:** Never consolidated in database, always separate rows, UI shows timeline
5. **AI Context:** Session-based (new session per entry type), linked via `entity_id`
6. **Stats:** Calculated on-demand from database, no caching in MVP
7. **Locations:** Auto-generated list, user can add custom
8. **Triggers:** Hybrid (predefined + free-form)

---

## Testing Approach

### User Flow Testing
1. Complete first-day journey (see PRD Flow 1)
2. Test multiple simultaneous trades
3. Test all edge cases (see 8 scenarios above)

### Data Integrity
1. Stats calculation accuracy
2. Trade numbering sequence
3. Update linking to correct trade
4. Screenshot file storage/retrieval

### AI Behavior
1. Vocabulary normalization
2. Setup/location/trigger extraction
3. Emotion prompting
4. Historical stats retrieval
5. Date inference for reviews

---

## Quick Commands

```bash
# Backend
cd backend
npm run dev  # Start Express server (port 3001)

# Frontend
cd frontend
npm run dev  # Start Vite dev server (port 3000)

# Database
sqlite3 backend/data/trading.db
.schema  # Show all tables
SELECT * FROM trades;  # Query trades

# Test API
curl http://localhost:3001/api/trades
curl http://localhost:3001/api/config
```

---

## Environment Variables

```bash
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
DB_PATH=./data/trading.db
UPLOAD_DIR=./uploads/screenshots
```

---

## Common Patterns

### Database Query Pattern
```javascript
const db = require('./db/database');
const trades = db.prepare('SELECT * FROM trades WHERE status = ?').all('open');
```

### AI Call Pattern
```javascript
const systemPrompt = buildSystemPrompt(sessionType, userConfig, context);
const response = await claude.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  system: systemPrompt,
  messages: chatHistory
});
```

### Stats Query Pattern
```javascript
const stats = db.prepare(`
  SELECT
    setup,
    COUNT(*) as total_trades,
    SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins
  FROM trades
  WHERE status = 'closed'
  GROUP BY setup
`).all();
```

---

**For full details, see PRD.md**
