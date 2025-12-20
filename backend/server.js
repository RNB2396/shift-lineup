require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { supabase } = require('./config/supabase');
const { allPositions } = require('./config/positionLayouts');
const { generateLineups } = require('./services/lineupGenerator');
const { exportToBuffer } = require('./services/excelExporter');
const { authMiddleware, requireStore, requireManager } = require('./middleware/auth');

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

// Convert Supabase employee row to API format
function toApiFormat(row) {
  return {
    id: row.id,
    name: row.name,
    isMinor: row.is_minor,
    positions: row.positions || [],
    bestPositions: row.best_positions || [],
    houseType: row.house_type || 'boh',
    storeId: row.store_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Convert API format to Supabase employee row
function toDbFormat(data, storeId) {
  return {
    name: data.name,
    is_minor: data.isMinor || false,
    positions: data.positions || [],
    best_positions: data.bestPositions || [],
    house_type: data.houseType || 'boh',
    store_id: storeId
  };
}

// Convert Supabase position row to API format
function positionToApiFormat(row) {
  return {
    id: row.id,
    name: row.name,
    houseType: row.house_type || 'boh',
    priority: row.priority || 99,
    timePeriods: row.time_periods || ['all'],
    isActive: row.is_active !== false,
    storeId: row.store_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Convert API format to Supabase position row
function positionToDbFormat(data, storeId) {
  return {
    name: data.name,
    house_type: data.houseType || 'boh',
    priority: data.priority || 99,
    time_periods: data.timePeriods || ['all'],
    is_active: data.isActive !== false,
    store_id: storeId
  };
}

// ========== Auth Routes ==========

// Get current user info
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email
    },
    stores: req.user.stores
  });
});

// ========== Employee Routes ==========

// Get all employees (for a specific store)
app.get('/api/employees', authMiddleware, requireStore, async (req, res) => {
  try {
    if (req.supabase) {
      const { data, error } = await req.supabase
        .from('employees')
        .select('*')
        .eq('store_id', req.store.id)
        .order('name');

      if (error) throw error;
      res.json(data.map(toApiFormat));
    } else {
      // Fallback for local dev
      const data = readEmployeesFromFile();
      res.json(data.employees);
    }
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get single employee
app.get('/api/employees/:id', authMiddleware, requireStore, async (req, res) => {
  try {
    if (req.supabase) {
      const { data, error } = await req.supabase
        .from('employees')
        .select('*')
        .eq('id', req.params.id)
        .eq('store_id', req.store.id)
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
app.post('/api/employees', authMiddleware, requireStore, requireManager, async (req, res) => {
  try {
    if (req.supabase) {
      const { data, error } = await req.supabase
        .from('employees')
        .insert([toDbFormat(req.body, req.store.id)])
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
app.put('/api/employees/:id', authMiddleware, requireStore, requireManager, async (req, res) => {
  try {
    if (req.supabase) {
      const { data, error } = await req.supabase
        .from('employees')
        .update(toDbFormat(req.body, req.store.id))
        .eq('id', req.params.id)
        .eq('store_id', req.store.id)
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
app.delete('/api/employees/:id', authMiddleware, requireStore, requireManager, async (req, res) => {
  try {
    if (req.supabase) {
      const { error } = await req.supabase
        .from('employees')
        .delete()
        .eq('id', req.params.id)
        .eq('store_id', req.store.id);

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

// Get all positions for a store (filtered by house_type if provided)
app.get('/api/positions', authMiddleware, requireStore, async (req, res) => {
  try {
    const { houseType } = req.query;

    if (req.supabase) {
      let query = req.supabase
        .from('positions')
        .select('*')
        .eq('store_id', req.store.id)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (houseType && ['foh', 'boh'].includes(houseType)) {
        query = query.eq('house_type', houseType);
      }

      const { data, error } = await query;

      if (error) throw error;
      res.json(data.map(positionToApiFormat));
    } else {
      // Fallback for local dev - return hardcoded positions
      res.json(allPositions.map((name, index) => ({
        id: `local-${index}`,
        name,
        houseType: 'boh',
        priority: index + 1,
        timePeriods: ['all'],
        isActive: true
      })));
    }
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Get single position
app.get('/api/positions/:id', authMiddleware, requireStore, async (req, res) => {
  try {
    if (req.supabase) {
      const { data, error } = await req.supabase
        .from('positions')
        .select('*')
        .eq('id', req.params.id)
        .eq('store_id', req.store.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Position not found' });
        }
        throw error;
      }
      res.json(positionToApiFormat(data));
    } else {
      res.status(404).json({ error: 'Position not found' });
    }
  } catch (error) {
    console.error('Error fetching position:', error);
    res.status(500).json({ error: 'Failed to fetch position' });
  }
});

// Create position
app.post('/api/positions', authMiddleware, requireStore, requireManager, async (req, res) => {
  try {
    if (req.supabase) {
      const { data, error } = await req.supabase
        .from('positions')
        .insert([positionToDbFormat(req.body, req.store.id)])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json(positionToApiFormat(data));
    } else {
      res.status(500).json({ error: 'Database not available' });
    }
  } catch (error) {
    console.error('Error creating position:', error);
    res.status(500).json({ error: 'Failed to create position' });
  }
});

// Update position
app.put('/api/positions/:id', authMiddleware, requireStore, requireManager, async (req, res) => {
  try {
    if (req.supabase) {
      const updateData = {
        name: req.body.name,
        house_type: req.body.houseType,
        priority: req.body.priority,
        time_periods: req.body.timePeriods,
        is_active: req.body.isActive
      };

      // Remove undefined fields
      Object.keys(updateData).forEach(key =>
        updateData[key] === undefined && delete updateData[key]
      );

      const { data, error } = await req.supabase
        .from('positions')
        .update(updateData)
        .eq('id', req.params.id)
        .eq('store_id', req.store.id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Position not found' });
        }
        throw error;
      }
      res.json(positionToApiFormat(data));
    } else {
      res.status(500).json({ error: 'Database not available' });
    }
  } catch (error) {
    console.error('Error updating position:', error);
    res.status(500).json({ error: 'Failed to update position' });
  }
});

// Delete position (soft delete)
app.delete('/api/positions/:id', authMiddleware, requireStore, requireManager, async (req, res) => {
  try {
    if (req.supabase) {
      const { error } = await req.supabase
        .from('positions')
        .update({ is_active: false })
        .eq('id', req.params.id)
        .eq('store_id', req.store.id);

      if (error) throw error;
      res.status(204).send();
    } else {
      res.status(500).json({ error: 'Database not available' });
    }
  } catch (error) {
    console.error('Error deleting position:', error);
    res.status(500).json({ error: 'Failed to delete position' });
  }
});

// ========== Lineup Routes ==========

// Generate lineup
app.post('/api/lineup/generate', authMiddleware, requireStore, async (req, res) => {
  try {
    const { shiftAssignments, houseType } = req.body;

    if (!shiftAssignments || !Array.isArray(shiftAssignments)) {
      return res.status(400).json({ error: 'shiftAssignments array is required' });
    }

    let employees = [];
    let positions = [];

    if (req.supabase) {
      // Fetch employees
      const { data: empData, error: empError } = await req.supabase
        .from('employees')
        .select('*')
        .eq('store_id', req.store.id);

      if (empError) throw empError;
      employees = empData.map(toApiFormat);

      // Fetch positions for this store and house type
      let positionsQuery = req.supabase
        .from('positions')
        .select('*')
        .eq('store_id', req.store.id)
        .eq('is_active', true);

      if (houseType && ['foh', 'boh'].includes(houseType)) {
        positionsQuery = positionsQuery.eq('house_type', houseType);
      }

      const { data: posData, error: posError } = await positionsQuery.order('priority', { ascending: true });
      if (posError) throw posError;

      // Convert to API format (snake_case to camelCase)
      positions = (posData || []).map(pos => ({
        id: pos.id,
        name: pos.name,
        houseType: pos.house_type,
        priority: pos.priority,
        timePeriods: pos.time_periods || ['all']
      }));
    } else {
      const data = readEmployeesFromFile();
      employees = data.employees;
      // No positions in local file mode - generator will need defaults
    }

    // Filter employees by house type if specified
    if (houseType && ['foh', 'boh'].includes(houseType)) {
      employees = employees.filter(emp => {
        const empHouseType = emp.houseType || 'boh';
        return empHouseType === houseType || empHouseType === 'both';
      });
    }

    const result = generateLineups(shiftAssignments, employees, positions);
    res.json({ lineups: result.lineups, closingLineup: result.closingLineup, houseType: houseType || 'boh' });
  } catch (error) {
    console.error('Error generating lineup:', error);
    res.status(500).json({ error: 'Failed to generate lineup' });
  }
});

// Export lineup to Excel
app.post('/api/lineup/export', authMiddleware, requireStore, async (req, res) => {
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
  console.log('  GET    /api/auth/me         - Get current user info');
  console.log('  GET    /api/employees       - List all employees');
  console.log('  POST   /api/employees       - Create employee');
  console.log('  PUT    /api/employees/:id   - Update employee');
  console.log('  DELETE /api/employees/:id   - Delete employee');
  console.log('  GET    /api/positions       - List all positions');
  console.log('  POST   /api/positions       - Create position');
  console.log('  PUT    /api/positions/:id   - Update position');
  console.log('  DELETE /api/positions/:id   - Delete position');
  console.log('  POST   /api/lineup/generate - Generate lineup');
  console.log('  POST   /api/lineup/export   - Export to Excel');
  console.log('  GET    /health              - Health check');
});
# Health check comment
