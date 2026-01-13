# Trading Journal MVP

An AI-powered trading journal that automatically logs crypto trades from screenshots, tracks emotional states, calculates performance metrics, and provides intelligent feedback.

---

## Documentation

📄 **[PRD.md](./PRD.md)** - Complete Product Requirements Document
Complete specifications, user flows, edge cases, and testing checklist.

⚡ **[IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md)** - Quick Reference for Development
Fast lookup guide with code snippets, API routes, and development sequence.

📊 **[Trading Journal Vibe Code.md](./Trading%20Journal%20Vibe%20Code%202e513c5fd0968005b67cd6c7fe1ceed3.md)** - Original Vision
Your initial requirements and feature wishlist.

📈 **[2026-01-14-Trading Style.md](./2026-01-14-Trading%20Style%202e713c5fd096802ab3c6f9da646c2f9e.md)** - Trading Methodology
Your VWAP-based trading approach, setups, and vocabulary.

---

## What This App Does

### Core Value
Eliminates journaling friction by auto-logging trades from screenshots while forcing disciplined planning, execution tracking, and emotional awareness.

### Key Features
1. **Daily Outlook** - Plan your trading day with AI guidance
2. **Smart Trade Logging** - Upload screenshot, AI extracts data
3. **Emotion Tracking** - Capture feelings throughout trade lifecycle
4. **Auto Stats** - Win rate, profit ratio, expectancy per setup
5. **Daily Review** - Close the loop, analyze performance
6. **Smart Search** - Find trades by setup, location, emotion, outcome
7. **Accountability** - AI prompts for missing reviews before new day

---

## Tech Stack

**Backend:**
- Node.js + Express
- SQLite (single-file database)
- Claude API (Anthropic)
- Tesseract.js (OCR)

**Frontend:**
- React + Vite
- React Router
- react-dropzone (drag-drop uploads)
- recharts (stats visualization)
- react-markdown (journal editor)

**Architecture:**
- Local web app (localhost:3000)
- No authentication (single-user only)
- REST API

---

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Claude API key ([get one here](https://console.anthropic.com/))

### Setup
```bash
# Clone or navigate to project directory
cd "Trading Journal App"

# Install backend dependencies
cd backend
npm install express better-sqlite3 @anthropic-ai/sdk tesseract.js multer cors dotenv
echo "ANTHROPIC_API_KEY=your_api_key_here" > .env

# Install frontend dependencies
cd ../frontend
npm create vite@latest . -- --template react
npm install react-router-dom react-dropzone react-markdown recharts axios

# Start development
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev

# Open browser to localhost:3000
```

---

## Getting Started

### Fresh Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/VirtualKenji/trading-journal.git
   cd trading-journal
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env and add your ANTHROPIC_API_KEY
   ```

4. **Initialize the database**
   ```bash
   npm run db:init
   ```

5. **Start the backend server** (Terminal 1)
   ```bash
   npm run backend
   # Server runs on http://localhost:3001
   ```

6. **Start the frontend** (Terminal 2)
   ```bash
   npm run frontend
   # Frontend runs on http://localhost:3000
   ```

7. **Verify setup**
   - Open browser to http://localhost:3000
   - Should see "Trading Journal MVP" page
   - Green box shows backend health check (connected database, table count)

### Current Phase Status

**✅ Phase 1 Complete: Foundation**
- Backend server running (Express + SQLite)
- Frontend running (React + Vite)
- Database initialized (8 tables)
- API communication working

**🚧 Next Phase: Core Features**
- Coming soon: Setup wizard, trade logging, stats calculation

---

## Project Structure

```
trading-journal/
├── backend/
│   ├── src/
│   │   ├── server.js           # Express entry point
│   │   ├── db/                 # Database schema & connection
│   │   ├── routes/             # API endpoints
│   │   ├── services/           # Claude API, OCR, stats
│   │   └── utils/              # Vocabulary, validation
│   ├── uploads/screenshots/    # User images
│   ├── data/trading.db         # SQLite database
│   └── .env                    # ANTHROPIC_API_KEY
├── frontend/
│   ├── src/
│   │   ├── pages/              # Dashboard, TradeList, etc.
│   │   ├── components/         # ChatInterface, etc.
│   │   └── api/                # Backend API client
│   └── vite.config.js
├── PRD.md                      # Full requirements
├── IMPLEMENTATION-GUIDE.md     # Quick reference
└── README.md                   # This file
```

---

## User Journey (Typical Day)

**Morning:**
1. Open app → Click "New Daily Outlook"
2. Chat with AI about your bias, setups, plans
3. AI shows historical stats for your planned setups
4. Outlook saved, visible on dashboard

**During Trading:**
5. Enter trade on exchange, take screenshot
6. Click "Log New Trade" → Upload screenshot
7. AI extracts entry, size, leverage via OCR
8. You describe setup/location, AI captures emotion
9. AI checks if trade matches your plan
10. Trade logged with auto-number (2026-01-14-T1)

**Mid-Trade:**
11. Feeling nervous? Click "Update Trade"
12. AI captures your emotion and notes
13. Multiple updates tracked chronologically

**Close Trade:**
14. Exit position, take screenshot
15. Click "Close Trade" → Upload exit screenshot
16. AI calculates PnL, all stats auto-update

**Evening:**
17. Click "Daily Review"
18. AI summarizes your day, compares plan vs execution
19. You reflect, AI grades: analysis, execution, emotion
20. Review saved, loop closed

---

## Key Concepts

### Trading Data Model
- **Setup** - Type of trade (Breakout, Mean Reversion, CME Gap Fill, etc.)
- **Location** - Where you enter (dVWAP VAH, wVWAP VAL 2SD, H4 Clinic Trend, etc.)
- **Trigger** - What confirms entry (rejection, AGGR climax, OI flush, etc.)
- **Emotion** - How you feel (confident, anxious, tilted, calm, etc.)

### Metrics Tracked
- **Win Rate** - % of winning trades
- **Profit Ratio** - Average win size : average loss size
- **Trade Expectancy** - (Win Rate × Profit Ratio) - ((1 - Win Rate) × 1)
- **Average Position Size** - Typical size for each setup
- **Emotional State** - Correlation between emotion and outcome

### AI Intelligence
- Normalizes your trading vocabulary (maps "1D Trend" → "Daily Clinic Trend")
- Extracts setup/location/trigger from natural language
- Compares trades to daily outlook (planned vs FOMO)
- Flags emotional over-trading (multiple updates in 30 min)
- Prompts for missing reviews before new day

---

## MVP Scope

### ✅ In Scope
- All 10 core features (see PRD.md)
- Chat-based AI interaction
- OCR screenshot processing
- Auto-calculated stats
- Emotion tracking per trade
- Smart search & filters
- Daily outlook → trades → review loop
- Export to CSV/JSON
- 8 critical edge cases handled

### ❌ Out of Scope (Phase 2)
- Historical data import (50-200 old trades)
- Advanced analytics dashboard
- Notion-like block editor
- Mobile app
- Cloud sync / multi-device
- Direct broker API integration
- Real-time price feeds

---

## Development Roadmap

**Week 1:** Foundation
- Project setup, database schema, basic server

**Week 2:** Core Backend
- CRUD operations, Claude API, OCR, stats calculations

**Week 3:** Main Workflows
- Setup wizard, Daily Outlook, New Trade, Updates, Close, Review

**Week 4:** Views & UX
- Trade list, detail view, dashboard, markdown editor

**Week 5:** Polish
- Edge cases, export, testing

**Week 6:** Bug Fixes & Launch
- End-to-end testing, refinements, deploy locally

**Estimated Time:** 4-6 weeks for solo developer with moderate Node.js/React experience

---

## Configuration Files Needed

### backend/.env
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=3001
DB_PATH=./data/trading.db
UPLOAD_DIR=./uploads/screenshots
```

### backend/package.json (scripts)
```json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js"
  }
}
```

### frontend/vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
```

---

## First Steps After Setup

1. **Read PRD.md** - Understand the full scope and requirements
2. **Review IMPLEMENTATION-GUIDE.md** - Quick reference for development
3. **Create database schema** - See `backend/src/db/schema.sql` (from PRD)
4. **Build setup wizard** - First feature users see
5. **Implement Daily Outlook** - First core workflow
6. **Test with real usage** - Use it yourself for a week before adding more features

---

## Database Schema (8 Tables)

1. `trading_days` - Daily outlook & review
2. `trades` - Core trade records
3. `trade_updates` - Updates while trade open
4. `screenshots` - Uploaded images
5. `journal_entries` - Markdown notes
6. `chat_sessions` - AI conversation history
7. `system_config` - User settings (key-value store)

See PRD.md for complete CREATE TABLE statements.

---

## API Overview

### Core Endpoints
- `POST /api/chat/message` - Send message to AI
- `POST /api/trades` - Create trade
- `GET /api/trades` - List trades (with filters)
- `POST /api/trades/:id/updates` - Add update
- `POST /api/trades/:id/close` - Close trade
- `GET /api/stats/by-setup` - Stats per setup
- `GET /api/export/csv` - Export all trades

See IMPLEMENTATION-GUIDE.md for full API reference.

---

## Your Trading Style (Configured on First Launch)

**Approach:** VWAP-based with clinic trends and orderflow

**Setups:**
1. Breakout/Breakdown - Price leaving value
2. Mean Reversion - External ranges back to center
3. CME Gap Fills - Filling weekend gaps
4. Mean to Edge - Strong triggers mid-range
5. FOMO - Emotional trades (tracking for improvement)

**Key Levels:**
- VWAP timeframes: Daily, Weekly, Monthly, Quarterly, Yearly
- Each has: VAH 2SD, VAH, vWAP, VAL, VAL 2SD
- Comp levels: cVAH, cVAL, POC
- Clinic Trends: H4, 1D, 1W (EMA 100 + EMA 200)

**Orderflow:**
- AGGR (buyer/seller climax)
- OI (Open Interest flushes/surges)

---

## Testing Checklist

Before considering MVP complete, verify:

- [ ] Setup wizard works, saves config
- [ ] Can create Daily Outlook via chat
- [ ] Can log new trade with screenshot
- [ ] OCR extracts entry/size/leverage correctly
- [ ] AI extracts setup/location/trigger from text
- [ ] Can update open trade
- [ ] Can close trade, PnL calculated
- [ ] Stats auto-recalculate after close
- [ ] Can create Daily Review (same day and next morning)
- [ ] Trade list shows all trades
- [ ] Search works (by setup, location, outcome)
- [ ] Trade detail shows full timeline
- [ ] Can edit trade via form or AI chat
- [ ] Dashboard shows accurate stats
- [ ] Export to CSV works
- [ ] All 8 edge cases handled (see PRD)

---

## Common Issues & Solutions

**OCR not extracting numbers:**
- Check screenshot clarity
- Ensure text is visible, not just chart
- Fall back to manual entry

**AI not recognizing setup:**
- Add to vocabulary in settings
- Use predefined terms from list
- AI will ask if ambiguous

**Stats seem wrong:**
- Check closed vs open trades filter
- Verify PnL values are entered
- Ensure outcome field is set (win/loss/breakeven)

**Multiple trades updating wrong one:**
- AI should prompt "Which trade?"
- Refer by number (T1), asset (BTC), or description

---

## Phase 2 Plans (Post-MVP)

After MVP is stable and tested:

1. **Historical Import** - Import 50-200 old trades from markdown
2. **Advanced Analytics** - Emotion correlation charts, pattern detection
3. **Enhanced Editor** - Notion-like blocks for journal notes
4. **Mobile Responsive** - Better mobile browser experience
5. **Broker Integration** - Auto-import from Hyperliquid/Binance API

---

## Resources

- **Claude API Docs:** https://docs.anthropic.com/
- **SQLite Docs:** https://www.sqlite.org/docs.html
- **React Docs:** https://react.dev/
- **Vite Docs:** https://vitejs.dev/

---

## Notes

- This is a **local-only app** for personal use
- Database file: `backend/data/trading.db` (backup regularly)
- Screenshots stored in: `backend/uploads/screenshots/`
- No cloud sync in MVP (backup manually or use git)
- Designed for **solo trader** (you)

---

## License & Usage

For personal use only. Not for redistribution.

---

**Ready to build? Start with PRD.md for full details, then use IMPLEMENTATION-GUIDE.md as you code.**

Good luck with your trading and development! 🚀
