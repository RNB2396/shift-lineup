# Implementation Plan: FOH/BOH Toggle & Custom Positions

## Overview

Add Front of House (FOH) and Back of House (BOH) separation with:
1. FOH/BOH toggle on main screens (Lineup, Employees, Saved Lineups)
2. Employee house assignment (FOH, BOH, or Both)
3. Custom positions management with priorities and time periods
4. Positions are completely separate between FOH and BOH
5. Same time periods for both (morning, lunch, midday, dinner, lateNight)

---

## Phase 1: Database Schema Changes

### 1.1 Update `positions` table
```sql
ALTER TABLE positions ADD COLUMN house_type TEXT CHECK (house_type IN ('foh', 'boh')) DEFAULT 'boh';
ALTER TABLE positions ADD COLUMN priority INTEGER DEFAULT 99;
ALTER TABLE positions ADD COLUMN store_id UUID REFERENCES stores(id);
ALTER TABLE positions ADD COLUMN time_periods TEXT[] DEFAULT ARRAY['all']::TEXT[];
-- time_periods stores which shift periods this position is used in
-- e.g., {'morning', 'lunch', 'dinner'} or {'all'}
```

### 1.2 Update `employees` table
```sql
ALTER TABLE employees ADD COLUMN house_type TEXT CHECK (house_type IN ('foh', 'boh', 'both')) DEFAULT 'boh';
```

### 1.3 Update `lineups` table
```sql
ALTER TABLE lineups ADD COLUMN house_type TEXT CHECK (house_type IN ('foh', 'boh')) DEFAULT 'boh';
```

### 1.4 Update RLS policies
- Add store_id filter to positions table RLS
- Allow stores to manage their own positions

---

## Phase 2: Backend Changes

### 2.1 New Position API endpoints (`backend/server.js`)
- `GET /api/positions` - Already exists, update to filter by store_id and optionally by house_type
- `POST /api/positions` - Create new position (requires manager role)
- `PUT /api/positions/:id` - Update position (name, priority, time_periods)
- `DELETE /api/positions/:id` - Delete position (soft delete via is_active flag)

### 2.2 Update Employee API
- Update `toApiFormat()` and `toDbFormat()` to include `houseType` field

### 2.3 Update Lineup Generator (`backend/services/lineupGenerator.js`)
- Accept `houseType` parameter to filter positions
- Use database positions instead of hardcoded `positionLayouts`
- Dynamic priority from positions table instead of hardcoded `positionPriorities`

### 2.4 Update Position Layouts (`backend/config/positionLayouts.js`)
- Create function to build layouts from database positions
- Accept store_id and house_type to fetch relevant positions
- Keep fallback to default positions if store has none configured

---

## Phase 3: Frontend Changes

### 3.1 New Component: `PositionManager.jsx`
Location: `frontend/src/components/PositionManager.jsx`

Features:
- List all positions for the store (grouped by FOH/BOH tabs)
- Add new position form:
  - Name (text)
  - House type (FOH/BOH dropdown)
  - Priority (number, lower = higher priority)
  - Time periods (multi-select: morning, lunch, midday, dinner, lateNight, or "all")
- Edit existing positions inline
- Delete/deactivate positions
- Drag to reorder (updates priority)

### 3.2 New Component: `HouseToggle.jsx`
Location: `frontend/src/components/HouseToggle.jsx`

Reusable toggle component for FOH/BOH switching:
- Pill-style toggle buttons: `[Front of House] [Back of House]`
- Props: `value`, `onChange`
- Consistent styling across all screens

### 3.3 Update `App.jsx`
- Add "Positions" tab (visible to managers only, between Employees and Team)
- Add FOH/BOH toggle state at app level
- Pass `houseType` to child components
- Place HouseToggle in header next to store badge

### 3.4 Update `EmployeeManager.jsx`
- Add house type selector in employee form (FOH, BOH, or Both radio buttons)
- Filter displayed employees based on FOH/BOH toggle
- Only show positions relevant to selected house type in position picker
- Fetch positions from API instead of hardcoded list

### 3.5 Update `ShiftInput.jsx`
- Filter employees based on FOH/BOH toggle
- Only show employees assigned to current house type (or "both")

### 3.6 Update `LineupDisplay.jsx`
- Pass house type to lineup generation API
- Display positions for selected house type only

### 3.7 Update `SavedLineups.jsx`
- Lineups already filtered by date; also filter by house_type
- Store house_type when saving lineups

### 3.8 Update `api.js`
- Add position API functions (getAll, create, update, delete)
- Update employee API to handle house type
- Update lineup generation to accept house type

### 3.9 Update `lib/supabase.js`
- Include house_type when saving/loading lineups
- Filter lineups by house_type in queries

---

## File Changes Summary

### New Files:
1. `frontend/src/components/PositionManager.jsx` - Position CRUD UI
2. `frontend/src/components/HouseToggle.jsx` - Reusable FOH/BOH toggle

### Modified Files:
1. `backend/server.js` - Add position CRUD endpoints, update employee endpoints
2. `backend/services/lineupGenerator.js` - Use dynamic positions, accept houseType
3. `backend/config/positionLayouts.js` - Build layouts from DB positions
4. `frontend/src/App.jsx` - Add Positions tab, FOH/BOH state, header toggle
5. `frontend/src/components/EmployeeManager.jsx` - Add house type field, dynamic positions
6. `frontend/src/components/ShiftInput.jsx` - Filter by house type
7. `frontend/src/components/LineupDisplay.jsx` - Pass house type to API
8. `frontend/src/components/SavedLineups.jsx` - Filter by house type
9. `frontend/src/api.js` - Add position API calls
10. `frontend/src/lib/supabase.js` - Include house_type in lineup queries

---

## Implementation Order

1. **Database migrations** - Schema changes first (positions, employees, lineups)
2. **Backend position API** - CRUD endpoints for positions
3. **Update employee API** - Add houseType field
4. **HouseToggle component** - Create reusable toggle UI
5. **PositionManager component** - Position management screen
6. **Update App.jsx** - Add Positions tab and header toggle
7. **Update EmployeeManager** - House type in employee form, dynamic positions
8. **Update lineup generator** - Use dynamic positions with house type
9. **Update ShiftInput/LineupDisplay** - Filter by house type
10. **Update SavedLineups** - Include house type in saves/loads
11. **Testing and polish** - Verify all flows work

---

## UI Design Notes

### FOH/BOH Toggle Placement
- In the header bar, next to the store name badge
- Pill-style toggle: `[Front of House] [Back of House]`
- Active side highlighted with primary color
- Toggle is visible on: Lineup, Employees, Saved Lineups tabs

### Positions Tab
- New tab between "Employees" and "Team"
- Two sub-tabs or sections: FOH Positions | BOH Positions
- Each position shows: Name, Priority #, Time Periods
- Add button at top, inline edit on click, delete button

### Employee Form House Type
- Radio buttons: ( ) Front of House  ( ) Back of House  ( ) Both
- Default to current toggle selection
- Position picker updates based on house type selection

---

## Data Migration

For existing data:
- Existing positions default to `house_type = 'boh'` (current BOH positions)
- Existing employees default to `house_type = 'boh'`
- Existing lineups default to `house_type = 'boh'`
- Stores can then add FOH positions and reassign employees as needed
