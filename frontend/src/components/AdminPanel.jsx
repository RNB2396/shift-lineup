import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './AdminPanel.css';

function AdminPanel() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);

  // New store form
  const [showNewStoreForm, setShowNewStoreForm] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreNumber, setNewStoreNumber] = useState('');
  const [creating, setCreating] = useState(false);

  // Invite form
  const [invitingStoreId, setInvitingStoreId] = useState(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('owner');
  const [inviteLink, setInviteLink] = useState('');
  const [sending, setSending] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkSuperAdmin();
  }, [user]);

  const checkSuperAdmin = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: checkError } = await supabase
        .from('super_admins')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking super admin:', checkError);
      }

      setIsSuperAdmin(!!data);

      if (data) {
        await loadAllData();
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async () => {
    try {
      // Load all stores
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select(`
          *,
          store_users (
            id,
            role,
            user_id,
            profiles (username, full_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (storesError) throw storesError;
      setStores(storesData || []);

      // Load pending invitations for all stores
      const { data: invitesData, error: invitesError } = await supabase
        .from('store_invitations')
        .select(`
          *,
          stores (name)
        `)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;
      setPendingInvites(invitesData || []);

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCreating(true);

    try {
      const { data: newStore, error: createError } = await supabase
        .from('stores')
        .insert({
          name: newStoreName.trim(),
          store_number: newStoreNumber.trim() || null
        })
        .select()
        .single();

      if (createError) throw createError;

      setSuccess(`Store "${newStore.name}" created successfully!`);
      setNewStoreName('');
      setNewStoreNumber('');
      setShowNewStoreForm(false);
      await loadAllData();

    } catch (err) {
      console.error('Error creating store:', err);
      setError(err.message || 'Failed to create store');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);

    try {
      const { data: invite, error: inviteError } = await supabase
        .from('store_invitations')
        .insert({
          store_id: invitingStoreId,
          name: inviteName.trim(),
          role: inviteRole,
          invited_by: user.id
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      const link = `${window.location.origin}/accept-invite?token=${invite.token}`;
      setInviteLink(link);
      setSuccess(`Invitation created for ${inviteName}!`);
      await loadAllData();

    } catch (err) {
      console.error('Error creating invite:', err);
      setError(err.message || 'Failed to create invitation');
    } finally {
      setSending(false);
    }
  };

  const handleCancelInvite = async (inviteId) => {
    try {
      const { error: deleteError } = await supabase
        .from('store_invitations')
        .delete()
        .eq('id', inviteId);

      if (deleteError) throw deleteError;
      await loadAllData();
    } catch (err) {
      console.error('Error canceling invite:', err);
      alert('Failed to cancel invitation');
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStoreOwner = (store) => {
    const owner = store.store_users?.find(u => u.role === 'owner');
    if (owner?.profiles) {
      return owner.profiles.full_name || owner.profiles.username || 'Unknown';
    }
    return 'No owner yet';
  };

  const getTeamCount = (store) => {
    return store.store_users?.length || 0;
  };

  if (loading) {
    return <div className="admin-panel"><div className="loading">Loading...</div></div>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="admin-panel">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You don't have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <button
          className="btn-primary"
          onClick={() => {
            setShowNewStoreForm(true);
            setInvitingStoreId(null);
            setInviteLink('');
          }}
        >
          + New Store
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* New Store Form */}
      {showNewStoreForm && (
        <div className="admin-card form-card">
          <h3>Create New Store</h3>
          <form onSubmit={handleCreateStore}>
            <div className="form-group">
              <label htmlFor="storeName">Store Name</label>
              <input
                id="storeName"
                type="text"
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                placeholder="CFA #12345 - Main Street"
                required
                disabled={creating}
              />
            </div>
            <div className="form-group">
              <label htmlFor="storeNumber">Store Number (optional)</label>
              <input
                id="storeNumber"
                type="text"
                value={newStoreNumber}
                onChange={(e) => setNewStoreNumber(e.target.value)}
                placeholder="12345"
                disabled={creating}
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowNewStoreForm(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Store'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stores List */}
      <div className="admin-section">
        <h2>All Stores ({stores.length})</h2>
        <div className="stores-grid">
          {stores.length === 0 ? (
            <p className="empty-state">No stores yet. Create one to get started!</p>
          ) : (
            stores.map(store => (
              <div key={store.id} className="store-card">
                <div className="store-card-header">
                  <h3>{store.name}</h3>
                  {store.store_number && (
                    <span className="store-number">#{store.store_number}</span>
                  )}
                </div>
                <div className="store-card-info">
                  <p><strong>Owner:</strong> {getStoreOwner(store)}</p>
                  <p><strong>Team:</strong> {getTeamCount(store)} member{getTeamCount(store) !== 1 ? 's' : ''}</p>
                  <p><strong>Created:</strong> {formatDate(store.created_at)}</p>
                </div>
                <div className="store-card-actions">
                  <button
                    className="btn-small btn-primary"
                    onClick={() => {
                      setInvitingStoreId(store.id);
                      setInviteName('');
                      setInviteRole('owner');
                      setInviteLink('');
                      setShowNewStoreForm(false);
                      setError('');
                      setSuccess('');
                    }}
                  >
                    Invite User
                  </button>
                </div>

                {/* Invite Form for this store */}
                {invitingStoreId === store.id && !inviteLink && (
                  <div className="invite-form-inline">
                    <form onSubmit={handleCreateInvite}>
                      <div className="form-row">
                        <input
                          type="text"
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          placeholder="Name"
                          required
                          disabled={sending}
                        />
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          disabled={sending}
                        >
                          <option value="owner">Owner</option>
                          <option value="director">Director</option>
                          <option value="coordinator">Coordinator</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </div>
                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn-small btn-secondary"
                          onClick={() => setInvitingStoreId(null)}
                          disabled={sending}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn-small btn-primary"
                          disabled={sending || !inviteName.trim()}
                        >
                          {sending ? 'Creating...' : 'Create Invite'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Show invite link */}
                {invitingStoreId === store.id && inviteLink && (
                  <div className="invite-link-inline">
                    <p>Invite link for {inviteName}:</p>
                    <div className="invite-link-box">
                      <input
                        type="text"
                        value={inviteLink}
                        readOnly
                        onClick={(e) => e.target.select()}
                      />
                      <button
                        type="button"
                        className="btn-small btn-primary"
                        onClick={() => {
                          navigator.clipboard.writeText(inviteLink);
                          alert('Link copied!');
                        }}
                      >
                        Copy
                      </button>
                    </div>
                    <button
                      className="btn-small btn-secondary"
                      onClick={() => {
                        setInvitingStoreId(null);
                        setInviteLink('');
                      }}
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <div className="admin-section">
          <h2>Pending Invitations ({pendingInvites.length})</h2>
          <div className="invites-list">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="invite-row">
                <div className="invite-info">
                  <span className="invite-name">{invite.name}</span>
                  <span className="invite-store">{invite.stores?.name}</span>
                  <span className={`role-badge ${invite.role}`}>{invite.role}</span>
                </div>
                <div className="invite-actions">
                  <span className="invite-expires">Expires {formatDate(invite.expires_at)}</span>
                  <button
                    className="btn-small btn-secondary"
                    onClick={() => {
                      const link = `${window.location.origin}/accept-invite?token=${invite.token}`;
                      navigator.clipboard.writeText(link);
                      alert('Link copied!');
                    }}
                  >
                    Copy Link
                  </button>
                  <button
                    className="btn-small btn-danger"
                    onClick={() => handleCancelInvite(invite.id)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
