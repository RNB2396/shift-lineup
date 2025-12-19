require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { supabase } = require('./config/supabase');
const { allPositions } = require('./config/positionLayouts');
const { generateLineups } = require('./services/lineupGenerator');
const { exportToBuffer } = require('./services/excelExporter');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// Data file path (fallback for local development without Supabase)
const DATA_FILE = path.join(__dirname, 'data', 'employees.json');

// Helper to read employees from JSON file (fallback)
function readEmployeesFromFile() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { employees: [] };
  }
}

// Helper to write employees to JSON file (fallback)
function writeEmployeesToFile(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Convert Supabase row to API format
function toApiFormat(row) {
  return {
    id: row.id,
    name: row.name,
    isMinor: row.is_minor,
    positions: row.positions || [],
    bestPositions: row.best_positions || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Convert API format to Supabase row
function toDbFormat(data) {
  return {
    name: data.name,
    is_minor: data.isMinor || false,
    positions: data.positions || [],
    best_positions: data.bestPositions || []
  };
}

// ========== Employee Routes ==========

// Get all employees
app.get('/api/employees', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');

      if (error) throw error;
      res.json(data.map(toApiFormat));
    } else {
      const data = readEmployeesFromFile();
      res.json(data.employees);
    }
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get single employee
app.get('/api/employees/:id', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Employee not found' });
        }
        throw error;
      }
      res.json(toApiFormat(data));
    } else {
      const data = readEmployeesFromFile();
      const employee = data.employees.find(e => e.id === req.params.id);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      res.json(employee);
    }
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// Create employee
app.post('/api/employees', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('employees')
        .insert([toDbFormat(req.body)])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json(toApiFormat(data));
    } else {
      const data = readEmployeesFromFile();
      const newEmployee = {
        id: Date.now().toString(),
        name: req.body.name,
        isMinor: req.body.isMinor || false,
        positions: req.body.positions || [],
        bestPositions: req.body.bestPositions || [],
        createdAt: new Date().toISOString()
      };

      data.employees.push(newEmployee);
      writeEmployeesToFile(data);
      res.status(201).json(newEmployee);
    }
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Update employee
app.put('/api/employees/:id', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('employees')
        .update(toDbFormat(req.body))
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Employee not found' });
        }
        throw error;
      }
      res.json(toApiFormat(data));
    } else {
      const data = readEmployeesFromFile();
      const index = data.employees.findIndex(e => e.id === req.params.id);

      if (index === -1) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      data.employees[index] = {
        ...data.employees[index],
        name: req.body.name ?? data.employees[index].name,
        isMinor: req.body.isMinor ?? data.employees[index].isMinor,
        positions: req.body.positions ?? data.employees[index].positions,
        bestPositions: req.body.bestPositions ?? data.employees[index].bestPositions,
        updatedAt: new Date().toISOString()
      };

      writeEmployeesToFile(data);
      res.json(data.employees[index]);
    }
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Delete employee
app.delete('/api/employees/:id', async (req, res) => {
  try {
    if (supabase) {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', req.params.id);

      if (error) throw error;
      res.status(204).send();
    } else {
      const data = readEmployeesFromFile();
      const index = data.employees.findIndex(e => e.id === req.params.id);

      if (index === -1) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      data.employees.splice(index, 1);
      writeEmployeesToFile(data);
      res.status(204).send();
    }
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// ========== Position Routes ==========

// Get all available positions
app.get('/api/positions', (req, res) => {
  res.json(allPositions);
});

// ========== Lineup Routes ==========

// Generate lineup
app.post('/api/lineup/generate', async (req, res) => {
  try {
    const { shiftAssignments } = req.body;

    if (!shiftAssignments || !Array.isArray(shiftAssignments)) {
      return res.status(400).json({ error: 'shiftAssignments array is required' });
    }

    let employees = [];
    if (supabase) {
      const { data, error } = await supabase
        .from('employees')
        .select('*');

      if (error) throw error;
      employees = data.map(toApiFormat);
    } else {
      const data = readEmployeesFromFile();
      employees = data.employees;
    }

    const lineups = generateLineups(shiftAssignments, employees);
    res.json({ lineups });
  } catch (error) {
    console.error('Error generating lineup:', error);
    res.status(500).json({ error: 'Failed to generate lineup' });
  }
});

// Export lineup to Excel
app.post('/api/lineup/export', async (req, res) => {
  try {
    const { lineups } = req.body;

    if (!lineups || !Array.isArray(lineups)) {
      return res.status(400).json({ error: 'lineups array is required' });
    }

    const buffer = await exportToBuffer(lineups);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=lineup.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting lineup:', error);
    res.status(500).json({ error: 'Failed to export lineup' });
  }
});

// Health check endpoint (useful for Railway)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== Start Server ==========

app.listen(PORT, () => {
  console.log(`Shift Lineup API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${supabase ? 'Supabase' : 'Local JSON file'}`);
  console.log('Available endpoints:');
  console.log('  GET    /api/employees      - List all employees');
  console.log('  POST   /api/employees      - Create employee');
  console.log('  PUT    /api/employees/:id  - Update employee');
  console.log('  DELETE /api/employees/:id  - Delete employee');
  console.log('  GET    /api/positions      - List all positions');
  console.log('  POST   /api/lineup/generate - Generate lineup');
  console.log('  POST   /api/lineup/export  - Export to Excel');
  console.log('  GET    /health             - Health check');
});
