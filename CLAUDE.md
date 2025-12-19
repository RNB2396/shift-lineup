# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chick-fil-A Shift Lineup Manager - a web app that automatically assigns employees to kitchen positions based on staffing levels, time of day, and employee skills.

## Commands

### Backend (Express.js)
```bash
cd backend
npm install          # Install dependencies
npm run dev          # Development with nodemon
npm start            # Production start
```

### Frontend (React + Vite)
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Development server (localhost:5173)
npm run build        # Production build
npm run lint         # ESLint
```

## Architecture

### Backend (`backend/`)
- **server.js**: Express API with CRUD for employees, lineup generation, and Excel export
- **config/supabase.js**: Supabase client (falls back to local JSON if not configured)
- **config/positionLayouts.js**: Position layouts per shift period (morning/lunch/midday/dinner/lateNight) and staffing level (4-8 people)
- **services/lineupGenerator.js**: Core algorithm that assigns employees to positions using greedy matching with priority scoring
- **services/excelExporter.js**: Generates Excel files using exceljs

### Frontend (`frontend/src/`)
- **App.jsx**: Main component with tabs (Lineup, Saved Lineups, Employees)
- **components/EmployeeManager.jsx**: CRUD for employees with position skill selection
- **components/ShiftInput.jsx**: Add employees to today's shift with times
- **components/LineupDisplay.jsx**: Shows generated lineups, save/export buttons
- **components/SavedLineups.jsx**: View saved lineups with drag-and-drop position swapping
- **lib/supabase.js**: Supabase client + lineupService for saved lineup operations
- **api.js**: Axios API client for backend communication

### Database (Supabase)
- **employees**: id, name, is_minor, positions[], best_positions[]
- **shifts**: employee_id, shift_date, start_time, end_time, is_shift_lead
- **lineups**: lineup_date, start_time, end_time, shift_period, people_count
- **lineup_assignments**: lineup_id, employee_id, position, match_quality, needs_break
- **positions**: Reference table with 8 default positions

## Key Business Logic

### Position Assignment Algorithm (`lineupGenerator.js`)
1. Positions filled by priority: lead → breading → machines → primary → secondary1 → DT fries → secondary2 → buns → FC fries
2. Employees scored: 10 pts for "best" position, 5 pts for "capable", +20 pts for staying in same position across periods
3. Shift lead floats and can place themselves anywhere

### Break Rules
- Minors: Required break at 4.5+ hours, optional at 4+ hours
- Adults: Required break at 7.5+ hours, optional at 7+ hours

### Shift Periods
- Morning: 6:00-10:30 (breakfast positions: hashbrowns, griddle, fileter)
- Lunch: 10:30-14:00
- Midday: 14:00-17:00
- Dinner: 17:00-20:00
- Late Night: 20:00-22:00

## Deployment

- **Frontend**: Netlify (auto-deploys from GitHub)
- **Backend**: Railway (auto-deploys from GitHub)
- **Database**: Supabase

### Environment Variables
Frontend (Netlify):
- `VITE_API_URL`: Railway backend URL
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key

Backend (Railway):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`: Database connection
- `FRONTEND_URL`: Netlify URL (for CORS)
- `NODE_ENV`: production

## MCP Servers Available

- **supabase**: Database operations, migrations, TypeScript type generation
- **netlify**: Frontend deployment management
- **railway**: Backend deployment management
