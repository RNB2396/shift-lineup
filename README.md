# Chick-fil-A Shift Lineup Manager

A web application to help manage shift lineups at Chick-fil-A, automatically assigning employees to positions based on staffing levels and their skills.

## Features

- **Employee Management**: Add employees with their name, minor status, and position skills
- **Position Assignment**: Mark which positions each employee can work and their best positions
- **Automatic Lineup Generation**: Generates position assignments based on:
  - Number of people working at any given time
  - Shift period (morning, lunch, midday, dinner, late night)
  - Employee skills and best positions
- **Break Flagging**:
  - Minors: Required break at 4.5+ hours, optional at 4+ hours
  - Adults: Required break at 7.5+ hours, optional at 7+ hours
- **Excel Export**: Export lineups to Excel for easy printing/reference

## Position Layouts

The app uses your specific Chick-fil-A position layouts:

### Morning (6:00 AM - 10:30 AM)
- 4 people: fileter, breader, secondary1, hashbrowns/griddle
- 5 people: primary, secondary1, hashbrowns/griddle, breader, breaks
- 6 people: primary, secondary1, secondary2, hashbrowns/griddle, breader, breaks
- 7 people: primary, secondary1, secondary2, hashbrowns, griddle, breader, breaks
- 8 people: primary, primary2, secondary1, secondary2, hashbrowns, griddle, breader, breaks

### Lunch (10:30 AM - 2:00 PM)
- 5 people: primary, secondary1, breading, machines, DT fries
- 6 people: primary, secondary1, secondary2/buns, breading, machines, fries
- 7 people: primary, secondary1, breading, machines, DT fries, buns
- 8 people: primary, secondary1, secondary2, breading, machines, buns, DT fries, FC fries

### Midday (2:00 PM - 5:00 PM)
- 4 people: primary/DT fries, secondary1, breading, machines
- 5 people: primary, secondary1, breading, machines, DT fries
- 6 people: primary, secondary1, breading, machines, DT fries, checklist
- 7 people: primary, secondary1, secondary2/buns, breading, machines, DT fries, checklist

### Dinner (5:00 PM - 8:00 PM)
- 5 people: primary, secondary1, breading, machines, DT fries
- 6 people: primary, secondary1, breading, machines, DT fries, secondary2/breaks
- 7 people: primary, secondary1, breading, machines, DT fries, buns/breaks
- 8 people: primary, secondary1, breading, machines, DT fries, buns/breaks, FC fries

### Late Night (8:00 PM - 10:00 PM)
- 5 people: primary, secondary1, breading, machines, precloser/breaks
- 6 people: primary, secondary1, breading, machines, precloser/breaks, secondary2
- 7 people: primary, secondary1, breading, machines, 2 preclosers/breaks, secondary2

## Getting Started

### Prerequisites
- Node.js (v16 or higher)

### Installation

1. Install backend dependencies:
```bash
cd backend
npm install
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

### Running the Application

1. Start the backend server (in one terminal):
```bash
cd backend
npm start
```
The backend will run on http://localhost:3001

2. Start the frontend (in another terminal):
```bash
cd frontend
npm run dev
```
The frontend will run on http://localhost:5173

3. Open your browser to http://localhost:5173

## Usage

### 1. Add Employees
- Click the "Employees" tab
- Click "+ Add Employee"
- Enter their name
- Check "Minor" if they're under 18
- Click positions to select which ones they can work
- Click their best positions again to mark them as "best" (shown in green)
- Click "Add"

### 2. Create Today's Schedule
- Go to the "Lineup" tab
- Select an employee from the dropdown
- Set their start and end times
- Click "Add to Shift"
- Repeat for all employees working today

### 3. Generate Lineups
- Click "Generate Lineup"
- The app will create position assignments for each time period
- Green badges = employee's best position
- Blue badges = employee can do this position
- Red badges = fallback assignment (may need training)
- Yellow highlighted rows = employee needs a break

### 4. Export to Excel
- Click "Export to Excel" to download the lineup
- Print or share as needed

## Data Storage

Employee data is stored in `backend/data/employees.json`. This file persists between sessions, so your employee list will be saved.

Shift assignments are NOT saved - they need to be entered each day since schedules change.
