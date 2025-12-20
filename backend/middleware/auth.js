const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

/**
 * Authentication middleware that verifies Supabase JWT tokens
 * and attaches user info to the request object
 */
async function authMiddleware(req, res, next) {
  // Skip auth if Supabase is not configured (local dev mode)
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Auth middleware skipped: Supabase not configured');
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // Create a client with the user's token to verify it
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Verify the token by getting the user
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user's stores and roles
    const { data: storeUsers, error: storeError } = await supabase
      .from('store_users')
      .select(`
        store_id,
        role,
        stores:store_id (
          id,
          name,
          store_number
        )
      `)
      .eq('user_id', user.id);

    if (storeError) {
      console.error('Error fetching user stores:', storeError);
      return res.status(500).json({ error: 'Failed to fetch user permissions' });
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      stores: storeUsers.map(su => ({
        id: su.store_id,
        name: su.stores?.name,
        storeNumber: su.stores?.store_number,
        role: su.role
      }))
    };

    // Also attach the authenticated supabase client for use in routes
    req.supabase = supabase;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware to require a specific store context
 * Must be used after authMiddleware
 * Expects store_id in request header or query param
 */
function requireStore(req, res, next) {
  const storeId = req.headers['x-store-id'] || req.query.store_id;

  if (!storeId) {
    return res.status(400).json({ error: 'Store ID is required' });
  }

  // Verify user has access to this store
  const userStore = req.user?.stores?.find(s => s.id === storeId);

  if (!userStore) {
    return res.status(403).json({ error: 'Access denied to this store' });
  }

  // Attach current store context to request
  req.store = {
    id: storeId,
    name: userStore.name,
    role: userStore.role
  };

  next();
}

/**
 * Middleware to require manager-level access or above
 * Must be used after requireStore
 * Allows: owner, director, coordinator, manager
 */
function requireManager(req, res, next) {
  const allowedRoles = ['owner', 'director', 'coordinator', 'manager'];
  if (!req.store || !allowedRoles.includes(req.store.role)) {
    return res.status(403).json({ error: 'Manager access or above required' });
  }
  next();
}

/**
 * Middleware to require owner role
 * Must be used after requireStore
 */
function requireOwner(req, res, next) {
  if (!req.store || req.store.role !== 'owner') {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}

module.exports = {
  authMiddleware,
  requireStore,
  requireManager,
  requireOwner
};
