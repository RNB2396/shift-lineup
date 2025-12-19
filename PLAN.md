# Multi-Store Login Implementation Plan

## Overview
Add per-store authentication so different Chick-fil-A locations can use the app with isolated data. Store managers are invited by you (admin), and users log in with email/password.

---

## Database Schema Changes

### New Tables

#### 1. `stores` - Store/location information
```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g., "CFA #12345 - Main Street"
  store_number TEXT UNIQUE,              -- Optional store identifier
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2. `store_users` - Links auth users to stores with roles
```sql
CREATE TABLE store_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, user_id)
);
```

### Modified Tables - Add `store_id`

| Table | Change |
|-------|--------|
| `employees` | Add `store_id UUID REFERENCES stores(id)` |
| `shifts` | Add `store_id UUID REFERENCES stores(id)` |
| `lineups` | Add `store_id UUID REFERENCES stores(id)` |

### Row Level Security Policies

All data tables will have RLS policies that:
1. Check user is authenticated
2. Verify user belongs to the store via `store_users`
3. Allow appropriate CRUD based on role

---

## Authentication Flow

### For You (Admin)
1. Create a store in the database (via Supabase dashboard or admin UI)
2. Invite a user by email - Supabase sends them an invite
3. User clicks link, sets password, and is associated with that store

### For Store Users
1. Go to app → see login screen
2. Enter email/password
3. App fetches their store(s) from `store_users`
4. If multiple stores, show store selector; otherwise auto-redirect
5. All data operations filtered by current `store_id`

---

## Implementation Steps

### Phase 1: Database Setup
1. Create `stores` table with migration
2. Create `store_users` table with migration
3. Add `store_id` column to `employees`, `shifts`, `lineups`
4. Create RLS policies for all tables
5. Migrate existing data to a default store (if any)

### Phase 2: Backend Changes
1. Add auth middleware to verify JWT tokens
2. Extract `store_id` from authenticated user context
3. Filter all queries by `store_id`
4. Add endpoints:
   - `GET /api/auth/me` - Get current user + store info
   - `POST /api/stores/invite` - Invite user to store (admin only)

### Phase 3: Frontend - Auth Components
1. Create `AuthContext` provider for global auth state
2. Create `Login.jsx` component (email/password form)
3. Create `StoreSelector.jsx` for users with multiple stores
4. Add protected route wrapper
5. Update `App.jsx` to check auth before showing main content

### Phase 4: Frontend - Integration
1. Pass `store_id` with all API requests (header or context)
2. Update `supabase.js` to include auth headers
3. Update `api.js` to include auth token
4. Add logout functionality
5. Show current store name in header

### Phase 5: Admin Features (Optional Enhancement)
1. Simple admin page to create stores
2. Invite user form (email + store + role)
3. View/manage store users

---

## File Changes Summary

### New Files
```
frontend/src/
├── context/
│   └── AuthContext.jsx          # Auth state management
├── components/
│   ├── Login.jsx                # Login form
│   ├── StoreSelector.jsx        # Multi-store picker
│   └── ProtectedRoute.jsx       # Route guard
└── hooks/
    └── useAuth.js               # Auth hook

backend/
├── middleware/
│   └── auth.js                  # JWT verification middleware
└── routes/
    └── auth.js                  # Auth-related endpoints
```

### Modified Files
```
frontend/src/
├── App.jsx                      # Add auth check, show login if needed
├── lib/supabase.js              # Add auth state listener
└── api.js                       # Add auth header to requests

backend/
├── server.js                    # Add auth middleware, new routes
└── config/supabase.js           # May need service role for admin ops
```

### Database Migrations
```
supabase/migrations/
├── 20241219_create_stores.sql
├── 20241219_create_store_users.sql
├── 20241219_add_store_id_to_tables.sql
└── 20241219_create_rls_policies.sql
```

---

## Security Considerations

1. **JWT Verification**: Backend validates Supabase JWT on every request
2. **RLS Enforcement**: Database-level security ensures data isolation
3. **Role-Based Access**: Owners can invite, managers can edit, viewers can only view
4. **Store Isolation**: Users can ONLY see data for stores they belong to

---

## Estimated Scope

| Phase | Complexity | Key Work |
|-------|------------|----------|
| Phase 1 | Medium | 4 migrations, RLS policies |
| Phase 2 | Medium | Auth middleware, query filtering |
| Phase 3 | Medium | Login UI, auth context |
| Phase 4 | Low | Wire up auth to existing components |
| Phase 5 | Low | Optional admin UI |

---

## Questions Resolved
- **Registration**: Invite-only (you create stores and invite managers)
- **Auth Method**: Email + Password
