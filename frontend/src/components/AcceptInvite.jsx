import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './Login.css';

function AcceptInvite({ token, onComplete }) {
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      const { data: invite, error: inviteError } = await supabase
        .from('store_invitations')
        .select(`
          *,
          stores (name)
        `)
        .eq('token', token)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (inviteError || !invite) {
        setError('This invitation is invalid or has expired.');
        return;
      }

      setInvitation(invite);
    } catch (err) {
      setError('Failed to load invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (e) => {
    e.preventDefault();
    setError('');

    // Validate username
    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      // Check if username is already taken
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmedUsername)
        .single();

      if (existingUser) {
        setError('This username is already taken');
        setSubmitting(false);
        return;
      }

      // Create new user account with a generated email (username@shiftlineup.local)
      const fakeEmail = `${trimmedUsername}@shiftlineup.local`;
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: fakeEmail,
        password: password,
        options: {
          data: {
            username: trimmedUsername
          }
        }
      });

      if (signUpError) {
        throw signUpError;
      }

      const userId = signUpData.user?.id;
      if (!userId) {
        throw new Error('Failed to create account');
      }

      // Update profile with username
      await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: fakeEmail,
          username: trimmedUsername
        });

      // Add user to store
      const { error: storeUserError } = await supabase
        .from('store_users')
        .insert({
          store_id: invitation.store_id,
          user_id: userId,
          role: invitation.role
        });

      if (storeUserError) {
        if (storeUserError.code === '23505') {
          setError('You already have access to this store.');
          setSubmitting(false);
          return;
        }
        throw storeUserError;
      }

      // Mark invitation as accepted
      await supabase
        .from('store_invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id);

      setSuccess(true);
      setTimeout(() => {
        onComplete();
      }, 2000);

    } catch (err) {
      console.error('Accept invite error:', err);
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>Invalid Invitation</h1>
            <p>{error}</p>
          </div>
          <button
            className="login-button"
            onClick={onComplete}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const roleLabels = {
    director: 'Director',
    coordinator: 'Coordinator',
    manager: 'Manager',
    viewer: 'Viewer'
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Join {invitation?.stores?.name}</h1>
          <p>
            You've been invited as a <strong>{roleLabels[invitation?.role]}</strong>
          </p>
        </div>

        {success ? (
          <div className="login-success">
            Welcome! Redirecting to the app...
          </div>
        ) : (
          <form onSubmit={handleAccept} className="login-form">
            {error && <div className="login-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="username">Choose a Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                required
                disabled={submitting}
                minLength={3}
                autoComplete="username"
              />
              <small style={{ color: '#666', fontSize: '0.8rem' }}>
                Letters, numbers, and underscores only
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="password">Create Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                required
                disabled={submitting}
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                disabled={submitting}
              />
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={submitting}
            >
              {submitting ? 'Creating Account...' : 'Accept Invitation'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AcceptInvite;
