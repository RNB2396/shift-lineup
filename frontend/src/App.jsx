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
import AdminPanel from './components/AdminPanel';
import PositionManager from './components/PositionManager';
import HouseToggle from './components/HouseToggle';
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
    canEditLineups,
    userRole
  } = useAuth();

  // Viewers default to saved lineups, others to lineup
  const [activeTab, setActiveTab] = useState(() =>
    userRole === 'viewer' ? 'saved' : 'lineup'
  );
  const [employees, setEmployees] = useState([]);
  const [shiftAssignments, setShiftAssignments] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [closingLineup, setClosingLineup] = useState(null);
  const [lineupDate, setLineupDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
  const [isAdminPage, setIsAdminPage] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [houseType, setHouseType] = useState('boh');

  // Check if this is a password reset flow, invite acceptance, or admin page
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

    // Check for admin page
    if (window.location.pathname === '/admin') {
      setIsAdminPage(true);
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

  // Show admin panel if on /admin route (requires login first)
  if (isAdminPage && isAuthenticated) {
    return (
      <div className="app">
        <header className="app-header admin-header-bar">
          <div className="header-left">
            <h1>Shift Lineup</h1>
            <span className="store-badge admin-badge">Admin</span>
          </div>
          <nav className="tabs desktop-tabs">
            <button onClick={() => {
              setIsAdminPage(false);
              window.history.replaceState(null, '', '/');
            }}>
              Back to App
            </button>
            <button className="logout-btn" onClick={logout}>
              Sign Out
            </button>
          </nav>
        </header>
        <main className="app-main">
          <AdminPanel />
        </main>
      </div>
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
      case 'positions': return 'Positions';
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
          {canEditLineups && activeTab !== 'team' && (
            <HouseToggle value={houseType} onChange={setHouseType} />
          )}
        </div>

        {/* Hamburger menu button */}
        <button
          className="menu-btn"
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

        {/* Dropdown menu */}
        {mobileMenuOpen && (
          <>
            <div className="menu-overlay" onClick={() => setMobileMenuOpen(false)} />
            <nav className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
              {canEditLineups && (
                <button
                  className={activeTab === 'lineup' ? 'active' : ''}
                  onClick={() => handleTabClick('lineup')}
                >
                  Lineup
                </button>
              )}
              <button
                className={activeTab === 'saved' ? 'active' : ''}
                onClick={() => handleTabClick('saved')}
              >
                Saved Lineups
              </button>
              {canEditLineups && (
                <button
                  className={activeTab === 'employees' ? 'active' : ''}
                  onClick={() => handleTabClick('employees')}
                >
                  Employees ({employees.length})
                </button>
              )}
              {canEditLineups && (
                <button
                  className={activeTab === 'positions' ? 'active' : ''}
                  onClick={() => handleTabClick('positions')}
                >
                  Positions
                </button>
              )}
              <button
                className={activeTab === 'team' ? 'active' : ''}
                onClick={() => handleTabClick('team')}
              >
                Team
              </button>
              <button className="logout-btn" onClick={logout}>
                Sign Out
              </button>
            </nav>
          </>
        )}
      </header>

      <main className="app-main">
        {activeTab === 'team' ? (
          <TeamManager />
        ) : activeTab === 'positions' ? (
          <PositionManager houseType={houseType} />
        ) : activeTab === 'employees' ? (
          <EmployeeManager
            employees={employees}
            onRefresh={loadEmployees}
            houseType={houseType}
          />
        ) : activeTab === 'saved' ? (
          <SavedLineups canEdit={canEditLineups} houseType={houseType} />
        ) : (
          <div className="lineup-page">
            <ShiftInput
              employees={employees}
              shiftAssignments={shiftAssignments}
              setShiftAssignments={setShiftAssignments}
              lineupDate={lineupDate}
              setLineupDate={setLineupDate}
              houseType={houseType}
            />
            <LineupDisplay
              shiftAssignments={shiftAssignments}
              lineups={lineups}
              setLineups={setLineups}
              closingLineup={closingLineup}
              setClosingLineup={setClosingLineup}
              lineupDate={lineupDate}
              houseType={houseType}
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
