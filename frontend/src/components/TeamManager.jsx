import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './TeamManager.css';

function TeamManager() {
  const { currentStore, canInviteUsers, userRole, user } = useAuth();
  const [teamMembers, setTeamMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('coordinator');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [changingRole, setChangingRole] = useState(null);
  const [inviteLink, setInviteLink] = useState('');

  const roleLabels = {
    owner: 'Operator',
    director: 'Director',
    coordinator: 'Coordinator',
    viewer: 'Viewer'
  };

  const roleDescriptions = {
    director: 'Can manage team, employees, and lineups',
    coordinator: 'Can manage employees and lineups',
    viewer: 'Can only view lineups'
  };

  // Roles that can be invited (owners and directors can invite these)
  const invitableRoles = userRole === 'owner'
    ? ['director', 'coordinator', 'viewer']
    : ['coordinator', 'viewer'];

  useEffect(() => {
    if (currentStore?.id) {
      loadTeamData();
    }
  }, [currentStore?.id]);

  const loadTeamData = async () => {
    setLoading(true);
    try {
      // Load team members with their profile info
      const { data: members, error: membersError } = await supabase
        .from('store_users')
        .select(`
          id,
          role,
          created_at,
          user_id,
          profiles (
            username,
            email,
            full_name
          )
        `)
        .eq('store_id', currentStore.id);

      if (membersError) throw membersError;

      // Flatten the profile data - prefer full_name over username over email
      const membersWithUsernames = members.map(member => ({
        ...member,
        displayName: member.profiles?.full_name || member.profiles?.username || member.profiles?.email || 'Unknown'
      }));

      setTeamMembers(membersWithUsernames);

      // Load pending invitations
      const { data: invites, error: invitesError } = await supabase
        .from('store_invitations')
        .select('*')
        .eq('store_id', currentStore.id)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString());

      if (invitesError) throw invitesError;
      setPendingInvites(invites || []);

    } catch (err) {
      console.error('Error loading team data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    setSending(true);

    try {
      const trimmedName = inviteName.trim();
      if (!trimmedName) {
        setInviteError('Please enter a name for this invitation');
        setSending(false);
        return;
      }

      // Create invitation with a name label (not email)
      const { data: invite, error: inviteErr } = await supabase
        .from('store_invitations')
        .insert({
          store_id: currentStore.id,
          name: trimmedName,
          role: inviteRole,
          invited_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (inviteErr) throw inviteErr;

      // Generate invite link
      const link = `${window.location.origin}/accept-invite?token=${invite.token}`;
      setInviteLink(link);
      setInviteSuccess(`Invitation created for ${trimmedName}! Share the link below.`);
      setInviteName('');
      setPendingInvites([...pendingInvites, invite]);

    } catch (err) {
      console.error('Invite error:', err);
      setInviteError(err.message || 'Failed to create invitation');
    } finally {
      setSending(false);
    }
  };

  const handleCancelInvite = async (inviteId) => {
    try {
      const { error } = await supabase
        .from('store_invitations')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;
      setPendingInvites(pendingInvites.filter(i => i.id !== inviteId));
    } catch (err) {
      console.error('Error canceling invite:', err);
      alert('Failed to cancel invitation');
    }
  };

  const handleRemoveMember = async (member) => {
    // Confirm removal
    if (!window.confirm(`Remove ${member.displayName} from ${currentStore.name}? They will lose access immediately.`)) {
      return;
    }

    setRemoving(member.id);
    try {
      const { error } = await supabase
        .from('store_users')
        .delete()
        .eq('id', member.id);

      if (error) throw error;
      setTeamMembers(teamMembers.filter(m => m.id !== member.id));
    } catch (err) {
      console.error('Error removing member:', err);
      alert('Failed to remove team member: ' + (err.message || 'Unknown error'));
    } finally {
      setRemoving(null);
    }
  };

  const handleLeaveStore = async () => {
    const otherOperators = teamMembers.filter(m => m.role === 'owner' && m.user_id !== user?.id);

    if (otherOperators.length === 0) {
      alert('You cannot leave - there must be at least one other operator in the store.');
      return;
    }

    if (!window.confirm(`Are you sure you want to leave ${currentStore.name}? You will lose access immediately.`)) {
      return;
    }

    try {
      const myMembership = teamMembers.find(m => m.user_id === user?.id);
      if (!myMembership) return;

      const { error } = await supabase
        .from('store_users')
        .delete()
        .eq('id', myMembership.id);

      if (error) throw error;

      // Reload the page to reset store context
      window.location.reload();
    } catch (err) {
      console.error('Error leaving store:', err);
      alert('Failed to leave store: ' + (err.message || 'Unknown error'));
    }
  };

  // Check if current user can leave the store (remove themselves)
  const canLeaveStore = () => {
    // Only operators can leave, and only if there's another operator
    if (userRole !== 'owner') return false;
    const otherOperators = teamMembers.filter(m => m.role === 'owner' && m.user_id !== user?.id);
    return otherOperators.length > 0;
  };

  // Check if current user can remove a specific member
  const canRemoveMember = (member) => {
    // Can't remove owners (except yourself via Leave Store)
    if (member.role === 'owner') return false;
    // Can't remove yourself through this function
    if (member.user_id === user?.id) return false;
    // Only owners and directors can remove
    if (!canInviteUsers) return false;
    // Directors can't remove other directors
    if (userRole === 'director' && member.role === 'director') return false;
    return true;
  };

  // Check if current user can change a member's role
  const canChangeRole = (member) => {
    // Can't change your own role
    if (member.user_id === user?.id) return false;
    // Can't change owner's role
    if (member.role === 'owner') return false;
    // Only owners and directors can change roles
    if (userRole !== 'owner' && userRole !== 'director') return false;
    // Directors can't change other directors' roles
    if (userRole === 'director' && member.role === 'director') return false;
    return true;
  };

  // Get assignable roles based on current user's role
  const getAssignableRoles = (member) => {
    if (userRole === 'owner') {
      // Owners can assign any role except owner
      return ['director', 'coordinator', 'viewer'];
    } else if (userRole === 'director') {
      // Directors can only assign coordinator, viewer
      return ['coordinator', 'viewer'];
    }
    return [];
  };

  const handleChangeRole = async (member, newRole) => {
    if (newRole === member.role) return;

    setChangingRole(member.id);
    try {
      const { error } = await supabase
        .from('store_users')
        .update({ role: newRole })
        .eq('id', member.id);

      if (error) throw error;

      // Update local state
      setTeamMembers(teamMembers.map(m =>
        m.id === member.id ? { ...m, role: newRole } : m
      ));
    } catch (err) {
      console.error('Error changing role:', err);
      alert('Failed to change role: ' + (err.message || 'Unknown error'));
    } finally {
      setChangingRole(null);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return <div className="loading">Loading team...</div>;
  }

  return (
    <div className="team-manager">
      <div className="section-header">
        <h2>Team Members</h2>
        <div className="header-actions">
          {canInviteUsers && (
            <button
              className="btn-primary"
              onClick={() => setShowInviteModal(true)}
            >
              Invite Team Member
            </button>
          )}
          {canLeaveStore() && (
            <button
              className="btn-danger"
              onClick={handleLeaveStore}
            >
              Leave Store
            </button>
          )}
        </div>
      </div>

      {/* Current Team Members */}
      <div className="team-list">
        {teamMembers.length === 0 ? (
          <p className="empty-state">No team members yet.</p>
        ) : (
          teamMembers.map(member => (
            <div key={member.id} className="team-card">
              <div className="team-member-info">
                <span className="member-name">{member.displayName}</span>
                {canChangeRole(member) ? (
                  <select
                    className="role-select"
                    value={member.role}
                    onChange={(e) => handleChangeRole(member, e.target.value)}
                    disabled={changingRole === member.id}
                  >
                    {getAssignableRoles(member).map(role => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`role-badge ${member.role}`}>
                    {roleLabels[member.role]}
                  </span>
                )}
                {member.user_id === user?.id && (
                  <span className="you-badge">You</span>
                )}
              </div>
              <div className="team-member-actions">
                <span className="member-date">
                  Joined {formatDate(member.created_at)}
                </span>
                {canRemoveMember(member) && (
                  <button
                    className="btn-small btn-danger"
                    onClick={() => handleRemoveMember(member)}
                    disabled={removing === member.id}
                  >
                    {removing === member.id ? 'Removing...' : 'Remove'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <>
          <h3 className="subsection-title">Pending Invitations</h3>
          <div className="invites-list">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="invite-card">
                <div className="invite-info">
                  <span className="invite-name">{invite.name || 'Unnamed'}</span>
                  <span className={`role-badge ${invite.role}`}>
                    {roleLabels[invite.role]}
                  </span>
                </div>
                <div className="invite-actions">
                  <span className="invite-expires">
                    Expires {formatDate(invite.expires_at)}
                  </span>
                  {canInviteUsers && (
                    <button
                      className="btn-small btn-danger"
                      onClick={() => handleCancelInvite(invite.id)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Invite Team Member</h3>
            <p className="modal-description">
              Send an invitation to join {currentStore.name}
            </p>

            {inviteLink ? (
              <div className="invite-link-container">
                <div className="success-message">{inviteSuccess}</div>
                <div className="form-group">
                  <label>Invite Link</label>
                  <div className="invite-link-box">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      onClick={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                        alert('Link copied to clipboard!');
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteLink('');
                      setInviteSuccess('');
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInvite}>
                {inviteError && <div className="error-message">{inviteError}</div>}

                <div className="form-group">
                  <label htmlFor="inviteName">Name</label>
                  <input
                    id="inviteName"
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Smith"
                    required
                    disabled={sending}
                  />
                  <small style={{ color: '#666', fontSize: '0.8rem' }}>
                    A name to identify this invitation
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="inviteRole">Role</label>
                  <select
                    id="inviteRole"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    disabled={sending}
                  >
                    {invitableRoles.map(role => (
                      <option key={role} value={role}>
                        {roleLabels[role]} - {roleDescriptions[role]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowInviteModal(false)}
                    disabled={sending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={sending}
                  >
                    {sending ? 'Creating...' : 'Create Invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamManager;
