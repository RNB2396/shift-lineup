import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import StoreSelector from './components/StoreSelector';
import ResetPassword from './components/ResetPassword';
import AcceptInvite from './components/AcceptInvite';
import EmployeeManager from './components/EmployeeManager';
import ShiftInput from './components/ShiftInput';
import LineupDisplay from './components/LineupDisplay';
import SavedLineups from './components/SavedLineups';
import TeamManager from './components/TeamManager';
import { employeeApi } from './api';
import './App.css';

function AppContent() {
  const {
    isAuthenticated,
    hasStore,
    loading: authLoading,
    stores,
    currentStore,
    logout,
    canInviteUsers,
    userRole
  } = useAuth();

  const [activeTab, setActiveTab] = useState('lineup');
  const [employees, setEmployees] = useState([]);
  const [shiftAssignments, setShiftAssignments] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [closingLineup, setClosingLineup] = useState(null);
  const [lineupDate, setLineupDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if this is a password reset flow or invite acceptance
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setIsResetPassword(true);
    }

    // Check for invite token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (window.location.pathname === '/accept-invite' && token) {
      setInviteToken(token);
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

  // Show accept invite page if token present
  if (inviteToken) {
    return (
      <AcceptInvite
        token={inviteToken}
        onComplete={() => {
          setInviteToken(null);
          window.history.replaceState(null, '', '/');
          window.location.reload();
        }}
      />
    );
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

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const getTabLabel = (tab) => {
    switch (tab) {
      case 'lineup': return 'Lineup';
      case 'saved': return 'Saved Lineups';
      case 'employees': return `Employees (${employees.length})`;
      case 'team': return 'Team';
      default: return tab;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Shift Lineup</h1>
          {currentStore && (
            <span className="store-badge">{currentStore.name}</span>
          )}
        </div>

        {/* Mobile hamburger button */}
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className="hamburger-icon">
            <span></span>
            <span></span>
            <span></span>
          </span>
          <span className="current-tab-label">{getTabLabel(activeTab)}</span>
        </button>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <>
            <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)} />
            <nav className="mobile-menu" onClick={(e) => e.stopPropagation()}>
              <button
                className={activeTab === 'lineup' ? 'active' : ''}
                onClick={() => handleTabClick('lineup')}
              >
                Lineup
              </button>
              <button
                className={activeTab === 'saved' ? 'active' : ''}
                onClick={() => handleTabClick('saved')}
              >
                Saved Lineups
              </button>
              <button
                className={activeTab === 'employees' ? 'active' : ''}
                onClick={() => handleTabClick('employees')}
              >
                Employees ({employees.length})
              </button>
              {canInviteUsers && (
                <button
                  className={activeTab === 'team' ? 'active' : ''}
                  onClick={() => handleTabClick('team')}
                >
                  Team
                </button>
              )}
              <button className="logout-btn" onClick={logout}>
                Sign Out
              </button>
            </nav>
          </>
        )}

        {/* Desktop tabs */}
        <nav className="tabs desktop-tabs">
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
          {canInviteUsers && (
            <button
              className={activeTab === 'team' ? 'active' : ''}
              onClick={() => setActiveTab('team')}
            >
              Team
            </button>
          )}
          <button className="logout-btn" onClick={logout}>
            Sign Out
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'team' ? (
          <TeamManager />
        ) : activeTab === 'employees' ? (
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
              lineupDate={lineupDate}
              setLineupDate={setLineupDate}
            />
            <LineupDisplay
              shiftAssignments={shiftAssignments}
              lineups={lineups}
              setLineups={setLineups}
              closingLineup={closingLineup}
              setClosingLineup={setClosingLineup}
              lineupDate={lineupDate}
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
