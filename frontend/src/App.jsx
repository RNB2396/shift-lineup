import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import StoreSelector from './components/StoreSelector';
import ResetPassword from './components/ResetPassword';
import EmployeeManager from './components/EmployeeManager';
import ShiftInput from './components/ShiftInput';
import LineupDisplay from './components/LineupDisplay';
import SavedLineups from './components/SavedLineups';
import { employeeApi } from './api';
import './App.css';

function AppContent() {
  const {
    isAuthenticated,
    hasStore,
    loading: authLoading,
    stores,
    currentStore,
    logout
  } = useAuth();

  const [activeTab, setActiveTab] = useState('lineup');
  const [employees, setEmployees] = useState([]);
  const [shiftAssignments, setShiftAssignments] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);

  // Check if this is a password reset flow
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setIsResetPassword(true);
    }
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await employeeApi.getAll();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading employees:', error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only load employees when authenticated and a store is selected
    if (isAuthenticated && hasStore) {
      setLoading(true);
      loadEmployees();
    }
  }, [isAuthenticated, hasStore, currentStore?.id]);

  // Show loading while checking auth
  if (authLoading) {
    return <div className="loading">Loading...</div>;
  }

  // Show reset password page if in recovery flow
  if (isResetPassword && isAuthenticated) {
    return (
      <ResetPassword
        onComplete={() => {
          setIsResetPassword(false);
          window.history.replaceState(null, '', window.location.pathname);
        }}
      />
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // Show store selector if user has multiple stores and hasn't selected one
  if (!hasStore && stores.length > 1) {
    return <StoreSelector />;
  }

  // Show error if user has no stores
  if (!hasStore && stores.length === 0) {
    return (
      <div className="no-store-error">
        <h1>No Store Access</h1>
        <p>You don't have access to any stores. Please contact your administrator.</p>
        <button onClick={logout}>Sign Out</button>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Chick-fil-A Shift Lineup</h1>
          {currentStore && (
            <span className="store-badge">{currentStore.name}</span>
          )}
        </div>
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
          <button className="logout-btn" onClick={logout}>
            Sign Out
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

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
