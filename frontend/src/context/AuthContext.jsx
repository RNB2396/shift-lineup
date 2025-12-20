import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, setLineupStoreId } from '../lib/supabase';
import { setCurrentStoreId } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [stores, setStores] = useState([]);
  const [currentStore, setCurrentStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user's stores from the backend
  const fetchUserStores = async (session) => {
    if (!session?.access_token) return [];

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      const data = await response.json();
      return data.stores || [];
    } catch (err) {
      console.error('Error fetching stores:', err);
      return [];
    }
  };

  // Initialize auth state
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const userStores = await fetchUserStores(session);
        setStores(userStores);

        // Auto-select store if user only has one
        if (userStores.length === 1) {
          setCurrentStore(userStores[0]);
          setCurrentStoreId(userStores[0].id);
          setLineupStoreId(userStores[0].id);
        } else {
          // Try to restore from localStorage
          const savedStoreId = localStorage.getItem('currentStoreId');
          if (savedStoreId) {
            const savedStore = userStores.find(s => s.id === savedStoreId);
            if (savedStore) {
              setCurrentStore(savedStore);
              setCurrentStoreId(savedStore.id);
              setLineupStoreId(savedStore.id);
            }
          }
        }
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          const userStores = await fetchUserStores(session);
          setStores(userStores);

          if (userStores.length === 1) {
            setCurrentStore(userStores[0]);
            setCurrentStoreId(userStores[0].id);
            setLineupStoreId(userStores[0].id);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setStores([]);
          setCurrentStore(null);
          setCurrentStoreId(null);
          setLineupStoreId(null);
          localStorage.removeItem('currentStoreId');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Login with email and password
  const login = async (email, password) => {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    setError(null);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      setError(authError.message);
      throw authError;
    }

    return data;
  };

  // Logout
  const logout = async () => {
    if (!supabase) return;

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error('Logout error:', signOutError);
    }

    setUser(null);
    setStores([]);
    setCurrentStore(null);
    setCurrentStoreId(null);
    setLineupStoreId(null);
    localStorage.removeItem('currentStoreId');
  };

  // Select a store (for users with multiple stores)
  const selectStore = (store) => {
    setCurrentStore(store);
    setCurrentStoreId(store.id); // Update API header
    setLineupStoreId(store.id); // Update lineup service
    localStorage.setItem('currentStoreId', store.id);
  };

  // Get current access token (for API calls)
  const getAccessToken = async () => {
    if (!supabase) return null;

    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // Role hierarchy: owner > director > coordinator > manager > viewer
  const canInviteUsers = ['owner', 'director'].includes(currentStore?.role);
  const canManageEmployees = ['owner', 'director', 'coordinator', 'manager'].includes(currentStore?.role);
  const canEditLineups = ['owner', 'director', 'coordinator', 'manager'].includes(currentStore?.role);

  const value = {
    user,
    stores,
    currentStore,
    loading,
    error,
    login,
    logout,
    selectStore,
    getAccessToken,
    isAuthenticated: !!user,
    hasStore: !!currentStore,
    isManager: canManageEmployees,
    isOwner: currentStore?.role === 'owner',
    isDirector: currentStore?.role === 'director',
    canInviteUsers,
    canManageEmployees,
    canEditLineups,
    userRole: currentStore?.role
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
