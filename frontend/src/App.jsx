import { useState, useEffect } from 'react';
import EmployeeManager from './components/EmployeeManager';
import ShiftInput from './components/ShiftInput';
import LineupDisplay from './components/LineupDisplay';
import SavedLineups from './components/SavedLineups';
import { employeeApi } from './api';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('lineup');
  const [employees, setEmployees] = useState([]);
  const [shiftAssignments, setShiftAssignments] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadEmployees = async () => {
    try {
      const data = await employeeApi.getAll();
      // Ensure we always have an array
      setEmployees(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading employees:', error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Chick-fil-A Shift Lineup</h1>
        <nav className="tabs">
          <button
            className={activeTab === 'lineup' ? 'active' : ''}
            onClick={() => setActiveTab('lineup')}
          >
            Lineup
          </button>
          <button
            className={activeTab === 'saved' ? 'active' : ''}
            onClick={() => setActiveTab('saved')}
          >
            Saved Lineups
          </button>
          <button
            className={activeTab === 'employees' ? 'active' : ''}
            onClick={() => setActiveTab('employees')}
          >
            Employees ({employees.length})
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'employees' ? (
          <EmployeeManager
            employees={employees}
            setEmployees={setEmployees}
            onRefresh={loadEmployees}
          />
        ) : activeTab === 'saved' ? (
          <SavedLineups />
        ) : (
          <div className="lineup-page">
            <ShiftInput
              employees={employees}
              shiftAssignments={shiftAssignments}
              setShiftAssignments={setShiftAssignments}
            />
            <LineupDisplay
              shiftAssignments={shiftAssignments}
              lineups={lineups}
              setLineups={setLineups}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
