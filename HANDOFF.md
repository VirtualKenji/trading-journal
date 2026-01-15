# Trading Journal App - Handoff Context

## Project Overview

A chat-first trading journal application with natural language interface. No forms/filters - everything through conversation.

## Repository

https://github.com/VirtualKenji/trading-journal.git

## Tech Stack

- **Frontend**: React 19 + Vite (port 3000)
- **Backend**: Express.js + SQLite (port 3001)
- **Intent Parsing**: Hybrid (LLM with keyword fallback)

## Current State (as of commit 1d8a248)

### What's Working

1. **Chat UI** at http://localhost:3000 - send messages, see markdown responses
2. **Color-coded UX** - Long (emerald), Short (rose), Locations (cyan), Triggers (violet), Wins (gold), Losses (red), Lessons (orange)
3. **Full trade editing** - all fields editable via PUT endpoint including pnl, outcome, status
4. **New trade fields**: `entry_trigger`, `emotional_trigger`, `is_test`, `notes`
5. **Daily Outlook + Daily Review** system working
6. **Commands that work**:
   - "open trades", "trade history", "stats"
   - "outlook", "show lessons"
   - "open BTC long at 97500", "close T1"
   - "lesson: [insight]"

### Key Files

- `backend/src/routes/trades.js` - Trade CRUD with full field editing
- `backend/src/routes/trading-days.js` - Outlook and Review endpoints
- `frontend/src/services/formatters.js` - Markdown output with color spans
- `frontend/src/styles/message.css` - Color classes (.text-long, .text-short, etc.)

### Database Schema Updates

New columns added to `trades` table:
- `entry_trigger TEXT` - market/technical trigger for entry
- `emotional_trigger TEXT` - emotional state during trade
- `is_test BOOLEAN DEFAULT 0` - differentiate test vs real trades
- `notes TEXT` - general notes field

### To Start Development

```bash
cd "Trading Journal App"
cd backend && npm run dev    # starts on :3001
cd frontend && npm run dev   # starts on :3000
```

---

## Tomorrow's Focus: Screenshot OCR + Trade Detail View

### Priority 1: Trade Detail Window

Each trade should have its own expandable/modal view with:

1. **Screenshot paste/upload area** - paste from clipboard or drag-drop
2. **Auto-OCR extraction** - parse entry, exit, PnL, leverage from screenshot
3. **Editable notes section** - rich text or markdown
4. **All trade fields visible and editable**

### Priority 2: Screenshot OCR Integration

Backend already has OCR capability (see `backend/src/routes/screenshots.js`), needs:

1. **Frontend paste handler** - Ctrl+V to paste screenshot
2. **Preview before confirm** - show extracted data, let user confirm/edit
3. **Auto-fill trade fields** - populate entry_price, exit_price, pnl from OCR

### Technical Notes

- OCR endpoint exists: `POST /api/screenshots/extract`
- Uses Claude API for extraction (needs ANTHROPIC_API_KEY in backend/.env)
- Frontend already supports image attachments in ChatInput component

### UI Mockup for Trade Detail

```
┌─────────────────────────────────────────────────────┐
│ Trade 2026-01-15-T1                            [X]  │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────┐  Asset: BTC                     │
│ │                 │  Direction: Long                │
│ │  [Screenshot]   │  Entry: $95,974.15              │
│ │  Paste or Drop  │  Exit: $95,559.69               │
│ │                 │  P&L: -$45 (-0.45%)             │
│ └─────────────────┘  Outcome: Loss                  │
│                                                     │
│ Setup: Long MR at wVAL                              │
│ Location: Weekly VAL                                │
│ Entry Trigger: OI drop + seller exhaustion          │
│ Emotional Trigger: Panic at invalidation            │
│                                                     │
│ Notes:                                              │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [Editable markdown notes area]                  │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│                              [Save] [Delete Trade]  │
└─────────────────────────────────────────────────────┘
```

### User's Trading Abbreviations

Always expand/recognize these:
- MR → Mean Reversion
- OI → Open Interest
- PA → Price Action
- HTF/LTF → Higher/Lower Timeframe
- SFP → Swing Failure Pattern
- cVAL/cVAH → Composite Value Area Low/High
- dVWAP/mVWAP → Daily/Monthly VWAP
- 1D Trend, H4 Trend, 1W Trend → Clinic trend indicators

### Color Scheme Reference

```css
.text-long { color: #10b981; }    /* Emerald */
.text-short { color: #9f1239; }   /* Dark Rose */
.text-location { color: #06b6d4; } /* Cyan */
.text-trigger { color: #8b5cf6; }  /* Violet */
.text-win { color: #fbbf24; }      /* Gold */
.text-loss { color: #ef4444; }     /* Red */
.text-lesson { color: #f97316; }   /* Orange */
```

---

## Current Data State

- **2 trades** logged (2026-01-15-T1, T2) - both losses, total -$77
- **1 lesson** saved (range bottom precision)
- **1 daily outlook** with review completed

## Known Issues

- Stats endpoint doesn't exist (calculate from trades)
- PnL auto-calculation from prices doesn't match user's stated PnL (use user's stated value)
- Setup direction parsing only works if name contains "long" or "short"
